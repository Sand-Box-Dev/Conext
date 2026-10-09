# Notepad AI

> **An offline-first, AI-grounded interactive concept mapping, document comprehension, and study reviewer platform.**

Notepad AI bridges the gap between static educational documents (PDF, TXT, MD) and active learning. It combines cloud-synced account profiles with a resilient **offline fallback architecture**: users can authenticate, sync documents, generate interactive knowledge graphs, chat with documents via local Ollama models with real-time word-by-word streaming, take interactive quizzes, and study flashcards — entirely without an internet connection.

---

## Table of Contents

1. [System Specifications](#system-specifications)
2. [Architecture Overview](#architecture-overview)
3. [Key Subsystems](#key-subsystems)
   - [1. Dual-Tier Authentication & Offline Fallback](#1-dual-tier-authentication--offline-fallback)
   - [2. Database Dual-Engine Failover & Bidirectional Sync](#2-database-dual-engine-failover--bidirectional-sync)
   - [3. Vector-First Document Processing Pipeline](#3-vector-first-document-processing-pipeline)
   - [4. AI Concept Extraction & Strict Evidence Grounding](#4-ai-concept-extraction--strict-evidence-grounding)
   - [5. Word-by-Word Chat Streaming (SSE) with Citations](#5-word-by-word-chat-streaming-sse-with-citations)
   - [6. Study Mode (Quiz, Flashcards, Essay Evaluation)](#6-study-mode-quiz-flashcards-essay-evaluation)
4. [API Specification Summary](#api-specification-summary)
5. [Data Models & Schema](#data-models--schema)
6. [Tech Stack](#tech-stack)
7. [Getting Started & Local Setup](#getting-started--local-setup)
8. [Environment Configuration](#environment-configuration)
9. [Verification & Testing](#verification--testing)

---

## System Specifications

| Dimension | Specification |
| :--- | :--- |
| **Primary Architecture** | Offline-First Hybrid Cloud / Local Edge |
| **Cloud Backend** | Supabase Auth + Supabase PostgreSQL (SSL pooled) |
| **Offline Cache / DB** | SQLite (`offline_auth.db` for user credentials, `offline_data.db` for workspace data) |
| **Local Inference Runtime** | [Ollama](https://ollama.ai) (`qwen3.5:4b` / configurable via `.env`) |
| **Embedding / Retrieval** | TF-IDF sublinear sparse vector indexing with cosine ranking & clustering |
| **Streaming Protocol** | Server-Sent Events (SSE) with word-paced typewriter client queue |
| **Max Upload Limit** | 10 MB (`.pdf`, `.txt`, `.md`) |
| **Supported Frontend OS** | Windows, macOS, Linux (Cross-platform Web / Desktop wrapped) |

---

## Architecture Overview

```
                          ┌─────────────────────────────────────┐
                          │         React / Vite Client         │
                          │   (Tailwind CSS, DaisyUI, Dagre)    │
                          └──────────────────┬──────────────────┘
                                             │ HTTP / SSE
                                             ▼
                          ┌─────────────────────────────────────┐
                          │         FastAPI Application         │
                          └──────┬───────────┬────────────┬─────┘
                                 │           │            │
       ┌─────────────────────────┴─┐         │            └─────────────────────────┐
       ▼                           ▼         ▼                                      ▼
┌──────────────┐         ┌───────────────┐ ┌──────────────┐                 ┌───────────────┐
│ Supabase API │         │   Postgres    │ │    SQLite    │                 │ Local Ollama  │
│(Online Auth) │         │ (Primary DB)  │ │ (Offline DB) │                 │  (LLM Engine) │
└──────┬───────┘         └───────┬───────┘ └──────┬───────┘                 └───────────────┘
       │ Credentials             │                │ Failover /
       │ Sync                    │ Sync Service   │ Local Read/Write
       ▼                         ▼                ▼
┌──────────────┐         ┌───────────────────────────────┐
│ bcrypt Cache │         │  offline_data.db / uploads/   │
│(offline_auth)│         │ (Documents, Chunks, Maps, ...)│
└──────────────┘         └───────────────────────────────┘
```

---

## Key Subsystems

### 1. Dual-Tier Authentication & Offline Fallback

Conext allows users to sign in whether online or offline:

* **Online Flow**:
  1. User authenticates via Supabase Auth (`/api/auth/login`).
  2. Upon success, the user password hash (`bcrypt`) is cached locally into `offline_users` inside `backend/data/offline_auth.db`.
  3. A background task triggers `sync_user_data_to_offline(user_id)` to synchronize cloud records to the local database.
* **Offline Flow**:
  1. If Supabase is unreachable or network is offline, the backend verifies credentials against `offline_auth.db` using `bcrypt.checkpw`.
  2. If valid, an offline session token (`offline_<user_id>_<uuid>`) is generated with `offline: true`.
  3. The client receives the user profile and displays an amber **Offline Mode** indicator badge in the sidebar.

### 2. Database Dual-Engine Failover & Bidirectional Sync

The database subsystem maintains a primary PostgreSQL connection and a dedicated fallback SQLite engine:

* **Failover Engine (`database.py`)**:
  - `get_db()` and `get_db_session()` attempt a connection test (`SELECT 1`) against Supabase PostgreSQL.
  - If unreachable, requests seamlessly fall back to `offline_data.db` with identical table schemas.
* **Synchronization Service (`sync_service.py`)**:
  - Copies user-owned records in relational dependency order:
    `ProjectFolder` ➔ `Document` ➔ `SourceChunk` ➔ `ConceptMap` ➔ `ConceptNode` ➔ `ConceptEdge` ➔ `NodeSource` ➔ `ChatMessage` ➔ `StudyExam` ➔ `AIMemory`.
  - Automatically runs on server startup and on every successful online login.

### 3. Vector-First Document Processing Pipeline

Uploaded documents are processed entirely locally:

1. **Text Extraction**: Uses `PyMuPDF` (`fitz`) for PDFs and UTF-8 decoders for `.txt`/`.md` with page/chunk tracking.
2. **Passage Chunking**: Paragraph-aware segmentation (default ~1,200 characters with 150-character overlap).
3. **Vectorization (`VectorService`)**:
   - Computes TF-IDF vector representations across chunks.
   - Extracts semantic weight matrices and stores JSON-serialized sparse vectors in the `source_chunks` table for sub-second retrieval.

### 4. AI Concept Extraction & Strict Evidence Grounding

* **Prompt Strategy**: Local LLM (`Ollama`) receives representative passages selected via semantic diversity clustering.
* **Strict Evidence Linking**: Concepts must explicitly cite passage IDs (`[Passage ID: X]`). Hallucinations outside the provided context are prohibited by model system instructions.
* **Interactive Visualization**: Directed acyclic graph layout rendered using React Flow (`@xyflow/react`) and the Dagre layout engine.

### 5. Word-by-Word Chat Streaming (SSE) with Citations

Conext provides a natural assistant conversation experience for uploaded reviewers:

* **Streaming Route**: `POST /api/documents/{document_id}/chat/stream`
* **Event Protocol**:
  - `event: chunk` ➔ Real-time token delta: `{"delta": "word "}`
  - `event: done` ➔ Completion payload: `{"message_id": 12, "answer": "...", "citations": [...]}`
* **Smooth Typewriter Client Buffer**:
  - Rather than jumpy multi-token flashes, the client buffers incoming tokens in a queue and releases them smoothly at 25ms intervals.
* **Citations Rendered Last**:
  - During streaming, focus stays purely on the streaming text and typing cursor.
  - Upon completion, the interactive **Sources & Referenced Passages** cards expand at the bottom of the message. Clicking any card reveals the exact passage quote and page number.

### 6. Study Mode (Quiz, Flashcards, Essay Evaluation)

* **Quiz Generation**: Synthesizes multiple-choice questions with answer keys, explanations, and cited passage references.
* **Flashcard Mode**: Produces front-and-back study cards grounded in reviewer definitions.
* **Essay Grading**: Automatically evaluates student essays against a multi-criteria rubric (thesis, evidence, structure, accuracy), outputting scores, feedback, and citation links.

---

## API Specification Summary

### Authentication (`/api/auth`)
* `POST /api/auth/signup` — Create new Supabase user & cache locally
* `POST /api/auth/login` — Online Supabase login with automatic offline fallback
* `GET  /api/auth/me` — Current user profile inspection
* `PATCH /api/auth/me` — Update display name / password
* `GET  /api/auth/status` — Network & DB online/offline status check

### Documents & Folders (`/api/documents`, `/api/projects`)
* `GET    /api/documents` — List user's active reviewers
* `POST   /api/documents` — Upload new PDF/document (automatically processed locally)
* `GET    /api/documents/{id}` — Get reviewer details & processing state
* `GET    /api/documents/{id}/file` — Stream original uploaded file
* `POST   /api/documents/{id}/trash` — Soft-delete reviewer
* `POST   /api/documents/{id}/restore` — Restore reviewer from trash
* `DELETE /api/documents/{id}` — Permanently delete reviewer & disk file
* `PATCH  /api/documents/{id}/project` — Assign document to project folder

### Reviewer Chat (`/api/documents/{id}/chat`)
* `GET  /api/documents/{id}/chat` — Retrieve conversation history with citations
* `POST /api/documents/{id}/chat` — Non-streaming message request
* `POST /api/documents/{id}/chat/stream` — Real-time word-by-word Server-Sent Events stream

### Concept Graph & Study (`/api/concepts`, `/api/study`)
* `POST /api/documents/{id}/generate` — Generate grounded concept map via local Ollama
* `GET  /api/documents/{id}/map` — Fetch generated concept nodes and edges
* `POST /api/concepts/{concept_id}/explain` — Generate deep explanation for specific concept node
* `POST /api/documents/{id}/study/quiz` — Generate interactive quiz
* `POST /api/documents/{id}/study/flashcards` — Generate flashcards
* `POST /api/documents/{id}/study/essay` — Generate essay prompts and rubric
* `POST /api/documents/{id}/study/essay/grade` — Grade essay submission against rubric

---

## Data Models & Schema

```
ProjectFolder (id, name, created_at)
  └── Document (id, filename, file_path, uploaded_at, processing_status, is_trashed, user_id, project_id)
        ├── SourceChunk (id, document_id, page_number, chunk_index, content, embedding)
        ├── ConceptMap (id, document_id, created_at, user_id)
        │     ├── ConceptNode (id, concept_map_id, label, explanation, node_type, x, y)
        │     │     └── NodeSource (id, node_id, source_chunk_id)
        │     └── ConceptEdge (id, concept_map_id, source_node_id, target_node_id, relationship_label)
        ├── ChatMessage (id, document_id, role, content, citations, created_at)
        ├── StudyExam (id, document_id, mode, title, content, created_at)
        └── AIMemory (id, document_id, memory_text, memory_type, confidence_score, user_id)
```

---

## Tech Stack

| Tier | Technologies |
| :--- | :--- |
| **Backend** | Python 3.10+, FastAPI, Uvicorn, SQLAlchemy 2.0, Pydantic v2, PyMuPDF, Scikit-learn, HTTPX, bcrypt |
| **Databases** | Supabase PostgreSQL, SQLite3 |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, DaisyUI, `@xyflow/react` (React Flow), Dagre, KaTeX, Lucide React |
| **Local LLM** | Ollama (`qwen3.5:4b` or configured local model) |

---

## Getting Started & Local Setup

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+** or **Bun**
- **Ollama** installed on your system ([Download Ollama](https://ollama.ai))

### 2. Prepare Local LLM
```bash
# Start Ollama daemon
ollama serve

# In another terminal, pull the desired model
ollama pull qwen3.5:4b
```

### 3. Backend Setup
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Swagger API docs: `http://127.0.0.1:8000/docs`

### 4. Frontend Setup
```bash
cd frontend

# Install packages
npm install

# Start Vite dev server
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Environment Configuration

Place inside `backend/.env`:

```env
# Database Settings (Leave empty to run purely in local SQLite mode)
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres

# Supabase Auth
SUPABASE_URL=https://[YOUR_PROJECT_REF].supabase.co
SUPABASE_ANON_KEY=[YOUR_ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR_SERVICE_ROLE_KEY]
SUPABASE_JWT_SECRET=[YOUR_JWT_SECRET]

# Local Ollama Settings
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3.5:4b
```

---

## Verification & Testing

* **Backend Sanity Check**:
  ```bash
  cd backend
  python -c "import app.main; print('Backend modules verified!')"
  ```
* **Offline Auth & DB Sync Check**:
  ```bash
  python -c "from app.services.sync_service import sync_user_data_to_offline; print(sync_user_data_to_offline())"
  ```
* **Frontend Production Build**:
  ```bash
  cd frontend
  npm run build
  ```
