from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

# Ollama Status
class OllamaStatusResponse(BaseModel):
    available: bool
    configured_model: str
    model_installed: bool
    available_models: List[str] = []
    base_url: str
    latency_ms: Optional[float] = None
    message: str
    setup_instructions: Optional[List[str]] = None

# Repository Tree & Classification
class FileTreeNode(BaseModel):
    path: str
    type: str  # "blob" or "tree"
    category: str  # "entrypoint", "config", "test", "doc", "source", "asset", "directory"
    name: str
    extension: str = ""
    size: Optional[int] = None
    importance: str = "medium"  # "high", "medium", "low"
    reason: Optional[str] = None
    language: Optional[str] = None

class TechStackDetection(BaseModel):
    languages: List[str] = []
    frameworks: List[str] = []
    package_managers: List[str] = []
    test_frameworks: List[str] = []
    build_tools: List[str] = []

class RepositoryAnalyzeRequest(BaseModel):
    url: str = Field(..., description="Public GitHub repository URL (e.g. https://github.com/owner/repo)")

class RepositoryAnalysis(BaseModel):
    owner: str
    repo: str
    full_name: str
    description: Optional[str] = None
    stars: int = 0
    forks: int = 0
    default_branch: str = "main"
    html_url: str
    license: Optional[str] = None
    has_readme: bool = False
    readme_preview: Optional[str] = None
    readme_full: Optional[str] = None
    tree: List[FileTreeNode] = []
    entry_points: List[str] = []
    config_files: List[str] = []
    test_files: List[str] = []
    doc_files: List[str] = []
    tech_stack: TechStackDetection = Field(default_factory=TechStackDetection)
    is_truncated: bool = False
    total_files_analyzed: int = 0
    is_demo_fallback: bool = False

class FileContentRequest(BaseModel):
    owner: str
    repo: str
    path: str
    ref: Optional[str] = None

class FileContentResponse(BaseModel):
    path: str
    content: str
    size: int
    truncated: bool = False
    is_binary: bool = False
    html_url: str

# AI Understand & Explain
class AiOverviewRequest(BaseModel):
    owner: str
    repo: str
    description: Optional[str] = None
    readme_excerpt: Optional[str] = None
    tech_stack: List[str] = []
    entry_points: List[str] = []
    key_directories: List[str] = []

class AiOverviewResponse(BaseModel):
    summary: str
    what_it_does: str
    target_audience: str
    architecture_summary: str
    learning_recommendations: List[str]
    grounded_facts: List[str]
    observed_limitations: Optional[str] = None

class AiExplainFileRequest(BaseModel):
    owner: str
    repo: str
    path: str
    content: str
    repo_context: Optional[str] = None

class AiExplainFileResponse(BaseModel):
    path: str
    role_summary: str
    key_components: List[str]
    connections: List[str]
    beginner_tips: str
    citations: List[str] = []

class AiAskRequest(BaseModel):
    owner: str
    repo: str
    question: str
    language: Optional[str] = "auto"
    relevant_files: Optional[List[str]] = None
    history: Optional[List[Dict[str, str]]] = None

class AiAskResponse(BaseModel):
    answer: str
    cited_files: List[str] = []
    confidence: str = "high"
    missing_evidence: Optional[str] = None
    detected_language: Optional[str] = "en"

# Quests
class QuestStep(BaseModel):
    step_number: int
    instruction: str
    hint: Optional[str] = None
    target_path: Optional[str] = None

class KnowledgeCheck(BaseModel):
    question: str
    options: List[str]
    correct_index: int
    explanation: str

class Quest(BaseModel):
    id: str
    title: str
    category: str  # "entrypoint", "config", "test", "feature", "contributing"
    difficulty: str  # "Beginner", "Intermediate", "Advanced"
    xp_reward: int
    estimated_minutes: int
    objective: str
    why_it_matters: str
    steps: List[QuestStep]
    relevant_paths: List[str]
    knowledge_check: KnowledgeCheck
    hints: List[str]
    completed: bool = False
    completed_at: Optional[str] = None

class QuestGenerateRequest(BaseModel):
    owner: str
    repo: str

class QuestValidateRequest(BaseModel):
    repo_full_name: str
    quest_id: str
    selected_answer_index: int

class QuestValidateResponse(BaseModel):
    success: bool
    message: str
    xp_awarded: int
    explanation: str
    total_xp: int
    level: int
    level_name: str
    unlocked_badges: List[str] = []

# Contributor Readiness
class ContributorReadinessItem(BaseModel):
    id: str
    label: str
    status: str  # "Found", "Not found", "Needs verification"
    evidence_path: Optional[str] = None
    description: str
    action_suggestion: str

class ContributorReadinessReport(BaseModel):
    items: List[ContributorReadinessItem]
    score_percent: int
    readiness_level: str
    total_checks: int
    passed_checks: int

# User Progress
class UserProgress(BaseModel):
    total_xp: int = 0
    level: int = 1
    level_name: str = "Code Novice"
    completed_quest_ids: List[str] = []
    badges: List[str] = []
    repos_explored: List[str] = []

# Repository-Aware Game Specification
class GameCoordinates(BaseModel):
    x: float
    y: float

class GameInteractiveObject(BaseModel):
    id: str
    name: str
    entity_type: str
    feature_name: str
    verified_file_path: str
    explanation: str
    why_it_matters: str
    xp_reward: int = 50
    action_prompt: str
    icon: str
    activity_id: str
    coordinates: GameCoordinates
    completed: bool = False

class GameActivity(BaseModel):
    id: str
    step_number: int
    title: str
    instruction: str
    target_object_id: str
    action_label: str
    simulation_feedback: str
    xp_reward: int = 50
    completed: bool = False

class GameTheme(BaseModel):
    category: str  # "food_delivery", "ecommerce", "music", "developer_tool", "general_explorer"
    title: str
    tagline: str
    accent_color: str
    bg_gradient: str
    badge_label: str
    icon: str

class RepoGameSpec(BaseModel):
    repo_full_name: str
    category: str
    title: str
    tagline: str
    description: str
    theme: GameTheme
    activities: List[GameActivity]
    interactive_objects: List[GameInteractiveObject]
    completion_summary: Dict[str, Any]
