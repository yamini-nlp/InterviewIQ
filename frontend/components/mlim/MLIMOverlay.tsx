"use client";
import { MLIMAnalysis } from "@/types/mlim";
import { Brain, AlertTriangle, Target, Zap, TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";

interface Props {
  analysis: MLIMAnalysis | null;
  isAnalyzing: boolean;
}

function MiniBar({ value, color = "accent" }: { value: number; color?: string }) {
  const colorMap: Record<string, string> = {
    accent: "bg-accent",
    green: "bg-emerald-500",
    yellow: "bg-yellow-400",
    red: "bg-red-400",
    blue: "bg-blue-400",
  };
  return (
    <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${colorMap[color] || "bg-accent"}`}
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
      />
    </div>
  );
}

function sentimentColor(s: string) {
  if (s === "positive") return "text-emerald-400";
  if (s === "negative") return "text-red-400";
  return "text-gray-400";
}

function trajectoryIcon(t: string) {
  if (t === "improving") return <TrendingUp size={10} className="text-emerald-400" />;
  if (t === "declining") return <TrendingDown size={10} className="text-red-400" />;
  return <Minus size={10} className="text-gray-400" />;
}

function speechActBadge(act: string) {
  const map: Record<string, string> = {
    directive: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    expressive: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    commissive: "bg-green-500/20 text-green-300 border-green-500/30",
    representative: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    declarative: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  };
  return map[act] || "bg-white/10 text-gray-300 border-white/10";
}

function intentColor(label: string) {
  const map: Record<string, string> = {
    genuine_answer: "text-emerald-400",
    face_saving_assertion: "text-yellow-400",
    request_for_challenge: "text-blue-400",
    expressing_confusion: "text-orange-400",
    sarcastic_response: "text-red-400",
    seeking_validation: "text-purple-400",
    committed_retry: "text-cyan-400",
    off_topic: "text-gray-400",
  };
  return map[label] || "text-gray-400";
}

export function MLIMOverlay({ analysis, isAnalyzing }: Props) {
  if (isAnalyzing) {
    return (
      <div className="absolute inset-0 pointer-events-none flex items-end">
        <div className="w-full bg-black/80 backdrop-blur-sm p-2 border-t border-accent/20">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] text-accent font-mono">MLIM ANALYZING...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const { asl, pel, gstl, ifl } = analysis;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between">
      <div className="bg-gradient-to-b from-black/70 to-transparent p-2">
        <div className="flex items-center gap-1.5">
          <Brain size={10} className="text-accent" />
          <span className="text-[10px] text-accent font-mono font-bold">MLIM ACTIVE</span>
          <div className="ml-auto flex items-center gap-1">
            {ifl.failure_mode_detected !== "none" && (
              <AlertTriangle size={10} className="text-yellow-400" />
            )}
            {asl.affective_masking_detected && (
              <span className="text-[9px] text-yellow-300 bg-yellow-400/10 border border-yellow-400/20 px-1 rounded">MASK</span>
            )}
            {pel.sarcasm_detected && (
              <span className="text-[9px] text-red-300 bg-red-400/10 border border-red-400/20 px-1 rounded">SARC</span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-t from-black/85 to-transparent p-2 space-y-1.5">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <div>
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-[9px] text-gray-500 font-mono">SENTIMENT</span>
              <span className={`text-[9px] font-mono ${sentimentColor(asl.sentiment)}`}>
                {asl.sentiment.toUpperCase()}
              </span>
            </div>
            <MiniBar value={asl.sentiment_confidence} color="accent" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-[9px] text-gray-500 font-mono">VALENCE</span>
              <span className="text-[9px] font-mono text-gray-300">{asl.valence.toFixed(2)}</span>
            </div>
            <MiniBar value={(asl.valence + 1) / 2} color={asl.valence > 0 ? "green" : "red"} />
          </div>
          <div>
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-[9px] text-gray-500 font-mono">AROUSAL</span>
              <span className="text-[9px] font-mono text-gray-300">{asl.arousal.toFixed(2)}</span>
            </div>
            <MiniBar value={asl.arousal} color="yellow" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-[9px] text-gray-500 font-mono">ENGAGEMENT</span>
              <span className="text-[9px] font-mono text-gray-300">{gstl.engagement_level.toFixed(2)}</span>
            </div>
            <MiniBar value={gstl.engagement_level} color="blue" />
          </div>
        </div>

        <div className="border-t border-white/5 pt-1 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Zap size={9} className="text-accent" />
            <span className="text-[9px] text-gray-400 font-mono">INTENT:</span>
            <span className={`text-[9px] font-mono font-bold ${intentColor(ifl.intent_label)}`}>
              {ifl.intent_label.replace(/_/g, " ").toUpperCase()}
            </span>
          </div>
          <span className={`text-[9px] font-mono border px-1 rounded ${speechActBadge(pel.primary_speech_act)}`}>
            {pel.primary_speech_act.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Target size={9} className="text-purple-400" />
            <span className="text-[9px] text-gray-500 font-mono">GOAL:</span>
            <span className="text-[9px] text-purple-300 font-mono">
              {gstl.dominant_goal.replace(/_/g, " ")}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {trajectoryIcon(gstl.session_trajectory)}
            <span className="text-[9px] text-gray-400 font-mono">{gstl.session_trajectory}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Activity size={9} className="text-cyan-400" />
          <span className="text-[9px] text-gray-500 font-mono">ENTROPY:</span>
          <span className="text-[9px] text-cyan-300 font-mono">{ifl.entropy.toFixed(3)}</span>
          <span className="text-[9px] text-gray-500 font-mono ml-1">READINESS:</span>
          <span className="text-[9px] text-green-300 font-mono">{(gstl.readiness_estimate * 100).toFixed(0)}%</span>
          {ifl.should_solicit_clarification && (
            <span className="text-[9px] text-yellow-300 bg-yellow-400/10 border border-yellow-400/20 px-1 rounded ml-auto">CLARIFY?</span>
          )}
        </div>

        {gstl.goal_drift_detected && (
          <div className="flex items-center gap-1 bg-orange-500/10 border border-orange-500/20 rounded px-1.5 py-0.5">
            <AlertTriangle size={9} className="text-orange-400" />
            <span className="text-[9px] text-orange-300 font-mono">GOAL DRIFT DETECTED</span>
          </div>
        )}
      </div>
    </div>
  );
}