"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Navbar } from "@/components/layout/Navbar";
import {
  Brain, Zap, Shield, BarChart2, Mic, Video, ArrowRight,
  Layers, GitBranch, Target, Activity, Eye, Lock,
  ChevronDown, ChevronRight, Play, Circle, Check
} from "lucide-react";

const mlimLayers = [
  {
    id: "01", label: "ASL", name: "Affective Signal Layer",
    desc: "Valence-arousal extraction, sentiment polarity classification, emotional uncertainty estimation, and affective masking detection across voice transcripts and typed responses.",
    color: "#a78bfa", dot: "bg-purple-400",
    tags: ["Valence", "Arousal", "Masking Detection", "Sentiment Polarity"],
  },
  {
    id: "02", label: "PEL", name: "Pragmatic Encoding Layer",
    desc: "Context-aware transformer encoding with Austin/Searle speech act classification, Gricean implicature analysis, sarcasm detection, and pragmatic inversion flagging.",
    color: "#60a5fa", dot: "bg-blue-400",
    tags: ["Speech Acts", "Sarcasm", "Gricean Implicature", "Pragmatic Inversion"],
  },
  {
    id: "03", label: "GSTL", name: "Goal-State Tracking Layer",
    desc: "POMDP-inspired recurrent belief estimator tracking evolving user goals across the full session — detecting drift, trajectory shifts, stress escalation, and readiness evolution.",
    color: "#34d399", dot: "bg-emerald-400",
    tags: ["POMDP Belief", "Goal Drift", "Trajectory", "Engagement"],
  },
  {
    id: "04", label: "IFL", name: "Intent Fusion Layer",
    desc: "Attention-weighted multi-source fusion integrating all layer outputs with longitudinal history. Produces softmax intent prediction, entropy uncertainty score, and clarification trigger.",
    color: "#fb923c", dot: "bg-orange-400",
    tags: ["Attention Fusion", "Intent Prediction", "Entropy", "Clarification Gate"],
  },
];

const capabilities = [
  { icon: Activity, title: "Real-Time Affect Engine", desc: "Valence-arousal estimation, stress indicators, emotional masking detection running on every submitted answer.", accent: "#a78bfa" },
  { icon: Eye, title: "Facial Expression Analysis", desc: "Live micro-expression detection across 7 emotion dimensions via face-api.js, fused into the MLIM affective pipeline.", accent: "#60a5fa" },
  { icon: GitBranch, title: "Goal-State Belief Tracker", desc: "POMDP belief state maintained across the full interview session — tracking goal drift and trajectory shifts.", accent: "#34d399" },
  { icon: Shield, title: "Session Integrity Monitor", desc: "Tab-switch, window-blur, copy-paste flagging, and camera suspension on focus loss with per-session integrity scoring.", accent: "#fb923c" },
  { icon: Mic, title: "Whisper Voice Transcription", desc: "Groq Whisper-powered real-time transcription feeding the same MLIM pipeline as typed text responses.", accent: "#f472b6" },
  { icon: Target, title: "Entropy Clarification Gate", desc: "Automatic clarification question injection when IFL entropy exceeds threshold — the interviewer asks follow-up intelligently.", accent: "#38bdf8" },
];

const intents = [
  { label: "genuine_answer", pct: 64, color: "#10b981" },
  { label: "face_saving_assertion", pct: 14, color: "#f59e0b" },
  { label: "seeking_validation", pct: 11, color: "#a78bfa" },
  { label: "expressing_confusion", pct: 7, color: "#fb923c" },
  { label: "committed_retry", pct: 4, color: "#60a5fa" },
];

