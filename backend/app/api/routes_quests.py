import logging
from typing import List
from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    Quest,
    QuestGenerateRequest,
    QuestValidateRequest,
    QuestValidateResponse
)
from app.services.quest_service import quest_service
from app.api.routes_repository import _analysis_cache
from app.database import record_completed_quest, get_user_progress

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/quests", tags=["Quests"])

@router.post("/generate", response_model=List[Quest])
async def generate_quests(request: QuestGenerateRequest):
    """
    Generate interactive learning missions grounded in the repository's files.
    Marks any quests that have already been solved by the user.
    """
    cache_key = f"{request.owner.lower()}/{request.repo.lower()}"
    analysis = _analysis_cache.get(cache_key)

    all_paths = [n.path for n in analysis.tree] if analysis else []
    entry_points = analysis.entry_points if analysis else []
    config_files = analysis.config_files if analysis else []
    test_files = analysis.test_files if analysis else []
    doc_files = analysis.doc_files if analysis else []
    has_readme = analysis.has_readme if analysis else True

    generated = quest_service.generate_quests_for_repo(
        owner=request.owner,
        repo=request.repo,
        entry_points=entry_points,
        config_files=config_files,
        test_files=test_files,
        doc_files=doc_files,
        all_paths=all_paths,
        has_readme=has_readme
    )

    # Cross-reference with completed quests in DB
    progress = await get_user_progress()
    for q in generated:
        key = f"{request.owner}/{request.repo}::{q.id}"
        if key in progress.completed_quest_ids:
            q.completed = True

    return generated

@router.post("/validate", response_model=QuestValidateResponse)
async def validate_quest(request: QuestValidateRequest):
    """
    Validate user knowledge check answer for a quest.
    Awards XP, tracks completion in database, and triggers level-up/badges.
    """
    # Look up quest in cached analysis
    owner_repo = request.repo_full_name.lower()
    analysis = _analysis_cache.get(owner_repo)
    
    # Regenerate quests to find the target quest specification
    all_paths = [n.path for n in analysis.tree] if analysis else []
    entry_points = analysis.entry_points if analysis else []
    config_files = analysis.config_files if analysis else []
    test_files = analysis.test_files if analysis else []
    doc_files = analysis.doc_files if analysis else []
    has_readme = analysis.has_readme if analysis else True

    owner, repo = request.repo_full_name.split("/")
    quests = quest_service.generate_quests_for_repo(
        owner=owner,
        repo=repo,
        entry_points=entry_points,
        config_files=config_files,
        test_files=test_files,
        doc_files=doc_files,
        all_paths=all_paths,
        has_readme=has_readme
    )

    target_quest = next((q for q in quests if q.id == request.quest_id), None)
    if not target_quest:
        raise HTTPException(status_code=404, detail=f"Quest '{request.quest_id}' not found.")

    is_correct = (request.selected_answer_index == target_quest.knowledge_check.correct_index)

    if not is_correct:
        progress = await get_user_progress()
        return QuestValidateResponse(
            success=False,
            message="Not quite! Review the hint and inspect the highlighted file in the explorer.",
            xp_awarded=0,
            explanation=f"Hint: {target_quest.hints[0] if target_quest.hints else 'Check file contents again.'}",
            total_xp=progress.total_xp,
            level=progress.level,
            level_name=progress.level_name,
            unlocked_badges=[]
        )

    # Award XP and update database
    res = await record_completed_quest(
        repo_full_name=request.repo_full_name,
        quest_id=request.quest_id,
        xp=target_quest.xp_reward
    )

    return QuestValidateResponse(
        success=True,
        message=f"Quest completed! You earned +{target_quest.xp_reward} XP!",
        xp_awarded=target_quest.xp_reward if not res.get("already_completed") else 0,
        explanation=target_quest.knowledge_check.explanation,
        total_xp=res["total_xp"],
        level=res["level"],
        level_name=res["level_name"],
        unlocked_badges=res["new_badges"]
    )
