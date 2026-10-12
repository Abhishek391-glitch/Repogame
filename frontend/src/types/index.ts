export interface OllamaStatus {
  available: boolean;
  configured_model: string;
  model_installed: boolean;
  available_models: string[];
  base_url: string;
  latency_ms: number | null;
  message: string;
  setup_instructions: string[] | null;
}

export interface FileTreeNode {
  path: string;
  type: "blob" | "tree";
  category: "entrypoint" | "config" | "test" | "doc" | "source" | "asset" | "directory";
  name: string;
  extension: string;
  size?: number | null;
  importance: "high" | "medium" | "low";
  reason?: string | null;
  language?: string | null;
  [key: string]: unknown;
}

export interface TechStackDetection {
  languages: string[];
  frameworks: string[];
  package_managers: string[];
  test_frameworks: string[];
  build_tools: string[];
}

export interface RepositoryAnalysis {
  owner: string;
  repo: string;
  full_name: string;
  description?: string | null;
  stars: number;
  forks: number;
  default_branch: string;
  html_url: string;
  license?: string | null;
  has_readme: boolean;
  readme_preview?: string | null;
  readme_full?: string | null;
  tree: FileTreeNode[];
  entry_points: string[];
  config_files: string[];
  test_files: string[];
  doc_files: string[];
  tech_stack: TechStackDetection;
  is_truncated: boolean;
  total_files_analyzed: number;
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
  truncated: boolean;
  is_binary: boolean;
  html_url: string;
}

export interface AiOverview {
  summary: string;
  what_it_does: string;
  target_audience: string;
  architecture_summary: string;
  learning_recommendations: string[];
  grounded_facts: string[];
  observed_limitations?: string | null;
}

export interface AiExplainFile {
  path: string;
  role_summary: string;
  key_components: string[];
  connections: string[];
  beginner_tips: string;
  citations: string[];
}

export interface AiAskRequest {
  owner: string;
  repo: string;
  question: string;
  language?: string;
  relevant_files?: string[];
  history?: Array<{ role: "user" | "assistant" | "ai"; content: string }>;
}

export interface AiAskResponse {
  answer: string;
  cited_files: string[];
  confidence: "high" | "medium" | "low";
  missing_evidence?: string | null;
  detected_language?: string;
}

export interface QuestStep {
  step_number: number;
  instruction: string;
  hint?: string | null;
  target_path?: string | null;
}

export interface KnowledgeCheck {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface Quest {
  id: string;
  title: string;
  category: "entrypoint" | "config" | "test" | "feature" | "contributing";
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  xp_reward: number;
  estimated_minutes: number;
  objective: string;
  why_it_matters: string;
  steps: QuestStep[];
  relevant_paths: string[];
  knowledge_check: KnowledgeCheck;
  hints: string[];
  completed: boolean;
  completed_at?: string | null;
}

export interface QuestValidateResponse {
  success: boolean;
  message: string;
  xp_awarded: number;
  explanation: string;
  total_xp: number;
  level: number;
  level_name: string;
  unlocked_badges: string[];
}

export interface ContributorReadinessItem {
  id: string;
  label: string;
  status: "Found" | "Not found" | "Needs verification";
  evidence_path?: string | null;
  description: string;
  action_suggestion: string;
}

export interface ContributorReadinessReport {
  items: ContributorReadinessItem[];
  score_percent: number;
  readiness_level: string;
  total_checks: number;
  passed_checks: number;
}

export interface UserProgress {
  total_xp: number;
  level: number;
  level_name: string;
  completed_quest_ids: string[];
  badges: string[];
  repos_explored: string[];
}

export interface GameCoordinates {
  x: number;
  y: number;
}

export interface GameInteractiveObject {
  id: string;
  name: string;
  entity_type: string;
  feature_name: string;
  verified_file_path: string;
  explanation: string;
  why_it_matters: string;
  xp_reward: number;
  action_prompt: string;
  icon: string;
  activity_id: string;
  coordinates: GameCoordinates;
  completed: boolean;
}

export interface GameActivity {
  id: string;
  step_number: number;
  title: string;
  instruction: string;
  target_object_id: string;
  action_label: string;
  simulation_feedback: string;
  xp_reward: number;
  completed: boolean;
}

export interface GameTheme {
  category: "food_delivery" | "ecommerce" | "music" | "developer_tool" | "general_explorer";
  title: string;
  tagline: string;
  accent_color: string;
  bg_gradient: string;
  badge_label: string;
  icon: string;
}

export interface RepoGameSpec {
  repo_full_name: string;
  category: "food_delivery" | "ecommerce" | "music" | "developer_tool" | "general_explorer";
  title: string;
  tagline: string;
  description: string;
  theme: GameTheme;
  activities: GameActivity[];
  interactive_objects: GameInteractiveObject[];
  completion_summary: {
    title: string;
    summary: string;
    next_steps: string[];
  };
}

export interface GameDiscoveryResponse {
  already_discovered: boolean;
  xp_awarded: number;
  total_xp: number;
  level: number;
  level_name: string;
  new_badges: string[];
}
