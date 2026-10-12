@echo off
title RepoQuest Frontend Dev Server
echo ========================================================
echo   Starting RepoQuest Frontend (Vite + React)
echo   Local Web App: http://localhost:5173
echo ========================================================
cd /d "%~dp0\frontend"
npm run dev
pause
