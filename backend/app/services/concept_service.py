import logging
from typing import List, Dict, Set
from sqlalchemy.orm import Session
from ..models import Document, SourceChunk, ConceptMap, ConceptNode, ConceptEdge, NodeSource
from ..schemas import ExtractionResult, ConceptMapResponse, ConceptNodeResponse, ConceptEdgeResponse
from .ollama_service import generate_concept_map_from_passages
from .vector_service import VectorService

logger = logging.getLogger(__name__)

# Max passages to feed model context to keep within context budget safely
MAX_PASSAGES_FOR_EXTRACTION = 15

def select_representative_chunks(chunks: List[SourceChunk], max_count: int = MAX_PASSAGES_FOR_EXTRACTION) -> List[SourceChunk]:
    """
    Selects representative passages using vector-space semantic clustering & diversity.
    Falls back to positional spacing if vectorization is empty.
    """
    try:
        return VectorService.select_top_semantic_chunks(chunks, max_count=max_count)
    except Exception as e:
        logger.warning(f"Vector-based selection fell back to positional spacing: {e}")
        if len(chunks) <= max_count:
            return chunks
        
        selected = []
        selected.extend(chunks[:2])
        step = (len(chunks) - 2) / (max_count - 3)
        for i in range(max_count - 3):
            idx = int(2 + i * step)
            if idx < len(chunks) - 1:
                selected.append(chunks[idx])
        selected.append(chunks[-1])
        return selected

def build_prompt_passages(chunks: List[SourceChunk]) -> str:
    """
    Formats chunks into numbered passages with explicit IDs for model grounding.
    """
    formatted = []
    for c in chunks:
        formatted.append(f"--- [Passage ID: {c.id}] (Page {c.page_number}) ---\n{c.content}\n")
    return "\n".join(formatted)

async def extract_and_persist_concept_map(db: Session, document_id: int) -> ConceptMap:
    """
    Orchestrates passage selection, LLM inference, reference validation,
    and SQLite persistence. Ensures chunks are vectorized prior to processing.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise ValueError(f"Document {document_id} not found.")

    chunks = db.query(SourceChunk).filter(SourceChunk.document_id == document_id).order_by(SourceChunk.chunk_index).all()
    if not chunks:
        raise ValueError("Document has no extracted chunks to build a concept map from.")

    # Vector the files first: check if chunks have embeddings, if not, compute them now
    unvectorized = [c for c in chunks if not c.embedding]
    if unvectorized:
        logger.info(f"Computing vector representations for {len(unvectorized)} chunks before processing...")
        try:
            VectorService.vectorize_chunks(chunks, db)
        except Exception as e:
            logger.warning(f"Could not compute vectors prior to extraction: {e}")

    # Valid chunk ID set for grounding verification
    valid_chunk_ids: Set[int] = {c.id for c in chunks}

    selected_chunks = select_representative_chunks(chunks)
    passages_text = build_prompt_passages(selected_chunks)

    # Call Ollama
    raw_extraction: ExtractionResult = await generate_concept_map_from_passages(
        passages_text=passages_text,
        doc_title=doc.filename
    )

    # Clean existing map if any (user regenerating)
    existing_map = db.query(ConceptMap).filter(ConceptMap.document_id == document_id).first()
    if existing_map:
        db.delete(existing_map)
        db.commit()

    # Create new ConceptMap
    title = raw_extraction.title if raw_extraction.title else f"Concepts: {doc.filename}"
    new_map = ConceptMap(document_id=document_id, title=title)
    db.add(new_map)
    db.flush()

    # Create Nodes with Source Validation
    node_by_label: Dict[str, ConceptNode] = {}
    valid_nodes_created = 0

    for raw_concept in raw_extraction.concepts:
        # Validate source passage references
        referenced_chunk_ids = [cid for cid in raw_concept.source_passage_ids if cid in valid_chunk_ids]
        
        # Grounding rule: Must reference at least one valid source passage
        if not referenced_chunk_ids:
            logger.warning(f"Omitting concept '{raw_concept.label}' due to invalid source references: {raw_concept.source_passage_ids}")
            continue

        node = ConceptNode(
            concept_map_id=new_map.id,
            label=raw_concept.label.strip(),
            explanation=raw_concept.explanation.strip(),
            node_type=raw_concept.node_type if raw_concept.node_type in ["root", "concept", "subconcept"] else "concept"
        )
        db.add(node)
        db.flush()

        # Record node-to-source associations in SQLite
        for cid in referenced_chunk_ids:
            assoc = NodeSource(node_id=node.id, source_chunk_id=cid)
            db.add(assoc)

        node_by_label[raw_concept.label.strip().lower()] = node
        valid_nodes_created += 1

    # Fallback if strict validation filtered everything out (rare safety mechanism)
    if valid_nodes_created == 0 and chunks:
        logger.warning("No concepts passed strict validation; creating grounded baseline concept from primary chunk.")
        first_chunk = chunks[0]
        base_node = ConceptNode(
            concept_map_id=new_map.id,
            label="Core Document Concept",
            explanation=first_chunk.content[:200] + "...",
            node_type="root"
        )
        db.add(base_node)
        db.flush()
        db.add(NodeSource(node_id=base_node.id, source_chunk_id=first_chunk.id))
        node_by_label["core document concept"] = base_node

    # Create Edges
    for raw_edge in raw_extraction.relationships:
        src_label = raw_edge.source_label.strip().lower()
        tgt_label = raw_edge.target_label.strip().lower()

        src_node = node_by_label.get(src_label)
        tgt_node = node_by_label.get(tgt_label)

        if src_node and tgt_node and src_node.id != tgt_node.id:
            edge = ConceptEdge(
                concept_map_id=new_map.id,
                source_node_id=src_node.id,
                target_node_id=tgt_node.id,
                relationship_label=raw_edge.relationship.strip()
            )
            db.add(edge)

    db.commit()
    db.refresh(new_map)
    return new_map

def serialize_concept_map(concept_map: ConceptMap, db: Session) -> ConceptMapResponse:
    """
    Serializes a ConceptMap model into full ConceptMapResponse with node source IDs.
    """
    nodes_data = []
    for n in concept_map.nodes:
        source_ids = [ns.source_chunk_id for ns in n.source_associations]
        nodes_data.append(ConceptNodeResponse(
            id=n.id,
            concept_map_id=n.concept_map_id,
            label=n.label,
            explanation=n.explanation,
            node_type=n.node_type,
            source_chunk_ids=source_ids
        ))

    edges_data = [
        ConceptEdgeResponse(
            id=e.id,
            concept_map_id=e.concept_map_id,
            source_node_id=e.source_node_id,
            target_node_id=e.target_node_id,
            relationship=e.relationship_label
        )
        for e in concept_map.edges
    ]

    return ConceptMapResponse(
        id=concept_map.id,
        document_id=concept_map.document_id,
        title=concept_map.title,
        created_at=concept_map.created_at,
        nodes=nodes_data,
        edges=edges_data
    )
