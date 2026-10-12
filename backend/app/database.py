import aiosqlite
import json
import logging
from typing import Optional, Dict, Any, List
from app.config import settings
from app.models.schemas import UserProgress

logger = logging.getLogger(__name__)

async def init_db():
    """Initialize SQLite database schema for player progress and quests."""
    async with aiosqlite.connect(settings.DATABASE_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS user_progress (
                id TEXT PRIMARY KEY,
                total_xp INTEGER DEFAULT 0,
                level INTEGER DEFAULT 1,
                level_name TEXT DEFAULT 'Code Novice',
                badges TEXT DEFAULT '[]',
                repos_explored TEXT DEFAULT '[]',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS completed_quests (
                repo_full_name TEXT,
                quest_id TEXT,
                xp_awarded INTEGER,
                completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (repo_full_name, quest_id)
            )
        """)
        # Ensure default user row exists
        await db.execute("""
            INSERT OR IGNORE INTO user_progress (id, total_xp, level, level_name, badges, repos_explored)
            VALUES ('player', 0, 1, 'Code Novice', '[]', '[]')
        """)
        await db.commit()
        logger.info("Database initialized successfully at %s", settings.DATABASE_PATH)

def calculate_level(xp: int) -> tuple[int, str]:
    """Calculate level and level title based on total XP."""
    tiers = [
        (0, 1, "Code Novice"),
        (150, 2, "Repo Explorer"),
        (400, 3, "Architecture Scout"),
        (800, 4, "Open Source Contributor"),
        (1400, 5, "Repo Vanguard"),
        (2200, 6, "Codebase Master"),
    ]
    level = 1
    name = "Code Novice"
    for threshold, lvl, title in tiers:
        if xp >= threshold:
            level = lvl
            name = title
    return level, name

async def get_user_progress() -> UserProgress:
    """Fetch user progress record."""
    async with aiosqlite.connect(settings.DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM user_progress WHERE id = 'player'") as cursor:
            row = await cursor.fetchone()
            if not row:
                return UserProgress()
            
            badges = json.loads(row["badges"] or "[]")
            repos = json.loads(row["repos_explored"] or "[]")
            
        async with db.execute("SELECT repo_full_name, quest_id FROM completed_quests") as cursor:
            completed_rows = await cursor.fetchall()
            completed_quests = [f"{r['repo_full_name']}::{r['quest_id']}" for r in completed_rows]
            
        return UserProgress(
            total_xp=row["total_xp"],
            level=row["level"],
            level_name=row["level_name"],
            completed_quest_ids=completed_quests,
            badges=badges,
            repos_explored=repos
        )

async def record_completed_quest(repo_full_name: str, quest_id: str, xp: int) -> Dict[str, Any]:
    """Record quest completion, award XP, compute level up, and unlock achievements."""
    async with aiosqlite.connect(settings.DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        
        # Check if already completed
        async with db.execute(
            "SELECT 1 FROM completed_quests WHERE repo_full_name = ? AND quest_id = ?",
            (repo_full_name, quest_id)
        ) as cursor:
            already = await cursor.fetchone()
            if already:
                # Already awarded
                curr = await get_user_progress()
                return {
                    "already_completed": True,
                    "total_xp": curr.total_xp,
                    "level": curr.level,
                    "level_name": curr.level_name,
                    "new_badges": []
                }
        
        # Insert quest completion
        await db.execute(
            "INSERT INTO completed_quests (repo_full_name, quest_id, xp_awarded) VALUES (?, ?, ?)",
            (repo_full_name, quest_id, xp)
        )
        
        # Get current progress
        async with db.execute("SELECT * FROM user_progress WHERE id = 'player'") as cursor:
            row = await cursor.fetchone()
            current_xp = (row["total_xp"] if row else 0) + xp
            badges = json.loads(row["badges"] if row else "[]")
            repos = json.loads(row["repos_explored"] if row else "[]")
            
            if repo_full_name not in repos:
                repos.append(repo_full_name)
        
        new_level, new_title = calculate_level(current_xp)
        
        # Check badges
        new_badges = []
        possible_badges = [
            ("First Discovery", "Completed your first repository quest!", True),
            ("README Detective", "Mastered repository documentation analysis!", quest_id in ["quest-entry", "quest-contrib"]),
            ("Configuration Explorer", "Decoded build manifests and environment setups!", quest_id == "quest-config"),
            ("Test Suite Scout", "Explored the testing framework and verification patterns!", quest_id == "quest-test"),
            ("Contribution Ready", "Finished contributor preparation guidelines!", quest_id == "quest-contrib"),
        ]
        
        for badge_name, _, condition in possible_badges:
            if condition and badge_name not in badges:
                badges.append(badge_name)
                new_badges.append(badge_name)
                
        await db.execute("""
            UPDATE user_progress
            SET total_xp = ?, level = ?, level_name = ?, badges = ?, repos_explored = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = 'player'
        """, (current_xp, new_level, new_title, json.dumps(badges), json.dumps(repos)))
        
        await db.commit()
        
        return {
            "already_completed": False,
            "total_xp": current_xp,
            "level": new_level,
            "level_name": new_title,
            "new_badges": new_badges
        }

async def add_explored_repo(repo_full_name: str):
    """Register repository exploration."""
    async with aiosqlite.connect(settings.DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT repos_explored FROM user_progress WHERE id = 'player'") as cursor:
            row = await cursor.fetchone()
            repos = json.loads(row["repos_explored"]) if row and row["repos_explored"] else []
            if repo_full_name not in repos:
                repos.append(repo_full_name)
                await db.execute(
                    "UPDATE user_progress SET repos_explored = ? WHERE id = 'player'",
                    (json.dumps(repos),)
                )
                await db.commit()
