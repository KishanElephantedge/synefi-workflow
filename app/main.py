from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.models import Base
from app.db.session import SessionLocal, engine, ensure_indexes
from app.phases.autonomous_orchestrator import run_daily_autonomous_cycle
from app.routes import api
from app.routes.api import SYNEFI_TENANT_ID, refresh_active_batch_caches

app = FastAPI(title="Synefi Outreach Pipeline")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api.router, prefix="/api")

scheduler = BackgroundScheduler()


def _scheduled_autonomous_tick():
    """Runs every 24h, for Synefi only -- this backend is dedicated to exactly one tenant
    (see api.py's SYNEFI_TENANT_ID). It must never loop over every tenant in the shared
    `tenants` table and run Synefi's own phase logic against another tenant's data; each
    tenant's own dedicated backend is responsible for scheduling its own cycle."""
    db = SessionLocal()
    try:
        run_daily_autonomous_cycle(db, tenant_id=SYNEFI_TENANT_ID)
    finally:
        db.close()


def _scheduled_cache_refresh():
    """Keeps the Redis cache behind GET /batches/{id} warm for every batch page someone's
    actually viewing, so a real click almost never waits on a cold DB query -- see
    app/cache.py and refresh_active_batch_caches in routes/api.py."""
    db = SessionLocal()
    try:
        refresh_active_batch_caches(db)
    finally:
        db.close()


@app.on_event("startup")
def on_startup():
    # Dev-simple table creation; move to Alembic migrations once schema stabilizes.
    Base.metadata.create_all(bind=engine)
    ensure_indexes()
    scheduler.add_job(_scheduled_autonomous_tick, "interval", hours=24, id="autonomous_daily_cycle")
    scheduler.add_job(_scheduled_cache_refresh, "interval", minutes=3, id="batch_cache_refresh")
    scheduler.start()


@app.on_event("shutdown")
def on_shutdown():
    scheduler.shutdown(wait=False)


@app.get("/api/health")
def health():
    return {"status": "ok"}
