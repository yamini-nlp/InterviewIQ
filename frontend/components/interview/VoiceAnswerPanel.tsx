"use client";
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { Mic, MicOff, Loader2, CheckCircle2 } from "lucide-react";
import { useInterviewVoiceInput, type FinalizeReason } from "@/hooks/useInterviewVoiceInput";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";

interface VoiceAnswerPanelProps {
  active: boolean;
  resetKey: string | number;
  timeLimitSeconds?: number;
  disabled?: boolean;
  onFinalize: (answer: string, reason: FinalizeReason) => void;
  onListeningChange?: (listening: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  streamRef?: MutableRefObject<MediaStream | null>;
  onMicUnavailable?: () => void;
}

const BAR_COUNT = 28;
const ANNOUNCE_THRESHOLDS = [50, 20, 5];

export function VoiceAnswerPanel({
  active,
  resetKey,
  timeLimitSeconds = 120,
  disabled,
  onFinalize,
  onListeningChange,
  onBusyChange,
  streamRef,
  onMicUnavailable,
}: VoiceAnswerPanelProps) {
  const { toast } = useToast();
  const voice = useInterviewVoiceInput({ timeLimitSeconds, onFinalize });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastResetKeyRef = useRef(resetKey);
  const erroredNotifiedRef = useRef(false);
  const announcedRef = useRef<Set<number>>(new Set());
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    onListeningChange?.(voice.isListening);
  }, [voice.isListening, onListeningChange]);

  useEffect(() => {
    onBusyChange?.(voice.isFinalizing);
  }, [voice.isFinalizing, onBusyChange]);

  useEffect(() => {
    if (streamRef) streamRef.current = voice.streamRef.current;
  }, [voice.isListening, streamRef, voice.streamRef]);

  useEffect(() => {
    if (lastResetKeyRef.current !== resetKey) {
      lastResetKeyRef.current = resetKey;
      erroredNotifiedRef.current = false;
      voice.reset();
    }
  }, [resetKey, voice.reset]);

  useEffect(() => {
    if (active && !disabled && voice.phase === "idle") {
      voice.begin();
    }
  }, [active, disabled, voice.phase, voice.begin]);

  useEffect(() => {
    if (disabled && voice.isListening) {
      voice.reset();
    }
  }, [disabled, voice.isListening, voice.reset]);

  useEffect(() => {
    if ((voice.phase === "mic_error" || voice.phase === "unsupported") && !erroredNotifiedRef.current) {
      erroredNotifiedRef.current = true;
      toast({ title: "Microphone issue", description: voice.micError || "Voice input is unavailable.", variant: "error" });
      onMicUnavailable?.();
    }
  }, [voice.phase, voice.micError, toast, onMicUnavailable]);

  useEffect(() => {
    if (!voice.isListening) {
      announcedRef.current = new Set();
      return;
    }
    const pct = (voice.secondsRemaining / voice.timeLimitSeconds) * 100;
    for (const threshold of ANNOUNCE_THRESHOLDS) {
      if (pct <= threshold && !announcedRef.current.has(threshold)) {
        announcedRef.current.add(threshold);
        setAnnouncement(`${voice.secondsRemaining} seconds remaining`);
      }
    }
  }, [voice.secondsRemaining, voice.isListening, voice.timeLimitSeconds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!voice.isListening || !canvas) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const ctx = canvas?.getContext("2d");
      ctx?.clearRect(0, 0, canvas?.width ?? 0, canvas?.height ?? 0);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      const analyser = voice.analyserRef.current;
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      if (analyser) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        const step = Math.max(1, Math.floor(bufferLength / BAR_COUNT));
        const barWidth = W / BAR_COUNT;
        for (let i = 0; i < BAR_COUNT; i++) {
          const value = dataArray[i * step] || 0;
          const barHeight = Math.max(3, (value / 255) * H);
          ctx.fillStyle = "rgb(var(--color-primary-500) / 0.85)";
          ctx.beginPath();
          ctx.roundRect(i * barWidth + 1, H - barHeight, Math.max(1, barWidth - 2), barHeight, 2);
          ctx.fill();
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [voice.isListening, voice.analyserRef]);

  const handleDone = useCallback(() => {
    voice.done();
  }, [voice]);

  const handleRetry = useCallback(() => {
    erroredNotifiedRef.current = false;
    voice.reset();
    voice.begin();
  }, [voice]);

  const mm = String(Math.floor(voice.secondsRemaining / 60)).padStart(2, "0");
  const ss = String(voice.secondsRemaining % 60).padStart(2, "0");
  const pct = (voice.secondsRemaining / voice.timeLimitSeconds) * 100;
  const timeColor = pct > 50 ? "text-success-400" : pct > 20 ? "text-warning-400" : "text-error-400";
  const progressColor = pct > 50 ? "success" : pct > 20 ? "warning" : "error";

  if (voice.phase === "mic_error" || voice.phase === "unsupported") {
    return (
      <div className="flex items-center gap-2 text-sm text-error-400">
        <MicOff size={14} />
        <span>{voice.micError || "Voice input is unavailable."}</span>
        {voice.phase === "mic_error" && (
          <Button variant="outline" size="sm" onClick={handleRetry} className="active:scale-95">
            Try again
          </Button>
        )}
      </div>
    );
  }

  if (voice.phase === "finalizing") {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-400" role="status" aria-live="polite">
        <Loader2 size={14} className="animate-spin" />
        Time's up. Analyzing your response...
      </div>
    );
  }

  if (voice.phase === "completed") {
    return (
      <div className="flex items-center gap-2 text-sm text-success-400" role="status" aria-live="polite">
        <CheckCircle2 size={14} />
        Answer submitted
      </div>
    );
  }

  if (voice.phase !== "listening") {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-500" role="status" aria-live="polite">
        <Loader2 size={14} className="animate-spin" />
        Activating microphone...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-error-500" />
          </span>
          <span className="text-xs font-mono text-neutral-600">
            <Mic size={11} className="inline -mt-0.5 mr-1" />
            Listening
          </span>
        </div>
        <span className={cn("font-mono text-xs tabular-nums transition-colors duration-500", timeColor)}>
          {mm}:{ss} remaining
        </span>
      </div>

      <Progress value={pct} max={100} size="sm" color={progressColor} />

      <canvas
        ref={canvasRef}
        width={280}
        height={30}
        className="rounded-md bg-black/20 w-full"
        role="img"
        aria-label="Microphone audio level"
      />

      {!voice.speechSupported && (
        <span className="text-[10px] text-neutral-500">
          Live captions unavailable in this browser — your answer is still being recorded.
        </span>
      )}

      <div className="bg-neutral-100 rounded-lg px-3 py-2 border border-neutral-200 max-h-20 overflow-y-auto">
        {voice.liveTranscript ? (
          <p className="text-xs text-neutral-700">{voice.liveTranscript}</p>
        ) : (
          <p className="text-xs text-neutral-400 italic">Start speaking, your answer will appear here...</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-neutral-500">Say "That's all" or press Done when finished</span>
        <Button variant="primary" size="sm" onClick={handleDone} disabled={voice.isFinalizing} className="active:scale-95">
          Done
        </Button>
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}