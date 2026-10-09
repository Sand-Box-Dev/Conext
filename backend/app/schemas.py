from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

# Health Schema
class HealthResponse(BaseModel):
    status: str
    ollama_connected: bool
    ollama_model: str
    ollama_model_available: bool

# Source Chunk Schemas
class SourceChunkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    page_number: int
    chunk_index: int
    content: str
    document_filename: Optional[str] = None

# Concept Node & Edge Schemas
class ConceptNodeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    concept_map_id: int
    label: str
    explanation: str
    node_type: str
    source_chunk_ids: List[int] = []

class ConceptEdgeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    concept_map_id: int
    source_node_id: int
    target_node_id: int
    relationship: str

class ConceptMapResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    title: str
    created_at: datetime
    nodes: List[ConceptNodeResponse]
    edges: List[ConceptEdgeResponse]

# Concept Detail Response
class ConceptDetailResponse(BaseModel):
    id: int
    label: str
    explanation: str
    node_type: str
    sources: List[SourceChunkResponse]

# Document Schemas
class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    uploaded_at: datetime
    processing_status: str
    chunk_count: int = 0
    has_map: bool = False

# Ollama LLM Extraction Schemas (Structured JSON)
class RawConcept(BaseModel):
    label: str = Field(description="Short, clear title of the concept")
    explanation: str = Field(default="", description="A concise, beginner-friendly explanation strictly grounded in the document passages")
    node_type: str = Field(default="concept", description="'root', 'concept', or 'subconcept'")
    source_passage_ids: List[int] = Field(default_factory=list, description="List of integer passage IDs from which this concept was extracted")

class RawRelationship(BaseModel):
    source_label: str = Field(description="The exact label of the source concept")
    target_label: str = Field(description="The exact label of the target concept")
    relationship: str = Field(default="relates to", description="Active, concise description of the relationship between source and target (e.g. 'triggers', 'requires', 'contains')")

class ExtractionResult(BaseModel):
    title: Optional[str] = Field(default="Concept Map", description="An overarching title for this concept map")
    concepts: List[RawConcept] = Field(default_factory=list, description="List of 5 to 12 extracted concepts")
    relationships: List[RawRelationship] = Field(default_factory=list, description="List of relationships between concepts")
