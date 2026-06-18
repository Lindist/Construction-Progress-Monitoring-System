"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { LogOut, LayoutDashboard, User } from "lucide-react";

export default function Navbar() {
  const router = useRouter();
  const { isAuthenticated, user, clearAuth } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  if (!mounted) {
    return (
      <header className="border-b border-border bg-panel">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 font-bold text-foreground text-lg">
            <span>🚧 SiteMonitor</span>
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-border bg-panel shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-bold text-foreground text-lg hover:text-primary transition">
          <span>🚧 SiteMonitor</span>
        </Link>

        <nav className="flex items-center gap-4">
          {isAuthenticated && user ? (
            <>
              <Link
                href="/projects"
                className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground transition"
              >
                <LayoutDashboard size={16} />
                Projects
              </Link>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2 text-sm text-foreground font-medium">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User size={14} />
                </div>
                <span className="hidden sm:inline">{user.full_name}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/5 transition cursor-pointer"
              >
                <LogOut size={16} />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-semibold text-muted hover:text-foreground transition"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/95 transition"
              >
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
