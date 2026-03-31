"""
Backup & Restore router — export/import all PostgreSQL tables as a zip of CSVs.

GET  /api/backup  — download a zip containing one CSV per table
POST /api/restore — upload a zip of CSVs to restore tables
"""
import csv
import io
import logging
import zipfile
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse

from ..db import get_pool

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

# Tables to include in backup (order matters for restore due to FK constraints)
BACKUP_TABLES = [
    "purchases",
    "cash_entries",
    "payments",
    "cheques",
]


async def _get_table_columns(conn, table: str) -> list[str]:
    """Return column names for a table."""
    rows = await conn.fetch(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema = 'public' AND table_name = $1 "
        "ORDER BY ordinal_position",
        table,
    )
    return [r["column_name"] for r in rows]


async def _get_text_columns(conn, table: str) -> list[str]:
    """Return column names that are text/varchar (NOT NULL safe for COPY)."""
    rows = await conn.fetch(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema = 'public' AND table_name = $1 "
        "AND data_type IN ('text', 'character varying') "
        "AND is_nullable = 'NO' "
        "ORDER BY ordinal_position",
        table,
    )
    return [r["column_name"] for r in rows]


async def _get_column_types(conn, table: str) -> dict[str, str]:
    """Return a map of column_name → data_type for a table."""
    rows = await conn.fetch(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_schema = 'public' AND table_name = $1",
        table,
    )
    return {r["column_name"]: r["data_type"] for r in rows}


def _cast_value(val: str, pg_type: str):
    """Cast a CSV string value to the appropriate Python type for asyncpg."""
    if pg_type in ("integer", "bigint", "smallint"):
        return int(val)
    if pg_type in ("numeric", "decimal", "money"):
        return Decimal(val)
    if pg_type in ("real", "double precision"):
        return float(val)
    if pg_type == "boolean":
        return val.lower() in ("true", "t", "1", "yes")
    if pg_type == "date":
        return date.fromisoformat(val)
    if pg_type in ("timestamp with time zone", "timestamp without time zone"):
        return datetime.fromisoformat(val)
    # text, varchar, etc. — pass as string
    return val


@router.get("/backup")
async def backup_database():
    """Export all tables as a zip of CSVs."""
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database unavailable")

    buf = io.BytesIO()

    async with pool.acquire() as conn:
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for table in BACKUP_TABLES:
                # Check if table exists
                exists = await conn.fetchval(
                    "SELECT EXISTS(SELECT 1 FROM information_schema.tables "
                    "WHERE table_schema = 'public' AND table_name = $1)",
                    table,
                )
                if not exists:
                    logger.info("Backup: skipping non-existent table %s", table)
                    continue

                columns = await _get_table_columns(conn, table)
                if not columns:
                    continue

                rows = await conn.fetch(f'SELECT * FROM "{table}"')  # noqa: S608

                csv_buf = io.StringIO()
                writer = csv.writer(csv_buf)
                writer.writerow(columns)
                for row in rows:
                    writer.writerow([row[c] for c in columns])

                zf.writestr(f"{table}.csv", csv_buf.getvalue())

            # Add metadata
            meta = (
                f"backup_time={datetime.now(timezone.utc).isoformat()}\n"
                f"tables={','.join(BACKUP_TABLES)}\n"
            )
            zf.writestr("_metadata.txt", meta)

    buf.seek(0)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"kapoortraders_backup_{timestamp}.zip"

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/restore")
async def restore_database(file: UploadFile = File(...)):
    """Restore tables from a backup zip of CSVs."""
    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="File must be a .zip archive")

    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database unavailable")

    content = await file.read()
    if len(content) > 100 * 1024 * 1024:  # 100 MB limit
        raise HTTPException(status_code=413, detail="File too large (max 100 MB)")

    try:
        zf = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid zip file")

    tables_restored: list[str] = []
    total_rows = 0

    async with pool.acquire() as conn:
        async with conn.transaction():
            for table in BACKUP_TABLES:
                csv_name = f"{table}.csv"
                if csv_name not in zf.namelist():
                    continue

                # Verify table exists before restoring
                exists = await conn.fetchval(
                    "SELECT EXISTS(SELECT 1 FROM information_schema.tables "
                    "WHERE table_schema = 'public' AND table_name = $1)",
                    table,
                )
                if not exists:
                    logger.warning("Restore: skipping non-existent table %s", table)
                    continue

                csv_data = zf.read(csv_name).decode("utf-8")
                reader = csv.reader(io.StringIO(csv_data))
                headers = next(reader, None)
                if not headers:
                    continue

                # Validate headers against actual table columns
                actual_columns = await _get_table_columns(conn, table)
                if not all(h in actual_columns for h in headers):
                    invalid = [h for h in headers if h not in actual_columns]
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid columns in {csv_name}: {invalid}",
                    )

                # Collect remaining rows
                rows_data = list(reader)
                if not rows_data:
                    tables_restored.append(table)
                    continue

                # Find NOT NULL text column indices — empty CSV fields must
                # stay as empty strings, not become NULL.
                not_null_text_cols = set(await _get_text_columns(conn, table))

                # Get column types for proper casting
                col_types = await _get_column_types(conn, table)

                # Clear existing data
                await conn.execute(f'DELETE FROM "{table}"')  # noqa: S608

                # Build parameterized INSERT with type casts
                cols_quoted = ", ".join(f'"{h}"' for h in headers)
                placeholders = ", ".join(f"${i+1}" for i in range(len(headers)))
                insert_sql = (
                    f'INSERT INTO "{table}" ({cols_quoted}) '  # noqa: S608
                    f"VALUES ({placeholders})"
                )

                for row in rows_data:
                    values = []
                    for i, val in enumerate(row):
                        col_name = headers[i]
                        pg_type = col_types.get(col_name, "text")

                        if val == "" and col_name not in not_null_text_cols:
                            values.append(None)  # NULL for nullable empty fields
                        elif val == "":
                            values.append("")  # empty string for NOT NULL text
                        else:
                            values.append(_cast_value(val, pg_type))
                    try:
                        await conn.execute(insert_sql, *values)
                    except Exception as exc:
                        logger.error(
                            "Restore: insert failed for %s: %s", table, exc
                        )
                        raise HTTPException(
                            status_code=400,
                            detail=f"Failed to restore {table}: {exc}",
                        )

                total_rows += len(rows_data)
                tables_restored.append(table)

    # Reset sequences for tables with serial/identity columns
    async with pool.acquire() as conn:
        for table in tables_restored:
            try:
                await conn.execute(
                    f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "  # noqa: S608
                    f"COALESCE((SELECT MAX(id) FROM \"{table}\"), 0) + 1, false)"
                )
            except Exception:
                pass  # Table may not have an 'id' serial column

    return {
        "status": "ok",
        "tables_restored": tables_restored,
        "total_rows": total_rows,
    }
