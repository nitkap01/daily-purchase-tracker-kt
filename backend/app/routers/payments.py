"""
Payments router — track party payment status.

GET    /api/payments              — list all payments (pending + received)
POST   /api/payments              — create a new pending payment entry
PATCH  /api/payments/{id}/mark-received — mark a payment as received
DELETE /api/payments/{id}         — delete a payment entry
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..db import get_pool

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")


class CreatePaymentRequest(BaseModel):
    party_name: str = Field(..., min_length=1, max_length=500)
    amount: float = Field(..., gt=0)
    purchase_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    notes: str = Field(default="", max_length=1000)


@router.get("/payments")
async def list_payments():
    """Return all payment entries split into pending and received lists."""
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database not available.")

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, party_name, amount, purchase_date, notes,
                   status, received_at, created_at
            FROM payments
            ORDER BY purchase_date DESC, created_at DESC
            """
        )

    pending = []
    received = []
    for r in rows:
        entry = {
            "id": r["id"],
            "party_name": r["party_name"],
            "amount": float(r["amount"]),
            "purchase_date": str(r["purchase_date"]),
            "notes": r["notes"] or "",
            "status": r["status"],
            "received_at": r["received_at"].isoformat() if r["received_at"] else None,
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        }
        # Compute days_to_pay for received entries
        if r["status"] == "received" and r["received_at"] and r["purchase_date"]:
            delta = r["received_at"].date() - r["purchase_date"]
            entry["days_to_pay"] = delta.days
        else:
            entry["days_to_pay"] = None

        if r["status"] == "received":
            received.append(entry)
        else:
            pending.append(entry)

    return {"pending": pending, "received": received}


@router.post("/payments")
async def create_payment(payload: CreatePaymentRequest):
    """Create a new pending payment entry."""
    try:
        purchase_date = datetime.strptime(payload.purchase_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid purchase_date. Use YYYY-MM-DD.")

    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database not available.")

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO payments (party_name, amount, purchase_date, notes, status)
            VALUES ($1, $2, $3, $4, 'pending')
            RETURNING id
            """,
            payload.party_name.strip(),
            payload.amount,
            purchase_date,
            payload.notes.strip(),
        )

    logger.info("Created payment id=%d for party=%s", row["id"], payload.party_name)
    return {"status": "created", "id": row["id"]}


@router.patch("/payments/{payment_id}/mark-received")
async def mark_received(payment_id: int):
    """Mark a pending payment as received with the current timestamp."""
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database not available.")

    now = datetime.now(timezone.utc)
    async with pool.acquire() as conn:
        result = await conn.execute(
            """
            UPDATE payments
            SET status = 'received', received_at = $1
            WHERE id = $2 AND status = 'pending'
            """,
            now,
            payment_id,
        )

    if result == "UPDATE 0":
        raise HTTPException(
            status_code=404,
            detail="Payment not found or already marked as received.",
        )

    logger.info("Marked payment id=%d as received at %s", payment_id, now.isoformat())
    return {"status": "received", "received_at": now.isoformat()}


@router.delete("/payments/{payment_id}")
async def delete_payment(payment_id: int):
    """Delete a payment entry."""
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database not available.")

    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM payments WHERE id = $1",
            payment_id,
        )

    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Payment not found.")

    logger.info("Deleted payment id=%d", payment_id)
    return {"status": "deleted"}
