"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { transcribeAudio } from "@/lib/api";

export type VoiceAnswerPhase =
  | "idle"
  | "listening"
  | "finalizing"
  | "completed"
  | "mic_error"
  | "unsupported";

export type FinalizeReason = "done" | "voice_command" | "timeout" | "error" | "external";

interface UseInterviewVoiceInputOptions {
  timeLimitSeconds: number;
  onFinalize: (answer: string, reason: FinalizeReason) => void;
}

interface UseInterviewVoiceInputResult {
  phase: VoiceAnswerPhase;
  secondsRemaining: number;
  timeLimitSeconds: number;
  liveTranscript: string;
  isListening: boolean;
  isFinalizing: boolean;
  micError: string | null;
  speechSupported: boolean;
  analyserRef: MutableRefObject<AnalyserNode | null>;
  streamRef: MutableRefObject<MediaStream | null>;
  begin: () => Promise<void>;
  done: () => void;
  reset: () => void;
}

const CANDIDATE_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

const COMPLETION_PHRASES = new Set([
  "that's all",
  "thats all",
  "that is all",
  "that will be all",
  "i'm done",
  "im done",
  "i am done",
  "i'm finished",
  "im finished",
  "i am finished",
  "done",
]);

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return undefined;
  return CANDIDATE_MIME_TYPES.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  });
}

