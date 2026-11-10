from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import ProtectedError
from django.db import IntegrityError
from django.http import StreamingHttpResponse, HttpResponse, FileResponse
from django.db import connection
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
import datetime
from register_app.permissions import module_permission
from .models import (
    ExchangeRate, Currency, Language, Company, CompanyAddress, CompanyContact, 
    CompanyFinancialYear, Branch, BranchAddress, BranchContact, BranchBankAccount,
    Factory, FactoryAddress, FactoryContact,
    Warehouse, WarehouseAddress, WarehouseContact,
    PrefixType, PrefixConfiguration
)
from .serializers import (
    ExchangeRateSerializer, CurrencySerializer, LanguageSerializer, 
    CompanySerializer, CompanyAddressSerializer, CompanyContactSerializer, 
    CompanyFinancialYearSerializer, BranchSerializer, BranchAddressSerializer, 
    BranchContactSerializer, BranchBankAccountSerializer,
    FactorySerializer, FactoryAddressSerializer, FactoryContactSerializer,
    WarehouseSerializer, WarehouseAddressSerializer, WarehouseContactSerializer,
    PrefixTypeSerializer, PrefixConfigurationSerializer
)

# Create your views here.

class CurrencyViewSet(viewsets.ModelViewSet):
    """
    ViewSet to list, create, edit, and delete currencies.
    """
    queryset = Currency.objects.all()
    serializer_class = CurrencySerializer
    permission_classes = [module_permission('currencies')]

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "Cannot delete this currency as it is linked to exchange rates, branches, or other records."},
                status=status.HTTP_400_BAD_REQUEST
            )

class ExchangeRateViewSet(viewsets.ModelViewSet):
    """
    ViewSet to list, create, edit, and delete currency exchange rates.
    """
    queryset = ExchangeRate.objects.all()
    serializer_class = ExchangeRateSerializer
    permission_classes = [module_permission('currencies')]

class LanguageViewSet(viewsets.ModelViewSet):
    """
    ViewSet to list, create, edit, and delete languages.
    """
    queryset = Language.objects.all()
    serializer_class = LanguageSerializer
    permission_classes = [module_permission('languages')]

class CompanyViewSet(viewsets.ModelViewSet):
    """
    ViewSet to list, create, and edit company settings.
    """
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    permission_classes = [module_permission('company')]

    @action(detail=False, methods=['get'], permission_classes=[])
    def branding(self, request):
        """
        Public endpoint — returns safe branding + theme fields (no auth required).
        Used by the Login page and ThemeContext to apply the correct colours in any browser.
        """
        from rest_framework.permissions import AllowAny
        self.permission_classes = [AllowAny]
        company = Company.objects.first()
        if not company:
            return Response({
                'id': None,
                'login_panel_color': '#0a500f',
                'display_name': '',
                'logo': None,
                'description': '',
                'vision': '',
                'mission': '',
                'theme_nav_header_color': '',
                'theme_header_color': '',
                'theme_sidebar_color': '',
                'theme_sidebar_font_color': '',
                'theme_primary_color': '',
                'theme_bg_color': '',
                'theme_font_color': '',
                'theme_form_icon_color': '',
                'theme_version': 'light',
                'date_format': 'DD/MM/YYYY',
            })
        logo_url = request.build_absolute_uri(company.logo.url) if company.logo else None
        title_logo_url = request.build_absolute_uri(company.title_logo.url) if company.title_logo else None
        return Response({
            'id': company.id,
            'login_panel_color': company.login_panel_color or '#0a500f',
            'display_name': company.display_name or company.name or '',
            'logo': logo_url,
            'title_logo': title_logo_url,
            'description': company.description or '',
            'vision': company.vision or '',
            'mission': company.mission or '',
            'date_format': company.date_format or 'DD/MM/YYYY',
            'theme_nav_header_color': company.theme_nav_header_color or '',
            'theme_header_color':     company.theme_header_color     or '',
            'theme_sidebar_color':    company.theme_sidebar_color    or '',
            'theme_sidebar_font_color': company.theme_sidebar_font_color or '',
            'theme_primary_color':    company.theme_primary_color    or '',
            'theme_bg_color':         company.theme_bg_color         or '',
            'theme_font_color':       company.theme_font_color       or '',
            'theme_form_icon_color':  company.theme_form_icon_color  or '',
            'theme_version':          company.theme_version          or 'light',
        })

    def _ensure_default_branch_and_factory(self, company):
        """
        When a company does not have branches, automatically create a default
        Branch and Factory named after the company (if they don't already exist).
        """
        default_currency = company.default_currency
        if not default_currency:
            # Fall back to the first available currency
            default_currency = Currency.objects.first()

        if not default_currency:
            # Cannot create a Branch without a currency — skip silently
            return

        company_name = company.display_name or company.name

        # Get-or-create the default branch
        branch, _ = Branch.objects.get_or_create(
            company=company,
            name=company_name,
            defaults={
                'branch_code': (company.company_code or company_name[:3]).upper()[:3],
                'default_currency': default_currency,
                'timezone': company.timezone or 'Asia/Kolkata',
                'is_active': True,
            }
        )

        # Get-or-create the default factory linked to this branch
        Factory.objects.get_or_create(
            company=company,
            branch=branch,
            name=company_name,
            defaults={
                'factory_code': (company.company_code or company_name[:10]).upper()[:10],
                'timezone': company.timezone or 'Asia/Kolkata',
                'is_active': True,
            }
        )

    def perform_create(self, serializer):
        company = serializer.save()
        if not company.has_branches:
            self._ensure_default_branch_and_factory(company)

    def perform_update(self, serializer):
        company = serializer.save()
        if not company.has_branches:
            self._ensure_default_branch_and_factory(company)

