"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/Button";
import { useSessionAnalyses } from "@/hooks/useMLIM";
import {
  ValenceArousalPlot,
  GoalBeliefAreaChart,
  EntropyLineChart,
  FailureModeTimeline,
} from "@/components/mlim/MLIMAnalyticsCharts";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

function MLIMDashboardContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const { analyses, loading, error } = useSessionAnalyses(sessionId);

  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="pt-24 pb-16 px-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold">MLIM Analytics</h1>
            <p className="text-neutral-500 mt-1">
              {sessionId ? `Session ${sessionId}` : "Select a session to view MLIM analytics"}
            </p>
          </div>
          <Link href="/dashboard">
            <Button variant="outline" size="sm">Back to Dashboard</Button>
          </Link>
        </div>

        {!sessionId ? (
          <div className="glass rounded-2xl p-6 flex items-center gap-3 text-sm text-neutral-500">
            <AlertTriangle size={16} className="text-warning-500" />
            No session selected. Choose a session from the dashboard to view its MLIM analytics.
          </div>
        ) : error ? (
          <div className="glass rounded-2xl p-6 flex items-center gap-3 text-sm text-error-500">
            <AlertTriangle size={16} />
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            <ValenceArousalPlot analyses={analyses} loading={loading} />
            <GoalBeliefAreaChart analyses={analyses} loading={loading} />
            <EntropyLineChart analyses={analyses} loading={loading} />
            <FailureModeTimeline analyses={analyses} loading={loading} />
          </div>
        )}
      </main>
    </div>
  );
}

export default function MLIMDashboardPage() {
  return (
    <Suspense fallback={null}>
      <MLIMDashboardContent />
    </Suspense>
  );
}