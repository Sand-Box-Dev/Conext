from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import health, documents, concepts

# Ensure database tables exist
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Conext - Offline AI Concept Mapping API",
    description="Local AI-powered interactive concept mapping MVP for educational documents",
    version="1.0.0"
)

# CORS configuration: Allow local Vite dev server and localhost origins
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
app.include_router(documents.router)
app.include_router(concepts.router)

@app.get("/")
def root():
    return {
        "message": "Conext Local AI Concept Mapping API",
        "docs": "/docs",
        "health": "/api/health"
    }
