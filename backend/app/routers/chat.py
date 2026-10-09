from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import json
import asyncio

from ..database import get_db, get_db_session
from ..models import ChatMessage, Document
from ..services.chat_service import ask_reviewer, stream_reviewer

router = APIRouter(prefix="/api/documents", tags=["chat"])


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


class SavedChatMessage(BaseModel):
    id: int
    role: str
    content: str
    citations: list[dict] = Field(default_factory=list)


class ChatAnswerResponse(BaseModel):
    message_id: int
    answer: str
    citations: list[dict] = Field(default_factory=list)


@router.get("/{document_id}/chat", response_model=list[SavedChatMessage])
def get_reviewer_chat(document_id: int, db: Session = Depends(get_db)):
    if not db.query(Document.id).filter(Document.id == document_id).first():
        raise HTTPException(status_code=404, detail="Reviewer not found")
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.document_id == document_id)
        .order_by(ChatMessage.id.asc())
        .all()
    )
    return [
        SavedChatMessage(
            id=message.id,
            role=message.role,
            content=message.content,
            citations=json.loads(message.citations or "[]"),
        )
        for message in messages
    ]


@router.post("/{document_id}/chat/stream")
async def chat_about_reviewer_stream(
    document_id: int, request: ChatRequest, db: Session = Depends(get_db)
):
    """
    Streams assistant response chunks in real-time via Server-Sent Events (SSE).
    Persists user & assistant chat messages upon stream completion.
    """
    if not db.query(Document.id).filter(Document.id == document_id).first():
        raise HTTPException(status_code=404, detail="Reviewer not found")

    previous = (
        db.query(ChatMessage)
        .filter(ChatMessage.document_id == document_id)
        .order_by(ChatMessage.id.desc())
        .limit(8)
        .all()
    )
    history = [
        {"role": message.role, "content": message.content}
        for message in reversed(previous)
    ]

    async def event_generator():
        accumulated_answer = ""
        citations = []
        try:
            async for item in stream_reviewer(db, document_id, request.question, history):
                event_type = item.get("event")
                if event_type == "citations":
                    citations = item.get("citations", [])
                    yield f"event: citations\ndata: {json.dumps(citations)}\n\n"
                elif event_type == "chunk":
                    delta = item.get("delta", "")
                    accumulated_answer += delta
                    yield f"event: chunk\ndata: {json.dumps({'delta': delta})}\n\n"
                elif event_type == "done":
                    final_answer = item.get("answer") or accumulated_answer
                    citations = item.get("citations", citations)
                    # Save messages to database (using independent session)
                    save_db = get_db_session()
                    try:
                        user_message = ChatMessage(
                            document_id=document_id,
                            role="user",
                            content=request.question.strip(),
                        )
                        assistant_message = ChatMessage(
                            document_id=document_id,
                            role="assistant",
                            content=final_answer.strip(),
                            citations=json.dumps(citations),
                        )
                        save_db.add_all([user_message, assistant_message])
                        save_db.commit()
                        save_db.refresh(assistant_message)
                        msg_id = assistant_message.id
                    except Exception as save_err:
                        save_db.rollback()
                        msg_id = 0
                    finally:
                        save_db.close()

                    yield f"event: done\ndata: {json.dumps({'message_id': msg_id, 'answer': final_answer, 'citations': citations})}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'detail': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{document_id}/chat", response_model=ChatAnswerResponse)
async def chat_about_reviewer(
    document_id: int, request: ChatRequest, db: Session = Depends(get_db)
):
    try:
        if not db.query(Document.id).filter(Document.id == document_id).first():
            raise LookupError("Reviewer not found")
        # Pass the latest saved turns to support follow-up questions.
        previous = (
            db.query(ChatMessage)
            .filter(ChatMessage.document_id == document_id)
            .order_by(ChatMessage.id.desc())
            .limit(8)
            .all()
        )
        history = [
            {"role": message.role, "content": message.content}
            for message in reversed(previous)
        ]
        answer = await ask_reviewer(db, document_id, request.question, history)

        user_message = ChatMessage(
            document_id=document_id,
            role="user",
            content=request.question.strip(),
        )
        assistant_message = ChatMessage(
            document_id=document_id,
            role="assistant",
            content=answer.answer,
            citations=json.dumps([citation.model_dump() for citation in answer.citations]),
        )
        db.add_all([user_message, assistant_message])
        db.commit()
        db.refresh(assistant_message)
        return ChatAnswerResponse(
            message_id=assistant_message.id,
            answer=assistant_message.content,
            citations=json.loads(assistant_message.citations or "[]"),
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not get an answer from local Ollama: {exc}") from exc

