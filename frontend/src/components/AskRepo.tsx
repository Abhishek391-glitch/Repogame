import React, { useState } from "react";
import {
  MessageSquare,
  Send,
  Sparkles,
  Cpu,
  FileCode,
  ExternalLink,
  HelpCircle,
  AlertCircle
} from "lucide-react";
import { RepositoryAnalysis } from "../types";
import { api } from "../services/api";
import { soundFX } from "../services/audio";

interface AskRepoProps {
  analysis: RepositoryAnalysis;
  onOpenFile: (path: string) => void;
}

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  citedFiles?: string[];
  confidence?: "high" | "medium" | "low";
  missingEvidence?: string | null;
}

const SUGGESTED_QUESTIONS = [
  "Where does program execution begin?",
  "How are project configuration and dependencies loaded?",
  "How is the test suite organized and verified?",
  "Where should I look if I want to contribute a new feature?",
  "What coding conventions or architecture patterns are used?",
];

export const AskRepo: React.FC<AskRepoProps> = ({ analysis, onOpenFile }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "ai",
      text: `Welcome! I am your Qwen 2.5 open-source code guide for ${analysis.full_name}. Ask me about entry points, architecture, testing, or where to start contributing!`,
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAsk = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || loading) return;

    soundFX.playClick();
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: "user",
      text: q,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputQuestion("");
    setLoading(true);

    try {
      // Pass candidate relevant files based on question keywords
      const qLower = q.toLowerCase();
      let candidateFiles: string[] = [];
      if (qLower.includes("start") || qLower.includes("entry") || qLower.includes("run") || qLower.includes("main")) {
        candidateFiles = analysis.entry_points;
      } else if (qLower.includes("config") || qLower.includes("dependenc") || qLower.includes("package")) {
        candidateFiles = analysis.config_files;
      } else if (qLower.includes("test")) {
        candidateFiles = analysis.test_files;
      } else if (qLower.includes("contrib") || qLower.includes("pr") || qLower.includes("guide")) {
        candidateFiles = analysis.doc_files;
      }

      if (candidateFiles.length === 0) {
        candidateFiles = analysis.entry_points.slice(0, 2).concat(analysis.config_files.slice(0, 1));
      }

      const res = await api.askRepoAi({
        owner: analysis.owner,
        repo: analysis.repo,
        question: q,
        relevant_files: candidateFiles,
      });

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: res.answer,
        citedFiles: res.cited_files,
        confidence: res.confidence,
        missingEvidence: res.missing_evidence,
      };

      setMessages((prev) => [...prev, aiMsg]);
      soundFX.playXpGain();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error contacting Qwen AI.";
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: "ai",
          text: `Sorry, could not complete AI reasoning: ${msg}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto h-[calc(100vh-125px)] flex flex-col bg-game-card/90 border border-game-border rounded-2xl p-4 sm:p-5 backdrop-blur-xl shadow-hud">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-game-border mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-700 flex items-center justify-center text-cyan-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-white text-sm">
              Ask Repository Guide (Qwen 2.5)
            </h2>
            <div className="text-[11px] font-mono text-cyan-400">
              Grounded in {analysis.total_files_analyzed} analyzed files
            </div>
          </div>
        </div>

        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
          Local Inference
        </span>
      </div>

      {/* Suggested Questions Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 text-[11px] font-mono">
        <span className="text-slate-500 shrink-0 flex items-center gap-1">
          <HelpCircle className="w-3 h-3 text-cyan-400" />
          Suggestions:
        </span>
        {SUGGESTED_QUESTIONS.map((sq, idx) => (
          <button
            key={idx}
            onClick={() => handleAsk(sq)}
            disabled={loading}
            className="px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 shrink-0 transition-colors disabled:opacity-50"
          >
            {sq}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 mb-3">
        {messages.map((m) => {
          const isAi = m.sender === "ai";
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isAi ? "items-start" : "items-end"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs font-sans leading-relaxed ${
                  isAi
                    ? "bg-slate-900/90 border border-slate-800 text-slate-200"
                    : "bg-gradient-to-r from-cyan-600 to-brand-violet text-white font-medium"
                }`}
              >
                <div className="whitespace-pre-wrap">{m.text}</div>

                {/* Citations */}
                {m.citedFiles && m.citedFiles.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                    <span className="text-slate-500">Citations:</span>
                    {m.citedFiles.map((cf) => (
                      <button
                        key={cf}
                        onClick={() => {
                          soundFX.playClick();
                          onOpenFile(cf);
                        }}
                        className="px-1.5 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/60 text-cyan-300 hover:bg-cyan-900 transition-colors"
                      >
                        `{cf}`
                      </button>
                    ))}
                  </div>
                )}

                {m.missingEvidence && (
                  <div className="mt-2 text-[10px] font-mono text-amber-300/80">
                    ℹ️ {m.missingEvidence}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs font-mono text-slate-400">
            <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span>Qwen 2.5 analyzing repository evidence...</span>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk(inputQuestion);
        }}
        className="flex items-center gap-2 pt-2 border-t border-game-border"
      >
        <input
          type="text"
          value={inputQuestion}
          onChange={(e) => setInputQuestion(e.target.value)}
          placeholder="Ask a question about this codebase..."
          disabled={loading}
          className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={loading || !inputQuestion.trim()}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-brand-violet hover:from-cyan-400 hover:to-violet-500 text-slate-950 font-bold text-xs shadow-glow-cyan flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Ask</span>
        </button>
      </form>
    </div>
  );
};
