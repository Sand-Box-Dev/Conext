import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import AIMemory, Document
from ..schemas import AIMemoryCreate, AIMemoryResponse
from ..auth import get_current_user_optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/memories", tags=["memories"])

@router.get("", response_model=List[AIMemoryResponse])
def list_memories(
    document_id: Optional[int] = None,
    memory_type: Optional[str] = None,
    db: Session = Depends(get_db),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    List persistent AI memories and reasoning context. Filter by document_id or type.
    """
    query = db.query(AIMemory)
    
    if user:
        # If logged in, prioritize user's own memories or global memories
        query = query.filter((AIMemory.user_id == user["id"]) | (AIMemory.user_id.is_(None)))
    
    if document_id:
        query = query.filter(AIMemory.document_id == document_id)
        
    if memory_type:
        query = query.filter(AIMemory.memory_type == memory_type)
        
    memories = query.order_by(AIMemory.created_at.desc()).all()
    return memories


@router.post("", response_model=AIMemoryResponse, status_code=status.HTTP_201_CREATED)
def create_memory(
    data: AIMemoryCreate,
    db: Session = Depends(get_db),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Create a new persistent AI memory or context snippet.
    """
    if data.document_id:
        doc = db.query(Document).filter(Document.id == data.document_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

    user_id = user["id"] if user else None

    memory = AIMemory(
        user_id=user_id,
        document_id=data.document_id,
        memory_type=data.memory_type,
        title=data.title.strip(),
        content=data.content.strip(),
        meta_info=data.meta_info
    )
    db.add(memory)
    db.commit()
    db.refresh(memory)
    return memory


@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_memory(
    memory_id: int,
    db: Session = Depends(get_db),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Deletes an AI memory entry.
    """
    query = db.query(AIMemory).filter(AIMemory.id == memory_id)
    if user:
        query = query.filter((AIMemory.user_id == user["id"]) | (AIMemory.user_id.is_(None)))
        
    memory = query.first()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
        
    db.delete(memory)
    db.commit()
    return None
