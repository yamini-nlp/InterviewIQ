"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, FileText, Fingerprint, Timer } from "lucide-react";
import { Fraunces, IBM_Plex_Mono } from "next/font/google";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["600", "700"], style: ["normal", "italic"] });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"] });

const clauses = [
  { text: "I led the migration end to end", tag: "ASSERTION", color: "#6f97ab" },
  { text: "it went pretty smoothly, honestly", tag: "HEDGE", color: "#c9a04d" },
  { text: "I mean, a couple hiccups, nothing major", tag: "FACE-SAVING", color: "#b5646a" },
  { text: "we're still sorting out who owns monitoring", tag: "GOAL DRIFT", color: "#4f9d8a" },
];

export default function Hero() {
  const [step, setStep] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 350);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % (clauses.length + 2)), 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="relative px-6 pt-28 pb-24 md:pt-32 md:pb-28 overflow-hidden" style={{ background: "#100e0b" }}>
      <div className="relative z-10 max-w-7xl mx-auto w-full grid lg:grid-cols-[1fr_460px] gap-14 lg:gap-20 items-start">
        <div>
          <div className="flex items-center gap-3 mb-7">
            <Fingerprint size={13} style={{ color: "#c1443c" }} />
            <span className={plexMono.className} style={{ color: "#8a8478", fontSize: "10.5px", letterSpacing: "0.16em" }}>
              MULTI-LAYER INTENT MODELING &middot; CASE NO. 0417
            </span>
          </div>

          <h1 className={fraunces.className} style={{ color: "#ece7dc", fontSize: "clamp(2.3rem, 5vw, 4rem)", lineHeight: 1.05, fontWeight: 700, letterSpacing: "-0.01em" }}>
            <span style={{ position: "relative", display: "inline-block", overflow: "hidden" }}>
              The answer
              <span
                aria-hidden
                style={{
                  position: "absolute", inset: 0, background: "#c1443c",
                  transform: revealed ? "translateY(-105%)" : "translateY(0%)",
                  transition: "transform 0.7s cubic-bezier(0.7,0,0.2,1)", transitionDelay: "0.1s",
                }}
              />
            </span>{" "}
            <span style={{ position: "relative", display: "inline-block", overflow: "hidden" }}>
              <em style={{ color: "#c1443c", fontStyle: "italic" }}>behind</em>
              <span
                aria-hidden
                style={{
                  position: "absolute", inset: 0, background: "#c1443c",
                  transform: revealed ? "translateY(-105%)" : "translateY(0%)",
                  transition: "transform 0.7s cubic-bezier(0.7,0,0.2,1)", transitionDelay: "0.28s",
                }}
              />
            </span>{" "}
            <span style={{ position: "relative", display: "inline-block", overflow: "hidden" }}>
              the answer.
              <span
                aria-hidden
                style={{
                  position: "absolute", inset: 0, background: "#c1443c",
                  transform: revealed ? "translateY(-105%)" : "translateY(0%)",
                  transition: "transform 0.7s cubic-bezier(0.7,0,0.2,1)", transitionDelay: "0.46s",
                }}
              />
            </span>
          </h1>

          <p className="mt-7 max-w-lg" style={{ color: "#a39c8d", fontSize: "1.05rem", lineHeight: 1.7 }}>
            InterviewIQ doesn&rsquo;t score what you said. It reads what you meant &mdash; the hedge behind the confidence, the drift behind the goal, the mask behind the calm.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-5">
            <Link href="/register">
              <button
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5"
                style={{ background: "#c1443c", borderRadius: "2px" }}
              >
                Start free session
                <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
              </button>
            </Link>
            <Link
              href="/login"
              className={plexMono.className}
              style={{ fontSize: "12px", letterSpacing: "0.05em", color: "#8a8478", borderBottom: "1px solid rgba(236,231,220,0.18)" }}
            >
              SIGN IN
            </Link>
          </div>

          <div className="mt-12 pt-7 flex flex-wrap gap-x-9 gap-y-3" style={{ borderTop: "1px dashed rgba(236,231,220,0.14)" }}>
            {[
              ["4", "MLIM layers"],
              ["8", "Intent labels"],
              ["7", "Emotion axes"],
              ["2", "Groq models"],
            ].map(([v, l]) => (
              <div key={l} className="flex items-baseline gap-2">
                <span className={fraunces.className} style={{ color: "#ece7dc", fontSize: "1.5rem", fontWeight: 700 }}>{v}</span>
                <span className={plexMono.className} style={{ fontSize: "9.5px", letterSpacing: "0.12em", color: "#635d51", textTransform: "uppercase" }}>{l}</span>
              </div>
            ))}
          </div>

          <p className={plexMono.className} style={{ marginTop: "2rem", fontSize: "9.5px", letterSpacing: "0.14em", color: "#4a453b" }}>
            LLAMA 3.3 70B &middot; WHISPER LARGE V3 &middot; FACE-API.JS &middot; MONGODB ATLAS
          </p>
        </div>

        <div
          className="relative"
          style={{
            background: "#1c1914", border: "1px solid rgba(236,231,220,0.08)",
            boxShadow: "0 30px 80px -30px rgba(0,0,0,0.6)", borderRadius: "3px",
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px dashed rgba(236,231,220,0.12)" }}
          >
            <div className="flex items-center gap-2.5">
              <FileText size={13} style={{ color: "#c1443c" }} />
              <span className={plexMono.className} style={{ fontSize: "10px", letterSpacing: "0.14em", color: "#a39c8d" }}>
                TRANSCRIPT &mdash; SESSION 0417
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#c1443c", animation: "pulse 2s ease-in-out infinite" }} />
              <span className={plexMono.className} style={{ fontSize: "9px", color: "#635d51" }}>LIVE</span>
            </div>
          </div>

          <div className="px-5 pt-5">
            <span className={plexMono.className} style={{ fontSize: "10px", color: "#635d51", letterSpacing: "0.08em" }}>
              Q3 &middot; BEHAVIORAL
            </span>
            <p className={fraunces.className} style={{ marginTop: "6px", color: "#a39c8d", fontSize: "0.9rem", fontStyle: "italic" }}>
              &ldquo;Tell me about a time you led a difficult migration.&rdquo;
            </p>
          </div>

          <div className="px-5 py-6" style={{ borderTop: "1px dashed rgba(236,231,220,0.1)", marginTop: "16px" }}>
            <p style={{ color: "#ece7dc", fontSize: "0.95rem", lineHeight: 2.1 }}>
              {clauses.map((c, i) => (
                <span key={c.tag} style={{ opacity: i <= step ? 1 : 0.28, transition: "opacity 0.5s ease" }}>
                  <span
                    style={{
                      borderBottom: `2px solid ${c.color}`,
                      paddingBottom: "1px",
                      background: i === step ? `${c.color}14` : "transparent",
                      transition: "background 0.4s ease",
                    }}
                  >
                    {c.text}
                  </span>
                  <sup className={plexMono.className} style={{ color: c.color, fontSize: "8.5px", marginLeft: "5px", marginRight: "8px", letterSpacing: "0.06em" }}>
                    {c.tag}
                  </sup>
                </span>
              ))}
            </p>
          </div>

          <div
            className="mx-5 mb-5 px-4 py-3 flex items-center justify-between"
            style={{ background: "rgba(193,68,60,0.06)", border: "1px solid rgba(193,68,60,0.18)", borderRadius: "2px" }}
          >
            <div className="flex items-center gap-2">
              <Timer size={12} style={{ color: "#8a8478" }} />
              <span className={plexMono.className} style={{ fontSize: "10px", color: "#a39c8d" }}>
                {step >= clauses.length ? "FUSED READ" : "PROCESSING\u2026"}
              </span>
            </div>
            <span
              className={plexMono.className}
              style={{
                fontSize: "10.5px", fontWeight: 600, color: "#c1443c",
                opacity: step >= clauses.length ? 1 : 0.3, transition: "opacity 0.4s ease",
              }}
            >
              face_saving_assertion &middot; 71%
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </section>
  );
}