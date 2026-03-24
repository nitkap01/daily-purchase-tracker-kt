import io
import json
import logging
import os
from datetime import datetime

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..cache import get_cache
from ..credentials import get_credentials
from ..db import get_pool
from ..sheets import fetch_sheet_data

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


def _require_data():
    df = get_cache().get_df()
    if df is None:
        raise HTTPException(
            status_code=503,
            detail="Data not yet loaded. Please wait or click Refresh.",
        )
    return df


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@router.get("/health")
async def health():
    cache = get_cache()
    return {
        "status": "ok",
        "data_loaded": cache.is_loaded(),
        "last_refreshed": (
            cache.last_refreshed.isoformat() if cache.last_refreshed else None
        ),
    }


# ---------------------------------------------------------------------------
# Manual refresh
# ---------------------------------------------------------------------------

@router.post("/refresh")
async def refresh():
    """Re-fetch the Google Sheet and update the in-memory cache."""
    try:
        df = await fetch_sheet_data()
        get_cache().update(df)
        cache = get_cache()
        return {
            "status": "refreshed",
            "rows": len(df),
            "refreshed_at": cache.last_refreshed.isoformat(),  # type: ignore[union-attr]
        }
    except Exception as exc:
        logger.error("Manual refresh failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Refresh failed: {exc}")


# ---------------------------------------------------------------------------
# Dates
# ---------------------------------------------------------------------------

@router.get("/dates")
async def get_dates():
    """Return all unique purchase dates, sorted descending."""
    df = _require_data()
    dates = sorted(df["date_str"].unique().tolist(), reverse=True)
    return {"dates": dates}


# ---------------------------------------------------------------------------
# Items by date
# ---------------------------------------------------------------------------

@router.get("/date/{date}")
async def get_items_by_date(date: str):
    """Return all items purchased on the given date (YYYY-MM-DD)."""
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date. Use YYYY-MM-DD.")

    df = _require_data()
    day_df = df[df["date_str"] == date]

    if day_df.empty:
        return {"date": date, "items": [], "total": 0.0}

    # Build item list, including optional columns
    optional_cols = ["bill_type", "seller", "selling_price", "unit"]
    base_cols = ["item", "quantity", "price", "amount"]
    cols = base_cols + [c for c in optional_cols if c in day_df.columns]
    items = day_df[cols].to_dict(orient="records")

    # Use sheet's Total column if present and non-zero, else sum amounts
    if "total" in day_df.columns and float(day_df["total"].iloc[0]) > 0:
        total = float(day_df["total"].iloc[0])
    else:
        total = float(day_df["amount"].sum())

    return {"date": date, "items": items, "total": total}


# ---------------------------------------------------------------------------
# Search — autocomplete suggestions
# ---------------------------------------------------------------------------

@router.get("/search/suggestions")
async def search_suggestions(
    q: str = Query(..., min_length=1, max_length=100),
):
    """Return up to 10 item names that contain the query string."""
    df = _require_data()
    q_lower = q.strip().lower()
    all_items: list[str] = df["item"].unique().tolist()
    matches = [item for item in all_items if q_lower in item.lower()]
    # Prioritise names that START with the query
    matches.sort(key=lambda x: (not x.lower().startswith(q_lower), x.lower()))
    return {"suggestions": matches[:10]}


# ---------------------------------------------------------------------------
# Search — item purchase history
# ---------------------------------------------------------------------------

@router.get("/search/history")
async def get_item_history(
    item: str = Query(..., min_length=1, max_length=200),
):
    """Return full purchase history for the given item name."""
    df = _require_data()
    item_df = df[df["item"].str.lower() == item.strip().lower()]

    if item_df.empty:
        raise HTTPException(status_code=404, detail=f"Item '{item}' not found.")

    optional_cols = ["bill_type", "seller", "selling_price", "unit"]
    base_cols = ["date_str", "quantity", "price", "amount"]
    hist_cols = base_cols + [c for c in optional_cols if c in item_df.columns]

    history = (
        item_df[hist_cols]
        .rename(columns={"date_str": "date"})
        .sort_values("date", ascending=False)
        .to_dict(orient="records")
    )

    return {
        "item": item,
        "total_purchases": len(history),
        "total_spent": float(item_df["amount"].sum()),
        "avg_price": float(item_df["price"].mean()),
        "history": history,
    }


