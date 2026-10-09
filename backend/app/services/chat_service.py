import httpx
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..models import Document, SourceChunk
from .ollama_service import DEFAULT_MODEL, OLLAMA_BASE_URL


class Citation(BaseModel):
    passage_id: int
    page_number: int
    excerpt: str


class ReviewerAnswer(BaseModel):
    answer: str
    citations: list[Citation]


def search_reviewer_passages(
    db: Session, document_id: int, query: str, limit: int = 5
) -> tuple[Document, list[SourceChunk]]:
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise LookupError("Reviewer not found")

    passages = (
        db.query(SourceChunk)
        .filter(SourceChunk.document_id == document_id)
        .all()
    )
    if not passages:
        raise ValueError("This reviewer has no extracted passages yet.")

    # Rank the query together with this document's passages. This keeps retrieval
    # local and avoids depending on embeddings created during document upload.
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity

        matrix = TfidfVectorizer(stop_words="english").fit_transform(
            [query, *(passage.content for passage in passages)]
        )
        scores = cosine_similarity(matrix[0:1], matrix[1:]).ravel()
        ranked = sorted(range(len(passages)), key=lambda i: scores[i], reverse=True)
        matches = [passages[i] for i in ranked[:limit] if scores[i] > 0]
        if not matches:
            # Broad study prompts such as "summarize this reviewer" often have
            # no vocabulary in common with its text. Give the model the opening
            # passages instead of rejecting a valid question with HTTP 400.
            matches = sorted(passages, key=lambda passage: passage.chunk_index)[:limit]
    except ValueError:
        matches = []

    if not matches:
        raise ValueError("I could not find any readable passages in this reviewer.")
    return document, matches


async def ask_reviewer(
    db: Session,
    document_id: int,
    question: str,
    history: list[dict[str, str]] | None = None,
) -> ReviewerAnswer:
    question = question.strip()
    if not question:
        raise ValueError("Enter a question first.")
    if len(question) > 2000:
        raise ValueError("Questions must be 2,000 characters or fewer.")

    document, passages = search_reviewer_passages(db, document_id, question)
    sources = "\n\n".join(
        f"[Passage {p.id}, page {p.page_number}]\n{p.content}" for p in passages
    )
    messages = [
        {
            "role": "system",
            "content": (
                "Answer the learner's question using only the supplied reviewer passages. "
                "Use earlier conversation only to understand follow-up references, never as evidence. "
                "If the passages do not contain the answer, say so clearly. Do not add outside facts. "
                "Cite supporting passages inline using [Passage ID, p. page]."
            ),
        },
    ]
    for turn in (history or [])[-8:]:
        if turn.get("role") in {"user", "assistant"} and turn.get("content"):
            messages.append({"role": turn["role"], "content": turn["content"][:2000]})
    messages.append({
        "role": "user",
        "content": f"Reviewer: {document.filename}\n\nQuestion: {question}\n\nPassages:\n{sources}",
    })
    payload = {
        "model": DEFAULT_MODEL,
        "messages": messages,
        "stream": False,
        "options": {"temperature": 0.2, "num_ctx": 4096},
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
        response.raise_for_status()
    answer = response.json().get("message", {}).get("content", "").strip()
    if not answer:
        raise RuntimeError("The local model returned an empty answer.")

    return ReviewerAnswer(
        answer=answer,
        citations=[
            Citation(
                passage_id=p.id,
                page_number=p.page_number,
                excerpt=p.content[:280].strip(),
            )
            for p in passages
        ],
    )


async def stream_reviewer(
    db: Session,
    document_id: int,
    question: str,
    history: list[dict[str, str]] | None = None,
):
    """
    Streams tokens from Ollama using SSE chunks.
    Yields:
      - First: dict with event "citations"
      - During generation: dict with event "chunk", data = delta text
      - Finally: dict with event "done", data = full aggregated answer
    """
    import json

    question = question.strip()
    if not question:
        raise ValueError("Enter a question first.")
    if len(question) > 2000:
        raise ValueError("Questions must be 2,000 characters or fewer.")

    document, passages = search_reviewer_passages(db, document_id, question)
    sources = "\n\n".join(
        f"[Passage {p.id}, page {p.page_number}]\n{p.content}" for p in passages
    )
    citations_data = [
        {
            "passage_id": p.id,
            "page_number": p.page_number,
            "excerpt": p.content[:280].strip(),
        }
        for p in passages
    ]

    messages = [
        {
            "role": "system",
            "content": (
                "Answer the learner's question using only the supplied reviewer passages. "
                "Use earlier conversation only to understand follow-up references, never as evidence. "
                "If the passages do not contain the answer, say so clearly. Do not add outside facts. "
                "Cite supporting passages inline using [Passage ID, p. page]."
            ),
        },
    ]
    for turn in (history or [])[-8:]:
        if turn.get("role") in {"user", "assistant"} and turn.get("content"):
            messages.append({"role": turn["role"], "content": turn["content"][:2000]})
    messages.append({
        "role": "user",
        "content": f"Reviewer: {document.filename}\n\nQuestion: {question}\n\nPassages:\n{sources}",
    })

    payload = {
        "model": DEFAULT_MODEL,
        "messages": messages,
        "stream": True,
        "options": {"temperature": 0.2, "num_ctx": 4096},
    }

    full_answer_parts = []
    async with httpx.AsyncClient(timeout=180.0) as client:
        async with client.stream("POST", f"{OLLAMA_BASE_URL}/api/chat", json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    delta = data.get("message", {}).get("content", "")
                    if delta:
                        full_answer_parts.append(delta)
                        yield {"event": "chunk", "delta": delta}
                    if data.get("done", False):
                        break
                except json.JSONDecodeError:
                    continue

    full_answer = "".join(full_answer_parts).strip()
    yield {
        "event": "done",
        "answer": full_answer,
        "citations": citations_data,
    }
