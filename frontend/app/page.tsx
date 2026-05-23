"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Navbar } from "@/components/layout/Navbar";
import { Brain, Zap, Shield, BarChart2, Mic, Video, ArrowRight, Layers, GitBranch, Target, Activity, Eye, Lock, ChevronDown } from "lucide-react";

const mlimLayers = [
  { id: "L1", label: "ASL", name: "Affective Signal Layer", desc: "Valence · Arousal · Sentiment polarity · Emotional uncertainty · Affective masking detection", color: "#a78bfa", bg: "from-purple-900/40 to-purple-800/10" },
  { id: "L2", label: "PEL", name: "Pragmatic Encoding Layer", desc: "Speech act classification · Sarcasm detection · Gricean implicature · Context-aware pragmatics", color: "#60a5fa", bg: "from-blue-900/40 to-blue-800/10" },
  { id: "L3", label: "GSTL", name: "Goal-State Tracking Layer", desc: "POMDP belief estimator · Goal drift detection · Session trajectory · Stress & engagement tracking", color: "#34d399", bg: "from-emerald-900/40 to-emerald-800/10" },
  { id: "L4", label: "IFL", name: "Intent Fusion Layer", desc: "Multi-source attention fusion · Softmax intent prediction · Entropy-based uncertainty · Clarification protocol", color: "#fb923c", bg: "from-orange-900/40 to-orange-800/10" },
];

const features = [
  { icon: Brain, title: "MLIM Framework", desc: "4-layer Multi-Layer Intent Modeling: Affective Signal, Pragmatic Encoding, Goal-State Tracking, and Intent Fusion running in sequence on every answer.", color: "from-violet-500 to-purple-600" },
  { icon: Activity, title: "Real-Time Affect Engine", desc: "Valence-arousal estimation, stress indicators, engagement tracking, emotional uncertainty scoring, and affective masking detection.", color: "from-emerald-500 to-teal-500" },
  { icon: Eye, title: "Face & Emotion Analysis", desc: "Live face detection with micro-expression signals across 7 emotion dimensions, rendered in real-time on your video feed.", color: "from-blue-500 to-cyan-500" },
  { icon: GitBranch, title: "Goal-State Belief Tracker", desc: "POMDP-inspired recurrent estimator tracking goal drift, session trajectory, and readiness estimate across the full interview.", color: "from-pink-500 to-rose-500" },
  { icon: Shield, title: "Integrity Monitor", desc: "Tab-switch detection, window-focus tracking, camera suspension on context loss, copy-paste flagging, and integrity scoring.", color: "from-amber-500 to-orange-500" },
  { icon: Mic, title: "Voice + Text Input", desc: "Whisper-powered transcription for voice answers or natural text input — both feed the same MLIM evaluation pipeline.", color: "from-indigo-500 to-blue-500" },
  { icon: Target, title: "Clarification Protocol", desc: "Entropy-thresholded uncertainty detection automatically triggers targeted clarification questions when intent is ambiguous.", color: "from-cyan-500 to-blue-400" },
  { icon: BarChart2, title: "Full Session Reports", desc: "Per-question MLIM breakdown, intent distribution, failure mode log, goal drift count, and session trajectory in your final report.", color: "from-purple-500 to-violet-600" },
  { icon: Lock, title: "AI Interviewer Avatar", desc: "Animated avatar with Web Speech TTS, natural lip-sync, and blink animations delivers questions conversationally.", color: "from-rose-500 to-pink-600" },
];

const stats = [
  { value: "4", label: "MLIM Layers" },
  { value: "8", label: "Intent Labels" },
  { value: "7", label: "Emotion Axes" },
  { value: "AI", label: "Powered" },
];

const faqs = [
  { q: "What is MLIM?", a: "Multi-Layer Intent Modeling is a 4-layer NLP framework that processes each answer through Affective Signal analysis, Pragmatic Encoding, Goal-State Tracking, and Intent Fusion to infer the true intent behind what is being said." },
  { q: "How is this different from basic sentiment analysis?", a: "MLIM goes beyond positive/negative classification. It extracts valence-arousal vectors, detects affective masking, classifies speech acts using Austin/Searle theory, and maintains a POMDP belief state over user goals throughout the session." },
  { q: "What happens if I switch tabs?", a: "Camera and microphone streams are immediately suspended, the session is flagged, and your integrity score is updated. Returning to the window resumes the session." },
  { q: "Can I answer by voice?", a: "Yes. A Whisper-powered transcription pipeline converts your audio to text and feeds it directly into the same MLIM evaluation as typed answers." },
  { q: "What does the live analytics panel show?", a: "The right sidebar displays all 4 MLIM layer outputs in real time: sentiment/valence/arousal/masking from ASL, speech act and pragmatic flags from PEL, engagement/stress/trajectory/goal distribution from GSTL, and intent/entropy/failure modes from IFL." },
];

