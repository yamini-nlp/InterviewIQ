"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  mlim: "MLIM Insights",
  report: "Report",
  setup: "New Interview",
  practice: "Practice",
  simulation: "Simulation",
  login: "Log In",
  register: "Register",
  settings: "Settings",
};

function labelForSegment(segment: string): string {
  const known = SEGMENT_LABELS[segment.toLowerCase()];
  if (known) return known;
  const decoded = decodeURIComponent(segment);
  if (decoded.length > 24) return `${decoded.slice(0, 24)}…`;
  return decoded;
}

interface Crumb {
  label: string;
  href: string;
}

export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();

  if (!pathname || pathname === "/") return null;

  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = segments.map((segment, index) => ({
    label: labelForSegment(segment),
    href: `/${segments.slice(0, index + 1).join("/")}`,
  }));

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        <li className="flex items-center">
          <Link
            href="/"
            aria-label="Home"
            className="flex items-center rounded-md p-1 text-neutral-500 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <Home size={14} aria-hidden="true" />
          </Link>
        </li>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex min-w-0 items-center gap-1">
              <ChevronRight size={14} className="shrink-0 text-neutral-400" aria-hidden="true" />
              {isLast ? (
                <span
                  aria-current="page"
                  className="truncate font-medium text-neutral-900"
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate text-neutral-500 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-md"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}