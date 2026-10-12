import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=True)

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ENV_PATH), extra="ignore")

    PROJECT_NAME: str = "RepoQuest"
    PROJECT_VERSION: str = "1.0.0"
    
    # Ollama Local AI
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "qwen2.5:7b-instruct")
    OLLAMA_TIMEOUT_SECONDS: float = 60.0
    
    # GitHub Integration
    GITHUB_TOKEN: str = os.getenv("GITHUB_TOKEN", "")
    GITHUB_API_BASE: str = "https://api.github.com"
    GITHUB_CACHE_TTL_SECONDS: int = 1800
    
    # Limits & Constraints (bounded for reliability & 6GB VRAM / 16GB RAM)
    MAX_TREE_ITEMS: int = 400
    MAX_FILE_BYTES: int = 120_000  # 120 KB
    MAX_AI_CONTEXT_CHARS: int = 8_000
    
    # Persistence
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", "repoquest.db")
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

settings = Settings()
