"""
Data sync service: copies Supabase Postgres data into the local SQLite fallback
database so the app can function fully while offline.

Triggered after each successful online login.
"""

import logging
import datetime
from typing import Optional, Dict, Any, List

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import engine as primary_engine, SessionLocal, Base
from ..models import (
    ProjectFolder,
    Document,
    SourceChunk,
    ChatMessage,
    StudyExam,
    ConceptMap,
    ConceptNode,
    ConceptEdge,
    NodeSource,
    AIMemory,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Local offline SQLite engine — reuses the same fallback path from database.py
# ---------------------------------------------------------------------------
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_OFFLINE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
os.makedirs(_OFFLINE_DIR, exist_ok=True)
_OFFLINE_DATA_PATH = os.path.join(_OFFLINE_DIR, "offline_data.db")
_offline_data_engine = create_engine(
    f"sqlite:///{_OFFLINE_DATA_PATH}",
    connect_args={"check_same_thread": False},
)
OfflineDataSession = sessionmaker(autocommit=False, autoflush=False, bind=_offline_data_engine)

# Create all the same tables in the offline data SQLite DB
Base.metadata.create_all(bind=_offline_data_engine)


def _is_postgres() -> bool:
    """Return True if the primary engine points to PostgreSQL."""
    return "postgresql" in str(primary_engine.url) or "postgres" in str(primary_engine.url)


def _rows_to_dicts(db: Session, model) -> List[Dict[str, Any]]:
    """Fetch all rows for a model and return as a list of column-name dicts."""
    columns = [c.name for c in model.__table__.columns]
    rows = db.query(model).all()
    result = []
    for row in rows:
        d = {}
        for col in columns:
            val = getattr(row, col)
            d[col] = val
        result.append(d)
    return result


def _sync_table(
    online_db: Session,
    offline_db: Session,
    model,
    user_id: Optional[str] = None,
    filter_col: Optional[str] = None,
) -> int:
    """
    Copy all rows of *model* from the online DB into the offline DB.
    If *user_id* and *filter_col* are provided, only sync rows belonging to
    that user (plus rows where the column is NULL for shared/global data).

    Returns the count of synced rows.
    """
    table = model.__table__
    columns = [c.name for c in table.columns]

    query = online_db.query(model)
    if user_id and filter_col and hasattr(model, filter_col):
        col = getattr(model, filter_col)
        query = query.filter((col == user_id) | (col.is_(None)))

    rows = query.all()
    if not rows:
        return 0

    # Clear existing offline data for the same scope
    offline_delete_query = offline_db.query(model)
    if user_id and filter_col and hasattr(model, filter_col):
        col = getattr(model, filter_col)
        offline_delete_query = offline_delete_query.filter((col == user_id) | (col.is_(None)))
    offline_delete_query.delete(synchronize_session=False)

    # Insert fresh copies
    for row in rows:
        data = {col: getattr(row, col) for col in columns}
        offline_db.execute(table.insert().values(**data))

    return len(rows)


def sync_user_data_to_offline(user_id: Optional[str] = None) -> Dict[str, int]:
    """
    Synchronise all user-relevant data from the primary (Supabase Postgres)
    database into the local SQLite offline data store.

    Only runs when the primary engine is PostgreSQL; if we're already on SQLite
    there's nothing to sync.
    """
    if not _is_postgres():
        logger.debug("Primary DB is already SQLite — skipping sync.")
        return {}

    online_db: Session = SessionLocal()
    offline_db: Session = OfflineDataSession()
    stats: Dict[str, int] = {}

    try:
        # Sync tables in dependency order (parents first)
        stats["project_folders"] = _sync_table(online_db, offline_db, ProjectFolder)
        stats["documents"] = _sync_table(online_db, offline_db, Document, user_id, "user_id")

        # Get synced document IDs to scope child tables
        synced_doc_ids = [
            row.id for row in offline_db.query(Document.id).all()
        ]

        if synced_doc_ids:
            # SourceChunks
            offline_db.query(SourceChunk).filter(
                SourceChunk.document_id.in_(synced_doc_ids)
            ).delete(synchronize_session=False)
            chunks = online_db.query(SourceChunk).filter(
                SourceChunk.document_id.in_(synced_doc_ids)
            ).all()
            for chunk in chunks:
                data = {c.name: getattr(chunk, c.name) for c in SourceChunk.__table__.columns}
                offline_db.execute(SourceChunk.__table__.insert().values(**data))
            stats["source_chunks"] = len(chunks)

            # ChatMessages
            offline_db.query(ChatMessage).filter(
                ChatMessage.document_id.in_(synced_doc_ids)
            ).delete(synchronize_session=False)
            messages = online_db.query(ChatMessage).filter(
                ChatMessage.document_id.in_(synced_doc_ids)
            ).all()
            for msg in messages:
                data = {c.name: getattr(msg, c.name) for c in ChatMessage.__table__.columns}
                offline_db.execute(ChatMessage.__table__.insert().values(**data))
            stats["chat_messages"] = len(messages)

            # StudyExams
            offline_db.query(StudyExam).filter(
                StudyExam.document_id.in_(synced_doc_ids)
            ).delete(synchronize_session=False)
            exams = online_db.query(StudyExam).filter(
                StudyExam.document_id.in_(synced_doc_ids)
            ).all()
            for exam in exams:
                data = {c.name: getattr(exam, c.name) for c in StudyExam.__table__.columns}
                offline_db.execute(StudyExam.__table__.insert().values(**data))
            stats["study_exams"] = len(exams)

            # ConceptMaps + Nodes + Edges + NodeSources
            offline_db.query(ConceptMap).filter(
                ConceptMap.document_id.in_(synced_doc_ids)
            ).delete(synchronize_session=False)
            maps = online_db.query(ConceptMap).filter(
                ConceptMap.document_id.in_(synced_doc_ids)
            ).all()
            for m in maps:
                data = {c.name: getattr(m, c.name) for c in ConceptMap.__table__.columns}
                offline_db.execute(ConceptMap.__table__.insert().values(**data))
            stats["concept_maps"] = len(maps)

            synced_map_ids = [m.id for m in maps]
            if synced_map_ids:
                offline_db.query(ConceptNode).filter(
                    ConceptNode.concept_map_id.in_(synced_map_ids)
                ).delete(synchronize_session=False)
                nodes = online_db.query(ConceptNode).filter(
                    ConceptNode.concept_map_id.in_(synced_map_ids)
                ).all()
                for n in nodes:
                    data = {c.name: getattr(n, c.name) for c in ConceptNode.__table__.columns}
                    offline_db.execute(ConceptNode.__table__.insert().values(**data))
                stats["concept_nodes"] = len(nodes)

                offline_db.query(ConceptEdge).filter(
                    ConceptEdge.concept_map_id.in_(synced_map_ids)
                ).delete(synchronize_session=False)
                edges = online_db.query(ConceptEdge).filter(
                    ConceptEdge.concept_map_id.in_(synced_map_ids)
                ).all()
                for e in edges:
                    data = {c.name: getattr(e, c.name) for c in ConceptEdge.__table__.columns}
                    offline_db.execute(ConceptEdge.__table__.insert().values(**data))
                stats["concept_edges"] = len(edges)

                synced_node_ids = [n.id for n in nodes]
                if synced_node_ids:
                    offline_db.query(NodeSource).filter(
                        NodeSource.node_id.in_(synced_node_ids)
                    ).delete(synchronize_session=False)
                    nsources = online_db.query(NodeSource).filter(
                        NodeSource.node_id.in_(synced_node_ids)
                    ).all()
                    for ns in nsources:
                        data = {c.name: getattr(ns, c.name) for c in NodeSource.__table__.columns}
                        offline_db.execute(NodeSource.__table__.insert().values(**data))
                    stats["node_sources"] = len(nsources)

        # AIMemory
        stats["ai_memories"] = _sync_table(online_db, offline_db, AIMemory, user_id, "user_id")

        offline_db.commit()
        logger.info("Offline data sync completed: %s", stats)
    except Exception as exc:
        offline_db.rollback()
        logger.error("Offline data sync failed: %s", exc)
        raise
    finally:
        online_db.close()
        offline_db.close()

    return stats
