import { useState, useRef, useCallback, useEffect } from "react";

const CANDIDATE_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) {
    return undefined;
  }
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

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suspended, setSuspended] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isMountedRef = useRef(true);
  const wasRecordingBeforeSuspendRef = useRef(false);
  const mimeTypeRef = useRef<string | undefined>(undefined);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    setSpeechSupported(!!getSpeechRecognitionCtor());
  }, []);

  const releaseAudioGraph = useCallback(() => {
    analyserRef.current = null;
    if (audioContextRef.current) {
      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      if (ctx.state !== "closed") {
        ctx.close().catch(() => {});
      }
    }
  }, []);

  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // already stopped
      }
      recognitionRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      try {
        mediaRecorder.current.stop();
      } catch {
        // already stopped
      }
    }
    mediaRecorder.current = null;
    stopSpeechRecognition();
    releaseStream();
    releaseAudioGraph();
  }, [releaseStream, releaseAudioGraph, stopSpeechRecognition]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  const startSpeechRecognition = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    finalTranscriptRef.current = "";
    setLiveTranscript("");
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPiece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current = `${finalTranscriptRef.current} ${transcriptPiece}`.trim();
        } else {
          interim += transcriptPiece;
        }
      }
      if (isMountedRef.current) {
        setLiveTranscript(`${finalTranscriptRef.current} ${interim}`.trim());
      }
    };
    recognition.onerror = () => {
      // Live captions are best-effort; the Whisper transcript on stop is authoritative.
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition && isMountedRef.current && mediaRecorder.current) {
        try {
          recognition.start();
        } catch {
          // ignore restart races
        }
      }
    };
    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      recognitionRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (mediaRecorder.current) return; // prevent duplicate concurrent streams
    if (isMountedRef.current) setError(null);
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("unsupported");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (!isMountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (isMountedRef.current) {
            setError("Microphone disconnected. Please reconnect and try again.");
          }
          cleanup();
          setIsRecording(false);
        };
      });

      try {
        const AudioContextCtor: typeof AudioContext =
          window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextCtor();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
      } catch {
        // Visualization is best-effort; recording still works without it.
      }

      const supportedMimeType = pickSupportedMimeType();
      mimeTypeRef.current = supportedMimeType;
      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);

      chunks.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: recorder.mimeType || "audio/webm" });
        stopSpeechRecognition();
        releaseStream();
        releaseAudioGraph();
        mediaRecorder.current = null;
        if (isMountedRef.current) setAudioBlob(blob);
      };
      recorder.onerror = () => {
        if (isMountedRef.current) setError("Recording failed unexpectedly. Please try again.");
        cleanup();
        setIsRecording(false);
      };
      mediaRecorder.current = recorder;
      recorder.start();
      startSpeechRecognition();

      if (!isMountedRef.current) {
        recorder.stop();
        return;
      }

      setIsRecording(true);
      setSuspended(false);
      wasRecordingBeforeSuspendRef.current = false;
      setAudioBlob(null);
    } catch (err) {
      releaseStream();
      releaseAudioGraph();
      mediaRecorder.current = null;
      if (isMountedRef.current) {
        const message =
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Microphone permission denied. Allow microphone access in your browser settings and try again."
            : err instanceof Error && err.message === "unsupported"
            ? "Audio recording isn't supported in this browser."
            : "Couldn't access the microphone. Please try again.";
        setError(message);
      }
    }
  }, [cleanup, releaseAudioGraph, releaseStream, startSpeechRecognition, stopSpeechRecognition]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.stop();
    }
    stopSpeechRecognition();
    setIsRecording(false);
    setSuspended(false);
    wasRecordingBeforeSuspendRef.current = false;
  }, [stopSpeechRecognition]);

  const retry = useCallback(() => {
    setError(null);
  }, []);

  // Mute (don't fully tear down) the mic on tab hide/blur so we avoid an
  // extra permission prompt and duplicate stream when the user returns.
  const suspendRecording = useCallback(() => {
    if (!streamRef.current) return;
    if (isRecording) {
      wasRecordingBeforeSuspendRef.current = true;
      streamRef.current.getAudioTracks().forEach((t) => { t.enabled = false; });
      stopSpeechRecognition();
      if (isMountedRef.current) setSuspended(true);
    }
  }, [isRecording, stopSpeechRecognition]);

  const resumeRecording = useCallback(() => {
    if (streamRef.current && wasRecordingBeforeSuspendRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => { t.enabled = true; });
      startSpeechRecognition();
      if (isMountedRef.current) setSuspended(false);
    }
  }, [startSpeechRecognition]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) suspendRecording();
      else resumeRecording();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [suspendRecording, resumeRecording]);

  return {
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
    streamRef,
  };
}