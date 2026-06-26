"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { listProjects, listProjectMedia, compareProgress, compareFrames, listMediaFrames, Project, AnalysisResult, VideoFrame } from "@/lib/api";
import { UploadedMedia } from "@/types/media";
import { useQuery } from "@tanstack/react-query";
import { Diff, AlertCircle, RefreshCw, HelpCircle } from "lucide-react";
import SelectorsPanel from "@/components/analysis/SelectorsPanel";
import VisualComparisonStudio from "@/components/analysis/VisualComparisonStudio";
import AnalysisResultsPanel from "@/components/analysis/AnalysisResultsPanel";

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

  // Visual Comparison States
  const [activeTab, setActiveTab] = useState<"split" | "slider">("split");
  const [framesA, setFramesA] = useState<VideoFrame[]>([]);
  const [framesB, setFramesB] = useState<VideoFrame[]>([]);
  const [selectedFrameA, setSelectedFrameA] = useState<VideoFrame | null>(null);
  const [selectedFrameB, setSelectedFrameB] = useState<VideoFrame | null>(null);
  const [isLoadingFramesA, setIsLoadingFramesA] = useState(false);
  const [isLoadingFramesB, setIsLoadingFramesB] = useState(false);
  const [showOverlayA, setShowOverlayA] = useState(true);
  const [showOverlayB, setShowOverlayB] = useState(true);

  // Single Video comparison state
  const [analysisMode, setAnalysisMode] = useState<"cross" | "intra">("cross");
  const [singleMediaId, setSingleMediaId] = useState<string>("");

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

  // Fetch frames for Media A / Single Media
  useEffect(() => {
    const targetMediaId = analysisMode === "cross" ? compareMediaIdA : singleMediaId;
    if (targetMediaId) {
      setIsLoadingFramesA(true);
      listMediaFrames(targetMediaId)
        .then((frames) => {
          setFramesA(frames);
          if (frames.length > 0) {
            setSelectedFrameA(frames[0]);
          } else {
            setSelectedFrameA(null);
          }
        })
        .catch((err) => console.error("Failed to load frames A:", err))
        .finally(() => setIsLoadingFramesA(false));
    } else {
      setFramesA([]);
      setSelectedFrameA(null);
    }
  }, [compareMediaIdA, singleMediaId, analysisMode]);

  // Fetch frames for Media B / Single Media
  useEffect(() => {
    const targetMediaId = analysisMode === "cross" ? compareMediaIdB : singleMediaId;
    if (targetMediaId) {
      setIsLoadingFramesB(true);
      listMediaFrames(targetMediaId)
        .then((frames) => {
          setFramesB(frames);
          if (frames.length > 0) {
            setSelectedFrameB(frames[frames.length - 1]);
          } else {
            setSelectedFrameB(null);
          }
        })
        .catch((err) => console.error("Failed to load frames B:", err))
        .finally(() => setIsLoadingFramesB(false));
    } else {
      setFramesB([]);
      setSelectedFrameB(null);
    }
  }, [compareMediaIdB, singleMediaId, analysisMode]);

  const handleSelectFrameA = (frame: VideoFrame) => {
    setSelectedFrameA(frame);
  };

  const handleSelectFrameB = (frame: VideoFrame) => {
    setSelectedFrameB(frame);
  };

  const handleCompare = async () => {
    if (!selectedFrameA || !selectedFrameB) {
      setAnalysisError("Please select two frames/keyframes to compare.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    try {
      const data = await compareFrames(selectedFrameA.id, selectedFrameB.id);
      setAnalysisResult(data);
    } catch (err: any) {
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
      <div className="border-b border-border pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Diff className="text-primary" size={28} />
          Site Progress Analysis
        </h1>
        <p className="mt-1 text-sm text-muted">
          Compare the state of two inspections to evaluate layout changes, worker counts, and structural growth.
        </p>
      </div>

      <SelectorsPanel
        projects={projects}
        isLoadingProjects={isLoadingProjects}
        selectedProjectId={selectedProjectId}
        setSelectedProjectId={setSelectedProjectId}
        analysisMode={analysisMode}
        setAnalysisMode={setAnalysisMode}
        projectMedia={projectMedia}
        isLoadingMedia={isLoadingMedia}
        compareMediaIdA={compareMediaIdA}
        setCompareMediaIdA={setCompareMediaIdA}
        compareMediaIdB={compareMediaIdB}
        setCompareMediaIdB={setCompareMediaIdB}
        singleMediaId={singleMediaId}
        setSingleMediaId={setSingleMediaId}
        framesA={framesA}
        framesB={framesB}
        isLoadingFramesA={isLoadingFramesA}
        isLoadingFramesB={isLoadingFramesB}
        selectedFrameA={selectedFrameA}
        setSelectedFrameA={setSelectedFrameA}
        selectedFrameB={selectedFrameB}
        setSelectedFrameB={setSelectedFrameB}
        isAnalyzing={isAnalyzing}
        setAnalysisResult={setAnalysisResult}
        setAnalysisError={setAnalysisError}
      />

      {analysisError && (
        <div className="flex gap-2.5 rounded-md border border-danger/35 bg-danger/5 px-4 py-3 text-sm text-danger text-left">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{analysisError}</span>
        </div>
      )}

      {selectedFrameA && selectedFrameB && (
        <VisualComparisonStudio
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          showOverlayA={showOverlayA}
          setShowOverlayA={setShowOverlayA}
          showOverlayB={showOverlayB}
          setShowOverlayB={setShowOverlayB}
          activeCategoryFilter={activeCategoryFilter}
          setActiveCategoryFilter={setActiveCategoryFilter}
          selectedFrameA={selectedFrameA}
          selectedFrameB={selectedFrameB}
          isLoadingFramesA={isLoadingFramesA}
          isLoadingFramesB={isLoadingFramesB}
          framesA={framesA}
          framesB={framesB}
          handleSelectFrameA={handleSelectFrameA}
          handleSelectFrameB={handleSelectFrameB}
          analysisMode={analysisMode}
          isAnalyzing={isAnalyzing}
          handleCompare={handleCompare}
        />
      )}

      {analysisResult ? (
        <AnalysisResultsPanel analysisResult={analysisResult} />
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
