export type Theme = "light" | "dark" | "system";

const COOKIE_NAME = "theme";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveTheme(theme: Theme): "light" | "dark" {
  return theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
}

function applyThemeClass(theme: Theme): void {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
}

export function getTheme(): Theme {
  const stored = readCookie(COOKIE_NAME);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

export function setTheme(theme: Theme): void {
  writeCookie(COOKIE_NAME, theme);
  applyThemeClass(theme);
}

export function initTheme(): void {
  applyThemeClass(getTheme());
}