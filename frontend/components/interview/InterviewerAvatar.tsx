"use client";
import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  text: string;
  speaking: boolean;
  onSpeakEnd?: () => void;
}

export function InterviewerAvatar({ text, speaking, onSpeakEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const [mouthOpen, setMouthOpen] = useState(0);
  const [blinkState, setBlinkState] = useState(1);
  const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouthTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const stopSpeech = useCallback(() => {
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }
    if (synthRef.current) synthRef.current.cancel();
    if (mouthTimer.current) clearInterval(mouthTimer.current);
    setMouthOpen(0);
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    return () => { stopSpeech(); if (blinkTimer.current) clearTimeout(blinkTimer.current); };
  }, [stopSpeech]);

  useEffect(() => {
    const scheduleBlink = () => {
      const delay = 2500 + Math.random() * 3000;
      blinkTimer.current = setTimeout(() => {
        setBlinkState(0);
        setTimeout(() => { setBlinkState(1); scheduleBlink(); }, 120);
      }, delay);
    };
    scheduleBlink();
    return () => { if (blinkTimer.current) clearTimeout(blinkTimer.current); };
  }, []);

  useEffect(() => {
    if (!speaking || !text) { stopSpeech(); return; }
    if (!synthRef.current) return;
    synthRef.current.cancel();
  
    const doSpeak = (voices: SpeechSynthesisVoice[]) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.92;
      utterance.pitch = 1.05;
      utterance.volume = 1;
      const preferred = voices.find((v) => v.name.toLowerCase().includes("google") && v.lang === "en-US")
        || voices.find((v) => v.lang === "en-US") || voices[0];
      if (preferred) utterance.voice = preferred;
      utterance.onstart = () => {
        setIsSpeaking(true);
        if (mouthTimer.current) clearInterval(mouthTimer.current);
        mouthTimer.current = setInterval(() => setMouthOpen(Math.random() * 0.85 + 0.15), 90);
      };
      utterance.onend = () => {
        if (mouthTimer.current) clearInterval(mouthTimer.current);
        setMouthOpen(0);
        setIsSpeaking(false);
        onSpeakEnd?.();
      };
      utterance.onerror = () => {
        if (mouthTimer.current) clearInterval(mouthTimer.current);
        setMouthOpen(0);
        setIsSpeaking(false);
        onSpeakEnd?.();
      };
      speakTimeoutRef.current = setTimeout(() => {
        speakTimeoutRef.current = null;
        synthRef.current?.speak(utterance);
      }, 400);
    };
  
    const voices = synthRef.current.getVoices();
    if (voices.length > 0) {
      doSpeak(voices);
    } else {
      const handler = () => { doSpeak(synthRef.current!.getVoices()); };
      synthRef.current.addEventListener("voiceschanged", handler);
      return () => synthRef.current?.removeEventListener("voiceschanged", handler);
    }
  }, [speaking, text, stopSpeech, onSpeakEnd]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2;
      const cy = H / 2 - 10;
      const r = Math.min(W, H) * 0.32;
      const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r);
      grad.addColorStop(0, "#2d2060");
      grad.addColorStop(0.6, "#1a1440");
      grad.addColorStop(1, "#0d0a26");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      if (isSpeaking) {
        ctx.save();
        [1.15, 1.28, 1.42].forEach((scale, i) => {
          ctx.globalAlpha = (0.35 - i * 0.1) * (0.6 + Math.sin(Date.now() / 300 + i) * 0.4);
          ctx.strokeStyle = "rgba(108,99,255,0.35)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
          ctx.stroke();
        });
        ctx.restore();
      }
      const eyeY = cy - r * 0.18;
      const eyeSpacing = r * 0.34;
      const eyeR = r * 0.1;
      [-1, 1].forEach((side) => {
        const ex = cx + side * eyeSpacing;
        const eg = ctx.createRadialGradient(ex - 1, eyeY - 1, 1, ex, eyeY, eyeR);
        eg.addColorStop(0, "#a78bfa");
        eg.addColorStop(1, "#6c63ff");
        ctx.fillStyle = eg;
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eyeR, eyeR * blinkState, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0d0a26";
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eyeR * 0.48, eyeR * 0.48 * blinkState, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath();
        ctx.arc(ex - eyeR * 0.25, eyeY - eyeR * 0.25, eyeR * 0.18 * blinkState, 0, Math.PI * 2);
        ctx.fill();
      });
      const mouthY = cy + r * 0.3;
      const mouthW = r * 0.42;
      const mouthH = r * 0.18 * (0.2 + mouthOpen * 0.8);
      ctx.fillStyle = "#0d0a26";
      ctx.beginPath();
      ctx.ellipse(cx, mouthY, mouthW, mouthH + r * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();
      if (mouthOpen > 0.1) {
        ctx.fillStyle = "#1a0a2e";
        ctx.beginPath();
        ctx.ellipse(cx, mouthY, mouthW * 0.88, mouthH * 0.88, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.ellipse(cx, mouthY - mouthH * 0.3, mouthW * 0.55, mouthH * 0.38, 0, 0, Math.PI);
        ctx.fill();
      }
      const hg = ctx.createLinearGradient(cx - r, cy - r, cx + r * 0.3, cy - r * 1.1);
      hg.addColorStop(0, "#3730a3");
      hg.addColorStop(1, "#6c63ff");
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI * 1.1, Math.PI * 1.9);
      ctx.quadraticCurveTo(cx + r * 0.1, cy - r * 1.25, cx - r * 0.6, cy - r * 1.05);
      ctx.fill();
      ctx.fillStyle = "#1e1b4b";
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.82, r * 0.55, r * 0.28, 0, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = "#312e81";
      ctx.fillRect(cx - r * 0.38, cy + r * 0.9, r * 0.76, r * 0.4);
      ctx.fillStyle = "#6c63ff";
      ctx.beginPath();
      ctx.roundRect(cx - r * 0.38, cy + r * 0.9, r * 0.76, r * 0.12, 4);
      ctx.fill();
      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [mouthOpen, blinkState, isSpeaking]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-night-800 rounded-2xl overflow-hidden">
      <canvas ref={canvasRef} width={280} height={280} className="w-full h-full object-contain" />
      {isSpeaking && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-primary-500/20 border border-primary-500/30 px-2 py-1 rounded-full"
          role="status"
          aria-live="polite"
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-1 rounded-full bg-primary-400" style={{ height: "12px", animation: `sb 0.6s ease-in-out ${i * 0.15}s infinite alternate` }} />
          ))}
          <span className="text-[9px] text-primary-300 font-mono ml-1">SPEAKING</span>
        </div>
      )}
      <style>{`@keyframes sb { from { transform: scaleY(0.3); } to { transform: scaleY(1); } }`}</style>
    </div>
  );
}