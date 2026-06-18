"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { API_BASE_URL } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Registration failed.");
      }

      setAuth(data.token, data.user);
      router.push("/projects");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-panel p-8 shadow-sm">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Create your account</h2>
          <p className="mt-2 text-sm text-muted">
            Start monitoring construction progress today
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-md bg-danger/10 p-3 text-sm text-danger">
            {error}
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-foreground">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex w-full justify-center rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
          >
            {loading ? "Registering..." : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
