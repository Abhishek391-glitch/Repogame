import logging
from typing import List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException
from app.models.schemas import RepoGameSpec, RepositoryAnalysis
from app.database import record_completed_quest, get_user_progress
from app.game_database import get_game_exploration, save_game_exploration
from app.api.routes_repository import _analysis_cache
from app.services.game_spec_service import game_spec_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/game", tags=["Code Adventure Game"])

class GameSpecRequest(BaseModel):
    owner: str
    repo: str

class GameDiscoveryRequest(BaseModel):
    repo_full_name: str
    object_id: str
    object_name: str
    path: str
    category: str
    xp_reward: int = 50

class GameDiscoveryResponse(BaseModel):
    already_discovered: bool
    xp_awarded: int
    total_xp: int
    level: int
    level_name: str
    new_badges: List[str] = []

class GameSaveProgressRequest(BaseModel):
    repo_full_name: str
    discovered_objects: List[str] = []
    discovered_areas: List[str] = []
    current_objective_index: int = 0
    portal_unlocked: bool = False
    portal_completed: bool = False

@router.post("/spec", response_model=RepoGameSpec)
async def get_or_generate_game_spec(request: GameSpecRequest):
    """
    Generate or retrieve a repository-grounded game specification.
    Selects a game style according to the repository's real purpose
    (e.g. food delivery, ecommerce shop, audio studio, systems tool, or general explorer).
    """
    cache_key = f"{request.owner.lower()}/{request.repo.lower()}"
    analysis = _analysis_cache.get(cache_key)

    if not analysis:
        # Fallback minimal analysis if not in memory cache
        analysis = RepositoryAnalysis(
            owner=request.owner,
            repo=request.repo,
            full_name=f"{request.owner}/{request.repo}",
            description="Open source repository",
            stars=0,
            forks=0,
            default_branch="main",
            html_url=f"https://github.com/{request.owner}/{request.repo}",
            has_readme=True,
            tree=[],
            entry_points=[],
            config_files=[],
            test_files=[],
            doc_files=[]
        )

    spec = await game_spec_service.generate_game_spec(analysis)

    # Cross-reference with completed quest discoveries in database
    progress = await get_user_progress()
    for obj in spec.interactive_objects:
        obj_key = f"{spec.repo_full_name}::discovery::{obj.id}"
        if obj_key in progress.completed_quest_ids:
            obj.completed = True

    for act in spec.activities:
        act_key = f"{spec.repo_full_name}::discovery::{act.id}"
        if act_key in progress.completed_quest_ids:
            act.completed = True

    return spec

@router.get("/progress/{owner}/{repo}")
async def get_repo_game_progress(owner: str, repo: str):
    """Retrieve exploration progress for a specific repository."""
    repo_full_name = f"{owner}/{repo}"
    progress = await get_game_exploration(repo_full_name)
    user_prog = await get_user_progress()
    return {
        "exploration": progress,
        "user_progress": user_prog
    }

@router.post("/save-progress")
async def save_repo_game_progress(request: GameSaveProgressRequest):
    """Save exploration progress for a specific repository."""
    saved = await save_game_exploration(
        repo_full_name=request.repo_full_name,
        discovered_objects=request.discovered_objects,
        discovered_areas=request.discovered_areas,
        current_objective_index=request.current_objective_index,
        portal_unlocked=request.portal_unlocked,
        portal_completed=request.portal_completed
    )
    return {"status": "saved", "data": saved}

@router.post("/discover", response_model=GameDiscoveryResponse)
async def record_discovery(request: GameDiscoveryRequest):
    """
    Record an in-game object or activity discovery.
    Awards XP safely only once via SQLite completed_quests tracker.
    """
    quest_id = f"discovery::{request.object_id}"
    res = await record_completed_quest(
        repo_full_name=request.repo_full_name,
        quest_id=quest_id,
        xp=request.xp_reward
    )

    already_done = res.get("already_completed", False)
    return GameDiscoveryResponse(
        already_discovered=already_done,
        xp_awarded=0 if already_done else request.xp_reward,
        total_xp=res["total_xp"],
        level=res["level"],
        level_name=res["level_name"],
        new_badges=res.get("new_badges", [])
    )