# ---------------------------------------------------------------------------
# Inventory rename
# ---------------------------------------------------------------------------

class RenameItemRequest(BaseModel):
    old_name: str = Field(..., min_length=1, max_length=200)
    new_name: str = Field(..., min_length=1, max_length=200)


@router.patch("/inventory/rename")
async def rename_item(payload: RenameItemRequest):
    """Rename all occurrences of an item in the cache, DB, and optionally the Sheet."""
    old = payload.old_name.strip()
    new = payload.new_name.strip()

    if old == new:
        raise HTTPException(status_code=400, detail="Old and new names are the same.")

    cache = get_cache()
    df = cache.get_df()
    if df is None:
        raise HTTPException(status_code=503, detail="Data not loaded.")

    mask = df["item"] == old
    if not mask.any():
        raise HTTPException(status_code=404, detail=f"Item '{old}' not found.")

    rows_in_cache = int(mask.sum())
    df.loc[mask, "item"] = new
    cache.update(df)

    # Update DB
    db_rows = 0
    pool = await get_pool()
    if pool:
        try:
            async with pool.acquire() as conn:
                result = await conn.execute(
                    "UPDATE purchases SET item = $1 WHERE item = $2", new, old
                )
                db_rows = int(result.split()[-1])
        except Exception as exc:
            logger.warning("DB rename failed: %s", exc)

    # Update Sheet if credentials available
    sheet_updated = False
    creds_json = get_credentials()
    sheet_id = os.getenv("SHEET_ID")
    if creds_json and sheet_id:
        try:
            import gspread
            from google.oauth2.service_account import Credentials

            scopes = [
                "https://www.googleapis.com/auth/spreadsheets",
                "https://www.googleapis.com/auth/drive",
            ]
            creds = Credentials.from_service_account_info(
                json.loads(creds_json), scopes=scopes
            )
            gc = gspread.authorize(creds)
            ws = gc.open_by_key(sheet_id).get_worksheet(0)
            cells = ws.findall(old)
            if cells:
                for cell in cells:
                    cell.value = new
                ws.update_cells(cells)
                sheet_updated = True
        except Exception as exc:
            logger.warning("Sheet rename failed: %s", exc)

    logger.info("Renamed '%s' -> '%s' (%d rows in cache, %d in DB)", old, new, rows_in_cache, db_rows)
    return {
        "status": "ok",
        "old_name": old,
        "new_name": new,
        "rows_renamed": rows_in_cache,
        "db_rows": db_rows,
        "sheet_updated": sheet_updated,
    }


# ---------------------------------------------------------------------------
# Inventory — bubble chart data
# ---------------------------------------------------------------------------

@router.get("/inventory")
async def get_inventory():
    """Return per-item aggregates for the bubble / inventory view."""
    df = _require_data()
    grp = (
        df.groupby("item")
        .agg(
            purchase_count=("item", "count"),
            total_quantity=("quantity", "sum"),
            total_spent=("amount", "sum"),
            avg_price=("price", "mean"),
        )
        .reset_index()
    )
    grp = grp.sort_values("purchase_count", ascending=False)

    # Latest purchase price per item (most recent row by date)
    if "date" in df.columns:
        latest = (
            df.sort_values("date")
            .groupby("item", as_index=False)
            .last()[["item", "price"]]
            .rename(columns={"price": "latest_price"})
        )
        grp = grp.merge(latest, on="item", how="left")
    else:
        grp["latest_price"] = grp["avg_price"]

    # Latest known selling price per item (most recent non-zero value)
    if "selling_price" in df.columns:
        sp_df = df[df["selling_price"].fillna(0) > 0]
        if len(sp_df) > 0:
            sort_col = "date" if "date" in sp_df.columns else None
            if sort_col:
                sp_df = sp_df.sort_values(sort_col)
            sp = sp_df.groupby("item", as_index=False).last()[["item", "selling_price"]]
            grp = grp.merge(sp, on="item", how="left")
        grp["selling_price"] = grp["selling_price"].fillna(0.0)
    else:
        grp["selling_price"] = 0.0

    return {"items": grp.to_dict(orient="records")}


# ---------------------------------------------------------------------------
# Add item — append a row to the in-memory cache
# ---------------------------------------------------------------------------

