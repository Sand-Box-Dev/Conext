from fastapi import APIRouter
from ..schemas import HealthResponse
from ..services.ollama_service import check_ollama_health

router = APIRouter(prefix="/api", tags=["health"])

@router.get("/health", response_model=HealthResponse)
async def health_check():
    ollama_info = await check_ollama_health()
    return HealthResponse(
        status="healthy",
        ollama_connected=ollama_info["connected"],
        ollama_model=ollama_info["model"],
        ollama_model_available=ollama_info["available"]
    )
