import React, { useState } from "react";
import {
  Bot,
  MessageSquare,
  Sparkles,
  Send,
  X,
  Loader2,
  ChevronDown
} from "lucide-react";
import { GameActivity, GameInteractiveObject } from "../../types";
import { api } from "../../services/api";

interface PatchCompanionProps {
  currentActivity: GameActivity | null;
  repoFullName: string;
  activeObject: GameInteractiveObject | null;
}

export const PatchCompanion: React.FC<PatchCompanionProps> = ({
  currentActivity,
  repoFullName,
  activeObject,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputQuestion, setInputQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ sender: "patch" | "user"; text: string }>>([
    {
      sender: "patch",
      text: "Hi! I'm Patch, your repo guide robot. Walk up to any highlighted station or ask me anything about how this project works!",
    },
  ]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuestion.trim() || loading) return;

    const q = inputQuestion.trim();
    setInputQuestion("");
    setMessages((prev) => [...prev, { sender: "user", text: q }]);
    setLoading(true);

    try {
      const [owner, repo] = repoFullName.split("/");
      const relevant = activeObject ? [activeObject.verified_file_path] : [];
      const res = await api.askRepoAi({
        owner,
        repo,
        question: q,
        relevant_files: relevant,
      });

      setMessages((prev) => [...prev, { sender: "patch", text: res.answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: "patch",
          text: `In this repository (${repoFullName}), components are modularly organized. Try exploring the station files to see how data flows!`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      {/* Patch Compact Bubble */}
      {!isOpen && (
        <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-lg flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-white flex items-center gap-1.5">
                <span>Patch Guide</span>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-800/40">
                  AI Companion
                </span>
              </div>
              <p className="text-slate-300 text-[11px] line-clamp-1">
                {currentActivity
                  ? `Tip: ${currentActivity.instruction}`
                  : "All objectives cleared! Feel free to free-roam and inspect files."}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsOpen(true)}
            className="px-2.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center gap-1 shrink-0 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Ask</span>
          </button>
        </div>
      )}

      {/* Expanded Chat Drawer */}
      {isOpen && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col space-y-3 text-xs w-full">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-white font-bold">
              <Bot className="w-4 h-4 text-cyan-400" />
              <span>Patch Companion — Repository Q&A</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Container */}
          <div className="max-h-56 overflow-y-auto space-y-2.5 pr-1">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                  m.sender === "user"
                    ? "bg-cyan-950/70 border border-cyan-800/60 text-cyan-200 ml-4"
                    : "bg-slate-800/80 border border-slate-700 text-slate-200 mr-4"
                }`}
              >
                <div className="text-[10px] font-mono font-bold uppercase mb-0.5 text-slate-400">
                  {m.sender === "user" ? "You" : "Patch"}
                </div>
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="p-2.5 rounded-xl bg-slate-800/60 text-slate-400 flex items-center gap-2 text-xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span>Patch is analyzing repository evidence...</span>
              </div>
            )}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSend} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              placeholder="Ask Patch about this file or project..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={loading || !inputQuestion.trim()}
              className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
