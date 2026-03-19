#!/usr/bin/env python3
"""
scripts/setup_db.py
───────────────────
Creates the 'kapoortraders' database (if it doesn't exist) and runs all
pending migrations in order.

Usage:
    python scripts/setup_db.py

Environment variables (reads from ../.env automatically if present):
    POSTGRES_HOST      default: localhost
    POSTGRES_PORT      default: 5432
    POSTGRES_USER      default: admin
    POSTGRES_PASSWORD  required
    POSTGRES_DB        default: kapoortraders
"""
import asyncio
import logging
import os
import sys
from pathlib import Path

# Load .env from project root if present
_env_file = Path(__file__).parent.parent / ".env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

import asyncpg  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

HOST     = os.getenv("POSTGRES_HOST", "localhost")
PORT     = int(os.getenv("POSTGRES_PORT", "5432"))
USER     = os.getenv("POSTGRES_USER", "admin")
PASSWORD = os.getenv("POSTGRES_PASSWORD", "")
DB       = os.getenv("POSTGRES_DB", "kapoortraders")

MIGRATIONS_DIR = Path(__file__).parent.parent / "migrations"


async def ensure_database() -> None:
    """Connect to the default postgres DB and create target DB if missing."""
    conn = await asyncpg.connect(
        host=HOST, port=PORT, user=USER, password=PASSWORD, database="postgres"
    )
    try:
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", DB
        )
        if not exists:
            await conn.execute(f'CREATE DATABASE "{DB}"')
            log.info("Created database: %s", DB)
        else:
            log.info("Database already exists: %s", DB)
    finally:
        await conn.close()


async def run_migrations(conn: asyncpg.Connection) -> None:
    """Create migrations tracking table and run any unapplied .sql files."""
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            filename TEXT PRIMARY KEY,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)

    applied: set[str] = {
        row["filename"]
        for row in await conn.fetch("SELECT filename FROM schema_migrations")
    }

    sql_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not sql_files:
        log.warning("No migration files found in %s", MIGRATIONS_DIR)
        return

    for sql_file in sql_files:
        if sql_file.name in applied:
            log.info("  skip (already applied): %s", sql_file.name)
            continue
        log.info("  applying: %s", sql_file.name)
        sql = sql_file.read_text()
        # Strip comments and blank lines; skip files with no real SQL
        stripped = "\n".join(
            line for line in sql.splitlines()
            if line.strip() and not line.strip().startswith("--")
        ).strip()
        if not stripped:
            log.info("  ✓ skipped (no SQL statements): %s", sql_file.name)
            await conn.execute(
                "INSERT INTO schema_migrations (filename) VALUES ($1)", sql_file.name
            )
            continue
        await conn.execute(sql)
        await conn.execute(
            "INSERT INTO schema_migrations (filename) VALUES ($1)", sql_file.name
        )
        log.info("  ✓ applied: %s", sql_file.name)


async def main() -> None:
    log.info("Connecting to PostgreSQL at %s:%s as %s", HOST, PORT, USER)

    await ensure_database()

    conn = await asyncpg.connect(
        host=HOST, port=PORT, user=USER, password=PASSWORD, database=DB
    )
    try:
        await run_migrations(conn)
    finally:
        await conn.close()

    log.info("✅  Database setup complete — %s is ready", DB)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:
        log.error("Setup failed: %s", exc)
        sys.exit(1)
