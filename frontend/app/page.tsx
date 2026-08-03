"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, GitBranch, Target, Activity, Eye, Shield, Mic, Check, ChevronDown,
} from "lucide-react";

const mlimLayers = [
  {
    id: "01", label: "ASL", name: "Affective Signal Layer",
    desc: "Valence-arousal extraction, sentiment polarity classification, emotional uncertainty estimation, and affective masking detection across voice transcripts and typed responses.",
    color: "#a78bfa",
    tags: ["Valence", "Arousal", "Masking Detection", "Sentiment Polarity"],
  },
  {
    id: "02", label: "PEL", name: "Pragmatic Encoding Layer",
    desc: "Austin/Searle speech act classification, Gricean maxim-violation analysis, sarcasm detection, and pragmatic inversion flagging, resolved against the prior conversation turns.",
    color: "#60a5fa",
    tags: ["Speech Acts", "Sarcasm", "Gricean Maxims", "Pragmatic Inversion"],
  },
  {
    id: "03", label: "GSTL", name: "Goal-State Tracking Layer",
    desc: "Hidden Markov belief estimator tracking evolving candidate goals across the full session via a Bayesian update over a fixed transition matrix — detecting drift, trajectory shifts, and stress escalation.",
    color: "#34d399",
    tags: ["HMM Belief", "Goal Drift", "Trajectory", "Engagement"],
  },
  {
    id: "04", label: "IFL", name: "Intent Fusion Layer",
    desc: "Fuses ASL, PEL, and GSTL outputs with longitudinal session history into a final intent label across 8 categories, with entropy-based uncertainty scoring and automatic clarification triggering.",
    color: "#fb923c",
    tags: ["Signal Fusion", "Intent Prediction", "Entropy", "Clarification Gate"],
  },
];

const capabilities = [
  { icon: Activity, title: "Real-Time Affect Engine", desc: "Valence-arousal estimation, stress indicators, and affective-masking detection computed on every submitted answer.", accent: "#a78bfa" },
  { icon: Eye, title: "Facial Expression Analysis", desc: "Live detection across 7 emotion classes via face-api.js, fused into the MLIM affective pipeline alongside your typed or spoken answer.", accent: "#60a5fa" },
  { icon: GitBranch, title: "Goal-State Belief Tracker", desc: "An HMM belief distribution maintained across the full interview session, tracking goal drift and trajectory shifts turn by turn.", accent: "#34d399" },
  { icon: Shield, title: "Session Integrity Monitor", desc: "Tab-switch, window-blur, copy-paste, right-click, and DevTools detection, with camera/mic suspension and an integrity score in your final report.", accent: "#fb923c" },
  { icon: Mic, title: "Whisper Voice Transcription", desc: "Groq Whisper Large v3 transcribes your recorded answer and feeds the identical text into the same MLIM pipeline as typed responses.", accent: "#f472b6" },
  { icon: Target, title: "Entropy Clarification Gate", desc: "When IFL uncertainty crosses threshold, the interviewer automatically asks a targeted follow-up instead of moving on blind.", accent: "#38bdf8" },
];

const intents = [
  { label: "genuine_answer", pct: 64, color: "#10b981" },
  { label: "face_saving_assertion", pct: 14, color: "#f59e0b" },
  { label: "seeking_validation", pct: 11, color: "#a78bfa" },
  { label: "expressing_confusion", pct: 7, color: "#fb923c" },
  { label: "committed_retry", pct: 4, color: "#60a5fa" },
];

const steps = [
  { n: "01", title: "Configure your session", desc: "Select your target role and paste the job description. The Groq-powered question engine generates fresh technical, behavioral, and scenario questions for that exact role.", color: "#6c63ff" },
  { n: "02", title: "AI interviewer takes over", desc: "An animated avatar reads each question aloud through your browser's speech synthesis, with mouth movement synced to speech. Camera and microphone activate for the session.", color: "#a78bfa" },
  { n: "03", title: "Answer by voice or text", desc: "Speak naturally into your mic or type your answer. Groq Whisper Large v3 transcribes voice in real time. Both inputs feed the identical MLIM pipeline.", color: "#60a5fa" },
  { n: "04", title: "MLIM pipeline processes", desc: "ASL and PEL run first. GSTL updates the HMM goal belief state. IFL fuses every signal with your session history into a final intent label.", color: "#34d399" },
  { n: "05", title: "Live analytics refresh", desc: "In Practice mode, a structured feedback card scores your answer. In Simulation mode, the interviewer stays neutral and evaluation runs after you finish.", color: "#fb923c" },
  { n: "06", title: "Report generated", desc: "Your session closes with a full breakdown: overall score, weak areas, recommended topics, per-question detail, and an MLIM summary — exportable as PDF.", color: "#f472b6" },
];

