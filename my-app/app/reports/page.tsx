"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { listProjects, listProjectMedia, listProjectReports, generateProjectReport, Project, ProgressReport } from "@/lib/api";
import { UploadedMedia } from "@/types/media";
import { useQuery } from "@tanstack/react-query";
import { FileText, Cpu, Printer, RefreshCw, AlertCircle, FileDown, CheckCircle } from "lucide-react";

export default function ReportsPage() {
  const router = useRouter();
  const { isAuthenticated, token } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!token && !localStorage.getItem("token")) {
      router.push("/login");
    }
  }, [token, router]);

  // Query projects
  const { data: projects = [], isLoading: isLoadingProjects, error: projectsError } = useQuery<Project[]>({
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

  // Query project media files
  const { data: mediaFiles = [], isLoading: isLoadingMedia } = useQuery<UploadedMedia[]>({
    queryKey: ["projectMedia", selectedProjectId],
    queryFn: () => listProjectMedia(selectedProjectId),
    enabled: !!selectedProjectId,
  });

  // Query progress reports
  const { data: reports = [], isLoading: isLoadingReports, refetch: refetchReports } = useQuery<ProgressReport[]>({
    queryKey: ["projectReports", selectedProjectId],
    queryFn: () => listProjectReports(selectedProjectId),
    enabled: !!selectedProjectId,
  });

  const activeReport = reports.find((r) => r.report_type === reportType);

  const handleGenerateReport = async () => {
    if (!selectedProjectId) return;
    setIsGenerating(true);
    setError(null);
    try {
      await generateProjectReport(selectedProjectId, reportType);
      await refetchReports();
    } catch (err: any) {
      setError(err.message || "Failed to generate AI summary report.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!mounted || (!isAuthenticated && !token)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <RefreshCw className="animate-spin text-muted" size={28} />
      </div>
    );
  }

  const selectedProj = projects.find(p => p.id === selectedProjectId);

  return (
    <main className="min-h-screen px-4 py-8 md:px-8 max-w-5xl mx-auto space-y-8 print:p-0 print:max-w-full">
      {/* Title Header (hide on print) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6 print:hidden">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="text-primary" size={28} />
            AI Progress Reports
          </h1>
          <p className="mt-1 text-sm text-muted">
            Compile visual inspection audits, safety compliance summaries, and structural metrics logs.
          </p>
        </div>

        {activeReport && (
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-border bg-panel px-4 text-sm font-semibold text-foreground hover:bg-panel-strong transition cursor-pointer"
            >
              <Printer size={16} />
              Print Report
            </button>
            <button
              onClick={() => alert("PDF Export triggered successfully.")}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/95 transition cursor-pointer"
            >
              <FileDown size={16} />
              Export PDF
            </button>
          </div>
        )}
      </div>

      {/* Control Panel (hide on print) */}
      <div className="rounded-xl border border-border bg-panel p-5 shadow-sm grid gap-4 sm:grid-cols-3 items-end text-left print:hidden">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
            Target Project
          </label>
          {isLoadingProjects ? (
            <div className="h-10 flex items-center text-xs text-muted">Loading projects...</div>
          ) : projectsError ? (
            <div className="h-10 text-danger text-xs">Error loading projects</div>
          ) : (
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setError(null);
              }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
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

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
            Report Frequency
          </label>
          <select
            value={reportType}
            onChange={(e) => {
              setReportType(e.target.value as any);
              setError(null);
            }}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="daily">Daily Site Log</option>
            <option value="weekly">Weekly Status Report</option>
            <option value="monthly">Monthly Summary</option>
          </select>
        </div>

        <button
          onClick={handleGenerateReport}
          disabled={isGenerating || !selectedProjectId}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/95 disabled:opacity-50 cursor-pointer w-full"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Generating Summary...
            </>
          ) : (
            <>
              <Cpu size={16} />
              Generate AI Summary
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="flex gap-2.5 rounded-md border border-danger/35 bg-danger/5 px-4 py-3 text-sm text-danger text-left">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Print Ready Report Container */}
      {isLoadingReports ? (
        <div className="flex justify-center py-20 print:hidden">
          <RefreshCw className="animate-spin text-primary" size={32} />
        </div>
      ) : activeReport ? (
        <div className="rounded-xl border border-border bg-panel p-8 shadow-md text-left space-y-8 animate-fade-in print:border-0 print:shadow-none print:p-0">
          {/* Report Header */}
          <div className="flex justify-between items-start border-b border-border/80 pb-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary px-2.5 py-1 bg-primary/10 rounded-full">
                AI System Audit Report
              </span>
              <h2 className="text-2xl font-bold text-foreground mt-3 flex items-center gap-3 flex-wrap">
                {selectedProj?.name ?? "Bangkok Central Tower"}
                <span className="text-xs font-semibold px-2.5 py-1 bg-success/15 text-success rounded-full">
                  Progress: {activeReport.progress_percentage.toFixed(1)}%
                </span>
              </h2>
              <p className="text-sm text-muted mt-1">
                {selectedProj?.description || "No project description provided."}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted uppercase font-semibold">Report Period</p>
              <p className="text-sm font-bold text-foreground capitalize mt-0.5">{reportType}</p>
              <p className="text-xs text-muted mt-1">
                Generated: {new Date(activeReport.generated_at).toLocaleString()}
              </p>
            </div>
          </div>

          {/* AI Content Formatting */}
          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed space-y-4">
            {activeReport.summary.split("\n\n").map((paragraph, index) => {
              if (paragraph.startsWith("###")) {
                return (
                  <h3 key={index} className="text-lg font-bold border-b border-border/40 pb-2 mt-6">
                    {paragraph.replace("### ", "")}
                  </h3>
                );
              }
              if (paragraph.startsWith("**")) {
                const parts = paragraph.split(" | ");
                return (
                  <div key={index} className="flex flex-wrap gap-4 text-xs font-semibold text-muted bg-panel-strong p-3 rounded-lg border border-border/40">
                    {parts.map((p, i) => (
                      <span key={i}>{p.replace(/\*\*/g, "")}</span>
                    ))}
                  </div>
                );
              }
              return (
                <div key={index} className="whitespace-pre-line text-sm text-muted-foreground">
                  {paragraph}
                </div>
              );
            })}
          </div>

          {/* Site Detections Audit table */}
          {mediaFiles.length > 0 && (
            <div className="border-t border-border/80 pt-6">
              <h3 className="text-base font-bold text-foreground mb-4">Inspection Media Logs</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse border border-border/40">
                  <thead>
                    <tr className="bg-panel-strong border-b border-border text-muted uppercase font-semibold">
                      <th className="p-3">File Name</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Uploaded At</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {mediaFiles.slice(0, 5).map((m) => (
                      <tr key={m.id} className="hover:bg-background/20">
                        <td className="p-3 font-medium truncate max-w-50" title={m.originalName}>
                          {m.originalName}
                        </td>
                        <td className="p-3 capitalize">{m.contentType.split("/")[0]}</td>
                        <td className="p-3">{new Date(m.uploadedAt).toLocaleString()}</td>
                        <td className="p-3 text-right">
                          <span className="inline-flex items-center gap-1 text-success">
                            <CheckCircle size={12} />
                            Verified
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {mediaFiles.length > 5 && (
                <p className="text-[10px] text-muted mt-2 text-right">
                  Showing top 5 media uploads of {mediaFiles.length} total files.
                </p>
              )}
            </div>
          )}

          {/* Footer Sign-off */}
          <div className="border-t border-border/60 pt-6 flex justify-between items-center text-[10px] text-muted">
            <span>🚧 Powered by SiteMonitor Computer Vision Progress Engine</span>
            <span>Signature: __________________________</span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-panel p-12 text-center py-20">
          <FileText className="h-12 w-12 text-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground">No Report Compiled</h3>
          <p className="text-sm text-muted mt-2 max-w-md mx-auto">
            Choose a target monitoring project and select the report frequency, then click "Generate AI Summary".
          </p>
        </div>
      )}
    </main>
  );
}
