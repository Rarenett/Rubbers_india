"""
Generic CRUD service for Dynamic Database Designer.
Provides safe SELECT / INSERT / UPDATE / DELETE operations on any user-created table.
All table names are validated; all data values are inserted via parameterized queries.
"""
import logging
from django.db import connection
from .validators import validate_identifier, build_db_table_name
from .sql_service import get_physical_table_name

logger = logging.getLogger(__name__)


def _q(identifier: str) -> str:
    """Wrap a validated identifier in backticks."""
    return f"`{identifier}`"


def _validate_columns(columns: list) -> list:
    """Validate a list of column names and return them cleaned."""
    return [validate_identifier(c, 'column name') for c in columns]


# ---------------------------------------------------------------------------
# SELECT
# ---------------------------------------------------------------------------

def dynamic_select(
    table_name: str,
    filters: dict = None,
    ordering: str = None,
    limit: int = 100,
    offset: int = 0,
) -> list:
    """
    Execute a parameterized SELECT on a user table.

    filters  — dict of {column_name: value} for simple WHERE equality checks
    ordering — validated column name to ORDER BY (prefix with '-' for DESC)
    limit    — max rows (capped at 500)
    offset   — pagination offset
    Returns list of dicts (column→value).
    """
    db_table = get_physical_table_name(table_name)
    params   = []
    sql      = f"SELECT * FROM {_q(db_table)}"

    if filters:
        where_parts = []
        for col, val in filters.items():
            col_clean = validate_identifier(col, 'filter column')
            where_parts.append(f"{_q(col_clean)} = %s")
            params.append(val)
        sql += " WHERE " + " AND ".join(where_parts)

    if ordering:
        desc = ordering.startswith('-')
        order_col = validate_identifier(ordering.lstrip('-'), 'ordering column')
        sql += f" ORDER BY {_q(order_col)} {'DESC' if desc else 'ASC'}"

    limit = min(int(limit), 500)
    offset = max(int(offset), 0)
    sql += f" LIMIT %s OFFSET %s"
    params.extend([limit, offset])

    logger.debug("SELECT: %s | params: %s", sql, params)
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        if cursor.description is None:
            return []
        cols = [col[0] for col in cursor.description]
        return [dict(zip(cols, row)) for row in cursor.fetchall()]


def dynamic_count(table_name: str, filters: dict = None) -> int:
    """Return the total row count for pagination."""
    db_table = get_physical_table_name(table_name)
    params   = []
    sql      = f"SELECT COUNT(*) FROM {_q(db_table)}"

    if filters:
        where_parts = []
        for col, val in filters.items():
            col_clean = validate_identifier(col, 'filter column')
            where_parts.append(f"{_q(col_clean)} = %s")
            params.append(val)
        sql += " WHERE " + " AND ".join(where_parts)

    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        return cursor.fetchone()[0]



# ---------------------------------------------------------------------------
# INSERT
# ---------------------------------------------------------------------------

def dynamic_insert(table_name: str, data: dict) -> int:
    """
    Execute a parameterized INSERT and return the new row's id.
    data — dict of {column_name: value}
    """
    if not data:
        raise ValueError("No data provided for insert.")

    db_table = get_physical_table_name(table_name)
    cols     = _validate_columns(list(data.keys()))
    values   = list(data.values())

    col_sql  = ', '.join(_q(c) for c in cols)
    ph_sql   = ', '.join(['%s'] * len(cols))
    sql      = f"INSERT INTO {_q(db_table)} ({col_sql}) VALUES ({ph_sql});"

    logger.info("INSERT INTO %s | cols: %s", db_table, cols)
    with connection.cursor() as cursor:
        cursor.execute(sql, values)
        return cursor.lastrowid


# ---------------------------------------------------------------------------
# UPDATE
# ---------------------------------------------------------------------------

def dynamic_update(table_name: str, record_id: int, data: dict) -> int:
    """
    Execute a parameterized UPDATE by id.
    Returns the number of affected rows.
    """
    if not data:
        raise ValueError("No data provided for update.")

    db_table = get_physical_table_name(table_name)
    cols     = _validate_columns(list(data.keys()))
    values   = list(data.values())

    set_sql  = ', '.join(f"{_q(c)} = %s" for c in cols)
    sql      = f"UPDATE {_q(db_table)} SET {set_sql} WHERE `id` = %s;"
    values.append(int(record_id))

    logger.info("UPDATE %s id=%s | cols: %s", db_table, record_id, cols)
    with connection.cursor() as cursor:
        cursor.execute(sql, values)
        return cursor.rowcount


# ---------------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------------

def dynamic_delete(table_name: str, record_id: int) -> int:
    """
    Execute a parameterized DELETE by id.
    Returns the number of affected rows.
    """
    db_table = get_physical_table_name(table_name)
    sql      = f"DELETE FROM {_q(db_table)} WHERE `id` = %s;"

    logger.info("DELETE FROM %s id=%s", db_table, record_id)
    with connection.cursor() as cursor:
        cursor.execute(sql, [int(record_id)])
        return cursor.rowcount


# ---------------------------------------------------------------------------
# GET SINGLE RECORD
# ---------------------------------------------------------------------------

def dynamic_get(table_name: str, record_id: int) -> dict | None:
    """Fetch a single record by id. Returns dict or None."""
    db_table = get_physical_table_name(table_name)
    sql      = f"SELECT * FROM {_q(db_table)} WHERE `id` = %s LIMIT 1;"

    with connection.cursor() as cursor:
        cursor.execute(sql, [int(record_id)])
        if cursor.description is None:
            return None
        cols = [col[0] for col in cursor.description]
        row  = cursor.fetchone()
        return dict(zip(cols, row)) if row else None
