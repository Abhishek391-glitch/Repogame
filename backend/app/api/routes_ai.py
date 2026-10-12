import logging
from typing import List, Dict
from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    AiOverviewRequest,
    AiOverviewResponse,
    AiExplainFileRequest,
    AiExplainFileResponse,
    AiAskRequest,
    AiAskResponse
)
from app.services.ollama_service import ollama_service
from app.services.github_service import github_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Repository Understanding"])

@router.post("/overview", response_model=AiOverviewResponse)
async def get_ai_project_overview(request: AiOverviewRequest):
    """
    Generate structured, evidence-grounded project overview using local Ollama model.
    Falls back gracefully if model is offline or uninstalled.
    """
    return await ollama_service.generate_project_overview(
        owner=request.owner,
        repo=request.repo,
        description=request.description,
        readme_excerpt=request.readme_excerpt,
        tech_stack=request.tech_stack,
        entry_points=request.entry_points,
        key_directories=request.key_directories
    )

@router.post("/explain-file", response_model=AiExplainFileResponse)
async def explain_file_with_ai(request: AiExplainFileRequest):
    """
    Explain a specific file in the repository using Ollama Qwen2.5.
    Breaks down role, key definitions, connections, and beginner tips.
    """
    return await ollama_service.explain_file(
        owner=request.owner,
        repo=request.repo,
        path=request.path,
        content=request.content,
        repo_context=request.repo_context
    )

@router.post("/ask", response_model=AiAskResponse)
async def ask_repository_ai(request: AiAskRequest):
    """
    Contextual Q&A about the repository.
    Fetches real file evidence for relevant files before asking the model.
    """
    evidence_files: List[Dict[str, str]] = []
    
    # If client passed candidate files, retrieve small snippets for context
    if request.relevant_files:
        for fpath in request.relevant_files[:3]:
            try:
                fdata = await github_service.get_file_content(request.owner, request.repo, fpath)
                evidence_files.append({
                    "path": fpath,
                    "content": fdata.get("content", "")[:1200]
                })
            except Exception as e:
                logger.warning("Could not fetch evidence file %s: %s", fpath, e)

    return await ollama_service.ask_question(
        owner=request.owner,
        repo=request.repo,
        question=request.question,
        evidence_files=evidence_files
    )
