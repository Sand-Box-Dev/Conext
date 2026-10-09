import json
from datetime import datetime
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import get_current_user_optional
from ..database import get_db
from ..models import Document, StudyExam
from ..services.study_service import generate_essay_task, generate_flashcards, generate_quiz, grade_essay

router = APIRouter(prefix="/api/documents", tags=["study"])
library_router = APIRouter(prefix="/api/study", tags=["study"])
StudyModeName = Literal["quiz", "flashcards", "essay"]


class EssayGradeRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=3000)
    essay: str = Field(min_length=1, max_length=12000)
    exam_id: int | None = None


def _visible_documents(db: Session, user: Optional[dict[str, Any]]):
    query = db.query(Document).filter(Document.is_trashed.is_(False))
    if user:
        query = query.filter((Document.user_id == user["id"]) | Document.user_id.is_(None))
    else:
        query = query.filter(Document.user_id.is_(None))
    return query


def _get_visible_document(document_id: int, db: Session, user: Optional[dict[str, Any]]) -> Document:
    document = _visible_documents(db, user).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Reviewer not found")
    return document


def _serialize_exam(exam: StudyExam, document: Document) -> dict[str, Any]:
    return {
        "id": exam.id,
        "mode": exam.mode,
        "title": exam.title,
        "document_id": exam.document_id,
        "document_filename": document.filename,
        "created_at": exam.created_at.isoformat() if exam.created_at else datetime.utcnow().isoformat(),
        "content": json.loads(exam.content or "{}"),
    }


def _save_exam(db: Session, document: Document, mode: str, title: str, content: dict[str, Any]) -> dict[str, Any]:
    exam = StudyExam(document_id=document.id, mode=mode, title=title[:255], content=json.dumps(content))
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return _serialize_exam(exam, document)


@library_router.get("/{mode}")
def list_saved_exams(
    mode: StudyModeName,
    db: Session = Depends(get_db),
    user: Optional[dict[str, Any]] = Depends(get_current_user_optional),
):
    documents_query = _visible_documents(db, user).with_entities(Document.id, Document.filename)
    visible = {document_id: filename for document_id, filename in documents_query.all()}
    if not visible:
        return []
    exams = (
        db.query(StudyExam)
        .filter(StudyExam.mode == mode, StudyExam.document_id.in_(visible.keys()))
        .order_by(StudyExam.created_at.desc(), StudyExam.id.desc())
        .all()
    )
    return [
        {
            "id": exam.id,
            "mode": exam.mode,
            "title": exam.title,
            "document_id": exam.document_id,
            "document_filename": visible[exam.document_id],
            "created_at": exam.created_at.isoformat() if exam.created_at else datetime.utcnow().isoformat(),
            "content": json.loads(exam.content or "{}"),
        }
        for exam in exams
    ]


@library_router.delete("/exams/{exam_id}")
def delete_saved_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    user: Optional[dict[str, Any]] = Depends(get_current_user_optional),
):
    exam = db.query(StudyExam).filter(StudyExam.id == exam_id).first()
    if not exam or not _visible_documents(db, user).filter(Document.id == exam.document_id).first():
        raise HTTPException(status_code=404, detail="Saved study set not found")
    db.delete(exam)
    db.commit()
    return {"deleted": True}


@router.post("/{document_id}/study/quiz")
async def create_quiz(
    document_id: int,
    db: Session = Depends(get_db),
    user: Optional[dict[str, Any]] = Depends(get_current_user_optional),
):
    document = _get_visible_document(document_id, db, user)
    try:
        content = await generate_quiz(db, document_id)
        return _save_exam(db, document, "quiz", f"{len(content['items'])}-question quiz · {document.filename}", content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not generate the quiz: {exc}") from exc


@router.post("/{document_id}/study/flashcards")
async def create_flashcards(
    document_id: int,
    db: Session = Depends(get_db),
    user: Optional[dict[str, Any]] = Depends(get_current_user_optional),
):
    document = _get_visible_document(document_id, db, user)
    try:
        content = await generate_flashcards(db, document_id)
        return _save_exam(db, document, "flashcards", f"{len(content['items'])} flashcards · {document.filename}", content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not generate flashcards: {exc}") from exc


@router.post("/{document_id}/study/essay")
async def create_essay_task(
    document_id: int,
    db: Session = Depends(get_db),
    user: Optional[dict[str, Any]] = Depends(get_current_user_optional),
):
    document = _get_visible_document(document_id, db, user)
    try:
        content = await generate_essay_task(db, document_id)
        return _save_exam(db, document, "essay", content["title"], content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not generate an essay prompt: {exc}") from exc


@router.post("/{document_id}/study/essay/grade")
async def grade_essay_response(
    document_id: int,
    request: EssayGradeRequest,
    db: Session = Depends(get_db),
    user: Optional[dict[str, Any]] = Depends(get_current_user_optional),
):
    document = _get_visible_document(document_id, db, user)
    try:
        grade = await grade_essay(db, document_id, request.prompt, request.essay)
        if request.exam_id is not None:
            exam = db.query(StudyExam).filter(
                StudyExam.id == request.exam_id,
                StudyExam.document_id == document_id,
                StudyExam.mode == "essay",
            ).first()
            if not exam:
                raise HTTPException(status_code=404, detail="Saved essay not found")
            content = json.loads(exam.content or "{}")
            content.update({"submission": request.essay, "grade": grade})
            exam.content = json.dumps(content)
            db.commit()
        return grade
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not grade the essay: {exc}") from exc
