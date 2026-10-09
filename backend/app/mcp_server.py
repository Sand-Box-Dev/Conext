"""Local stdio MCP server exposing read-only Conext reviewer tools."""

from mcp.server.fastmcp import FastMCP

from .database import SessionLocal
from .models import Document
from .services.chat_service import ask_reviewer as answer_reviewer, search_reviewer_passages

mcp = FastMCP("Conext Reviewer")


@mcp.tool()
def list_reviewers() -> list[dict]:
    """List uploaded reviewers and their IDs for use with other Conext tools."""
    with SessionLocal() as db:
        documents = db.query(Document).order_by(Document.uploaded_at.desc()).all()
        return [
            {"document_id": d.id, "filename": d.filename, "status": d.processing_status}
            for d in documents
        ]


@mcp.tool()
def search_reviewer(document_id: int, query: str) -> list[dict]:
    """Find relevant source passages in one uploaded reviewer, with page citations."""
    with SessionLocal() as db:
        _, passages = search_reviewer_passages(db, document_id, query)
        return [
            {"passage_id": p.id, "page_number": p.page_number, "text": p.content}
            for p in passages
        ]


@mcp.tool()
async def ask_reviewer(document_id: int, question: str) -> dict:
    """Answer a question using only a reviewer's passages and return citations."""
    with SessionLocal() as db:
        answer = await answer_reviewer(db, document_id, question)
        return answer.model_dump()


if __name__ == "__main__":
    mcp.run(transport="stdio")
