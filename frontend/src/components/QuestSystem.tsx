import React, { useState } from "react";
import confetti from "canvas-confetti";
import {
  Compass,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  Lightbulb,
  Clock,
  Award,
  ChevronRight,
  Play,
  Settings,
  TestTube,
  FileCode,
  ShieldCheck,
  Check
} from "lucide-react";
import { Quest, RepositoryAnalysis } from "../types";
import { api } from "../services/api";
import { soundFX } from "../services/audio";

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
  const [activeQuestId, setActiveQuestId] = useState<string>(quests[0]?.id || "quest-entry");
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [validationResults, setValidationResults] = useState<Record<string, { success: boolean; message: string; explanation?: string }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [expandedHints, setExpandedHints] = useState<Record<string, boolean>>({});

  const activeQuest = quests.find((q) => q.id === activeQuestId) || quests[0];

  const handleSelectOption = (questId: string, index: number) => {
    soundFX.playClick();
    setSelectedAnswers((prev) => ({ ...prev, [questId]: index }));
  };

  const handleValidateQuest = async (quest: Quest) => {
    const selectedIdx = selectedAnswers[quest.id];
    if (selectedIdx === undefined) return;

    setSubmitting(true);
    soundFX.playClick();

    try {
      const res = await api.validateQuest({
        repo_full_name: analysis.full_name,
        quest_id: quest.id,
        selected_answer_index: selectedIdx,
      });

      setValidationResults((prev) => ({
        ...prev,
        [quest.id]: {
          success: res.success,
          message: res.message,
          explanation: res.explanation,
        },
      }));

      if (res.success) {
        soundFX.playQuestComplete();
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#06b6d4", "#8b5cf6", "#f59e0b", "#10b981"],
        });
        onQuestCompleted(quest.id, res.xp_awarded, res.unlocked_badges);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error validating quest.";
      setValidationResults((prev) => ({
        ...prev,
        [quest.id]: {
          success: false,
          message: msg,
        },
      }));
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "entrypoint":
        return <Play className="w-4 h-4 text-amber-400 fill-amber-400" />;
      case "config":
        return <Settings className="w-4 h-4 text-violet-400" />;
      case "test":
        return <TestTube className="w-4 h-4 text-emerald-400" />;
      case "feature":
        return <FileCode className="w-4 h-4 text-cyan-400" />;
      case "contributing":
        return <ShieldCheck className="w-4 h-4 text-sky-400" />;
      default:
        return <Compass className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Quests List Navigation */}
      <div className="lg:col-span-5 space-y-3">
        <div className="px-1 flex items-center justify-between">
          <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            Exploration Quests ({quests.filter((q) => q.completed).length}/{quests.length})
          </h2>
        </div>

        <div className="space-y-2.5">
          {quests.map((quest, index) => {
            const isActive = activeQuestId === quest.id;
            return (
              <div
                key={quest.id}
                onClick={() => {
                  soundFX.playClick();
                  setActiveQuestId(quest.id);
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                  isActive
                    ? "bg-game-card border-cyan-500/60 shadow-glow-cyan"
                    : "bg-game-card/60 border-game-border hover:bg-game-cardHover hover:border-slate-700"
                }`}
              >
                {/* Completed Banner Ribbon */}
                {quest.completed && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>CLAIMED</span>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      quest.completed
                        ? "bg-emerald-950/70 border-emerald-800 text-emerald-400"
                        : "bg-slate-900 border-slate-700 text-slate-300"
                    }`}
                  >
                    {quest.completed ? <Check className="w-4 h-4" /> : getCategoryIcon(quest.category)}
                  </div>

                  <div className="flex-1 min-w-0 pr-12">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-mono text-slate-500 font-bold">
                        QUEST {index + 1}
                      </span>
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/40">
                        {quest.difficulty}
                      </span>
                    </div>

                    <h3 className="text-xs font-bold text-white truncate mb-1">
                      {quest.title}
                    </h3>

                    <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                      <span className="flex items-center gap-1 text-amber-400 font-semibold">
                        <Sparkles className="w-3 h-3" />
                        +{quest.xp_reward} XP
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        ~{quest.estimated_minutes} min
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Active Quest Mission Details & Interactive Quiz */}
      {activeQuest && (
        <div className="lg:col-span-7 bg-game-card/90 border border-game-border rounded-2xl p-5 sm:p-6 backdrop-blur-xl shadow-hud flex flex-col justify-between">
          <div>
            {/* Quest Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-game-border mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                    {activeQuest.category} mission
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    {activeQuest.difficulty}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-white">
                  {activeQuest.title}
                </h2>
              </div>

              <div className="text-right shrink-0">
                <div className="text-base font-extrabold font-mono text-amber-400 flex items-center justify-end gap-1">
                  <Sparkles className="w-4 h-4" />
                  +{activeQuest.xp_reward} XP
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  {activeQuest.estimated_minutes} mins estimated
                </div>
              </div>
            </div>

            {/* Objective & Why It Matters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="font-bold text-cyan-300 block mb-1">
                  Learning Objective:
                </span>
                <p className="text-slate-300 leading-relaxed">
                  {activeQuest.objective}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="font-bold text-violet-300 block mb-1">
                  Why It Matters:
                </span>
                <p className="text-slate-300 leading-relaxed">
                  {activeQuest.why_it_matters}
                </p>
              </div>
            </div>

            {/* Steps Checklist */}
            <div className="mb-6">
              <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                Mission Steps
              </h4>
              <div className="space-y-2">
                {activeQuest.steps.map((step) => (
                  <div
                    key={step.step_number}
                    className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-start gap-3 text-xs"
                  >
                    <div className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-700 text-cyan-300 font-mono font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                      {step.step_number}
                    </div>
                    <div className="flex-1">
                      <div className="text-slate-200">{step.instruction}</div>
                      {step.target_path && (
                        <button
                          onClick={() => {
                            soundFX.playClick();
                            onOpenFile(step.target_path!);
                          }}
                          className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-800 text-cyan-300 font-mono text-[10px] hover:bg-cyan-900 transition-colors"
                        >
                          <span>Inspect `{step.target_path}` in File Explorer</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Knowledge Check / Quiz */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-game-border mb-4">
              <div className="flex items-center gap-2 mb-2.5">
                <HelpCircle className="w-4 h-4 text-cyan-400" />
                <span className="font-mono text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Knowledge Check:
                </span>
              </div>

              <p className="text-xs font-medium text-white mb-3">
                {activeQuest.knowledge_check.question}
              </p>

              <div className="space-y-2 mb-4">
                {activeQuest.knowledge_check.options.map((opt, idx) => {
                  const isSelected = selectedAnswers[activeQuest.id] === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectOption(activeQuest.id, idx)}
                      disabled={activeQuest.completed}
                      className={`w-full text-left p-3 rounded-xl text-xs font-mono border transition-all flex items-start gap-3 ${
                        isSelected
                          ? "bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-glow-cyan"
                          : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/80"
                      } disabled:opacity-75 disabled:cursor-default`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? "border-cyan-400 bg-cyan-500 text-slate-950"
                            : "border-slate-600"
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                      </div>
                      <span className="leading-relaxed">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Validation Feedback */}
              {validationResults[activeQuest.id] && (
                <div
                  className={`p-3 rounded-xl text-xs font-mono mb-3 ${
                    validationResults[activeQuest.id].success
                      ? "bg-emerald-950/70 border border-emerald-500/40 text-emerald-200"
                      : "bg-rose-950/70 border border-rose-500/40 text-rose-200"
                  }`}
                >
                  <div className="font-bold mb-1">
                    {validationResults[activeQuest.id].message}
                  </div>
                  {validationResults[activeQuest.id].explanation && (
                    <div className="text-[11px] text-slate-300">
                      {validationResults[activeQuest.id].explanation}
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button */}
              {!activeQuest.completed && (
                <button
                  onClick={() => handleValidateQuest(activeQuest)}
                  disabled={submitting || selectedAnswers[activeQuest.id] === undefined}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-brand-violet hover:from-cyan-400 hover:to-violet-500 text-slate-950 font-bold text-xs tracking-wide shadow-glow-cyan flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Validating Answer...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Submit Knowledge Check & Claim XP</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Expandable Hints */}
          {activeQuest.hints && activeQuest.hints.length > 0 && (
            <div className="pt-2 border-t border-game-border text-xs">
              <button
                onClick={() => {
                  soundFX.playClick();
                  setExpandedHints((prev) => ({
                    ...prev,
                    [activeQuest.id]: !prev[activeQuest.id],
                  }));
                }}
                className="text-slate-400 hover:text-cyan-400 flex items-center gap-1.5 transition-colors font-mono text-[11px]"
              >
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {expandedHints[activeQuest.id] ? "Hide Hints" : "Need a Hint?"}
                </span>
              </button>

              {expandedHints[activeQuest.id] && (
                <div className="mt-2 p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/40 text-amber-200/90 text-xs font-mono space-y-1">
                  {activeQuest.hints.map((hint, hIdx) => (
                    <div key={hIdx}>💡 {hint}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
