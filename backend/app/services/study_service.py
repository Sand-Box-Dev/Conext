import json
import random
import re
from typing import Any

import httpx
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from ..models import Document, SourceChunk, StudyExam
from .ollama_service import DEFAULT_MODEL, OLLAMA_BASE_URL


class QuizItem(BaseModel):
    question: str
    options: list[str] = Field(min_length=4, max_length=4)
    answer_index: int = Field(ge=0, le=3)
    explanation: str
    passage_ids: list[int] = Field(min_length=1)

    @model_validator(mode="before")
    @classmethod
    def normalize_quiz_item(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        normalized = _normalize_passages(value)
        if "answer_index" not in normalized:
            answer = normalized.get("correct_answer", normalized.get("answer"))
            options = normalized.get("options", [])
            if isinstance(answer, str):
                answer_index = next((index for index, option in enumerate(options) if option.strip().casefold() == answer.strip().casefold()), None)
                if answer_index is None:
                    letter = re.match(r"^\s*([A-D])(?:[.):\s]|$)", answer, re.IGNORECASE)
                    if letter:
                        answer_index = ord(letter.group(1).upper()) - ord("A")
                if answer_index is not None:
                    normalized["answer_index"] = answer_index
        return normalized


class QuizOutput(BaseModel):
    items: list[QuizItem]

    @model_validator(mode="before")
    @classmethod
    def accept_item_list(cls, value: Any) -> Any:
        if isinstance(value, list):
            return {"items": value}
        if isinstance(value, dict) and "items" not in value:
            for key in ("multiple_choice_questions", "multiple_choice_items", "questions"):
                items = value.get(key)
                if isinstance(items, list):
                    return {**value, "items": items}
        return value


class Flashcard(BaseModel):
    front: str
    back: str
    passage_ids: list[int] = Field(min_length=1)

    @model_validator(mode="before")
    @classmethod
    def normalize_flashcard(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        normalized = _normalize_passages(value)
        if "front" not in normalized:
            normalized["front"] = normalized.get("question") or normalized.get("term")
        if "back" not in normalized:
            normalized["back"] = normalized.get("answer") or normalized.get("definition")
        return normalized


class FlashcardOutput(BaseModel):
    items: list[Flashcard]

    @model_validator(mode="before")
    @classmethod
    def accept_item_list(cls, value: Any) -> Any:
        return {"items": value} if isinstance(value, list) else value


class EssayTask(BaseModel):
    title: str
    prompt: str
    passage_ids: list[int] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def normalize_passage_ids(cls, value: Any) -> Any:
        return _normalize_passages(value)


class EssayTaskOutput(BaseModel):
    essay: EssayTask

    @model_validator(mode="before")
    @classmethod
    def accept_prompt_fields(cls, value: Any) -> Any:
        if not isinstance(value, dict) or "essay" in value:
            return value
        prompt = value.get("essay_prompt") or value.get("prompt")
        if prompt:
            return {
                "essay": {
                    "title": value.get("title") or "Reviewer essay",
                    "prompt": prompt,
                    "passage_ids": value.get("passage_ids") or value.get("source_passage_ids") or value.get("citations"),
                }
            }
        return value


def _normalize_passages(value: Any) -> Any:
    if not isinstance(value, dict):
        return value
    ids = value.get("passage_ids") or value.get("source_passage_ids") or value.get("citations")
    if ids is None:
        return {**value, "passage_ids": []}
    if not isinstance(ids, list):
        ids = [ids]
    normalized = []
    for passage in ids:
        if isinstance(passage, int):
            normalized.append(passage)
        else:
            match = re.search(r"\b(?:passage\s*)?(\d+)\b", str(passage), re.IGNORECASE)
            if match:
                normalized.append(int(match.group(1)))
    return {**value, "passage_ids": normalized}


class CriterionGrade(BaseModel):
    criterion: str
    score: int = Field(ge=0, le=100)
    feedback: str

    @model_validator(mode="before")
    @classmethod
    def normalize_grade_fields(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        normalized = dict(value)
        if "criterion" not in normalized:
            normalized["criterion"] = normalized.get("name") or normalized.get("category")
        if "score" not in normalized:
            normalized["score"] = normalized.get("points", normalized.get("earned_points"))
        if "feedback" not in normalized:
            normalized["feedback"] = normalized.get("comment") or normalized.get("evaluation") or ""
        if isinstance(normalized.get("score"), str):
            match = re.search(r"\d+", normalized["score"])
            if match:
                normalized["score"] = int(match.group(0))
        return normalized


class EssayGradeOutput(BaseModel):
    criteria: list[CriterionGrade]
    overall_feedback: str
    strengths: list[str]
    next_steps: list[str]
    passage_ids: list[int] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def normalize_grader_output(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        normalized = dict(value)
        raw_criteria = normalized.get("criteria")
        if raw_criteria is None:
            raw_criteria = normalized.get("grading") or normalized.get("rubric_scores") or normalized.get("scores")
        if isinstance(raw_criteria, dict) and isinstance(raw_criteria.get("criteria"), (dict, list)):
            raw_criteria = raw_criteria["criteria"]
        if isinstance(raw_criteria, dict):
            normalized_criteria = []
            for name, grade in raw_criteria.items():
                if isinstance(grade, dict):
                    normalized_criteria.append({"criterion": name, **grade})
                elif isinstance(grade, (int, float, str)):
                    normalized_criteria.append({"criterion": name, "score": grade, "feedback": ""})
            raw_criteria = normalized_criteria
        if raw_criteria is not None:
            normalized["criteria"] = raw_criteria
        if not normalized.get("next_steps"):
            normalized["next_steps"] = (
                normalized.get("areas_for_improvement")
                or normalized.get("areas_to_improve")
                or normalized.get("improvement_areas")
                or normalized.get("improvements")
                or normalized.get("recommendations")
                or normalized.get("suggestions")
                or []
            )
        if not normalized.get("strengths"):
            normalized["strengths"] = normalized.get("positive_aspects") or normalized.get("what_worked") or []
        if not normalized.get("overall_feedback"):
            normalized["overall_feedback"] = (
                normalized.get("summary")
                or normalized.get("general_feedback")
                or normalized.get("feedback")
                or "The essay was assessed against the built-in rubric."
            )
        for field_name in ("strengths", "next_steps"):
            if isinstance(normalized.get(field_name), str):
                normalized[field_name] = [normalized[field_name]]
        normalized = _normalize_passages(normalized)
        if isinstance(normalized.get("criteria"), list):
            canonical = {re.sub(r"[^a-z0-9]", "", item["criterion"].casefold()): item["criterion"] for item in ESSAY_RUBRIC}
            rubric_aliases = {
                "thesis": ESSAY_RUBRIC[0]["criterion"],
                "evidence": ESSAY_RUBRIC[1]["criterion"],
                "analysis": ESSAY_RUBRIC[2]["criterion"],
                "organization": ESSAY_RUBRIC[3]["criterion"],
                "clarity": ESSAY_RUBRIC[4]["criterion"],
                "grammar": ESSAY_RUBRIC[4]["criterion"],
                "mechanics": ESSAY_RUBRIC[4]["criterion"],
            }
            for criterion in normalized["criteria"]:
                if isinstance(criterion, dict) and isinstance(criterion.get("criterion"), str):
                    key = re.sub(r"[^a-z0-9]", "", criterion["criterion"].casefold())
                    criterion["criterion"] = canonical.get(key) or next(
                        (canonical_name for prefix, canonical_name in rubric_aliases.items() if key.startswith(prefix)),
                        criterion["criterion"],
                    )
        return normalized


ESSAY_RUBRIC = [
    {"criterion": "Thesis and focus", "points": 20, "description": "Presents a clear, relevant central claim and stays focused on the prompt."},
    {"criterion": "Evidence and source use", "points": 25, "description": "Uses accurate, relevant evidence from the reviewer and explains how it supports the claims."},
    {"criterion": "Analysis and development", "points": 25, "description": "Explains ideas with sound reasoning, depth, and meaningful connections rather than listing facts."},
    {"criterion": "Organization and coherence", "points": 15, "description": "Arranges ideas logically with clear paragraphs and transitions."},
    {"criterion": "Clarity and conventions", "points": 15, "description": "Communicates clearly with readable sentence structure, grammar, and word choice."},
]


def _source_context(db: Session, document_id: int, max_passages: int | None = 16) -> tuple[Document, list[SourceChunk]]:
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise LookupError("Reviewer not found.")
    if document.processing_status == "processing":
        raise ValueError("This reviewer is still being prepared. Try again in a moment.")
    if document.processing_status == "error":
        raise ValueError("This reviewer could not be processed. Upload a readable PDF, TXT, or Markdown file.")

    chunks = db.query(SourceChunk).filter(
        SourceChunk.document_id == document_id
    ).order_by(SourceChunk.chunk_index.asc()).all()
    if not chunks:
        raise ValueError("This reviewer has no readable source passages.")

    if max_passages is not None and len(chunks) > max_passages:
        indexes = {round(index * (len(chunks) - 1) / (max_passages - 1)) for index in range(max_passages)}
        chunks = [chunks[index] for index in sorted(indexes)]
    return document, chunks


def _source_batches(chunks: list[SourceChunk], max_chars: int = 8000, max_passages: int = 8) -> list[list[SourceChunk]]:
    batches: list[list[SourceChunk]] = []
    current: list[SourceChunk] = []
    current_chars = 0
    for chunk in chunks:
        chunk_chars = len(chunk.content)
        if current and (len(current) >= max_passages or current_chars + chunk_chars > max_chars):
            batches.append(current)
            current = []
            current_chars = 0
        current.append(chunk)
        current_chars += chunk_chars
    if current:
        batches.append(current)
    return batches


def _passages_text(chunks: list[SourceChunk]) -> str:
    return "\n\n".join(
        f"[Passage {chunk.id}, page {chunk.page_number}]\n{chunk.content}"
        for chunk in chunks
    )


async def _generate_structured(prompt: str, schema: type[BaseModel]) -> BaseModel:
    system_prompt = (
        "You are a careful study-material writer. Use only the supplied reviewer passages. "
        "Every question, answer, explanation, flashcard, and essay task must be supported by those passages. "
        "Cite evidence with exact passage IDs from the supplied text. Do not invent facts or citations. "
        "Return only JSON that matches the requested schema."
    )
    last_error: Exception | None = None
    for attempt in range(2):
        retry_note = "" if attempt == 0 else "\nYour previous response was invalid. Return valid JSON matching the schema exactly."
        payload = {
            "model": DEFAULT_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt + retry_note},
                {"role": "user", "content": prompt},
            ],
            "format": schema.model_json_schema(),
            "stream": False,
            "options": {"temperature": 0.2, "num_ctx": 8192},
        }
        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                response = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
                if response.is_error:
                    detail = response.text.strip().replace("\n", " ")[:600]
                    raise RuntimeError(
                        f"Ollama returned HTTP {response.status_code}"
                        + (f": {detail}" if detail else ".")
                    )
            content = response.json().get("message", {}).get("content", "").strip()
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content)
            if match:
                content = match.group(1).strip()
            else:
                match = re.search(r"(\{[\s\S]*\})", content)
                if match:
                    content = match.group(1).strip()
            return schema.model_validate(json.loads(content))
        except Exception as exc:
            if isinstance(exc, RuntimeError) and str(exc).startswith("Ollama returned HTTP"):
                raise
            last_error = exc
    raise RuntimeError(f"Could not create valid study material: {last_error}") from last_error


def _citation_refs(passage_ids: list[int], chunks: list[SourceChunk]) -> list[dict]:
    pages = {chunk.id: chunk.page_number for chunk in chunks}
    citations = [
        {"passage_id": passage_id, "page_number": pages[passage_id]}
        for passage_id in dict.fromkeys(passage_ids)
        if passage_id in pages
    ]
    if not citations:
        raise ValueError("The generated material could not be linked to source passages. Please try again.")
    return citations


async def generate_quiz(db: Session, document_id: int) -> dict:
    document, chunks = _source_context(db, document_id, max_passages=None)
    batches = _source_batches(chunks)
    items = []
    covered_ids: set[int] = set()
    for batch in batches:
        result = await _generate_structured(
            f"Create a comprehensive set of multiple-choice questions for the reviewer titled {document.filename!r}. "
            "Create at least one question for every supplied passage, and add questions for distinct concepts when useful. "
            "Each question must have exactly four plausible options and one unambiguously correct answer. "
            "Avoid trick questions and explain the correct answer briefly. Include the exact passage_ids that support each answer. "
            "Do not skip a passage that contains a definition, fact, process, example, or relationship.\n\n"
            f"Reviewer passages:\n{_passages_text(batch)}",
            QuizOutput,
        )
        valid_ids = {chunk.id for chunk in batch}
        for item in result.items:
            cited_ids = [item_id for item_id in item.passage_ids if item_id in valid_ids]
            data = item.model_dump(exclude={"passage_ids"})
            data["citations"] = _citation_refs(cited_ids, batch)
            covered_ids.update(cited_ids)
            items.append(data)

    missing = [chunk for chunk in chunks if chunk.id not in covered_ids]
    for batch in _source_batches(missing):
        result = await _generate_structured(
            "Create at least one clear multiple-choice question for every supplied passage. "
            "Use exactly four options, one correct answer, a brief explanation, and cite the exact supporting passage_ids.\n\n"
            f"Reviewer passages:\n{_passages_text(batch)}",
            QuizOutput,
        )
        valid_ids = {chunk.id for chunk in batch}
        for item in result.items:
            cited_ids = [item_id for item_id in item.passage_ids if item_id in valid_ids]
            data = item.model_dump(exclude={"passage_ids"})
            data["citations"] = _citation_refs(cited_ids, batch)
            covered_ids.update(cited_ids)
            items.append(data)
    if len(covered_ids) < len(chunks):
        raise ValueError("Some reviewer passages could not be covered in the quiz. Please try again.")
    return {"items": items}


async def generate_flashcards(db: Session, document_id: int) -> dict:
    document, chunks = _source_context(db, document_id, max_passages=None)
    batches = _source_batches(chunks)
    items = []
    covered_ids: set[int] = set()
    for batch in batches:
        result = await _generate_structured(
            f"Create a comprehensive set of useful flashcards for the reviewer titled {document.filename!r}. "
            "Create at least one flashcard for every supplied passage, and add cards for distinct concepts when useful. "
            "Each front should ask about one concept, relationship, process, or important fact. "
            "Each back should give a concise and accurate answer grounded in the supplied text. "
            "Include the exact passage_ids that directly support each answer. Do not skip testable material.\n\n"
            f"Reviewer passages:\n{_passages_text(batch)}",
            FlashcardOutput,
        )
        valid_ids = {chunk.id for chunk in batch}
        for item in result.items:
            cited_ids = [item_id for item_id in item.passage_ids if item_id in valid_ids]
            data = item.model_dump(exclude={"passage_ids"})
            data["citations"] = _citation_refs(cited_ids, batch)
            covered_ids.update(cited_ids)
            items.append(data)

    missing = [chunk for chunk in chunks if chunk.id not in covered_ids]
    for batch in _source_batches(missing):
        result = await _generate_structured(
            "Create at least one useful flashcard for every supplied passage. "
            "Each front asks a focused question, each back answers from the text, and passage_ids cites the exact source.\n\n"
            f"Reviewer passages:\n{_passages_text(batch)}",
            FlashcardOutput,
        )
        valid_ids = {chunk.id for chunk in batch}
        for item in result.items:
            cited_ids = [item_id for item_id in item.passage_ids if item_id in valid_ids]
            data = item.model_dump(exclude={"passage_ids"})
            data["citations"] = _citation_refs(cited_ids, batch)
            covered_ids.update(cited_ids)
            items.append(data)
    if len(covered_ids) < len(chunks):
        raise ValueError("Some reviewer passages could not be covered by flashcards. Please try again.")
    return {"items": items}


async def generate_essay_task(db: Session, document_id: int) -> dict:
    document, all_chunks = _source_context(db, document_id, max_passages=None)
    prior_exams = db.query(StudyExam).filter(
        StudyExam.document_id == document_id,
        StudyExam.mode == "essay",
    ).order_by(StudyExam.created_at.desc()).limit(12).all()
    previous_prompts: list[str] = []
    used_passage_ids: set[int] = set()
    for exam in prior_exams:
        try:
            content = json.loads(exam.content or "{}")
        except (TypeError, json.JSONDecodeError):
            continue
        previous_prompt = content.get("prompt")
        if previous_prompt:
            previous_prompts.append(str(previous_prompt)[:500])
        used_passage_ids.update(
            citation.get("passage_id")
            for citation in (content.get("citations") or [])
            if isinstance(citation, dict) and isinstance(citation.get("passage_id"), int)
        )

    unused_chunks = [chunk for chunk in all_chunks if chunk.id not in used_passage_ids]
    anchor = random.choice(unused_chunks or all_chunks)
    supporting_chunks = random.sample(
        [chunk for chunk in all_chunks if chunk.id != anchor.id],
        min(15, max(0, len(all_chunks) - 1)),
    )
    chunks = [anchor, *supporting_chunks]
    essay_angle = random.choice([
        "explain how the selected idea works and why it matters",
        "analyze a relationship between the selected idea and another reviewer concept",
        "evaluate the selected idea using evidence and reasoning from the reviewer",
        "apply the selected idea to a relevant example found in the reviewer",
        "compare the selected idea with a related concept in the reviewer",
    ])
    previous_prompt_text = "\n".join(f"- {prompt}" for prompt in previous_prompts) or "- None yet"
    result = await _generate_structured(
        f"Create one thoughtful essay prompt based on the reviewer titled {document.filename!r}. "
        f"Choose a fresh topic centered on the selected passage and {essay_angle}. "
        "Do not repeat, paraphrase, or ask about the same central topic as any earlier prompt below. "
        "The prompt must be answerable from the reviewer and require no outside research. "
        "Cite the exact passage_ids that support the topic.\n\n"
        f"Previously generated prompts to avoid:\n{previous_prompt_text}\n\n"
        f"Selected topic passage:\n[Passage {anchor.id}, page {anchor.page_number}]\n{anchor.content}\n\n"
        f"Reviewer passages:\n{_passages_text(chunks)}",
        EssayTaskOutput,
    )
    task = result.essay
    passage_ids = task.passage_ids
    if not passage_ids:
        prompt_terms = {term.casefold() for term in re.findall(r"[A-Za-z0-9]{4,}", task.prompt)}
        chunk_terms = {
            chunk.id: set(re.findall(r"[A-Za-z0-9]{4,}", chunk.content.casefold()))
            for chunk in chunks
        }
        ranked = sorted(
            chunks,
            key=lambda chunk: len(prompt_terms & chunk_terms[chunk.id]),
            reverse=True,
        )
        passage_ids = [chunk.id for chunk in ranked[:3]]
    return {
        "title": task.title,
        "prompt": task.prompt,
        "citations": _citation_refs(passage_ids, chunks),
        "rubric": ESSAY_RUBRIC,
    }


async def grade_essay(db: Session, document_id: int, prompt: str, essay: str) -> dict:
    document, chunks = _source_context(db, document_id)
    rubric_text = "\n".join(
        f"- {item['criterion']} ({item['points']} points): {item['description']}"
        for item in ESSAY_RUBRIC
    )
    result = await _generate_structured(
        f"Grade the learner's essay in response to this prompt: {prompt}\n\n"
        f"Essay:\n{essay}\n\n"
        "Use this built-in 100-point essay rubric. Score each criterion only from 0 to its listed maximum, "
        "and return one score for each criterion using the exact criterion names. The overall score is the sum. "
        "Be fair and specific; judge the quality of the writing and the use of the supplied reviewer evidence. "
        "Do not reward unsupported claims. Do not require facts that are absent from the reviewer. "
        "Cite passage IDs only when referring to relevant reviewer evidence. Include concise overall_feedback, "
        "strengths, and practical next_steps.\n\n"
        f"Rubric:\n{rubric_text}\n\nReviewer: {document.filename}\n\n"
        f"Reviewer passages:\n{_passages_text(chunks)}",
        EssayGradeOutput,
    )
    max_points = {item["criterion"]: item["points"] for item in ESSAY_RUBRIC}
    grades = []
    for criterion in ESSAY_RUBRIC:
        grade = next((item for item in result.criteria if item.criterion == criterion["criterion"]), None)
        if not grade:
            raise ValueError("The essay grader did not return every rubric criterion. Please try again.")
        score = min(max(grade.score, 0), max_points[criterion["criterion"]])
        grades.append({**criterion, "score": score, "feedback": grade.feedback})
    valid_ids = {chunk.id for chunk in chunks}
    cited_ids = [passage_id for passage_id in result.passage_ids if passage_id in valid_ids]
    recommendations = result.next_steps
    if not recommendations:
        weakest = sorted(grades, key=lambda item: item["score"] / item["points"])[:3]
        recommendations = [
            f"Focus on {item['criterion'].lower()}: {item['description']}"
            for item in weakest
        ]
    return {
        "score": sum(item["score"] for item in grades),
        "max_score": 100,
        "criteria": grades,
        "overall_feedback": result.overall_feedback,
        "strengths": result.strengths,
        "next_steps": recommendations,
        "recommendations": recommendations,
        "citations": [
            {"passage_id": passage_id, "page_number": next(chunk.page_number for chunk in chunks if chunk.id == passage_id)}
            for passage_id in dict.fromkeys(cited_ids)
        ],
    }
