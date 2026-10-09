# Disclosures

## Models Used

The primary models are `qwen3.5:4b` from Alibaba Cloud and `gemma4:31b-cloud` from Google Deepmind for testing quickly, served through Ollama. It is the default and can be reconfigured. It runs on a local Ollama runtime at `http://127.0.0.1:11434` and handles concept map extraction, reviewer document chat with SSE streaming, and study material synthesis. The system also uses a TF-IDF sparse embedding model from Scikit-learn, running locally in Python on the CPU. It provides sublinear term-frequency passage representation, semantic diversity clustering, and passage retrieval ranking.

## Backend Technologies

The backend is written in Python 3.10 or later and has been tested up to Python 3.14. The API layer uses FastAPI 0.115+, which provides an asynchronous REST API and Server-Sent Events through `StreamingResponse`, and it runs on Uvicorn as the ASGI server. Database access goes through SQLAlchemy 2.0+, with dual-engine session management and failover pools. PyMuPDF (`fitz` 1.25+) extracts native PDF text and layout. Scikit-learn and NumPy handle vector manipulation, cosine metrics, and clustering. For security, the system uses `bcrypt` for a salted offline credential cache and PyJWT for JWT verification. HTTPX is the async HTTP client connecting FastAPI to Ollama and Supabase, and Pydantic v2 provides strict schema validation and structured JSON model responses.

## Frontend Technologies

The frontend is built with React 19 and TypeScript and bundled with Vite 8+. Styling combines Tailwind CSS, DaisyUI 5, and Vanilla CSS utility tokens. Graph visualization relies on `@xyflow/react` (React Flow 12+), with Dagre calculating directed graph layouts. Typography and math rendering use KaTeX, `react-markdown`, `remark-math`, and `rehype-katex`, and icons come from Lucide React.

## APIs and Cloud Services

The Supabase Authentication API is the cloud identity service for user signup, login, session tokens, and password reset flows, and it is accessed through the `supabase-py` SDK (`supabase==2.13.0`). Data is stored in a hosted Supabase PostgreSQL cluster with SSL enforced (`sslmode=require`) and connection pooling through `psycopg2-binary`. The Ollama local REST API runs on port 11434 and exposes `/api/tags`, `/api/chat`, and `/api/generate` for prompt execution and token streaming.

## AI Development Tools

Development used the ChatGPT Codex CLI and Google Antigravity IDE, both are agentic pair-programming environment for developing, debugging, refactoring, and verifying the application architecture. The Ollama CLI, an open-source model serving framework, pulls, quantizes, and runs GGUF model weights on consumer hardware. Bcrypt and Scikit-learn serve as local tooling, providing offline mathematical and cryptographic toolchains that keep AI vector search and user verification fully offline.