function MLIMViz() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive((i) => (i + 1) % 4), 2000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="flex flex-col gap-2">
        {mlimLayers.map((layer, i) => (
          <div
            key={layer.id}
            onClick={() => setActive(i)}
            className={`relative rounded-xl p-4 cursor-pointer transition-all duration-500 border ${active === i ? `bg-gradient-to-r ${layer.bg} border-white/15` : "bg-white/[0.02] border-white/5 hover:border-white/10"}`}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold text-sm border" style={{ backgroundColor: `${layer.color}15`, borderColor: `${layer.color}30`, color: layer.color }}>{layer.id}</div>
                {i < 3 && <div className="w-px h-2" style={{ backgroundColor: active === i ? layer.color + "60" : "#ffffff15" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono font-bold" style={{ color: layer.color }}>{layer.label}</span>
                  <span className="text-sm font-semibold text-white">{layer.name}</span>
                </div>
                <p className={`text-xs leading-relaxed transition-all duration-300 ${active === i ? "text-gray-400 max-h-12 opacity-100" : "text-gray-600 max-h-0 opacity-0 overflow-hidden"}`}>{layer.desc}</p>
              </div>
              {active === i && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 animate-pulse" style={{ backgroundColor: layer.color }} />}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 glass rounded-xl p-3 border border-white/5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">Output — Intent Fusion</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[{ l: "Intent", v: "genuine_answer", c: "#10b981" }, { l: "Confidence", v: "87%", c: "#a78bfa" }, { l: "Entropy", v: "0.412", c: "#f59e0b" }, { l: "Trajectory", v: "improving", c: "#60a5fa" }].map((x) => (
            <div key={x.l} className="text-center">
              <p className="text-[8px] text-gray-600 font-mono mb-0.5">{x.l}</p>
              <p className="text-[10px] font-bold font-mono" style={{ color: x.c }}>{x.v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-night-950 overflow-x-hidden">
      <Navbar />

      <section className="relative pt-32 pb-20 px-6 max-w-7xl mx-auto text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-accent/8 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-40 left-1/4 w-[300px] h-[300px] bg-purple-700/8 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-[300px] h-[300px] bg-blue-700/6 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full border border-accent/20 bg-accent/5">
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[11px] font-mono font-semibold tracking-[0.15em] uppercase text-accent/80">Multi-Layer Intent Modeling · Research-Backed AI</span>
          </div>

          <div className="mb-2">
            <span className="font-display font-extrabold text-[clamp(3rem,9vw,7rem)] leading-none bg-gradient-to-r from-accent via-accent-light to-violet-300 bg-clip-text text-transparent tracking-tight">InterviewIQ</span>
          </div>
          <h1 className="font-display text-[clamp(1.5rem,4vw,3rem)] font-bold leading-tight text-white mb-6">
            The AI interview coach that<br className="hidden sm:block" /> <span className="text-gray-400">understands your intent.</span>
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            Not just what you say — but what you <em>mean</em>. MLIM processes every answer through 4 analytical layers to detect goals, emotional state, pragmatic intent, and behavioral consistency in real time.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/setup">
              <Button size="lg" className="w-full sm:w-auto px-8 gap-2">Start Session <ArrowRight size={16} /></Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="w-full sm:w-auto px-8">View Dashboard</Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto">
            {stats.map((s) => (
              <div key={s.label} className="glass rounded-xl py-3 px-2 text-center">
                <p className="font-display text-2xl font-bold text-accent mb-0.5">{s.value}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-mono">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full border border-white/10 bg-white/5">
            <Layers size={12} className="text-accent" />
            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">MLIM Architecture</span>
          </div>
          <h2 className="font-display text-3xl font-bold text-white mb-3">4-Layer Intent Pipeline</h2>
          <p className="text-gray-500 max-w-xl mx-auto text-sm">Each answer passes through all four layers sequentially. The final Intent Fusion layer integrates all signals to predict true intent with entropy-based confidence scoring.</p>
        </div>
        <MLIMViz />
      </section>

      <section className="py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-[10px] font-mono text-gray-600 uppercase tracking-widest block mb-4">Capabilities</span>
          <h2 className="font-display text-3xl font-bold text-white mb-3">Everything in one system</h2>
          <p className="text-gray-500 text-sm max-w-lg mx-auto">From facial micro-expressions to pragmatic speech acts — all layers run simultaneously during your interview.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="group glass rounded-2xl p-5 hover:border-white/12 hover:-translate-y-0.5 transition-all duration-300">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-105 transition-transform duration-300`}>
                <f.icon size={16} className="text-white" />
              </div>
              <h3 className="font-display font-semibold text-white mb-1.5 text-sm">{f.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 px-6 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-[10px] font-mono text-gray-600 uppercase tracking-widest block mb-4">How It Works</span>
          <h2 className="font-display text-3xl font-bold text-white">From question to insight in seconds</h2>
        </div>
        <div className="relative">
          <div className="absolute left-5 top-4 bottom-4 w-px bg-gradient-to-b from-accent/40 via-purple-500/30 to-transparent" />
          {[
            { n: "01", title: "Setup your session", desc: "Enter your job role and description. The AI generates role-specific technical, behavioral, and scenario questions tailored to you.", color: "bg-accent" },
            { n: "02", title: "AI interviewer asks questions", desc: "An animated interviewer avatar reads each question aloud with TTS and natural lip-sync. Your camera and mic activate automatically.", color: "bg-purple-500" },
            { n: "03", title: "Answer by voice or text", desc: "Speak naturally or type your answer. Whisper transcription handles voice input. Both routes feed the same MLIM pipeline.", color: "bg-blue-500" },
            { n: "04", title: "MLIM processes your answer", desc: "All 4 layers run in parallel: ASL extracts affect, PEL encodes pragmatics, GSTL updates goal beliefs, IFL fuses and predicts intent.", color: "bg-emerald-500" },
            { n: "05", title: "Live analytics update", desc: "The right sidebar refreshes with new emotion, intent, stress, engagement, and goal distribution data after every submission.", color: "bg-amber-500" },
            { n: "06", title: "Final report generated", desc: "A comprehensive report with per-question MLIM breakdown, score history, failure modes, and session trajectory is generated.", color: "bg-rose-500" },
          ].map((step) => (
            <div key={step.n} className="relative flex gap-6 mb-8">
              <div className={`w-10 h-10 rounded-full ${step.color} flex items-center justify-center flex-shrink-0 z-10 font-mono text-xs font-bold text-white shadow-lg`}>{step.n}</div>
              <div className="glass rounded-xl p-4 flex-1">
                <h3 className="font-semibold text-white text-sm mb-1">{step.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 px-6 max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <span className="text-[10px] font-mono text-gray-600 uppercase tracking-widest block mb-4">FAQ</span>
          <h2 className="font-display text-3xl font-bold text-white">Common questions</h2>
        </div>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className="glass rounded-xl overflow-hidden">
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full px-5 py-4 flex items-center justify-between text-left gap-4">
                <span className="text-sm font-medium text-white">{faq.q}</span>
                <ChevronDown size={16} className={`text-gray-500 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`} />
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4">
                  <p className="text-sm text-gray-400 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 px-6 max-w-3xl mx-auto text-center">
        <div className="glass rounded-2xl p-12 border-accent/10 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-purple-500/5 pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 mb-6 px-3 py-1 rounded-full border border-accent/20 bg-accent/5">
              <div className="w-1 h-1 rounded-full bg-accent animate-pulse" />
              <span className="text-[10px] font-mono text-accent/80 uppercase tracking-widest">Research-backed · Production-ready</span>
            </div>
            <h2 className="font-display text-3xl font-bold text-white mb-3">Ready to see your intent profile?</h2>
            <p className="text-gray-500 mb-8 text-sm max-w-md mx-auto">Start a session and watch the MLIM pipeline analyze your answers in real time. Free. No account required.</p>
            <Link href="/setup">
              <Button size="lg" className="px-10 gap-2">Start Free Session <ArrowRight size={16} /></Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">IQ</span>
            </div>
            <span className="font-display font-bold text-white text-sm">InterviewIQ</span>
          </div>
          <p className="text-[11px] text-gray-600 font-mono">MLIM Framework · Affective Computing · Intent Modeling</p>
          <div className="flex items-center gap-4">
            <Link href="/setup" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Start Session</Link>
            <Link href="/dashboard" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}