import React, { useState, useEffect } from "react";
import {
  Map,
  Award,
  FolderOpen,
  Cpu,
  Layers,
  ShieldCheck,
  MessageSquare,
  Sparkles,
  GitBranch,
  Star,
  GitFork,
  BookOpen,
  ExternalLink,
  RefreshCw,
  Trophy
} from "lucide-react";
import {
  RepositoryAnalysis,
  Quest,
  OllamaStatus,
  UserProgress
} from "./types";
import { api } from "./services/api";
import { soundFX } from "./services/audio";

import { Navbar } from "./components/Navbar";
import { LandingPage } from "./components/LandingPage";
import { RepoMap } from "./components/RepoMap";
import { QuestSystem } from "./components/QuestSystem";
import { FileExplorer } from "./components/FileExplorer";
import { ArchitectureView } from "./components/ArchitectureView";
import { ReadinessDashboard } from "./components/ReadinessDashboard";
import { AskRepo } from "./components/AskRepo";
import { AchievementsModal } from "./components/AchievementsModal";

type ActiveTab = "map" | "quests" | "files" | "architecture" | "readiness" | "ask";

export const App: React.FC = () => {
  // Application State
  const [analysis, setAnalysis] = useState<RepositoryAnalysis | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("map");
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  // Status & Progress State
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAchievements, setShowAchievements] = useState(false);

  // Initial Load: Ollama Status & User Progress
  useEffect(() => {
    const fetchStatusAndProgress = async () => {
      try {
        const [oStatus, uProgress] = await Promise.all([
          api.getOllamaStatus(),
          api.getUserProgress(),
        ]);
        setOllamaStatus(oStatus);
        setProgress(uProgress);
      } catch (err: unknown) {
        console.warn("Initial backend status check:", err);
      }
    };

    fetchStatusAndProgress();
    const interval = setInterval(fetchStatusAndProgress, 20000); // Check every 20s
    return () => clearInterval(interval);
  }, []);

  // Handle Repository Analysis
  const handleAnalyze = async (url: string) => {
    setLoading(true);
    setError(null);

    try {
      const repoAnalysis = await api.analyzeRepository(url);
      setAnalysis(repoAnalysis);

      // Generate Quests
      const generatedQuests = await api.generateQuests(
        repoAnalysis.owner,
        repoAnalysis.repo
      );
      setQuests(generatedQuests);

      // Refresh Progress
      const updatedProgress = await api.getUserProgress();
      setProgress(updatedProgress);

      setActiveTab("map");
      soundFX.playXpGain();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to analyze repository.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuestCompleted = async (
    questId: string,
    xpEarned: number,
    newBadges: string[]
  ) => {
    // Update local quests state
    setQuests((prev) =>
      prev.map((q) => (q.id === questId ? { ...q, completed: true } : q))
    );

    // Refresh progress from database
    const updatedProgress = await api.getUserProgress();
    setProgress(updatedProgress);
  };

  const handleOpenFileInExplorer = (path: string) => {
    setSelectedFilePath(path);
    setActiveTab("files");
    soundFX.playClick();
  };

  const handleExplainFileInExplorer = (path: string) => {
    setSelectedFilePath(path);
    setActiveTab("files");
    soundFX.playClick();
  };

  const handleResetProgress = async () => {
    await api.resetUserProgress();
    const updatedProgress = await api.getUserProgress();
    setProgress(updatedProgress);
    // Unmark local quests
    setQuests((prev) => prev.map((q) => ({ ...q, completed: false })));
  };

  return (
    <div className="min-h-screen bg-game-bg text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navbar */}
      <Navbar
        currentRepo={analysis ? analysis.full_name : null}
        ollamaStatus={ollamaStatus}
        progress={progress}
        onResetRepo={() => {
          setAnalysis(null);
          setQuests([]);
          setError(null);
        }}
        onOpenAchievements={() => setShowAchievements(true)}
      />

      {/* Main Content Area */}
      {!analysis ? (
        <LandingPage
          onAnalyze={handleAnalyze}
          loading={loading}
          error={error}
          ollamaStatus={ollamaStatus}
        />
      ) : (
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-5 flex flex-col">
          {/* Workspace Sub-Header Info Bar */}
          <div className="mb-4 p-3.5 rounded-2xl bg-game-card/80 border border-game-border backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            {/* Repo Identity & Branch */}
            <div className="flex items-center gap-3">
              <span className="font-extrabold text-sm text-white">
                {analysis.full_name}
              </span>
              <div className="flex items-center gap-1 text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                <span>{analysis.default_branch}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400" />
                  {analysis.stars.toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <GitFork className="w-3 h-3 text-slate-400" />
                  {analysis.forks.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Tech Stack Pills */}
            <div className="hidden md:flex items-center gap-1.5">
              {analysis.tech_stack.languages.slice(0, 3).map((lang) => (
                <span
                  key={lang}
                  className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40 text-cyan-300 text-[10px]"
                >
                  {lang}
                </span>
              ))}
              <span className="text-slate-500 text-[11px]">
                {analysis.total_files_analyzed} files mapped
              </span>
            </div>
          </div>

          {/* Navigation Tabs Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 border-b border-game-border text-xs font-mono">
            {[
              { id: "map", label: "Map Explorer", icon: Map },
              {
                id: "quests",
                label: "Quests",
                icon: Award,
                badge: `${quests.filter((q) => q.completed).length}/${quests.length}`,
              },
              { id: "files", label: "File Explorer", icon: FolderOpen },
              { id: "architecture", label: "Architecture", icon: Layers },
              { id: "readiness", label: "Contributor Readiness", icon: ShieldCheck },
              { id: "ask", label: "Ask Repo AI", icon: MessageSquare },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    soundFX.playClick();
                    setActiveTab(tab.id as ActiveTab);
                  }}
                  className={`px-3.5 py-2 rounded-xl border transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
                    isActive
                      ? "bg-game-card border-cyan-500/60 text-cyan-300 font-bold shadow-glow-cyan"
                      : "bg-game-card/40 border-game-border text-slate-400 hover:bg-game-cardHover hover:text-slate-200"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-cyan-400" : "text-slate-400"}`} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-bold">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Tab View */}
          <main className="flex-1">
            {activeTab === "map" && (
              <RepoMap
                analysis={analysis}
                onSelectFile={handleOpenFileInExplorer}
                onExplainFile={handleExplainFileInExplorer}
              />
            )}

            {activeTab === "quests" && (
              <QuestSystem
                quests={quests}
                analysis={analysis}
                onQuestCompleted={handleQuestCompleted}
                onOpenFile={handleOpenFileInExplorer}
              />
            )}

            {activeTab === "files" && (
              <FileExplorer
                analysis={analysis}
                initialSelectedPath={selectedFilePath}
              />
            )}

            {activeTab === "architecture" && (
              <ArchitectureView
                analysis={analysis}
                onOpenFile={handleOpenFileInExplorer}
              />
            )}

            {activeTab === "readiness" && (
              <ReadinessDashboard
                analysis={analysis}
                onOpenFile={handleOpenFileInExplorer}
              />
            )}

            {activeTab === "ask" && (
              <AskRepo
                analysis={analysis}
                onOpenFile={handleOpenFileInExplorer}
              />
            )}
          </main>
        </div>
      )}

      {/* Achievements Modal */}
      {showAchievements && (
        <AchievementsModal
          progress={progress}
          onClose={() => setShowAchievements(false)}
          onResetProgress={handleResetProgress}
        />
      )}
    </div>
  );
};

export default App;
