"""
SQL Service layer for Dynamic Database Designer.
Generates and executes all DDL (schema-level) SQL statements.
Uses Django's database connection directly — NO Django migrations, NO ORM for user tables.

All identifiers are wrapped in backticks after being validated.
"""
import logging
from django.db import connection, transaction
from .validators import validate_identifier, validate_data_type, sanitize_default, build_db_table_name

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _q(identifier: str) -> str:
    """Wrap a validated identifier in backticks for safe MySQL quoting."""
    return f"`{identifier}`"


def get_physical_table_name(table_name: str) -> str:
    """
    If table_name exists exactly as-is physically in the DB (like developer/system tables),
    returns it. Otherwise, defaults to build_db_table_name(table_name) (with dyn_ prefix).
    """
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT COUNT(*) FROM information_schema.tables "
            "WHERE table_schema = DATABASE() AND table_name = %s;",
            [table_name]
        )
        exists_as_is = cursor.fetchone()[0] > 0
        if exists_as_is:
            return table_name
    return build_db_table_name(table_name)


def get_column_type(table_name: str, column_name: str) -> str:
    """
    Query the exact data type of a column from information_schema.
    Returns e.g. 'BIGINT(20)', 'BIGINT(20) UNSIGNED', 'INT(11) UNSIGNED'.
    Defaults to 'BIGINT UNSIGNED' if not found.
    """
    try:
        db_table = get_physical_table_name(table_name)
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT COLUMN_TYPE FROM information_schema.columns "
                "WHERE table_schema = DATABASE() AND table_name = %s AND column_name = %s;",
                [db_table, column_name]
            )
            row = cursor.fetchone()
            if row:
                return row[0].upper()
    except Exception:
        pass
    return "BIGINT UNSIGNED"


def build_column_definition(field: dict, is_alter: bool = False) -> str:
    """
    Build a SQL column definition fragment from a field dict.

    field keys:
        field_name, data_type, length, precision, scale,
        is_nullable, is_unique, is_primary, auto_increment, default_value

    Returns e.g.: `email` VARCHAR(255) NOT NULL UNIQUE DEFAULT 'none'
    """
    name       = validate_identifier(field['field_name'], 'column name')
    type_info  = validate_data_type(
        field['data_type'],
        length    = field.get('length'),
        precision = field.get('precision'),
        scale     = field.get('scale'),
    )
    dt = type_info['data_type']

    # Build the type string
    default_raw = sanitize_default(field.get('default_value'), field.get('data_type'))
    is_fk = default_raw and str(default_raw).startswith('fk:')

    if is_fk:
        parts_fk = str(default_raw).split(':')
        target_tbl = parts_fk[1]
        type_sql = get_column_type(target_tbl, 'id')
    elif dt == 'VARCHAR':
        type_sql = f"VARCHAR({type_info['length']})"
    elif dt == 'DECIMAL':
        type_sql = f"DECIMAL({type_info['precision']},{type_info['scale']})"
    else:
        type_sql = dt

    parts = [_q(name), type_sql]

    # NULL / NOT NULL
    # Primary Key columns MUST be NOT NULL in MySQL — enforce this regardless of user setting.
    if field.get('is_primary'):
        parts.append('NOT NULL')
    elif field.get('is_nullable', True):
        parts.append('NULL')
    else:
        parts.append('NOT NULL')

    # AUTO_INCREMENT (only for INT/BIGINT)
    if field.get('auto_increment') and field.get('data_type') in ('INT', 'BIGINT') and not is_fk:
        parts.append('AUTO_INCREMENT')

    # DEFAULT value (skip if it's a foreign key configuration string)
    if default_raw is not None and not is_fk:
        if field.get('data_type') in ('INT', 'BIGINT', 'FLOAT', 'DECIMAL', 'BOOLEAN'):
            parts.append(f"DEFAULT {default_raw}")
        elif default_raw == 'CURRENT_TIMESTAMP':
            parts.append(f"DEFAULT {default_raw}")
        else:
            parts.append(f"DEFAULT '{default_raw}'")

    # UNIQUE (handled at column level; for single-column unique)
    if field.get('is_unique') and not field.get('is_primary'):
        parts.append('UNIQUE')

    return ' '.join(parts)


# ---------------------------------------------------------------------------
# DDL — CREATE TABLE
# ---------------------------------------------------------------------------

def create_table(table_name: str, fields: list) -> None:
    """
    Execute CREATE TABLE for a user-defined table.
    Always injects a `id` BIGINT AUTO_INCREMENT PRIMARY KEY first.
    Filters out any user columns named 'id' to prevent conflicts.
    """
    db_table = build_db_table_name(table_name)
    column_defs = ['`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY']
    fk_constraints = []

    for f in fields:
        if f['field_name'].lower() == 'id':
            continue
        col_sql = build_column_definition(f)
        column_defs.append(col_sql)

        # Detect ForeignKey link
        default_val = f.get('default_value')
        if default_val and str(default_val).startswith('fk:'):
            parts = str(default_val).split(':')
            if len(parts) >= 2:
                target_table = parts[1]
                target_db_table = get_physical_table_name(target_table)
                col_name = validate_identifier(f['field_name'], 'foreign key column')
                fk_name = f"fk_{db_table}_{col_name}"
                fk_constraints.append(
                    f"CONSTRAINT `{fk_name}` FOREIGN KEY (`{col_name}`) REFERENCES `{target_db_table}`(`id`) ON DELETE SET NULL"
                )

    column_defs.extend(fk_constraints)
    columns_sql = ',\n    '.join(column_defs)
    sql = (
        f"CREATE TABLE {_q(db_table)} (\n"
        f"    {columns_sql}\n"
        f") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"
    )

    logger.info("CREATE TABLE: %s", sql)
    with connection.cursor() as cursor:
        cursor.execute(sql)


