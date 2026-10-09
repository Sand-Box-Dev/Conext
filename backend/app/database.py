import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import DATABASE_URL

logger = logging.getLogger(__name__)

# Fallback to local SQLite if DATABASE_URL is not provided
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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
