import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.database import Base
from backend.app.models import Document, SourceChunk, ConceptMap, ConceptNode, ConceptEdge, NodeSource
from backend.app.services.document_service import chunk_text, extract_text_from_txt, process_and_store_document
from backend.app.schemas import RawConcept, RawRelationship, ExtractionResult
from backend.app.services.concept_service import select_representative_chunks, build_prompt_passages

# Setup test in-memory SQLite
TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture
def db_session():
    engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()

def test_chunking_logic():
    text = (
        "Photosynthesis is the biological process by which plants convert light into chemical energy.\n\n"
        "Chlorophyll absorbs blue and red light while reflecting green wavelengths.\n\n"
        "The light-dependent reactions take place within the thylakoid membranes of chloroplasts."
    )
    chunks = chunk_text(page_num=1, text=text, max_chunk_size=100)
    assert len(chunks) >= 2
    assert chunks[0]["page_number"] == 1
    assert "Photosynthesis" in chunks[0]["content"]

def test_document_extraction_and_chunk_storage(tmp_path, db_session):
    test_file = tmp_path / "biology_lesson.txt"
    test_content = (
        "Cellular respiration is a metabolic pathway that breaks down glucose and produces ATP.\n\n"
        "The stages of cellular respiration include glycolysis, pyruvate oxidation, the citric acid cycle, and oxidative phosphorylation.\n\n"
        "Mitochondria are often referred to as the powerhouses of the cell because most ATP is produced here."
    )
    test_file.write_text(test_content, encoding="utf-8")

    doc = Document(filename="biology_lesson.txt", file_path=str(test_file), processing_status="ready")
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)

    count = process_and_store_document(db_session, doc.id, str(test_file), "biology_lesson.txt")
    assert count >= 1

    stored_chunks = db_session.query(SourceChunk).filter(SourceChunk.document_id == doc.id).all()
    assert len(stored_chunks) == count
    assert any("Cellular respiration" in c.content for c in stored_chunks)
    assert any("Mitochondria" in c.content for c in stored_chunks)

def test_source_grounding_validation(db_session):
    # Setup document and chunks
    doc = Document(filename="test_grounding.txt", file_path="dummy.txt", processing_status="ready")
    db_session.add(doc)
    db_session.commit()

    chunk1 = SourceChunk(document_id=doc.id, page_number=1, chunk_index=0, content="Newton's first law defines inertia.")
    chunk2 = SourceChunk(document_id=doc.id, page_number=1, chunk_index=1, content="Newton's second law connects force, mass, and acceleration (F = ma).")
    db_session.add_all([chunk1, chunk2])
    db_session.commit()

    valid_chunk_ids = {chunk1.id, chunk2.id}

    # Concept referencing valid chunk
    valid_concept = RawConcept(
        label="Inertia",
        explanation="The tendency of an object to resist changes in its state of motion.",
        node_type="concept",
        source_passage_ids=[chunk1.id]
    )
    # Concept referencing hallucinated chunk ID
    hallucinated_concept = RawConcept(
        label="Quantum Mechanics",
        explanation="Study of subatomic particles.",
        node_type="concept",
        source_passage_ids=[99999]  # Not in database!
    )

    # Validate
    valid_refs = [cid for cid in valid_concept.source_passage_ids if cid in valid_chunk_ids]
    assert len(valid_refs) == 1
    assert valid_refs[0] == chunk1.id

    hallucinated_refs = [cid for cid in hallucinated_concept.source_passage_ids if cid in valid_chunk_ids]
    assert len(hallucinated_refs) == 0  # Must be rejected!

def test_concept_map_persistence_and_retrieval(db_session):
    doc = Document(filename="physics.txt", file_path="dummy.txt", processing_status="ready")
    db_session.add(doc)
    db_session.commit()

    chunk = SourceChunk(document_id=doc.id, page_number=1, chunk_index=0, content="Gravity attracts masses toward one another.")
    db_session.add(chunk)
    db_session.commit()

    cmap = ConceptMap(document_id=doc.id, title="Physics Concepts")
    db_session.add(cmap)
    db_session.commit()

    node1 = ConceptNode(concept_map_id=cmap.id, label="Gravity", explanation="A fundamental interaction attracting objects.", node_type="root")
    node2 = ConceptNode(concept_map_id=cmap.id, label="Mass", explanation="Quantity of matter.", node_type="concept")
    db_session.add_all([node1, node2])
    db_session.commit()

    # Link source to node1
    assoc = NodeSource(node_id=node1.id, source_chunk_id=chunk.id)
    edge = ConceptEdge(concept_map_id=cmap.id, source_node_id=node1.id, target_node_id=node2.id, relationship_label="acts upon")
    db_session.add_all([assoc, edge])
    db_session.commit()

    # Query back
    saved_map = db_session.query(ConceptMap).filter(ConceptMap.document_id == doc.id).first()
    assert saved_map is not None
    assert len(saved_map.nodes) == 2
    assert len(saved_map.edges) == 1
    assert saved_map.edges[0].relationship_label == "acts upon"
    assert len(node1.source_associations) == 1
    assert node1.source_associations[0].source_chunk_id == chunk.id

def test_chunk_vectorization_and_selection(db_session):
    from backend.app.services.vector_service import VectorService
    
    doc = Document(filename="ecology.txt", file_path="dummy.txt", processing_status="ready")
    db_session.add(doc)
    db_session.commit()

    chunk1 = SourceChunk(document_id=doc.id, page_number=1, chunk_index=0, content="Ecology is the study of interactions among living organisms and their environment.")
    chunk2 = SourceChunk(document_id=doc.id, page_number=1, chunk_index=1, content="Abiotic factors include solar radiation, temperature, atmospheric gases, and soil moisture.")
    chunk3 = SourceChunk(document_id=doc.id, page_number=2, chunk_index=2, content="Biotic factors encompass all biological producers, consumers, and decomposers.")
    
    db_session.add_all([chunk1, chunk2, chunk3])
    db_session.commit()

    # Vectorize chunks
    chunks = [chunk1, chunk2, chunk3]
    VectorService.vectorize_chunks(chunks, db_session)

    # Assert embeddings were calculated and stored
    assert chunk1.embedding is not None
    assert "ecology" in chunk1.embedding or "study" in chunk1.embedding
    assert chunk2.embedding is not None

    # Test top semantic selection
    selected = select_representative_chunks(chunks, max_count=2)
    assert len(selected) == 2
    assert selected[0].id == chunk1.id
