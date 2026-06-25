"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { User, Settings, Sliders, Shield, RefreshCw, Check } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated, token, user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  // Simulated state for settings
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.4);
  const [frameInterval, setFrameInterval] = useState(5);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [autoAnalysis, setAutoAnalysis] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!token && !localStorage.getItem("token")) {
      router.push("/login");
    }
  }, [token, router]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 1000);
  };

  if (!mounted || (!isAuthenticated && !token)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <RefreshCw className="animate-spin text-muted" size={28} />
      </div>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8 max-w-5xl mx-auto space-y-8">
      {/* Title Header */}
      <div className="border-b border-border pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Settings className="text-primary" size={28} />
          Account & Pipeline Settings
        </h1>
        <p className="mt-1 text-sm text-muted">
          Customize your user profile details, notifications, and AI vision computer processing properties.
        </p>
      </div>

      <form onSubmit={handleSave} className="grid gap-6 md:grid-cols-[1fr_2fr]">
        {/* Left column: Quick menu card */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-panel p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User size={18} />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-foreground truncate max-w-[180px]">
                  {user?.full_name ?? "User Profile"}
                </h3>
                <p className="text-xs text-muted truncate max-w-[180px]">{user?.email}</p>
              </div>
            </div>
            <div className="h-px bg-border/60" />
            <nav className="space-y-1">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10 text-primary font-medium text-sm text-left"
              >
                <Sliders size={15} />
                General Preferences
              </button>
            </nav>
          </div>
        </div>

        {/* Right column: Form details */}
        <div className="space-y-6">
          {/* User Profile Info Card */}
          <div className="rounded-xl border border-border bg-panel p-6 shadow-sm space-y-4 text-left">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <User className="text-muted" size={18} />
              User Information
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase">Full Name</label>
                <input
                  type="text"
                  disabled
                  value={user?.full_name ?? ""}
                  className="mt-1 w-full rounded-md border border-border bg-panel-strong px-3 py-2 text-sm text-muted cursor-not-allowed outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted uppercase">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={user?.email ?? ""}
                  className="mt-1 w-full rounded-md border border-border bg-panel-strong px-3 py-2 text-sm text-muted cursor-not-allowed outline-none"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted">
              Profile editing is currently managed via Enterprise directory services.
            </p>
          </div>

          {/* AI Vision Pipeline Settings */}
          <div className="rounded-xl border border-border bg-panel p-6 shadow-sm space-y-5 text-left">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Shield className="text-primary" size={18} />
              AI Object Detection Config
            </h2>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-semibold text-foreground">
                    YOLO Detection Confidence Threshold
                  </label>
                  <span className="font-mono text-sm text-primary font-bold">
                    {(confidenceThreshold * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <p className="mt-1 text-xs text-muted">
                  Minimum confidence score required for an object (Worker, Helmet, Crane, etc.) to be counted.
                </p>
              </div>

              <div className="h-px bg-border/60" />

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-semibold text-foreground">
                    Frame Sampling Rate (seconds)
                  </label>
                  <span className="font-mono text-sm text-primary font-bold">
                    Every {frameInterval}s
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="1"
                  value={frameInterval}
                  onChange={(e) => setFrameInterval(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <p className="mt-1 text-xs text-muted">
                  Frequency of video frame extractions for OpenCV and YOLO detection processing.
                </p>
              </div>
            </div>
          </div>

          {/* Notifications & System Preferences */}
          <div className="rounded-xl border border-border bg-panel p-6 shadow-sm space-y-4 text-left">
            <h2 className="text-lg font-semibold text-foreground">Automation Rules</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                  className="h-4.5 w-4.5 rounded border-border text-primary focus:ring-primary accent-primary"
                />
                <div className="text-sm">
                  <p className="font-medium text-foreground">Email Alert Notifications</p>
                  <p className="text-xs text-muted">Receive reports when safety violations (e.g. Workers without helmets) are flagged.</p>
                </div>
              </label>

              <div className="h-px bg-border/60" />

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoAnalysis}
                  onChange={(e) => setAutoAnalysis(e.target.checked)}
                  className="h-4.5 w-4.5 rounded border-border text-primary focus:ring-primary accent-primary"
                />
                <div className="text-sm">
                  <p className="font-medium text-foreground">Automatic Progress Evaluation</p>
                  <p className="text-xs text-muted">Automatically recalculate net project growth and change scores immediately upon upload.</p>
                </div>
              </label>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between">
            <div>
              {saveSuccess && (
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-success animate-fade-in">
                  <Check size={16} />
                  Settings saved successfully!
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/95 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? "Saving Config..." : "Save Preferences"}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
