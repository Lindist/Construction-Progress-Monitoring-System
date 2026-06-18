"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, token } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && (isAuthenticated || token)) {
      router.push("/projects");
    }
  }, [mounted, isAuthenticated, token, router]);

  if (!mounted) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-[85vh] flex flex-col justify-center items-center px-4 text-center">
      <div className="max-w-3xl mx-auto space-y-6">
        <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          Phase 2 Active: Authentication & Project Management
        </span>
        
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-foreground leading-none">
          Construction Progress <br />
          <span className="text-primary">Monitoring System</span>
        </h1>
        
        <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted leading-relaxed">
          Securely upload construction site media, organize your work into projects, and use AI computer vision and OpenCV analytics to measure structural progress over time.
        </p>

        <div className="pt-4 flex flex-wrap justify-center gap-4">
          <Link
            href="/register"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow transition hover:bg-primary/95"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-panel px-6 text-sm font-semibold text-foreground transition hover:bg-panel-strong"
          >
            Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}
