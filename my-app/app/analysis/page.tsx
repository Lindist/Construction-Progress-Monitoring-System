"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { listProjects, listProjectMedia, compareProgress, listMediaFrames, Project, AnalysisResult, VideoFrame } from "@/lib/api";
import { UploadedMedia } from "@/types/media";
import { useQuery } from "@tanstack/react-query";
import { Diff, Loader2, AlertCircle, RefreshCw, ArrowRight, HelpCircle, Columns, Sliders, Eye, EyeOff } from "lucide-react";

const getOverlayColor = (category: string) => {
  let colorClass = "border-amber-500 text-amber-500 bg-amber-500/10";
  if (category === "Helmet") colorClass = "border-green-500 text-green-500 bg-green-500/10";
  else if (category === "Truck") colorClass = "border-blue-500 text-blue-500 bg-blue-500/10";
  else if (category === "Crane") colorClass = "border-purple-500 text-purple-500 bg-purple-500/10";
  else if (category === "Excavator") colorClass = "border-cyan-500 text-cyan-500 bg-cyan-500/10";
  else if (category === "Scaffolding") colorClass = "border-indigo-500 text-indigo-500 bg-indigo-500/10";
  else if (category === "Pillar") colorClass = "border-pink-500 text-pink-500 bg-pink-500/10";
  else if (category === "Wall") colorClass = "border-orange-500 text-orange-500 bg-orange-500/10";
  return colorClass;
};

