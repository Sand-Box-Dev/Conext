# What Runs Locally

This document outlines all processes, operations, and data persistence layers in **Notepad AI** that execute strictly on the user's local machine without relying on external network requests or internet access.

---

## 1. Local Database & State Storage
* **SQLite Offline Database (`backend/data/offline_data.db`)**:
  - Full relational persistence of projects, folders, reviewers, and document metadata.
  - Stores extracted passage chunks (`source_chunks`), concept graph nodes (`concept_nodes`), relationships (`concept_edges`), and citation bindings (`node_sources`).
  - Stores all chat histories (`chat_messages`), study sets (`study_exams`), and user memories (`ai_memories`).
* **Offline Authentication Cache (`backend/data/offline_auth.db`)**:
  - Stores local user credential records with secure `bcrypt` salted password hashing.
  - Generates and verifies offline bearer tokens (`offline_<user_id>_<uuid>`) to allow sessions without cloud access.
* **Local Disk Storage (`backend/data/uploads/`)**:
  - Raw document files (`.pdf`, `.txt`, `.md`) are saved and served locally from disk via `FileResponse`.

---

## 2. Document Processing & Ingestion Pipeline
* **Text Extraction**:
  - PyMuPDF (`fitz`) parses PDF binary streams and extracts raw text per page directly on the CPU.
  - Standard UTF-8 stream readers handle `.txt` and `.md` files.
* **Passage Segmentation**:
  - Paragraph-boundary chunking runs entirely in Python with configurable chunk sizes (~1,200 characters) and overlaps (150 characters).
* **Sparse Vectorization & Ranking**:
  - Scikit-learn's `TfidfVectorizer` generates term-frequency inverse document frequency matrix representations locally.
  - Semantic clustering and cosine similarity ranking are calculated on-device without calling external embedding APIs.

---

## 3. Local AI Inference & Intelligence Engine
* **Local LLM Runtime (Ollama)**:
  - Connects to the local Ollama daemon at `http://127.0.0.1:11434`.
  - Runs models locally (e.g., `qwen3.5:4b` or user-configured models).
* **Concept Map Extraction**:
  - Extracts key terms, definitions, and relationships strictly grounded in local passage text using structured JSON prompts.
* **Document Chat & Word-by-Word Streaming**:
  - Queries local passages and streams tokens via Server-Sent Events (SSE) directly from the local Ollama daemon.
  - Text is buffered and rendered word-by-word with an animated cursor.
* **Study Modes Generation**:
  - Quizzes (multiple choice + answer explanations).
  - Flashcards (terms + definitions).
  - Essay prompts and rubric grading.

---

## 4. Frontend Client Execution
* **Single-Page Application (SPA)**:
  - React 19, TypeScript, and Vite run locally in the browser or wrapped application runtime.
  - Interactive concept graph auto-layout is computed client-side using `@xyflow/react` and Dagre.
  - KaTeX renders mathematical and scientific formulas locally without external font CDNs or web services.
  - Local browser storage (`localStorage`) maintains user preferences, recent reviewers, and offline mode state flags.
