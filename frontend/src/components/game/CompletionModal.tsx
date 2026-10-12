import React from "react";
import {
  Trophy,
  Sparkles,
  FileCode,
  ExternalLink,
  CheckCircle2,
  GitPullRequest,
  BookOpen,
  ArrowRight,
  RotateCcw,
  X
} from "lucide-react";
import { RepoGameSpec } from "../../types";

interface CompletionModalProps {
  spec: RepoGameSpec;
  discoveredObjects: string[];
  totalXp: number;
  githubBaseUrl: string;
  onClose: () => void;
  onOpenFile: (path: string) => void;
  onPlayAgain: () => void;
}

export const CompletionModal: React.FC<CompletionModalProps> = ({
  spec,
  discoveredObjects,
  totalXp,
  githubBaseUrl,
  onClose,
  onOpenFile,
  onPlayAgain,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Banner */}
        <div className="relative p-6 bg-gradient-to-br from-indigo-950 via-slate-900 to-cyan-950 border-b border-slate-800 text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20">
            <Trophy className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            Code Adventure Complete!
          </h2>
          <p className="text-xs sm:text-sm text-cyan-200/90 max-w-md mx-auto">
            You explored the core workflow of <span className="font-bold text-white">{spec.repo_full_name}</span> and uncovered the real source code powering each feature.
          </p>

          <div className="flex items-center justify-center gap-3 pt-2">
            <span className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-mono text-cyan-300">
              {discoveredObjects.length} / {spec.interactive_objects.length} Features Discovered
            </span>
            <span className="px-3 py-1 rounded-full bg-amber-950/70 border border-amber-800/50 text-xs font-mono text-amber-300 font-bold">
              +{spec.activities.reduce((acc, a) => acc + a.xp_reward, 0)} Adventure XP Earned
            </span>
          </div>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Real Files Discovered */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-cyan-400" />
              Verified Code Discovered In This Run:
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {spec.interactive_objects.map((obj) => (
                <div
                  key={obj.id}
                  className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between gap-2 hover:border-slate-600 transition-colors"
                >
                  <div className="overflow-hidden">
                    <div className="text-xs font-bold text-white truncate">
                      {obj.name}
                    </div>
                    <div className="text-[11px] font-mono text-cyan-300 truncate">
                      {obj.verified_file_path}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onOpenFile(obj.verified_file_path);
                      onClose();
                    }}
                    className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-cyan-600 text-slate-300 hover:text-white transition-colors shrink-0"
                    title="Inspect in File Explorer"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Next Steps for Contributing */}
          <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-900/60 space-y-2.5">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs uppercase tracking-wider font-mono">
              <GitPullRequest className="w-4 h-4 text-cyan-400" />
              Suggested Next Steps For Your First Contribution:
            </div>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {spec.completion_summary.next_steps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onPlayAgain}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Replay Simulation</span>
          </button>

          <div className="flex items-center gap-2">
            <a
              href={githubBaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open on GitHub</span>
            </a>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-glow-cyan"
            >
              Continue Exploring
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
