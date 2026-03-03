from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import get_settings

settings = get_settings()

# Handle SQLite vs PostgreSQL
connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.database_url,
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables and run lightweight migrations."""
    Base.metadata.create_all(bind=engine)

    # --- Lightweight migrations (idempotent) ---
    # create_all only creates NEW tables, not new columns.
    # Add any missing columns here so existing DBs are migrated.
    with engine.connect() as conn:
        try:
            conn.execute(text(
                "ALTER TABLE group_messages "
                "ADD COLUMN responding_to_message_id INTEGER REFERENCES group_messages(id)"
            ))
            conn.commit()
            print("[DB] Added responding_to_message_id column to group_messages.")
        except Exception:
            # Column already exists — ignore
            pass

