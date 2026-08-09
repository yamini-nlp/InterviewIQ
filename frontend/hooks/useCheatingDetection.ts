"use client";
import { useEffect, useRef, useState, useCallback } from "react";

export interface CheatingEvent {
  type: "tab_switch" | "copy_paste" | "window_blur" | "right_click" | "devtools_open" | "inactivity" | "multiple_faces" | "no_face" | "mic_muted";
  timestamp: number;
  count: number;
  metadata?: Record<string, any>;
}

export function useCheatingDetection(
  active: boolean,
  micStreamRef?: React.MutableRefObject<MediaStream | null>,
  videoStreamRef?: React.MutableRefObject<MediaStream | null>
) {
  const [events, setEvents] = useState<CheatingEvent[]>([]);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [suspended, setSuspended] = useState(false);
  const countsRef = useRef<Record<string, number>>({});
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const devtoolsRef = useRef(false);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEventsRef = useRef<CheatingEvent[]>([]);

  const triggerWarning = useCallback((msg: string) => {
    setWarningMessage(msg);
    setShowWarning(true);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    warningTimerRef.current = setTimeout(() => setShowWarning(false), 4000);
  }, []);

  const recordEvent = useCallback((type: CheatingEvent["type"], metadata?: Record<string, any>) => {
    countsRef.current[type] = (countsRef.current[type] || 0) + 1;
    const ev: CheatingEvent = { type, timestamp: Date.now(), count: countsRef.current[type], metadata };
    setEvents((prev) => [...prev, ev]);
    pendingEventsRef.current.push(ev);
    const messages: Record<string, string> = {
      tab_switch: `⚠ Tab switch flagged (${countsRef.current[type]}x) — camera & mic disabled`,
      copy_paste: `⚠ Copy/paste detected (${countsRef.current[type]}x)`,
      window_blur: `⚠ Window lost focus (${countsRef.current[type]}x) — camera & mic disabled`,
      right_click: `⚠ Right-click disabled during interview`,
      devtools_open: `⚠ DevTools detected — flagged`,
      inactivity: `⚠ Inactivity detected — are you still there?`,
      multiple_faces: `⚠ Multiple faces detected in frame`,
      no_face: `⚠ Face not visible — please face the camera`,
      mic_muted: `⚠ Microphone appears to be muted`,
    };
    triggerWarning(messages[type] || `⚠ Suspicious activity detected`);
  }, [triggerWarning]);

  const suspendMedia = useCallback(() => {
    if (micStreamRef?.current) {
      micStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = false; });
    }
    if (videoStreamRef?.current) {
      videoStreamRef.current.getVideoTracks().forEach((t) => { t.enabled = false; });
    }
    setSuspended(true);
  }, [micStreamRef, videoStreamRef]);

  const resumeMedia = useCallback(() => {
    if (micStreamRef?.current) {
      micStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = true; });
    }
    if (videoStreamRef?.current) {
      videoStreamRef.current.getVideoTracks().forEach((t) => { t.enabled = true; });
    }
    setSuspended(false);
  }, [micStreamRef, videoStreamRef]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => {
      recordEvent("inactivity");
    }, 120000);
  }, [recordEvent]);

  useEffect(() => {
    if (!active) return;

    const onVisibilityChange = () => {
      if (document.hidden) {
        recordEvent("tab_switch");
        suspendMedia();
      } else {
        resumeMedia();
      }
    };
    const onBlur = () => {
      recordEvent("window_blur");
      suspendMedia();
    };
    const onFocus = () => resumeMedia();
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text") || "";
      if (text.length > 20) recordEvent("copy_paste", { textLength: text.length });
    };
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      recordEvent("right_click");
    };
    const onActivity = () => resetInactivityTimer();

    const devtoolsCheck = setInterval(() => {
      const threshold = 160;
      if (window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold) {
        if (!devtoolsRef.current) { devtoolsRef.current = true; recordEvent("devtools_open"); }
      } else {
        devtoolsRef.current = false;
      }
    }, 1000);

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("paste", onPaste);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("mousemove", onActivity);
    document.addEventListener("keydown", onActivity);

    resetInactivityTimer();

    return () => {
      clearInterval(devtoolsCheck);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("mousemove", onActivity);
      document.removeEventListener("keydown", onActivity);
    };
  }, [active, recordEvent, suspendMedia, resumeMedia, resetInactivityTimer]);

  useEffect(() => {
    return () => { if (warningTimerRef.current) clearTimeout(warningTimerRef.current); };
  }, []);

  const flushEvents = useCallback(async (sessionId: string, authToken: string) => {
    const toFlush = [...pendingEventsRef.current];
    if (toFlush.length === 0) return;
    pendingEventsRef.current = [];
    try {
      await fetch("/api/proxy/api/integrity/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          events: toFlush.map((e) => ({
            session_id: sessionId,
            event_type: e.type,
            timestamp: e.timestamp,
            count: e.count,
            metadata: e.metadata || {},
          })),
        }),
      });
    } catch {
      pendingEventsRef.current = [...toFlush, ...pendingEventsRef.current];
    }
  }, []);

  const getSummary = useCallback(() => ({
    tab_switches: countsRef.current["tab_switch"] || 0,
    window_blurs: countsRef.current["window_blur"] || 0,
    copy_pastes: countsRef.current["copy_paste"] || 0,
    devtools: countsRef.current["devtools_open"] || 0,
    inactivity: countsRef.current["inactivity"] || 0,
    multiple_faces: countsRef.current["multiple_faces"] || 0,
    total_events: events.length,
    integrity_score: Math.max(0, 100 - (events.length * 7)),
  }), [events]);

  return { events, showWarning, warningMessage, suspended, getSummary, flushEvents };
}