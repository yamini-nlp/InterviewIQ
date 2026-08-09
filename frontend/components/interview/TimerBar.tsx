"use client";
import { useEffect, useRef, useState } from "react";
import { Progress } from "@/components/ui/Progress";
import { cn } from "@/lib/utils";

interface TimerBarProps {
  duration?: number;
  onTimeout?: () => void;
  paused?: boolean;
  className?: string;
}

const ANNOUNCE_THRESHOLDS = [50, 20, 5];

export function TimerBar({ duration = 120, onTimeout, paused = false, className }: TimerBarProps) {
  const [seconds, setSeconds] = useState(duration);
  const [announcement, setAnnouncement] = useState("");
  const onTimeoutRef = useRef(onTimeout);
  const announcedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    setSeconds(duration);
    announcedRef.current = new Set();
  }, [duration]);

  useEffect(() => {
    if (paused) return;
    if (seconds <= 0) {
      onTimeoutRef.current?.();
      return;
    }
    const t = setTimeout(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [seconds, paused]);

  useEffect(() => {
    const pct = Math.round((seconds / duration) * 100);
    for (const threshold of ANNOUNCE_THRESHOLDS) {
      if (pct <= threshold && !announcedRef.current.has(threshold)) {
        announcedRef.current.add(threshold);
        const mm = Math.floor(seconds / 60);
        const ss = seconds % 60;
        const timeLabel = mm > 0 ? `${mm} minute${mm === 1 ? "" : "s"} ${ss} second${ss === 1 ? "" : "s"}` : `${ss} second${ss === 1 ? "" : "s"}`;
        setAnnouncement(`${timeLabel} remaining`);
      }
    }
  }, [seconds, duration]);

  const pct = (seconds / duration) * 100;
  const color = pct > 50 ? "success" : pct > 20 ? "warning" : "error";
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        className={cn(
          "font-mono text-sm min-w-[48px] tabular-nums transition-colors duration-500",
          color === "success" && "text-success-400",
          color === "warning" && "text-warning-400",
          color === "error" && "text-error-400"
        )}
      >
        {mm}:{ss}
      </span>
      <Progress value={pct} max={100} size="sm" color={color} className="flex-1" />
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}