import { AlertCircle, LucideIcon, RotateCcw, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

export interface ErrorStateProps {
  icon?: LucideIcon;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  onSkip?: () => void;
  skipLabel?: string;
  className?: string;
}

export function ErrorState({
  icon: Icon = AlertCircle,
  message,
  onRetry,
  retryLabel = "Try again",
  onSkip,
  skipLabel = "Skip this question",
  className,
}: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error-500/15 text-error-500">
        <Icon size={22} aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-neutral-900">{message}</p>
      {(onRetry || onSkip) && (
        <div className="mt-5 flex items-center gap-2">
          {onRetry && (
            <Button variant="outline" size="sm" leftIcon={<RotateCcw size={14} />} onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
          {onSkip && (
            <Button variant="outline" size="sm" leftIcon={<SkipForward size={14} />} onClick={onSkip}>
              {skipLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}