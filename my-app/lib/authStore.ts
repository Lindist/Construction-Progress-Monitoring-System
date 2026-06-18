import { create } from "zustand";

export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  setAuth: (token, user) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
    }
    set({ token, user, isAuthenticated: true });
  },
  clearAuth: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    set({ token: null, user: null, isAuthenticated: false });
  },
  initialize: () => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      const userStr = localStorage.getItem("user");
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          set({ token, user, isAuthenticated: true });
        } catch {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        }
      }
    }
  },
}));
