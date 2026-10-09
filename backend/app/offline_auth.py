"""
Offline authentication cache for Supabase users.

On successful online login, user credentials (email + bcrypt-hashed password)
are cached into a local SQLite "offline_users" table. When Supabase is unreachable,
the backend can verify those cached credentials to grant an offline session.
"""

import os
import uuid
import logging
import datetime
from typing import Optional, Dict, Any

import bcrypt
from sqlalchemy import (
    Column,
    String,
    DateTime,
    Text,
    create_engine,
    inspect,
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Offline SQLite database (separate from the main Supabase Postgres DB)
# ---------------------------------------------------------------------------
_OFFLINE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
os.makedirs(_OFFLINE_DIR, exist_ok=True)
_OFFLINE_DB_PATH = os.path.join(_OFFLINE_DIR, "offline_auth.db")
_offline_engine = create_engine(
    f"sqlite:///{_OFFLINE_DB_PATH}",
    connect_args={"check_same_thread": False},
)
OfflineBase = declarative_base()
OfflineSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_offline_engine)


class OfflineUser(OfflineBase):
    """Cached user credentials for offline login."""
    __tablename__ = "offline_users"

    id = Column(String(100), primary_key=True)          # Supabase user UUID
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)  # bcrypt hash
    role = Column(String(50), default="authenticated")
    display_name = Column(String(100), nullable=True)
    last_synced_at = Column(DateTime, default=datetime.datetime.utcnow)


# Create tables on import
OfflineBase.metadata.create_all(bind=_offline_engine)

# Migrate: add display_name column for databases created before this column existed
_existing_cols = {col["name"] for col in inspect(_offline_engine).get_columns("offline_users")}
if "display_name" not in _existing_cols:
    from sqlalchemy import text as _sa_text
    with _offline_engine.begin() as _conn:
        _conn.execute(_sa_text("ALTER TABLE offline_users ADD COLUMN display_name VARCHAR(100)"))


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def hash_password(plain_password: str) -> str:
    """Return a bcrypt hash of *plain_password*."""
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed: str) -> bool:
    """Check *plain_password* against a bcrypt *hashed* value."""
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed.encode("utf-8"))


def cache_user_credentials(
    user_id: str,
    email: str,
    plain_password: str,
    role: str = "authenticated",
    display_name: Optional[str] = None,
) -> None:
    """
    Upsert the user's credentials into the local offline cache.
    Called after every successful Supabase online login / signup.
    """
    db: Session = OfflineSessionLocal()
    try:
        existing = db.query(OfflineUser).filter(OfflineUser.id == user_id).first()
        pw_hash = hash_password(plain_password)
        if existing:
            existing.email = email
            existing.password_hash = pw_hash
            existing.role = role
            existing.display_name = display_name or existing.display_name
            existing.last_synced_at = datetime.datetime.utcnow()
        else:
            db.add(OfflineUser(
                id=user_id,
                email=email,
                password_hash=pw_hash,
                role=role,
                display_name=display_name,
                last_synced_at=datetime.datetime.utcnow(),
            ))
        db.commit()
        logger.info("Cached offline credentials for user %s", email)
    except Exception as exc:
        db.rollback()
        logger.warning("Failed to cache offline credentials: %s", exc)
    finally:
        db.close()


def update_cached_display_name(user_id: str, display_name: str) -> None:
    """Update the cached display name for a user."""
    db: Session = OfflineSessionLocal()
    try:
        user = db.query(OfflineUser).filter(OfflineUser.id == user_id).first()
        if user:
            user.display_name = display_name
            db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def authenticate_offline(email: str, plain_password: str) -> Optional[Dict[str, Any]]:
    """
    Attempt to authenticate a user from the offline cache.
    Returns a user dict on success, or None on failure.
    """
    db: Session = OfflineSessionLocal()
    try:
        user = db.query(OfflineUser).filter(OfflineUser.email == email).first()
        if user and verify_password(plain_password, user.password_hash):
            return {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "display_name": user.display_name,
            }
        return None
    finally:
        db.close()


def get_offline_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Look up a cached user by their Supabase UUID."""
    db: Session = OfflineSessionLocal()
    try:
        user = db.query(OfflineUser).filter(OfflineUser.id == user_id).first()
        if user:
            return {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "display_name": user.display_name,
            }
        return None
    finally:
        db.close()
