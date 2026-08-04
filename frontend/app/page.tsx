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

const expressions = [
  { label: "neutral", color: "#e5e7eb" },
  { label: "happy", color: "#10b981" },
  { label: "surprised", color: "#06b6d4" },
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

function AvatarGlyph({ active }: { active: boolean }) {
  return (
    <div className="relative w-8 h-8 shrink-0">
      <span
        className="absolute inset-0 rounded-full border border-accent/40"
        style={{ animation: active ? "avatar-pulse 2.2s ease-out infinite" : "none" }}
      />
      <svg viewBox="0 0 36 36" className="relative w-8 h-8">
        <circle cx="18" cy="18" r="16" fill="rgba(108,99,255,0.14)" stroke="#8b85ff" strokeWidth="1" />
        <circle cx="13" cy="16" r="1.6" fill="#a5a0ff" />
        <circle cx="23" cy="16" r="1.6" fill="#a5a0ff" />
        <path d="M12 22c2 2.4 10 2.4 12 0" stroke="#a5a0ff" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </svg>
      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#10b981] border border-night-950" />
    </div>
  );
}

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeLayer, setActiveLayer] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActiveLayer((i) => (i + 1) % 4), 2800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-night-950 overflow-x-hidden font-sans">
      <section
  className="relative px-6 pt-32 pb-20 md:pt-40 overflow-hidden"
  style={{
    backgroundImage: "radial-gradient(ellipse 900px 500px at 50% -10%, rgba(108,99,255,0.16), transparent 60%)",
  }}
