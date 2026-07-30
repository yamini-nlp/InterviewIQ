import { HTMLAttributes, ReactNode, forwardRef } from "react";
import { cn, categoryColor, difficultyColor } from "@/lib/utils";

export type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "outline";
export type BadgeSize = "sm" | "md";
export type BadgeLegacyType = "category" | "difficulty" | "correctness";

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  text?: string;
  type?: BadgeLegacyType;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  children?: ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-neutral-200 text-neutral-700",
  success: "bg-success-500/15 text-success-600",
  warning: "bg-warning-500/15 text-warning-600",
  error: "bg-error-500/15 text-error-600",
  info: "bg-info-500/15 text-info-600",
  outline: "border border-neutral-300 text-neutral-700 bg-transparent",
};

const dotColorClasses: Record<BadgeVariant, string> = {
  default: "bg-neutral-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  error: "bg-error-500",
  info: "bg-info-500",
  outline: "bg-neutral-500",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "text-[11px] px-2 py-0.5 gap-1",
  md: "text-xs px-2.5 py-1 gap-1.5",
};

function legacyColorClasses(type: BadgeLegacyType, text: string): string {
  if (type === "category") return categoryColor(text);
  if (type === "difficulty") return cn("bg-neutral-200", difficultyColor(text));
  if (text === "Correct") return "bg-success-500/15 text-success-600";
  if (text === "Partially Correct") return "bg-warning-500/15 text-warning-600";
  return "bg-error-500/15 text-error-600";
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { text, type, variant = "default", size = "md", dot = false, className, children, ...props },
  ref
) {
  const colorClasses = type ? legacyColorClasses(type, text ?? "") : variantClasses[variant];
  const dotClasses = type ? dotColorClasses.default : dotColorClasses[variant];
  const content = children ?? text ?? "";

  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center font-medium rounded-lg capitalize",
        sizeClasses[size],
        colorClasses,
        className
      )}
      {...props}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", dotClasses)} aria-hidden="true" />}
      {content}
    </span>
  );
});

Badge.displayName = "Badge";

export { Progress } from "./Progress";