const USER_KEY = "iq_user";

export function clearTokens() {
  if (typeof localStorage !== "undefined") localStorage.removeItem(USER_KEY);
}

export function setUser(user: { id: string; email: string; name: string }) {
  if (typeof localStorage !== "undefined") localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser(): { id: string; email: string; name: string } | null {
  if (typeof window === "undefined") return null;
  const raw = typeof localStorage !== "undefined" ? localStorage.getItem(USER_KEY) : null;
  return raw ? JSON.parse(raw) : null;
}

let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        clearTokens();
        return null;
      }
      const data = await res.json().catch(() => ({}));
      return data.access_token ?? "cookie";
    } catch {
      clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function fetchCurrentUser(): Promise<{ id: string; email: string; name: string } | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (res.ok) {
    const data = await res.json().catch(() => ({}));
    return data.user ?? null;
  }
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) return null;
    const retry = await fetch("/api/auth/me", { credentials: "include" });
    if (!retry.ok) return null;
    const data = await retry.json().catch(() => ({}));
    return data.user ?? null;
  }
  return null;
}