>
  <div className="relative z-10 max-w-3xl mx-auto text-center">
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03]">
      <span className="w-1.5 h-1.5 rounded-full bg-accent" style={{ animation: "avatar-pulse 2.2s ease-out infinite" }} />
      <span className="text-[11px] font-mono uppercase tracking-[0.14em]" style={{ color: "#d1d5db" }}>
        Multi-Layer Intent Modeling
      </span>
    </div>

    <h1 className="font-display font-medium tracking-tight leading-[0.95] text-white text-6xl mt-7">
      InterviewIQ
    </h1>

    <p className="font-display font-medium text-lg text-accent-light mt-3 tracking-tight">
      The answer behind the answer.
    </p>

    <p className="mt-6 max-w-xl mx-auto text-[1.05rem] leading-relaxed" style={{ color: "#c3c7d1" }}>
      Not just what you say &mdash; what you <span className="text-white">mean</span>. Every answer runs through four layers of signal: emotional tone, pragmatic intent, and how your goals shift as the session goes on.
    </p>

    <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
      <Link href="/register">
        <button className="group inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 bg-accent">
          Start free session
          <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
        </button>
      </Link>
      <Link
        href="/login"
        className="inline-flex items-center px-6 py-3 rounded-lg font-medium text-sm transition-colors"
        style={{ color: "#e5e7eb", border: "1px solid rgba(255,255,255,0.14)" }}
      >
        Sign in
      </Link>
    </div>

    <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
      {[
        { v: "4", l: "MLIM layers" }, { v: "8", l: "Intent labels" },
        { v: "7", l: "Emotion axes" }, { v: "2", l: "Groq models" },
      ].map((s) => (
        <div key={s.l} className="flex items-baseline gap-1.5">
          <span className="font-display text-lg font-bold text-white">{s.v}</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.12em]" style={{ color: "#9ca3af" }}>{s.l}</span>
        </div>
      ))}
    </div>

    <p className="mt-6 text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: "#6b7280" }}>
      Built on LLaMA 3.3 70B &middot; Whisper Large v3 &middot; face-api.js &middot; MongoDB Atlas
    </p>
  </div>

  <div className="relative z-10 max-w-5xl mx-auto mt-16">
    <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0c0d11] shadow-[0_40px_100px_-40px_rgba(0,0,0,0.8)]">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8 bg-white/[0.02]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
        </div>
        <div className="flex-1 flex justify-center">
          <span className="text-[10.5px] font-mono px-3 py-0.5 rounded-md bg-white/[0.03] border border-white/5" style={{ color: "#6b7280" }}>
            interviewiq.app/session/04
          </span>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <AvatarGlyph active />
            <div>
              <span className="block text-[12px] font-semibold text-white">AI Interviewer</span>
              <span className="block text-[10px] font-mono" style={{ color: "#6b7280" }}>session_04 &middot; live</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f87171] animate-pulse" />
            <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "#6b7280" }}>REC</span>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6 pb-5 border-b border-dashed border-white/10">
          <Mic size={12} style={{ color: "#6b7280" }} />
          <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "#6b7280" }}>Detected expression</span>
          <div className="flex items-center gap-3 ml-auto">
            {expressions.map((e) => (
              <span key={e.label} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: e.color, opacity: e.label === "neutral" ? 1 : 0.4 }} />
                <span className="text-[9px] font-mono" style={{ color: "#9ca3af" }}>{e.label}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5 mb-6">
          {mlimLayers.map((layer, i) => (
            <div key={layer.id}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono uppercase tracking-widest" style={{ color: activeLayer === i ? layer.color : "#6b7280" }}>{layer.label}</span>
                <span className="text-[10px] font-mono" style={{ color: "#6b7280" }}>{layer.name}</span>
              </div>
              <div className="flex items-end gap-[3px] h-6">
                {Array.from({ length: 28 }).map((_, j) => (
                  <span key={j} className="w-[3px] rounded-full flex-shrink-0" style={{
                    height: "100%",
                    background: layer.color,
                    opacity: activeLayer === i ? 0.55 + (j % 5) * 0.09 : 0.18,
                    animation: `signal-pulse ${0.8 + (j % 4) * 0.15}s ease-in-out ${j * 0.04}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg px-4 py-3 flex items-center justify-between bg-accent/[0.07] border border-accent/[0.18]">
          <span className="text-xs" style={{ color: "#c3c7d1" }}>Detected intent</span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: intents[0].color, background: `${intents[0].color}1a` }}>
            {intents[0].label} &middot; {intents[0].pct}%
          </span>
        </div>
      </div>
    </div>
  </div>

  <style jsx>{`
    @keyframes avatar-pulse {
      0% { transform: scale(1); opacity: 0.6; }
      100% { transform: scale(1.6); opacity: 0; }
    }
  `}</style>
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
          <p style={{ color: "#9ca3af", fontSize: "0.95rem" }} className="leading-relaxed">
            From facial expression to pragmatic speech acts — the full analysis stack activates on every answer you submit.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px" style={{ background: "rgba(255,255,255,0.06)", borderRadius: "1.25rem", overflow: "hidden" }}>
          {capabilities.map((cap) => (
            <div key={cap.title} className="group p-7 transition-all duration-300 hover:z-10 relative" style={{ background: "#08090c" }}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{ background: `radial-gradient(ellipse at 30% 30%, ${cap.accent}08, transparent 70%)` }} />
              <div className="relative">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-5" style={{ background: `${cap.accent}15`, border: `1px solid ${cap.accent}20` }}>
                  <cap.icon size={15} style={{ color: cap.accent }} />
                </div>
                <h3 className="font-semibold text-white mb-2 text-sm" style={{ fontFamily: "'Syne', sans-serif" }}>{cap.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#9ca3af" }}>{cap.desc}</p>
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
                <p className="text-xs leading-relaxed" style={{ color: "#9ca3af" }}>{step.desc}</p>
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
              <div className="text-[11px] font-mono" style={{ color: "#6b7280" }}>{m.sub}</div>
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
                <ChevronDown size={15} className={`flex-shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`} style={{ color: "#6b7280" }} />
              </button>
              {openFaq === i && (
                <div className="px-6 pb-5">
                  <p className="text-sm leading-relaxed" style={{ color: "#b0b4bd" }}>{faq.a}</p>
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
            <p className="mb-10 text-sm leading-relaxed max-w-lg mx-auto" style={{ color: "#9ca3af" }}>
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