class CompanyAddressViewSet(viewsets.ModelViewSet):
    """
    ViewSet to manage company addresses.
    """
    queryset = CompanyAddress.objects.all()
    serializer_class = CompanyAddressSerializer
    permission_classes = [module_permission('company')]
    filterset_fields = ['company', 'address_type']

class CompanyContactViewSet(viewsets.ModelViewSet):
    """
    ViewSet to manage company contacts.
    """
    queryset = CompanyContact.objects.all()
    serializer_class = CompanyContactSerializer
    permission_classes = [module_permission('company')]
    filterset_fields = ['company']

class CompanyFinancialYearViewSet(viewsets.ModelViewSet):
    """
    ViewSet to manage company financial years.
    """
    queryset = CompanyFinancialYear.objects.all()
    serializer_class = CompanyFinancialYearSerializer
    permission_classes = [module_permission('company')]
    filterset_fields = ['company', 'is_active']

from rest_framework.decorators import action
from rest_framework.response import Response
from rarenett_app.models import Department

class BranchViewSet(viewsets.ModelViewSet):
    queryset = Branch.objects.all()
    serializer_class = BranchSerializer
    permission_classes = [module_permission('company')]
    filterset_fields = ['company']

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except (ProtectedError, IntegrityError):
            return Response(
                {"detail": "Cannot delete this branch as it is linked to factories, warehouses, employees, or other records in the system."},
                status=status.HTTP_400_BAD_REQUEST
            )


    @action(detail=True, methods=['post'])
    def update_departments(self, request, pk=None):
        branch = self.get_object()
        department_ids = request.data.get('department_ids', [])
        
        # Clear existing associations and add new ones
        # Since M2M is on Department, we need to handle it from that side or use the related name
        branch.departments.clear()
        if department_ids:
            departments = Department.objects.filter(id__in=department_ids)
            for dept in departments:
                dept.branches.add(branch)
        
        return Response({'status': 'departments updated'})

class BranchAddressViewSet(viewsets.ModelViewSet):
    queryset = BranchAddress.objects.all()
    serializer_class = BranchAddressSerializer
    permission_classes = [module_permission('company')]
    filterset_fields = ['branch']

class BranchContactViewSet(viewsets.ModelViewSet):
    queryset = BranchContact.objects.all()
    serializer_class = BranchContactSerializer
    permission_classes = [module_permission('company')]
    filterset_fields = ['branch']

class BranchBankAccountViewSet(viewsets.ModelViewSet):
    queryset = BranchBankAccount.objects.all()
    serializer_class = BranchBankAccountSerializer
    permission_classes = [module_permission('company')]
    filterset_fields = ['branch']

