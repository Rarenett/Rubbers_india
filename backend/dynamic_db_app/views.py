"""
DRF Views for Dynamic Database Designer.

Endpoints:
  Schema management (IsAdminUser required):
    GET  /api/dynamic-db/tables/                    → list all managed tables
    POST /api/dynamic-db/tables/                    → create a new table
    GET  /api/dynamic-db/tables/<table_name>/       → get table detail + fields
    DELETE /api/dynamic-db/tables/<table_name>/     → drop table + delete metadata
    POST /api/dynamic-db/tables/<table_name>/columns/       → add column
    PUT  /api/dynamic-db/tables/<table_name>/columns/<col>/ → modify/rename column
    DELETE /api/dynamic-db/tables/<table_name>/columns/<col>/ → drop column
    GET  /api/dynamic-db/mysql-tables/              → list raw MySQL tables

  Generic data CRUD (IsAuthenticated):
    GET    /api/dynamic/<table_name>/           → paginated select
    POST   /api/dynamic/<table_name>/           → insert row
    GET    /api/dynamic/<table_name>/<pk>/      → get single row
    PUT    /api/dynamic/<table_name>/<pk>/      → update row
    DELETE /api/dynamic/<table_name>/<pk>/      → delete row
"""
import re
import json
import logging
from django.db import connection, transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.permissions import IsAuthenticated

from .models import DynamicTable, DynamicField
from .serializers import (
    DynamicTableSerializer,
    DynamicTableListSerializer,
    CreateTableRequestSerializer,
    AddColumnSerializer,
    ModifyColumnSerializer,
    RenameColumnSerializer,
)
from . import sql_service, crud_service
from .validators import validate_identifier, build_db_table_name

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Custom permission: allow is_staff OR is_superuser (handles ERP "Super Admin")
# ---------------------------------------------------------------------------

class IsStaffOrSuperuser(permissions.BasePermission):
    """
    Grants access to users who are either is_staff=True OR is_superuser=True.
    Django's built-in IsAdminUser only checks is_staff, which may be False
    for superusers created directly in the ERP.
    """
    message = 'Schema changes require admin or superuser access.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_staff or request.user.is_superuser)
        )


# ---------------------------------------------------------------------------
# Helpers for Auto-Syncing Physical Tables with Metadata
# ---------------------------------------------------------------------------

def parse_mysql_type(mysql_type_str):
    """
    Parses MySQL data types like 'varchar(255)', 'decimal(10,2)', 'int(11)'
    and returns (data_type, length, precision, scale).
    """
    mysql_type_str = mysql_type_str.lower()
    
    # 1. Decimal
    m = re.match(r'^decimal\((\d+),(\d+)\)', mysql_type_str)
    if m:
        return 'DECIMAL', None, int(m.group(1)), int(m.group(2))
        
    # 2. Varchar
    m = re.match(r'^varchar\((\d+)\)', mysql_type_str)
    if m:
        return 'VARCHAR', int(m.group(1)), None, None
        
    # 3. Tinyint(1) (Boolean representation in MySQL)
    if mysql_type_str.startswith('tinyint(1)'):
        return 'BOOLEAN', None, None, None
        
    # 4. Int / Bigint
    if mysql_type_str.startswith('bigint'):
        return 'BIGINT', None, None, None
    if mysql_type_str.startswith('int'):
        return 'INT', None, None, None
        
    # 5. Float
    if mysql_type_str.startswith('float'):
        return 'FLOAT', None, None, None
        
    # 6. Text types
    if mysql_type_str.startswith('longtext'):
        return 'LONGTEXT', None, None, None
    if mysql_type_str.startswith('text'):
        return 'TEXT', None, None, None
        
    # 7. Date/Time
    if mysql_type_str.startswith('datetime'):
        return 'DATETIME', None, None, None
    if mysql_type_str.startswith('date'):
        return 'DATE', None, None, None
    if mysql_type_str.startswith('time'):
        return 'TIME', None, None, None
        
    return 'VARCHAR', 255, None, None


