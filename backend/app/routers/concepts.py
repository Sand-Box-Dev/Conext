from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import re
from ..database import get_db
from ..models import ConceptNode, NodeSource, SourceChunk, Document
from ..schemas import ConceptDetailResponse, SourceChunkResponse
from ..services.ollama_service import generate_concept_explanation

router = APIRouter(prefix="/api/concepts", tags=["concepts"])


@router.post("/{concept_id}/explain")
async def improve_concept_explanation(concept_id: int, db: Session = Depends(get_db)):
    node = db.query(ConceptNode).filter(ConceptNode.id == concept_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Concept not found")

    source_ids = [
        association.source_chunk_id
        for association in db.query(NodeSource).filter(NodeSource.node_id == node.id).all()
    ]
    chunks = (
        db.query(SourceChunk)
        .filter(SourceChunk.id.in_(source_ids))
        .order_by(SourceChunk.chunk_index)
        .all()
        if source_ids
        else []
    )
    if not chunks:
        raise HTTPException(status_code=422, detail="This concept has no linked reviewer passages to explain it.")

    document = db.query(Document).filter(Document.id == chunks[0].document_id).first()
    try:
        explanation = await generate_concept_explanation(
            concept_label=node.label,
            doc_title=document.filename if document else "reviewer",
            passages=[(chunk.id, chunk.page_number, chunk.content) for chunk in chunks],
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not generate an explanation from the reviewer: {exc}",
        ) from exc

    node.explanation = explanation
    db.commit()
    return {"explanation": explanation, "has_generated_explanation": True}

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

    explanation = (node.explanation or "").strip()
    has_generated_explanation = bool(explanation)
    if not explanation and chunks:
        # Older maps can contain empty explanation fields. Use a concise
        # sentence from the node's own cited passages so selecting it still
        # shows grounded context instead of an empty panel.
        label_terms = {term.lower() for term in re.findall(r"[A-Za-z0-9]+", node.label) if len(term) > 2}
        sentences = [
            sentence.strip()
            for chunk in chunks
            for sentence in re.split(r"(?<=[.!?])\s+", chunk.content.strip())
            if sentence.strip()
        ]
        if sentences:
            def relevance(sentence: str) -> tuple[int, int]:
                terms = {term.lower() for term in re.findall(r"[A-Za-z0-9]+", sentence)}
                return (len(label_terms & terms), -abs(len(sentence) - 220))

            explanation = max(sentences, key=relevance)[:700]

    return ConceptDetailResponse(
        id=node.id,
        label=node.label,
        explanation=explanation,
        has_generated_explanation=has_generated_explanation,
        node_type=node.node_type,
        sources=sources_response
    )
