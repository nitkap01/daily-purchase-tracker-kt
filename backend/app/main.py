import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .cache import get_cache
from .db import close_pool, init_pool
from .scheduler import start_scheduler, stop_scheduler
from .sheets import fetch_sheet_data
from .routers.data import router as data_router
from .routers.sync import router as sync_router, creds_router
from .routers.status import router as status_router
from .routers.chat import router as chat_router

STATIC_DIR = Path(__file__).parent.parent / "static"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Init PostgreSQL pool (non-fatal if unavailable)
    await init_pool()

    logger.info("Startup: loading Google Sheets data…")
    try:
        df = await fetch_sheet_data()
        get_cache().update(df)
        logger.info("Startup: loaded %d rows", len(df))
    except Exception as exc:
        logger.error("Startup: data load failed (use /api/refresh to retry): %s", exc)

    start_scheduler()
    yield
    stop_scheduler()
    await close_pool()
    logger.info("Shutdown complete")


app = FastAPI(
    title="Sheets Dashboard API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(data_router)
app.include_router(sync_router)
app.include_router(creds_router)
app.include_router(status_router)
app.include_router(chat_router)

# ── Serve React SPA (present only in the production Docker image) ──────────
if STATIC_DIR.exists():
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(_full_path: str = "") -> FileResponse:
        return FileResponse(str(STATIC_DIR / "index.html"))
