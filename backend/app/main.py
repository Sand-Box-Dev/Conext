from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from .database import engine, Base
from .routers import health, documents, concepts, chat, projects, auth, memories

# Ensure database tables exist in Supabase Postgres or SQLite
Base.metadata.create_all(bind=engine)

# Add the optional folder reference to existing SQLite databases.
document_columns = {column["name"] for column in inspect(engine).get_columns("documents")}
if "project_id" not in document_columns:
    with engine.begin() as connection:
        connection.execute(text(
            "ALTER TABLE documents ADD COLUMN project_id INTEGER "
            "REFERENCES project_folders(id)"
        ))
if "is_trashed" not in document_columns:
    with engine.begin() as connection:
        connection.execute(text(
            "ALTER TABLE documents ADD COLUMN is_trashed BOOLEAN NOT NULL DEFAULT FALSE"
        ))

app = FastAPI(
    title="Notepad AI - Reviewer API",
    description="Offline-grounded AI concept mapping with Supabase Auth, PostgreSQL storage, and persistent AI memories",
    version="1.1.0"
)

# CORS configuration: Allow local Vite dev server and common frontend origins
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(concepts.router)
app.include_router(chat.router)
app.include_router(projects.router)
app.include_router(memories.router)

@app.get("/")
def root():
    return {
        "message": "Notepad AI Reviewer API",
        "docs": "/docs",
        "health": "/api/health"
    }
