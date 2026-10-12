# ⚔️ RepoQuest — AI-Powered Open-Source Exploration Game

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **"Explore code. Complete quests. Become a contributor."**

RepoQuest helps developers and first-time contributors explore and understand unfamiliar open-source repositories **without cloning or downloading entire codebases**, powered by local, open-weight AI inference (**Qwen 2.5 7B Instruct** via Ollama).

---

## 🎯 The Problem

Diving into a real-world open-source project is intimidating:
- **Massive codebases**: Beginners don't know where execution starts, how configurations connect, or where tests verify behavior.
- **Git & cloning overhead**: Cloning gigabytes of assets, dependencies, and git history just to understand what a project does is wasteful and overwhelming.
- **Generic documentation**: README files often assume prior domain knowledge and omit architectural overviews.

**RepoQuest solves this by turning repository exploration into an interactive game world**, mapping directories into an interactive map, and guiding developers through evidence-grounded missions.

---

## ✨ Signature Features

- 🗺️ **Interactive Repository Map**: Visual graph built with React Flow, grouping folders and highlighting primary entry points, build manifests, test suites, and documentation.
- 📜 **Evidence-Grounded Quests**: 5 interactive missions generated from real repository files:
  1. **Entry Point Detective** — Locate where program execution begins.
  2. **Decode Configuration** — Parse build manifests (`pyproject.toml`, `package.json`, `Cargo.toml`).
  3. **Test Suite Scout** — Discover testing conventions and assertion patterns.
  4. **Trace Core Component** — Follow internal modules and architectural relationships.
  5. **Contributor Preparation** — Understand `CONTRIBUTING.md`, style requirements, and PR workflows.
- 🧠 **Local AI Guide with Qwen 2.5 7B Instruct**: 
  - Explains individual files and overall system architecture in plain English.
  - Strict grounding in retrieved repository files — **no hallucinations**.
  - Contextual Q&A with file-path citations.
- 🛡️ **Contributor Readiness Dashboard**: Automated newcomer scorecard checking README, local setup instructions, test suites, contribution guidelines, issue templates, and open-source licenses.
- 📂 **Lightweight File Explorer**: Inspect real source files on-demand without cloning.
- 🏆 **Gamified Progression**: Earn XP, unlock levels (*Code Novice* ➔ *Codebase Master*), and earn achievement badges with celebratory audio effects.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Vite + React (Frontend)             │
│  React Flow Map • Quest HUD • File Explorer • Audio FX │
└───────────────────────────▲────────────────────────────┘
                            │ REST / JSON (port 5173 ➔ 8000)
┌───────────────────────────▼────────────────────────────┐
│                    FastAPI (Backend)                   │
│   Tree Analyzer • Quest Engine • SQLite Progress DB   │
└─────────────▲────────────────────────────▲─────────────┘
              │ GitHub REST API            │ Local HTTP (/api/chat)
┌─────────────▼─────────────┐ ┌────────────▼─────────────┐
│    Public GitHub Repos    │ │      Ollama (Local AI)    │
│  (Metadata, Trees, Files) │ │   Qwen 2.5 7B Instruct    │
└───────────────────────────┘ └──────────────────────────┘
```

---

## 💻 Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, `@xyflow/react` (React Flow), Lucide Icons, Canvas Confetti, Web Audio API sound synthesizer.
- **Backend**: Python 3.10+, FastAPI, `httpx` (async HTTP), Pydantic v2 Settings, `aiosqlite` (local SQLite persistence), Pytest.
- **Local AI Engine**: **Qwen 2.5 7B Instruct** (`qwen2.5:7b`) running locally via **Ollama** (`http://localhost:11434`).
  - *Zero cloud AI dependencies.*
  - *No OpenAI API keys required.*
  - *100% private, free, and runs on consumer GPUs (e.g. RTX 3050 6GB) or CPU fallback.*

---

## 🚀 Windows Quickstart Guide

### Prerequisites
1. **Node.js** (v18+) & **npm** installed.
2. **Python** (3.10+) installed and added to `PATH`.
3. **Ollama** installed from [https://ollama.com](https://ollama.com).

### Step 1: Download the Model in Ollama
Open PowerShell or Command Prompt and run:
```powershell
ollama pull qwen2.5:7b
```
*(Verify by running `ollama list` — `qwen2.5:7b` should appear).*

### Step 2: Set Up & Run the Python Backend
In PowerShell:
```powershell
cd c:\repogame\backend

# Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run backend server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Backend API will run at: `http://localhost:8000` (Docs: `http://localhost:8000/docs`)*

### Step 3: Run the Frontend
In a second PowerShell window:
```powershell
cd c:\repogame\frontend

# Install dependencies (already prepared)
npm install

# Start Vite dev server
npm run dev
```
*Frontend will open at: `http://localhost:5173`*

---

## 🧪 Running Automated Tests

Run backend tests using pytest:
```powershell
cd c:\repogame\backend
.\.venv\Scripts\python -m pytest tests -v
```

---

## 🔒 Security & Constraints

- **No Code Execution**: RepoQuest inspects repository metadata and file trees via the GitHub REST API; it never runs or builds untrusted code.
- **Prompt Injection Defense**: Repository content is strictly treated as untrusted data within bounded system prompts.
- **Bounded Resource Limits**: Tree exploration and model context lengths are capped to fit comfortably on 6 GB VRAM GPUs and 16 GB system RAM.

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.