const faqs = [
  { q: "What is MLIM?", a: "Multi-Layer Intent Modeling is a 4-layer pipeline that processes each answer through an Affective Signal Layer, Pragmatic Encoding Layer, Goal-State Tracking Layer, and Intent Fusion Layer to infer the communicative intent behind what's being said — not just surface sentiment." },
  { q: "How is this different from basic sentiment analysis?", a: "MLIM extracts valence-arousal vectors, detects affective masking, classifies speech acts using Austin/Searle theory, maintains an HMM belief state over your goals across the session, and fuses all of it with entropy-based uncertainty scoring. Sentiment analysis gives you positive or negative. MLIM gives you intent." },
  { q: "What happens if I switch tabs during an interview?", a: "Camera and microphone are suspended immediately, the event is logged, and you'll see a warning. Tab switches, window blur, copy-paste, and DevTools access all count toward your integrity score in the final report." },
  { q: "Can I answer by voice?", a: "Yes. Groq Whisper Large v3 transcribes your recorded audio and feeds it directly into the same MLIM evaluation pipeline as a typed answer." },
  { q: "What's the difference between Practice and Simulation mode?", a: "Practice mode gives you a structured feedback card after every answer. Simulation mode behaves like a real interviewer — brief acknowledgements only, no hints — and evaluates everything at once when the session ends." },
  { q: "Do I need to create an account?", a: "Yes. Accounts keep your sessions, reports, and MLIM analytics isolated to you." },
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

  useEffect(() => {
    const t = setInterval(() => setActiveLayer((i) => (i + 1) % 4), 2800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#07080b] overflow-x-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <section className="relative px-6 pt-28 pb-24 md:pt-32 md:pb-28 overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto w-full grid lg:grid-cols-[1fr_440px] gap-14 lg:gap-20 items-center">
          <div className="flex gap-7">
            <div className="hidden sm:flex flex-col gap-2.5 pt-3 shrink-0">
              {mlimLayers.map((layer) => (
                <span key={layer.id} className="w-[3px] h-14 rounded-full" style={{ background: layer.color, opacity: 0.5 }} />
              ))}
            </div>

            <div>
              <div className="flex items-center gap-3 mb-6">
                <span className="text-[10.5px] font-mono uppercase tracking-[0.16em]" style={{ color: "#9ca3af" }}>Multi-Layer Intent Modeling</span>
              </div>

              <h1 style={{ fontFamily: "'Syne', sans-serif" }} className="font-extrabold tracking-tight leading-[0.95] text-white" >
                <span className="block" style={{ fontSize: "clamp(2.0rem, 5.5vw, 4.4rem)" }}>InterviewIQ</span>
              </h1>

              <p style={{ fontFamily: "'Syne', sans-serif", color: "#8b85ff", fontSize: "clamp(1.3rem, 2.2vw, 1.7rem)" }} className="mt-4 font-bold tracking-tight leading-snug">
                The AI interview coach that reads intent.
              </p>

              <p className="mt-7 max-w-lg text-[1.05rem] leading-relaxed" style={{ color: "#8b93a3" }}>
                Not just what you say — what you <em className="not-italic" style={{ color: "#d8dae1" }}>mean</em>. Every answer runs through four layers of signal: emotional tone, pragmatic intent, and how your goals shift as the session goes on.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-5">
                <Link href="/register">
                  <button className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5" style={{ background: "#6c63ff" }}>
                    Start free session
                    <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </button>
                </Link>
                <Link href="/login" className="text-sm font-medium pb-0.5 transition-colors hover:text-white" style={{ borderBottom: "1px solid rgba(255,255,255,0.18)", color: "#9ca3af" }}>
                  Sign in
                </Link>
              </div>

              <div className="mt-12 pt-7 flex flex-wrap gap-x-8 gap-y-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                {[
                  { v: "4", l: "MLIM layers" }, { v: "8", l: "Intent labels" },
                  { v: "7", l: "Emotion axes" }, { v: "2", l: "Groq models" },
                ].map((s) => (
                  <div key={s.l} className="flex items-baseline gap-2">
                    <span style={{ fontFamily: "'Syne', sans-serif", color: "#e7e8ec" }} className="text-2xl font-bold">{s.v}</span>
                    <span className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: "#666d7d" }}>{s.l}</span>
                  </div>
                ))}
              </div>

              <p className="mt-8 text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: "#454b59" }}>
                Built on LLaMA 3.3 70B · Whisper Large v3 · face-api.js · MongoDB Atlas
              </p>
            </div>
          </div>

          <div className="relative rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 30px 80px -30px rgba(0,0,0,0.55)" }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#f87171] animate-pulse" />
                <span className="text-[10px] font-mono uppercase tracking-[0.18em]" style={{ color: "#6b7280" }}>Live Signal Console</span>
              </div>
              <span className="text-[10px] font-mono" style={{ color: "#374151" }}>session_04</span>
            </div>

            <div className="space-y-5 mb-6">
              {mlimLayers.map((layer, i) => (
                <div key={layer.id}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono uppercase tracking-widest" style={{ color: activeLayer === i ? layer.color : "#4b5563" }}>{layer.label}</span>
                    <span className="text-[10px] font-mono" style={{ color: "#374151" }}>{layer.name}</span>
                  </div>
                  <div className="flex items-end gap-[3px] h-7">
                    {Array.from({ length: 36 }).map((_, j) => (
                      <span key={j} className="w-[3px] rounded-full flex-shrink-0" style={{
                        height: "100%",
                        background: layer.color,
                        opacity: activeLayer === i ? 0.5 + (j % 5) * 0.1 : 0.15,
                        animation: `signal-pulse ${0.8 + (j % 4) * 0.15}s ease-in-out ${j * 0.04}s infinite`,
                      }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: "rgba(108,99,255,0.06)", border: "1px solid rgba(108,99,255,0.15)" }}>
              <span className="text-xs" style={{ color: "#9ca3af" }}>Detected intent</span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: intents[0].color, background: `${intents[0].color}1a` }}>
                {intents[0].label} · {intents[0].pct}%
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="py-28 px-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-stretch">
          <div className="lg:sticky lg:top-28 h-full flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] block mb-5" style={{ color: "#6c63ff" }}>Architecture</span>
              <h2 className="font-bold text-white mb-5 leading-tight" style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}>
                <span className="block">The 4-Layer</span>
                <span className="block" style={{ color: "#6c63ff" }}>Intent Pipeline</span>
              </h2>
              <p className="leading-relaxed mb-8" style={{ color: "#6b7280", fontSize: "0.95rem" }}>
                Each answer passes through all four layers. ASL and PEL run first, then GSTL updates the HMM belief state, and IFL fuses everything into a final intent prediction with entropy-based uncertainty scoring.
              </p>
              <div className="space-y-3">
                {[
                  "ASL and PEL run on the fast 8B model for low latency",
                  "HMM belief state persisted across the full session",
                  "Entropy threshold automatically triggers a clarification question",
                  "IFL runs on the 70B reasoning model with full session history",
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
            <div className="rounded-2xl p-6 mt-10 hidden lg:block" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6c63ff] animate-pulse" />
                <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "#4b5563" }}>Pipeline Summary</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>
                Four layers, one continuous read on every answer — from raw affect to a fused, entropy-scored intent label.
              </p>
            </div>
          </div>

          <div className="space-y-3 flex flex-col">
            {mlimLayers.map((layer, i) => {
              const active = activeLayer === i;
              return (
                <div
                  key={layer.id}
                  onClick={() => setActiveLayer(i)}
                  className="rounded-2xl p-5 cursor-pointer transition-all duration-300 flex-1"
                  style={{
                    background: active ? `linear-gradient(135deg, ${layer.color}0a 0%, rgba(255,255,255,0.02) 100%)` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${active ? layer.color + "30" : "rgba(255,255,255,0.06)"}`,
                    transform: active ? "translateX(4px)" : "translateX(0)",
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-xs" style={{ background: `${layer.color}15`, border: `1px solid ${layer.color}25`, color: layer.color }}>
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
                        <div>
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

            <div className="rounded-2xl p-4 mt-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6c63ff] animate-pulse" />
                <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "#4b5563" }}>IFL Output — Sample Intent Distribution</span>
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

      <div className="max-w-7xl mx-auto px-6">
        <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, rgba(108,99,255,0.2), transparent)" }} />
      </div>

      <section className="py-28 px-6 max-w-7xl mx-auto">
        <div className="max-w-2xl mb-16">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] block mb-5" style={{ color: "#6c63ff" }}>Capabilities</span>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }} className="font-bold text-white mb-5 leading-tight">
            Every layer of intelligence,<br />running on your answer.
          </h2>
          <p style={{ color: "#6b7280", fontSize: "0.95rem" }} className="leading-relaxed">
            From facial expression to pragmatic speech acts — the full analysis stack activates on every answer you submit.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px" style={{ background: "rgba(255,255,255,0.06)", borderRadius: "1.25rem", overflow: "hidden" }}>
          {capabilities.map((cap) => (
            <div key={cap.title} className="group p-7 transition-all duration-300 hover:z-10 relative" style={{ background: "#07080b" }}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{ background: `radial-gradient(ellipse at 30% 30%, ${cap.accent}08, transparent 70%)` }} />
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

      <div className="max-w-7xl mx-auto px-6">
        <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, rgba(108,99,255,0.2), transparent)" }} />
      </div>

      <section className="py-28 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] block mb-5" style={{ color: "#6c63ff" }}>Process</span>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }} className="font-bold text-white leading-tight">
            From job description<br />to full assessment report.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {steps.map((step) => (
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

      <section className="py-20 px-6" style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { target: 4, suffix: "", label: "MLIM Layers", sub: "ASL · PEL · GSTL · IFL" },
            { target: 8, suffix: "", label: "Intent Labels", sub: "Searle speech-act taxonomy" },
            { target: 7, suffix: "", label: "Emotion Axes", sub: "face-api.js detection" },
            { target: 2, suffix: "", label: "Groq Models", sub: "8B fast · 70B reasoning" },
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
                <div className="px-6 pb-5">
                  <p className="text-sm leading-relaxed" style={{ color: "#9ca3af" }}>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

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
              Create an account and start your first session. Watch the MLIM pipeline analyze your answers across all four layers, live.
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
    </div>
  );
}