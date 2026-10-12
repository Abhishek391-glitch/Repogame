import React, { useMemo, useState, useCallback } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
  Position,
  Handle
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  FileCode,
  Folder,
  Play,
  Settings,
  TestTube,
  BookOpen,
  Sparkles,
  ExternalLink,
  Search,
  Layers,
  X,
  Compass,
  FileText
} from "lucide-react";
import { FileTreeNode, RepositoryAnalysis } from "../types";
import { soundFX } from "../services/audio";

interface RepoMapProps {
  analysis: RepositoryAnalysis;
  onSelectFile: (path: string) => void;
  onExplainFile: (path: string) => void;
}

// Custom Node Component for RepoMap
const CustomRepoNode: React.FC<{ data: FileTreeNode & { isRoot?: boolean; isSelected?: boolean } }> = ({ data }) => {
  const getBadgeStyle = () => {
    if (data.isRoot) {
      return "border-cyan-400 bg-cyan-950/80 text-cyan-200 shadow-glow-cyan";
    }
    switch (data.category) {
      case "entrypoint":
        return "border-amber-400/80 bg-amber-950/80 text-amber-200 shadow-glow-amber ring-2 ring-amber-500/20";
      case "config":
        return "border-violet-400/80 bg-violet-950/80 text-violet-200 shadow-glow-violet";
      case "test":
        return "border-emerald-400/80 bg-emerald-950/80 text-emerald-200";
      case "doc":
        return "border-blue-400/80 bg-blue-950/80 text-blue-200";
      case "directory":
        return "border-slate-600 bg-slate-900/90 text-slate-300";
      default:
        return "border-cyan-600/60 bg-slate-900/80 text-cyan-300";
    }
  };

  const getIcon = () => {
    if (data.isRoot) return <Compass className="w-4 h-4 text-cyan-300" />;
    switch (data.category) {
      case "entrypoint":
        return <Play className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />;
      case "config":
        return <Settings className="w-3.5 h-3.5 text-violet-400" />;
      case "test":
        return <TestTube className="w-3.5 h-3.5 text-emerald-400" />;
      case "doc":
        return <BookOpen className="w-3.5 h-3.5 text-blue-400" />;
      case "directory":
        return <Folder className="w-3.5 h-3.5 text-slate-400" />;
      default:
        return <FileCode className="w-3.5 h-3.5 text-cyan-400" />;
    }
  };

  return (
    <div
      className={`relative px-3.5 py-2 rounded-xl border backdrop-blur-md transition-all cursor-pointer min-w-[140px] max-w-[220px] select-none ${getBadgeStyle()} ${
        data.isSelected ? "scale-105 ring-2 ring-white/80" : "hover:scale-[1.02]"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-cyan-400" />
      
      <div className="flex items-center gap-2">
        <div className="shrink-0">{getIcon()}</div>
        <div className="overflow-hidden">
          <div className="text-xs font-mono font-semibold truncate text-white" title={data.name}>
            {data.name}
          </div>
          <div className="text-[10px] text-slate-400 capitalize truncate">
            {data.category}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-cyan-400" />
    </div>
  );
};

const nodeTypes = {
  repoNode: CustomRepoNode,
};

export const RepoMap: React.FC<RepoMapProps> = ({
  analysis,
  onSelectFile,
  onExplainFile,
}) => {
  const [selectedNode, setSelectedNode] = useState<FileTreeNode | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Build Graph Nodes and Edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Root Node
    const rootId = "root";
    nodes.push({
      id: rootId,
      type: "repoNode",
      position: { x: 450, y: 30 },
      data: {
        path: "",
        type: "tree",
        category: "directory",
        name: analysis.full_name,
        extension: "",
        importance: "high",
        reason: "Repository Root",
        isRoot: true,
      },
    });

    // Group files by primary top-level directory or category
    const directoryMap = new Map<string, FileTreeNode[]>();
    const rootFiles: FileTreeNode[] = [];

    // Filter candidate nodes for clean visual layout (top 45 most significant files)
    const prioritizedNodes = analysis.tree.filter((node) => {
      if (node.type === "tree") return false;
      if (node.category === "asset") return false;
      return true;
    }).slice(0, 45);

    prioritizedNodes.forEach((node) => {
      const parts = node.path.split("/");
      if (parts.length === 1) {
        rootFiles.push(node);
      } else {
        const topDir = parts[0];
        if (!directoryMap.has(topDir)) {
          directoryMap.set(topDir, []);
        }
        directoryMap.get(topDir)!.push(node);
      }
    });

    let currentX = 50;
    const dirY = 160;
    const fileYBase = 280;

    // Layout top-level directories
    const topDirs = Array.from(directoryMap.keys()).slice(0, 5);
    const colSpacing = 240;

    topDirs.forEach((dirName, dirIdx) => {
      const dirNodeId = `dir-${dirName}`;
      const dirX = currentX + dirIdx * colSpacing;

      nodes.push({
        id: dirNodeId,
        type: "repoNode",
        position: { x: dirX, y: dirY },
        data: {
          path: dirName,
          type: "tree",
          category: "directory",
          name: dirName,
          extension: "",
          importance: "high",
          reason: `Core folder (${dirName}/)`,
        },
      });

      edges.push({
        id: `e-root-${dirNodeId}`,
        source: rootId,
        target: dirNodeId,
        type: "smoothstep",
        style: { stroke: "#38bdf8", strokeWidth: 1.5, opacity: 0.6 },
      });

      // Child files in directory
      const children = directoryMap.get(dirName)!.slice(0, 4);
      children.forEach((child, childIdx) => {
        const childId = `file-${child.path}`;
        nodes.push({
          id: childId,
          type: "repoNode",
          position: { x: dirX - 10, y: fileYBase + childIdx * 75 },
          data: child as unknown as Record<string, unknown>,
        });

        edges.push({
          id: `e-${dirNodeId}-${childId}`,
          source: dirNodeId,
          target: childId,
          type: "smoothstep",
          style: { stroke: "#64748b", strokeWidth: 1.2, opacity: 0.5 },
        });
      });
    });

    // Layout direct root files on the far right column
    const rootFilesColX = currentX + topDirs.length * colSpacing;
    rootFiles.slice(0, 6).forEach((rf, rfIdx) => {
      const rfId = `file-${rf.path}`;
      nodes.push({
        id: rfId,
        type: "repoNode",
        position: { x: rootFilesColX, y: dirY + rfIdx * 75 },
        data: rf as unknown as Record<string, unknown>,
      });

      edges.push({
        id: `e-root-${rfId}`,
        source: rootId,
        target: rfId,
        type: "smoothstep",
        style: { stroke: "#a855f7", strokeWidth: 1.2, opacity: 0.6 },
      });
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [analysis]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Filter nodes visually
  const filteredNodes = useMemo(() => {
    return nodes.map((node) => {
      const data = node.data as unknown as (FileTreeNode & { isRoot?: boolean; isSelected?: boolean });
      const matchesCategory =
        filterCategory === "all" ||
        data.category === filterCategory ||
        data.isRoot;

      const matchesSearch =
        !searchQuery ||
        data.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        data.path.toLowerCase().includes(searchQuery.toLowerCase());

      const isSelected = selectedNode?.path === data.path;

      return {
        ...node,
        hidden: !(matchesCategory && matchesSearch),
        data: {
          ...data,
          isSelected,
        },
      };
    });
  }, [nodes, filterCategory, searchQuery, selectedNode]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      soundFX.playClick();
      const nodeData = node.data as unknown as (FileTreeNode & { isRoot?: boolean });
      if (!nodeData.isRoot) {
        setSelectedNode(nodeData);
      }
    },
    []
  );

  return (
    <div className="relative w-full h-[calc(100vh-125px)] bg-[#070a10] border border-game-border rounded-2xl overflow-hidden flex flex-col shadow-hud">
      {/* Top Map Toolbar */}
      <div className="z-10 px-4 py-3 bg-game-card/90 backdrop-blur-md border-b border-game-border flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search map nodes..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-mono">
          {[
            { id: "all", label: "All Nodes" },
            { id: "entrypoint", label: "Entry Points", count: analysis.entry_points.length },
            { id: "config", label: "Config", count: analysis.config_files.length },
            { id: "test", label: "Tests", count: analysis.test_files.length },
            { id: "doc", label: "Docs", count: analysis.doc_files.length },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                soundFX.playClick();
                setFilterCategory(cat.id);
              }}
              className={`px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1 ${
                filterCategory === cat.id
                  ? "bg-cyan-950 border-cyan-400 text-cyan-300 font-bold"
                  : "bg-slate-900/60 border-slate-700/60 text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>{cat.label}</span>
              {cat.count !== undefined && (
                <span className="text-[10px] px-1 py-0.2 rounded bg-slate-800 text-slate-300">
                  {cat.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="hidden lg:flex items-center gap-3 text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Entry
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-400" /> Config
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Test
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> Doc
          </span>
        </div>
      </div>

      {/* Main Flow Canvas */}
      <div className="relative flex-1 w-full h-full">
        <ReactFlow
          nodes={filteredNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-[#070a10]"
        >
          <Background color="#1e293b" gap={24} size={1} />
          <Controls className="!bg-slate-900 !border-slate-700 !text-slate-300" />
          <MiniMap
            nodeColor={(node) => {
              const cat = (node.data as unknown as FileTreeNode).category;
              if (cat === "entrypoint") return "#f59e0b";
              if (cat === "config") return "#8b5cf6";
              if (cat === "test") return "#10b981";
              if (cat === "doc") return "#3b82f6";
              return "#06b6d4";
            }}
            className="!bg-slate-900/90 !border-slate-800 !rounded-xl overflow-hidden"
          />
        </ReactFlow>

        {/* Floating Inspector Panel for Selected Node */}
        {selectedNode && (
          <div className="absolute top-4 right-4 z-20 w-80 p-4 rounded-2xl bg-game-card/95 border border-cyan-500/30 backdrop-blur-xl shadow-glow-cyan">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-700 flex items-center justify-center text-cyan-400 shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="overflow-hidden">
                  <div className="font-mono font-bold text-xs text-white truncate" title={selectedNode.name}>
                    {selectedNode.name}
                  </div>
                  <div className="text-[10px] text-cyan-400 font-mono truncate" title={selectedNode.path}>
                    {selectedNode.path}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 mb-4 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1.5">
                <span>Category:</span>
                <span className="font-semibold text-slate-200 capitalize">{selectedNode.category}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1.5">
                <span>Importance:</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                    selectedNode.importance === "high"
                      ? "bg-amber-950 text-amber-300 border border-amber-800"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {selectedNode.importance}
                </span>
              </div>
              {selectedNode.language && (
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1.5">
                  <span>Language:</span>
                  <span className="text-slate-200">{selectedNode.language}</span>
                </div>
              )}
              {selectedNode.reason && (
                <div className="text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  {selectedNode.reason}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  soundFX.playClick();
                  onExplainFile(selectedNode.path);
                }}
                className="w-full py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-brand-violet hover:from-cyan-400 hover:to-violet-500 text-slate-950 font-bold text-xs tracking-wide shadow-glow-cyan flex items-center justify-center gap-1.5 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Explain File with AI</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    soundFX.playClick();
                    onSelectFile(selectedNode.path);
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                >
                  Open in Explorer
                </button>
                <a
                  href={`https://github.com/${analysis.full_name}/blob/${analysis.default_branch}/${selectedNode.path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700"
                  title="View file on GitHub"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
