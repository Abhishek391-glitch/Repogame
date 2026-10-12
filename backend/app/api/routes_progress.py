import aiosqlite
import logging
from fastapi import APIRouter
from app.config import settings
from app.models.schemas import UserProgress
from app.database import get_user_progress

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/progress", tags=["Player Progress"])

@router.get("", response_model=UserProgress)
async def fetch_user_progress():
    """Retrieve player experience, level, badges, and completed quest history."""
    return await get_user_progress()

@router.post("/reset")
async def reset_player_progress():
    """Reset player progress for a fresh testing session."""
    async with aiosqlite.connect(settings.DATABASE_PATH) as db:
        await db.execute("DELETE FROM completed_quests")
        await db.execute("""
            UPDATE user_progress
            SET total_xp = 0, level = 1, level_name = 'Code Novice', badges = '[]', repos_explored = '[]'
            WHERE id = 'player'
        """)
        await db.commit()
    return {"message": "Player progression reset successfully."}
