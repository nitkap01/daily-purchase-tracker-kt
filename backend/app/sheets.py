import logging
import os
from io import StringIO

import httpx
import pandas as pd

logger = logging.getLogger(__name__)

SHEET_ID = os.getenv("SHEET_ID", "13MNBbsDuDHkacK7mqqnPHCIYCSj7U-hBaLRjJYI6iEw")
CSV_URL = (
    f"https://docs.google.com/spreadsheets/d/{SHEET_ID}"
    "/export?format=csv&gid=0"
)


async def fetch_sheet_data() -> pd.DataFrame:
    """Fetch the public Google Sheet as CSV and return a cleaned DataFrame."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(CSV_URL, follow_redirects=True)
        response.raise_for_status()

    df = pd.read_csv(StringIO(response.text))

    # Normalize column names
    df.columns = [col.strip().lower() for col in df.columns]

    required = {"date", "item", "quantity", "price", "amount"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing columns in sheet: {missing}")

    # Parse dates — sheet may use DD/MM/YYYY
    df["date"] = pd.to_datetime(df["date"], dayfirst=True, errors="coerce")
    df = df.dropna(subset=["date"]).copy()
    df["date_str"] = df["date"].dt.strftime("%Y-%m-%d")

    # Coerce numerics
    for col in ("quantity", "price", "amount", "total"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    # Clean item text
    df["item"] = df["item"].astype(str).str.strip()
    df = df[df["item"].str.len() > 0].copy()

    logger.info("Fetched %d rows from Google Sheets (id=%s)", len(df), SHEET_ID)
    return df
