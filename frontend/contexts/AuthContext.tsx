"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { getUser, setUser, clearTokens, fetchCurrentUser } from "@/lib/auth";

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
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
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
    let cancelled = false;
    const cached = getUser();
    if (cached) {
      setUserState(cached);
      setToken("cookie");
    }

    (async () => {
      const fresh = await fetchCurrentUser();
      if (cancelled) return;
      if (fresh) {
        setUser(fresh);
        setUserState(fresh);
        setToken("cookie");
      } else {
        clearTokens();
        setUserState(null);
        setToken(null);
      }
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await postAuth("/api/auth/login", { email, password });
    setUser(data.user);
    setUserState(data.user);
    setToken(data.access_token ?? "cookie");
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const data = await postAuth("/api/auth/register", { email, password, name });
    setUser(data.user);
    setUserState(data.user);
    setToken(data.access_token ?? "cookie");
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
    } catch {
    }
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