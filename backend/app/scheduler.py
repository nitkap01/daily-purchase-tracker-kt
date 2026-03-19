import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from .cache import get_cache
from .sheets import fetch_sheet_data

logger = logging.getLogger(__name__)

_scheduler = AsyncIOScheduler(timezone="UTC")


async def _refresh_job() -> None:
    logger.info("Scheduler: starting midnight refresh")
    try:
        df = await fetch_sheet_data()
        get_cache().update(df)
        logger.info("Scheduler: refresh complete — %d rows", len(df))
    except Exception as exc:
        logger.error("Scheduler: refresh failed: %s", exc)


def start_scheduler() -> None:
    _scheduler.add_job(
        _refresh_job,
        CronTrigger(hour=0, minute=0),
        id="midnight_refresh",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("APScheduler started — midnight UTC refresh scheduled")


def stop_scheduler() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
