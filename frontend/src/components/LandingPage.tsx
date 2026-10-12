import React, { useState } from "react";
import {
  Compass,
  ArrowRight,
  Sparkles,
  Cpu,
  Map,
  ShieldCheck,
  BookOpen,
  Code2,
  Terminal,
  ExternalLink,
  Flame,
  AlertCircle
} from "lucide-react";
import { OllamaStatus } from "../types";
import { soundFX } from "../services/audio";

interface LandingPageProps {
  onAnalyze: (url: string) => void;
  loading: boolean;
  error: string | null;
  ollamaStatus: OllamaStatus | null;
}

const DEMO_REPOSITORIES = [
  { name: "fastapi/fastapi", lang: "Python", desc: "Modern, high-performance web API framework" },
  { name: "pallets/flask", lang: "Python", desc: "Lightweight WSGI web application framework" },
  { name: "expressjs/express", lang: "JavaScript", desc: "Fast, unopinionated Node.js web framework" },
  { name: "psf/requests", lang: "Python", desc: "Simple, elegant HTTP library for human beings" },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  onAnalyze,
  loading,
  error,
  ollamaStatus,
}) => {
  const [repoUrl, setRepoUrl] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = repoUrl.trim();
    if (!trimmed) {
      setInputError("Please enter a GitHub repository URL (e.g. https://github.com/owner/repo)");
      return;
    }
    if (!trimmed.includes("github.com") && !trimmed.includes("/")) {
      setInputError("Expected format: https://github.com/owner/repository or owner/repository");
      return;
    }
    setInputError(null);
    soundFX.playClick();
    onAnalyze(trimmed);
  };

  const handleSelectDemo = (demoRepo: string) => {
    setRepoUrl(`https://github.com/${demoRepo}`);
    setInputError(null);
    soundFX.playClick();
    onAnalyze(`https://github.com/${demoRepo}`);
  };

  return (
    <div className="relative min-h-[calc(100vh-60px)] flex flex-col justify-between overflow-hidden bg-grid-pattern">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[450px] bg-radial-glow pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-violet/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-96 h-96 bg-brand-cyan/10 rounded-full blur-3xl pointer-events-none" />

      {/* Hero Section */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 pt-12 sm:pt-16 pb-12 text-center">
        {/* Ollama Model Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono mb-6 backdrop-blur-md shadow-glow-cyan animate-float">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <Cpu className="w-3.5 h-3.5" />
          <span>Local Open-Weight AI Active:</span>
          <span className="font-semibold text-white">
            {ollamaStatus?.configured_model || "Qwen 2.5 7B Instruct"}
          </span>
          <span className="text-[10px] text-cyan-400/80 bg-cyan-900/50 px-1.5 py-0.2 rounded">
            Ollama
          </span>
        </div>

        {/* Main Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-5 leading-tight">
          Every repository is a world{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-brand-violetLight">
            waiting to be explored.
          </span>
        </h1>

        {/* Supporting Copy */}
        <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-300 mb-9 leading-relaxed">
          Understand unfamiliar codebases, discover how projects work, and level up your open-source journey — powered by local AI without cloning or installing Git.
        </p>

        {/* URL Submission Form */}
        <div className="max-w-2xl mx-auto mb-6">
          <form onSubmit={handleSubmit} className="relative flex flex-col sm:flex-row gap-2.5 p-2 rounded-2xl bg-game-card/90 border border-game-border shadow-hud backdrop-blur-xl">
            <div className="relative flex-1 flex items-center">
              <span className="absolute left-3.5 text-slate-500 font-mono text-sm pointer-events-none">
                github.com/
              </span>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => {
                  setRepoUrl(e.target.value);
                  if (inputError) setInputError(null);
                }}
                placeholder="owner/repository (e.g. pallets/flask)"
                disabled={loading}
                className="w-full pl-28 pr-4 py-3.5 rounded-xl bg-slate-900/70 border border-slate-700/60 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 text-sm font-mono text-white placeholder-slate-500 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-brand-violet hover:from-cyan-400 hover:to-violet-500 text-slate-950 font-bold text-sm tracking-wide shadow-glow-cyan flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Scanning World...</span>
                </>
              ) : (
                <>
                  <span>Explore Repository</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* Validation & Error Feedback */}
          {(inputError || error) && (
            <div className="mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{inputError || error}</span>
            </div>
          )}
        </div>

        {/* Demo Repositories */}
        <div className="max-w-2xl mx-auto flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            Try a Demo Repository:
          </span>
          {DEMO_REPOSITORIES.map((demo) => (
            <button
              key={demo.name}
              onClick={() => handleSelectDemo(demo.name)}
              disabled={loading}
              className="px-2.5 py-1 rounded-lg bg-game-card hover:bg-game-cardHover border border-game-border hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 font-mono transition-colors disabled:opacity-50"
            >
              {demo.name}
            </button>
          ))}
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Feature 1 */}
          <div className="p-5 rounded-2xl bg-game-card/70 border border-game-border hover:border-cyan-500/30 transition-all hover:-translate-y-1 group">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/70 border border-cyan-800/60 flex items-center justify-center text-cyan-400 mb-3.5 shadow-glow-cyan group-hover:scale-105 transition-transform">
              <Map className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm mb-1.5 flex items-center gap-1.5">
              Repository Maps
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Interactive node graph highlighting entry points, configurations, test suites, and core modules without downloading gigabytes.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-5 rounded-2xl bg-game-card/70 border border-game-border hover:border-violet-500/30 transition-all hover:-translate-y-1 group">
            <div className="w-10 h-10 rounded-xl bg-violet-950/70 border border-violet-800/60 flex items-center justify-center text-violet-400 mb-3.5 shadow-glow-violet group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm mb-1.5 flex items-center gap-1.5">
              AI-Powered Quests
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Complete evidence-grounded missions to trace entry points, decode manifests, explore test suites, and earn XP.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-5 rounded-2xl bg-game-card/70 border border-game-border hover:border-sky-500/30 transition-all hover:-translate-y-1 group">
            <div className="w-10 h-10 rounded-xl bg-sky-950/70 border border-sky-800/60 flex items-center justify-center text-sky-400 mb-3.5 shadow-glow-cyan group-hover:scale-105 transition-transform">
              <Code2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm mb-1.5 flex items-center gap-1.5">
              Architecture Explorer
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Get clear, beginner-friendly explanations of how files connect, cite real file paths, and ask contextual questions.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="p-5 rounded-2xl bg-game-card/70 border border-game-border hover:border-emerald-500/30 transition-all hover:-translate-y-1 group">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/70 border border-emerald-800/60 flex items-center justify-center text-emerald-400 mb-3.5 shadow-glow-amber group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm mb-1.5 flex items-center gap-1.5">
              Contributor Readiness
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Automated newcomer scorecard verifying README clarity, test suites, contribution guidelines, and issue templates.
            </p>
          </div>
        </div>

        {/* Local Open-Weight AI Architecture Banner */}
        <div className="mt-8 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-game-card via-slate-900 to-game-card border border-game-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 shrink-0">
              <Terminal className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="font-bold text-slate-200">
                100% Local Inference via Ollama ({ollamaStatus?.configured_model || "Qwen 2.5 7B"})
              </div>
              <div className="text-slate-400 text-[11px]">
                No OpenAI API keys • Zero cloud dependencies • Zero cost • Complete private code inspection
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 text-[11px] border border-slate-700">
              POST http://localhost:11434/api/chat
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
