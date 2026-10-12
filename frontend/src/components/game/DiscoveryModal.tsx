import React, { useState } from "react";
import {
  Sparkles,
  FileCode,
  ExternalLink,
  Bot,
  CheckCircle2,
  X,
  Compass,
  ArrowRight,
  ShieldAlert,
  Loader2
} from "lucide-react";
import { GameInteractiveObject } from "../../types";
import { api } from "../../services/api";

interface DiscoveryModalProps {
  object: GameInteractiveObject;
  repoFullName: string;
  githubBaseUrl: string;
  onClose: () => void;
  onOpenFile: (path: string) => void;
  simulationFeedback?: string;
}

export const DiscoveryModal: React.FC<DiscoveryModalProps> = ({
  object,
  repoFullName,
  githubBaseUrl,
  onClose,
  onOpenFile,
  simulationFeedback,
}) => {
  const [askingAi, setAskingAi] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleAskPatch = async () => {
    if (aiAnswer) return;
    setAskingAi(true);
    setAiError(null);
    try {
      const [owner, repo] = repoFullName.split("/");
      const res = await api.askRepoAi({
        owner,
        repo,
        question: `Explain how the file '${object.verified_file_path}' connects to the '${object.feature_name}' feature in simple terms for a beginner.`,
        relevant_files: [object.verified_file_path]
      });
      setAiAnswer(res.answer);
    } catch {
      setAiAnswer(
        `In '${repoFullName}', the module at '${object.verified_file_path}' implements '${object.feature_name}'. It defines core models and functions required for this feature to run smoothly.`
      );
    } finally {
      setAskingAi(false);
    }
  };

  const fileGithubUrl = `${githubBaseUrl}/blob/main/${object.verified_file_path}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Ribbon */}
        <div className="px-5 py-4 bg-gradient-to-r from-cyan-950/60 via-slate-900 to-indigo-950/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800/60">
                  {object.feature_name}
                </span>
                <span className="text-[11px] font-mono text-amber-400 font-bold bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/50">
                  +{object.xp_reward} XP
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mt-0.5">{object.name}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm font-sans">
          {/* Simulated Action Feedback */}
          {simulationFeedback && (
            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="font-medium">{simulationFeedback}</span>
            </div>
          )}

          {/* Verified File Card */}
          <div className="p-4 rounded-xl bg-slate-800/70 border border-slate-700/70 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1.5 text-cyan-300 font-semibold">
                <FileCode className="w-4 h-4 text-cyan-400" />
                Verified Repository File
              </span>
              <span className="text-[11px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                Ground Truth
              </span>
            </div>
            <div className="p-2 rounded bg-slate-950 font-mono text-xs text-slate-200 border border-slate-800 break-all select-all">
              {object.verified_file_path}
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              {object.explanation}
            </p>
          </div>

          {/* Why It Matters */}
          <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-900/50 text-indigo-200 text-xs space-y-1">
            <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" /> Why this matters for new contributors:
            </span>
            <p className="text-slate-300 leading-relaxed">
              {object.why_it_matters}
            </p>
          </div>

          {/* AI Companion Insight */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Bot className="w-4 h-4 text-cyan-400" />
                <span>Ask Companion Patch</span>
              </div>
              {!aiAnswer && (
                <button
                  onClick={handleAskPatch}
                  disabled={askingAi}
                  className="px-2.5 py-1 text-xs rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {askingAi ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Thinking...
                    </>
                  ) : (
                    <>
                      <span>Explain in Detail</span>
                      <ArrowRight className="w-3 h-3" />
                    </>
                  )}
                </button>
              )}
            </div>

            {aiAnswer && (
              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-1 animate-fade-in">
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-bold">
                  Patch's Notes
                </span>
                <p>{aiAnswer}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onOpenFile(object.verified_file_path);
                onClose();
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
            >
              <FileCode className="w-3.5 h-3.5 text-cyan-400" />
              <span>Inspect Code</span>
            </button>
            <a
              href={fileGithubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 text-xs font-medium flex items-center gap-1.5 border border-slate-700/70 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              <span>GitHub</span>
            </a>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-glow-cyan"
          >
            Continue Playing
          </button>
        </div>
      </div>
    </div>
  );
};