const faqs = [
  { q: "What is MLIM?", a: "Multi-Layer Intent Modeling is a 4-layer NLP architecture that processes each answer through Affective Signal analysis, Pragmatic Encoding, Goal-State Tracking, and Intent Fusion to infer the true communicative intent behind what is being said — not just the surface sentiment." },
  { q: "How is this different from basic sentiment analysis?", a: "MLIM extracts valence-arousal vectors, detects affective masking, classifies speech acts using Austin/Searle theory, maintains a POMDP belief state over user goals, and fuses all signals with entropy-based uncertainty scoring. Sentiment analysis gives you positive/negative. MLIM gives you intent." },
  { q: "What happens if I switch tabs during an interview?", a: "Camera and microphone streams are immediately suspended, analysis pauses, and a session integrity event is logged. Your integrity score is updated and reflected in your final report when the session completes." },
  { q: "Can I answer by voice?", a: "Yes. A Groq Whisper-powered transcription pipeline converts your audio in real time and feeds it directly into the MLIM evaluation pipeline — identical to typed responses." },
  { q: "What does the live analytics panel show?", a: "All 4 MLIM layer outputs update after every answer: ASL sentiment/valence/arousal/masking, PEL speech act and pragmatic flags, GSTL engagement/stress/goal distribution/trajectory, and IFL intent label/entropy/failure modes." },
  { q: "Do I need to create an account?", a: "Yes — accounts keep your sessions, reports, and MLIM analytics completely private and isolated. No data is shared between users." },
];

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        let start = 0;
        const step = target / 40;
        const t = setInterval(() => {
          start += step;
          if (start >= target) { setCount(target); clearInterval(t); }
          else setCount(Math.floor(start));
        }, 30);
        obs.disconnect();
      }
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target]);
  return <span ref={ref}>{count}{suffix}</span>;
}

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeLayer, setActiveLayer] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const t = setInterval(() => setActiveLayer((i) => (i + 1) % 4), 2800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#07080b] overflow-x-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <Navbar />

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-20 pb-24 overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "linear-gradient(rgba(108,99,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(108,99,255,0.04) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }} />
        {/* Radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(108,99,255,0.09) 0%, transparent 70%)" }} />
        <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(139,133,255,0.05) 0%, transparent 70%)" }} />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2.5 mb-8 px-4 py-2 rounded-full border" style={{ borderColor: "rgba(108,99,255,0.25)", background: "rgba(108,99,255,0.07)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#6c63ff] animate-pulse" />
            <span className="text-[11px] font-mono font-semibold tracking-[0.18em] uppercase" style={{ color: "#a78bfa" }}>
              Multi-Layer Intent Modeling · Research-Backed AI
            </span>
          </div>

          {/* Headline */}
          <h1 style={{ fontFamily: "'Syne', sans-serif" }} className="font-extrabold leading-[1.05] tracking-tight mb-6">
            <span className="block text-white" style={{ fontSize: "clamp(3rem, 7vw, 5.5rem)" }}>The AI interview coach</span>
            <span className="block" style={{
              fontSize: "clamp(3rem, 7vw, 5.5rem)",
              background: "linear-gradient(135deg, #6c63ff 0%, #a78bfa 50%, #60a5fa 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>that reads intent.</span>
          </h1>

          {/* Sub */}
          <p className="text-lg leading-relaxed mb-10 max-w-2xl mx-auto" style={{ color: "#9ca3af" }}>
            Not just what you say — but what you <em className="not-italic" style={{ color: "#e5e7eb" }}>mean</em>. Four analytical layers process every answer to detect goals, emotional state, pragmatic intent, and behavioral consistency in real time.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/register">
              <button className="group flex items-center gap-2.5 px-8 py-3.5 rounded-xl font-semibold text-white transition-all duration-200 hover:-translate-y-0.5" style={{ background: "linear-gradient(135deg, #6c63ff, #8b85ff)", boxShadow: "0 0 32px rgba(108,99,255,0.35), 0 4px 16px rgba(0,0,0,0.4)" }}>
                Start Free Session
                <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            </Link>
            <Link href="/login">
              <button className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-medium transition-all duration-200 hover:border-white/20" style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", background: "rgba(255,255,255,0.03)" }}>
                Sign in
              </button>
            </Link>
          </div>

          {/* Stat pills */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              { v: "4", l: "MLIM Layers" }, { v: "8", l: "Intent Labels" },
              { v: "7", l: "Emotion Axes" }, { v: "< 3s", l: "Analysis Latency" },
            ].map((s) => (
              <div key={s.l} className="px-5 py-2.5 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span style={{ fontFamily: "'Syne', sans-serif", color: "#6c63ff" }} className="font-bold text-xl block leading-none mb-0.5">{s.v}</span>
                <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "#6b7280" }}>{s.l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
          <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "#374151" }}>Scroll</span>
          <ChevronDown size={14} style={{ color: "#374151" }} />
        </div>
      </section>

      {/* ── MLIM PIPELINE ── */}
      <section className="py-28 px-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left — text */}
          <div className="lg:sticky lg:top-28">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] block mb-5" style={{ color: "#6c63ff" }}>Architecture</span>
            <h2 style={{ fontFamily: "'Syne', sans-serif" }} className="font-bold text-white mb-5 leading-tight" style2={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}>
              <span className="block" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", fontFamily: "'Syne', sans-serif" }}>The 4-Layer</span>
              <span className="block" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", fontFamily: "'Syne', sans-serif", color: "#6c63ff" }}>Intent Pipeline</span>
            </h2>
            <p className="leading-relaxed mb-8" style={{ color: "#6b7280", fontSize: "0.95rem" }}>
              Each answer passes through all four layers sequentially. ASL and PEL run in parallel, then GSTL updates the belief state, and IFL fuses everything into a final intent prediction with entropy-based uncertainty scoring.
            </p>
            <div className="space-y-3">
              {[
                "Parallel ASL + PEL execution for low latency",
                "POMDP belief state persisted across full session",
                "Entropy threshold triggers clarification questions",
                "Longitudinal history H_t fed to fusion layer",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(108,99,255,0.15)", border: "1px solid rgba(108,99,255,0.3)" }}>
                    <Check size={10} style={{ color: "#6c63ff" }} />
                  </div>
                  <span className="text-sm" style={{ color: "#9ca3af" }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — layer cards */}
          <div className="space-y-3">
            {mlimLayers.map((layer, i) => {
              const active = activeLayer === i;
              return (
                <div
                  key={layer.id}
                  onClick={() => setActiveLayer(i)}
                  className="rounded-2xl p-5 cursor-pointer transition-all duration-400"
                  style={{
                    background: active ? `linear-gradient(135deg, ${layer.color}0a 0%, rgba(255,255,255,0.02) 100%)` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${active ? layer.color + "30" : "rgba(255,255,255,0.06)"}`,
                    transform: active ? "translateX(4px)" : "translateX(0)",
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-xs"
                        style={{ background: `${layer.color}15`, border: `1px solid ${layer.color}25`, color: layer.color }}>
                        {layer.id}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold" style={{ color: layer.color }}>{layer.label}</span>
                          <span className="text-sm font-semibold text-white">{layer.name}</span>
                        </div>
                        {active && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: layer.color }} />}
                      </div>
                      {active && (
                        <div className="animate-fade-in">
                          <p className="text-xs leading-relaxed mb-3" style={{ color: "#6b7280" }}>{layer.desc}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {layer.tags.map((tag) => (
                              <span key={tag} className="text-[9px] font-mono px-2 py-0.5 rounded-full" style={{ background: `${layer.color}10`, border: `1px solid ${layer.color}20`, color: layer.color }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Output card */}
            <div className="rounded-2xl p-4 mt-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6c63ff] animate-pulse" />
                <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "#4b5563" }}>IFL Output — Intent Distribution</span>
              </div>
              <div className="space-y-2">
                {intents.map((intent) => (
                  <div key={intent.label} className="flex items-center gap-3">
                    <span className="text-[9px] font-mono w-36 flex-shrink-0" style={{ color: "#6b7280" }}>{intent.label}</span>
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${intent.pct}%`, background: intent.color }} />
                    </div>
                    <span className="text-[9px] font-mono w-6 text-right" style={{ color: intent.color }}>{intent.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="max-w-7xl mx-auto px-6">
        <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, rgba(108,99,255,0.2), transparent)" }} />
      </div>

      {/* ── CAPABILITIES ── */}
      <section className="py-28 px-6 max-w-7xl mx-auto">
        <div className="max-w-2xl mb-16">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] block mb-5" style={{ color: "#6c63ff" }}>Capabilities</span>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }} className="font-bold text-white mb-5 leading-tight">
            Every layer of intelligence,<br />running simultaneously.
          </h2>
          <p style={{ color: "#6b7280", fontSize: "0.95rem" }} className="leading-relaxed">
            From facial micro-expressions to pragmatic speech acts — the entire analysis stack activates on every answer you submit.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px" style={{ background: "rgba(255,255,255,0.06)", borderRadius: "1.25rem", overflow: "hidden" }}>
          {capabilities.map((cap, i) => (
            <div key={cap.title} className="group p-7 transition-all duration-300 hover:z-10 relative" style={{ background: "#07080b" }}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-none" style={{ background: `radial-gradient(ellipse at 30% 30%, ${cap.accent}08, transparent 70%)` }} />
              <div className="relative">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-5" style={{ background: `${cap.accent}15`, border: `1px solid ${cap.accent}20` }}>
                  <cap.icon size={15} style={{ color: cap.accent }} />
                </div>
                <h3 className="font-semibold text-white mb-2 text-sm" style={{ fontFamily: "'Syne', sans-serif" }}>{cap.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>{cap.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="max-w-7xl mx-auto px-6">
        <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, rgba(108,99,255,0.2), transparent)" }} />
      </div>

      {/* ── HOW IT WORKS ── */}
      <section className="py-28 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] block mb-5" style={{ color: "#6c63ff" }}>Process</span>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }} className="font-bold text-white leading-tight">
            From question to insight<br />in under three seconds.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {[
            { n: "01", title: "Configure your session", desc: "Select your target role and paste the job description. The Groq-powered question engine generates role-specific technical, behavioral, and scenario questions.", color: "#6c63ff" },
            { n: "02", title: "AI interviewer takes over", desc: "An animated avatar delivers each question with Web Speech TTS and natural lip-sync. Camera and microphone activate. The session begins.", color: "#a78bfa" },
            { n: "03", title: "Answer by voice or text", desc: "Speak naturally into your mic or type your answer. Groq Whisper transcribes voice in real time. Both inputs feed the identical MLIM pipeline.", color: "#60a5fa" },
            { n: "04", title: "MLIM pipeline processes", desc: "ASL and PEL run in parallel. GSTL updates the goal belief state. IFL fuses all signals with longitudinal history into a final intent prediction.", color: "#34d399" },
            { n: "05", title: "Live analytics refresh", desc: "The analytics sidebar updates with emotion vectors, intent distribution, goal drift indicators, stress scores, and entropy confidence after every answer.", color: "#fb923c" },
            { n: "06", title: "Report generated", desc: "Your session closes with a full breakdown: per-question MLIM analysis, intent history, failure modes detected, session trajectory, and integrity score.", color: "#f472b6" },
          ].map((step, i) => (
            <div key={step.n} className="flex gap-5 p-6 rounded-2xl transition-all duration-200 hover:border-white/10" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs" style={{ background: `${step.color}15`, border: `1px solid ${step.color}25`, color: step.color }}>
                {step.n}
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm mb-1.5" style={{ fontFamily: "'Syne', sans-serif" }}>{step.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── METRICS BAND ── */}
      <section className="py-20 px-6" style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { target: 4, suffix: "", label: "MLIM Layers", sub: "Sequential processing pipeline" },
            { target: 8, suffix: "", label: "Intent Labels", sub: "Searle speech act taxonomy" },
            { target: 7, suffix: "", label: "Emotion Axes", sub: "Face-api.js detection" },
            { target: 3, suffix: "s", label: "Avg Latency", sub: "Parallel ASL + PEL execution" },
          ].map((m) => (
            <div key={m.label}>
              <div style={{ fontFamily: "'Syne', sans-serif", color: "#6c63ff" }} className="font-extrabold text-5xl leading-none mb-2">
                <AnimatedCounter target={m.target} suffix={m.suffix} />
              </div>
              <div className="font-semibold text-white text-sm mb-1">{m.label}</div>
              <div className="text-[11px] font-mono" style={{ color: "#4b5563" }}>{m.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-28 px-6 max-w-3xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] block mb-5" style={{ color: "#6c63ff" }}>FAQ</span>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(1.8rem, 3vw, 2.2rem)" }} className="font-bold text-white">Common questions</h2>
        </div>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-xl overflow-hidden transition-all duration-200" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${openFaq === i ? "rgba(108,99,255,0.2)" : "rgba(255,255,255,0.05)"}` }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full px-6 py-4 flex items-center justify-between text-left gap-4">
                <span className="text-sm font-medium text-white">{faq.q}</span>
                <ChevronDown size={15} className={`flex-shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`} style={{ color: "#4b5563" }} />
              </button>
              {openFaq === i && (
                <div className="px-6 pb-5 animate-fade-in">
                  <p className="text-sm leading-relaxed" style={{ color: "#9ca3af" }}>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <div className="relative rounded-2xl p-14 text-center overflow-hidden" style={{ background: "rgba(108,99,255,0.04)", border: "1px solid rgba(108,99,255,0.15)" }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(108,99,255,0.1), transparent 70%)" }} />
          <div className="relative">
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full" style={{ background: "rgba(108,99,255,0.1)", border: "1px solid rgba(108,99,255,0.2)" }}>
              <span className="w-1 h-1 rounded-full bg-[#6c63ff] animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "#a78bfa" }}>Free · No credit card required</span>
            </div>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }} className="font-bold text-white mb-4 leading-tight">
              Ready to see your intent profile?
            </h2>
            <p className="mb-10 text-sm leading-relaxed max-w-lg mx-auto" style={{ color: "#6b7280" }}>
              Create an account and start your first session. Watch the MLIM pipeline analyze your answers in real time across all four layers.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register">
                <button className="group flex items-center gap-2.5 px-8 py-3.5 rounded-xl font-semibold text-white transition-all duration-200 hover:-translate-y-0.5" style={{ background: "linear-gradient(135deg, #6c63ff, #8b85ff)", boxShadow: "0 0 40px rgba(108,99,255,0.3), 0 4px 16px rgba(0,0,0,0.4)" }}>
                  Create Account <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </button>
              </Link>
              <Link href="/login">
                <button className="px-8 py-3.5 rounded-xl font-medium text-sm transition-all duration-200 hover:border-white/15" style={{ border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", background: "transparent" }}>
                  Already have an account? Sign in
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }} className="py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6c63ff, #8b85ff)" }}>
                <span className="text-white font-bold text-xs">IQ</span>
              </div>
              <span style={{ fontFamily: "'Syne', sans-serif" }} className="font-bold text-white">InterviewIQ</span>
            </div>
            <div className="flex flex-wrap gap-6">
              {[
                { href: "/register", label: "Get Started" },
                { href: "/login", label: "Sign In" },
                { href: "/setup", label: "New Interview" },
                { href: "/dashboard", label: "Dashboard" },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="text-xs transition-colors hover:text-white" style={{ color: "#4b5563" }}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div style={{ height: "1px", background: "rgba(255,255,255,0.04)" }} className="mb-8" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <p className="text-[11px] font-mono" style={{ color: "#374151" }}>
              MLIM Framework · Affective Signal Layer · Pragmatic Encoding · Goal-State Tracking · Intent Fusion
            </p>
            <p className="text-[11px] font-mono" style={{ color: "#374151" }}>
              Powered by Groq · face-api.js · Whisper
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}