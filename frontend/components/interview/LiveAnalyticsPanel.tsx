"use client";
import { MLIMAnalysis } from "@/types/mlim";

interface FaceData {
  dominantExpression: string;
  expressions: Record<string, number>;
  confidence: number;
}

interface Props {
  mlimAnalysis?: MLIMAnalysis | null;
  mlimAnalyzing?: boolean;
  faceData?: FaceData | null;
  currentQuestionIndex: number;
  totalQuestions: number;
  integrityScore: number;
  tabSwitches: number;
  windowBlurs: number;
  copyPastes: number;
  suspended?: boolean;
}

const EC: Record<string, string> = { happy: "#10b981", sad: "#60a5fa", angry: "#ef4444", fearful: "#f59e0b", disgusted: "#a855f7", surprised: "#06b6d4", neutral: "#9ca3af" };
const IC: Record<string, string> = { genuine_answer: "#10b981", face_saving_assertion: "#f59e0b", request_for_challenge: "#60a5fa", expressing_confusion: "#fb923c", sarcastic_response: "#ef4444", seeking_validation: "#a855f7", committed_retry: "#06b6d4", off_topic: "#9ca3af" };

function ec(e: string) { return EC[e] || "#9ca3af"; }
function ic(l: string) { return IC[l] || "#a78bfa"; }
function sc(s: string) { return s === "positive" ? "#10b981" : s === "negative" ? "#ef4444" : "#9ca3af"; }
function tc(t: string) { return t === "improving" ? "#10b981" : t === "declining" ? "#ef4444" : t === "volatile" ? "#f59e0b" : "#9ca3af"; }

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-[9px] text-gray-500 font-mono uppercase tracking-wide">{label}</span>
        <span className="text-[9px] font-mono font-bold" style={{ color }}>{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(value * 100, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function Sec({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-[8px] font-mono text-gray-600 uppercase tracking-widest">{title}</span>
      <div className="flex-1 h-px bg-white/5" />
    </div>
  );
}

export function LiveAnalyticsPanel({ mlimAnalysis, mlimAnalyzing, faceData, currentQuestionIndex, totalQuestions, integrityScore, tabSwitches, windowBlurs, copyPastes, suspended }: Props) {
  const a = mlimAnalysis;

  return (
    <div className="h-full overflow-y-auto space-y-2.5 pr-0.5" style={{ scrollbarWidth: "thin", scrollbarColor: "#2e3447 transparent" }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Live Analytics</span>
        <div className="flex items-center gap-2">
          {suspended && <span className="text-[8px] text-red-400 font-mono bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">SUSPENDED</span>}
          {mlimAnalyzing && (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-[8px] text-accent font-mono">LIVE</span>
            </div>
          )}
        </div>
      </div>

      <div className="glass rounded-xl p-2.5 space-y-1.5">
        <Sec title="Progress" />
        <div className="flex justify-between">
          <span className="text-[9px] text-gray-500 font-mono">QUESTION</span>
          <span className="text-[9px] font-bold text-white font-mono">{currentQuestionIndex + 1} / {totalQuestions}</span>
        </div>
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-600 to-accent rounded-full transition-all duration-500" style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }} />
        </div>
      </div>

      {faceData && (
        <div className="glass rounded-xl p-2.5 space-y-1.5">
          <Sec title="Facial" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold font-mono uppercase" style={{ color: ec(faceData.dominantExpression) }}>{faceData.dominantExpression}</span>
            <span className="text-[8px] text-gray-600 font-mono">{(faceData.confidence * 100).toFixed(0)}%</span>
          </div>
          <div className="space-y-1">
            {Object.entries(faceData.expressions).filter(([, v]) => v > 0.04).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([expr, val]) => (
              <Bar key={expr} label={expr} value={val} color={ec(expr)} />
            ))}
          </div>
        </div>
      )}

      {a ? (
        <>
          <div className="glass rounded-xl p-2.5 space-y-1.5">
            <Sec title="Affective (ASL)" />
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-gray-500 font-mono">SENTIMENT</span>
              <span className="text-[10px] font-bold font-mono uppercase" style={{ color: sc(a.asl.sentiment) }}>{a.asl.sentiment}</span>
            </div>
            <Bar label="Sentiment Conf." value={a.asl.sentiment_confidence} color={sc(a.asl.sentiment)} />
            <Bar label="Valence" value={(a.asl.valence + 1) / 2} color={a.asl.valence > 0 ? "#10b981" : "#ef4444"} />
            <Bar label="Arousal" value={(a.asl.arousal + 1) / 2} color="#a78bfa" />
            <Bar label="Uncertainty" value={a.asl.uncertainty_s} color="#f59e0b" />
            {a.asl.affective_masking_detected && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 mt-1">
                <span className="text-[8px] text-amber-400 font-mono">⚠ AFFECTIVE MASKING</span>
              </div>
            )}
          </div>

          <div className="glass rounded-xl p-2.5 space-y-1.5">
            <Sec title="Pragmatic (PEL)" />
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-gray-500 font-mono">SPEECH ACT</span>
              <span className="text-[9px] font-bold font-mono text-blue-300">{a.pel.primary_speech_act.replace(/_/g, " ")}</span>
            </div>
            <Bar label="Confidence" value={a.pel.speech_act_confidence} color="#60a5fa" />
            <div className="flex flex-wrap gap-1 pt-0.5">
              {a.pel.sarcasm_detected && <span className="text-[7px] bg-red-500/15 text-red-400 border border-red-500/20 px-1 py-0.5 rounded font-mono">SARCASM</span>}
              {a.pel.pragmatic_inversion && <span className="text-[7px] bg-amber-500/15 text-amber-400 border border-amber-500/20 px-1 py-0.5 rounded font-mono">INVERSION</span>}
              {a.pel.is_face_saving && <span className="text-[7px] bg-purple-500/15 text-purple-400 border border-purple-500/20 px-1 py-0.5 rounded font-mono">FACE-SAVING</span>}
              {a.pel.is_seeking_validation && <span className="text-[7px] bg-blue-500/15 text-blue-400 border border-blue-500/20 px-1 py-0.5 rounded font-mono">VALIDATION</span>}
              {a.pel.is_expressing_frustration && <span className="text-[7px] bg-orange-500/15 text-orange-400 border border-orange-500/20 px-1 py-0.5 rounded font-mono">FRUSTRATION</span>}
              {a.pel.is_signaling_confusion && <span className="text-[7px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 px-1 py-0.5 rounded font-mono">CONFUSION</span>}
            </div>
          </div>

          <div className="glass rounded-xl p-2.5 space-y-1.5">
            <Sec title="Goal State (GSTL)" />
            <Bar label="Engagement" value={a.gstl.engagement_level} color="#60a5fa" />
            <Bar label="Stress" value={a.gstl.stress_indicators} color={a.gstl.stress_indicators > 0.6 ? "#ef4444" : "#f59e0b"} />
            <Bar label="Readiness" value={a.gstl.readiness_estimate} color="#10b981" />
            <Bar label="Confidence" value={a.gstl.confidence_level} color="#a78bfa" />
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-[9px] text-gray-500 font-mono">TRAJECTORY</span>
              <span className="text-[9px] font-bold font-mono uppercase" style={{ color: tc(a.gstl.session_trajectory) }}>{a.gstl.session_trajectory.replace(/_/g, " ")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-gray-500 font-mono">GOAL</span>
              <span className="text-[9px] text-purple-300 font-mono">{a.gstl.dominant_goal.replace(/_/g, " ")}</span>
            </div>
            {a.gstl.goal_drift_detected && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded px-2 py-1">
                <span className="text-[8px] text-orange-400 font-mono">⚠ GOAL DRIFT</span>
              </div>
            )}
            <div className="pt-0.5 space-y-1">
              {Object.entries(a.gstl.goal_belief_distribution).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([g, p]) => (
                <div key={g}>
                  <div className="flex justify-between">
                    <span className="text-[8px] text-gray-600 font-mono truncate max-w-[68%]">{g.replace(/_/g, " ")}</span>
                    <span className="text-[8px] font-mono text-gray-400">{(p * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${p * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-xl p-2.5 space-y-1.5">
            <Sec title="Intent (IFL)" />
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-gray-500 font-mono">INTENT</span>
              <span className="text-[9px] font-bold font-mono uppercase" style={{ color: ic(a.ifl.intent_label) }}>{a.ifl.intent_label.replace(/_/g, " ")}</span>
            </div>
            <Bar label="Intent Conf." value={a.ifl.intent_confidence} color={ic(a.ifl.intent_label)} />
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-gray-500 font-mono">ENTROPY</span>
              <span className="text-[9px] font-mono" style={{ color: a.ifl.entropy > 1.5 ? "#f59e0b" : "#9ca3af" }}>{a.ifl.entropy.toFixed(3)}</span>
            </div>
            {a.ifl.failure_mode_detected !== "none" && (
              <div className="bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
                <span className="text-[8px] text-red-400 font-mono uppercase">⚠ {a.ifl.failure_mode_detected.replace(/_/g, " ")}</span>
              </div>
            )}
            {a.ifl.should_solicit_clarification && a.ifl.clarification_prompt && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded px-2 py-1">
                <span className="text-[8px] text-blue-400 font-mono">CLARIFY: {a.ifl.clarification_prompt.slice(0, 60)}</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-[9px] text-gray-600 font-mono">MLIM analytics appear after first answer</p>
        </div>
      )}

      <div className={`glass rounded-xl p-2.5 space-y-1.5 ${integrityScore < 70 ? "border border-red-500/20 bg-red-500/5" : ""}`}>
        <Sec title="Integrity" />
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-gray-500 font-mono">SCORE</span>
          <span className="text-[11px] font-bold font-mono" style={{ color: integrityScore > 80 ? "#10b981" : integrityScore > 60 ? "#f59e0b" : "#ef4444" }}>{integrityScore}%</span>
        </div>
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${integrityScore}%`, backgroundColor: integrityScore > 80 ? "#10b981" : integrityScore > 60 ? "#f59e0b" : "#ef4444" }} />
        </div>
        {tabSwitches > 0 && <p className="text-[8px] text-gray-500 font-mono">Tab switches: <span className="text-red-400">{tabSwitches}</span></p>}
        {windowBlurs > 0 && <p className="text-[8px] text-gray-500 font-mono">Focus lost: <span className="text-orange-400">{windowBlurs}</span></p>}
        {copyPastes > 0 && <p className="text-[8px] text-gray-500 font-mono">Copy/paste: <span className="text-red-400">{copyPastes}</span></p>}
      </div>
    </div>
  );
}