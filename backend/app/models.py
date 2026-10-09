import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index, Boolean, text
from sqlalchemy.orm import relationship
from .database import Base


class ProjectFolder(Base):
    __tablename__ = "project_folders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(80), nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    documents = relationship("Document", back_populates="project_folder")

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), nullable=True, index=True)  # Supabase Auth user UUID
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)
    processing_status = Column(String(50), default="ready")  # ready, processing, completed, error
    project_id = Column(Integer, ForeignKey("project_folders.id"), nullable=True)
    is_trashed = Column(Boolean, nullable=False, default=False, server_default=text("false"))

    # Relationships
    chunks = relationship("SourceChunk", back_populates="document", cascade="all, delete-orphan")
    concept_map = relationship("ConceptMap", back_populates="document", uselist=False, cascade="all, delete-orphan")
    project_folder = relationship("ProjectFolder", back_populates="documents")
    ai_memories = relationship("AIMemory", back_populates="document", cascade="all, delete-orphan")


class SourceChunk(Base):
    __tablename__ = "source_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    page_number = Column(Integer, nullable=False, default=1)
    chunk_index = Column(Integer, nullable=False, default=0)
    content = Column(Text, nullable=False)
    embedding = Column(Text, nullable=True)  # JSON-serialized vector embedding

    # Relationships
    document = relationship("Document", back_populates="chunks")
    node_associations = relationship("NodeSource", back_populates="source_chunk", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    citations = Column(Text, nullable=True)  # JSON-serialized reviewer citations
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)


class StudyExam(Base):
    __tablename__ = "study_exams"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    mode = Column(String(20), nullable=False, index=True)  # quiz, flashcards, essay
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)  # JSON serialized generated exam and optional attempt
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    document = relationship("Document")


class ConceptMap(Base):
    __tablename__ = "concept_maps"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(100), nullable=True, index=True)  # Supabase Auth user UUID
    title = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    document = relationship("Document", back_populates="concept_map")
    nodes = relationship("ConceptNode", back_populates="concept_map", cascade="all, delete-orphan")
    edges = relationship("ConceptEdge", back_populates="concept_map", cascade="all, delete-orphan")


class ConceptNode(Base):
    __tablename__ = "concept_nodes"

    id = Column(Integer, primary_key=True, index=True)
    concept_map_id = Column(Integer, ForeignKey("concept_maps.id", ondelete="CASCADE"), nullable=False, index=True)
    label = Column(String(255), nullable=False)
    explanation = Column(Text, nullable=False)
    node_type = Column(String(50), default="concept")  # "root", "concept", "subconcept"

    # Relationships
    concept_map = relationship("ConceptMap", back_populates="nodes")
    source_associations = relationship("NodeSource", back_populates="node", cascade="all, delete-orphan")


class ConceptEdge(Base):
    __tablename__ = "concept_edges"

    id = Column(Integer, primary_key=True, index=True)
    concept_map_id = Column(Integer, ForeignKey("concept_maps.id", ondelete="CASCADE"), nullable=False, index=True)
    source_node_id = Column(Integer, ForeignKey("concept_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    target_node_id = Column(Integer, ForeignKey("concept_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    relationship_label = Column(String(255), nullable=False)

    # Relationships
    concept_map = relationship("ConceptMap", back_populates="edges")


class NodeSource(Base):
    __tablename__ = "node_sources"

    id = Column(Integer, primary_key=True, index=True)
    node_id = Column(Integer, ForeignKey("concept_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    source_chunk_id = Column(Integer, ForeignKey("source_chunks.id", ondelete="CASCADE"), nullable=False, index=True)

    # Relationships
    node = relationship("ConceptNode", back_populates="source_associations")
    source_chunk = relationship("SourceChunk", back_populates="node_associations")


# AI Memory & Context Persistence
class AIMemory(Base):
    """
    Stores persistent AI memories, user-specific learnings, document summaries,
    or interaction context across chat and concept reasoning sessions.
    """
    __tablename__ = "ai_memories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), nullable=True, index=True)  # Supabase Auth user UUID
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=True, index=True)
    memory_type = Column(String(50), default="insight")  # "insight", "context", "preference", "summary"
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    meta_info = Column(Text, nullable=True)  # JSON-serialized auxiliary metadata
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    document = relationship("Document", back_populates="ai_memories")
