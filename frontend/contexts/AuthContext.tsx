"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { getUser, setUser, setTokens, clearTokens, getAccessToken } from "@/lib/auth";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const BASE = process.env.NEXT_PUBLIC_API_URL;

async function parseJsonSafely(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function postAuth(path: string, payload: Record<string, unknown>) {
  if (!BASE) {
    throw new Error(
      "The app isn't configured with an API URL (NEXT_PUBLIC_API_URL). Set it in your deployment environment variables."
    );
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }

  if (!res.ok) {
    const body = await parseJsonSafely(res);
    const fallback = res.status === 0 ? "Network error" : `Request failed (${res.status})`;
    throw new Error(body.detail || fallback);
  }

  return parseJsonSafely(res);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const u = getUser();
    const t = getAccessToken();
    if (u && t) {
      setUserState(u);
      setToken(t);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await postAuth("/api/auth/login", { email, password });
    setTokens(data.access_token, data.refresh_token);
    setUser(data.user);
    setUserState(data.user);
    setToken(data.access_token);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const data = await postAuth("/api/auth/register", { email, password, name });
    setTokens(data.access_token, data.refresh_token);
    setUser(data.user);
    setUserState(data.user);
    setToken(data.access_token);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUserState(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used inside AuthProvider");
  return ctx;
}