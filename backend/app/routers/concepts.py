from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import ConceptNode, NodeSource, SourceChunk, Document
from ..schemas import ConceptDetailResponse, SourceChunkResponse

router = APIRouter(prefix="/api/concepts", tags=["concepts"])

@router.get("/{concept_id}", response_model=ConceptDetailResponse)
def get_concept_details(concept_id: int, db: Session = Depends(get_db)):
    node = db.query(ConceptNode).filter(ConceptNode.id == concept_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Concept not found")

    # Fetch associated sources
    node_sources = db.query(NodeSource).filter(NodeSource.node_id == node.id).all()
    source_ids = [ns.source_chunk_id for ns in node_sources]

    chunks = db.query(SourceChunk).filter(SourceChunk.id.in_(source_ids)).all() if source_ids else []

    sources_response = []
    for c in chunks:
        doc = db.query(Document).filter(Document.id == c.document_id).first()
        sources_response.append(SourceChunkResponse(
            id=c.id,
            page_number=c.page_number,
            chunk_index=c.chunk_index,
            content=c.content,
            document_filename=doc.filename if doc else None
        ))

    return ConceptDetailResponse(
        id=node.id,
        label=node.label,
        explanation=node.explanation,
        node_type=node.node_type,
        sources=sources_response
    )
