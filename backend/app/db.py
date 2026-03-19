"""PostgreSQL connection pool management using asyncpg."""
import logging
import os
from typing import Optional

import asyncpg

logger = logging.getLogger(__name__)

_pool: Optional[asyncpg.Pool] = None


def _dsn() -> str:
    return (
        f"postgresql://{os.getenv('POSTGRES_USER', 'admin')}:"
        f"{os.getenv('POSTGRES_PASSWORD', '')}@"
        f"{os.getenv('POSTGRES_HOST', 'localhost')}:"
        f"{os.getenv('POSTGRES_PORT', '5432')}/"
        f"{os.getenv('POSTGRES_DB', 'kapoortraders')}"
    )


async def init_pool() -> None:
    global _pool
    try:
        _pool = await asyncpg.create_pool(dsn=_dsn(), min_size=2, max_size=10, command_timeout=30)
        logger.info("PostgreSQL pool created")
    except Exception as exc:
        logger.warning("PostgreSQL unavailable at startup (will retry on demand): %s", exc)
        _pool = None


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def get_pool() -> Optional[asyncpg.Pool]:
    global _pool
    if _pool is None:
        try:
            _pool = await asyncpg.create_pool(dsn=_dsn(), min_size=2, max_size=10, command_timeout=30)
        except Exception:
            return None
    return _pool


async def check_connection() -> bool:
    """Return True if PostgreSQL is reachable."""
    pool = await get_pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return True
    except Exception:
        return False
