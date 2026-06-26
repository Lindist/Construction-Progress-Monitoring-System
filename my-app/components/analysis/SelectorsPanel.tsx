"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { Project } from "@/lib/api";
import { UploadedMedia } from "@/types/media";
import { VideoFrame } from "@/lib/api";

interface SelectorsPanelProps {
  projects: Project[];
  isLoadingProjects: boolean;
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  analysisMode: "cross" | "intra";
  setAnalysisMode: (mode: "cross" | "intra") => void;
  projectMedia: UploadedMedia[];
  isLoadingMedia: boolean;
  compareMediaIdA: string;
  setCompareMediaIdA: (id: string) => void;
  compareMediaIdB: string;
  setCompareMediaIdB: (id: string) => void;
  singleMediaId: string;
  setSingleMediaId: (id: string) => void;
  framesA: VideoFrame[];
  framesB: VideoFrame[];
  isLoadingFramesA: boolean;
  isLoadingFramesB: boolean;
  selectedFrameA: VideoFrame | null;
  setSelectedFrameA: (frame: VideoFrame) => void;
  selectedFrameB: VideoFrame | null;
  setSelectedFrameB: (frame: VideoFrame) => void;
  isAnalyzing: boolean;
  handleCompare: () => void;
  setAnalysisResult: (res: any) => void;
  setAnalysisError: (err: string | null) => void;
}

export default function SelectorsPanel({
  projects,
  isLoadingProjects,
  selectedProjectId,
  setSelectedProjectId,
  analysisMode,
  setAnalysisMode,
  projectMedia,
  isLoadingMedia,
  compareMediaIdA,
  setCompareMediaIdA,
  compareMediaIdB,
  setCompareMediaIdB,
  singleMediaId,
  setSingleMediaId,
  framesA,
  framesB,
  isLoadingFramesA,
  isLoadingFramesB,
  selectedFrameA,
  setSelectedFrameA,
  selectedFrameB,
  setSelectedFrameB,
  isAnalyzing,
  handleCompare,
  setAnalysisResult,
  setAnalysisError,
}: SelectorsPanelProps) {
  return (
    <div className="rounded-xl border border-border bg-panel p-6 shadow-sm space-y-6 text-left">
      <div className="grid gap-6 md:grid-cols-2">
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
                setSingleMediaId("");
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

        <div className="max-w-xs">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
            Analysis Scope
          </label>
          <div className="flex bg-background border border-border p-1 rounded-md h-11.5 items-center">
            <button
              type="button"
              onClick={() => {
                setAnalysisMode("cross");
                setAnalysisResult(null);
                setAnalysisError(null);
              }}
              className={`flex-1 text-center py-2 rounded-sm text-xs font-semibold transition cursor-pointer ${
                analysisMode === "cross" ? "bg-panel-strong text-foreground shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              Compare 2 Videos
            </button>
            <button
              type="button"
              onClick={() => {
                setAnalysisMode("intra");
                setAnalysisResult(null);
                setAnalysisError(null);
              }}
              className={`flex-1 text-center py-2 rounded-sm text-xs font-semibold transition cursor-pointer ${
                analysisMode === "intra" ? "bg-panel-strong text-foreground shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              Compare Frames in 1 Video
            </button>
          </div>
        </div>
      </div>

      {selectedProjectId && (
        analysisMode === "cross" ? (
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
        ) : (
          <div className="grid gap-6 md:grid-cols-[1.5fr_1fr_1fr_auto] items-end bg-panel-strong p-5 rounded-xl border border-border/40">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                Select Target Video
              </label>
              {isLoadingMedia ? (
                <div className="h-11 flex items-center text-xs text-muted">Loading files...</div>
              ) : (
                <select
                  value={singleMediaId}
                  onChange={(e) => {
                    setSingleMediaId(e.target.value);
                    setAnalysisResult(null);
                  }}
                  disabled={isAnalyzing}
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50"
                >
                  <option value="">-- Select video file --</option>
                  {projectMedia.filter(m => m.contentType.startsWith("video/")).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.originalName} ({new Date(m.uploadedAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                Baseline Frame (A - Before)
              </label>
              {isLoadingFramesA ? (
                <div className="h-11 flex items-center text-xs text-muted">Loading frames...</div>
              ) : (
                <select
                  value={selectedFrameA?.id || ""}
                  onChange={(e) => {
                    const frame = framesA.find(f => f.id === e.target.value);
                    if (frame) setSelectedFrameA(frame);
                    setAnalysisResult(null);
                  }}
                  disabled={isAnalyzing || !singleMediaId}
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50"
                >
                  <option value="">-- Select frame --</option>
                  {framesA.map((f) => (
                    <option key={f.id} value={f.id}>
                      Timestamp {f.timestamp.toFixed(1)}s ({f.detections?.length ?? 0} obj)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                Target Frame (B - After)
              </label>
              {isLoadingFramesB ? (
                <div className="h-11 flex items-center text-xs text-muted">Loading frames...</div>
              ) : (
                <select
                  value={selectedFrameB?.id || ""}
                  onChange={(e) => {
                    const frame = framesB.find(f => f.id === e.target.value);
                    if (frame) setSelectedFrameB(frame);
                    setAnalysisResult(null);
                  }}
                  disabled={isAnalyzing || !singleMediaId}
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50"
                >
                  <option value="">-- Select frame --</option>
                  {framesB.map((f) => (
                    <option key={f.id} value={f.id} disabled={f.id === selectedFrameA?.id}>
                      Timestamp {f.timestamp.toFixed(1)}s ({f.detections?.length ?? 0} obj)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              onClick={handleCompare}
              disabled={isAnalyzing || !singleMediaId || !selectedFrameA || !selectedFrameB}
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
        )
      )}
    </div>
  );
}
