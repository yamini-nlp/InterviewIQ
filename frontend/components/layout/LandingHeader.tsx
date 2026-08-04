"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";

const links = [
  { href: "#architecture", label: "Architecture" },
  { href: "#capabilities", label: "Capabilities" },
  { href: "#process", label: "Process" },
  { href: "#faq", label: "FAQ" },
];

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const isSolid = scrolled || menuOpen;

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 transition-colors duration-200"
      style={{
        background: isSolid ? "rgba(8,9,12,0.85)" : "transparent",
        backdropFilter: isSolid ? "blur(14px)" : "none",
        borderBottom: isSolid ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
      }}
    >
      <div className="max-w-7xl mx-auto h-16 px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md flex items-center justify-center bg-accent">
            <span className="font-display text-xs font-bold text-white">IQ</span>
          </div>
          <span className="font-display font-medium text-white text-[15px]">InterviewIQ</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-sans text-[13px] font-medium transition-colors"
              style={{ color: "#9ca3af" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#9ca3af";
              }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/login"
            className="font-sans text-[13px] font-medium transition-colors"
            style={{ color: "#d1d5db" }}
          >
            Sign in
          </Link>
          <Link href="/register">
            <button className="group inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-sans text-[13px] font-semibold text-white bg-accent hover:opacity-90 transition-opacity">
              Start session
              <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          </Link>
        </div>

        <button
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={17} color="#e5e7eb" /> : <Menu size={17} color="#e5e7eb" />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden px-6 pb-6 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="font-sans text-sm font-medium py-3 px-2 rounded-lg transition-colors"
                style={{ color: "#d1d5db" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-3 mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="font-sans text-sm font-medium text-center py-2.5 rounded-lg"
              style={{ color: "#e5e7eb", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              Sign in
            </Link>
            <Link href="/register" onClick={() => setMenuOpen(false)}>
              <button className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg font-sans text-sm font-semibold text-white bg-accent">
                Start session
                <ArrowRight size={14} />
              </button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}