import os
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Document, SourceChunk, ConceptMap, ProjectFolder, ChatMessage
from ..schemas import DocumentResponse, ConceptMapResponse
from ..services.document_service import process_and_store_document
from ..services.concept_service import extract_and_persist_concept_map, serialize_concept_map
from ..auth import get_current_user_optional

router = APIRouter(prefix="/api/documents", tags=["documents"])
logger = logging.getLogger(__name__)


class ProjectAssignment(BaseModel):
    project_id: int | None


def _visible_document_query(db: Session, user: Optional[Dict[str, Any]]):
    query = db.query(Document)
    if user:
        query = query.filter((Document.user_id == user["id"]) | (Document.user_id.is_(None)))
    else:
        query = query.filter(Document.user_id.is_(None))
    return query


def _get_visible_document(document_id: int, db: Session, user: Optional[Dict[str, Any]]) -> Document:
    document = _visible_document_query(db, user).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Reviewer not found")
    return document


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
def list_documents(
    db: Session = Depends(get_db),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    docs = _visible_document_query(db, user).filter(
        Document.is_trashed.is_(False)
    ).order_by(Document.uploaded_at.desc()).all()
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
            user_id=d.user_id
        ))
    return results


@router.get("/trash", response_model=List[DocumentResponse])
def list_trashed_documents(
    db: Session = Depends(get_db),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    docs = _visible_document_query(db, user).filter(
        Document.is_trashed.is_(True)
    ).order_by(Document.uploaded_at.desc()).all()
    return [
        DocumentResponse(
            id=document.id,
            filename=document.filename,
            uploaded_at=document.uploaded_at,
            processing_status=document.processing_status,
            chunk_count=db.query(SourceChunk).filter(SourceChunk.document_id == document.id).count(),
            has_map=db.query(ConceptMap).filter(ConceptMap.document_id == document.id).first() is not None,
            project_id=document.project_id,
            user_id=document.user_id,
        )
        for document in docs
    ]


@router.post("/{document_id}/trash", status_code=status.HTTP_204_NO_CONTENT)
def move_document_to_trash(
    document_id: int,
    db: Session = Depends(get_db),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    document = _get_visible_document(document_id, db, user)
    document.is_trashed = True
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{document_id}/restore", status_code=status.HTTP_204_NO_CONTENT)
def restore_document(
    document_id: int,
    db: Session = Depends(get_db),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    document = _get_visible_document(document_id, db, user)
    document.is_trashed = False
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def permanently_delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    document = _get_visible_document(document_id, db, user)
    if not document.is_trashed:
        raise HTTPException(status_code=409, detail="Move the reviewer to Trash before deleting it forever.")

    file_path = os.path.abspath(document.file_path)
    db.query(ChatMessage).filter(ChatMessage.document_id == document.id).delete(synchronize_session=False)
    db.delete(document)
    db.commit()

    try:
        if os.path.commonpath([UPLOAD_DIR, file_path]) == UPLOAD_DIR and os.path.isfile(file_path):
            os.remove(file_path)
    except (OSError, ValueError) as error:
        logger.warning("Removed reviewer %s from the database but could not remove its file: %s", document_id, error)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
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
    base, extension = os.path.splitext(filename)
    counter = 1
    while os.path.exists(file_path):
        file_path = os.path.join(UPLOAD_DIR, f"{base}_{counter}{extension}")
        counter += 1

    with open(file_path, "wb") as f:
        f.write(contents)

    user_id = user["id"] if user else None

    # Create document record
    doc = Document(
        filename=os.path.basename(file_path),
        file_path=file_path,
        processing_status="processing",
        user_id=user_id
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
            has_map=False,
            user_id=doc.user_id
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
        user_id=doc.user_id
    )

@router.post("/{document_id}/generate", response_model=ConceptMapResponse)
async def generate_map(
    document_id: int,
    db: Session = Depends(get_db),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    user_id = user["id"] if user else doc.user_id

    try:
        concept_map = await extract_and_persist_concept_map(db, document_id, user_id=user_id)
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
