"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { listProjects, listProjectMedia, compareProgress, Project, AnalysisResult } from "@/lib/api";
import { UploadedMedia } from "@/types/media";
import { useQuery } from "@tanstack/react-query";
import { Diff, Loader2, AlertCircle, RefreshCw, ArrowRight, HelpCircle } from "lucide-react";

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
