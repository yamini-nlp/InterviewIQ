"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Sparkles,
  BookOpen,
  Video,
  LayoutDashboard,
  BarChart3,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const COLLAPSED_COOKIE = "sidebar_collapsed";
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

interface SidebarContextValue {
  collapsed: boolean;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
  toggleMobile: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const stored = readCookie(COLLAPSED_COOKIE);
    if (stored === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeCookie(COLLAPSED_COOKIE, String(next));
      return next;
    });
  }, []);

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleMobile = useCallback(() => setMobileOpen((prev) => !prev), []);

  return (
    <SidebarContext.Provider
      value={{ collapsed, toggleCollapsed, mobileOpen, openMobile, closeMobile, toggleMobile }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside SidebarProvider");
  return ctx;
}

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Home", href: "/", icon: Home }],
  },
  {
    label: "Practice",
    items: [
      { label: "New Interview", href: "/setup", icon: Sparkles },
      { label: "Practice Mode", href: "/practice", icon: BookOpen },
      { label: "Live Simulation", href: "/simulation", icon: Video },
    ],
  },
  {
    label: "Reports",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "MLIM Insights",
    items: [{ label: "MLIM Insights", href: "/dashboard/mlim", icon: BarChart3 }],
  },
  {
    label: "Settings",
    items: [{ label: "Settings", href: "/settings", icon: Settings }],
  },
];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function NavGroupList({
  groups,
  pathname,
  labelsHidden,
  onNavigate,
}: {
  groups: NavGroup[];
  pathname: string;
  labelsHidden: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      {groups.map((group) => {
        const groupId = `sidebar-group-${group.label.toLowerCase().replace(/\s+/g, "-")}`;
        return (
          <div key={group.label} className="px-2">
            <h3
              id={groupId}
              className={cn(
                "px-3 pb-2 pt-4 text-xs font-semibold uppercase tracking-wider text-neutral-500",
                "md:hidden",
                !labelsHidden && "lg:block"
              )}
            >
              {group.label}
            </h3>
            <ul aria-labelledby={groupId} className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(`${item.href}/`));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      prefetch={false}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50",
                        isActive
                          ? "bg-primary-500/10 text-primary-500"
                          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                      )}
                    >
                      <Icon size={18} className="shrink-0" aria-hidden="true" />
                      <span
                        className={cn("truncate", "md:hidden", !labelsHidden && "lg:inline")}
                      >
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed, mobileOpen, closeMobile } = useSidebar();
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!mobileOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = drawerRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable?.[0] ?? panel)?.focus();

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeMobile();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const elements = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previousFocusRef.current?.focus();
    };
  }, [mobileOpen, closeMobile]);

  return (
    <>
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 py-2 md:flex",
          "md:w-20",
          !collapsed && "lg:w-64"
        )}
      >
        <nav aria-label="Primary" className="flex-1 overflow-y-auto py-2">
          <NavGroupList groups={NAV_GROUPS} pathname={pathname} labelsHidden={collapsed} />
        </nav>
        <div className="hidden border-t border-neutral-200 px-2 pt-2 lg:flex">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors",
              "hover:bg-neutral-100 hover:text-neutral-900",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50"
            )}
          >
            {collapsed ? (
              <ChevronsRight size={18} aria-hidden="true" />
            ) : (
              <>
                <ChevronsLeft size={18} aria-hidden="true" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-[80] md:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-neutral-900/50 backdrop-blur-sm transition-opacity duration-200",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={closeMobile}
        />
        <div
          ref={drawerRef}
          id="mobile-sidebar-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          tabIndex={-1}
          className={cn(
            "absolute inset-y-0 left-0 flex h-full w-72 max-w-[85vw] flex-col border-r border-neutral-200 bg-neutral-50 shadow-2xl transition-transform duration-200",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between px-4 py-4">
            <span className="font-display text-lg font-bold text-neutral-900">Menu</span>
            <button
              type="button"
              onClick={closeMobile}
              aria-label="Close menu"
              className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="Primary" className="flex-1 overflow-y-auto pb-4">
            <NavGroupList
              groups={NAV_GROUPS}
              pathname={pathname}
              labelsHidden={false}
              onNavigate={closeMobile}
            />
          </nav>
        </div>
      </div>
    </>
  );
}