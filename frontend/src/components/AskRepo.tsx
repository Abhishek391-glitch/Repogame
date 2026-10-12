import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  MessageSquare,
  Send,
  Sparkles,
  Cpu,
  FileCode,
  ExternalLink,
  HelpCircle,
  AlertCircle,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Copy,
  Check,
  RotateCcw,
  Trash2,
  Globe,
  Radio,
  CheckCircle2,
  CornerDownLeft
} from "lucide-react";
import { RepositoryAnalysis } from "../types";
import { api } from "../services/api";
import { soundFX } from "../services/audio";
import {
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
  speakText,
  stopSpeaking,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  createSpeechRecognition,
} from "../services/voice";

interface AskRepoProps {
  analysis: RepositoryAnalysis;
  onOpenFile: (path: string) => void;
}

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: number;
  citedFiles?: string[];
  confidence?: "high" | "medium" | "low";
  missingEvidence?: string | null;
  detectedLanguage?: string;
  originalQuestion?: string;
}

const LANGUAGE_SUGGESTIONS: Record<string, string[]> = {
  en: [
    "Where does program execution begin?",
    "How does authentication or request handling work?",
    "How are configuration and dependencies loaded?",
    "Where should I look if I want to contribute a new feature?",
    "How is the test suite organized?",
  ],
  hi: [
    "प्रोग्राम का execution कहाँ से शुरू होता है?",
    "Authentication और request handling कैसे काम करता है?",
    "Project dependencies और config कहाँ लोड होती हैं?",
    "नया feature जोड़ने के लिए मुझे कहाँ देखना चाहिए?",
    "Testing suite कैसे organized है?",
  ],
  te: [
    "ప్రోగ్రామ్ ఎగ్జిక్యూషన్ ఎక్కడ మొదలవుతుంది?",
    "ప్రాజెక్ట్ డిపెండెన్సీలు మరియు కాన్ఫిగరేషన్ ఎలా లోడ్ అవుతాయి?",
    "కొత్త ఫీచర్ జోడించడానికి నేను ఎక్కడ చూడాలి?",
    "టెస్టింగ్ సూట్ ఎలా ఆర్గనైజ్ చేయబడింది?",
  ],
  ta: [
    "நிரல் தொடக்கம் எங்கு தொடங்குகிறது?",
    "திட்டத்தின் கட்டமைப்பு மற்றும் கோப்புகள் எவ்வாறு இயங்குகின்றன?",
    "புதிய அம்சத்தை சேர்க்க நான் எங்கு பார்க்க வேண்டும்?",
    "சோதனை தொகுப்பு எவ்வாறு ஒழுங்கமைக்கப்பட்டுள்ளது?",
  ],
};

// Reusable CodeBlock component with copy functionality
const CodeBlock: React.FC<{ language?: string; value: string }> = ({
  language,
  value,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    soundFX.playClick();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 rounded-xl border border-slate-700/80 bg-slate-950 overflow-hidden font-mono text-[11px] shadow-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-slate-400 text-[10px]">
        <span className="uppercase tracking-wider font-semibold text-cyan-400">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors"
          title="Copy Code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3 overflow-x-auto text-slate-200 leading-relaxed font-mono">
        <pre>
          <code>{value}</code>
        </pre>
      </div>
    </div>
  );
};