function getSpeechRecognitionCtor(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

function normalizeChunk(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.!?,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTrailingCompletionPhrase(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  const sentences = trimmed.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
  if (sentences.length === 0) return trimmed;
  const last = sentences[sentences.length - 1];
  if (COMPLETION_PHRASES.has(normalizeChunk(last))) {
    sentences.pop();
    return sentences.join(" ").trim();
  }
  return trimmed;
}

export function useInterviewVoiceInput({
  timeLimitSeconds,
  onFinalize,
}: UseInterviewVoiceInputOptions): UseInterviewVoiceInputResult {
  const [phase, setPhase] = useState<VoiceAnswerPhase>("idle");
  const [secondsRemaining, setSecondsRemaining] = useState(timeLimitSeconds);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);

  const phaseRef = useRef<VoiceAnswerPhase>("idle");
  const finalizedRef = useRef(false);
  const beginningRef = useRef(false);
  const mountedRef = useRef(true);
  const onFinalizeRef = useRef(onFinalize);

  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string | undefined>(undefined);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimestampRef = useRef<number | null>(null);
  const lastEmittedSecondRef = useRef<number | null>(null);

  useEffect(() => {
    onFinalizeRef.current = onFinalize;
  }, [onFinalize]);

  useEffect(() => {
    setSpeechSupported(!!getSpeechRecognitionCtor());
  }, []);

  const setPhaseSafe = useCallback((p: VoiceAnswerPhase) => {
    phaseRef.current = p;
    if (mountedRef.current) setPhase(p);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const releaseAudioGraph = useCallback(() => {
    analyserRef.current = null;
    if (audioContextRef.current) {
      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      if (ctx.state !== "closed") ctx.close().catch(() => {});
    }
  }, []);

  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const stopRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognitionRef.current = null;
      try {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.onstart = null;
        recognition.stop();
      } catch {
      }
    }
  }, []);

  const stopMediaRecorderAsync = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(chunksRef.current.length ? new Blob(chunksRef.current, { type: mimeTypeRef.current || "audio/webm" }) : null);
        return;
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeTypeRef.current || "audio/webm" });
        resolve(blob);
      };
      try {
        recorder.stop();
      } catch {
        resolve(null);
      }
    });
  }, []);

  const fullCleanup = useCallback(() => {
    clearTimer();
    stopRecognition();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
      }
    }
    mediaRecorderRef.current = null;
    releaseStream();
    releaseAudioGraph();
  }, [clearTimer, stopRecognition, releaseStream, releaseAudioGraph]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      fullCleanup();
    };
  }, [fullCleanup]);

  const finalize = useCallback(
    (reason: FinalizeReason) => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      clearTimer();
      stopRecognition();
      setPhaseSafe("finalizing");

      const localAnswer = stripTrailingCompletionPhrase(
        `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim()
      );

      stopMediaRecorderAsync()
        .then((blob) => {
          releaseStream();
          releaseAudioGraph();
          if (!blob || blob.size < 512) {
            return localAnswer;
          }
          return transcribeAudio(blob)
            .then(({ transcript }) => {
              const cleaned = stripTrailingCompletionPhrase(transcript || "");
              return cleaned.trim() ? cleaned : localAnswer;
            })
            .catch(() => localAnswer);
        })
        .catch(() => localAnswer)
        .then((finalAnswer) => {
          setPhaseSafe("completed");
          onFinalizeRef.current(finalAnswer || "", reason);
        });
    },
    [clearTimer, stopRecognition, stopMediaRecorderAsync, releaseStream, releaseAudioGraph, setPhaseSafe]
  );

  const startRecognition = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const piece: string = result[0].transcript;
        if (result.isFinal) {
          const normalized = normalizeChunk(piece);
          if (COMPLETION_PHRASES.has(normalized)) {
            if (phaseRef.current === "listening") {
              finalize("voice_command");
            }
            continue;
          }
          finalTranscriptRef.current = `${finalTranscriptRef.current} ${piece}`.trim();
        } else {
          interim += piece;
        }
      }
      interimTranscriptRef.current = interim.trim();
      if (mountedRef.current) {
        setLiveTranscript(`${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim());
      }
    };

    recognition.onerror = (event: any) => {
      if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
        if (phaseRef.current === "listening") {
          setMicError("Microphone permission was revoked. Please check your browser settings.");
          finalize("error");
        }
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition && phaseRef.current === "listening" && mountedRef.current) {
        try {
          recognition.start();
        } catch {
        }
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      recognitionRef.current = null;
    }
  }, [finalize]);

  const tickTimer = useCallback(() => {
    if (startTimestampRef.current == null) return;
    const elapsedMs = Date.now() - startTimestampRef.current;
    const remaining = Math.max(0, timeLimitSeconds - elapsedMs / 1000);
    const wholeSeconds = Math.ceil(remaining);
    if (wholeSeconds !== lastEmittedSecondRef.current) {
      lastEmittedSecondRef.current = wholeSeconds;
      if (mountedRef.current) setSecondsRemaining(wholeSeconds);
    }
    if (remaining <= 0) {
      finalize("timeout");
    }
  }, [timeLimitSeconds, finalize]);

  const begin = useCallback(async () => {
    if (beginningRef.current || phaseRef.current !== "idle") return;
    beginningRef.current = true;
    finalizedRef.current = false;
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    chunksRef.current = [];
    lastEmittedSecondRef.current = null;
    setLiveTranscript("");
    setMicError(null);
    setSecondsRemaining(timeLimitSeconds);

    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("unsupported");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        beginningRef.current = false;
        return;
      }
      streamRef.current = stream;
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (phaseRef.current === "listening") {
            setMicError("Microphone disconnected. Please reconnect and try again.");
            finalize("error");
          }
        };
      });

      try {
        const AudioContextCtor: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextCtor();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
      } catch {
      }

      let recorder: MediaRecorder | null = null;
      try {
        const supportedMimeType = pickSupportedMimeType();
        mimeTypeRef.current = supportedMimeType;
        recorder = supportedMimeType ? new MediaRecorder(stream, { mimeType: supportedMimeType }) : new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onerror = () => {
        };
        mediaRecorderRef.current = recorder;
        recorder.start();
      } catch {
        mediaRecorderRef.current = null;
        recorder = null;
      }

      const recognitionAvailable = !!getSpeechRecognitionCtor();
      if (!recorder && !recognitionAvailable) {
        throw new Error("unsupported_capture");
      }

      startRecognition();

      startTimestampRef.current = Date.now();
      clearTimer();
      timerIntervalRef.current = setInterval(tickTimer, 250);

      beginningRef.current = false;
      setPhaseSafe("listening");
    } catch (err) {
      beginningRef.current = false;
      releaseStream();
      releaseAudioGraph();
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission denied. Allow microphone access in your browser settings and try again."
          : err instanceof DOMException && err.name === "NotFoundError"
          ? "No microphone was found. Please connect one and try again."
          : err instanceof Error && err.message === "unsupported_capture"
          ? "Voice answering isn't supported in this browser. Please switch to text input."
          : err instanceof Error && err.message === "unsupported"
          ? "Voice answering isn't supported in this browser. Please switch to text input."
          : "Couldn't access the microphone. Please try again.";
      setMicError(message);
      setPhaseSafe(err instanceof Error && err.message.startsWith("unsupported") ? "unsupported" : "mic_error");
    }
  }, [timeLimitSeconds, startRecognition, tickTimer, clearTimer, releaseStream, releaseAudioGraph, setPhaseSafe, finalize]);

  const done = useCallback(() => {
    if (phaseRef.current !== "listening") return;
    finalize("done");
  }, [finalize]);

  const reset = useCallback(() => {
    fullCleanup();
    finalizedRef.current = false;
    beginningRef.current = false;
    startTimestampRef.current = null;
    lastEmittedSecondRef.current = null;
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    chunksRef.current = [];
    setLiveTranscript("");
    setMicError(null);
    setSecondsRemaining(timeLimitSeconds);
    setPhaseSafe("idle");
  }, [fullCleanup, timeLimitSeconds, setPhaseSafe]);

  return {
    phase,
    secondsRemaining,
    timeLimitSeconds,
    liveTranscript,
    isListening: phase === "listening",
    isFinalizing: phase === "finalizing",
    micError,
    speechSupported,
    analyserRef,
    streamRef,
    begin,
    done,
    reset,
  };
}