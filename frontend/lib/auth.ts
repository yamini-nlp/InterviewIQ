const USER_KEY = "rr_user";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return getCookieValue("rr_access_token");
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return getCookieValue("rr_refresh_token");
}

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setTokens(access: string, refresh: string) {
  const secure = window.location.protocol === "https:";
  const secureFlag = secure ? "; Secure" : "";
  document.cookie = `rr_access_token=${encodeURIComponent(access)}; Path=/; SameSite=Strict; Max-Age=900${secureFlag}`;
  document.cookie = `rr_refresh_token=${encodeURIComponent(refresh)}; Path=/; SameSite=Strict; Max-Age=604800${secureFlag}`;
}

export function clearTokens() {
  document.cookie = "rr_access_token=; Path=/; Max-Age=0";
  document.cookie = "rr_refresh_token=; Path=/; Max-Age=0";
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
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) { clearTokens(); return null; }
    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    clearTokens();
    return null;
  }
}