"use client";
import { useEffect, useState } from "react";
import { getMLIMSessionSummary } from "@/lib/mlim-api";
import { MLIMSessionSummary } from "@/types/mlim";
import { Brain, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

interface Props {
  sessionId: string;
}

function ScoreArc({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  const color = pct > 0.7 ? "#10b981" : pct > 0.4 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
        <circle
          cx="32" cy="32" r="26" fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={`${pct * 163.4} 163.4`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-mono font-bold" style={{ color }}>{(pct * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

function trajectoryIcon(t: string) {
  if (t === "improving") return <TrendingUp size={14} className="text-emerald-400" />;
  if (t === "declining") return <TrendingDown size={14} className="text-red-400" />;
  return <Minus size={14} className="text-gray-400" />;
}

const FAILURE_MODE_DESCRIPTIONS: Record<string, string> = {
  affective_masking: "Your surface expressions didn't match your underlying intent in some answers — the system detected you may have presented positively while experiencing uncertainty.",
  pragmatic_inversion: "Some answers used irony or sarcasm, where literal sentiment was inverted by pragmatic context.",
  temporal_goal_drift: "Your goals appeared to shift during the session, suggesting changing confidence or strategy.",
  role_ambiguity: "Some answers carried multiple simultaneous speech act roles, creating intent ambiguity.",
};

const INTENT_DESCRIPTIONS: Record<string, string> = {
  genuine_answer: "Straightforward response to the question",
  face_saving_assertion: "Positive framing that may mask uncertainty",
  request_for_challenge: "Implicit signal wanting harder questions",
  expressing_confusion: "Uncertainty about the question or domain",
  sarcastic_response: "Ironic or inverted sentiment",
  seeking_validation: "Looking for confirmation rather than evaluation",
  committed_retry: "Committed to improving on this area",
  off_topic: "Response drifted from the question",
};

export function MLIMReportSection({ sessionId }: Props) {
  const [summary, setSummary] = useState<MLIMSessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getMLIMSessionSummary(sessionId)
      .then(setSummary)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="glass rounded-2xl p-6 flex items-center gap-3">
        <Loader2 size={16} className="animate-spin text-accent" />
        <span className="text-sm text-gray-400">Loading MLIM intent analysis...</span>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="glass rounded-2xl p-4 text-sm text-gray-500">
        MLIM analysis not available for this session.
      </div>
    );
  }

  const dominantIntents = Object.entries(summary.dominant_intent_distribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="glass rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Brain size={18} className="text-accent" />
        <h2 className="text-base font-semibold text-white">MLIM Intent Analysis</h2>
        <span className="text-xs text-gray-500 ml-auto font-mono">{summary.total_analyses} turns analyzed</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white/3 rounded-xl p-3 flex items-center gap-3">
          <ScoreArc value={summary.readiness_estimate} />
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Readiness</p>
            <p className="text-xs text-white font-mono">{(summary.readiness_estimate * 100).toFixed(0)}%</p>
          </div>
        </div>
        <div className="bg-white/3 rounded-xl p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Trajectory</p>
          <div className="flex items-center gap-1.5">
            {trajectoryIcon(summary.session_trajectory)}
            <span className="text-xs text-white font-mono">{summary.session_trajectory}</span>
          </div>
        </div>
        <div className="bg-white/3 rounded-xl p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Avg Entropy</p>
          <p className="text-xs text-cyan-300 font-mono">{summary.average_entropy.toFixed(3)}</p>
          <p className="text-[9px] text-gray-600">intent uncertainty</p>
        </div>
        <div className="bg-white/3 rounded-xl p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Anomalies</p>
          <div className="space-y-0.5">
            {summary.affective_masking_count > 0 && (
              <p className="text-[10px] text-yellow-400">{summary.affective_masking_count}× masking</p>
            )}
            {summary.sarcasm_count > 0 && (
              <p className="text-[10px] text-red-400">{summary.sarcasm_count}× sarcasm</p>
            )}
            {summary.goal_drift_count > 0 && (
              <p className="text-[10px] text-orange-400">{summary.goal_drift_count}× goal drift</p>
            )}
            {summary.affective_masking_count === 0 && summary.sarcasm_count === 0 && summary.goal_drift_count === 0 && (
              <p className="text-[10px] text-emerald-400">None detected</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Intent Distribution Across Session</p>
        <div className="space-y-2">
          {dominantIntents.map(([intent, prob]) => (
            <div key={intent}>
              <div className="flex justify-between items-center mb-1">
                <div>
                  <span className="text-xs text-gray-300">{intent.replace(/_/g, " ")}</span>
                  {INTENT_DESCRIPTIONS[intent] && (
                    <span className="text-[9px] text-gray-600 ml-2">{INTENT_DESCRIPTIONS[intent]}</span>
                  )}
                </div>
                <span className="text-xs font-mono text-gray-400">{(prob * 100).toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-accent/60 rounded-full" style={{ width: `${prob * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {summary.failure_modes_detected.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">MLIM Failure Modes Detected</p>
          <div className="space-y-2">
            {summary.failure_modes_detected.map((fm) => (
              <div key={fm} className="bg-yellow-400/5 border border-yellow-400/15 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={12} className="text-yellow-400" />
                  <span className="text-xs font-semibold text-yellow-300">{fm.replace(/_/g, " ")}</span>
                </div>
                <p className="text-[11px] text-gray-400">{FAILURE_MODE_DESCRIPTIONS[fm] || fm}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.failure_modes_detected.length === 0 && (
        <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3">
          <CheckCircle size={14} className="text-emerald-400" />
          <p className="text-xs text-emerald-300">No MLIM failure modes detected — intent signals were consistent throughout.</p>
        </div>
      )}

      {summary.recommended_actions.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Recommended Development Areas</p>
          <div className="flex flex-wrap gap-1.5">
            {summary.recommended_actions.map((action) => (
              <span key={action} className="text-[10px] px-2 py-1 rounded-lg bg-accent/10 border border-accent/20 text-accent font-mono">
                {action.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-gray-600 border-t border-white/5 pt-3">
        MLIM (Multi-Layer Intent Modeling) — Layer 1: Affective Signal (ASL) · Layer 2: Pragmatic Encoding (PEL) · Layer 3: Goal-State Tracking (GSTL) · Layer 4: Intent Fusion (IFL)
      </p>
    </div>
  );
}