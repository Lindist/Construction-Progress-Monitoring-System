"use client";

import React from "react";
import { AnalysisResult } from "@/lib/api";

interface AnalysisResultsPanelProps {
  analysisResult: AnalysisResult;
}

export default function AnalysisResultsPanel({
  analysisResult,
}: AnalysisResultsPanelProps) {
  const objectCountDiffs = analysisResult.object_count_diffs || [];
  const areaChanges = analysisResult.area_changes || [];
  const newObjects = analysisResult.new_objects || [];
  const removedObjects = analysisResult.removed_objects || [];

  return (
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
      <div className="rounded-xl border border-border bg-panel p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm text-left">
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
                {objectCountDiffs.map((diff: any) => {
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
              {areaChanges.map((chg: any) => {
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
              {newObjects.length === 0 ? (
                <p className="text-xs text-muted">No new categories.</p>
              ) : (
                <ul className="space-y-1.5 text-xs text-foreground">
                  {newObjects.map((obj: any) => (
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
              {removedObjects.length === 0 ? (
                <p className="text-xs text-muted">No categories removed.</p>
              ) : (
                <ul className="space-y-1.5 text-xs text-foreground">
                  {removedObjects.map((obj: any) => (
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
  );
}