export default function AnalysisPage() {
  const router = useRouter();
  const { isAuthenticated, token } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [compareMediaIdA, setCompareMediaIdA] = useState<string>("");
  const [compareMediaIdB, setCompareMediaIdB] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Phase 8 Visual Comparison States
  const [activeTab, setActiveTab] = useState<"split" | "slider">("split");
  const [framesA, setFramesA] = useState<VideoFrame[]>([]);
  const [framesB, setFramesB] = useState<VideoFrame[]>([]);
  const [selectedFrameA, setSelectedFrameA] = useState<VideoFrame | null>(null);
  const [selectedFrameB, setSelectedFrameB] = useState<VideoFrame | null>(null);
  const [isLoadingFramesA, setIsLoadingFramesA] = useState(false);
  const [isLoadingFramesB, setIsLoadingFramesB] = useState(false);
  const [showOverlayA, setShowOverlayA] = useState(true);
  const [showOverlayB, setShowOverlayB] = useState(true);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

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

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch frames for Media A
  useEffect(() => {
    if (compareMediaIdA) {
      setIsLoadingFramesA(true);
      listMediaFrames(compareMediaIdA)
        .then((frames) => {
          setFramesA(frames);
          if (frames.length > 0) {
            setSelectedFrameA(frames[0]);
          } else {
            setSelectedFrameA(null);
          }
        })
        .catch((err) => {
          console.error("Failed to load frames for media A:", err);
        })
        .finally(() => {
          setIsLoadingFramesA(false);
        });
    } else {
      setFramesA([]);
      setSelectedFrameA(null);
    }
  }, [compareMediaIdA]);

  // Fetch frames for Media B
  useEffect(() => {
    if (compareMediaIdB) {
      setIsLoadingFramesB(true);
      listMediaFrames(compareMediaIdB)
        .then((frames) => {
          setFramesB(frames);
          if (frames.length > 0) {
            setSelectedFrameB(frames[0]);
          } else {
            setSelectedFrameB(null);
          }
        })
        .catch((err) => {
          console.error("Failed to load frames for media B:", err);
        })
        .finally(() => {
          setIsLoadingFramesB(false);
        });
    } else {
      setFramesB([]);
      setSelectedFrameB(null);
    }
  }, [compareMediaIdB]);

  // Sync timeline A scrubber selection and find closest B frame
  const handleSelectFrameA = (frame: VideoFrame) => {
    setSelectedFrameA(frame);
    if (framesB.length > 0) {
      const closest = framesB.reduce((prev, curr) => {
        return Math.abs(curr.timestamp - frame.timestamp) < Math.abs(prev.timestamp - frame.timestamp) ? curr : prev;
      });
      setSelectedFrameB(closest);
    }
  };

  // Sync timeline B scrubber selection and find closest A frame
  const handleSelectFrameB = (frame: VideoFrame) => {
    setSelectedFrameB(frame);
    if (framesA.length > 0) {
      const closest = framesA.reduce((prev, curr) => {
        return Math.abs(curr.timestamp - frame.timestamp) < Math.abs(prev.timestamp - frame.timestamp) ? curr : prev;
      });
      setSelectedFrameA(closest);
    }
  };

  // Drag handlers for Before/After Slider
  const handleMouseMove = (e: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pos = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(pos);
  };

  const handleMouseUp = () => {
    setIsDraggingSlider(false);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  };

  const handleMouseDown = () => {
    setIsDraggingSlider(true);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.touches[0].clientX;
    const x = clientX - rect.left;
    const pos = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(pos);
  };

  const handleTouchEnd = () => {
    window.removeEventListener("touchmove", handleTouchMove);
    window.removeEventListener("touchend", handleTouchEnd);
  };

  const handleTouchStart = () => {
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleTouchEnd);
  };

  useEffect(() => {
    setMounted(true);
    if (!token && !localStorage.getItem("token")) {
      router.push("/login");
    }
  }, [token, router]);

  // Query projects
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: listProjects,
    enabled: !!token,
  });

  // Set default selected project
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Query project media
  const { data: projectMedia = [], isLoading: isLoadingMedia } = useQuery<UploadedMedia[]>({
    queryKey: ["projectMedia", selectedProjectId],
    queryFn: () => listProjectMedia(selectedProjectId),
    enabled: !!selectedProjectId,
  });

  const handleCompare = async () => {
    if (!compareMediaIdA || !compareMediaIdB) {
      setAnalysisError("Please select both media files to compare.");
      return;
    }
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    try {
      const data = await compareProgress(compareMediaIdA, compareMediaIdB);
      setAnalysisResult(data);
    } catch (err: any) {
      console.error("Comparison failed:", err);
      setAnalysisError(err.message || "Failed to compare construction progress.");
    } finally {
      setIsAnalyzing(false);
    }
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
      {/* Page Title */}
      <div className="border-b border-border pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Diff className="text-primary" size={28} />
          Site Progress Analysis
        </h1>
        <p className="mt-1 text-sm text-muted">
          Compare the state of two inspections to evaluate layout changes, worker counts, and structural growth.
        </p>
      </div>

      {/* Selectors Panel */}
      <div className="rounded-xl border border-border bg-panel p-6 shadow-sm space-y-6 text-left">
        <div className="max-w-xs">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
            Target Project
          </label>
          {isLoadingProjects ? (
            <div className="h-10 flex items-center text-xs text-muted">Loading projects...</div>
          ) : (
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setCompareMediaIdA("");
                setCompareMediaIdB("");
                setAnalysisResult(null);
                setAnalysisError(null);
              }}
              className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="">-- Choose Project --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedProjectId && (
          <div className="grid gap-6 md:grid-cols-[1fr_1fr_auto] items-end bg-panel-strong p-5 rounded-xl border border-border/40">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                Baseline State (Date A - Before)
              </label>
              {isLoadingMedia ? (
                <div className="h-11 flex items-center text-xs text-muted">Loading files...</div>
              ) : (
                <select
                  value={compareMediaIdA}
                  onChange={(e) => {
                    setCompareMediaIdA(e.target.value);
                    setAnalysisResult(null);
                  }}
                  disabled={isAnalyzing}
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50"
                >
                  <option value="">-- Select baseline media --</option>
                  {projectMedia.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.originalName} ({new Date(m.uploadedAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                Target State (Date B - After)
              </label>
              {isLoadingMedia ? (
                <div className="h-11 flex items-center text-xs text-muted">Loading files...</div>
              ) : (
                <select
                  value={compareMediaIdB}
                  onChange={(e) => {
                    setCompareMediaIdB(e.target.value);
                    setAnalysisResult(null);
                  }}
                  disabled={isAnalyzing}
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50"
                >
                  <option value="">-- Select progress media --</option>
                  {projectMedia.map((m) => (
                    <option key={m.id} value={m.id} disabled={m.id === compareMediaIdA}>
                      {m.originalName} ({new Date(m.uploadedAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              onClick={handleCompare}
              disabled={isAnalyzing || !compareMediaIdA || !compareMediaIdB}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/95 disabled:opacity-50 cursor-pointer w-full md:w-auto"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running Engine...
                </>
              ) : (
                "Run Comparison"
              )}
            </button>
          </div>
        )}
      </div>

      {analysisError && (
        <div className="flex gap-2.5 rounded-md border border-danger/35 bg-danger/5 px-4 py-3 text-sm text-danger text-left">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{analysisError}</span>
        </div>
      )}

      {/* Analysis Report Results */}
      {analysisResult ? (
        <div className="space-y-8 text-left transition duration-500">
          {/* Top Overview Cards */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-panel p-5 text-center shadow-sm">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">Change Score</span>
              <div className="mt-2 text-3xl font-extrabold text-primary">
                {analysisResult.change_score.toFixed(0)}%
              </div>
              <p className="mt-1 text-xs text-muted">Overall difference density</p>
            </div>

            <div className="rounded-xl border border-border bg-panel p-5 text-center shadow-sm">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">Progress Baseline (A)</span>
              <div className="mt-2 text-3xl font-extrabold text-foreground">
                {analysisResult.progress_percentage_a.toFixed(0)}%
              </div>
              <p className="mt-1 text-xs text-muted">Initial site status</p>
            </div>

            <div className="rounded-xl border border-border bg-panel p-5 text-center shadow-sm">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">Progress Target (B)</span>
              <div className="mt-2 text-3xl font-extrabold text-foreground">
                {analysisResult.progress_percentage_b.toFixed(0)}%
              </div>
              <p className="mt-1 text-xs text-muted">Latest site status</p>
            </div>

            <div className="rounded-xl border border-border bg-panel p-5 text-center shadow-sm">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">Net Progress Growth</span>
              <div className={`mt-2 text-3xl font-extrabold ${analysisResult.growth_percentage >= 0 ? "text-success" : "text-danger"}`}>
                {analysisResult.growth_percentage >= 0 ? "+" : ""}{analysisResult.growth_percentage.toFixed(0)}%
              </div>
              <p className="mt-1 text-xs text-muted">Structural expansion delta</p>
            </div>
          </div>

          {/* Structural Growth Summary Card */}
          <div className="rounded-xl border border-border bg-panel p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">Structural Development Review</h3>
              <p className="text-sm text-muted">{analysisResult.structural_growth.description}</p>
            </div>
            <div className="shrink-0">
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold border ${
                analysisResult.structural_growth.is_growing 
                  ? "bg-success/10 border-success/20 text-success" 
                  : "bg-muted/10 border-border/40 text-muted"
              }`}>
                {analysisResult.structural_growth.is_growing ? "🏗️ Active Expansion" : "🛑 Steady State"}
              </span>
            </div>
          </div>

          {/* Visual Comparison Studio */}
          <div className="rounded-xl border border-border bg-panel overflow-hidden shadow-sm space-y-4">
            {/* Header with tabs & settings */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border bg-panel-strong/40 p-4 gap-3 text-left">
              <div>
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                  📸 Visual Comparison Studio
                </h3>
                <p className="text-xs text-muted">
                  Inspect visual differences side-by-side or drag the slider.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Toggle Mode */}
                <div className="flex bg-background border border-border p-0.5 rounded-md">
                  <button
                    onClick={() => setActiveTab("split")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-semibold transition cursor-pointer ${
                      activeTab === "split" ? "bg-panel-strong text-foreground shadow-sm" : "text-muted hover:text-foreground"
                    }`}
                  >
                    <Columns size={13} />
                    Split Screen
                  </button>
                  <button
                    onClick={() => setActiveTab("slider")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-semibold transition cursor-pointer ${
                      activeTab === "slider" ? "bg-panel-strong text-foreground shadow-sm" : "text-muted hover:text-foreground"
                    }`}
                  >
                    <Sliders size={13} />
                    Slider
                  </button>
                </div>

                {/* Overlay Switches */}
                <button
                  onClick={() => setShowOverlayA(!showOverlayA)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-xs font-semibold transition cursor-pointer ${
                    showOverlayA ? "bg-primary/10 border-primary/20 text-primary animate-pulse" : "bg-background border-border text-muted"
                  }`}
                  title="Toggle AI overlay on baseline (before)"
                >
                  {showOverlayA ? <Eye size={12} /> : <EyeOff size={12} />}
                  AI (Before)
                </button>
                <button
                  onClick={() => setShowOverlayB(!showOverlayB)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-xs font-semibold transition cursor-pointer ${
                    showOverlayB ? "bg-primary/10 border-primary/20 text-primary animate-pulse" : "bg-background border-border text-muted"
                  }`}
                  title="Toggle AI overlay on target (after)"
                >
                  {showOverlayB ? <Eye size={12} /> : <EyeOff size={12} />}
                  AI (After)
                </button>
              </div>
            </div>

            {/* Category Filtering Chips */}
            <div className="px-5 py-2.5 flex flex-wrap gap-2 border-b border-border/40 text-left">
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wider self-center mr-1">
                Overlays Filter:
              </span>
              {Object.keys(activeCategoryFilter).map((category) => {
                const hasA = selectedFrameA?.detections?.some((d) => d.objectType === category) ?? false;
                const hasB = selectedFrameB?.detections?.some((d) => d.objectType === category) ?? false;
                const hasCount = hasA || hasB;

                return (
                  <button
                    key={category}
                    onClick={() =>
                      setActiveCategoryFilter((prev) => ({
                        ...prev,
                        [category]: !prev[category],
                      }))
                    }
                    className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium transition cursor-pointer ${
                      activeCategoryFilter[category]
                        ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                        : "bg-background border-border/40 text-muted"
                    } ${!hasCount ? "opacity-45" : ""}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{
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
                    <span>{category}</span>
                  </button>
                );
              })}
            </div>

            {/* The Interactive Compare Canvas */}
            <div className="p-4 bg-background">
              {activeTab === "split" ? (
                /* Split Screen side-by-side */
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Baseline Panel A */}
                  <div className="space-y-2 text-left">
                    <div className="flex justify-between items-center px-1.5">
                      <span className="text-xs font-semibold text-muted">
                        📅 Baseline (Date A) - {selectedFrameA ? `${selectedFrameA.timestamp.toFixed(1)}s` : "No Frame"}
                      </span>
                      {selectedFrameA?.detections && selectedFrameA.detections.length > 0 && (
                        <span className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded text-muted">
                          {selectedFrameA.detections.length} objects
                        </span>
                      )}
                    </div>
                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-border/60">
                      {isLoadingFramesA ? (
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted">
                          <Loader2 className="h-5 w-5 animate-spin mr-2 text-primary" /> Loading Baseline...
                        </div>
                      ) : selectedFrameA ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={selectedFrameA.frameUrl}
                            alt="Baseline frame"
                            className="w-full h-full object-contain pointer-events-none"
                          />
                          {showOverlayA && selectedFrameA.detections?.map((det) => {
                            if (!activeCategoryFilter[det.objectType]) return null;
                            const [xmin, ymin, xmax, ymax] = det.boundingBox;
                            return (
                              <div
                                key={det.id}
                                className={`absolute border-2 transition-all duration-200 group/box hover:border-white hover:z-10 cursor-pointer ${getOverlayColor(det.objectType)}`}
                                style={{
                                  left: `${xmin * 100}%`,
                                  top: `${ymin * 100}%`,
                                  width: `${(xmax - xmin) * 100}%`,
                                  height: `${(ymax - ymin) * 100}%`,
                                }}
                              >
                                <span className="absolute -top-6 left-0 px-1.5 py-0.5 text-[10px] font-bold bg-black/90 text-white rounded border border-inherit shadow whitespace-nowrap opacity-0 group-hover/box:opacity-100 transition-opacity duration-150 pointer-events-none z-30">
                                  {det.objectType} ({(det.confidence * 100).toFixed(0)}%)
                                </span>
                              </div>
                            );
                          })}
                        </>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted">
                          No baseline keyframes found.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Target Panel B */}
                  <div className="space-y-2 text-left">
                    <div className="flex justify-between items-center px-1.5">
                      <span className="text-xs font-semibold text-muted">
                        📅 Target (Date B) - {selectedFrameB ? `${selectedFrameB.timestamp.toFixed(1)}s` : "No Frame"}
                      </span>
                      {selectedFrameB?.detections && selectedFrameB.detections.length > 0 && (
                        <span className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded text-muted">
                          {selectedFrameB.detections.length} objects
                        </span>
                      )}
                    </div>
                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-border/60">
                      {isLoadingFramesB ? (
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted">
                          <Loader2 className="h-5 w-5 animate-spin mr-2 text-primary" /> Loading Target...
                        </div>
                      ) : selectedFrameB ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={selectedFrameB.frameUrl}
                            alt="Target frame"
                            className="w-full h-full object-contain pointer-events-none"
                          />
                          {showOverlayB && selectedFrameB.detections?.map((det) => {
                            if (!activeCategoryFilter[det.objectType]) return null;
                            const [xmin, ymin, xmax, ymax] = det.boundingBox;
                            return (
                              <div
                                key={det.id}
                                className={`absolute border-2 transition-all duration-200 group/box hover:border-white hover:z-10 cursor-pointer ${getOverlayColor(det.objectType)}`}
                                style={{
                                  left: `${xmin * 100}%`,
                                  top: `${ymin * 100}%`,
                                  width: `${(xmax - xmin) * 100}%`,
                                  height: `${(ymax - ymin) * 100}%`,
                                }}
                              >
                                <span className="absolute -top-6 left-0 px-1.5 py-0.5 text-[10px] font-bold bg-black/90 text-white rounded border border-inherit shadow whitespace-nowrap opacity-0 group-hover/box:opacity-100 transition-opacity duration-150 pointer-events-none z-30">
                                  {det.objectType} ({(det.confidence * 100).toFixed(0)}%)
                                </span>
                              </div>
                            );
                          })}
                        </>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted">
                          No target keyframes found.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Before/After Overlay Slider comparison */
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-border/60 max-w-4xl mx-auto text-left select-none">
                  {isLoadingFramesA || isLoadingFramesB ? (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-muted">
                      <Loader2 className="h-5 w-5 animate-spin mr-2 text-primary" /> Loading Comparison...
                    </div>
                  ) : selectedFrameA && selectedFrameB ? (
                    <div
                      ref={containerRef}
                      className="relative w-full h-full cursor-ew-resize overflow-hidden"
                      onMouseDown={handleMouseDown}
                      onTouchStart={handleTouchStart}
                    >
                      {/* Baseline state (Date A) - Bottom Image */}
                      <div className="absolute inset-0 w-full h-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selectedFrameA.frameUrl}
                          alt="Baseline image"
                          className="w-full h-full object-contain pointer-events-none"
                        />
                        {/* Baseline overlays */}
                        {showOverlayA && selectedFrameA.detections?.map((det) => {
                          if (!activeCategoryFilter[det.objectType]) return null;
                          const [xmin, ymin, xmax, ymax] = det.boundingBox;
                          // Only show bounding boxes that fall to the right of slider
                          if (xmin * 100 < sliderPosition) return null;
                          return (
                            <div
                              key={det.id}
                              className={`absolute border-2 transition-all duration-200 group/box hover:border-white hover:z-10 cursor-pointer ${getOverlayColor(det.objectType)}`}
                              style={{
                                  left: `${xmin * 100}%`,
                                  top: `${ymin * 100}%`,
                                  width: `${(xmax - xmin) * 100}%`,
                                  height: `${(ymax - ymin) * 100}%`,
                              }}
                            >
                              <span className="absolute -top-6 left-0 px-1.5 py-0.5 text-[10px] font-bold bg-black/90 text-white rounded border border-inherit shadow whitespace-nowrap opacity-0 group-hover/box:opacity-100 transition-opacity duration-150 pointer-events-none z-30">
                                {det.objectType} (Before)
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Target state (Date B) - Top Image (Clipped) */}
                      <div
                        className="absolute inset-0 w-full h-full select-none"
                        style={{
                          clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selectedFrameB.frameUrl}
                          alt="Target image"
                          className="w-full h-full object-contain pointer-events-none"
                        />
                        {/* Target overlays */}
                        {showOverlayB && selectedFrameB.detections?.map((det) => {
                          if (!activeCategoryFilter[det.objectType]) return null;
                          const [xmin, ymin, xmax, ymax] = det.boundingBox;
                          // Only show bounding boxes that fall to the left of slider
                          if (xmin * 100 > sliderPosition) return null;
                          return (
                            <div
                              key={det.id}
                              className={`absolute border-2 transition-all duration-200 group/box hover:border-white hover:z-10 cursor-pointer ${getOverlayColor(det.objectType)}`}
                              style={{
                                left: `${xmin * 100}%`,
                                top: `${ymin * 100}%`,
                                width: `${(xmax - xmin) * 100}%`,
                                height: `${(ymax - ymin) * 100}%`,
                              }}
                            >
                              <span className="absolute -top-6 left-0 px-1.5 py-0.5 text-[10px] font-bold bg-black/90 text-white rounded border border-inherit shadow whitespace-nowrap opacity-0 group-hover/box:opacity-100 transition-opacity duration-150 pointer-events-none z-30">
                                {det.objectType} (After)
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Slider Division Line */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white hover:bg-primary transition shadow-[0_0_8px_rgba(0,0,0,0.5)] z-20 pointer-events-none"
                        style={{ left: `${sliderPosition}%` }}
                      >
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white border-2 border-primary hover:scale-110 active:scale-95 transition rounded-full flex items-center justify-center shadow-lg pointer-events-auto cursor-ew-resize">
                          <span className="text-[10px] font-bold text-primary select-none">↔</span>
                        </div>
                      </div>

                      {/* Hover tips */}
                      <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-sm text-white border border-white/10 px-2 py-1 rounded text-[10px] font-medium z-10">
                        Left: Target (Date B - After)
                      </div>
                      <div className="absolute top-3 right-3 bg-black/75 backdrop-blur-sm text-white border border-white/10 px-2 py-1 rounded text-[10px] font-medium z-10">
                        Right: Baseline (Date A - Before)
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-muted">
                      Select media containing keyframes to inspect.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Timelines Scrubber Section */}
            <div className="bg-panel-strong/30 border-t border-border p-4 space-y-4 text-left">
              {/* Timeline A */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted">
                  ⏳ Baseline Timeline (Date A - Click to scrub)
                </label>
                {isLoadingFramesA ? (
                  <div className="h-16 flex items-center text-xs text-muted">Loading timeline frames...</div>
                ) : framesA.length === 0 ? (
                  <div className="h-16 flex items-center text-xs text-muted border border-dashed border-border rounded-lg justify-center">
                    No frames available for Date A.
                  </div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                    {framesA.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => handleSelectFrameA(f)}
                        className={`w-24 shrink-0 aspect-video relative bg-black border rounded overflow-hidden transition cursor-pointer hover:border-primary/60 ${
                          selectedFrameA?.id === f.id ? "border-primary ring-2 ring-primary/20 scale-[0.98]" : "border-border/60"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={f.frameUrl}
                          alt={`Timestamp ${f.timestamp}s`}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1 right-1 bg-black/85 text-white font-mono text-[9px] px-1 rounded">
                          {f.timestamp.toFixed(1)}s
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Timeline B */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted">
                  ⏳ Target Timeline (Date B - Click to scrub)
                </label>
                {isLoadingFramesB ? (
                  <div className="h-16 flex items-center text-xs text-muted">Loading timeline frames...</div>
                ) : framesB.length === 0 ? (
                  <div className="h-16 flex items-center text-xs text-muted border border-dashed border-border rounded-lg justify-center">
                    No frames available for Date B.
                  </div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                    {framesB.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => handleSelectFrameB(f)}
                        className={`w-24 shrink-0 aspect-video relative bg-black border rounded overflow-hidden transition cursor-pointer hover:border-primary/60 ${
                          selectedFrameB?.id === f.id ? "border-primary ring-2 ring-primary/20 scale-[0.98]" : "border-border/60"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={f.frameUrl}
                          alt={`Timestamp ${f.timestamp}s`}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1 right-1 bg-black/85 text-white font-mono text-[9px] px-1 rounded">
                          {f.timestamp.toFixed(1)}s
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Object Count Comparison Table */}
            <div className="rounded-xl border border-border bg-panel p-5 shadow-sm">
              <h3 className="text-base font-semibold text-foreground mb-4">Object Count Audit</h3>
              <div className="overflow-x-auto text-left">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted uppercase font-semibold">
                      <th className="py-2.5">Object Category</th>
                      <th className="py-2.5 text-center">Baseline (A)</th>
                      <th className="py-2.5 text-center">Latest (B)</th>
                      <th className="py-2.5 text-right">Delta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {analysisResult.object_count_diffs.map((diff: any) => {
                      if (diff.count_a === 0 && diff.count_b === 0) return null;
                      return (
                        <tr key={diff.object_type} className="hover:bg-background/20">
                          <td className="py-2.5 font-medium flex items-center gap-1.5">
                            {diff.object_type === "Worker" ? "👷" : 
                             diff.object_type === "Helmet" ? "🪖" : 
                             diff.object_type === "Truck" ? "🚚" : 
                             diff.object_type === "Crane" ? "🏗️" : 
                             diff.object_type === "Excavator" ? "🚜" : 
                             diff.object_type === "Scaffolding" ? "🪜" : 
                             diff.object_type === "Pillar" ? "🧱" : 
                             diff.object_type === "Wall" ? "🚧" : "🛠️"}{" "}
                            {diff.object_type}
                          </td>
                          <td className="py-2.5 text-center font-mono">{diff.count_a}</td>
                          <td className="py-2.5 text-center font-mono">{diff.count_b}</td>
                          <td className={`py-2.5 text-right font-mono font-bold ${
                            diff.difference > 0 ? "text-success" : 
                            diff.difference < 0 ? "text-danger" : "text-muted"
                          }`}>
                            {diff.difference > 0 ? "+" : ""}{diff.difference}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Spatial Area Changes and New/Removed Logs */}
            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-panel p-5 shadow-sm">
                <h3 className="text-base font-semibold text-foreground mb-3">Area Coverage Analysis</h3>
                <div className="space-y-3">
                  {analysisResult.area_changes.map((chg: any) => {
                    if (chg.area_a === 0 && chg.area_b === 0) return null;
                    const isIncrease = chg.difference > 0;
                    return (
                      <div key={chg.object_type} className="flex justify-between items-center text-xs p-2.5 rounded bg-panel-strong border border-border/20">
                        <span className="font-semibold text-muted">{chg.object_type}</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-muted">A: {(chg.area_a * 100).toFixed(1)}%</span>
                          <span className="text-muted">→</span>
                          <span className="text-foreground">B: {(chg.area_b * 100).toFixed(1)}%</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isIncrease ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                          }`}>
                            {isIncrease ? "+" : ""}{chg.percent_change.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* New and Removed Items Log */}
              <div className="grid gap-4 grid-cols-2 text-left">
                <div className="rounded-xl border border-border bg-panel p-4 shadow-sm">
                  <h4 className="text-xs font-semibold text-success uppercase tracking-wider mb-2">New Introductions</h4>
                  {analysisResult.new_objects.length === 0 ? (
                    <p className="text-xs text-muted">No new categories.</p>
                  ) : (
                    <ul className="space-y-1.5 text-xs text-foreground">
                      {analysisResult.new_objects.map((obj: any) => (
                        <li key={obj.object_type} className="flex items-center gap-1.5 truncate">
                          <span>✨</span>
                          <span>{obj.object_type} (+{obj.count})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-panel p-4 shadow-sm">
                  <h4 className="text-xs font-semibold text-danger uppercase tracking-wider mb-2">Removals / Departures</h4>
                  {analysisResult.removed_objects.length === 0 ? (
                    <p className="text-xs text-muted">No categories removed.</p>
                  ) : (
                    <ul className="space-y-1.5 text-xs text-foreground">
                      {analysisResult.removed_objects.map((obj: any) => (
                        <li key={obj.object_type} className="flex items-center gap-1.5 truncate">
                          <span>🗑️</span>
                          <span>{obj.object_type} (-{obj.count})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-panel p-12 text-center py-20">
          <HelpCircle className="h-12 w-12 text-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground">Select Baseline & Target Inspection</h3>
          <p className="text-sm text-muted mt-2 max-w-md mx-auto">
            Choose a baseline media upload (Date A) and compare it against a target progress media upload (Date B) to run the CV comparison engine.
          </p>
        </div>
      )}
    </main>
  );
}
