# Disclosures

This document provides a transparent overview of the architecture, models, libraries, APIs, and AI tooling utilized across the **Notepad AI** ecosystem.

---

## 1. Models Used

| Model | Provider / Engine | Role & Purpose | Deployment |
| :--- | :--- | :--- | :--- |
| **`qwen3.5:4b`** *(Default / Configurable)* | Alibaba Cloud / Ollama | Primary local LLM for concept map extraction, reviewer document chat with SSE streaming, and study material synthesis. | Local Ollama Runtime (`http://127.0.0.1:11434`) |
| **`gemma4:31b-cloud`** *(Supported Alternative)* | Google / Ollama | Advanced local reasoning and essay rubric evaluation. | Local Ollama Runtime |
| **TF-IDF Sparse Embedding Model** | Scikit-learn (Local Python) | Sublinear term-frequency passage representation, semantic diversity clustering, and passage retrieval ranking. | On-device CPU Execution |

---

## 2. Technologies and Frameworks

### Backend
* **Language & Runtime**: Python 3.10+ (Tested up to Python 3.14)
* **API Framework**: FastAPI 0.115+ (Asynchronous REST API, Server-Sent Events with `StreamingResponse`)
* **ORM & Database Toolkit**: SQLAlchemy 2.0+ (Dual-engine session management, failover pools)
* **Document Parsing**: PyMuPDF (`fitz` 1.25+) for native PDF stream text and layout extraction
* **Data Science & ML**: Scikit-learn, NumPy for vector manipulation, cosine metrics, and clustering
* **Password Hashing & Security**: `bcrypt` (Salted offline credential cache), PyJWT (JWT verification)
* **HTTP Client**: HTTPX (Async HTTP client connecting FastAPI to Ollama and Supabase)
* **Validation**: Pydantic v2 (Strict schema validation and structured JSON model responses)
* **Server**: Uvicorn (ASGI web server)

### Frontend
* **Core Framework**: React 19 with TypeScript
* **Build System**: Vite 8+
* **Styling & Design System**: Tailwind CSS, DaisyUI 5, Vanilla CSS utility tokens
* **Graph Visualization**: `@xyflow/react` (React Flow 12+), Dagre (Directed graph layout calculation)
* **Typography & Math Rendering**: KaTeX, `react-markdown`, `remark-math`, `rehype-katex`
* **Icons**: Lucide React

---

## 3. APIs and Cloud Services

* **Supabase Authentication API**:
  - Cloud identity service for user signup, login, session tokens, and password reset flows.
  - SDK: `supabase-py` (`supabase==2.13.0`).
* **Supabase PostgreSQL Database**:
  - Hosted PostgreSQL database cluster with SSL enforcement (`sslmode=require`).
  - Connection pooling via psycopg2-binary.
* **Ollama Local REST API**:
  - HTTP-based API running on port 11434 (`/api/tags`, `/api/chat`, `/api/generate`) for prompt execution and token streaming.

---

## 4. AI Development Tools

* **Google DeepMind Antigravity IDE**:
  - Advanced agentic pair-programming IDE environment utilized for developing, debugging, refactoring, and verifying the application architecture.
* **Ollama CLI**:
  - Open-source model serving framework used for pulling, quantizing, and executing GGUF model weights on consumer hardware.
* **Bcrypt & Scikit-learn Local Tooling**:
  - Offline mathematical and cryptographic toolchains used to ensure 100% offline parity for AI vector search and user verification.
