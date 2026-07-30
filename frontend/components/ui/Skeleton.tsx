import { CSSProperties, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type SkeletonRounded = "sm" | "md" | "lg" | "full";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  rounded?: SkeletonRounded;
}

const roundedClasses: Record<SkeletonRounded, string> = {
  sm: "rounded-md",
  md: "rounded-lg",
  lg: "rounded-2xl",
  full: "rounded-full",
};

export function Skeleton({ width, height, rounded = "md", className, style, ...props }: SkeletonProps) {
  const mergedStyle: CSSProperties = { ...style };
  if (width !== undefined) mergedStyle.width = width;
  if (height !== undefined) mergedStyle.height = height;

  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("skeleton", roundedClasses[rounded], className)}
      style={mergedStyle}
      {...props}
    />
  );
}