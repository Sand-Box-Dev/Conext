import os
import pymupdf
from typing import List, Tuple
from sqlalchemy.orm import Session
from ..models import Document, SourceChunk

CHUNK_SIZE = 1200
CHUNK_OVERLAP = 150

def extract_text_from_pdf(file_path: str) -> List[Tuple[int, str]]:
    """
    Extracts text from each page of a PDF using PyMuPDF.
    Returns a list of (page_number, text) tuples. Page numbers are 1-indexed.
    """
    results = []
    doc = pymupdf.open(file_path)
    try:
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            text = page.get_text("text").strip()
            if text:
                results.append((page_idx + 1, text))
    finally:
        doc.close()
    return results

def extract_text_from_txt(file_path: str) -> List[Tuple[int, str]]:
    """
    Reads plain text file. Since plain text doesn't have native pages,
    we group it into logical pseudo-pages (~2000 chars per page).
    """
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        content = f.read().strip()
    
    if not content:
        return []

    pseudo_page_size = 2000
    results = []
    for i, start_idx in enumerate(range(0, len(content), pseudo_page_size)):
        page_text = content[start_idx:start_idx + pseudo_page_size].strip()
        if page_text:
            results.append((i + 1, page_text))
    return results

def chunk_text(page_num: int, text: str, max_chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[dict]:
    """
    Splits page text into manageable chunks respecting sentence/paragraph boundaries.
    """
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = ""

    for para in paragraphs:
        cleaned_para = para.strip()
        if not cleaned_para:
            continue
        
        if len(current_chunk) + len(cleaned_para) + 2 <= max_chunk_size:
            current_chunk = f"{current_chunk}\n\n{cleaned_para}".strip()
        else:
            if current_chunk:
                chunks.append(current_chunk)
            
            # If paragraph itself is longer than max_chunk_size, split by sentences/lines
            if len(cleaned_para) > max_chunk_size:
                start = 0
                while start < len(cleaned_para):
                    end = min(start + max_chunk_size, len(cleaned_para))
                    sub_str = cleaned_para[start:end].strip()
                    if sub_str:
                        chunks.append(sub_str)
                    start += (max_chunk_size - overlap)
                current_chunk = ""
            else:
                current_chunk = cleaned_para

    if current_chunk:
        chunks.append(current_chunk)

    return [{"page_number": page_num, "content": c} for c in chunks if len(c.strip()) > 30]

def process_and_store_document(db: Session, document_id: int, file_path: str, filename: str) -> int:
    """
    Extracts text from the uploaded file, chunks it, and persists SourceChunk rows in SQLite.
    Returns total chunk count.
    """
    ext = os.path.splitext(filename)[1].lower()
    
    if ext == ".pdf":
        page_texts = extract_text_from_pdf(file_path)
    elif ext in [".txt", ".md"]:
        page_texts = extract_text_from_txt(file_path)
    else:
        raise ValueError(f"Unsupported file format: {ext}")

    if not page_texts:
        raise ValueError("Document contains no readable text or is an empty/scanned file.")

    all_chunks = []
    chunk_idx = 0
    for page_num, text in page_texts:
        page_chunks = chunk_text(page_num, text)
        for c in page_chunks:
            chunk = SourceChunk(
                document_id=document_id,
                page_number=c["page_number"],
                chunk_index=chunk_idx,
                content=c["content"]
            )
            db.add(chunk)
            all_chunks.append(chunk)
            chunk_idx += 1

    if not all_chunks:
        raise ValueError("Could not extract any substantial passages from the document.")

    db.commit()

    # Vector the files / passages first before concept map extraction
    try:
        from .vector_service import VectorService
        VectorService.vectorize_chunks(all_chunks, db)
    except Exception as e:
        # Log warning but do not break extraction if vectorization encounters non-fatal issue
        import logging
        logging.getLogger(__name__).warning(f"Vectorization warning during document processing: {e}")

    return len(all_chunks)
