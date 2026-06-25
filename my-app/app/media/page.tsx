"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { listProjects, listAllMedia, listMediaFrames, Project, VideoFrame, Detection, API_BASE_URL } from "@/lib/api";
import { UploadedMedia } from "@/types/media";
import { useQuery } from "@tanstack/react-query";
import { Film, Loader2, RefreshCw, Calendar, HardDrive, Search, Filter, CheckCircle, Eye, EyeOff, X, User } from "lucide-react";

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

export default function MediaLibraryPage() {
  const router = useRouter();
  const { isAuthenticated, token } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterProjectId, setFilterProjectId] = useState("");

  // Frame Expansion States
  const [expandedMediaId, setExpandedMediaId] = useState<string | null>(null);
  const [mediaFrames, setMediaFrames] = useState<Record<string, VideoFrame[]>>({});
  const [isLoadingFrames, setIsLoadingFrames] = useState(false);

  // Inspector Modal State
  const [selectedFrame, setSelectedFrame] = useState<VideoFrame | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<Record<string, boolean>>({
    Worker: true,
    Helmet: true,
    Truck: true,
    Crane: true,
    Excavator: true,
    Scaffolding: true,
    Pillar: true,
    Wall: true,
    "Construction Equipment": true,
  });

  useEffect(() => {
    setMounted(true);
    if (!token && !localStorage.getItem("token")) {
      router.push("/login");
    }
  }, [token, router]);

  // Query projects for filters
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: listProjects,
    enabled: !!token,
  });

  // Query all media files
  const { data: mediaFiles = [], isLoading: isLoadingMedia, refetch: refetchMedia } = useQuery<UploadedMedia[]>({
    queryKey: ["allMedia"],
    queryFn: listAllMedia,
    enabled: !!token,
  });

  const filteredMedia = useMemo(() => {
    return mediaFiles.filter((m) => {
      const matchesSearch = m.originalName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesProject = filterProjectId ? m.projectId === filterProjectId : true;
      return matchesSearch && matchesProject;
    });
  }, [mediaFiles, searchQuery, filterProjectId]);

  const handleToggleFrames = (mediaId: string) => {
    if (expandedMediaId === mediaId) {
      setExpandedMediaId(null);
      return;
    }
    
    setExpandedMediaId(mediaId);
    if (!mediaFrames[mediaId]) {
      setIsLoadingFrames(true);
      listMediaFrames(mediaId)
        .then((frames) => {
          setMediaFrames((prev) => ({ ...prev, [mediaId]: frames }));
        })
        .catch((err) => {
          console.error("Failed to load media frames:", err);
        })
        .finally(() => {
          setIsLoadingFrames(false);
        });
    }
  };

  const getDetectionCounts = (detections?: Detection[]) => {
    if (!detections) return {};
    const counts: Record<string, number> = {};
    detections.forEach((d) => {
      counts[d.objectType] = (counts[d.objectType] || 0) + 1;
    });
    return counts;
  };

  if (!mounted || (!isAuthenticated && !token)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <RefreshCw className="animate-spin text-muted" size={28} />
      </div>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8 max-w-7xl mx-auto space-y-8">
      {/* Title Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Inspection Media Library
          </h1>
          <p className="mt-1 text-sm text-muted">
            Inspect processed frame sequences, object tracks, and timeline logs across all projects.
          </p>
        </div>
        <button
          onClick={() => refetchMedia()}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-border bg-panel px-4 text-sm font-semibold text-foreground hover:bg-panel-strong transition cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${isLoadingMedia ? "animate-spin text-primary" : ""}`} />
          Refresh Library
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between bg-panel p-4 rounded-xl border border-border/80 shadow-sm text-left">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-muted" />
          <input
            type="text"
            placeholder="Search by file name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-border bg-background pl-10 pr-4 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted font-semibold uppercase tracking-wide">
            <Filter size={14} />
            Filter Project:
          </div>
          <select
            value={filterProjectId}
            onChange={(e) => setFilterProjectId(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Media Grid */}
      {isLoadingMedia ? (
        <div className="flex h-64 flex-col items-center justify-center text-muted">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <span>Fetching media archive...</span>
        </div>
      ) : filteredMedia.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-panel p-12 text-center py-20">
          <Film className="h-12 w-12 text-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground">No Media Found</h3>
          <p className="text-sm text-muted mt-2 max-w-md mx-auto">
            Try adjusting your search query, selecting a different project, or upload new files in the workspace.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredMedia.map((media) => {
            const isVideo = media.contentType.startsWith("video/");
            const isProcessed = isVideo && (media.thumbnailUrl || media.timelineUrl);
            const isCurrentlyExpanded = expandedMediaId === media.id;

            return (
              <div
                key={media.id}
                className="group border border-border/80 bg-panel hover:border-border rounded-xl overflow-hidden shadow-sm transition duration-300 text-left"
              >
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Info */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`p-2.5 rounded-lg shrink-0 mt-0.5 ${
                      isVideo ? "bg-primary/10 text-primary border border-primary/20" : "bg-success/10 text-success border border-success/20"
                    }`}>
                      <Film className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-foreground truncate max-w-md" title={media.originalName}>
                        {media.originalName}
                      </h4>
                      <p className="text-[11px] text-primary font-semibold truncate mt-0.5">
                        📁 {media.projectName || "Project Workspace"}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <HardDrive className="h-3.5 w-3.5" />
                          {formatBytes(media.sizeBytes)}
                        </span>
                        <span className="text-border/40">•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(media.uploadedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Badge / Action */}
                  <div className="flex items-center gap-3 shrink-0">
                    {isVideo && !isProcessed && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning border border-warning/20 animate-pulse">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Processing...
                      </span>
                    )}
                    {(!isVideo || isProcessed) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success border border-success/20">
                        <CheckCircle className="h-3 w-3" />
                        Processed
                      </span>
                    )}
                    <a
                      href={media.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground hover:bg-panel-strong transition"
                    >
                      View Original
                    </a>
                    {isVideo && isProcessed && (
                      <button
                        onClick={() => handleToggleFrames(media.id)}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition shadow cursor-pointer"
                      >
                        {isCurrentlyExpanded ? (
                          <>
                            <EyeOff className="h-3.5 w-3.5" />
                            Hide Timeline
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5" />
                            Inspect Timeline
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Timeline expansions */}
                {isCurrentlyExpanded && (
                  <div className="border-t border-border/40 bg-panel-strong/45 p-5 space-y-4">
                    {media.timelineUrl && (
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                          Timeline Montage Snapshot
                        </label>
                        <div className="relative overflow-hidden rounded-lg border border-border bg-panel shadow-inner">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={media.timelineUrl}
                            alt="Composite timeline montage"
                            className="w-full max-h-20 object-cover"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-muted">
                        Extracted Key Frames
                      </h5>
                      {isLoadingFrames && !mediaFrames[media.id] ? (
                        <div className="flex py-6 justify-center items-center text-xs text-muted gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span>Loading timeline...</span>
                        </div>
                      ) : (
                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                          {mediaFrames[media.id]?.map((frame) => {
                            const counts = getDetectionCounts(frame.detections);
                            return (
                              <div
                                key={frame.id}
                                onClick={() => setSelectedFrame(frame)}
                                className="w-44 shrink-0 bg-panel border border-border/60 hover:border-primary/55 rounded-lg overflow-hidden transition shadow-sm hover:scale-[1.02] duration-200 cursor-pointer"
                              >
                                <div className="aspect-video relative bg-black/80 flex items-center justify-center overflow-hidden border-b border-border/30">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={frame.frameUrl}
                                    alt={`Timestamp ${frame.timestamp.toFixed(1)}s`}
                                    className="object-contain w-full h-full"
                                  />
                                </div>
                                <div className="p-2 space-y-1.5">
                                  <div className="flex justify-between items-center">
                                    <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                      {frame.timestamp.toFixed(1)}s
                                    </span>
                                    {frame.detections && frame.detections.length > 0 && (
                                      <span className="text-[9px] text-muted font-semibold">
                                        {frame.detections.length} objects
                                      </span>
                                    )}
                                  </div>
                                  {/* Badges */}
                                  {frame.detections && frame.detections.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-1 justify-center border-t border-border/10">
                                      {Object.entries(counts).map(([type, count]) => {
                                        let emoji = "📦";
                                        if (type === "Worker") emoji = "👷";
                                        else if (type === "Helmet") emoji = "🪖";
                                        else if (type === "Truck") emoji = "🚚";
                                        else if (type === "Crane") emoji = "🏗️";
                                        else if (type === "Excavator") emoji = "🚜";
                                        else if (type === "Scaffolding") emoji = "🪜";
                                        else if (type === "Pillar") emoji = "🧱";
                                        else if (type === "Wall") emoji = "🚧";
                                        return (
                                          <span
                                            key={type}
                                            className="inline-flex items-center gap-0.5 rounded bg-panel-strong px-1.5 py-0.5 text-[9px] font-medium text-foreground border border-border/30"
                                            title={`${count} ${type}`}
                                          >
                                            {emoji} {count}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Frame Inspector Modal */}
      {selectedFrame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 md:p-6 transition-all duration-300">
          <div className="relative flex flex-col md:flex-row w-full max-w-5xl h-[85vh] bg-panel border border-border rounded-2xl overflow-hidden shadow-2xl">
            {/* Header info for mobile */}
            <div className="flex md:hidden items-center justify-between p-4 border-b border-border bg-panel-strong w-full">
              <div className="text-left">
                <h3 className="font-bold text-foreground">Frame Inspector</h3>
                <p className="text-xs text-muted">Timestamp: {selectedFrame.timestamp.toFixed(2)}s</p>
              </div>
              <button 
                onClick={() => setSelectedFrame(null)}
                className="p-1 rounded hover:bg-border text-muted hover:text-foreground text-sm font-semibold"
              >
                Close
              </button>
            </div>

            {/* Left: Visual Canvas */}
            <div className="relative flex-1 bg-black flex items-center justify-center p-4 overflow-hidden select-none">
              <div className="relative max-w-full max-h-full aspect-video border border-border/20 rounded-lg overflow-hidden shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedFrame.frameUrl}
                  alt={`Frame at ${selectedFrame.timestamp.toFixed(2)}s`}
                  className="w-full h-full object-contain pointer-events-none"
                  style={{ maxHeight: "70vh" }}
                />

                {/* Overlays */}
                {selectedFrame.detections?.map((det) => {
                  if (!activeCategoryFilter[det.objectType]) return null;

                  const [xmin, ymin, xmax, ymax] = det.boundingBox;
                  const left = `${xmin * 100}%`;
                  const top = `${ymin * 100}%`;
                  const width = `${(xmax - xmin) * 100}%`;
                  const height = `${(ymax - ymin) * 100}%`;

                  let colorClass = "border-amber-500 text-amber-500 bg-amber-500/10";
                  if (det.objectType === "Helmet") colorClass = "border-green-500 text-green-500 bg-green-500/10";
                  else if (det.objectType === "Truck") colorClass = "border-blue-500 text-blue-500 bg-blue-500/10";
                  else if (det.objectType === "Crane") colorClass = "border-purple-500 text-purple-500 bg-purple-500/10";
                  else if (det.objectType === "Excavator") colorClass = "border-cyan-500 text-cyan-500 bg-cyan-500/10";
                  else if (det.objectType === "Scaffolding") colorClass = "border-indigo-500 text-indigo-500 bg-indigo-500/10";
                  else if (det.objectType === "Pillar") colorClass = "border-pink-500 text-pink-500 bg-pink-500/10";
                  else if (det.objectType === "Wall") colorClass = "border-orange-500 text-orange-500 bg-orange-500/10";

                  return (
                    <div
                      key={det.id}
                      className={`absolute border-2 transition-all duration-200 group/box hover:border-white hover:z-10 cursor-pointer ${colorClass}`}
                      style={{ left, top, width, height }}
                    >
                      <span className="absolute -top-6 left-0 px-1.5 py-0.5 text-[10px] font-bold bg-black/90 text-white rounded border border-inherit shadow whitespace-nowrap opacity-0 group-hover/box:opacity-100 transition-opacity duration-200 pointer-events-none">
                        {det.objectType} ({(det.confidence * 100).toFixed(0)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Info Controls Panel */}
            <div className="w-full md:w-80 bg-panel-strong border-t md:border-t-0 md:border-l border-border p-5 flex flex-col justify-between shrink-0">
              <div className="space-y-6">
                <div className="hidden md:flex items-center justify-between">
                  <div className="text-left">
                    <h3 className="font-bold text-lg text-foreground">Frame Inspector</h3>
                    <p className="text-xs text-muted">Keyframe at {selectedFrame.timestamp.toFixed(2)}s</p>
                  </div>
                  <button
                    onClick={() => setSelectedFrame(null)}
                    className="p-1.5 rounded hover:bg-border text-muted hover:text-foreground text-sm font-semibold transition"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted text-left">
                    Objects Detected ({selectedFrame.detections?.length ?? 0})
                  </h4>
                  {selectedFrame.detections?.length === 0 ? (
                    <p className="text-xs text-muted text-left">No objects detected.</p>
                  ) : (
                    <div className="max-h-[30vh] overflow-y-auto space-y-2 pr-1 border border-border/30 rounded-lg p-2 bg-background/50">
                      {selectedFrame.detections?.map((det) => {
                        // Safety violation check
                        const isViolated = det.objectType === "Worker" && 
                          !selectedFrame.detections?.some(
                            (h) => h.objectType === "Helmet" && 
                            Math.abs(h.boundingBox[0] - det.boundingBox[0]) < 0.15 &&
                            h.boundingBox[1] < det.boundingBox[1] &&
                            h.boundingBox[3] < det.boundingBox[3]
                          );

                        return (
                          <div
                            key={det.id}
                            className={`flex items-center justify-between p-2 rounded-md border text-xs transition hover:bg-panel ${
                              isViolated && det.objectType === "Worker" 
                                ? "bg-danger/5 border-danger/25 text-danger font-semibold" 
                                : "bg-panel-strong border-border/40 text-foreground"
                            }`}
                          >
                            <span className="font-medium flex items-center gap-1.5">
                              {det.objectType === "Worker" ? "👷" : 
                               det.objectType === "Helmet" ? "🪖" : 
                               det.objectType === "Truck" ? "🚚" : 
                               det.objectType === "Crane" ? "🏗️" : 
                               det.objectType === "Excavator" ? "🚜" : 
                               det.objectType === "Scaffolding" ? "🪜" : 
                               det.objectType === "Pillar" ? "🧱" : 
                               det.objectType === "Wall" ? "🚧" : "🛠️"}{" "}
                              {det.objectType}
                              {isViolated && det.objectType === "Worker" && (
                                <span className="ml-1 px-1 rounded bg-danger/10 text-danger text-[9px] font-bold border border-danger/20">
                                  No Helmet!
                                </span>
                              )}
                            </span>
                            <span className="font-mono text-muted text-[10px]">
                              {(det.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted text-left">
                    Filter Boxes
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(activeCategoryFilter).map((category) => {
                      const hasCount = selectedFrame.detections?.some((d) => d.objectType === category) ?? false;
                      return (
                        <button
                          key={category}
                          onClick={() =>
                            setActiveCategoryFilter((prev) => ({
                              ...prev,
                              [category]: !prev[category],
                            }))
                          }
                          disabled={!hasCount}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-medium text-left transition disabled:opacity-30 disabled:cursor-not-allowed ${
                            activeCategoryFilter[category] && hasCount
                              ? "bg-primary/10 border-primary/40 text-primary"
                              : "bg-background border-border/40 text-muted"
                          }`}
                        >
                          <span className="h-2 w-2 rounded-full" style={{
                            backgroundColor: 
                              category === "Worker" ? "#f59e0b" : 
                              category === "Helmet" ? "#22c55e" : 
                              category === "Truck" ? "#3b82f6" : 
                              category === "Crane" ? "#a855f7" : 
                              category === "Excavator" ? "#06b6d4" : 
                              category === "Scaffolding" ? "#6366f1" : 
                              category === "Pillar" ? "#ec4899" : 
                              category === "Wall" ? "#f97316" : "#14b8a6"
                          }} />
                          <span className="truncate">{category}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border/40 text-[10px] text-muted text-left">
                Tip: Bounding box overlays scale to the viewport window. Toggle categories to filter.
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
