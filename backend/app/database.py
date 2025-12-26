from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sql_app.db")

# Vercel Serverless environment optimization
connect_args = {}
if "sqlite" not in DATABASE_URL:
    connect_args = {"check_same_thread": False}

# Adjust connection pool for Serverless (PostgreSQL)
# Serverless functions are ephemeral, so we don't want large pools
engine_args = {
    "pool_pre_ping": True,
    "pool_recycle": 3600,
}

if "postgresql" in DATABASE_URL:
    # Use NullPool for serverless to avoid connection limits error
    from sqlalchemy.pool import NullPool
    engine_args["poolclass"] = NullPool
    # Remove pool_recycle as it conflicts with NullPool or is unnecessary
    engine_args.pop("pool_recycle", None)

engine = create_engine(
    DATABASE_URL, 
    **engine_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
