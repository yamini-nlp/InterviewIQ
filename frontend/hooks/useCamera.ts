import { useEffect, useRef, useState, useCallback } from "react";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suspended, setSuspended] = useState(false);

  const isMountedRef = useRef(true);
  const isStartingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const startCamera = useCallback(async () => {
    if (isStartingRef.current || streamRef.current) return;
    isStartingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });

      if (!isMountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch {
          // Autoplay can be interrupted (e.g. rapid mount/unmount); ignore.
        }
      }

      if (!isMountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        return;
      }

      setActive(true);
      setSuspended(false);
      setError(null);
    } catch {
      if (isMountedRef.current) setError("Camera permission denied");
    } finally {
      isStartingRef.current = false;
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (isMountedRef.current) setActive(false);
  }, []);

  const suspendCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => { t.enabled = false; });
    }
    if (isMountedRef.current) setSuspended(true);
  }, []);

  const resumeCamera = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => { t.enabled = true; });
      if (isMountedRef.current) setSuspended(false);
    } else {
      await startCamera();
    }
  }, [startCamera]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) suspendCamera(); else resumeCamera();
    };
    const handleBlur = () => suspendCamera();
    const handleFocus = () => resumeCamera();

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [suspendCamera, resumeCamera]);

  return { videoRef, active, error, suspended, startCamera, stopCamera, suspendCamera, resumeCamera };
}