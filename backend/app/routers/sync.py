"""
Sync router — bidirectional sync between Google Sheet and PostgreSQL.

POST /api/sync/sheet-to-db   — copy in-memory cache (from sheet) → postgres
POST /api/sync/db-to-sheet   — copy postgres purchases → google sheet
                               (requires GOOGLE_CREDENTIALS_JSON env var)
GET  /api/sync/log           — last 20 sync events
"""
import json
import logging
import os
from datetime import datetime

from fastapi import APIRouter, HTTPException

from ..cache import get_cache
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
                        row["date_str"],
                        row["item"],
                        float(row["quantity"]),
                        float(row["price"]),
                        float(row["amount"]),
                    )
                    for _, row in df.iterrows()
                ]
                await conn.executemany(
                    """INSERT INTO purchases (date, item, quantity, price, amount)
                       VALUES ($1::date, $2, $3, $4, $5)""",
                    records,
                )
                rows = len(records)
    except Exception as exc:
        await _log_sync("sheet_to_db", 0, "failed", str(exc))
        raise HTTPException(status_code=500, detail=f"Database write failed: {exc}")

    await _log_sync("sheet_to_db", rows, "success")
    logger.info("Synced %d rows from sheet to DB", rows)
    return {"status": "success", "rows_synced": rows, "direction": "sheet_to_db"}


# ── DB → Sheet ──────────────────────────────────────────────────────────────

@router.post("/db-to-sheet")
async def sync_db_to_sheet():
    """
    Read purchases from PostgreSQL and overwrite the Google Sheet.
    Requires GOOGLE_CREDENTIALS_JSON env var (service account JSON string).
    """
    creds_json = os.getenv("GOOGLE_CREDENTIALS_JSON")
    sheet_id = os.getenv("SHEET_ID")

    if not creds_json:
        raise HTTPException(
            status_code=503,
            detail=(
                "GOOGLE_CREDENTIALS_JSON is not configured. "
                "Set it to the service account JSON string to enable writing back to Google Sheets."
            ),
        )
    if not sheet_id:
        raise HTTPException(status_code=503, detail="SHEET_ID is not configured.")

    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="PostgreSQL is not available.")

    try:
        import gspread
        from google.oauth2.service_account import Credentials

        scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive",
        ]
        creds_dict = json.loads(creds_json)
        creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)
        gc = gspread.authorize(creds)
        sh = gc.open_by_key(sheet_id)
        ws = sh.get_worksheet(0)
    except Exception as exc:
        await _log_sync("db_to_sheet", 0, "failed", str(exc))
        raise HTTPException(status_code=502, detail=f"Google Sheets auth failed: {exc}")

    try:
        async with pool.acquire() as conn:
            rows_db = await conn.fetch(
                "SELECT date, item, quantity, price, amount FROM purchases ORDER BY date, id"
            )
    except Exception as exc:
        await _log_sync("db_to_sheet", 0, "failed", str(exc))
        raise HTTPException(status_code=500, detail=f"Database read failed: {exc}")

    try:
        header = ["Date", "Item", "Quantity", "Price", "Amount"]
        data = [header] + [
            [
                str(r["date"]),
                r["item"],
                float(r["quantity"]),
                float(r["price"]),
                float(r["amount"]),
            ]
            for r in rows_db
        ]
        ws.clear()
        ws.update(data, "A1")
    except Exception as exc:
        await _log_sync("db_to_sheet", 0, "failed", str(exc))
        raise HTTPException(status_code=502, detail=f"Google Sheets write failed: {exc}")

    rows = len(rows_db)
    await _log_sync("db_to_sheet", rows, "success")
    logger.info("Synced %d rows from DB to sheet", rows)
    return {"status": "success", "rows_synced": rows, "direction": "db_to_sheet"}


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
