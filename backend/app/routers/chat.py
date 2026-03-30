"""
Chat router — LLM-powered natural language queries over the purchases DB.

POST /api/chat   — ask a question in plain English; get an AI answer backed by
                   a live SQL query against PostgreSQL.
"""
import json
import logging
import os
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..db import get_pool

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

# ── Schema context for the LLM ──────────────────────────────────────────────

_SCHEMA = """
PostgreSQL database for Kapoor Traders (a grocery/trading business):

Table: purchases
  - id SERIAL PRIMARY KEY
  - date DATE                  — purchase date
  - item VARCHAR               — item name
  - quantity NUMERIC           — quantity purchased
  - price NUMERIC              — price per unit (₹ INR)
  - amount NUMERIC             — total cost = quantity × price (₹ INR)
  - synced_at TIMESTAMPTZ

Table: cash_entries
  - id SERIAL PRIMARY KEY
  - date DATE
  - amount NUMERIC             — cash amount (₹ INR)
  - note TEXT
  - type VARCHAR               — 'credit' (cash in) or 'debit' (cash out)
  - created_at TIMESTAMPTZ

Table: payments
  - id SERIAL PRIMARY KEY
  - party_name VARCHAR         — buyer/party name
  - amount NUMERIC             — payment amount (₹ INR)
  - purchase_date DATE         — date of the original purchase
  - notes TEXT
  - status VARCHAR             — 'pending' or 'received'
  - received_at TIMESTAMPTZ   — when payment was marked received (NULL if pending)
  - created_at TIMESTAMPTZ

Table: cheques
  - id SERIAL PRIMARY KEY
  - party_name VARCHAR         — party who issued the cheque
  - amount NUMERIC             — cheque amount (₹ INR)
  - cheque_number VARCHAR      — cheque number
  - cheque_date DATE           — date on the cheque
  - status VARCHAR             — 'pending', 'cleared', or 'rejected'
  - cleared_at TIMESTAMPTZ    — when cheque was cleared by bank
  - rejected_at TIMESTAMPTZ   — when cheque was rejected by bank
  - created_at TIMESTAMPTZ

Currency is Indian Rupees (₹). Dates stored as DATE (YYYY-MM-DD).
"""

_SQL_SYSTEM = f"""You are a PostgreSQL expert for a grocery/trading business database.
{_SCHEMA}
Rules:
- Respond with ONLY a valid PostgreSQL SELECT query. No explanation, no markdown, no code fences.
- NEVER use INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TRUNCATE, COPY, SET, or any mutation.
- Limit to 20 rows unless user asks for more.
- Use LOWER(item) for case-insensitive item comparisons when appropriate.
- For "most bought" use COUNT(*) or SUM(quantity).
- For "most expensive" or "costly" use AVG(price) or MAX(price).
- For "total spending" use SUM(amount).
- For pending payments use: WHERE status = 'pending' on the payments table.
- For cleared cheques use: WHERE status = 'cleared' on the cheques table.
- For cash flow (credit vs debit) use the cash_entries table with the type column.
- ORDER results meaningfully (highest first, most to least).
- Today's date is CURRENT_DATE.
"""

_SUMMARY_SYSTEM = """You are a helpful business analyst for Kapoor Traders.
Given a SQL result, answer the original question in 2-4 concise sentences.
Format monetary values in Indian Rupees (₹) with comma separators.
Be direct and factual. If the result is empty, say no matching data was found."""

# ── SQL safety validation ────────────────────────────────────────────────────

_FORBIDDEN = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|COPY|EXECUTE|EXEC"
    r"|GRANT|REVOKE|SET\s+SESSION|BEGIN|COMMIT|ROLLBACK|VACUUM|ANALYZE)\b",
    re.IGNORECASE,
)


def _validate_sql(sql: str) -> None:
    stripped = sql.strip().lstrip(";").strip()
    if not stripped.upper().startswith("SELECT"):
        raise ValueError("Only SELECT queries are allowed.")
    m = _FORBIDDEN.search(stripped)
    if m:
        raise ValueError(f"Forbidden keyword: {m.group().upper()}")


# ── Endpoint ─────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    model: str = Field(default="")


@router.get("/chat/models")
async def list_chat_models():
    """Return available OpenAI chat models (filtered to gpt-* variants)."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured.")
    try:
        from openai import AsyncOpenAI
    except ImportError:
        raise HTTPException(status_code=503, detail="OpenAI library not installed.")

    client = AsyncOpenAI(api_key=api_key)
    try:
        all_models = await client.models.list()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch models: {exc}")

    default_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    model_ids = sorted(
        [m.id for m in all_models.data if "gpt" in m.id.lower()],
        key=lambda x: x,
    )
    return {"models": model_ids, "default": default_model}


@router.post("/chat")
async def chat_query(payload: ChatRequest):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEY is not configured. Set it in the .env file to enable the AI assistant.",
        )

    pool = await get_pool()
    if not pool:
        raise HTTPException(
            status_code=503,
            detail="PostgreSQL is not available. The AI assistant requires a database connection.",
        )

    try:
        from openai import AsyncOpenAI  # lazy import — only needed if configured
    except ImportError:
        raise HTTPException(status_code=503, detail="OpenAI library not installed.")

    model = payload.model.strip() or os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    client = AsyncOpenAI(api_key=api_key)

    # ── Step 1: Generate SQL ─────────────────────────────────────────────
    try:
        sql_resp = await client.chat.completions.create(
            model=model,
            temperature=0,
            messages=[
                {"role": "system", "content": _SQL_SYSTEM},
                {"role": "user", "content": payload.question},
            ],
        )
        sql = sql_resp.choices[0].message.content or ""
        # Strip accidental markdown fences
        sql = re.sub(r"^```(?:sql)?\s*", "", sql.strip(), flags=re.IGNORECASE)
        sql = re.sub(r"\s*```$", "", sql.strip()).strip()
    except Exception as exc:
        logger.error("OpenAI SQL generation failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"AI query generation failed: {exc}")

    # ── Step 2: Validate + execute SQL ──────────────────────────────────
    try:
        _validate_sql(sql)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"The AI generated an unsafe query: {exc}. Try rephrasing your question.",
        )

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(sql)
            results: list[dict] = []
            for r in rows:
                row: dict = {}
                for k, v in dict(r).items():
                    if hasattr(v, "isoformat"):
                        row[k] = v.isoformat()
                    elif not isinstance(v, (str, int, float, bool, type(None))):
                        row[k] = str(v)
                    else:
                        row[k] = v
                results.append(row)
    except Exception as exc:
        logger.error("SQL execution failed: %s | SQL: %s", exc, sql)
        raise HTTPException(status_code=500, detail=f"Query execution failed: {exc}")

    # ── Step 3: Summarise results ─────────────────────────────────────
    results_text = json.dumps(results[:20], indent=2) if results else "No rows returned."
    try:
        summary_resp = await client.chat.completions.create(
            model=model,
            temperature=0.3,
            messages=[
                {"role": "system", "content": _SUMMARY_SYSTEM},
                {
                    "role": "user",
                    "content": (
                        f"Question: {payload.question}\n\n"
                        f"SQL used:\n{sql}\n\n"
                        f"Results:\n{results_text}"
                    ),
                },
            ],
        )
        answer = summary_resp.choices[0].message.content or "No answer generated."
    except Exception as exc:
        logger.error("OpenAI summarisation failed: %s", exc)
        answer = f"Query returned {len(results)} row(s). (Summary unavailable: {exc})"

    return {
        "answer": answer,
        "sql": sql,
        "rows_found": len(results),
        "data": results[:20],
    }