class FactoryViewSet(viewsets.ModelViewSet):
    queryset = Factory.objects.all()
    serializer_class = FactorySerializer
    permission_classes = [module_permission('company')]
    filterset_fields = ['company', 'branch', 'is_active']

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except (ProtectedError, IntegrityError):
            return Response(
                {"detail": "Cannot delete this factory as it is linked to warehouses, employees, or other records in the system."},
                status=status.HTTP_400_BAD_REQUEST
            )


class FactoryAddressViewSet(viewsets.ModelViewSet):
    queryset = FactoryAddress.objects.all()
    serializer_class = FactoryAddressSerializer
    permission_classes = [module_permission('company')]
    filterset_fields = ['factory']

class FactoryContactViewSet(viewsets.ModelViewSet):
    queryset = FactoryContact.objects.all()
    serializer_class = FactoryContactSerializer
    permission_classes = [module_permission('company')]
    filterset_fields = ['factory']

class WarehouseViewSet(viewsets.ModelViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    filterset_fields = ['company', 'branch', 'factory', 'is_active']

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        if self.request.method in ['GET', 'HEAD', 'OPTIONS']:
            return [IsAuthenticated()]
        return [module_permission('company')()]

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except (ProtectedError, IntegrityError):
            return Response(
                {"detail": "Cannot delete this warehouse as it is linked to stock items, transaction records, employees, or other records in the system."},
                status=status.HTTP_400_BAD_REQUEST
            )


class WarehouseAddressViewSet(viewsets.ModelViewSet):
    queryset = WarehouseAddress.objects.all()
    serializer_class = WarehouseAddressSerializer
    permission_classes = [module_permission('company')]
    filterset_fields = ['warehouse']

class WarehouseContactViewSet(viewsets.ModelViewSet):
    queryset = WarehouseContact.objects.all()
    serializer_class = WarehouseContactSerializer
    permission_classes = [module_permission('company')]
    filterset_fields = ['warehouse']

class PrefixTypeViewSet(viewsets.ModelViewSet):
    queryset = PrefixType.objects.all()
    serializer_class = PrefixTypeSerializer
    permission_classes = [module_permission('company')]

    @action(detail=True, methods=['get'], url_path='subtypes')
    def subtypes(self, request, pk=None):
        prefix_type = self.get_object()
        type_name = (prefix_type.type_name or '').lower()
        subtypes = []
        if 'stock journal' in type_name:
            from finance_app.models import StockJournalType
            subtypes = list(StockJournalType.objects.values_list('stock_journal_type', flat=True))
        elif 'manufactural journal' in type_name or 'manufacturing journal' in type_name or 'manufacture journal' in type_name:
            from finance_app.models import ManufacturalJournalType
            subtypes = list(ManufacturalJournalType.objects.values_list('manufactural_journal_type', flat=True))
        return Response(subtypes)

class PrefixConfigurationViewSet(viewsets.ModelViewSet):
    queryset = PrefixConfiguration.objects.all()
    serializer_class = PrefixConfigurationSerializer
    permission_classes = [module_permission('company')]
    filterset_fields = ['voucher_type', 'branch', 'subvoucher_type']


class DatabaseInfoView(APIView):
    permission_classes = [IsAuthenticated]
    format_kwarg = None

    def get(self, request):
        try:
            db_settings = settings.DATABASES['default']
            db_name = db_settings.get('NAME', '')
            engine = db_settings.get('ENGINE', '').split('.')[-1]
            host = db_settings.get('HOST', 'localhost')
            port = db_settings.get('PORT', '3306')
            
            table_count = 0
            total_size_mb = 0.0
            tables_list = []
            
            with connection.cursor() as cursor:
                cursor.execute("SHOW TABLES")
                tables = [r[0] for r in cursor.fetchall()]
                table_count = len(tables)

                if 'mysql' in engine.lower():
                    try:
                        cursor.execute("""
                            SELECT table_name, round(((data_length + index_length) / 1024 / 1024), 2) AS size_mb 
                            FROM information_schema.TABLES 
                            WHERE table_schema = DATABASE()
                        """)
                        rows = cursor.fetchall()
                        for row in rows:
                            t_name, t_size = row[0], float(row[1] or 0)
                            total_size_mb += t_size
                            tables_list.append({"name": t_name, "size_mb": t_size})
                    except Exception:
                        tables_list = [{"name": t, "size_mb": 0} for t in tables]
                else:
                    tables_list = [{"name": t, "size_mb": 0} for t in tables]
            
            return Response({
                "database_name": db_name,
                "engine": engine,
                "host": host,
                "port": port,
                "table_count": table_count,
                "total_size_mb": round(total_size_mb, 2),
                "tables": tables_list[:50],
                "status": "Healthy"
            })
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



class DatabaseDownloadView(APIView):
    permission_classes = [IsAuthenticated]
    format_kwarg = None

    def get(self, request):
        export_format = (request.query_params.get('export_format') or request.query_params.get('format') or 'sql').lower()
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        db_settings = settings.DATABASES['default']
        db_name = db_settings.get('NAME', 'database')

        if export_format == 'json':
            import json
            from django.core.serializers import serialize
            from django.apps import apps

            try:
                tables_in_db = set(connection.introspection.table_names())
                all_objects = []

                for model in apps.get_models():
                    table_name = model._meta.db_table
                    if table_name in tables_in_db:
                        try:
                            qs = model.objects.all()
                            if qs.exists():
                                serialized = json.loads(serialize('json', qs))
                                all_objects.extend(serialized)
                        except Exception:
                            pass

                response = HttpResponse(json.dumps(all_objects, indent=2), content_type='application/json')
                response['Content-Disposition'] = f'attachment; filename="{db_name}_backup_{timestamp}.json"'
                return response
            except Exception as e:
                return Response({"detail": f"Failed to generate JSON backup: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        else:
            # Generate standard, mysqldump-compatible SQL with bulk multi-row INSERTs.
            import tempfile
            import os

            try:
                with connection.cursor() as cursor:
                    cursor.execute("SHOW TABLES")
                    tables = [r[0] for r in cursor.fetchall()]

                tmp = tempfile.NamedTemporaryFile(
                    mode='w', suffix='.sql', prefix=f'{db_name}_backup_',
                    delete=False, encoding='utf-8'
                )
                tmp_path = tmp.name

                try:
                    now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    tmp.write(f"-- MySQL Dump generated for database `{db_name}`\n")
                    tmp.write(f"-- Timestamp: {now_str}\n")
                    tmp.write("-- ------------------------------------------------------\n\n")
                    tmp.write("/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;\n")
                    tmp.write("/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;\n")
                    tmp.write("/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;\n")
                    tmp.write("/*!40101 SET NAMES utf8mb4 */;\n")
                    tmp.write("/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;\n")
                    tmp.write("/*!40103 SET TIME_ZONE='+00:00' */;\n")
                    tmp.write("/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;\n")
                    tmp.write("/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;\n")
                    tmp.write("/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;\n")
                    tmp.write("/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;\n\n")
                    tmp.write(f"-- CREATE DATABASE IF NOT EXISTS `{db_name}`;\n")
                    tmp.write(f"-- USE `{db_name}`;\n\n")

                    for table in tables:
                        tmp.write(f"--\n-- Table structure for table `{table}`\n--\n\n")
                        tmp.write(f"DROP TABLE IF EXISTS `{table}`;\n")

                        try:
                            with connection.cursor() as cursor:
                                cursor.execute(f"SHOW CREATE TABLE `{table}`")
                                create_row = cursor.fetchone()
                            if create_row and len(create_row) > 1:
                                tmp.write(f"{create_row[1]};\n\n")
                        except Exception as e:
                            tmp.write(f"-- Error getting schema for `{table}`: {e}\n\n")

                        try:
                            with connection.cursor() as cursor:
                                cursor.execute(f"SELECT * FROM `{table}`")
                                columns = [col[0] for col in cursor.description]
                                rows = cursor.fetchall()

                            if rows:
                                tmp.write(f"--\n-- Dumping data for table `{table}`\n--\n\n")
                                tmp.write(f"LOCK TABLES `{table}` WRITE;\n")
                                tmp.write(f"/*!40000 ALTER TABLE `{table}` DISABLE KEYS */;\n")

                                col_names = ", ".join([f"`{c}`" for c in columns])
                                batch_size = 100
                                for i in range(0, len(rows), batch_size):
                                    batch_rows = rows[i:i + batch_size]
                                    val_tuples = []
                                    for row in batch_rows:
                                        val_list = []
                                        for val in row:
                                            if val is None:
                                                val_list.append("NULL")
                                            elif isinstance(val, (int, float)):
                                                val_list.append(str(val))
                                            elif isinstance(val, (bytes, bytearray)):
                                                val_list.append(f"0x{val.hex()}")
                                            elif isinstance(val, bool):
                                                val_list.append("1" if val else "0")
                                            else:
                                                s_val = str(val).replace("\\", "\\\\").replace("'", "''").replace("\0", "\\0").replace("\n", "\\n").replace("\r", "\\r")
                                                val_list.append(f"'{s_val}'")
                                        val_tuples.append("(" + ", ".join(val_list) + ")")

                                    tmp.write(f"INSERT INTO `{table}` ({col_names}) VALUES\n" + ",\n".join(val_tuples) + ";\n")

                                tmp.write(f"/*!40000 ALTER TABLE `{table}` ENABLE KEYS */;\n")
                                tmp.write("UNLOCK TABLES;\n\n")
                        except Exception as e:
                            tmp.write(f"-- Error dumping data for `{table}`: {e}\n\n")

                    tmp.write("/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;\n")
                    tmp.write("/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;\n")
                    tmp.write("/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;\n")
                    tmp.write("/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;\n")
                    tmp.write("/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;\n")
                    tmp.write("/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;\n")
                    tmp.write("/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;\n")
                    tmp.write("/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;\n")
                finally:
                    tmp.close()

                filename = f'{db_name}_backup_{timestamp}.sql'
                f = open(tmp_path, 'rb')
                response = FileResponse(
                    f,
                    content_type='application/octet-stream',
                    as_attachment=True,
                    filename=filename,
                )
                response['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0'
                response['Pragma'] = 'no-cache'
                response['Expires'] = '0'
                response._resource_closers.append(lambda: os.unlink(tmp_path))
                return response

            except Exception as e:
                return Response(
                    {'detail': f'Failed to generate SQL backup: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )


class DatabaseScheduleView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import DatabaseBackupSchedule
        schedule, _ = DatabaseBackupSchedule.objects.get_or_create(pk=1)
        return Response({
            'is_enabled': schedule.is_enabled,
            'frequency': schedule.frequency,
            'backup_time': schedule.backup_time,
            'export_format': schedule.export_format,
            'retention_days': schedule.retention_days,
            'backup_path': schedule.backup_path,
            'updated_at': schedule.updated_at.strftime('%Y-%m-%d %H:%M:%S') if schedule.updated_at else None,
        })

    def post(self, request):
        from .models import DatabaseBackupSchedule
        schedule, _ = DatabaseBackupSchedule.objects.get_or_create(pk=1)

        schedule.is_enabled = request.data.get('is_enabled', schedule.is_enabled)
        schedule.frequency = request.data.get('frequency', schedule.frequency)
        schedule.backup_time = request.data.get('backup_time', schedule.backup_time)
        schedule.export_format = request.data.get('export_format', schedule.export_format)
        schedule.retention_days = int(request.data.get('retention_days', schedule.retention_days))
        schedule.backup_path = request.data.get('backup_path', schedule.backup_path) or 'backups'
        schedule.save()

        return Response({
            'detail': 'Backup schedule configuration saved successfully!',
            'is_enabled': schedule.is_enabled,
            'frequency': schedule.frequency,
            'backup_time': schedule.backup_time,
            'export_format': schedule.export_format,
            'retention_days': schedule.retention_days,
            'backup_path': schedule.backup_path,
            'updated_at': schedule.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
        })



class ClearDataView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from django.core.management import call_command
        try:
            call_command('clear_transaction_data')
            return Response({'detail': 'All transaction data, ledgers, stock items, BOM, and orders cleared successfully!'})
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


