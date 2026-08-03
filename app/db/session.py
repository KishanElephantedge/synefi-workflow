from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.config import settings

# pool_pre_ping tests each connection with a lightweight query before handing it out,
# transparently reconnecting if it's gone stale -- required against Neon's pooled ("-pooler")
# endpoint, which can hand back a dead connection after the app has been idle (e.g. Render's
# free-tier services spinning down). Without this, the first query after an idle period
# intermittently 500s instead of silently reconnecting.
#
# connect_timeout/statement_timeout added after a real, reproducible pattern (elephantedge-abm
# backend, same shared Neon DB): a single request times out completely and the very next one
# succeeds immediately -- consistent with Neon's own compute occasionally taking a while to
# resume from auto-suspend on the first query after idle, with nothing bounding how long that
# wait (or pool_pre_ping's own check, or any other single slow query) could hang a request
# thread for. Doesn't fix Neon's wake-up latency itself (a Neon-side setting), just turns an
# unbounded hang into a clean, fast, catchable error.
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    connect_args={"connect_timeout": 10, "options": "-c statement_timeout=15000"},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Base.metadata.create_all() only creates missing TABLES -- it never adds an index to a column
# on a table that already exists (both local and the shared Neon production database were
# created long before these FK columns needed indexes). CREATE INDEX IF NOT EXISTS is
# idempotent and safe to run on every startup, so this is how these indexes actually reach
# production without a migration framework. Synefi's backend is the schema owner (see main.py),
# so this is where indexes for the SHARED tables belong; Elephant Edge's own extra tables
# (campaign_events, personalized_messages) are indexed from its own backend instead.
def ensure_indexes():
    statements = [
        "CREATE INDEX IF NOT EXISTS ix_batches_tenant_id ON batches (tenant_id)",
        "CREATE INDEX IF NOT EXISTS ix_companies_batch_id ON companies (batch_id)",
        "CREATE INDEX IF NOT EXISTS ix_signals_company_id ON signals (company_id)",
        "CREATE INDEX IF NOT EXISTS ix_contacts_company_id ON contacts (company_id)",
        "CREATE INDEX IF NOT EXISTS ix_campaign_pushes_contact_id ON campaign_pushes (contact_id)",
        "CREATE INDEX IF NOT EXISTS ix_autonomous_runs_batch_id ON autonomous_runs (batch_id)",
        # Same reasoning as the indexes above -- create_all() never alters a table that
        # already exists, so a new column needs its own idempotent statement here too.
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS excluded_from_push BOOLEAN DEFAULT FALSE",
        "ALTER TABLE companies ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR",
    ]
    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))
