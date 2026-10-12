import React, { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import {
  Sparkles,
  Compass,
  ExternalLink,
  FileCode,
  ArrowRight,
  Bike,
  Store,
  Music,
  Terminal,
  HelpCircle,
  Gamepad2,
  ListOrdered,
  Check
} from "lucide-react";
import {
  Quest,
  RepositoryAnalysis,
  RepoGameSpec,
  GameInteractiveObject,
  GameActivity
} from "../types";
import { api } from "../services/api";
import { soundFX } from "../services/audio";
import { GameCanvas } from "./game/GameCanvas";
import { DiscoveryModal } from "./game/DiscoveryModal";
import { CompletionModal } from "./game/CompletionModal";
import { PatchCompanion } from "./game/PatchCompanion";

interface QuestSystemProps {
  quests: Quest[];
  analysis: RepositoryAnalysis;
  onQuestCompleted: (questId: string, xpEarned: number, badges: string[]) => void;
  onOpenFile: (path: string) => void;
}

export const QuestSystem: React.FC<QuestSystemProps> = ({
  quests,
  analysis,
  onQuestCompleted,
  onOpenFile,
}) => {
  const [spec, setSpec] = useState<RepoGameSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Gameplay State
  const [showIntro, setShowIntro] = useState(true);
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  const [discoveredObjects, setDiscoveredObjects] = useState<string[]>([]);
  const [selectedObjectForModal, setSelectedObjectForModal] = useState<GameInteractiveObject | null>(null);
  const [simulationFeedback, setSimulationFeedback] = useState<string | undefined>();
  const [showCompletion, setShowCompletion] = useState(false);
  const [viewMode, setViewMode] = useState<"2d" | "board">("2d");
  const [sessionXpEarned, setSessionXpEarned] = useState(0);

  // Fetch Game Specification & Progress
  useEffect(() => {
    let isMounted = true;

    const loadGameSpec = async () => {
      setLoading(true);
      setError(null);
      try {
        const [gameSpec, progressData] = await Promise.all([
          api.getGameSpec(analysis.owner, analysis.repo),
          api.getGameProgress(analysis.owner, analysis.repo).catch(() => null),
        ]);

        if (!isMounted) return;
        setSpec(gameSpec);

        // Pre-populate completed objects from progress data if available
        const initialDiscovered: string[] = [];
        if (progressData?.user_progress?.completed_quest_ids) {
          gameSpec.interactive_objects.forEach((obj) => {
            const key = `${gameSpec.repo_full_name}::discovery::${obj.id}`;
            if (progressData.user_progress.completed_quest_ids.includes(key)) {
              initialDiscovered.push(obj.id);
            }
          });
        }
        setDiscoveredObjects(initialDiscovered);

        // Determine current activity index
        const firstIncompleteIdx = gameSpec.activities.findIndex(
          (act) => !initialDiscovered.includes(act.target_object_id)
        );
        if (firstIncompleteIdx !== -1) {
          setCurrentActivityIndex(firstIncompleteIdx);
        } else if (initialDiscovered.length > 0) {
          setCurrentActivityIndex(gameSpec.activities.length - 1);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : "Failed to load game specification.";
        setError(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadGameSpec();
    return () => {
      isMounted = false;
    };
  }, [analysis.owner, analysis.repo]);

  // Handle Station Interaction
  const handleInteractWithObject = async (obj: GameInteractiveObject) => {
    if (!spec) return;

    soundFX.playClick();
    const isFirstTime = !discoveredObjects.includes(obj.id);

    let feedbackMsg = `Simulated action completed: ${obj.action_prompt}`;

    if (isFirstTime) {
      try {
        const res = await api.recordGameDiscovery({
          repo_full_name: spec.repo_full_name,
          object_id: obj.id,
          object_name: obj.name,
          path: obj.verified_file_path,
          category: obj.entity_type,
          xp_reward: obj.xp_reward,
        });

        soundFX.playXpGain();
        setSessionXpEarned((prev) => prev + res.xp_awarded);

        // Update local discovered list
        const updated = [...discoveredObjects, obj.id];
        setDiscoveredObjects(updated);

        // Trigger confetti for the discovery
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          colors: ["#06b6d4", "#10b981", "#f59e0b", "#8b5cf6"],
        });

        // Notify parent App component to update user XP and badges
        onQuestCompleted(obj.id, res.xp_awarded, res.new_badges);

        // Save progress to database
        await api.saveGameProgress({
          repo_full_name: spec.repo_full_name,
          discovered_objects: updated,
          discovered_areas: [obj.entity_type],
          current_objective_index: currentActivityIndex,
          portal_unlocked: updated.length >= spec.activities.length,
          portal_completed: updated.length >= spec.interactive_objects.length,
        });
      } catch (err) {
        console.warn("Could not save discovery:", err);
      }
    }

    // Match with current activity
    const matchingAct = spec.activities.find((a) => a.target_object_id === obj.id);
    if (matchingAct) {
      feedbackMsg = matchingAct.simulation_feedback;
      // Advance to next activity if current activity was targeted
      if (matchingAct.id === currentActivity?.id) {
        if (currentActivityIndex + 1 < spec.activities.length) {
          setCurrentActivityIndex((prev) => prev + 1);
        } else {
          // Completed all activities!
          setShowCompletion(true);
          soundFX.playQuestComplete();
        }
      }
    }

    setSimulationFeedback(feedbackMsg);
    setSelectedObjectForModal(obj);
  };

  const handleReplay = () => {
    setCurrentActivityIndex(0);
    setShowCompletion(false);
    soundFX.playClick();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 rounded-2xl bg-game-card/50 border border-game-border text-center space-y-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <div className="absolute inset-2 rounded-full border-2 border-indigo-500/20 border-b-indigo-400 animate-spin-reverse" />
        </div>
        <div>
          <h3 className="font-bold text-white text-base">Analyzing Repository Purpose...</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            AI is identifying the repository's domain and generating a tailored exploration game.
          </p>
        </div>
      </div>
    );
  }

  if (error || !spec) {
    return (
      <div className="p-8 rounded-2xl bg-rose-950/20 border border-rose-800/40 text-center space-y-3">
        <h3 className="font-bold text-rose-300">Could Not Initialize Game</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">{error || "Game specification is unavailable."}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
        >
          Retry
        </button>
      </div>
    );
  }

  const currentActivity: GameActivity | undefined = spec.activities[currentActivityIndex];
  const targetObject = spec.interactive_objects.find(
    (o) => o.id === currentActivity?.target_object_id
  );
  const progressPercent = Math.round(
    (discoveredObjects.length / Math.max(1, spec.interactive_objects.length)) * 100
  );

  // Genre Icon Mapper
  const renderGenreIcon = (cat: string) => {
    switch (cat) {
      case "food_delivery":
        return <Bike className="w-4 h-4 text-orange-400" />;
      case "ecommerce":
        return <Store className="w-4 h-4 text-emerald-400" />;
      case "music":
        return <Music className="w-4 h-4 text-purple-400" />;
      case "developer_tool":
        return <Terminal className="w-4 h-4 text-cyan-400" />;
      default:
        return <Compass className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Information Ribbon */}
      <div className="p-4 rounded-2xl bg-game-card/80 border border-game-border backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs font-sans">
        {/* Left: Title & Genre Tag */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
            {renderGenreIcon(spec.category)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white">{spec.title}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950/80 border border-cyan-800/60 text-cyan-300">
                {spec.theme.badge_label}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{spec.tagline}</p>
          </div>
        </div>

        {/* Right: Progress & Controls */}
        <div className="flex items-center gap-3">
          {/* Progress Bar */}
          <div className="hidden sm:flex flex-col items-end gap-1">
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-slate-400">Features Discovered:</span>
              <span className="text-cyan-300 font-bold">
                {discoveredObjects.length} / {spec.interactive_objects.length}
              </span>
            </div>
            <div className="w-36 h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center rounded-xl bg-slate-900 p-1 border border-slate-800">
            <button
              onClick={() => {
                soundFX.playClick();
                setViewMode("2d");
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === "2d" ? "bg-cyan-600 text-white font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">2D World</span>
            </button>
            <button
              onClick={() => {
                soundFX.playClick();
                setViewMode("board");
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === "board" ? "bg-cyan-600 text-white font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Station Board</span>
            </button>
          </div>

          {/* Help Intro Button */}
          <button
            onClick={() => setShowIntro(true)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="How to Play"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Current Objective Alert Bar */}
      {currentActivity && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-cyan-950/50 via-slate-900/90 to-indigo-950/50 border border-cyan-500/30 flex items-center justify-between gap-3 text-xs font-sans">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-bold shrink-0 font-mono">
              {currentActivity.step_number}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-mono text-cyan-400 font-bold">
                Current Mission: {currentActivity.title}
              </div>
              <div className="text-slate-200 text-xs mt-0.5">{currentActivity.instruction}</div>
            </div>
          </div>

          {targetObject && (
            <button
              onClick={() => handleInteractWithObject(targetObject)}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 transition-all shadow-glow-cyan"
            >
              <span>{targetObject.action_prompt}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* 3. Main Gameplay Display Area */}
      {viewMode === "2d" ? (
        <div className="relative">
          <GameCanvas
            spec={spec}
            discoveredObjectIds={discoveredObjects}
            activeObjectId={currentActivity?.target_object_id || null}
            onInteractWithObject={handleInteractWithObject}
            isPaused={showIntro || !!selectedObjectForModal || showCompletion}
          />

          {/* Controls Overlay Legend */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-mono px-2">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                WASD
              </span>
              <span>or</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                Arrow Keys
              </span>
              <span>Move</span>
              <span className="mx-1">•</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                Click
              </span>
              <span>Walk / Interact</span>
              <span className="mx-1">•</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                E
              </span>
              <span>Explore Station</span>
            </div>

            <div className="flex items-center gap-2 text-cyan-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Walk up to glowing beacons to discover real source files!</span>
            </div>
          </div>
        </div>
      ) : (
        /* Alternative View: Station Mission Board (Accessible 1-Click Cards) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {spec.interactive_objects.map((obj, idx) => {
            const isDiscovered = discoveredObjects.includes(obj.id);
            const isTarget = currentActivity?.target_object_id === obj.id;

            return (
              <div
                key={obj.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                  isTarget
                    ? "bg-slate-900 border-cyan-500/70 shadow-glow-cyan"
                    : isDiscovered
                    ? "bg-slate-900/60 border-emerald-900/40"
                    : "bg-slate-900/40 border-slate-800"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isDiscovered
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                          : isTarget
                          ? "bg-cyan-950 text-cyan-400 border border-cyan-800/60"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-bold text-white text-xs">{obj.name}</div>
                      <div className="text-[11px] font-mono text-cyan-400">{obj.feature_name}</div>
                    </div>
                  </div>

                  {isDiscovered ? (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/50">
                      <Check className="w-3 h-3" /> Discovered
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/50">
                      +{obj.xp_reward} XP
                    </span>
                  )}
                </div>

                <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800/80 font-mono text-[11px] text-slate-300 flex items-center gap-2">
                  <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">{obj.verified_file_path}</span>
                </div>

                <p className="text-slate-300 text-xs line-clamp-2 leading-relaxed">
                  {obj.explanation}
                </p>

                <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-800/60">
                  <button
                    onClick={() => onOpenFile(obj.verified_file_path)}
                    className="text-xs text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                  >
                    <span>View Code</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>

                  <button
                    onClick={() => handleInteractWithObject(obj)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isTarget
                        ? "bg-cyan-600 hover:bg-cyan-500 text-white shadow-glow-cyan"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                    }`}
                  >
                    {obj.action_prompt}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. AI Companion "Patch" */}
      <PatchCompanion
        currentActivity={currentActivity || null}
        repoFullName={spec.repo_full_name}
        activeObject={targetObject || null}
      />

      {/* 5. First-Time Player Introduction Screen */}
      {showIntro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center mx-auto text-white shadow-lg shadow-cyan-500/20">
              {renderGenreIcon(spec.category)}
            </div>

            <div>
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest font-bold">
                {spec.theme.badge_label}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                Welcome to {spec.title}!
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
                Explore this project through an interactive simulation. As you play, you'll discover the real code behind each feature!
              </p>
            </div>

            {/* Three Simple Visual Instructions */}
            <div className="grid grid-cols-3 gap-3 text-left">
              <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase">1. MOVE</span>
                <p className="text-[11px] text-slate-300">Use WASD, arrow keys, or click to move.</p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase">2. INTERACT</span>
                <p className="text-[11px] text-slate-300">Walk up to stations or click them to simulate actions.</p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase">3. DISCOVER</span>
                <p className="text-[11px] text-slate-300">Uncover the real source code files powering the app.</p>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => {
                  soundFX.playClick();
                  setShowIntro(false);
                }}
                className="w-full py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm transition-all shadow-glow-cyan"
              >
                Let's Explore
              </button>
              <button
                onClick={() => setShowIntro(false)}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Skip introduction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Object Discovery Modal */}
      {selectedObjectForModal && (
        <DiscoveryModal
          object={selectedObjectForModal}
          repoFullName={spec.repo_full_name}
          githubBaseUrl={analysis.html_url}
          onClose={() => setSelectedObjectForModal(null)}
          onOpenFile={onOpenFile}
          simulationFeedback={simulationFeedback}
        />
      )}

      {/* 7. Adventure Complete Modal */}
      {showCompletion && (
        <CompletionModal
          spec={spec}
          discoveredObjects={discoveredObjects}
          totalXp={sessionXpEarned}
          githubBaseUrl={analysis.html_url}
          onClose={() => setShowCompletion(false)}
          onOpenFile={onOpenFile}
          onPlayAgain={handleReplay}
        />
      )}
    </div>
  );
};
