const USER_KEY = "rr_user";

export function getAccessToken(): string | null {
  return null;
}

export function getRefreshToken(): string | null {
  return null;
}

export function setTokens(_access?: string, _refresh?: string) {
  return;
}

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

export async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    if (!res.ok) { clearTokens(); return null; }
    const data = await res.json();
    return data.access_token ?? "cookie";
  } catch {
    clearTokens();
    return null;
  }
}