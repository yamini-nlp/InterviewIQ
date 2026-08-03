"use client";
import { ReactNode } from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  LabelList,
} from "recharts";
import { MLIMAnalysis } from "@/types/mlim";

const CHART_EMPTY_MESSAGE = "No MLIM data yet for this session";
const AXIS_TICK_STYLE = { fill: "rgb(var(--color-neutral-500))", fontSize: 11 };
const AXIS_LABEL_STYLE = { fill: "rgb(var(--color-neutral-600))", fontSize: 11 };
const AXIS_STROKE = "rgba(128,128,128,0.3)";
const GRID_STROKE = "rgba(128,128,128,0.15)";
const TOOLTIP_STYLE = {
  backgroundColor: "rgb(var(--color-neutral-100))",
  border: "1px solid rgb(var(--color-neutral-900) / 0.1)",
  borderRadius: 8,
  color: "rgb(var(--color-neutral-900))",
};

interface ChartFrameProps {
  title: string;
  loading: boolean;
  isEmpty: boolean;
  height: number;
  children: ReactNode;
}

function ChartSkeleton({ height }: { height: number }) {
  return <div className="w-full rounded-xl bg-neutral-200 animate-pulse" style={{ height }} />;
}

function ChartFrame({ title, loading, isEmpty, height, children }: ChartFrameProps) {
  return (
    <div className="glass rounded-2xl p-6">
      <h3 className="font-display text-sm font-semibold text-neutral-900 mb-4">{title}</h3>
      {loading ? (
        <ChartSkeleton height={height} />
      ) : isEmpty ? (
        <div className="w-full flex items-center justify-center text-sm text-neutral-500" style={{ height }}>
          {CHART_EMPTY_MESSAGE}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

interface MLIMChartProps {
  analyses: MLIMAnalysis[];
  loading?: boolean;
}

interface ValenceArousalPoint {
  x: number;
  y: number;
  turn: number;
  sentiment: "positive" | "negative" | "neutral";
}

const SENTIMENT_COLORS: Record<"positive" | "negative" | "neutral", string> = {
  positive: "#10b981",
  negative: "#ef4444",
  neutral: "#9ca3af",
};

const SENTIMENT_KEYS: Array<"positive" | "negative" | "neutral"> = ["positive", "negative", "neutral"];

export function ValenceArousalPlot({ analyses, loading = false }: MLIMChartProps) {
  const bySentiment: Record<"positive" | "negative" | "neutral", ValenceArousalPoint[]> = {
    positive: [],
    negative: [],
    neutral: [],
  };

  analyses.forEach((a, index) => {
    bySentiment[a.asl.sentiment].push({
      x: a.asl.valence,
      y: a.asl.arousal,
      turn: index + 1,
      sentiment: a.asl.sentiment,
    });
  });

  return (
    <ChartFrame
      title="Valence–Arousal Circumplex"
      loading={loading}
      isEmpty={analyses.length === 0}
      height={320}
    >
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid stroke={GRID_STROKE} />
          <XAxis
            type="number"
            dataKey="x"
            domain={[-1, 1]}
            tick={AXIS_TICK_STYLE}
            stroke={AXIS_STROKE}
            label={{ value: "Valence", position: "insideBottom", offset: -10, style: AXIS_LABEL_STYLE }}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, 1]}
            tick={AXIS_TICK_STYLE}
            stroke={AXIS_STROKE}
            label={{ value: "Arousal", angle: -90, position: "insideLeft", style: AXIS_LABEL_STYLE }}
          />
          <ZAxis range={[70, 70]} />
          <ReferenceLine x={0} stroke={AXIS_STROKE} />
          <ReferenceLine y={0.5} stroke={AXIS_STROKE} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {SENTIMENT_KEYS.map((sentiment) =>
            bySentiment[sentiment].length > 0 ? (
              <Scatter
                key={sentiment}
                name={sentiment}
                data={bySentiment[sentiment]}
                fill={SENTIMENT_COLORS[sentiment]}
              />
            ) : null
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

interface GoalBeliefRow {
  turn: number;
  [goal: string]: number;
}

const GOAL_COLORS: Record<string, string> = {
  demonstrate_competence: "#6c63ff",
  seek_feedback: "#60a5fa",
  pass_screening: "#10b981",
  build_confidence: "#f59e0b",
  explore_role: "#ec4899",
};

const FALLBACK_GOAL_COLORS = ["#6c63ff", "#60a5fa", "#10b981", "#f59e0b", "#ec4899", "#a855f7", "#06b6d4"];

export function GoalBeliefAreaChart({ analyses, loading = false }: MLIMChartProps) {
  const goalKeySet = new Set<string>();
  analyses.forEach((a) => {
    Object.keys(a.gstl.goal_belief_distribution).forEach((key) => goalKeySet.add(key));
  });
  const goalKeys = Array.from(goalKeySet).sort();

  const data: GoalBeliefRow[] = analyses.map((a, index) => {
    const row: GoalBeliefRow = { turn: index + 1 };
    goalKeys.forEach((key) => {
      row[key] = a.gstl.goal_belief_distribution[key] ?? 0;
    });
    return row;
  });

  return (
    <ChartFrame
      title="Goal Belief Distribution Over Time"
      loading={loading}
      isEmpty={analyses.length === 0}
      height={320}
    >
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid stroke={GRID_STROKE} />
          <XAxis
            dataKey="turn"
            tick={AXIS_TICK_STYLE}
            stroke={AXIS_STROKE}
            label={{ value: "Turn", position: "insideBottom", offset: -10, style: AXIS_LABEL_STYLE }}
          />
          <YAxis domain={[0, 1]} tick={AXIS_TICK_STYLE} stroke={AXIS_STROKE} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {goalKeys.map((key, i) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stackId="goals"
              stroke={GOAL_COLORS[key] ?? FALLBACK_GOAL_COLORS[i % FALLBACK_GOAL_COLORS.length]}
              fill={GOAL_COLORS[key] ?? FALLBACK_GOAL_COLORS[i % FALLBACK_GOAL_COLORS.length]}
              fillOpacity={0.35}
              name={key.replace(/_/g, " ")}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

interface EntropyPoint {
  turn: number;
  entropy: number;
}

const CLARIFICATION_ENTROPY_THRESHOLD = 1.5;

export function EntropyLineChart({ analyses, loading = false }: MLIMChartProps) {
  const data: EntropyPoint[] = analyses.map((a, index) => ({
    turn: index + 1,
    entropy: a.ifl.entropy,
  }));

  return (
    <ChartFrame
      title="Intent Entropy Over Time"
      loading={loading}
      isEmpty={analyses.length === 0}
      height={280}
    >
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid stroke={GRID_STROKE} />
          <XAxis
            dataKey="turn"
            tick={AXIS_TICK_STYLE}
            stroke={AXIS_STROKE}
            label={{ value: "Turn", position: "insideBottom", offset: -10, style: AXIS_LABEL_STYLE }}
          />
          <YAxis tick={AXIS_TICK_STYLE} stroke={AXIS_STROKE} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <ReferenceLine
            y={CLARIFICATION_ENTROPY_THRESHOLD}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{ value: "Clarification threshold", position: "right", fill: "#f59e0b", fontSize: 10 }}
          />
          <Line type="monotone" dataKey="entropy" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} name="Entropy" />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

interface FailureModePoint {
  turn: number;
  active: number;
  mode: string;
}

const FAILURE_MODE_COLORS: Record<string, string> = {
  topic_drift: "#f59e0b",
  unresolved_sarcasm_ambiguity: "#ef4444",
  goal_intent_mismatch: "#a855f7",
  high_ambiguity: "#60a5fa",
};

export function FailureModeTimeline({ analyses, loading = false }: MLIMChartProps) {
  const data: FailureModePoint[] = analyses.map((a, index) => ({
    turn: index + 1,
    active: a.ifl.failure_mode_detected !== "none" ? 1 : 0,
    mode: a.ifl.failure_mode_detected,
  }));

  return (
    <ChartFrame
      title="Failure Mode Timeline"
      loading={loading}
      isEmpty={analyses.length === 0}
      height={260}
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid stroke={GRID_STROKE} />
          <XAxis
            dataKey="turn"
            tick={AXIS_TICK_STYLE}
            stroke={AXIS_STROKE}
            label={{ value: "Turn", position: "insideBottom", offset: -10, style: AXIS_LABEL_STYLE }}
          />
          <YAxis domain={[0, 1]} ticks={[0, 1]} tick={AXIS_TICK_STYLE} stroke={AXIS_STROKE} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="active" name="Failure detected">
            <LabelList
              dataKey="mode"
              position="top"
              formatter={(value: string | number) => {
                const mode = String(value);
                return mode === "none" ? "" : mode.replace(/_/g, " ");
              }}
              fill="rgb(var(--color-neutral-500))"
              fontSize={9}
            />
            {data.map((point) => (
              <Cell
                key={point.turn}
                fill={point.active === 1 ? FAILURE_MODE_COLORS[point.mode] ?? "#ef4444" : "rgba(128,128,128,0.15)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}