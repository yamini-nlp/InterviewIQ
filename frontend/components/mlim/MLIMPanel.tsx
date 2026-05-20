"use client";
import { useState } from "react";
import { MLIMAnalysis } from "@/types/mlim";
import { ChevronDown, ChevronUp, Brain, Layers, Target, Zap, AlertTriangle } from "lucide-react";

interface Props {
  analysis: MLIMAnalysis | null;
  history: MLIMAnalysis[];
}

function Pill({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${active ? "bg-accent/20 border-accent/40 text-accent" : "bg-white/5 border-white/10 text-gray-500"}`}>
      {label}
    </span>
  );
}

function ScoreBar({ label, value, max = 1 }: { label: string; value: number; max?: number }) {
  const pct = (value / max) * 100;
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-[10px] text-gray-500">{label}</span>
        <span className="text-[10px] text-gray-300 font-mono">{value.toFixed(2)}</span>
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-accent/60 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function MLIMPanel({ analysis, history }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [activeLayer, setActiveLayer] = useState<"asl" | "pel" | "gstl" | "ifl">("ifl");

  if (!analysis) return null;

  const { asl, pel, gstl, ifl } = analysis;

  const failureColors: Record<string, string> = {
    none: "text-gray-500",
    affective_masking: "text-yellow-400",
    pragmatic_inversion: "text-orange-400",
    temporal_goal_drift: "text-red-400",
    role_ambiguity: "text-purple-400",
  };

  return (
    <div className="glass rounded-xl overflow-hidden transition-all duration-300">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-accent" />
          <span className="text-xs font-semibold text-white">MLIM Analysis</span>
          <span className={`text-[10px] font-mono ${failureColors[ifl.failure_mode_detected]}`}>
            {ifl.failure_mode_detected !== "none" ? `⚠ ${ifl.failure_mode_detected.replace(/_/g, " ")}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-accent">{ifl.intent_label.replace(/_/g, " ")}</span>
          {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/5 p-3 space-y-3 animate-fade-in">
          <div className="flex gap-1.5">
            {(["asl", "pel", "gstl", "ifl"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setActiveLayer(l)}
                className={`flex-1 text-[10px] py-1 rounded font-mono border transition-all ${
                  activeLayer === l ? "bg-accent/20 border-accent/40 text-accent" : "bg-white/5 border-white/10 text-gray-500 hover:text-gray-300"
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          {activeLayer === "asl" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Layers size={12} className="text-accent" />
                <span className="text-[11px] font-semibold text-gray-300">Layer 1 — Affective Signal</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-gray-500">Sentiment</span>
                  <p className="font-mono text-white">{asl.sentiment}</p>
                </div>
                <div>
                  <span className="text-gray-500">Uncertainty</span>
                  <p className="font-mono text-white">{asl.uncertainty_s.toFixed(3)}</p>
                </div>
              </div>
              <ScoreBar label="Confidence" value={asl.sentiment_confidence} />
              <ScoreBar label="Valence" value={(asl.valence + 1) / 2} />
              <ScoreBar label="Arousal" value={asl.arousal} />
              <div className="flex flex-wrap gap-1 mt-1">
                <Pill label="masking" active={asl.affective_masking_detected} />
              </div>
              {asl.affective_masking_detected && asl.masking_reason && (
                <p className="text-[10px] text-yellow-300 bg-yellow-400/5 border border-yellow-400/10 rounded p-1.5">
                  {asl.masking_reason}
                </p>
              )}
            </div>
          )}

          {activeLayer === "pel" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Layers size={12} className="text-accent" />
                <span className="text-[11px] font-semibold text-gray-300">Layer 2 — Pragmatic Encoding</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-gray-500">Speech Act</span>
                  <p className="font-mono text-white">{pel.primary_speech_act}</p>
                </div>
                <div>
                  <span className="text-gray-500">Confidence</span>
                  <p className="font-mono text-white">{pel.speech_act_confidence.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                <Pill label="sarcasm" active={pel.sarcasm_detected} />
                <Pill label="inversion" active={pel.pragmatic_inversion} />
                <Pill label="challenge↑" active={pel.is_requesting_challenge} />
                <Pill label="frustrated" active={pel.is_expressing_frustration} />
                <Pill label="confused" active={pel.is_signaling_confusion} />
                <Pill label="face-save" active={pel.is_face_saving} />
                <Pill label="validation" active={pel.is_seeking_validation} />
                <Pill label="retry" active={pel.is_committing_to_retry} />
              </div>
              {pel.gricean_implicature && (
                <div>
                  <p className="text-[9px] text-gray-500 mb-0.5">Gricean Implicature</p>
                  <p className="text-[10px] text-gray-300 italic">{pel.gricean_implicature}</p>
                </div>
              )}
            </div>
          )}

          {activeLayer === "gstl" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Target size={12} className="text-accent" />
                <span className="text-[11px] font-semibold text-gray-300">Layer 3 — Goal-State Tracking</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
                <div>
                  <span className="text-gray-500">Dominant Goal</span>
                  <p className="font-mono text-purple-300">{gstl.dominant_goal.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <span className="text-gray-500">Trajectory</span>
                  <p className="font-mono text-white">{gstl.session_trajectory}</p>
                </div>
              </div>
              {Object.entries(gstl.goal_belief_distribution).map(([goal, prob]) => (
                <div key={goal}>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[10px] text-gray-500">{goal.replace(/_/g, " ")}</span>
                    <span className="text-[10px] font-mono text-gray-300">{(prob * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500/60 rounded-full" style={{ width: `${prob * 100}%` }} />
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                <ScoreBar label="Stress" value={gstl.stress_indicators} />
                <ScoreBar label="Engagement" value={gstl.engagement_level} />
                <ScoreBar label="Readiness" value={gstl.readiness_estimate} />
              </div>
              {gstl.goal_drift_detected && (
                <div className="flex items-center gap-1 text-[10px] text-orange-300">
                  <AlertTriangle size={10} />
                  Goal drift detected — strategy may need adjustment
                </div>
              )}
              <p className="text-[10px] text-gray-500">
                Recommended: <span className="text-cyan-300">{gstl.recommended_system_action}</span>
              </p>
            </div>
          )}

          {activeLayer === "ifl" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={12} className="text-accent" />
                <span className="text-[11px] font-semibold text-gray-300">Layer 4 — Intent Fusion</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
                <div>
                  <span className="text-gray-500">Intent</span>
                  <p className="font-mono text-accent">{ifl.intent_label.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <span className="text-gray-500">Entropy H(î)</span>
                  <p className="font-mono text-cyan-300">{ifl.entropy.toFixed(4)}</p>
                </div>
              </div>
              {Object.entries(ifl.intent_distribution).map(([intent, prob]) => (
                <div key={intent}>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[10px] text-gray-500">{intent.replace(/_/g, " ")}</span>
                    <span className="text-[10px] font-mono text-gray-300">{(prob * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-accent/60 rounded-full" style={{ width: `${prob * 100}%` }} />
                  </div>
                </div>
              ))}
              {ifl.should_solicit_clarification && ifl.clarification_prompt && (
                <div className="bg-yellow-400/5 border border-yellow-400/20 rounded p-2 mt-1">
                  <p className="text-[9px] text-yellow-400 mb-0.5">HIGH ENTROPY — Suggested clarification:</p>
                  <p className="text-[10px] text-yellow-200 italic">{ifl.clarification_prompt}</p>
                </div>
              )}
              {ifl.failure_mode_detected !== "none" && (
                <div className="bg-orange-400/5 border border-orange-400/20 rounded p-2">
                  <p className="text-[9px] text-orange-400 mb-0.5">FAILURE MODE: {ifl.failure_mode_detected.replace(/_/g, " ").toUpperCase()}</p>
                  {ifl.failure_mode_explanation && (
                    <p className="text-[10px] text-orange-200">{ifl.failure_mode_explanation}</p>
                  )}
                </div>
              )}
              {ifl.intent_aware_response_modifier && (
                <p className="text-[10px] text-gray-500">
                  Response modifier: <span className="text-gray-300">{ifl.intent_aware_response_modifier}</span>
                </p>
              )}
            </div>
          )}

          {history.length > 1 && (
            <div className="border-t border-white/5 pt-2">
              <p className="text-[9px] text-gray-500 mb-1.5">Intent History ({history.length} turns)</p>
              <div className="flex flex-wrap gap-1">
                {history.slice(-8).map((h, i) => (
                  <span key={i} className="text-[9px] font-mono px-1 py-0.5 rounded bg-white/5 text-gray-400">
                    {h.ifl.intent_label.substring(0, 8)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}