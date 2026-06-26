"use client";

import React, { useRef, useState } from "react";
import { Loader2, Columns, Sliders, Eye, EyeOff } from "lucide-react";
import { VideoFrame } from "@/lib/api";

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

interface VisualComparisonStudioProps {
  activeTab: "split" | "slider";
  setActiveTab: (tab: "split" | "slider") => void;
  showOverlayA: boolean;
  setShowOverlayA: (show: boolean) => void;
  showOverlayB: boolean;
  setShowOverlayB: (show: boolean) => void;
  activeCategoryFilter: Record<string, boolean>;
  setActiveCategoryFilter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  selectedFrameA: VideoFrame | null;
  selectedFrameB: VideoFrame | null;
  isLoadingFramesA: boolean;
  isLoadingFramesB: boolean;
  framesA: VideoFrame[];
  framesB: VideoFrame[];
  handleSelectFrameA: (frame: VideoFrame) => void;
  handleSelectFrameB: (frame: VideoFrame) => void;
  analysisMode: "cross" | "intra";
  isAnalyzing: boolean;
  handleCompare: () => void;
}

export default function VisualComparisonStudio({
  activeTab,
  setActiveTab,
  showOverlayA,
  setShowOverlayA,
  showOverlayB,
  setShowOverlayB,
  activeCategoryFilter,
  setActiveCategoryFilter,
  selectedFrameA,
  selectedFrameB,
  isLoadingFramesA,
  isLoadingFramesB,
  framesA,
  framesB,
  handleSelectFrameA,
  handleSelectFrameB,
  analysisMode,
  isAnalyzing,
  handleCompare,
}: VisualComparisonStudioProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

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

  return (
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

        {/* Action compare button - moved below timelines */}
        <div className="flex justify-end pt-4 border-t border-border/40">
          <button
            onClick={handleCompare}
            disabled={isAnalyzing || !selectedFrameA || !selectedFrameB}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/95 disabled:opacity-50 cursor-pointer transition shrink-0"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Comparing...
              </>
            ) : (
              "Compare Frames"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
