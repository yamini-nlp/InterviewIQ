import { useEffect, useRef, useState, useCallback } from "react";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suspended, setSuspended] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setActive(true);
        setSuspended(false);
        setError(null);
      }
    } catch {
      setError("Camera permission denied");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setActive(false);
  }, []);

  const suspendCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => { t.enabled = false; });
    }
    setSuspended(true);
  }, []);

  const resumeCamera = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => { t.enabled = true; });
      setSuspended(false);
    } else {
      await startCamera();
    }
  }, [startCamera]);

  useEffect(() => {
    const onHide = () => suspendCamera();
    const onShow = () => resumeCamera();
    const onBlur = () => suspendCamera();
    const onFocus = () => resumeCamera();

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) onHide(); else onShow();
    });
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [suspendCamera, resumeCamera]);

  return { videoRef, active, error, suspended, startCamera, stopCamera, suspendCamera, resumeCamera };
}