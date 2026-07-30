import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export type ProgressSize = "sm" | "md" | "lg";
export type ProgressColor = "primary" | "success" | "warning" | "error";

export interface ProgressProps extends Omit<HTMLAttributes<HTMLDivElement>, "color"> {
  value?: number;
  max?: number;
  indeterminate?: boolean;
  size?: ProgressSize;
  color?: ProgressColor;
  showLabel?: boolean;
  label?: string;
}

const trackSizeClasses: Record<ProgressSize, string> = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-4",
};

const fillColorClasses: Record<ProgressColor, string> = {
  primary: "from-primary-500 to-primary-400",
  success: "from-success-500 to-success-400",
  warning: "from-warning-500 to-warning-400",
  error: "from-error-500 to-error-400",
};

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(function Progress(
  {
    value = 0,
    max = 10,
    indeterminate = false,
    size = "sm",
    color = "primary",
    showLabel = false,
    label,
    className,
    ...props
  },
  ref
) {
  const percentage = indeterminate ? 100 : Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="mb-1.5 flex items-center justify-between text-xs text-neutral-600">
          <span>{label}</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : Math.round(percentage)}
        aria-busy={indeterminate || undefined}
        className={cn(trackSizeClasses[size], "bg-neutral-200 rounded-full overflow-hidden")}
        {...props}
      >
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r transition-all duration-700",
            fillColorClasses[color],
            indeterminate && "w-full animate-pulse-slow"
          )}
          style={indeterminate ? undefined : { width: `${percentage}%` }}
        />
      </div>
    </div>
  );
});

Progress.displayName = "Progress";