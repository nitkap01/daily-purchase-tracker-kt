import logging
from datetime import datetime

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..cache import get_cache
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

    items = day_df[["item", "quantity", "price", "amount"]].to_dict(orient="records")

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

    history = (
        item_df[["date_str", "quantity", "price", "amount"]]
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
