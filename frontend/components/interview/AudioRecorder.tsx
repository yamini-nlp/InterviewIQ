"use client";
import { useRef, useState, useEffect, useCallback, MutableRefObject } from "react";
import { Button } from "@/components/ui/Button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { transcribeAudio } from "@/lib/api";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useToast } from "@/hooks/useToast";

interface Props {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  onRecordingChange?: (isRecording: boolean) => void;
  streamRef?: MutableRefObject<MediaStream | null>;
}

const BAR_COUNT = 20;

export function AudioRecorder({ onTranscript, disabled, onRecordingChange, streamRef }: Props) {
  const { isRecording, audioBlob, error, startRecording, stopRecording, analyserRef, streamRef: internalStreamRef } = useAudioRecorder();
  const [transcribing, setTranscribing] = useState(false);
  const { toast } = useToast();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const processedBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    onRecordingChange?.(isRecording);
  }, [isRecording, onRecordingChange]);

  useEffect(() => {
    if (streamRef) streamRef.current = internalStreamRef.current;
  }, [isRecording, streamRef, internalStreamRef]);

  useEffect(() => {
    if (error) {
      toast({ title: "Microphone unavailable", description: error, variant: "error" });
    }
  }, [error, toast]);

  useEffect(() => {
    if (disabled && isRecording) stopRecording();
  }, [disabled, isRecording, stopRecording]);

  useEffect(() => {
    if (!audioBlob || audioBlob === processedBlobRef.current) return;
    processedBlobRef.current = audioBlob;
    let cancelled = false;
    setTranscribing(true);
    transcribeAudio(audioBlob)
      .then(({ transcript }) => {
        if (!cancelled) onTranscript(transcript);
      })
      .catch(() => {
        if (!cancelled) {
          toast({ title: "Transcription failed", description: "Please try recording your answer again.", variant: "error" });
        }
      })
      .finally(() => {
        if (!cancelled) setTranscribing(false);
      });
    return () => { cancelled = true; };
  }, [audioBlob, onTranscript, toast]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!isRecording || !canvas) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const ctx = canvas?.getContext("2d");
      ctx?.clearRect(0, 0, canvas?.width ?? 0, canvas?.height ?? 0);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const analyser = analyserRef.current;
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
          const barHeight = Math.max(2, (value / 255) * H);
          ctx.fillStyle = "rgb(var(--color-primary-500) / 0.85)";
          ctx.beginPath();
          ctx.roundRect(i * barWidth + 1, H - barHeight, Math.max(1, barWidth - 2), barHeight, 2);
          ctx.fill();
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isRecording, analyserRef]);

  const handleClick = useCallback(() => {
    if (isRecording) stopRecording();
    else startRecording();
  }, [isRecording, startRecording, stopRecording]);

  if (transcribing) {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-400">
        <Loader2 size={14} className="animate-spin" />
        Transcribing...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-error-400">
        <MicOff size={14} />
        Microphone access denied. Check your browser permissions.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant={isRecording ? "danger" : "outline"}
        size="sm"
        onClick={handleClick}
        disabled={disabled}
        className="active:scale-95"
      >
        {isRecording ? <><MicOff size={14} /> Stop Recording</> : <><Mic size={14} /> Record Answer</>}
      </Button>
      {isRecording && (
        <canvas
          ref={canvasRef}
          width={96}
          height={28}
          className="rounded-md bg-black/20"
          role="img"
          aria-label="Microphone audio level"
        />
      )}
    </div>
  );
}