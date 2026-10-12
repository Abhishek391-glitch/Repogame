import React, { useState, useEffect } from "react";
import {
  Compass,
  Cpu,
  Layers,
  ArrowRight,
  Sparkles,
  BookOpen,
  Code2,
  CheckCircle2,
  ExternalLink,
  Info
} from "lucide-react";
import { RepositoryAnalysis, AiOverview } from "../types";
import { api } from "../services/api";
import { soundFX } from "../services/audio";

interface ArchitectureViewProps {
  analysis: RepositoryAnalysis;
  onOpenFile: (path: string) => void;
}

export const ArchitectureView: React.FC<ArchitectureViewProps> = ({
  analysis,
  onOpenFile,
}) => {
  const [overview, setOverview] = useState<AiOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    // Extract top-level directories
    const dirSet = new Set<string>();
    analysis.tree.forEach((n) => {
      const parts = n.path.split("/");
      if (parts.length > 1) dirSet.add(parts[0]);
    });

    api
      .getAiOverview({
        owner: analysis.owner,
        repo: analysis.repo,
        description: analysis.description,
        readme_excerpt: analysis.readme_preview,
        tech_stack: analysis.tech_stack.languages.concat(analysis.tech_stack.frameworks),
        entry_points: analysis.entry_points,
        key_directories: Array.from(dirSet).slice(0, 5),
      })
      .then((data) => {
        if (isMounted) setOverview(data);
      })
      .catch(() => {
        // Fallback is handled automatically by backend
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [analysis]);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Overview Hero Card */}
      <div className="p-6 rounded-2xl bg-game-card/90 border border-game-border backdrop-blur-xl shadow-hud">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 text-xs font-mono">
              <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold uppercase">
                System Overview
              </span>
              <span className="text-slate-400">
                {analysis.full_name} ({analysis.default_branch})
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-white">
              {analysis.repo} Architecture Guide
            </h2>
          </div>

          <a
            href={analysis.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono border border-slate-700 transition-colors shrink-0"
          >
            <span>View GitHub</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-3 text-slate-400 text-xs font-mono">
            <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span>Qwen AI synthesizing repository evidence & architecture...</span>
          </div>
        ) : overview ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-300 leading-relaxed font-sans">
              {overview.what_it_does}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 text-xs">
                <span className="font-bold text-cyan-300 block mb-1">
                  Target Audience:
                </span>
                <span className="text-slate-300">{overview.target_audience}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 text-xs">
                <span className="font-bold text-violet-300 block mb-1">
                  Architecture Organization:
                </span>
                <span className="text-slate-300">{overview.architecture_summary}</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Detected Tech Stack Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Languages */}
        <div className="p-4 rounded-xl bg-game-card/80 border border-game-border text-xs">
          <span className="font-mono font-bold text-cyan-400 block mb-2 uppercase text-[11px]">
            Languages Detected
          </span>
          <div className="flex flex-wrap gap-1.5 font-mono">
            {analysis.tech_stack.languages.length > 0 ? (
              analysis.tech_stack.languages.map((l) => (
                <span key={l} className="px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/60 text-cyan-200">
                  {l}
                </span>
              ))
            ) : (
              <span className="text-slate-500">None identified</span>
            )}
          </div>
        </div>

        {/* Frameworks & Build Tools */}
        <div className="p-4 rounded-xl bg-game-card/80 border border-game-border text-xs">
          <span className="font-mono font-bold text-violet-400 block mb-2 uppercase text-[11px]">
            Build & Package Tools
          </span>
          <div className="flex flex-wrap gap-1.5 font-mono">
            {analysis.tech_stack.build_tools.concat(analysis.tech_stack.package_managers).length > 0 ? (
              analysis.tech_stack.build_tools.concat(analysis.tech_stack.package_managers).map((t) => (
                <span key={t} className="px-2 py-0.5 rounded bg-violet-950/70 border border-violet-800/60 text-violet-200">
                  {t}
                </span>
              ))
            ) : (
              <span className="text-slate-500">Standard tools</span>
            )}
          </div>
        </div>

        {/* Test Frameworks */}
        <div className="p-4 rounded-xl bg-game-card/80 border border-game-border text-xs">
          <span className="font-mono font-bold text-emerald-400 block mb-2 uppercase text-[11px]">
            Test Verification
          </span>
          <div className="flex flex-wrap gap-1.5 font-mono">
            {analysis.tech_stack.test_frameworks.length > 0 ? (
              analysis.tech_stack.test_frameworks.map((tf) => (
                <span key={tf} className="px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800/60 text-emerald-200">
                  {tf}
                </span>
              ))
            ) : (
              <span className="text-slate-500">Not detected in root</span>
            )}
          </div>
        </div>

        {/* Entry Points */}
        <div className="p-4 rounded-xl bg-game-card/80 border border-game-border text-xs">
          <span className="font-mono font-bold text-amber-400 block mb-2 uppercase text-[11px]">
            Primary Entry Points
          </span>
          <div className="flex flex-wrap gap-1.5 font-mono">
            {analysis.entry_points.length > 0 ? (
              analysis.entry_points.slice(0, 3).map((ep) => (
                <button
                  key={ep}
                  onClick={() => {
                    soundFX.playClick();
                    onOpenFile(ep);
                  }}
                  className="px-2 py-0.5 rounded bg-amber-950/70 border border-amber-800/60 text-amber-200 hover:bg-amber-900 transition-colors truncate max-w-full"
                  title={ep}
                >
                  `{ep}`
                </button>
              ))
            ) : (
              <span className="text-slate-500">Package entry</span>
            )}
          </div>
        </div>
      </div>

      {/* Learning Roadmap Recommendations */}
      {overview && (
        <div className="p-5 rounded-2xl bg-game-card/80 border border-game-border backdrop-blur-xl">
          <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            Recommended Contributor Learning Roadmap
          </h3>

          <div className="space-y-2.5">
            {overview.learning_recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3 text-xs"
              >
                <div className="w-6 h-6 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono font-bold flex items-center justify-center shrink-0 text-xs">
                  {idx + 1}
                </div>
                <div className="text-slate-200 leading-relaxed pt-0.5">{rec}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grounded Facts & Citations */}
      {overview && overview.grounded_facts.length > 0 && (
        <div className="p-5 rounded-2xl bg-game-card/80 border border-game-border backdrop-blur-xl">
          <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-violet-400" />
            Grounded Repository Evidence
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
            {overview.grounded_facts.map((fact, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/80 text-slate-300 flex items-start gap-2"
              >
                <span className="text-cyan-400 font-bold">•</span>
                <span>{fact}</span>
              </div>
            ))}
          </div>

          {overview.observed_limitations && (
            <div className="mt-3 text-[11px] font-mono text-slate-500 italic">
              Notice: {overview.observed_limitations}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
