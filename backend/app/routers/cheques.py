"""
Cheques router — track cheque payment status.

GET    /api/cheques                     — list all cheques (pending + settled)
POST   /api/cheques                     — create a new pending cheque entry
PATCH  /api/cheques/{id}/clear          — mark cheque as cleared by bank
PATCH  /api/cheques/{id}/reject         — mark cheque as rejected by bank
DELETE /api/cheques/{id}               — delete a cheque entry
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..db import get_pool

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")


class CreateChequeRequest(BaseModel):
    party_name: str = Field(..., min_length=1, max_length=500)
    amount: float = Field(..., gt=0)
    cheque_number: str = Field(..., min_length=1, max_length=100)
    cheque_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")


def _row_to_dict(r: dict) -> dict:
    return {
        "id": r["id"],
        "party_name": r["party_name"],
        "amount": float(r["amount"]),
        "cheque_number": r["cheque_number"],
        "cheque_date": str(r["cheque_date"]),
        "status": r["status"],
        "cleared_at": r["cleared_at"].isoformat() if r["cleared_at"] else None,
        "rejected_at": r["rejected_at"].isoformat() if r["rejected_at"] else None,
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
    }


@router.get("/cheques")
async def list_cheques():
    """Return all cheques split into pending and settled lists."""
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database not available.")

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, party_name, amount, cheque_number, cheque_date,
                   status, cleared_at, rejected_at, created_at
            FROM cheques
            ORDER BY cheque_date DESC, created_at DESC
            """
        )

    pending = []
    settled = []
    for r in rows:
        entry = _row_to_dict(r)
        if r["status"] == "pending":
            pending.append(entry)
        else:
            settled.append(entry)

    return {"pending": pending, "settled": settled}


@router.post("/cheques")
async def create_cheque(payload: CreateChequeRequest):
    """Create a new pending cheque entry."""
    try:
        cheque_date = datetime.strptime(payload.cheque_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid cheque_date. Use YYYY-MM-DD.")

    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database not available.")

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO cheques (party_name, amount, cheque_number, cheque_date, status)
            VALUES ($1, $2, $3, $4, 'pending')
            RETURNING id
            """,
            payload.party_name.strip(),
            payload.amount,
            payload.cheque_number.strip(),
            cheque_date,
        )

    logger.info("Created cheque id=%d for party=%s", row["id"], payload.party_name)
    return {"status": "created", "id": row["id"]}


@router.patch("/cheques/{cheque_id}/clear")
async def clear_cheque(cheque_id: int):
    """Mark a pending cheque as cleared; auto-marks any matching pending payment as received."""
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database not available.")

    now = datetime.now(timezone.utc)
    async with pool.acquire() as conn:
        async with conn.transaction():
            cheque = await conn.fetchrow(
                "SELECT party_name, amount FROM cheques WHERE id = $1 AND status = 'pending'",
                cheque_id,
            )
            if not cheque:
                raise HTTPException(status_code=404, detail="Cheque not found or already settled.")

            await conn.execute(
                "UPDATE cheques SET status = 'cleared', cleared_at = $1 WHERE id = $2",
                now,
                cheque_id,
            )

            # Auto-complete the first matching pending payment for same party + amount
            await conn.execute(
                """
                UPDATE payments
                SET status = 'received',
                    received_at = $1,
                    notes = CASE
                        WHEN (notes IS NULL OR notes = '') THEN 'Cheque received'
                        ELSE notes || ' · Cheque received'
                    END
                WHERE id = (
                    SELECT id FROM payments
                    WHERE LOWER(party_name) = LOWER($2)
                      AND amount = $3
                      AND status = 'pending'
                    ORDER BY purchase_date ASC, created_at ASC
                    LIMIT 1
                )
                """,
                now,
                cheque["party_name"],
                cheque["amount"],
            )

    logger.info("Cleared cheque id=%d at %s", cheque_id, now.isoformat())
    return {"status": "cleared", "cleared_at": now.isoformat()}


@router.patch("/cheques/{cheque_id}/reject")
async def reject_cheque(cheque_id: int):
    """Mark a pending cheque as rejected by the bank."""
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database not available.")

    now = datetime.now(timezone.utc)
    async with pool.acquire() as conn:
        result = await conn.execute(
            """
            UPDATE cheques
            SET status = 'rejected', rejected_at = $1
            WHERE id = $2 AND status = 'pending'
            """,
            now,
            cheque_id,
        )

    if result == "UPDATE 0":
        raise HTTPException(
            status_code=404,
            detail="Cheque not found or already settled.",
        )

    logger.info("Rejected cheque id=%d at %s", cheque_id, now.isoformat())
    return {"status": "rejected", "rejected_at": now.isoformat()}


@router.delete("/cheques/{cheque_id}")
async def delete_cheque(cheque_id: int):
    """Delete a cheque entry."""
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=503, detail="Database not available.")

    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM cheques WHERE id = $1",
            cheque_id,
        )

    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Cheque not found.")

    logger.info("Deleted cheque id=%d", cheque_id)
    return {"status": "deleted"}
