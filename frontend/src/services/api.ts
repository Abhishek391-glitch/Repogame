import {
  OllamaStatus,
  RepositoryAnalysis,
  FileContent,
  AiOverview,
  AiExplainFile,
  AiAskResponse,
  Quest,
  QuestValidateResponse,
  ContributorReadinessReport,
  UserProgress
} from "../types";

const API_BASE = "http://localhost:8000/api";

class ApiService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    try {
      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
        ...options,
      });

      if (!res.ok) {
        let errMessage = `HTTP error ${res.status}`;
        try {
          const errData = await res.json();
          if (errData.detail) errMessage = errData.detail;
        } catch {
          // ignore json parse error
        }
        throw new Error(errMessage);
      }

      return (await res.json()) as T;
    } catch (err: unknown) {
      if (err instanceof Error) {
        throw err;
      }
      throw new Error("Unable to connect to RepoQuest backend. Ensure the Python server is running.");
    }
  }

  async checkHealth(): Promise<{ status: string; service: string; version: string }> {
    return this.request("/health");
  }

  async getOllamaStatus(): Promise<OllamaStatus> {
    return this.request("/ollama/status");
  }

  async analyzeRepository(url: string): Promise<RepositoryAnalysis> {
    return this.request("/repository/analyze", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
  }

  async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<FileContent> {
    const params = new URLSearchParams({ owner, repo, path });
    if (ref) params.append("ref", ref);
    return this.request(`/repository/file?${params.toString()}`);
  }

  async getContributorReadiness(owner: string, repo: string): Promise<ContributorReadinessReport> {
    const params = new URLSearchParams({ owner, repo });
    return this.request(`/repository/readiness?${params.toString()}`);
  }

  async getAiOverview(params: {
    owner: string;
    repo: string;
    description?: string | null;
    readme_excerpt?: string | null;
    tech_stack: string[];
    entry_points: string[];
    key_directories: string[];
  }): Promise<AiOverview> {
    return this.request("/ai/overview", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async explainFileWithAi(params: {
    owner: string;
    repo: string;
    path: string;
    content: string;
    repo_context?: string;
  }): Promise<AiExplainFile> {
    return this.request("/ai/explain-file", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async askRepoAi(params: {
    owner: string;
    repo: string;
    question: string;
    relevant_files?: string[];
  }): Promise<AiAskResponse> {
    return this.request("/ai/ask", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async generateQuests(owner: string, repo: string): Promise<Quest[]> {
    return this.request("/quests/generate", {
      method: "POST",
      body: JSON.stringify({ owner, repo }),
    });
  }

  async validateQuest(params: {
    repo_full_name: string;
    quest_id: string;
    selected_answer_index: number;
  }): Promise<QuestValidateResponse> {
    return this.request("/quests/validate", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async getUserProgress(): Promise<UserProgress> {
    return this.request("/progress");
  }

  async resetUserProgress(): Promise<{ message: string }> {
    return this.request("/progress/reset", {
      method: "POST",
    });
  }
}

export const api = new ApiService();
