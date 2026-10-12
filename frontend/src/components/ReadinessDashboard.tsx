import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Award
} from "lucide-react";
import { RepositoryAnalysis, ContributorReadinessReport } from "../types";
import { api } from "../services/api";
import { soundFX } from "../services/audio";

interface ReadinessDashboardProps {
  analysis: RepositoryAnalysis;
  onOpenFile: (path: string) => void;
}

export const ReadinessDashboard: React.FC<ReadinessDashboardProps> = ({
  analysis,
  onOpenFile,
}) => {
  const [report, setReport] = useState<ContributorReadinessReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api
      .getContributorReadiness(analysis.owner, analysis.repo)
      .then((data) => {
        if (isMounted) setReport(data);
      })
      .catch(() => {
        // Handled
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [analysis]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Found":
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>FOUND</span>
          </span>
        );
      case "Needs verification":
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-800">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>VERIFY</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded-full border border-rose-800">
            <XCircle className="w-3 h-3 text-rose-400" />
            <span>NOT FOUND</span>
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Scorecard Header */}
      <div className="p-6 rounded-2xl bg-game-card/90 border border-game-border backdrop-blur-xl shadow-hud flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5 text-xs font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-300 font-bold uppercase">
              Contributor Readiness Scorecard
            </span>
          </div>
          <h2 className="text-2xl font-extrabold text-white mb-2">
            Is {analysis.repo} Ready for Newcomers?
          </h2>
          <p className="text-xs text-slate-300 max-w-lg leading-relaxed">
            Automated verification verifying that documentation, testing, guidelines, and templates exist so first-time contributors have a seamless experience.
          </p>
        </div>

        {/* Circular / Gauge Score */}
        {report && (
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shrink-0 min-w-[150px]">
            <div className="text-4xl font-extrabold font-mono text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
              {report.score_percent}%
            </div>
            <div className="text-[11px] font-mono font-bold text-slate-300 mt-1 text-center">
              {report.readiness_level}
            </div>
            <div className="text-[10px] font-mono text-slate-500 mt-0.5">
              {report.passed_checks} of {report.total_checks} criteria verified
            </div>
          </div>
        )}
      </div>

      {/* Checklist Items */}
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-slate-500 text-xs font-mono">
          <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span>Auditing repository contributor tooling...</span>
        </div>
      ) : report ? (
        <div className="space-y-3">
          {report.items.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-game-card/70 border border-game-border hover:border-slate-700 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2.5 mb-1">
                  <h3 className="font-bold text-white text-sm">
                    {item.label}
                  </h3>
                  {getStatusBadge(item.status)}
                </div>

                <p className="text-slate-300 text-xs leading-relaxed mb-1.5">
                  {item.description}
                </p>

                <div className="text-[11px] font-mono text-cyan-400/90 flex items-center gap-1">
                  <span className="text-slate-500">Action:</span>
                  <span>{item.action_suggestion}</span>
                </div>
              </div>

              {item.evidence_path && (
                <button
                  onClick={() => {
                    soundFX.playClick();
                    onOpenFile(item.evidence_path!);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-cyan-300 text-xs font-mono flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <span>Inspect `{item.evidence_path}`</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
