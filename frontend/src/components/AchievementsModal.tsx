import React from "react";
import {
  Trophy,
  Sparkles,
  Award,
  CheckCircle2,
  X,
  Compass,
  RotateCcw,
  ShieldCheck
} from "lucide-react";
import { UserProgress } from "../types";
import { soundFX } from "../services/audio";

interface AchievementsModalProps {
  progress: UserProgress | null;
  onClose: () => void;
  onResetProgress: () => void;
}

const ALL_BADGES = [
  {
    name: "First Discovery",
    desc: "Completed your first repository quest!",
    icon: Compass,
    color: "from-cyan-500 to-blue-500",
  },
  {
    name: "README Detective",
    desc: "Mastered project documentation and entry points!",
    icon: Award,
    color: "from-amber-500 to-orange-500",
  },
  {
    name: "Configuration Explorer",
    desc: "Decoded build manifests and environment setups!",
    icon: Sparkles,
    color: "from-violet-500 to-purple-500",
  },
  {
    name: "Test Suite Scout",
    desc: "Explored verification patterns and test suites!",
    icon: ShieldCheck,
    color: "from-emerald-500 to-teal-500",
  },
  {
    name: "Contribution Ready",
    desc: "Completed all newcomer contribution preparation guidelines!",
    icon: Trophy,
    color: "from-yellow-400 to-amber-500",
  },
];

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  progress,
  onClose,
  onResetProgress,
}) => {
  const currentXp = progress?.total_xp || 0;
  const currentLvl = progress?.level || 1;
  const levelTitle = progress?.level_name || "Code Novice";
  const badgesUnlocked = progress?.badges || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-xl bg-game-card border border-cyan-500/40 rounded-2xl p-6 shadow-glow-cyan flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-game-border mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-glow-amber">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">
                Player Profile & Achievements
              </h2>
              <div className="text-[11px] font-mono text-cyan-400">
                Level {currentLvl}: {levelTitle}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              soundFX.playClick();
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Level Stats Card */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 mb-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-mono text-slate-400">Total Experience Earned</div>
            <div className="text-2xl font-extrabold font-mono text-amber-400 flex items-center gap-1.5 mt-0.5">
              <Sparkles className="w-5 h-5" />
              <span>{currentXp} XP</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-mono text-slate-400">Quests Completed</div>
            <div className="text-xl font-extrabold font-mono text-cyan-400 mt-0.5">
              {progress?.completed_quest_ids?.length || 0}
            </div>
          </div>
        </div>

        {/* Badges List */}
        <div className="space-y-3 mb-6">
          <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
            Achievement Badges ({badgesUnlocked.length}/{ALL_BADGES.length})
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ALL_BADGES.map((b) => {
              const unlocked = badgesUnlocked.includes(b.name);
              const Icon = b.icon;
              return (
                <div
                  key={b.name}
                  className={`p-3 rounded-xl border flex items-start gap-3 transition-all ${
                    unlocked
                      ? "bg-slate-900/80 border-cyan-500/30 text-white shadow-glow-cyan"
                      : "bg-slate-950/40 border-slate-800/80 text-slate-500 opacity-60"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      unlocked
                        ? `bg-gradient-to-br ${b.color} text-slate-950`
                        : "bg-slate-800 text-slate-600"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs font-bold font-mono truncate">{b.name}</div>
                    <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                      {b.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Repos Explored */}
        {progress?.repos_explored && progress.repos_explored.length > 0 && (
          <div className="mb-6 pt-3 border-t border-game-border">
            <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">
              Explored Repositories History
            </div>
            <div className="flex flex-wrap gap-1.5 font-mono text-xs">
              {progress.repos_explored.map((r) => (
                <span
                  key={r}
                  className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Reset Progress Button */}
        <div className="pt-3 border-t border-game-border flex items-center justify-between text-xs font-mono">
          <button
            onClick={() => {
              if (window.confirm("Reset all XP, badges, and completed quests for a fresh run?")) {
                soundFX.playClick();
                onResetProgress();
              }
            }}
            className="flex items-center gap-1.5 text-slate-500 hover:text-rose-400 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Progress</span>
          </button>

          <button
            onClick={() => {
              soundFX.playClick();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
