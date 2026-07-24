from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings

# pool_pre_ping tests each connection with a lightweight query before handing it out,
# transparently reconnecting if it's gone stale -- required against Neon's pooled ("-pooler")
# endpoint, which can hand back a dead connection after the app has been idle (e.g. Render's
# free-tier services spinning down). Without this, the first query after an idle period
# intermittently 500s instead of silently reconnecting.
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
