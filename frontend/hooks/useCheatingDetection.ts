"use client";
import { useEffect, useRef, useState, useCallback } from "react";

export interface CheatingEvent {
  type: "tab_switch" | "copy_paste" | "window_blur" | "right_click" | "devtools_open";
  timestamp: number;
  count: number;
}

export function useCheatingDetection(active: boolean) {
  const [events, setEvents] = useState<CheatingEvent[]>([]);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const countsRef = useRef<Record<string, number>>({});
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const devtoolsRef = useRef(false);

  const triggerWarning = useCallback((msg: string) => {
    setWarningMessage(msg);
    setShowWarning(true);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    warningTimerRef.current = setTimeout(() => setShowWarning(false), 4000);
  }, []);

  const recordEvent = useCallback((type: CheatingEvent["type"]) => {
    countsRef.current[type] = (countsRef.current[type] || 0) + 1;
    const ev: CheatingEvent = { type, timestamp: Date.now(), count: countsRef.current[type] };
    setEvents((prev) => [...prev, ev]);
    const messages: Record<string, string> = {
      tab_switch: `⚠ Tab switch detected (${countsRef.current[type]}x) — camera & mic suspended`,
      copy_paste: `⚠ Copy/paste detected (${countsRef.current[type]}x) — answers must be your own`,
      window_blur: `⚠ Window lost focus (${countsRef.current[type]}x) — stay on this page`,
      right_click: `⚠ Right-click disabled during interview`,
      devtools_open: `⚠ DevTools detected — this is flagged`,
    };
    triggerWarning(messages[type]);
  }, [triggerWarning]);

  useEffect(() => {
    if (!active) return;

    const onVisibilityChange = () => {
      if (document.hidden) recordEvent("tab_switch");
    };
    const onBlur = () => recordEvent("window_blur");
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text") || "";
      if (text.length > 20) recordEvent("copy_paste");
    };
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      recordEvent("right_click");
    };
    const onCopy = () => recordEvent("copy_paste");

    const devtoolsCheck = setInterval(() => {
      const threshold = 160;
      if (
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold
      ) {
        if (!devtoolsRef.current) {
          devtoolsRef.current = true;
          recordEvent("devtools_open");
        }
      } else {
        devtoolsRef.current = false;
      }
    }, 1000);

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    document.addEventListener("paste", onPaste);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopy);

    return () => {
      clearInterval(devtoolsCheck);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopy);
    };
  }, [active, recordEvent]);

  useEffect(() => {
    return () => { if (warningTimerRef.current) clearTimeout(warningTimerRef.current); };
  }, []);

  const getSummary = useCallback(() => ({
    tab_switches: countsRef.current["tab_switch"] || 0,
    window_blurs: countsRef.current["window_blur"] || 0,
    copy_pastes: countsRef.current["copy_paste"] || 0,
    devtools: countsRef.current["devtools_open"] || 0,
    total_events: events.length,
    integrity_score: Math.max(0, 100 - (events.length * 7)),
  }), [events]);

  return { events, showWarning, warningMessage, getSummary };
}