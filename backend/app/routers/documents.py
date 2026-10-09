import os
import shutil
from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Document, SourceChunk, ConceptMap, ProjectFolder
from ..schemas import DocumentResponse, ConceptMapResponse
from ..services.document_service import process_and_store_document
from ..services.concept_service import extract_and_persist_concept_map, serialize_concept_map

router = APIRouter(prefix="/api/documents", tags=["documents"])


class ProjectAssignment(BaseModel):
    project_id: int | None


@router.patch("/{document_id}/project")
def assign_project(document_id: int, request: ProjectAssignment, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Reviewer not found")
    if request.project_id is not None:
        project = db.query(ProjectFolder).filter(ProjectFolder.id == request.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project folder not found")

    document.project_id = request.project_id
    db.commit()
    return {"document_id": document.id, "project_id": document.project_id}

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

@router.get("", response_model=List[DocumentResponse])
def list_documents(db: Session = Depends(get_db)):
    docs = db.query(Document).order_by(Document.uploaded_at.desc()).all()
    results = []
    for d in docs:
        chunk_count = db.query(SourceChunk).filter(SourceChunk.document_id == d.id).count()
        has_map = db.query(ConceptMap).filter(ConceptMap.document_id == d.id).first() is not None
        results.append(DocumentResponse(
            id=d.id,
            filename=d.filename,
            uploaded_at=d.uploaded_at,
            processing_status=d.processing_status,
            chunk_count=chunk_count,
            has_map=has_map,
            project_id=d.project_id,
        ))
    return results

@router.post("", response_model=DocumentResponse)
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".pdf", ".txt", ".md"]:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Only PDF and TXT documents are supported."
        )

    # Read content to check size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum allowed size of 10MB ({len(contents) / (1024*1024):.2f}MB)."
        )

    if len(contents) == 0:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is completely empty."
        )

    # Save to disk
    file_path = os.path.join(UPLOAD_DIR, filename)
    # Handle duplicates if filename already exists
    base, extension = os.path.splitext(filename)
    counter = 1
    while os.path.exists(file_path):
        file_path = os.path.join(UPLOAD_DIR, f"{base}_{counter}{extension}")
        counter += 1

    with open(file_path, "wb") as f:
        f.write(contents)

    # Create document record
    doc = Document(
        filename=os.path.basename(file_path),
        file_path=file_path,
        processing_status="processing"
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    try:
        chunk_count = process_and_store_document(db, doc.id, file_path, doc.filename)
        doc.processing_status = "ready"
        db.commit()
        db.refresh(doc)
        return DocumentResponse(
            id=doc.id,
            filename=doc.filename,
            uploaded_at=doc.uploaded_at,
            processing_status=doc.processing_status,
            chunk_count=chunk_count,
            has_map=False
        )
    except Exception as e:
        doc.processing_status = "error"
        db.commit()
        raise HTTPException(
            status_code=422,
            detail=f"Failed to process document: {str(e)}"
        )

@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    chunk_count = db.query(SourceChunk).filter(SourceChunk.document_id == doc.id).count()
    has_map = db.query(ConceptMap).filter(ConceptMap.document_id == doc.id).first() is not None
    return DocumentResponse(
        id=doc.id,
        filename=doc.filename,
        uploaded_at=doc.uploaded_at,
        processing_status=doc.processing_status,
        chunk_count=chunk_count,
        has_map=has_map,
        project_id=doc.project_id,
    )

@router.post("/{document_id}/generate", response_model=ConceptMapResponse)
async def generate_map(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        concept_map = await extract_and_persist_concept_map(db, document_id)
        return serialize_concept_map(concept_map, db)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to extract concept map: {str(e)}"
        )

@router.get("/{document_id}/map", response_model=ConceptMapResponse)
def get_document_map(document_id: int, db: Session = Depends(get_db)):
    concept_map = db.query(ConceptMap).filter(ConceptMap.document_id == document_id).first()
    if not concept_map:
        raise HTTPException(status_code=404, detail="No concept map has been generated yet for this document.")
    
    return serialize_concept_map(concept_map, db)