def sync_physical_tables(created_by_user=None):
    """
    Scans MySQL for physical tables prefixed with 'dyn_'.
    If any physical table is missing from DynamicTable metadata,
    it automatically imports it and reconstructs its fields.
    """
    try:
        all_tables = sql_service.show_tables()
        dyn_tables = [t for t in all_tables if t.startswith('dyn_')]
        
        for db_table in dyn_tables:
            # Strip prefix to get logical name
            logical_name = db_table[4:]  # Remove 'dyn_'
            
            # Check if metadata entry exists
            if not DynamicTable.objects.filter(table_name=logical_name).exists():
                logger.info(f"Auto-syncing table metadata for physical table: {db_table}")
                
                # Fetch raw columns
                raw_cols = sql_service.describe_table(logical_name)
                
                # Create the DynamicTable metadata within a transaction
                with transaction.atomic():
                    dyn_table = DynamicTable.objects.create(
                        table_name=logical_name,
                        db_table=db_table,
                        description="Auto-synced from physical MySQL database",
                        created_by=created_by_user
                    )
                    
                    for order, col in enumerate(raw_cols):
                        field_name = col['Field']
                        
                        # Map attributes
                        data_type, length, precision, scale = parse_mysql_type(col['Type'])
                        
                        is_nullable = col['Null'].upper() == 'YES'
                        is_primary = 'PRI' in col['Key'].upper()
                        is_unique = 'UNI' in col['Key'].upper()
                        auto_increment = 'auto_increment' in col['Extra'].lower()
                        default_value = col['Default']
                        
                        DynamicField.objects.create(
                            table=dyn_table,
                            field_name=field_name,
                            field_order=order,
                            data_type=data_type,
                            length=length,
                            precision=precision,
                            scale=scale,
                            is_nullable=is_nullable,
                            is_unique=is_unique,
                            is_primary=is_primary,
                            auto_increment=auto_increment,
                            default_value=default_value
                        )
    except Exception as e:
        logger.error(f"Error during metadata auto-sync: {str(e)}", exc_info=True)


def is_system_table(dyn_table):
    """Checks if a table is developer-created (system table)."""
    if not dyn_table.table_name.startswith('dyn_'):
        return True
    try:
        desc_data = json.loads(dyn_table.description)
        return desc_data.get('is_system', False)
    except Exception:
        return False


def register_system_table_in_metadata(table_name, user=None):
    """
    On-demand registers an existing developer-created (system) table in the database
    into the DynamicTable and DynamicField metadata framework.
    Stores original columns list in JSON description to prevent deleting/altering them later.
    """
    try:
        db_table = table_name  # system tables don't use dyn_ prefix
        raw_cols = sql_service.describe_table(table_name)
        col_names = [col['Field'] for col in raw_cols]

        desc_json = json.dumps({
            'is_system': True,
            'system_columns': col_names
        })

        with transaction.atomic():
            dyn_table = DynamicTable.objects.create(
                table_name=table_name,
                db_table=db_table,
                description=desc_json,
                created_by=user
            )

            for order, col in enumerate(raw_cols):
                field_name = col['Field']
                data_type, length, precision, scale = parse_mysql_type(col['Type'])
                is_nullable = col['Null'].upper() == 'YES'
                is_primary = 'PRI' in col['Key'].upper()
                is_unique = 'UNI' in col['Key'].upper()
                auto_increment = 'auto_increment' in col['Extra'].lower()
                default_value = col['Default']

                DynamicField.objects.create(
                    table=dyn_table,
                    field_name=field_name,
                    field_order=order,
                    data_type=data_type,
                    length=length,
                    precision=precision,
                    scale=scale,
                    is_nullable=is_nullable,
                    is_unique=is_unique,
                    is_primary=is_primary,
                    auto_increment=auto_increment,
                    default_value=default_value
                )
            return dyn_table
    except Exception as e:
        logger.error(f"Failed to register system table '{table_name}': {str(e)}", exc_info=True)
        return None


