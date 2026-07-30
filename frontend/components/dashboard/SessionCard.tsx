import { Session } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDate, scoreColor } from "@/lib/utils";
import { Clock, BarChart2, BrainCircuit } from "lucide-react";
import Link from "next/link";

export function SessionCard({ session }: { session: Session }) {
  return (
    <Card className="hover:border-accent/20 transition-all duration-300">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-display font-semibold text-white">{session.job_role}</p>
          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
            <Clock size={10} />{formatDate(session.created_at)}
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-lg ${session.mode === "practice" ? "bg-blue-500/15 text-blue-400" : "bg-purple-500/15 text-purple-400"}`}>
          {session.mode}
        </span>
      </div>
      {session.overall_score !== undefined && (
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 size={12} className="text-gray-500" />
          <span className={`text-sm font-bold ${scoreColor(session.overall_score)}`}>{session.overall_score}/10</span>
          <span className="text-xs text-gray-500">overall score</span>
        </div>
      )}
      {session.completed_at && (
        <Link href={`/report/${session.id}`}>
          <Button variant="outline" size="sm" className="w-full">View Report</Button>
        </Link>
      )}
      <Link href={`/dashboard/mlim?session=${session.id}`}>
        <Button variant="ghost" size="sm" className="w-full mt-2">
          <BrainCircuit size={12} /> MLIM Analytics
        </Button>
      </Link>
    </Card>
  );
}