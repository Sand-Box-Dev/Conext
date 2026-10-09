from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
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
    return [
        ProjectResponse(
            id=project.id,
            name=project.name,
            created_at=project.created_at,
            document_count=db.query(Document).filter(
                Document.project_id == project.id,
                Document.is_trashed.is_(False),
            ).count(),
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
