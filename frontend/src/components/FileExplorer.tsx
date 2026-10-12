import React, { useState, useEffect } from "react";
import {
  FileText,
  Folder,
  Search,
  Sparkles,
  ExternalLink,
  Cpu,
  Layers,
  ChevronRight,
  Code2,
  FileCode,
  AlertCircle
} from "lucide-react";
import { FileTreeNode, RepositoryAnalysis, FileContent, AiExplainFile } from "../types";
import { api } from "../services/api";
import { soundFX } from "../services/audio";

interface FileExplorerProps {
  analysis: RepositoryAnalysis;
  initialSelectedPath?: string | null;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  analysis,
  initialSelectedPath,
}) => {
  const [selectedPath, setSelectedPath] = useState<string>(
    initialSelectedPath || analysis.entry_points[0] || analysis.tree[0]?.path || ""
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  const [aiExplanation, setAiExplanation] = useState<AiExplainFile | null>(null);
  const [explaining, setExplaining] = useState(false);

  // Sync initialSelectedPath if it changes from parent
  useEffect(() => {
    if (initialSelectedPath) {
      setSelectedPath(initialSelectedPath);
    }
  }, [initialSelectedPath]);

  // Fetch file content whenever selectedPath changes
  useEffect(() => {
    if (!selectedPath) return;

    let isMounted = true;
    setLoadingContent(true);
    setContentError(null);
    setAiExplanation(null);

    api
      .getFileContent(analysis.owner, analysis.repo, selectedPath, analysis.default_branch)
      .then((data) => {
        if (isMounted) setFileContent(data);
      })
      .catch((err: unknown) => {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : "Error fetching file content.";
          setContentError(msg);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingContent(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPath, analysis]);

  const handleExplainWithAi = async () => {
    if (!fileContent) return;
    setExplaining(true);
    soundFX.playClick();

    try {
      const explanation = await api.explainFileWithAi({
        owner: analysis.owner,
        repo: analysis.repo,
        path: selectedPath,
        content: fileContent.content,
        repo_context: `Tech Stack: ${analysis.tech_stack.languages.join(", ")}`,
      });
      setAiExplanation(explanation);
      soundFX.playXpGain();
    } catch (err: unknown) {
      // Keep explanation null or show alert
    } finally {
      setExplaining(false);
    }
  };

  // Filtered files list
  const filteredFiles = analysis.tree.filter((node) => {
    if (node.type === "tree") return false;
    const matchesCategory = categoryFilter === "all" || node.category === categoryFilter;
    const matchesSearch =
      !searchQuery ||
      node.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-full h-[calc(100vh-125px)] grid grid-cols-1 md:grid-cols-12 gap-4">
      {/* Left: File Tree List */}
      <div className="md:col-span-4 bg-game-card/80 border border-game-border rounded-2xl p-3.5 flex flex-col backdrop-blur-xl shadow-hud overflow-hidden">
        {/* Search & Filter */}
        <div className="space-y-2 mb-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter file paths..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-mono">
            {["all", "entrypoint", "config", "test", "doc"].map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  soundFX.playClick();
                  setCategoryFilter(cat);
                }}
                className={`px-2 py-0.5 rounded border transition-colors capitalize ${
                  categoryFilter === cat
                    ? "bg-cyan-950 border-cyan-400 text-cyan-300 font-bold"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Files Scroll List */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {filteredFiles.map((file) => {
            const isSelected = selectedPath === file.path;
            return (
              <div
                key={file.path}
                onClick={() => {
                  soundFX.playClick();
                  setSelectedPath(file.path);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                  isSelected
                    ? "bg-cyan-950/80 border-cyan-500/50 text-cyan-200 font-semibold"
                    : "bg-transparent border-transparent text-slate-300 hover:bg-slate-900/80 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileCode
                    className={`w-3.5 h-3.5 shrink-0 ${
                      file.category === "entrypoint"
                        ? "text-amber-400"
                        : file.category === "config"
                        ? "text-violet-400"
                        : file.category === "test"
                        ? "text-emerald-400"
                        : "text-slate-400"
                    }`}
                  />
                  <span className="truncate">{file.path}</span>
                </div>

                <span
                  className={`text-[9px] px-1 py-0.2 rounded uppercase shrink-0 font-bold ${
                    file.category === "entrypoint"
                      ? "bg-amber-950 text-amber-300 border border-amber-800"
                      : "text-slate-500"
                  }`}
                >
                  {file.category}
                </span>
              </div>
            );
          })}

          {filteredFiles.length === 0 && (
            <div className="text-center py-8 text-xs font-mono text-slate-500">
              No files matching filter.
            </div>
          )}
        </div>
      </div>

      {/* Right: File Viewer & AI Explanation Card */}
      <div className="md:col-span-8 flex flex-col gap-4 overflow-y-auto">
        {/* File Content Preview */}
        <div className="bg-game-card/90 border border-game-border rounded-2xl p-4 backdrop-blur-xl shadow-hud flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-game-border mb-3">
            <div className="flex items-center gap-2 overflow-hidden">
              <Code2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-xs font-mono font-bold text-white truncate" title={selectedPath}>
                {selectedPath}
              </span>
              {fileContent && (
                <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                  {(fileContent.size / 1024).toFixed(1)} KB
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleExplainWithAi}
                disabled={explaining || loadingContent || !fileContent}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-brand-violet hover:from-cyan-400 hover:to-violet-500 text-slate-950 font-bold text-xs shadow-glow-cyan flex items-center gap-1.5 transition-all disabled:opacity-40"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{explaining ? "Qwen Analyzing..." : "Explain with AI"}</span>
              </button>

              <a
                href={`https://github.com/${analysis.full_name}/blob/${analysis.default_branch}/${selectedPath}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                title="View on GitHub"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 font-mono text-xs overflow-auto max-h-[380px]">
            {loadingContent ? (
              <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
                <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span>Retrieving file from GitHub...</span>
              </div>
            ) : contentError ? (
              <div className="p-4 text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{contentError}</span>
              </div>
            ) : fileContent ? (
              <pre className="text-slate-300 leading-relaxed whitespace-pre-wrap font-mono text-[11px]">
                {fileContent.content}
              </pre>
            ) : null}
          </div>
        </div>

        {/* AI File Explanation Panel */}
        {aiExplanation && (
          <div className="bg-game-card/95 border border-cyan-500/40 rounded-2xl p-4 backdrop-blur-xl shadow-glow-cyan text-xs">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <h3 className="font-mono font-bold text-cyan-300 text-xs uppercase tracking-wider">
                Qwen 2.5 Code Guide: `{selectedPath}`
              </h3>
            </div>

            <div className="space-y-3 font-sans">
              <div>
                <span className="font-bold text-slate-200 block text-xs mb-0.5">Role Summary:</span>
                <p className="text-slate-300 leading-relaxed text-xs">
                  {aiExplanation.role_summary}
                </p>
              </div>

              {aiExplanation.key_components.length > 0 && (
                <div>
                  <span className="font-bold text-slate-200 block text-xs mb-1">Key Components:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-300 font-mono text-[11px]">
                    {aiExplanation.key_components.map((comp, idx) => (
                      <li key={idx}>{comp}</li>
                    ))}
                  </ul>
                </div>
              )}

              {aiExplanation.connections.length > 0 && (
                <div>
                  <span className="font-bold text-slate-200 block text-xs mb-1">Connections:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-300 font-mono text-[11px]">
                    {aiExplanation.connections.map((conn, idx) => (
                      <li key={idx}>{conn}</li>
                    ))}
                  </ul>
                </div>
              )}

              {aiExplanation.beginner_tips && (
                <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-800/50 text-cyan-200/90 text-xs">
                  <span className="font-bold text-cyan-300 mr-1">💡 Beginner Tip:</span>
                  {aiExplanation.beginner_tips}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
