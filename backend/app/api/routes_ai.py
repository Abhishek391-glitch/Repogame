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
    Supports multilingual answers (English, Hindi, Telugu, Tamil, etc.) and conversational history.
    """
    from app.api.routes_repository import _analysis_cache

    cache_key = f"{request.owner.lower()}/{request.repo.lower()}"
    analysis = _analysis_cache.get(cache_key)

    repo_context = None
    all_tree_files: List[str] = []
    if analysis:
        repo_context = {
            "description": analysis.description or "",
            "tech_stack": analysis.tech_stack,
            "entry_points": analysis.entry_points,
            "key_directories": analysis.key_directories,
        }
        all_tree_files = [n.path for n in analysis.tree if getattr(n, "type", "") == "file"]

    # Identify candidate relevant files
    candidate_paths: List[str] = list(request.relevant_files or [])

    if len(candidate_paths) < 3 and all_tree_files:
        # Extract keywords from question to match files
        import re
        q_clean = request.question.lower()
        # Look for English words and technical terms
        keywords = [w for w in re.findall(r"[a-z0-9_]{3,}", q_clean) if w not in {"what", "where", "how", "when", "which", "this", "that", "with", "does", "from", "have", "been", "file", "code", "repo", "application", "project"}]
        
        matched_files = []
        for kw in keywords:
            for f in all_tree_files:
                if kw in f.lower() and f not in candidate_paths and f not in matched_files:
                    matched_files.append(f)
                    if len(matched_files) >= 3:
                        break
            if len(matched_files) >= 3:
                break
        
        candidate_paths.extend(matched_files)

    # If still empty, fall back to entry points / config
    if not candidate_paths and analysis:
        candidate_paths = (analysis.entry_points[:2] + analysis.config_files[:1])

    evidence_files: List[Dict[str, str]] = []
    for fpath in candidate_paths[:4]:
        try:
            fdata = await github_service.get_file_content(request.owner, request.repo, fpath)
            content = fdata.get("content", "")
            if content and not fdata.get("is_binary", False):
                evidence_files.append({
                    "path": fpath,
                    "content": content[:1200]
                })
        except Exception as e:
            logger.warning("Could not fetch evidence file %s: %s", fpath, e)

    return await ollama_service.ask_question(
        owner=request.owner,
        repo=request.repo,
        question=request.question,
        evidence_files=evidence_files,
        language=request.language or "auto",
        history=request.history,
        repo_context=repo_context
    )
