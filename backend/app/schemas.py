from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, EmailStr

# Health Schema
class HealthResponse(BaseModel):
    status: str
    ollama_connected: bool
    ollama_model: str
    ollama_model_available: bool
    database_connected: bool = True

# Auth Schemas
class UserProfileResponse(BaseModel):
    id: str
    email: Optional[str] = None
    role: Optional[str] = "authenticated"
    display_name: Optional[str] = None

class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)

class SignUpRequest(BaseModel):
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfileResponse

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
    has_generated_explanation: bool = True
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
    project_id: Optional[int] = None
    user_id: Optional[str] = None

# AI Memory & Context Schemas
class AIMemoryCreate(BaseModel):
    document_id: Optional[int] = None
    memory_type: str = Field(default="insight", description="'insight', 'context', 'preference', or 'summary'")
    title: str = Field(description="Short summary or label for this memory")
    content: str = Field(description="Memory content, reasoning context, or key takeaway")
    meta_info: Optional[str] = Field(default=None, description="Optional serialized JSON string for arbitrary metadata")

class AIMemoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[str] = None
    document_id: Optional[int] = None
    memory_type: str
    title: str
    content: str
    meta_info: Optional[str] = None
    created_at: datetime
    updated_at: datetime

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
