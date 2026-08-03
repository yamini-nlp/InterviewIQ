"use client";
import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  text: string;
  speaking: boolean;
  onSpeakEnd?: () => void;
  thinking?: boolean;
  listening?: boolean;
}

export function InterviewerAvatar({ text, speaking, onSpeakEnd, thinking = false, listening = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const mouthOpenRef = useRef(0);
  const mouthTargetRef = useRef(0);
  const blinkStateRef = useRef(1);
  const gazeRef = useRef({ x: 0, y: 0 });
  const gazeTargetRef = useRef({ x: 0, y: 0 });
  const nextGazeShiftRef = useRef(0);
  const browRaiseRef = useRef(0);
  const browRaiseTargetRef = useRef(0);
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
    mouthTargetRef.current = 0;
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
        blinkStateRef.current = 0;
        setTimeout(() => { blinkStateRef.current = 1; scheduleBlink(); }, 120);
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
        mouthTimer.current = setInterval(() => {
          mouthTargetRef.current = Math.random() * 0.85 + 0.15;
          if (Math.random() < 0.12) browRaiseTargetRef.current = Math.random() * 0.6;
        }, 110);
      };
      utterance.onend = () => {
        if (mouthTimer.current) clearInterval(mouthTimer.current);
        mouthTargetRef.current = 0;
        browRaiseTargetRef.current = 0;
        setIsSpeaking(false);
        onSpeakEnd?.();
      };
      utterance.onerror = () => {
        if (mouthTimer.current) clearInterval(mouthTimer.current);
        mouthTargetRef.current = 0;
        browRaiseTargetRef.current = 0;
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
    browRaiseTargetRef.current = thinking ? 0.55 : listening ? 0.3 : 0;
  }, [thinking, listening]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const now = Date.now();

      mouthOpenRef.current += (mouthTargetRef.current - mouthOpenRef.current) * 0.35;
      browRaiseRef.current += (browRaiseTargetRef.current - browRaiseRef.current) * 0.12;

      if (now > nextGazeShiftRef.current) {
        nextGazeShiftRef.current = now + 1600 + Math.random() * 2200;
        const wander = listening ? 0.25 : isSpeaking ? 0.4 : 0.8;
        gazeTargetRef.current = {
          x: (Math.random() * 2 - 1) * wander,
          y: (Math.random() * 2 - 1) * wander * 0.5,
        };
      }
      gazeRef.current.x += (gazeTargetRef.current.x - gazeRef.current.x) * 0.06;
      gazeRef.current.y += (gazeTargetRef.current.y - gazeRef.current.y) * 0.06;

      const breathing = 1 + Math.sin(now / 1400) * (isSpeaking ? 0.004 : 0.012);
      const thinkingBob = thinking ? Math.sin(now / 260) * 2.5 : 0;
      const tiltAmplitude = isSpeaking ? 0.012 : thinking ? 0.045 : 0.028;
      const headTilt = Math.sin(now / 2600) * tiltAmplitude + Math.sin(now / 970) * (tiltAmplitude * 0.35);

      const cx = W / 2;
      const cy = H / 2 - 10 + thinkingBob;
      const r = Math.min(W, H) * 0.32 * breathing;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(headTilt);
      ctx.translate(-cx, -cy);

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
          ctx.globalAlpha = (0.35 - i * 0.1) * (0.6 + Math.sin(now / 300 + i) * 0.4);
          ctx.strokeStyle = "rgba(108,99,255,0.35)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
          ctx.stroke();
        });
        ctx.restore();
      } else if (listening) {
        ctx.save();
        ctx.globalAlpha = 0.3 + Math.sin(now / 500) * 0.15;
        ctx.strokeStyle = "rgba(52,211,153,0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (thinking) {
        ctx.save();
        for (let i = 0; i < 3; i++) {
          const phase = (now / 260 + i * 0.6) % (Math.PI * 2);
          const dotY = cy + r * 1.3 + Math.sin(phase) * 3;
          ctx.globalAlpha = 0.4 + Math.sin(phase) * 0.3;
          ctx.fillStyle = "#a78bfa";
          ctx.beginPath();
          ctx.arc(cx + (i - 1) * r * 0.22, dotY, r * 0.045, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      const eyeY = cy - r * 0.18;
      const eyeSpacing = r * 0.34;
      const eyeR = r * 0.1;
      const gazeDx = gazeRef.current.x * eyeR * 0.35;
      const gazeDy = gazeRef.current.y * eyeR * 0.35;

      [-1, 1].forEach((side) => {
        const ex = cx + side * eyeSpacing;
        const browY = eyeY - eyeR * 1.9 - browRaiseRef.current * eyeR * 0.9;
        const browTilt = thinking ? side * 0.22 : 0;
        ctx.save();
        ctx.translate(ex, browY);
        ctx.rotate(browTilt);
        ctx.strokeStyle = "rgba(167,139,250,0.75)";
        ctx.lineWidth = eyeR * 0.32;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-eyeR * 0.62, 0);
        ctx.quadraticCurveTo(0, -eyeR * 0.32, eyeR * 0.62, 0);
        ctx.stroke();
        ctx.restore();

        const eg = ctx.createRadialGradient(ex - 1, eyeY - 1, 1, ex, eyeY, eyeR);
        eg.addColorStop(0, "#a78bfa");
        eg.addColorStop(1, "#6c63ff");
        ctx.fillStyle = eg;
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eyeR, eyeR * blinkStateRef.current, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#0d0a26";
        ctx.beginPath();
        ctx.ellipse(ex + gazeDx, eyeY + gazeDy, eyeR * 0.48, eyeR * 0.48 * blinkStateRef.current, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath();
        ctx.arc(ex + gazeDx - eyeR * 0.25, eyeY + gazeDy - eyeR * 0.25, eyeR * 0.18 * blinkStateRef.current, 0, Math.PI * 2);
        ctx.fill();
      });

      const mouthY = cy + r * 0.3;
      const mouthW = r * 0.42;

      if (mouthOpenRef.current > 0.12) {
        const mouthH = r * 0.18 * (0.2 + mouthOpenRef.current * 0.8);
        ctx.fillStyle = "#0d0a26";
        ctx.beginPath();
        ctx.ellipse(cx, mouthY, mouthW, mouthH + r * 0.04, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1a0a2e";
        ctx.beginPath();
        ctx.ellipse(cx, mouthY, mouthW * 0.88, mouthH * 0.88, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.ellipse(cx, mouthY - mouthH * 0.3, mouthW * 0.55, mouthH * 0.38, 0, 0, Math.PI);
        ctx.fill();
      } else {
        const moodCurve = thinking ? -0.1 : listening ? 0.55 : 0.4;
        const curveDepth = r * 0.14 * moodCurve;
        ctx.strokeStyle = "#0d0a26";
        ctx.lineWidth = r * 0.045;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(cx - mouthW * 0.7, mouthY);
        ctx.quadraticCurveTo(cx, mouthY + curveDepth, cx + mouthW * 0.7, mouthY);
        ctx.stroke();
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

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [isSpeaking, thinking, listening]);

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
      {thinking && !isSpeaking && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-1 rounded-full"
          role="status"
          aria-live="polite"
        >
          <span className="text-[9px] text-neutral-400 font-mono">THINKING</span>
        </div>
      )}
      {listening && !isSpeaking && !thinking && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-full"
          role="status"
          aria-live="polite"
        >
          <span className="text-[9px] text-green-400 font-mono">LISTENING</span>
        </div>
      )}
      <style>{`@keyframes sb { from { transform: scaleY(0.3); } to { transform: scaleY(1); } }`}</style>
    </div>
  );
}