export const AskRepo: React.FC<AskRepoProps> = ({ analysis, onOpenFile }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "ai",
      text: `Welcome! I am your Multilingual AI Guide for \`${analysis.full_name}\` powered by Qwen 2.5.\n\nAsk me anything in **English, Hindi, Telugu, Tamil**, or speak directly with the microphone! I explain real files, entry points, architecture, and contribution flows.`,
      timestamp: Date.now(),
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("auto");
  const [autoPlayVoice, setAutoPlayVoice] = useState(false);

  // Voice & Speech State
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isRecognitionSupported = isSpeechRecognitionSupported();
  const isSynthesisSupported = isSpeechSynthesisSupported();

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Clean up ongoing speech or recording on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Voice Playback for a specific message
  const handleToggleSpeak = (msg: ChatMessage) => {
    soundFX.playClick();
    if (speakingMsgId === msg.id) {
      stopSpeaking();
      setSpeakingMsgId(null);
      return;
    }

    // Stop listening if mic is running
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const lang = msg.detectedLanguage || selectedLanguage;
    setSpeakingMsgId(msg.id);

    speakText(msg.text, lang, {
      onStart: () => setSpeakingMsgId(msg.id),
      onEnd: () => setSpeakingMsgId(null),
      onError: (err) => {
        setSpeakingMsgId(null);
        setSpeechError(`Voice synthesis: ${err}`);
      },
    });
  };

  // Toggle Microphone Listening
  const handleToggleListening = () => {
    soundFX.playClick();
    setSpeechError(null);

    // Stop TTS if speaking
    if (speakingMsgId) {
      stopSpeaking();
      setSpeakingMsgId(null);
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      return;
    }

    if (!isRecognitionSupported) {
      setSpeechError(
        "Voice speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge, or type your message in the chat input."
      );
      return;
    }

    const recognition = createSpeechRecognition(selectedLanguage, {
      onStart: () => {
        setIsListening(true);
        setSpeechError(null);
      },
      onResult: (transcript, isFinal) => {
        setInputQuestion(transcript);
        if (isFinal) {
          setIsListening(false);
        }
      },
      onError: (errorMessage) => {
        setIsListening(false);
        setSpeechError(errorMessage);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });

    if (recognition) {
      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (err: any) {
        setSpeechError("Could not start microphone: " + (err?.message || "Unknown error"));
        setIsListening(false);
      }
    }
  };

  // Copy Message Text
  const handleCopyMessage = (msgId: string, text: string) => {
    soundFX.playClick();
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  // Reset / New Chat
  const handleNewChat = () => {
    soundFX.playClick();
    stopSpeaking();
    setSpeakingMsgId(null);
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: "ai",
        text: `New conversation started! Ask me about \`${analysis.full_name}\` in **English, Hindi, Telugu, Tamil**, or your preferred language.`,
        timestamp: Date.now(),
      },
    ]);
    setInputQuestion("");
    setSpeechError(null);
  };

  // Send message to AI
  const handleAsk = async (questionText: string, originalQuestion?: string) => {
    const q = questionText.trim();
    if (!q || loading) return;

    soundFX.playClick();

    // Stop microphone if currently listening
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }

    // Stop speaking if currently playing audio
    if (speakingMsgId) {
      stopSpeaking();
      setSpeakingMsgId(null);
    }

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: "user",
      text: q,
      timestamp: Date.now(),
      originalQuestion: q,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuestion("");
    setLoading(true);
    setSpeechError(null);

    try {
      // Build relevant files candidate list
      const qLower = q.toLowerCase();
      let candidateFiles: string[] = [];

      if (
        qLower.includes("start") ||
        qLower.includes("entry") ||
        qLower.includes("run") ||
        qLower.includes("main") ||
        qLower.includes("execution")
      ) {
        candidateFiles = analysis.entry_points;
      } else if (
        qLower.includes("config") ||
        qLower.includes("dependenc") ||
        qLower.includes("package") ||
        qLower.includes("setup")
      ) {
        candidateFiles = analysis.config_files;
      } else if (qLower.includes("test") || qLower.includes("pytest") || qLower.includes("spec")) {
        candidateFiles = analysis.test_files;
      } else if (
        qLower.includes("contrib") ||
        qLower.includes("pr") ||
        qLower.includes("guide") ||
        qLower.includes("doc")
      ) {
        candidateFiles = analysis.doc_files;
      }

      if (candidateFiles.length === 0) {
        candidateFiles = analysis.entry_points.slice(0, 2).concat(analysis.config_files.slice(0, 1));
      }

      // Prepare conversation history (last 6 messages)
      const history = messages
        .filter((m) => m.id !== "welcome")
        .slice(-6)
        .map((m) => ({
          role: m.sender === "ai" ? ("assistant" as const) : ("user" as const),
          content: m.text,
        }));

      const res = await api.askRepoAi({
        owner: analysis.owner,
        repo: analysis.repo,
        question: q,
        language: selectedLanguage,
        relevant_files: candidateFiles,
        history,
      });

      const aiMsgId = `ai-${Date.now()}`;
      const aiMsg: ChatMessage = {
        id: aiMsgId,
        sender: "ai",
        text: res.answer,
        timestamp: Date.now(),
        citedFiles: res.cited_files,
        confidence: res.confidence,
        missingEvidence: res.missing_evidence,
        detectedLanguage: res.detected_language,
        originalQuestion: q,
      };

      setMessages((prev) => [...prev, aiMsg]);
      soundFX.playXpGain();

      // Auto-play speech if enabled
      if (autoPlayVoice) {
        const lang = res.detected_language || selectedLanguage;
        setSpeakingMsgId(aiMsgId);
        speakText(res.answer, lang, {
          onStart: () => setSpeakingMsgId(aiMsgId),
          onEnd: () => setSpeakingMsgId(null),
          onError: () => setSpeakingMsgId(null),
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error contacting Qwen AI.";
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: "ai",
          text: `⚠️ **Could not complete response:** ${msg}\n\n*Please ensure local Ollama is running (` + "`ollama run qwen2.5:7b-instruct`" + `) or check your connection.*`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Regenerate Response
  const handleRegenerate = (originalQ?: string) => {
    if (!originalQ || loading) return;
    handleAsk(originalQ);
  };

  // Get active suggestions based on selected language
  const activeSuggestions =
    LANGUAGE_SUGGESTIONS[selectedLanguage] || LANGUAGE_SUGGESTIONS.en;

  const currentLangObj =
    SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage) ||
    SUPPORTED_LANGUAGES[0];

  return (
    <div className="w-full max-w-4xl mx-auto h-[calc(100vh-125px)] flex flex-col bg-game-card/90 border border-game-border rounded-2xl p-4 sm:p-5 backdrop-blur-xl shadow-hud">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-game-border mb-3 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-400 shadow-inner">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-white text-sm">
                Ask Repository Guide
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-800 text-cyan-300">
                Qwen 2.5
              </span>
            </div>
            <div className="text-[11px] font-mono text-cyan-400 flex items-center gap-1.5">
              <span>{analysis.full_name}</span>
              <span>•</span>
              <span className="text-slate-400">
                {analysis.total_files_analyzed} analyzed files
              </span>
            </div>
          </div>
        </div>

        {/* Header Controls: Language Selector, Voice Autoplay, New Chat */}
        <div className="flex items-center gap-2">
          {/* Language Selector Dropdown */}
          <div className="relative flex items-center">
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-xs font-mono text-slate-200 transition-colors">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <select
                value={selectedLanguage}
                onChange={(e) => {
                  setSelectedLanguage(e.target.value);
                  soundFX.playClick();
                }}
                className="bg-transparent text-slate-200 text-xs font-mono focus:outline-none cursor-pointer pr-1"
                title="Select Conversation Language"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option
                    key={lang.code}
                    value={lang.code}
                    className="bg-slate-900 text-white"
                  >
                    {lang.nativeLabel} ({lang.label})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Auto-Play Voice Toggle */}
          <button
            onClick={() => {
              setAutoPlayVoice(!autoPlayVoice);
              soundFX.playClick();
            }}
            title={
              autoPlayVoice
                ? "Auto-play voice responses: ON"
                : "Auto-play voice responses: OFF"
            }
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-all ${
              autoPlayVoice
                ? "bg-cyan-950/70 border-cyan-600 text-cyan-300 shadow-glow-cyan"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300"
            }`}
          >
            {autoPlayVoice ? (
              <Volume2 className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Voice</span>
          </button>

          {/* New Chat Button */}
          <button
            onClick={handleNewChat}
            title="Start New Chat"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 text-slate-300 hover:text-amber-300 text-xs font-mono transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Chat</span>
          </button>
        </div>
      </div>

      {/* Suggested Questions Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 text-[11px] font-mono scrollbar-none">
        <span className="text-slate-500 shrink-0 flex items-center gap-1">
          <HelpCircle className="w-3 h-3 text-cyan-400" />
          <span className="hidden xs:inline">Suggestions:</span>
        </span>
        {activeSuggestions.map((sq, idx) => (
          <button
            key={idx}
            onClick={() => handleAsk(sq)}
            disabled={loading}
            className="px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 shrink-0 transition-colors disabled:opacity-50 text-[11px]"
          >
            {sq}
          </button>
        ))}
      </div>

      {/* Speech Error Banner (Dismissible) */}
      {speechError && (
        <div className="mb-2 p-2.5 rounded-xl bg-amber-950/60 border border-amber-800/80 text-amber-200 text-xs flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{speechError}</span>
          </div>
          <button
            onClick={() => setSpeechError(null)}
            className="text-amber-400 hover:text-amber-200 font-bold px-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Active Listening Visual Banner */}
      {isListening && (
        <div className="mb-2 p-2.5 rounded-xl bg-gradient-to-r from-red-950/70 via-slate-900 to-cyan-950/70 border border-red-500/60 text-red-200 text-xs flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <Radio className="w-4 h-4 text-red-400" />
            <span className="font-mono">
              Listening in <strong>{currentLangObj.nativeLabel} ({currentLangObj.label})</strong>... Speak now!
            </span>
          </div>
          <button
            onClick={handleToggleListening}
            className="px-2 py-0.5 rounded bg-red-900 hover:bg-red-800 text-white font-mono text-[10px] border border-red-700"
          >
            Stop
          </button>
        </div>
      )}

      {/* Messages Scroll Container */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-3">
        {messages.map((m) => {
          const isAi = m.sender === "ai";
          const isSpeaking = speakingMsgId === m.id;
          const isCopied = copiedMsgId === m.id;

          return (
            <div
              key={m.id}
              className={`flex flex-col ${isAi ? "items-start" : "items-end"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl p-4 text-xs font-sans leading-relaxed transition-all shadow-md ${
                  isAi
                    ? "bg-slate-900/95 border border-slate-800 text-slate-200"
                    : "bg-gradient-to-r from-cyan-600 to-brand-violet text-white font-medium"
                }`}
              >
                {/* AI Header Badge */}
                {isAi && (
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 text-[10px] font-mono text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      <span className="font-semibold text-cyan-300">RepoQuest Guide</span>
                      {m.detectedLanguage && m.detectedLanguage !== "en" && (
                        <span className="px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 uppercase text-[9px]">
                          {m.detectedLanguage}
                        </span>
                      )}
                    </div>

                    {/* Action buttons on AI message: Speak, Copy, Regenerate */}
                    <div className="flex items-center gap-1">
                      {/* Speaker / Read Aloud Button */}
                      {isSynthesisSupported && (
                        <button
                          onClick={() => handleToggleSpeak(m)}
                          className={`p-1 rounded-md transition-colors ${
                            isSpeaking
                              ? "bg-cyan-950 text-cyan-300 border border-cyan-600 animate-pulse"
                              : "hover:bg-slate-800 text-slate-400 hover:text-cyan-300"
                          }`}
                          title={isSpeaking ? "Stop speaking" : "Read aloud"}
                        >
                          {isSpeaking ? (
                            <VolumeX className="w-3.5 h-3.5 text-cyan-400" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}

                      {/* Copy message button */}
                      <button
                        onClick={() => handleCopyMessage(m.id, m.text)}
                        className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                        title="Copy message"
                      >
                        {isCopied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Regenerate button (if originalQuestion exists) */}
                      {m.originalQuestion && (
                        <button
                          onClick={() => handleRegenerate(m.originalQuestion)}
                          disabled={loading}
                          className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors disabled:opacity-40"
                          title="Regenerate response"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Message Body with Markdown Rendering */}
                {isAi ? (
                  <div className="prose prose-invert prose-xs max-w-none space-y-2">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ node, inline, className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || "");
                          if (!inline && match) {
                            return (
                              <CodeBlock
                                language={match[1]}
                                value={String(children).replace(/\n$/, "")}
                              />
                            );
                          }
                          return (
                            <code
                              className="px-1.5 py-0.5 rounded bg-slate-800/90 text-cyan-300 font-mono text-[11px] border border-slate-700/60"
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        },
                        p({ children }) {
                          return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
                        },
                        ul({ children }) {
                          return <ul className="list-disc pl-4 space-y-1 mb-2">{children}</ul>;
                        },
                        ol({ children }) {
                          return <ol className="list-decimal pl-4 space-y-1 mb-2">{children}</ol>;
                        },
                        h1({ children }) {
                          return <h3 className="text-sm font-bold text-white mt-3 mb-1">{children}</h3>;
                        },
                        h2({ children }) {
                          return <h4 className="text-xs font-bold text-cyan-300 mt-2 mb-1">{children}</h4>;
                        },
                        h3({ children }) {
                          return <h5 className="text-xs font-semibold text-cyan-400 mt-2 mb-1">{children}</h5>;
                        },
                      }}
                    >
                      {m.text}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{m.text}</div>
                )}

                {/* Grounded File Citations */}
                {m.citedFiles && m.citedFiles.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-800 flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                    <span className="text-slate-500 font-medium">Verified Citations:</span>
                    {m.citedFiles.map((cf) => (
                      <button
                        key={cf}
                        onClick={() => {
                          soundFX.playClick();
                          onOpenFile(cf);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-cyan-950/70 border border-cyan-800/80 text-cyan-300 hover:bg-cyan-900 hover:border-cyan-600 transition-colors flex items-center gap-1"
                        title={`Open ${cf} in File Explorer`}
                      >
                        <FileCode className="w-3 h-3 text-cyan-400" />
                        <span>`{cf}`</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Missing Evidence / Informational notice */}
                {m.missingEvidence && (
                  <div className="mt-2 text-[10px] font-mono text-amber-300/80 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>{m.missingEvidence}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs font-mono text-cyan-300 w-fit">
            <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span>
              Qwen 2.5 analyzing repository evidence in{" "}
              {currentLangObj.label}...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk(inputQuestion);
        }}
        className="pt-2 border-t border-game-border flex flex-col gap-2"
      >
        <div className="flex items-end gap-2 bg-slate-900/90 border border-slate-700/80 focus-within:border-cyan-400 rounded-2xl p-2 transition-colors shadow-inner">
          {/* Multi-line auto-resizing textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAsk(inputQuestion);
              }
            }}
            placeholder={
              isListening
                ? "Listening... speak now or type..."
                : selectedLanguage === "hi"
                ? "कोडबेस के बारे में कोई प्रश्न पूछें... (Enter to send)"
                : selectedLanguage === "te"
                ? "ఈ కోడ్‌బేస్ గురించి ఏదైనా అడగండి... (Enter to send)"
                : selectedLanguage === "ta"
                ? "குறியீட்டுத் தளம் பற்றி ஏதேனும் கேட்கவும்... (Enter to send)"
                : "Ask about entry points, authentication, tests, architecture... (Enter to send, Shift+Enter for newline)"
            }
            disabled={loading}
            className="flex-1 max-h-32 min-h-[40px] px-3 py-2 bg-transparent text-xs font-mono text-white placeholder-slate-500 focus:outline-none resize-none leading-relaxed"
          />

          {/* Voice Microphone Button */}
          <button
            type="button"
            onClick={handleToggleListening}
            disabled={loading}
            title={
              !isRecognitionSupported
                ? "Speech recognition not supported in this browser"
                : isListening
                ? "Stop listening"
                : `Voice Input (${currentLangObj.nativeLabel})`
            }
            className={`p-2.5 rounded-xl transition-all flex items-center justify-center shrink-0 ${
              isListening
                ? "bg-red-600 text-white shadow-glow-red animate-pulse ring-2 ring-red-400"
                : !isRecognitionSupported
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500/50"
            }`}
          >
            {isListening ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={loading || !inputQuestion.trim()}
            title="Send Message (Enter)"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-brand-violet hover:from-cyan-400 hover:to-violet-500 text-slate-950 font-bold text-xs shadow-glow-cyan flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Send</span>
          </button>
        </div>

        {/* Helpful Shortcut Tip Footer */}
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 px-1">
          <div className="flex items-center gap-2">
            <span>Press <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">Enter</kbd> to send</span>
            <span>•</span>
            <span><kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">Shift+Enter</kbd> for new line</span>
          </div>
          <div className="flex items-center gap-1 text-cyan-500/80">
            <Sparkles className="w-3 h-3" />
            <span>Local Qwen 2.5 • Zero cloud leaks</span>
          </div>
        </div>
      </form>
    </div>
  );
};
