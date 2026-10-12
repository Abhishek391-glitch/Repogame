@echo off
title RepoQuest Backend Server
echo ========================================================
echo   Starting RepoQuest Backend (FastAPI + Ollama)
echo   Local API: http://127.0.0.1:8000
echo   API Docs:  http://127.0.0.1:8000/docs
echo ========================================================
cd /d "%~dp0\backend"
call .venv\Scripts\activate.bat
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
pause
