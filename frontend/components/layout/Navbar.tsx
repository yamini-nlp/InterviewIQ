"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, Sun, Moon, Monitor, LogOut, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useSidebar } from "@/components/layout/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { getTheme, setTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const THEME_ORDER: Theme[] = ["light", "dark", "system"];
const THEME_ICON: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };
const THEME_LABEL: Record<Theme, string> = { light: "Light", dark: "Dark", system: "System" };

function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme | null>(null);

  useEffect(() => {
    setThemeState(getTheme());
  }, []);

  const handleClick = useCallback(() => {
    setThemeState((current) => {
      const active = current ?? "system";
      const nextIndex = (THEME_ORDER.indexOf(active) + 1) % THEME_ORDER.length;
      const next = THEME_ORDER[nextIndex];
      setTheme(next);
      return next;
    });
  }, []);

  const active = theme ?? "system";
  const Icon = THEME_ICON[active];

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Theme: ${THEME_LABEL[active]}. Click to change.`}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50"
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, close]);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login">
          <Button variant="ghost" size="sm">Log In</Button>
        </Link>
        <Link href="/register">
          <Button size="sm">Sign Up</Button>
        </Link>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`User menu for ${user.name}`}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-500 text-sm font-semibold text-white transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50"
      >
        {initials(user.name)}
      </button>
      {open && (
        <div
          role="menu"
          aria-label="User menu"
          className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 py-1 shadow-2xl"
        >
          <div className="border-b border-neutral-200 px-3 py-2">
            <p className="truncate text-sm font-medium text-neutral-900">{user.name}</p>
            <p className="truncate text-xs text-neutral-500">{user.email}</p>
          </div>
          <Link
            href="/settings"
            role="menuitem"
            onClick={close}
            className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset"
          >
            <SettingsIcon size={16} aria-hidden="true" />
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              logout();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-error-500 hover:bg-error-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset"
          >
            <LogOut size={16} aria-hidden="true" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const { toggleMobile } = useSidebar();

  return (
    <nav
      aria-label="Top"
      className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-neutral-200 bg-neutral-50/80 px-4 backdrop-blur-xl sm:px-6"
    >
      <button
        type="button"
        onClick={toggleMobile}
        aria-label="Toggle navigation menu"
        aria-controls="mobile-sidebar-drawer"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50 md:hidden"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      <Link href="/" className="flex shrink-0 items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
          <span className="text-sm font-bold leading-none text-white">?</span>
        </div>
        <span
          style={{ fontFamily: "'Syne', sans-serif" }}
          className={cn("hidden text-lg font-bold text-primary-500 sm:inline")}
        >
          InterviewIQ
        </span>
      </Link>

      <div className="hidden min-w-0 flex-1 items-center border-l border-neutral-200 pl-4 md:flex">
        <Breadcrumbs />
      </div>
      <div className="flex-1 md:hidden" />

      <div className="flex shrink-0 items-center gap-1.5">
        <ThemeToggle />
        <UserMenu />
      </div>
    </nav>
  );
}