"""
Security validators for Dynamic Database Designer.
All user-supplied identifiers (table names, column names) and data-types
must pass through these checks before any SQL is executed.
"""
import re
import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Identifier regex: must start with a letter, 1-63 chars, letters/digits/underscore only.
# This prevents SQL injection through name fields.
# ---------------------------------------------------------------------------
IDENTIFIER_RE = re.compile(r'^[a-zA-Z][a-zA-Z0-9_]{0,62}$')

# Reserved MySQL keywords that must not be used as table/column names.
RESERVED_WORDS = {
    'select', 'insert', 'update', 'delete', 'drop', 'alter', 'create',
    'table', 'column', 'index', 'from', 'where', 'join', 'order', 'group',
    'having', 'limit', 'offset', 'union', 'set', 'values', 'into', 'null',
    'true', 'false', 'primary', 'key', 'foreign', 'references', 'unique',
    'not', 'and', 'or', 'in', 'is', 'like', 'between', 'exists', 'case',
    'when', 'then', 'else', 'end', 'as', 'on', 'by', 'asc', 'desc',
    'distinct', 'all', 'with', 'show', 'describe', 'explain', 'use',
    'database', 'schema', 'grant', 'revoke', 'truncate', 'replace',
    'procedure', 'function', 'trigger', 'view', 'event', 'commit',
    'rollback', 'transaction', 'start', 'begin', 'savepoint', 'lock',
    'unlock', 'call', 'exec', 'execute',
}

# Table name prefix used for all user-created tables.
TABLE_PREFIX = 'dyn_'

# ---------------------------------------------------------------------------
# Allowed data types and their parameter requirements
# ---------------------------------------------------------------------------
ALLOWED_TYPES = {
    'VARCHAR':  {'needs_length': True,  'needs_precision': False, 'integer_only': False},
    'INT':      {'needs_length': False, 'needs_precision': False, 'integer_only': True},
    'BIGINT':   {'needs_length': False, 'needs_precision': False, 'integer_only': True},
    'DECIMAL':  {'needs_length': False, 'needs_precision': True,  'integer_only': False},
    'FLOAT':    {'needs_length': False, 'needs_precision': False, 'integer_only': False},
    'DATE':     {'needs_length': False, 'needs_precision': False, 'integer_only': False},
    'DATETIME': {'needs_length': False, 'needs_precision': False, 'integer_only': False},
    'TIME':     {'needs_length': False, 'needs_precision': False, 'integer_only': False},
    'BOOLEAN':  {'needs_length': False, 'needs_precision': False, 'integer_only': False},
    'TEXT':     {'needs_length': False, 'needs_precision': False, 'integer_only': False},
    'LONGTEXT': {'needs_length': False, 'needs_precision': False, 'integer_only': False},
}


def validate_identifier(name: str, label: str = 'name') -> str:
    """
    Validate a table or column name.
    Returns the cleaned name on success, raises ValueError on failure.
    """
    if not name:
        raise ValueError(f"The {label} cannot be empty.")

    name = name.strip()

    if not IDENTIFIER_RE.match(name):
        raise ValueError(
            f"Invalid {label} '{name}'. "
            "Must start with a letter and contain only letters, digits, and underscores (max 63 chars)."
        )

    if name.lower() in RESERVED_WORDS:
        raise ValueError(
            f"'{name}' is a reserved SQL keyword and cannot be used as a {label}."
        )

    return name


def validate_table_name(name: str) -> str:
    """Validate a logical table name (without prefix)."""
    name = validate_identifier(name, label='table name')
    # Full db name including prefix must also fit MySQL's 64-char limit
    db_name = TABLE_PREFIX + name
    if len(db_name) > 64:
        raise ValueError(f"Table name too long (max {64 - len(TABLE_PREFIX)} characters).")
    return name


def validate_data_type(data_type: str, length=None, precision=None, scale=None) -> dict:
    """
    Validate a data type string and its parameters.
    Returns a dict with validated parameters.
    """
    dt = data_type.upper().strip()
    if dt not in ALLOWED_TYPES:
        raise ValueError(
            f"Unsupported data type '{data_type}'. "
            f"Allowed types: {', '.join(ALLOWED_TYPES.keys())}"
        )

    info = ALLOWED_TYPES[dt]
    result = {'data_type': dt}

    if info['needs_length']:
        if length is None:
            raise ValueError(f"{dt} requires a length parameter.")
        try:
            length = int(length)
        except (TypeError, ValueError):
            raise ValueError(f"Length must be an integer, got '{length}'.")
        if not (1 <= length <= 65535):
            raise ValueError(f"VARCHAR length must be between 1 and 65535, got {length}.")
        result['length'] = length
    else:
        result['length'] = None

    if info['needs_precision']:
        if precision is None or scale is None:
            raise ValueError(f"{dt} requires both precision and scale parameters.")
        try:
            precision = int(precision)
            scale = int(scale)
        except (TypeError, ValueError):
            raise ValueError("Precision and scale must be integers.")
        if not (1 <= precision <= 65):
            raise ValueError(f"DECIMAL precision must be between 1 and 65, got {precision}.")
        if not (0 <= scale <= precision):
            raise ValueError(f"DECIMAL scale must be between 0 and precision ({precision}), got {scale}.")
        result['precision'] = precision
        result['scale'] = scale
    else:
        result['precision'] = None
        result['scale'] = None

    return result


def sanitize_default(value, data_type: str):
    """
    Strip SQL injection attempts from default values.
    Only allows safe characters for each data type.
    Returns the sanitized string or None.
    """
    if value is None or value == '':
        return None

    value = str(value).strip()

    # Support foreign key relations configured in default_value as 'fk:target_table:display_column'
    if value.startswith('fk:'):
        parts = value.split(':')
        if len(parts) >= 3:
            # Secure validation to ensure referenced names are valid database identifiers
            validate_identifier(parts[1], 'foreign key table')
            validate_identifier(parts[2], 'foreign key column')
            return value
        else:
            raise ValueError("Foreign key default must be in format 'fk:table_name:column_name'")

    dt = data_type.upper()

    # Numeric defaults: only digits, sign, and decimal point
    if dt in ('INT', 'BIGINT', 'FLOAT', 'DECIMAL'):
        if not re.match(r'^-?\d+(\.\d+)?$', value):
            raise ValueError(f"Invalid numeric default value: '{value}'")

    # Boolean defaults
    elif dt == 'BOOLEAN':
        if value.lower() not in ('0', '1', 'true', 'false'):
            raise ValueError(f"Boolean default must be 0, 1, true, or false. Got '{value}'")
        value = '1' if value.lower() in ('true', '1') else '0'

    # Date/Time defaults
    elif dt in ('DATE', 'DATETIME', 'TIME'):
        # Allow CURRENT_TIMESTAMP or date-like strings
        if value.upper() == 'CURRENT_TIMESTAMP':
            return 'CURRENT_TIMESTAMP'
        if not re.match(r'^[\d\s:\-\.]+$', value):
            raise ValueError(f"Invalid date/time default value: '{value}'")

    # String defaults: disallow quotes and semicolons
    elif dt in ('VARCHAR', 'TEXT', 'LONGTEXT'):
        forbidden = ["'", '"', ';', '--', '/*', '*/']
        for char in forbidden:
            if char in value:
                raise ValueError(
                    f"Default value contains forbidden character '{char}'."
                )
        # Truncate very long defaults
        value = value[:255]

    return value


def build_db_table_name(logical_name: str) -> str:
    """Return the actual MySQL table name from a logical name."""
    return TABLE_PREFIX + logical_name
