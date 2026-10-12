from fastapi import APIRouter
from app.config import settings
from app.models.schemas import OllamaStatusResponse
from app.services.ollama_service import ollama_service

router = APIRouter(tags=["Health & Status"])

@router.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION
    }

@router.get("/ollama/status", response_model=OllamaStatusResponse)
async def get_ollama_status():
    """Check connectivity to local Ollama instance and model availability."""
    return await ollama_service.check_status()
