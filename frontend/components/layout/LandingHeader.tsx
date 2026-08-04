"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const links = [
  { href: "#architecture", label: "Architecture" },
  { href: "#capabilities", label: "Capabilities" },
  { href: "#process", label: "Process" },
  { href: "#faq", label: "FAQ" },
];

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 h-16 transition-colors duration-200"
      style={{
        background: scrolled ? "rgba(8,9,12,0.75)" : "transparent",
        backdropFilter: scrolled ? "blur(14px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
      }}
    >
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md flex items-center justify-center bg-accent">
            <span className="text-xs font-bold text-white">?</span>
          </div>
          <span className="font-display font-medium text-white text-[15px]">InterviewIQ</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {links.map((l) => (
            
              key={l.href}
              href={l.href}
              className="text-[13px] font-medium transition-colors"
              style={{ color: "#9ca3af" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="hidden sm:inline text-[13px] font-medium transition-colors"
            style={{ color: "#d1d5db" }}
          >
            Sign in
          </Link>
          <Link href="/register">
            <button className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-accent hover:opacity-90 transition-opacity">
              Start free session
            </button>
          </Link>
        </div>
      </div>
    </header>
  );
}