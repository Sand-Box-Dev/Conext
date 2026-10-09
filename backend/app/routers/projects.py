from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Document, ProjectFolder

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Folder name cannot be blank.")
        return value


class ProjectResponse(BaseModel):
    id: int
    name: str
    created_at: datetime
    document_count: int


@router.get("", response_model=list[ProjectResponse])
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(ProjectFolder).order_by(ProjectFolder.created_at.desc()).all()
    project_ids = [project.id for project in projects]
    document_counts = dict(
        db.query(Document.project_id, func.count(Document.id))
        .filter(Document.project_id.in_(project_ids), Document.is_trashed.is_(False))
        .group_by(Document.project_id)
        .all()
    ) if project_ids else {}
    return [
        ProjectResponse(
            id=project.id,
            name=project.name,
            created_at=project.created_at,
            document_count=document_counts.get(project.id, 0),
        )
        for project in projects
    ]


@router.post("", response_model=ProjectResponse, status_code=201)
def create_project(request: ProjectCreate, db: Session = Depends(get_db)):
    existing = db.query(ProjectFolder).filter(ProjectFolder.name.ilike(request.name)).first()
    if existing:
        raise HTTPException(status_code=409, detail="A folder with that name already exists.")

    project = ProjectFolder(name=request.name)
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectResponse(
        id=project.id,
        name=project.name,
        created_at=project.created_at,
        document_count=0,
    )


@router.patch("/{project_id}", response_model=ProjectResponse)
def rename_project(project_id: int, request: ProjectCreate, db: Session = Depends(get_db)):
    project = db.query(ProjectFolder).filter(ProjectFolder.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project folder not found.")

    existing = db.query(ProjectFolder).filter(
        ProjectFolder.id != project_id,
        func.lower(ProjectFolder.name) == request.name.lower(),
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="A folder with that name already exists.")

    project.name = request.name
    db.commit()
    db.refresh(project)
    document_count = db.query(Document).filter(
        Document.project_id == project.id,
        Document.is_trashed.is_(False),
    ).count()
    return ProjectResponse(
        id=project.id,
        name=project.name,
        created_at=project.created_at,
        document_count=document_count,
    )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(ProjectFolder).filter(ProjectFolder.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project folder not found.")

    db.query(Document).filter(Document.project_id == project_id).update(
        {Document.project_id: None}, synchronize_session=False
    )
    db.delete(project)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