class AddItemRequest(BaseModel):
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    item: str = Field(..., min_length=1, max_length=200)
    quantity: float = Field(..., gt=0)
    price: float = Field(..., gt=0)


@router.post("/add")
async def add_item(payload: AddItemRequest):
    """Append a new purchase row to the in-memory cache."""
    try:
        parsed_date = datetime.strptime(payload.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format.")

    amount = round(payload.quantity * payload.price, 2)
    cache = get_cache()
    df = cache.get_df()
    if df is None:
        raise HTTPException(status_code=503, detail="Data not loaded yet.")

    new_row = pd.DataFrame(
        [
            {
                "date": pd.Timestamp(parsed_date),
                "date_str": payload.date,
                "item": payload.item.strip(),
                "quantity": payload.quantity,
                "price": payload.price,
                "amount": amount,
                "total": 0.0,
            }
        ]
    )

    updated = pd.concat([df, new_row], ignore_index=True)
    cache.update(updated)
    logger.info("Added item '%s' on %s to cache", payload.item, payload.date)
    return {"status": "added", "amount": amount}


# ---------------------------------------------------------------------------
# Cash ledger — daily cash entries
# ---------------------------------------------------------------------------

class CashEntryRequest(BaseModel):
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    amount: float = Field(..., gt=0)
    note: str = Field(default="", max_length=300)
    type: str = Field(default="credit", pattern=r"^(credit|debit)$")


class UpdateCashEntryRequest(BaseModel):
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    amount: float = Field(..., gt=0)
    note: str = Field(default="", max_length=300)
    type: str = Field(default="credit", pattern=r"^(credit|debit)$")


@router.post("/cash")
async def add_cash(payload: CashEntryRequest):
    """Append a cash entry for a given date, persisting to DB and cache."""
    try:
        entry_date = datetime.strptime(payload.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format.")

    note = payload.note.strip()
    entry_type = payload.type

    # Persist to PostgreSQL
    pool = await get_pool()
    if pool:
        try:
            async with pool.acquire() as conn:
                await conn.execute(
                    "INSERT INTO cash_entries (date, amount, note, type) VALUES ($1, $2, $3, $4)",
                    entry_date,
                    payload.amount,
                    note,
                    entry_type,
                )
        except Exception as exc:
            logger.error("DB cash insert failed: %s", exc)
            raise HTTPException(status_code=500, detail=f"Database write failed: {exc}")

    get_cache().add_cash_entry(payload.date, payload.amount, note)
    return {"status": "added"}


@router.get("/cash")
async def get_cash():
    """Return all cash entries sorted by date descending. Reads from DB; falls back to cache."""
    pool = await get_pool()
    if pool:
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    "SELECT id, date, amount, note, COALESCE(type, 'credit') as type FROM cash_entries ORDER BY date DESC"
                )
            entries = [
                {
                    "id": r["id"],
                    "date": str(r["date"]),
                    "amount": float(r["amount"]),
                    "note": r["note"],
                    "type": r["type"],
                }
                for r in rows
            ]
        except Exception as exc:
            logger.warning("DB cash read failed, falling back to cache: %s", exc)
            entries = get_cache().get_cash_entries()
    else:
        entries = get_cache().get_cash_entries()

    total = sum(e["amount"] for e in entries)
    return {"entries": entries, "total": total}


@router.put("/cash/{entry_id}")
async def update_cash(entry_id: int, payload: UpdateCashEntryRequest):
    """Update a cash entry by id."""
    try:
        entry_date = datetime.strptime(payload.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format.")

    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database not available.")

    async with pool.acquire() as conn:
        result = await conn.execute(
            "UPDATE cash_entries SET date=$1, amount=$2, note=$3, type=$4 WHERE id=$5",
            entry_date,
            payload.amount,
            payload.note.strip(),
            payload.type,
            entry_id,
        )
    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail="Entry not found.")
    return {"status": "updated"}


@router.delete("/cash/{entry_id}")
async def delete_cash(entry_id: int):
    """Delete a cash entry by id."""
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database not available.")

    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM cash_entries WHERE id=$1",
            entry_id,
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Entry not found.")
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Seller / buyer analytics
# ---------------------------------------------------------------------------

@router.get("/sellers")
async def get_sellers():
    """Return all unique, non-empty seller names sorted alphabetically."""
    df = _require_data()
    if "seller" not in df.columns:
        return {"sellers": []}
    sellers = sorted(
        s for s in df["seller"].dropna().unique().tolist() if str(s).strip()
    )
    return {"sellers": sellers}


@router.get("/seller-analytics")
async def get_seller_analytics(
    seller: str = Query(..., min_length=1, max_length=200),
    from_date: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    to_date: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
):
    """Return full purchase breakdown for a given seller, optionally filtered by date range."""
    df = _require_data()
    if "seller" not in df.columns:
        raise HTTPException(status_code=404, detail="No seller data available.")

    sel_df = df[df["seller"].str.strip().str.lower() == seller.strip().lower()]
    if sel_df.empty:
        raise HTTPException(status_code=404, detail=f"Seller '{seller}' not found.")

    # Apply date range filter
    if from_date:
        sel_df = sel_df[sel_df["date_str"] >= from_date]
    if to_date:
        sel_df = sel_df[sel_df["date_str"] <= to_date]

    if sel_df.empty:
        return {
            "seller": seller,
            "total_spent": 0.0,
            "total_purchases": 0,
            "unique_items": 0,
            "item_summary": [],
            "purchase_history": [],
            "with_bill_spent": 0.0,
            "with_bill_purchases": 0,
            "with_bill_unique_items": 0,
            "without_bill_spent": 0.0,
            "without_bill_purchases": 0,
            "without_bill_unique_items": 0,
        }

    # Item-level summary
    item_grp = (
        sel_df.groupby("item")
        .agg(
            qty=("quantity", "sum"),
            spent=("amount", "sum"),
            count=("quantity", "count"),
        )
        .reset_index()
        .sort_values("spent", ascending=False)
    )
    item_summary = item_grp.rename(columns={"item": "item"}).to_dict(orient="records")

    # Date-grouped purchase history
    date_col = "date_str" if "date_str" in sel_df.columns else "date"
    optional = ["bill_type", "seller", "selling_price"]
    base = ["item", "quantity", "price", "amount"]
    row_cols = base + [c for c in optional if c in sel_df.columns]

    history = []
    for date_val, group in sel_df.groupby(date_col):
        rows = group[row_cols].to_dict(orient="records")
        history.append({
            "date": str(date_val),
            "items": rows,
            "day_total": float(group["amount"].sum()),
        })
    history.sort(key=lambda x: x["date"], reverse=True)

    # Bill-type breakdown
    if "bill_type" in sel_df.columns:
        bt = sel_df["bill_type"].str.upper().str.strip()
        w_df = sel_df[bt == "W"]
        wb_df = sel_df[bt == "WB"]
    else:
        w_df = sel_df.iloc[0:0]
        wb_df = sel_df.iloc[0:0]

    return {
        "seller": seller,
        "total_spent": float(sel_df["amount"].sum()),
        "total_purchases": int(len(sel_df)),
        "unique_items": int(sel_df["item"].nunique()),
        "with_bill_spent": float(w_df["amount"].sum()) if not w_df.empty else 0.0,
        "with_bill_purchases": int(len(w_df)),
        "with_bill_unique_items": int(w_df["item"].nunique()) if not w_df.empty else 0,
        "without_bill_spent": float(wb_df["amount"].sum()) if not wb_df.empty else 0.0,
        "without_bill_purchases": int(len(wb_df)),
        "without_bill_unique_items": int(wb_df["item"].nunique()) if not wb_df.empty else 0,
        "item_summary": item_summary,
        "purchase_history": history,
    }


# ---------------------------------------------------------------------------
# CSV Export
# ---------------------------------------------------------------------------

@router.get("/export/csv")
async def export_csv():
    """Export the full in-memory purchases cache as a CSV download."""
    df = _require_data()

    # Select and order columns that are present
    preferred_cols = ["date_str", "item", "quantity", "price", "amount",
                      "bill_type", "seller", "selling_price"]
    export_cols = [c for c in preferred_cols if c in df.columns]
    export_df = df[export_cols].copy()
    export_df = export_df.rename(columns={"date_str": "date"})
    export_df = export_df.sort_values("date", ascending=False)

    buffer = io.StringIO()
    export_df.to_csv(buffer, index=False)
    buffer.seek(0)

    filename = f"kapoor_traders_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
