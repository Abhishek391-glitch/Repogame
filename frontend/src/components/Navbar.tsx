import React from "react";
import { Compass, Volume2, VolumeX, Sparkles, Trophy, ArrowLeft, Cpu } from "lucide-react";
import type { OllamaStatus, UserProgress } from "../types";
import { soundFX } from "../services/audio";

interface NavbarProps {
  currentRepo: string | null;
  ollamaStatus: OllamaStatus | null;
  progress: UserProgress | null;
  onResetRepo: () => void;
  onOpenAchievements?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRepo,
  ollamaStatus,
  progress,
  onResetRepo,
  onOpenAchievements,
}) => {
  const [muted, setMuted] = React.useState(!soundFX.enabled);

  const toggleSound = () => {
    soundFX.enabled = !soundFX.enabled;
    setMuted(!soundFX.enabled);
    if (soundFX.enabled) soundFX.playClick();
  };

  const currentXp = progress?.total_xp || 0;
  const currentLvl = progress?.level || 1;
  const levelTitle = progress?.level_name || "Code Novice";

  // XP progression scale
  const xpThresholds = [0, 150, 400, 800, 1400, 2200];
  const nextThreshold = xpThresholds[currentLvl] || 3000;
  const prevThreshold = xpThresholds[currentLvl - 1] || 0;
  const xpInCurrentLevel = Math.max(0, currentXp - prevThreshold);
  const xpNeeded = Math.max(1, nextThreshold - prevThreshold);
  const progressPercent = Math.min(100, Math.round((xpInCurrentLevel / xpNeeded) * 100));

  return (
    <header className="sticky top-0 z-40 w-full border-b border-game-border bg-game-bg/90 backdrop-blur-md px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand & Repo Info */}
        <div className="flex items-center gap-3">
          {currentRepo ? (
            <button
              onClick={() => {
                soundFX.playClick();
                onResetRepo();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-game-card hover:bg-game-cardHover border border-game-border hover:border-cyan-500/40 text-xs font-medium text-slate-300 hover:text-cyan-400 transition-all"
              title="Return to repository search"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Explore Another</span>
            </button>
          ) : null}

          <div
            onClick={() => {
              if (currentRepo) onResetRepo();
            }}
            className="flex items-center gap-2 cursor-pointer select-none group"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-brand-violet flex items-center justify-center shadow-glow-cyan">
              <Compass className="w-5 h-5 text-slate-950 transition-transform group-hover:rotate-45" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-white group-hover:text-cyan-400 transition-colors">
                  RepoQuest
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 font-semibold uppercase">
                  AI Explorer
                </span>
              </div>
              {currentRepo && (
                <div className="text-[11px] font-mono text-cyan-400/90 truncate max-w-[200px] sm:max-w-[320px]">
                  {currentRepo}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Section: Ollama Pill, Sound, Player HUD */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Ollama Status Indicator */}
          <div
            className={`hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-mono border transition-all ${
              ollamaStatus?.available
                ? "bg-cyan-950/40 border-cyan-500/30 text-cyan-300"
                : "bg-rose-950/40 border-rose-500/30 text-rose-300"
            }`}
            title={ollamaStatus?.message || "Checking local Ollama status..."}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                ollamaStatus?.available ? "bg-cyan-400 animate-pulse" : "bg-rose-500"
              }`}
            />
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {ollamaStatus?.available
                ? (ollamaStatus.configured_model || "Qwen 2.5 7B")
                : "Ollama Offline"}
            </span>
            {ollamaStatus?.latency_ms && (
              <span className="text-[10px] text-slate-400">
                {ollamaStatus.latency_ms}ms
              </span>
            )}
          </div>

          {/* Sound FX Toggle */}
          <button
            onClick={toggleSound}
            className="p-1.5 rounded-lg bg-game-card hover:bg-game-cardHover border border-game-border text-slate-400 hover:text-slate-200 transition-colors"
            title={muted ? "Unmute game sound FX" : "Mute game sound FX"}
          >
            {muted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          {/* Player HUD: Level, XP, Achievements */}
          <div
            onClick={onOpenAchievements}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-game-card border border-game-border hover:border-violet-500/40 cursor-pointer select-none transition-all shadow-hud"
            title="Click to view Player Achievements & Quests"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center font-extrabold text-xs text-white shadow-glow-violet">
              {currentLvl}
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 justify-between">
                <span className="text-[11px] font-semibold text-slate-200">{levelTitle}</span>
                <span className="text-[10px] font-mono text-amber-400 flex items-center gap-0.5">
                  <Sparkles className="w-2.5 h-2.5" />
                  {currentXp} XP
                </span>
              </div>
              {/* Mini XP bar */}
              <div className="w-24 sm:w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5 border border-slate-700/50">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {progress?.badges && progress.badges.length > 0 && (
              <div className="hidden lg:flex items-center gap-1 text-[11px] font-mono text-amber-300 ml-1 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/50">
                <Trophy className="w-3 h-3 text-amber-400" />
                <span>{progress.badges.length}</span>
              </div>
            )}
          </div>

          {/* GitHub Repo Link */}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex p-1.5 rounded-lg bg-game-card hover:bg-game-cardHover border border-game-border text-slate-400 hover:text-white transition-colors"
            title="GitHub"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
};
