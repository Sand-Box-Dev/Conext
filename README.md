# Notepad AI

**Notepad AI** is an offline, AI-powered interactive concept mapping and educational document comprehension workspace. It extracts key concepts and directional relationships from textbooks, research papers, and lecture materials completely locally, visualizes them in an interactive graph, and provides verifiable evidence grounding for every concept.

---

## Key Features

- **100% Offline Processing**: Powered by local Ollama models (`gemma4:31b-cloud`), ensuring data privacy and zero cloud token dependencies.
- **Vector-First Processing**: Ingests, splits, and vectors document passages prior to concept map synthesis using TF-IDF sparse vector representations and semantic diversity clustering.
- **Strict Grounding & Evidence Linking**: Every concept node cites explicit numbered source passages and page numbers, eliminating hallucinations.
- **Interactive Concept Graph**: Built with React and `@xyflow/react` (React Flow) and Dagre auto-layout for seamless navigation, zoom/pan, and node inspection.
- **Multi-Format Ingestion**: Supports `.pdf`, `.txt`, and `.md` educational files up to 10MB.

---

## Architecture Overview

```
Notepad AI/
├── backend/                  # FastAPI Backend Service
│   ├── app/
│   │   ├── routers/          # API endpoints (health, documents, concepts)
│   │   ├── services/
│   │   │   ├── document_service.py # PyMuPDF parsing and text chunking
│   │   │   ├── vector_service.py   # Passage vectorization & semantic selection
│   │   │   ├── concept_service.py  # Map synthesis orchestration & grounding validation
│   │   │   └── ollama_service.py   # Local Ollama client (gemma4:31b-cloud)
│   │   ├── models.py         # SQLAlchemy models (Document, SourceChunk, ConceptMap, etc.)
│   │   ├── schemas.py        # Pydantic schemas & structured JSON LLM output schemas
│   │   ├── database.py       # SQLite engine and session management
│   │   └── main.py           # FastAPI entrypoint and CORS setup
│   └── requirements.txt
├── frontend/                 # Vite + React + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── components/       # ConceptNode, GraphCanvas, Sidebar, EvidenceDrawer
│   │   ├── pages/            # Workspace main view
│   │   └── services/api.ts   # REST client connecting to backend
└── tests/                    # Pytest suite for extraction, grounding, and vectorization
```

---

## Prerequisites

1. **Python 3.10+** (Tested on Python 3.14)
2. **Node.js** / **Bun** (for frontend development and build)
3. **Ollama**: Installed and running locally
   - Pull the target model:
     ```bash
     ollama pull gemma4:31b-cloud
     ```

---

## Getting Started

### 1. Start Ollama
Ensure the Ollama daemon is running:
```bash
ollama serve
```

Verify `gemma4:31b-cloud` is listed:
```bash
ollama list
```

### 2. Backend Setup
From the repository root:
```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
API documentation is available at `http://127.0.0.1:8000/docs`.

### 3. Frontend Setup
In a separate terminal:
```bash
cd frontend
bun install     # or npm install
bun run dev     # or npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Running Tests

Run the test suite to verify document chunking, vectorization, grounding validation, and database operations:
```bash
python -m pytest tests/
```

---

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy, SQLite, PyMuPDF, Scikit-learn, HTTPX, Pydantic v2
- **Model / LLM**: Ollama (`gemma4:31b-cloud`)
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Dagre, `@xyflow/react`
