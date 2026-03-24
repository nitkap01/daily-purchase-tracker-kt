#!/usr/bin/env bash
# scripts/migrate.sh
# ──────────────────
# Run all pending SQL migrations against the PostgreSQL database.
# Reads connection details from .env in the project root.
#
# Usage:
#   ./scripts/migrate.sh
#   ./scripts/migrate.sh --dry-run    (list pending migrations without applying)
#
# Requirements:
#   pip install asyncpg

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}"

# Load .env so variables are available to subprocesses
if [[ -f ".env" ]]; then
  set -o allexport
  # shellcheck disable=SC1091
  source ".env"
  set +o allexport
fi

# ── Dry-run: just list pending migrations ────────────────────────────────────
if [[ "${1:-}" == "--dry-run" ]]; then
  echo "Pending migrations (dry-run):"
  python3 - <<'PYEOF'
import asyncio, os
from pathlib import Path
import asyncpg

HOST     = os.getenv("POSTGRES_HOST", "localhost")
PORT     = int(os.getenv("POSTGRES_PORT", "5432"))
USER     = os.getenv("POSTGRES_USER", "admin")
PASSWORD = os.getenv("POSTGRES_PASSWORD", "")
DB       = os.getenv("POSTGRES_DB", "kapoortraders")

MIGRATIONS_DIR = Path("migrations")

async def main():
    try:
        conn = await asyncpg.connect(host=HOST, port=PORT, user=USER, password=PASSWORD, database=DB)
    except Exception as e:
        print(f"  Cannot connect to {DB}: {e}")
        return
    try:
        applied = {
            row["filename"]
            for row in await conn.fetch(
                "SELECT filename FROM schema_migrations"
            )
        } if await conn.fetchval(
            "SELECT to_regclass('schema_migrations')"
        ) else set()
    finally:
        await conn.close()

    pending = [f.name for f in sorted(MIGRATIONS_DIR.glob("*.sql")) if f.name not in applied]
    if not pending:
        print("  (none — all migrations already applied)")
    else:
        for name in pending:
            print(f"  - {name}")

asyncio.run(main())
PYEOF
  exit 0
fi

# ── Apply migrations ──────────────────────────────────────────────────────────
echo "Running migrations..."
python3 scripts/setup_db.py
