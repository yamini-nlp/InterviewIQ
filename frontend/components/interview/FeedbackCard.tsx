"use client";
import { useState } from "react";
import { Feedback } from "@/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, Progress } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { CheckCircle2, XCircle, Lightbulb, TrendingUp, ChevronDown } from "lucide-react";
import { cn, scoreColor } from "@/lib/utils";

interface FeedbackCardProps {
  feedback: Feedback | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function CollapsibleSection({
  title,
  icon,
  accentClass,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  accentClass: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between gap-2 text-xs font-medium mb-2 group",
          accentClass
        )}
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5">
          {icon}
          {title}
        </span>
        <ChevronDown
          size={14}
          className={cn("transition-transform duration-200 text-neutral-400", open && "rotate-180")}
        />
      </button>
      {open && children}
    </div>
  );
}

export function FeedbackCard({ feedback, loading = false, error = null, onRetry }: FeedbackCardProps) {
  if (loading) {
    return (
      <Card className="space-y-5 border-white/8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton width={90} height={22} rounded="full" />
            <Skeleton width={56} height={28} />
          </div>
          <Skeleton width={128} height={10} rounded="full" />
        </div>
        <div className="space-y-2">
          <Skeleton width={100} height={12} />
          <Skeleton height={14} />
          <Skeleton height={14} width="80%" />
        </div>
        <div className="space-y-2">
          <Skeleton width={120} height={12} />
          <Skeleton height={14} />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-white/8">
        <ErrorState message={error} onRetry={onRetry} retryLabel="Retry feedback" />
      </Card>
    );
  }

  if (!feedback) return null;

  return (
    <Card className="animate-slide-up space-y-5 border-white/8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge text={feedback.correctness} type="correctness" />
          <span className={`font-display text-2xl font-bold ${scoreColor(feedback.score)}`}>
            {feedback.score}
            <span className="text-sm font-normal text-neutral-500">/10</span>
          </span>
        </div>
        <Progress value={feedback.score} max={10} size="sm" className="w-32" />
      </div>

      {feedback.strengths.length > 0 && (
        <CollapsibleSection
          title="Strengths"
          icon={<CheckCircle2 size={12} />}
          accentClass="text-success-400"
          defaultOpen
        >
          <ul className="space-y-1">
            {feedback.strengths.map((s, i) => (
              <li key={i} className="text-sm text-neutral-300 flex gap-2">
                <span className="text-success-500 mt-0.5">•</span>
                {s}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {feedback.weaknesses.length > 0 && (
        <CollapsibleSection
          title="Areas to Improve"
          icon={<XCircle size={12} />}
          accentClass="text-error-400"
          defaultOpen
        >
          <ul className="space-y-1">
            {feedback.weaknesses.map((w, i) => (
              <li key={i} className="text-sm text-neutral-300 flex gap-2">
                <span className="text-error-500 mt-0.5">•</span>
                {w}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title="Ideal Answer"
        icon={<Lightbulb size={12} />}
        accentClass="text-primary-400"
        defaultOpen={false}
      >
        <div className="bg-white/3 rounded-xl p-4 border border-white/5">
          <p className="text-sm text-neutral-300 leading-relaxed">{feedback.ideal_answer}</p>
        </div>
      </CollapsibleSection>

      {feedback.suggestions.length > 0 && (
        <CollapsibleSection
          title="Suggestions"
          icon={<TrendingUp size={12} />}
          accentClass="text-warning-400"
          defaultOpen={false}
        >
          <ul className="space-y-1">
            {feedback.suggestions.map((s, i) => (
              <li key={i} className="text-sm text-neutral-300 flex gap-2">
                <span className="text-warning-500 mt-0.5">→</span>
                {s}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}
    </Card>
  );
}