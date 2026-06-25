"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { getDashboardStats, listProjects, Project, DashboardStats } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  FolderKanban,
  Film,
  Activity,
  Cpu,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  FileText,
  Plus,
  Loader2
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts";

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, token, user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!token && !localStorage.getItem("token")) {
      router.push("/login");
    }
  }, [token, router]);

  // Query dashboard statistics
  const {
    data: stats,
    isLoading: isLoadingStats,
    error: statsError,
    refetch: refetchStats
  } = useQuery<DashboardStats>({
    queryKey: ["dashboardStats"],
    queryFn: getDashboardStats,
    enabled: !!token,
    refetchInterval: 10000 // auto refresh every 10s
  });

  // Query projects list
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: listProjects,
    enabled: !!token
  });

  // Prepare chart data
  const detectionChartData = React.useMemo(() => {
    if (!stats || !stats.detection_stats) return [];
    return Object.entries(stats.detection_stats).map(([name, value]) => ({
      name,
      count: value
    })).sort((a, b) => b.count - a.count);
  }, [stats]);

  const progressChartData = React.useMemo(() => {
    if (!stats || !stats.progress_over_time) return [];
    return stats.progress_over_time.map((dp) => ({
      date: new Date(dp.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      progress: Math.round(dp.progress),
      project: dp.project_name
    }));
  }, [stats]);

  const activityChartData = React.useMemo(() => {
    if (!stats || !stats.activity_trends) return [];
    return stats.activity_trends.map((at) => ({
      date: new Date(at.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      uploads: at.count
    }));
  }, [stats]);

  const COLORS = ["#146c94", "#1d8f6f", "#f2b84b", "#c2413b", "#a855f7", "#ec4899", "#06b6d4"];

  if (!mounted || (!isAuthenticated && !token)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <RefreshCw className="animate-spin text-muted" size={28} />
      </div>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner section */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-r from-primary to-[#1d8f6f] p-6 md:p-8 text-white shadow-md text-left">
        <div className="relative z-10 space-y-2 max-w-2xl">
          <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
            🚧 Construction Monitoring Active
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Welcome back, {user?.full_name ?? "Operator"}
          </h1>
          <p className="text-sm md:text-base text-white/80 leading-relaxed">
            Monitor real-time progress calculations, neural network safety detections, and layout spatial changes across all active sites.
          </p>
        </div>
        {/* Abstract background graphics */}
        <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-15 pointer-events-none hidden md:block">
          <div className="w-full h-full border-10 border-white rounded-full transform translate-x-12 translate-y-12" />
        </div>
      </div>

      {isLoadingStats ? (
        <div className="flex h-64 flex-col items-center justify-center text-muted">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <span>Synchronizing dashboard widgets...</span>
        </div>
      ) : statsError ? (
        <div className="rounded-xl border border-danger/20 bg-danger/10 p-6 text-center text-danger">
          <AlertCircle className="mx-auto mb-2 text-danger" size={32} />
          <p className="font-semibold">Failed to synchronise statistics</p>
          <p className="mt-1 text-sm text-muted">{(statsError as any).message || "Something went wrong"}</p>
          <button onClick={() => refetchStats()} className="mt-4 rounded bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
            Retry Synchronisation
          </button>
        </div>
      ) : (
        <>
          {/* Metrics Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 text-left">
            {/* Widget 1: Total Projects */}
            <div className="rounded-xl border border-border bg-panel p-5 shadow-sm hover:shadow-md transition group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">Total Projects</span>
                <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 transition group-hover:scale-105">
                  <FolderKanban size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold text-foreground">{stats?.total_projects}</span>
                <p className="text-[11px] text-muted mt-1">Active site workspaces</p>
              </div>
            </div>

            {/* Widget 2: Processed Media */}
            <div className="rounded-xl border border-border bg-panel p-5 shadow-sm hover:shadow-md transition group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">Uploaded Media</span>
                <div className="p-2 rounded-lg bg-success/10 text-success border border-success/20 transition group-hover:scale-105">
                  <Film size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold text-foreground">
                  {Number(stats?.total_videos) + Number(stats?.total_images)}
                </span>
                <p className="text-[11px] text-muted mt-1">
                  {stats?.total_videos} videos, {stats?.total_images} images
                </p>
              </div>
            </div>

            {/* Widget 3: Average Site Progress */}
            <div className="rounded-xl border border-border bg-panel p-5 shadow-sm hover:shadow-md transition group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">Average Progress</span>
                <div className="p-2 rounded-lg bg-accent/10 text-accent border border-accent/20 transition group-hover:scale-105">
                  <Activity size={18} />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-foreground">
                    {stats?.average_progress ? stats.average_progress.toFixed(0) : "0"}%
                  </span>
                </div>
                <div className="w-full bg-[#18242b] rounded-full h-1.5 overflow-hidden mt-2">
                  <div
                    className="bg-accent h-full rounded-full transition-all duration-500"
                    style={{ width: `${stats?.average_progress ? stats.average_progress : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Widget 4: AI Detections */}
            <div className="rounded-xl border border-border bg-panel p-5 shadow-sm hover:shadow-md transition group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">AI Objects Logged</span>
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 border border-purple-500/20 transition group-hover:scale-105">
                  <Cpu size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold text-foreground">
                  {stats?.total_detections ? stats.total_detections.toLocaleString() : "0"}
                </span>
                <p className="text-[11px] text-muted mt-1">Total identified instances</p>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Progress Over Time Chart */}
            <div className="rounded-xl border border-border bg-panel p-6 shadow-sm text-left flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
                  <TrendingUp size={16} className="text-primary" />
                  Site Progress Timelines
                </h3>
                <p className="text-xs text-muted mb-4">Percentage development logs computed over time.</p>
              </div>
              <div className="h-64 w-full text-xs">
                {progressChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted">
                    No progress history recorded. Please upload media sequence.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={progressChartData}>
                      <defs>
                        <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#146c94" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#146c94" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                      <XAxis dataKey="date" stroke="var(--muted)" />
                      <YAxis stroke="var(--muted)" unit="%" domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--panel)",
                          borderColor: "var(--border)",
                          color: "var(--foreground)"
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="progress"
                        name="Progress"
                        stroke="#146c94"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorProgress)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* AI Object Detection statistics breakdown */}
            <div className="rounded-xl border border-border bg-panel p-6 shadow-sm text-left flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
                  <Cpu size={16} className="text-success" />
                  AI Classifier Breakdown
                </h3>
                <p className="text-xs text-muted mb-4">Total object instances identified by YOLO models.</p>
              </div>
              <div className="h-64 w-full text-xs">
                {detectionChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted">
                    No detections logged in the database.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={detectionChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                      <XAxis type="number" stroke="var(--muted)" />
                      <YAxis dataKey="name" type="category" stroke="var(--muted)" width={100} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--panel)",
                          borderColor: "var(--border)",
                          color: "var(--foreground)"
                        }}
                      />
                      <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]}>
                        {detectionChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Activity trends */}
            <div className="rounded-xl border border-border bg-panel p-6 shadow-sm text-left flex flex-col justify-between md:col-span-2">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
                  <Activity size={16} className="text-accent" />
                  Site Inspection Activity
                </h3>
                <p className="text-xs text-muted mb-4">Inspection media upload volume trends (last 30 days).</p>
              </div>
              <div className="h-60 w-full text-xs">
                {activityChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted">
                    No activity trends recorded.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={activityChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                      <XAxis dataKey="date" stroke="var(--muted)" />
                      <YAxis stroke="var(--muted)" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--panel)",
                          borderColor: "var(--border)",
                          color: "var(--foreground)"
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="uploads"
                        name="Uploads Count"
                        stroke="#f2b84b"
                        strokeWidth={2}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Recent projects directory summary */}
          <section className="rounded-xl border border-border bg-panel p-6 shadow-sm text-left">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">Project Workspace Directory</h3>
                <p className="text-xs text-muted">Manage your active monitoring zones and upload media pipelines.</p>
              </div>
              <button
                onClick={() => router.push("/projects")}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/95 transition cursor-pointer"
              >
                <Plus size={14} />
                Manage Projects
              </button>
            </div>

            {isLoadingProjects ? (
              <div className="h-20 flex items-center justify-center text-muted text-xs">
                Loading projects...
              </div>
            ) : projects.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted">
                No active projects found. Get started by creating one!
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {projects.slice(0, 3).map((proj) => (
                  <div key={proj.id} className="group border border-border/80 bg-panel-strong p-4 rounded-xl flex flex-col justify-between hover:border-primary/60 transition">
                    <div>
                      <h4 className="font-semibold text-foreground truncate group-hover:text-primary transition">{proj.name}</h4>
                      <p className="text-xs text-muted line-clamp-2 mt-1.5 leading-relaxed">
                        {proj.description || "No description provided."}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-3 text-[10px]">
                      <span className="text-muted">
                        Created: {new Date(proj.created_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => router.push(`/upload?projectId=${proj.id}`)}
                        className="font-bold text-primary hover:underline cursor-pointer"
                      >
                        Open Workspace →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
