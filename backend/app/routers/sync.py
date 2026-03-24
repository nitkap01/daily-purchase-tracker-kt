"""
Sync router — one-way sync from Google Sheet to PostgreSQL.
Sheet is the source of truth.

POST /api/sync/sheet-to-db      — copy in-memory cache (from sheet) → postgres
POST /api/credentials/upload    — upload service-account JSON (for sheet rename)
GET  /api/sync/log              — last 20 sync events
"""
import json
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, UploadFile, File

from ..cache import get_cache
from ..credentials import has_credentials, set_credentials
from ..db import get_pool
from ..sheets import fetch_sheet_data

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/sync")


async def _log_sync(direction: str, rows: int, status: str, message: str = "") -> None:
    pool = await get_pool()
    if not pool:
        return
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO sync_log (direction, rows_synced, status, message)
                   VALUES ($1, $2, $3, $4)""",
                direction, rows, status, message,
            )
    except Exception as exc:
        logger.warning("Could not write sync_log: %s", exc)


# ── Sheet → DB ──────────────────────────────────────────────────────────────

@router.post("/sheet-to-db")
async def sync_sheet_to_db():
    """
    1. Re-fetch Google Sheet data (refresh in-memory cache too).
    2. Truncate purchases table and re-insert all rows.
    """
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="PostgreSQL is not available.")

    try:
        df = await fetch_sheet_data()
        get_cache().update(df)
    except Exception as exc:
        await _log_sync("sheet_to_db", 0, "failed", str(exc))
        raise HTTPException(status_code=502, detail=f"Could not fetch sheet: {exc}")

    rows = 0
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute("TRUNCATE TABLE purchases RESTART IDENTITY")
                records = [
                    (
                        row["date"].date(),  # datetime.date — required by asyncpg executemany
                        row["item"],
                        float(row["quantity"]),
                        float(row["price"]),
                        float(row["amount"]),
                    )
                    for _, row in df.iterrows()
                ]
                await conn.executemany(
                    """INSERT INTO purchases (date, item, quantity, price, amount)
                       VALUES ($1, $2, $3, $4, $5)""",
                    records,
                )
                rows = len(records)
    except Exception as exc:
        await _log_sync("sheet_to_db", 0, "failed", str(exc))
        raise HTTPException(status_code=500, detail=f"Database write failed: {exc}")

    await _log_sync("sheet_to_db", rows, "success")
    logger.info("Synced %d rows from sheet to DB", rows)
    return {"status": "success", "rows_synced": rows, "direction": "sheet_to_db"}


# ── Credentials upload ──────────────────────────────────────────────────────

creds_router = APIRouter(prefix="/api")


@creds_router.post("/credentials/upload")
async def upload_credentials(file: UploadFile = File(...)):
    """
    Upload a Google service-account JSON file.
    The credentials are stored in memory for the lifetime of the process.
    """
    if not file.filename or not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="File must be a .json file.")

    raw = await file.read()
    try:
        data = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON file.")

    required_keys = {"type", "project_id", "private_key", "client_email"}
    missing = required_keys - set(data.keys())
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Not a valid service-account JSON. Missing keys: {missing}",
        )
    if data.get("type") != "service_account":
        raise HTTPException(status_code=422, detail='JSON "type" must be "service_account".')

    set_credentials(raw.decode())
    return {
        "status": "ok",
        "project_id": data["project_id"],
        "client_email": data["client_email"],
    }



# ── Sync Log ────────────────────────────────────────────────────────────────

@router.get("/log")
async def get_sync_log():
    """Return the last 20 sync events."""
    pool = await get_pool()
    if not pool:
        return {"log": []}
    try:
        async with pool.acquire() as conn:
            records = await conn.fetch(
                """SELECT direction, rows_synced, status, message, synced_at
                   FROM sync_log ORDER BY synced_at DESC LIMIT 20"""
            )
        return {
            "log": [
                {
                    "direction": r["direction"],
                    "rows_synced": r["rows_synced"],
                    "status": r["status"],
                    "message": r["message"] or "",
                    "synced_at": r["synced_at"].isoformat(),
                }
                for r in records
            ]
        }
    except Exception as exc:
        return {"log": [], "error": str(exc)}