# ---------------------------------------------------------------------------
# DDL — ALTER TABLE: ADD COLUMN
# ---------------------------------------------------------------------------

def add_column(table_name: str, field: dict) -> None:
    """Execute ALTER TABLE ... ADD COLUMN."""
    db_table = get_physical_table_name(table_name)
    col_def  = build_column_definition(field)
    sql = f"ALTER TABLE {_q(db_table)} ADD COLUMN {col_def};"
    logger.info("ADD COLUMN: %s", sql)
    
    with connection.cursor() as cursor:
        cursor.execute(sql)
        
        # If it is a foreign key, also add the constraint!
        default_val = field.get('default_value')
        if default_val and str(default_val).startswith('fk:'):
            parts = str(default_val).split(':')
            if len(parts) >= 2:
                target_table = parts[1]
                target_db_table = get_physical_table_name(target_table)
                col_name = validate_identifier(field['field_name'], 'foreign key column')
                fk_name = f"fk_{db_table}_{col_name}"
                fk_sql = (
                    f"ALTER TABLE {_q(db_table)} "
                    f"ADD CONSTRAINT `{fk_name}` "
                    f"FOREIGN KEY (`{col_name}`) REFERENCES `{target_db_table}`(`id`) ON DELETE SET NULL;"
                )
                logger.info("ADD FOREIGN KEY CONSTRAINT: %s", fk_sql)
                cursor.execute(fk_sql)


# ---------------------------------------------------------------------------
# DDL — ALTER TABLE: MODIFY COLUMN (change type / nullable / default)
# ---------------------------------------------------------------------------

def modify_column(table_name: str, field: dict) -> None:
    """Execute ALTER TABLE ... MODIFY COLUMN."""
    db_table = get_physical_table_name(table_name)
    col_def  = build_column_definition(field)
    sql = f"ALTER TABLE {_q(db_table)} MODIFY COLUMN {col_def};"
    logger.info("MODIFY COLUMN: %s", sql)
    with connection.cursor() as cursor:
        cursor.execute(sql)


# ---------------------------------------------------------------------------
# DDL — ALTER TABLE: CHANGE COLUMN (rename + optionally retype)
# ---------------------------------------------------------------------------

def rename_column(table_name: str, old_name: str, field: dict) -> None:
    """
    Execute ALTER TABLE ... CHANGE COLUMN.
    field must contain the NEW field_name and full definition.
    """
    db_table  = get_physical_table_name(table_name)
    old_clean = validate_identifier(old_name, 'old column name')
    col_def   = build_column_definition(field)
    sql = f"ALTER TABLE {_q(db_table)} CHANGE COLUMN {_q(old_clean)} {col_def};"
    logger.info("RENAME COLUMN: %s", sql)
    with connection.cursor() as cursor:
        cursor.execute(sql)


# ---------------------------------------------------------------------------
# DDL — ALTER TABLE: DROP COLUMN
# ---------------------------------------------------------------------------

def drop_column(table_name: str, column_name: str) -> None:
    """Execute ALTER TABLE ... DROP COLUMN."""
    db_table  = get_physical_table_name(table_name)
    col_clean = validate_identifier(column_name, 'column name')
    
    with connection.cursor() as cursor:
        # Try to drop foreign key constraint first
        fk_name = f"fk_{db_table}_{col_clean}"
        try:
            fk_sql = f"ALTER TABLE {_q(db_table)} DROP FOREIGN KEY `{fk_name}`;"
            cursor.execute(fk_sql)
        except Exception:
            pass
            
        sql = f"ALTER TABLE {_q(db_table)} DROP COLUMN {_q(col_clean)};"
        logger.info("DROP COLUMN: %s", sql)
        cursor.execute(sql)


# ---------------------------------------------------------------------------
# DDL — DROP TABLE
# ---------------------------------------------------------------------------

def drop_table(table_name: str) -> None:
    """Execute DROP TABLE IF EXISTS."""
    db_table = get_physical_table_name(table_name)
    sql = f"DROP TABLE IF EXISTS {_q(db_table)};"
    logger.info("DROP TABLE: %s", sql)
    with connection.cursor() as cursor:
        cursor.execute(sql)


# ---------------------------------------------------------------------------
# Introspection helpers
# ---------------------------------------------------------------------------

def show_tables() -> list:
    """Return a list of all MySQL table names in the current database."""
    with connection.cursor() as cursor:
        cursor.execute("SHOW TABLES;")
        return [row[0] for row in cursor.fetchall()]


def describe_table(table_name: str) -> list:
    """
    Return the raw DESCRIBE output for a table.
    Returns list of dicts with keys: Field, Type, Null, Key, Default, Extra
    """
    db_table = get_physical_table_name(table_name)
    sql = f"DESCRIBE {_q(db_table)};"
    with connection.cursor() as cursor:
        cursor.execute(sql)
        columns = [col[0] for col in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]


def table_exists(table_name: str) -> bool:
    """Check if the physical table exists in MySQL."""
    db_table = get_physical_table_name(table_name)
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT COUNT(*) FROM information_schema.tables "
            "WHERE table_schema = DATABASE() AND table_name = %s;",
            [db_table]
        )
        return cursor.fetchone()[0] > 0