def sync_table_columns_metadata(table_name):
    """
    Introspects MySQL columns for a table and compares them with DynamicField metadata.
    If a column exists in MySQL but is missing from DynamicField metadata,
    it automatically imports it.
    """
    try:
        dyn_table = DynamicTable.objects.get(table_name=table_name)
    except DynamicTable.DoesNotExist:
        return

    try:
        # Get live columns from MySQL
        raw_cols = sql_service.describe_table(table_name)
        
        # Get registered columns in metadata
        registered_cols = set(dyn_table.fields.values_list('field_name', flat=True))
        
        with transaction.atomic():
            for order, col in enumerate(raw_cols):
                field_name = col['Field']
                if field_name not in registered_cols:
                    logger.info(f"Syncing missing column '{field_name}' in metadata for table '{table_name}'")
                    data_type, length, precision, scale = parse_mysql_type(col['Type'])
                    is_nullable = col['Null'].upper() == 'YES'
                    is_primary = 'PRI' in col['Key'].upper()
                    is_unique = 'UNI' in col['Key'].upper()
                    auto_increment = 'auto_increment' in col['Extra'].lower()
                    default_value = col['Default']
                    
                    # Reconstruct 'fk:' metadata if this is a foreign key
                    if col['Key'].upper() == 'MUL' or 'MUL' in col['Key'].upper():
                        with connection.cursor() as cursor:
                            cursor.execute(
                                "SELECT REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.key_column_usage "
                                "WHERE table_schema = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s "
                                "AND REFERENCED_TABLE_NAME IS NOT NULL LIMIT 1;",
                                [dyn_table.db_table, field_name]
                            )
                            fk_row = cursor.fetchone()
                            if fk_row:
                                target_tbl = fk_row[0]
                                if target_tbl.startswith('dyn_'):
                                    target_tbl = target_tbl[4:]
                                default_value = f"fk:{target_tbl}:name"
                    
                    DynamicField.objects.create(
                        table=dyn_table,
                        field_name=field_name,
                        field_order=order,
                        data_type=data_type,
                        length=length,
                        precision=precision,
                        scale=scale,
                        is_nullable=is_nullable,
                        is_unique=is_unique,
                        is_primary=is_primary,
                        auto_increment=auto_increment,
                        default_value=default_value
                    )
    except Exception as e:
        logger.error(f"Failed to sync columns metadata for table '{table_name}': {str(e)}", exc_info=True)


def _table_or_404(table_name):
    """Return DynamicTable or raise a structured 404."""
    try:
        dyn_table = DynamicTable.objects.get(table_name=table_name)
        # Self-heal columns on load
        sync_table_columns_metadata(table_name)
        return dyn_table
    except DynamicTable.DoesNotExist:
        # If the table is not in metadata but exists physically in MySQL, register it on-demand!
        if sql_service.table_exists(table_name):
            return register_system_table_in_metadata(table_name)
        return None


# ---------------------------------------------------------------------------
# Schema Management Views
# ---------------------------------------------------------------------------

