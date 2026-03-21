"use client";

import { useState, useEffect, useCallback, ReactNode, createContext, useContext } from "react";

interface User {
  id: number;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

async function parseAuthError(res: Response, fallback: string): Promise<never> {
  let message = fallback;
  try {
    const payload = await res.json() as { error?: string; message?: string };
    message = payload.message || payload.error || fallback;
  } catch {
    // Ignore parse issues and keep fallback.
  }
  throw new Error(message);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem("auth_token");
      const storedUser = localStorage.getItem("auth_user");

      if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser) as User;
        if (parsedUser?.email && parsedUser?.name) {
          setToken(storedToken);
          setUser(parsedUser);
        } else {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("auth_user");
        }
      }
    } catch {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${backendUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      await parseAuthError(res, "Login failed");
    }

    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("auth_token", data.token);
    localStorage.setItem("auth_user", JSON.stringify(data.user));
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const res = await fetch(`${backendUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    if (!res.ok) {
      await parseAuthError(res, "Registration failed");
    }

    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("auth_token", data.token);
    localStorage.setItem("auth_user", JSON.stringify(data.user));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
  }, []);

  const value: AuthContextType = { user, token, loading, login, register, logout };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
