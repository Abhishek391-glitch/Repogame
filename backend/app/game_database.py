import aiosqlite
import json
import logging
from typing import Dict, Any, List, Optional
from app.config import settings

logger = logging.getLogger(__name__)

async def init_game_db():
    """Ensure table exists for persisting repository game exploration progress."""
    async with aiosqlite.connect(settings.DATABASE_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS game_explorations (
                repo_full_name TEXT PRIMARY KEY,
                discovered_objects TEXT DEFAULT '[]',
                discovered_areas TEXT DEFAULT '[]',
                current_objective_index INTEGER DEFAULT 0,
                portal_unlocked INTEGER DEFAULT 0,
                portal_completed INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.commit()

async def get_game_exploration(repo_full_name: str) -> Dict[str, Any]:
    """Retrieve saved exploration progress for a given repository."""
    await init_game_db()
    async with aiosqlite.connect(settings.DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM game_explorations WHERE repo_full_name = ?",
            (repo_full_name,)
        ) as cursor:
            row = await cursor.fetchone()
            if not row:
                return {
                    "repo_full_name": repo_full_name,
                    "discovered_objects": [],
                    "discovered_areas": ["welcome_garden"],
                    "current_objective_index": 0,
                    "portal_unlocked": False,
                    "portal_completed": False
                }
            return {
                "repo_full_name": row["repo_full_name"],
                "discovered_objects": json.loads(row["discovered_objects"] or "[]"),
                "discovered_areas": json.loads(row["discovered_areas"] or "[]"),
                "current_objective_index": row["current_objective_index"] or 0,
                "portal_unlocked": bool(row["portal_unlocked"]),
                "portal_completed": bool(row["portal_completed"])
            }

async def save_game_exploration(
    repo_full_name: str,
    discovered_objects: List[str],
    discovered_areas: List[str],
    current_objective_index: int,
    portal_unlocked: bool,
    portal_completed: bool
) -> Dict[str, Any]:
    """Save or update exploration state for a repository."""
    await init_game_db()
    async with aiosqlite.connect(settings.DATABASE_PATH) as db:
        await db.execute("""
            INSERT INTO game_explorations (
                repo_full_name, discovered_objects, discovered_areas,
                current_objective_index, portal_unlocked, portal_completed, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(repo_full_name) DO UPDATE SET
                discovered_objects = excluded.discovered_objects,
                discovered_areas = excluded.discovered_areas,
                current_objective_index = excluded.current_objective_index,
                portal_unlocked = excluded.portal_unlocked,
                portal_completed = excluded.portal_completed,
                updated_at = CURRENT_TIMESTAMP
        """, (
            repo_full_name,
            json.dumps(discovered_objects),
            json.dumps(discovered_areas),
            current_objective_index,
            1 if portal_unlocked else 0,
            1 if portal_completed else 0
        ))
        await db.commit()
    return await get_game_exploration(repo_full_name)