class TableListView(APIView):
    """
    GET  /api/dynamic-db/tables/  → list all tables (with auto-sync)
    POST /api/dynamic-db/tables/  → create a new table
    """
    permission_classes = [IsStaffOrSuperuser]

    def get(self, request):
        sync_physical_tables(request.user)
        tables = DynamicTable.objects.all()
        serializer = DynamicTableListSerializer(tables, many=True)
        return Response({'results': serializer.data, 'count': tables.count()})

    def post(self, request):
        serializer = CreateTableRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        data       = serializer.validated_data
        table_name = data['table_name']
        fields     = data['fields']

        # Check duplicate logical name
        if DynamicTable.objects.filter(table_name=table_name).exists():
            return Response(
                {'error': f"A table named '{table_name}' already exists."},
                status=status.HTTP_409_CONFLICT,
            )

        db_table = build_db_table_name(table_name)

        # Check physical table doesn't exist already
        if sql_service.table_exists(table_name):
            return Response(
                {'error': f"Physical table '{db_table}' already exists in MySQL."},
                status=status.HTTP_409_CONFLICT,
            )

        try:
            with transaction.atomic():
                # Filter out any field named 'id' from user input to prevent duplicate 'id' column errors
                filtered_fields = [f for f in fields if f['field_name'].lower() != 'id']

                # 1. Execute CREATE TABLE SQL (always adds 'id' BIGINT PK)
                sql_service.create_table(table_name, filtered_fields)

                # 2. Save metadata
                dyn_table = DynamicTable.objects.create(
                    table_name  = table_name,
                    db_table    = db_table,
                    description = data.get('description'),
                    created_by  = request.user,
                )

                # Auto-inject 'id' metadata at order 0
                DynamicField.objects.create(
                    table         = dyn_table,
                    field_name    = 'id',
                    field_order   = 0,
                    data_type     = 'BIGINT',
                    length        = None,
                    precision     = None,
                    scale         = None,
                    is_nullable   = False,
                    is_unique     = False,
                    is_primary    = True,
                    auto_increment= True,
                    default_value = None,
                )

                # Save user-defined fields metadata
                for idx, field in enumerate(filtered_fields):
                    DynamicField.objects.create(
                        table         = dyn_table,
                        field_name    = field['field_name'],
                        field_order   = idx + 1,
                        data_type     = field['data_type'],
                        length        = field.get('length'),
                        precision     = field.get('precision'),
                        scale         = field.get('scale'),
                        is_nullable   = field.get('is_nullable', True),
                        is_unique     = False,
                        is_primary    = False,
                        auto_increment= False,
                        default_value = field.get('default_value'),
                    )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("Failed to create table '%s'", table_name)
            return Response(
                {'error': f"Database error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        out = DynamicTableSerializer(dyn_table)
        return Response(out.data, status=status.HTTP_201_CREATED)


class TableDetailView(APIView):
    """
    GET    /api/dynamic-db/tables/<table_name>/ → detail + fields
    DELETE /api/dynamic-db/tables/<table_name>/ → drop table
    """
    permission_classes = [IsStaffOrSuperuser]

    def get(self, request, table_name):
        try:
            validate_identifier(table_name, 'table name')
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        dyn_table = _table_or_404(table_name)
        if not dyn_table:
            return Response({'error': f"Table '{table_name}' not found."}, status=status.HTTP_404_NOT_FOUND)

        # Also fetch live MySQL structure for comparison
        try:
            mysql_desc = sql_service.describe_table(table_name)
        except Exception:
            mysql_desc = []

        serializer = DynamicTableSerializer(dyn_table)
        return Response({**serializer.data, 'mysql_structure': mysql_desc})

    def delete(self, request, table_name):
        try:
            validate_identifier(table_name, 'table name')
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        dyn_table = _table_or_404(table_name)
        if not dyn_table:
            return Response({'error': f"Table '{table_name}' not found."}, status=status.HTTP_404_NOT_FOUND)

        # PREVENT DELETING SYSTEM TABLES!
        if is_system_table(dyn_table):
            return Response({'error': "Cannot delete developer-created system tables."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                sql_service.drop_table(table_name)   # DROP TABLE
                dyn_table.delete()                    # Remove metadata (cascade removes fields)
        except Exception as e:
            logger.exception("Failed to drop table '%s'", table_name)
            return Response(
                {'error': f"Database error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({'message': f"Table '{table_name}' deleted successfully."})


class ColumnManageView(APIView):
    """
    POST   /api/dynamic-db/tables/<table_name>/columns/        → add column
    PUT    /api/dynamic-db/tables/<table_name>/columns/<col>/  → modify/rename column
    DELETE /api/dynamic-db/tables/<table_name>/columns/<col>/  → drop column
    """
    permission_classes = [IsStaffOrSuperuser]

    def post(self, request, table_name):
        """Add a new column."""
        dyn_table = _table_or_404(table_name)
        if not dyn_table:
            return Response({'error': f"Table '{table_name}' not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = AddColumnSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        field = serializer.validated_data

        # Prevent duplicate column name in metadata
        if dyn_table.fields.filter(field_name=field['field_name']).exists():
            return Response(
                {'error': f"Column '{field['field_name']}' already exists in '{table_name}'."},
                status=status.HTTP_409_CONFLICT,
            )

        try:
            with transaction.atomic():
                sql_service.add_column(table_name, field)
                DynamicField.objects.create(
                    table         = dyn_table,
                    field_name    = field['field_name'],
                    field_order   = dyn_table.fields.count(),
                    data_type     = field['data_type'],
                    length        = field.get('length'),
                    precision     = field.get('precision'),
                    scale         = field.get('scale'),
                    is_nullable   = field.get('is_nullable', True),
                    is_unique     = field.get('is_unique', False),
                    is_primary    = field.get('is_primary', False),
                    auto_increment= field.get('auto_increment', False),
                    default_value = field.get('default_value'),
                )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("Failed to add column to '%s'", table_name)
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'message': f"Column '{field['field_name']}' added successfully."}, status=status.HTTP_201_CREATED)

    def put(self, request, table_name, column_name):
        """Modify or rename a column."""
        dyn_table = _table_or_404(table_name)
        if not dyn_table:
            return Response({'error': f"Table '{table_name}' not found."}, status=status.HTTP_404_NOT_FOUND)

        # PREVENT ALTERING SYSTEM COLUMNS IN SYSTEM TABLES
        if is_system_table(dyn_table):
            try:
                desc_data = json.loads(dyn_table.description)
                system_cols = desc_data.get('system_columns', [])
                if column_name in system_cols or request.data.get('old_name') in system_cols:
                    return Response(
                        {'error': "Cannot modify or rename developer-created columns of a system table."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except Exception:
                pass

        action = request.data.get('action', 'modify')   # 'modify' | 'rename'

        if action == 'rename':
            serializer = RenameColumnSerializer(data=request.data)
            if not serializer.is_valid():
                return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

            old_name = serializer.validated_data['old_name']
            field    = serializer.validated_data['field']

            try:
                with transaction.atomic():
                    sql_service.rename_column(table_name, old_name, field)
                    dyn_field = dyn_table.fields.get(field_name=old_name)
                    dyn_field.field_name    = field['field_name']
                    dyn_field.data_type     = field['data_type']
                    dyn_field.length        = field.get('length')
                    dyn_field.precision     = field.get('precision')
                    dyn_field.scale         = field.get('scale')
                    dyn_field.is_nullable   = field.get('is_nullable', True)
                    dyn_field.is_unique     = field.get('is_unique', False)
                    dyn_field.default_value = field.get('default_value')
                    dyn_field.save()
            except DynamicField.DoesNotExist:
                return Response({'error': f"Column '{old_name}' not found in metadata."}, status=status.HTTP_404_NOT_FOUND)
            except Exception as e:
                logger.exception("Failed to rename column '%s' in '%s'", old_name, table_name)
                return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            return Response({'message': f"Column renamed to '{field['field_name']}' successfully."})

        else:
            # Default: modify (change type / nullable / default)
            serializer = ModifyColumnSerializer(data=request.data)
            if not serializer.is_valid():
                return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

            field = serializer.validated_data

            try:
                with transaction.atomic():
                    sql_service.modify_column(table_name, field)
                    dyn_field = dyn_table.fields.get(field_name=column_name)
                    dyn_field.data_type     = field['data_type']
                    dyn_field.length        = field.get('length')
                    dyn_field.precision     = field.get('precision')
                    dyn_field.scale         = field.get('scale')
                    dyn_field.is_nullable   = field.get('is_nullable', True)
                    dyn_field.is_unique     = field.get('is_unique', False)
                    dyn_field.default_value = field.get('default_value')
                    dyn_field.save()
            except DynamicField.DoesNotExist:
                return Response({'error': f"Column '{column_name}' not found in metadata."}, status=status.HTTP_404_NOT_FOUND)
            except Exception as e:
                logger.exception("Failed to modify column '%s' in '%s'", column_name, table_name)
                return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            return Response({'message': f"Column '{column_name}' modified successfully."})

    def delete(self, request, table_name, column_name):
        """Drop a column."""
        dyn_table = _table_or_404(table_name)
        if not dyn_table:
            return Response({'error': f"Table '{table_name}' not found."}, status=status.HTTP_404_NOT_FOUND)

        # PREVENT DELETING SYSTEM COLUMNS IN SYSTEM TABLES
        if is_system_table(dyn_table):
            try:
                desc_data = json.loads(dyn_table.description)
                system_cols = desc_data.get('system_columns', [])
                if column_name in system_cols:
                    return Response(
                        {'error': "Cannot delete developer-created columns of a system table."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except Exception:
                pass

        try:
            validate_identifier(column_name, 'column name')
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Prevent dropping the id column
        if column_name == 'id':
            return Response({'error': "Cannot drop the 'id' column."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                sql_service.drop_column(table_name, column_name)
                dyn_table.fields.filter(field_name=column_name).delete()
        except Exception as e:
            logger.exception("Failed to drop column '%s' from '%s'", column_name, table_name)
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'message': f"Column '{column_name}' deleted successfully."})


class ShowMysqlTablesView(APIView):
    """GET /api/dynamic-db/mysql-tables/ — returns lists of raw tables."""
    permission_classes = [IsStaffOrSuperuser]

    def get(self, request):
        all_tables = sql_service.show_tables()
        
        # We classify tables into user-created (dynamic) vs developer-created (system)
        dynamic_tables = [t for t in all_tables if t.startswith('dyn_')]
        system_tables = [
            t for t in all_tables 
            if not t.startswith('dyn_') and t not in ('dynamic_tables', 'dynamic_fields', 'django_migrations')
        ]
        
        return Response({
            'dynamic_tables': dynamic_tables,
            'system_tables': system_tables,
            'all_tables': all_tables,
            'count': len(all_tables)
        })


# ---------------------------------------------------------------------------
# Generic CRUD View
# ---------------------------------------------------------------------------

class DynamicCRUDView(APIView):
    """
    Generic data operations on any user-created table.
    Requires IsAuthenticated (regular users can use data; only admins can alter schema).

    GET    /api/dynamic/<table_name>/        → list rows (paginated)
    POST   /api/dynamic/<table_name>/        → insert row
    GET    /api/dynamic/<table_name>/<pk>/   → get single row
    PUT    /api/dynamic/<table_name>/<pk>/   → update row
    DELETE /api/dynamic/<table_name>/<pk>/   → delete row
    """
    permission_classes = [IsAuthenticated]

    def _resolve_table(self, table_name):
        """Validate name and check metadata exists."""
        try:
            validate_identifier(table_name, 'table name')
        except ValueError as e:
            return None, str(e)

        if not DynamicTable.objects.filter(table_name=table_name).exists():
            # If the table is not registered in metadata, but physically exists in MySQL (system table), register it!
            if sql_service.table_exists(table_name):
                register_system_table_in_metadata(table_name)
            else:
                return None, f"Table '{table_name}' does not exist."

        return table_name, None

    def get(self, request, table_name, pk=None):
        name, err = self._resolve_table(table_name)
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

        if pk is not None:
            row = crud_service.dynamic_get(name, pk)
            if row is None:
                return Response({'error': 'Record not found.'}, status=status.HTTP_404_NOT_FOUND)
            return Response(row)

        # Pagination + filtering
        limit   = int(request.query_params.get('limit', 50))
        offset  = int(request.query_params.get('offset', 0))
        ordering = request.query_params.get('ordering', None)

        # Build filters from query params (exclude reserved params)
        reserved = {'limit', 'offset', 'ordering', 'format'}
        filters = {k: v for k, v in request.query_params.items() if k not in reserved}

        try:
            rows  = crud_service.dynamic_select(name, filters=filters or None, ordering=ordering, limit=limit, offset=offset)
            total = crud_service.dynamic_count(name, filters=filters or None)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("SELECT failed on '%s'", table_name)
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'results': rows, 'count': total, 'limit': limit, 'offset': offset})

    def post(self, request, table_name, pk=None):
        name, err = self._resolve_table(table_name)
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_id = crud_service.dynamic_insert(name, request.data)
            row    = crud_service.dynamic_get(name, new_id)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("INSERT failed on '%s'", table_name)
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(row, status=status.HTTP_201_CREATED)

    def put(self, request, table_name, pk=None):
        if pk is None:
            return Response({'error': 'Record ID required for update.'}, status=status.HTTP_400_BAD_REQUEST)

        name, err = self._resolve_table(table_name)
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

        try:
            count = crud_service.dynamic_update(name, pk, request.data)
            if count == 0:
                return Response({'error': 'Record not found or no changes made.'}, status=status.HTTP_404_NOT_FOUND)
            row = crud_service.dynamic_get(name, pk)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("UPDATE failed on '%s' id=%s", table_name, pk)
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(row)

    def delete(self, request, table_name, pk=None):
        if pk is None:
            return Response({'error': 'Record ID required for delete.'}, status=status.HTTP_400_BAD_REQUEST)

        name, err = self._resolve_table(table_name)
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

        try:
            count = crud_service.dynamic_delete(name, pk)
            if count == 0:
                return Response({'error': 'Record not found.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.exception("DELETE failed on '%s' id=%s", table_name, pk)
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'message': f"Record {pk} deleted successfully."})
