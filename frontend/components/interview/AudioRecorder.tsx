"use client";
import { useRef, useState, useEffect, useCallback, MutableRefObject } from "react";
import { Button } from "@/components/ui/Button";
import { Mic, MicOff, Loader2, RotateCcw } from "lucide-react";
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
  const {
    isRecording,
    audioBlob,
    error,
    suspended,
    liveTranscript,
    speechSupported,
    startRecording,
    stopRecording,
    retry,
    analyserRef,
    streamRef: internalStreamRef,
  } = useAudioRecorder();
  const [transcribing, setTranscribing] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const { toast } = useToast();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const processedBlobRef = useRef<Blob | null>(null);
  const lastBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    onRecordingChange?.(isRecording);
  }, [isRecording, onRecordingChange]);

  useEffect(() => {
    if (streamRef) streamRef.current = internalStreamRef.current;
  }, [isRecording, streamRef, internalStreamRef]);

  useEffect(() => {
    if (error) {
      toast({ title: "Microphone issue", description: error, variant: "error" });
    }
  }, [error, toast]);

  useEffect(() => {
    if (disabled && isRecording) stopRecording();
  }, [disabled, isRecording, stopRecording]);

  useEffect(() => {
    if (isRecording && liveTranscript.trim()) {
      onTranscript(liveTranscript);
    }
  }, [isRecording, liveTranscript, onTranscript]);

  const runTranscription = useCallback((blob: Blob) => {
    let cancelled = false;
    lastBlobRef.current = blob;
    setUploadFailed(false);
    setTranscribing(true);
    transcribeAudio(blob)
      .then(({ transcript }) => {
        if (!cancelled && transcript.trim()) onTranscript(transcript);
      })
      .catch(() => {
        if (!cancelled) {
          if (liveTranscript.trim()) {
            onTranscript(liveTranscript);
          } else {
            setUploadFailed(true);
            toast({
              title: "Transcription failed",
              description: "We couldn't upload your recording. Check your connection and retry.",
              variant: "error",
            });
          }
        }
      })
      .finally(() => {
        if (!cancelled) setTranscribing(false);
      });
    return () => { cancelled = true; };
  }, [onTranscript, toast, liveTranscript]);

  useEffect(() => {
    if (!audioBlob || audioBlob === processedBlobRef.current) return;
    processedBlobRef.current = audioBlob;
    return runTranscription(audioBlob);
  }, [audioBlob, runTranscription]);

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

  const handleRetryUpload = useCallback(() => {
    if (lastBlobRef.current) runTranscription(lastBlobRef.current);
  }, [runTranscription]);

  if (transcribing) {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-400" role="status" aria-live="polite">
        <Loader2 size={14} className="animate-spin" />
        Transcribing...
      </div>
    );
  }

  if (uploadFailed) {
    return (
      <div className="flex items-center gap-2 text-sm text-error-400">
        <span>Upload failed.</span>
        <Button variant="outline" size="sm" onClick={handleRetryUpload}>
          <RotateCcw size={14} /> Retry
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-error-400">
        <MicOff size={14} />
        <span>{error}</span>
        <Button variant="outline" size="sm" onClick={retry}>
          <RotateCcw size={14} /> Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center gap-3">
        <Button
          variant={isRecording ? "danger" : "outline"}
          size="sm"
          onClick={handleClick}
          disabled={disabled}
          className="active:scale-95"
          aria-pressed={isRecording}
        >
          {isRecording ? <><MicOff size={14} /> Stop Recording</> : <><Mic size={14} /> Record Answer</>}
        </Button>
        {isRecording && !suspended && (
          <canvas
            ref={canvasRef}
            width={96}
            height={28}
            className="rounded-md bg-black/20"
            role="img"
            aria-label="Microphone audio level"
          />
        )}
        {isRecording && suspended && (
          <span className="text-xs text-neutral-500">Paused (tab inactive)</span>
        )}
        {isRecording && !speechSupported && (
          <span className="text-[10px] text-neutral-500">Live captions unavailable in this browser</span>
        )}
      </div>
      {isRecording && !suspended && liveTranscript && (
        <div className="bg-neutral-100 rounded-lg px-3 py-1.5 border border-neutral-200 max-h-16 overflow-y-auto">
          <p className="text-xs text-neutral-700" role="status" aria-live="polite">{liveTranscript}</p>
        </div>
      )}
    </div>
  );
}