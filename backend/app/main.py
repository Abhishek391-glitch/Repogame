import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import init_db
from app.game_database import init_game_db
from app.api.routes_health import router as health_router
from app.api.routes_repository import router as repository_router
from app.api.routes_ai import router as ai_router
from app.api.routes_quests import router as quests_router
from app.api.routes_progress import router as progress_router
from app.api.routes_game import router as game_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("repoquest")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing %s v%s...", settings.PROJECT_NAME, settings.PROJECT_VERSION)
    await init_db()
    await init_game_db()
    yield
    logger.info("Shutting down %s.", settings.PROJECT_NAME)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="Backend API for RepoQuest - AI-Powered Open-Source Exploration Game",
    lifespan=lifespan
)

# Enable CORS for local Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes under /api
app.include_router(health_router, prefix="/api")
app.include_router(repository_router, prefix="/api")
app.include_router(ai_router, prefix="/api")
app.include_router(quests_router, prefix="/api")
app.include_router(progress_router, prefix="/api")
app.include_router(game_router, prefix="/api")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error processing %s: %s", request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
