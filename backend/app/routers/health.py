from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_db, check_primary_db_online, is_primary_postgres
from ..schemas import HealthResponse
from ..services.ollama_service import check_ollama_health

router = APIRouter(prefix="/api", tags=["health"])

@router.get("/health", response_model=HealthResponse)
async def health_check(db: Session = Depends(get_db)):
    ollama_info = await check_ollama_health()
    db_connected = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_connected = False

    # Determine if we're running against the primary DB or offline fallback
    primary_online = check_primary_db_online() if is_primary_postgres() else True

    return HealthResponse(
        status="healthy" if db_connected else "degraded",
        ollama_connected=ollama_info["connected"],
        ollama_model=ollama_info["model"],
        ollama_model_available=ollama_info["available"],
        database_connected=db_connected,
        offline_mode=not primary_online and is_primary_postgres(),
    )
