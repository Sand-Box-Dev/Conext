import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import DATABASE_URL

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Offline data SQLite engine (always available as a local fallback)
# ---------------------------------------------------------------------------
_OFFLINE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
os.makedirs(_OFFLINE_DIR, exist_ok=True)

_offline_db_path = os.path.join(_OFFLINE_DIR, "offline_data.db")
offline_engine = create_engine(
    f"sqlite:///{_offline_db_path}",
    connect_args={"check_same_thread": False},
)
OfflineSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=offline_engine)

# ---------------------------------------------------------------------------
# Primary engine (Supabase Postgres or local SQLite when DATABASE_URL is empty)
# ---------------------------------------------------------------------------
if not DATABASE_URL:
    DATABASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
    os.makedirs(DATABASE_DIR, exist_ok=True)
    db_conn_str = f"sqlite:///{os.path.join(DATABASE_DIR, 'conext.db')}"
    connect_args = {"check_same_thread": False}
    engine = create_engine(db_conn_str, connect_args=connect_args)
    logger.info("Using SQLite fallback database.")
else:
    # Ensure postgresql+psycopg2:// scheme is compatible with SQLAlchemy and psycopg2
    db_conn_str = DATABASE_URL
    if db_conn_str.startswith("postgres://"):
        db_conn_str = db_conn_str.replace("postgres://", "postgresql+psycopg2://", 1)
    elif db_conn_str.startswith("postgresql://") and not db_conn_str.startswith("postgresql+psycopg2://"):
        db_conn_str = db_conn_str.replace("postgresql://", "postgresql+psycopg2://", 1)
    
    # Supabase Postgres connection pooling settings with SSL requirement
    engine = create_engine(
        db_conn_str,
        connect_args={"sslmode": "require"},
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10
    )
    logger.info("Configured Supabase PostgreSQL engine with SSL.")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def is_primary_postgres() -> bool:
    """Return True if the primary engine is PostgreSQL (Supabase)."""
    url = str(engine.url)
    return "postgresql" in url or "postgres" in url


def check_primary_db_online() -> bool:
    """
    Quick connectivity test against the primary database.
    Returns True if the DB is reachable, False otherwise.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def get_db_session():
    """
    Returns an open Session instance from either the primary engine (Supabase Postgres)
    or the offline SQLite fallback engine if the primary is unreachable.
    Caller must close the returned session.
    """
    if is_primary_postgres():
        try:
            db = SessionLocal()
            db.execute(text("SELECT 1"))
            return db
        except Exception:
            logger.warning("Primary DB unreachable, falling back to offline SQLite session.")
            return OfflineSessionLocal()
    return SessionLocal()


def get_db():
    """
    FastAPI dependency that yields a database session (primary or offline SQLite fallback).
    """
    db = get_db_session()
    try:
        yield db
    finally:
        db.close()
