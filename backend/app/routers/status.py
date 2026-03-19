"""
Status router — health checks for all external dependencies.

GET /api/status   — check Google Sheet + PostgreSQL connectivity
"""
import logging
import os

import httpx
from fastapi import APIRouter

from ..db import check_connection

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

SHEET_ID = os.getenv("SHEET_ID", "")


@router.get("/status")
async def get_status():
    """Check availability of Google Sheet and PostgreSQL."""
    results: dict = {}

    # ── Google Sheet check ───────────────────────────────────────────────
    sheet_url = (
        f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid=0"
        if SHEET_ID
        else None
    )
    if sheet_url:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.head(sheet_url, follow_redirects=True)
            results["google_sheet"] = {
                "ok": resp.status_code < 400,
                "status_code": resp.status_code,
                "message": "Reachable" if resp.status_code < 400 else f"HTTP {resp.status_code}",
                "sheet_id": SHEET_ID,
            }
        except Exception as exc:
            results["google_sheet"] = {
                "ok": False,
                "status_code": None,
                "message": str(exc),
                "sheet_id": SHEET_ID,
            }
    else:
        results["google_sheet"] = {
            "ok": False,
            "status_code": None,
            "message": "SHEET_ID not configured",
            "sheet_id": None,
        }

    # ── PostgreSQL check ─────────────────────────────────────────────────
    pg_ok = await check_connection()
    results["postgres"] = {
        "ok": pg_ok,
        "host": os.getenv("POSTGRES_HOST", "localhost"),
        "port": os.getenv("POSTGRES_PORT", "5432"),
        "database": os.getenv("POSTGRES_DB", "kapoortraders"),
        "message": "Connected" if pg_ok else "Unreachable",
    }

    # ── Google Credentials (for DB→Sheet) ────────────────────────────────
    has_creds = bool(os.getenv("GOOGLE_CREDENTIALS_JSON"))
    results["google_credentials"] = {
        "ok": has_creds,
        "message": "Configured" if has_creds else "Not configured (DB→Sheet sync unavailable)",
    }

    overall = all(v["ok"] for k, v in results.items() if k != "google_credentials")
    return {"ok": overall, "checks": results}
