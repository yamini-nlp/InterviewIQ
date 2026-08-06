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
        const wander = listening ? 0.2 : isSpeaking ? 0.32 : 0.6;
        gazeTargetRef.current = {
          x: (Math.random() * 2 - 1) * wander,
          y: (Math.random() * 2 - 1) * wander * 0.4,
        };
      }
      gazeRef.current.x += (gazeTargetRef.current.x - gazeRef.current.x) * 0.06;
      gazeRef.current.y += (gazeTargetRef.current.y - gazeRef.current.y) * 0.06;

      const breathing = 1 + Math.sin(now / 1500) * (isSpeaking ? 0.003 : 0.008);
      const thinkingBob = thinking ? Math.sin(now / 280) * 1.6 : 0;
      const tiltAmplitude = isSpeaking ? 0.008 : thinking ? 0.03 : 0.018;
      const headTilt = Math.sin(now / 2800) * tiltAmplitude + Math.sin(now / 1100) * (tiltAmplitude * 0.3);

      const cx = W / 2;
      const cy = H / 2 - 6 + thinkingBob;
      const r = Math.min(W, H) * 0.3 * breathing;

      const bg = ctx.createRadialGradient(cx, cy - r * 0.2, r * 0.4, cx, H * 0.55, W * 0.75);
      bg.addColorStop(0, "#20242f");
      bg.addColorStop(1, "#0c0e14");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(headTilt);
      ctx.translate(-cx, -cy);

      if (isSpeaking) {
        ctx.save();
        [1.32, 1.46, 1.6].forEach((scale, i) => {
          ctx.globalAlpha = (0.22 - i * 0.06) * (0.6 + Math.sin(now / 320 + i) * 0.4);
          ctx.strokeStyle = "rgba(201,162,75,0.5)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(cx, cy - r * 0.1, r * scale, 0, Math.PI * 2);
          ctx.stroke();
        });
        ctx.restore();
      } else if (listening) {
        ctx.save();
        ctx.globalAlpha = 0.28 + Math.sin(now / 550) * 0.12;
        ctx.strokeStyle = "rgba(120,196,164,0.55)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(cx, cy - r * 0.1, r * 1.36, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (thinking) {
        ctx.save();
        for (let i = 0; i < 3; i++) {
          const phase = (now / 280 + i * 0.6) % (Math.PI * 2);
          const dotY = cy + r * 1.55 + Math.sin(phase) * 2.5;
          ctx.globalAlpha = 0.35 + Math.sin(phase) * 0.25;
          ctx.fillStyle = "#c9a24b";
          ctx.beginPath();
          ctx.arc(cx + (i - 1) * r * 0.2, dotY, r * 0.035, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      const shoulderY = cy + r * 1.62;
      const shoulderW = r * 1.85;
      const blazerGrad = ctx.createLinearGradient(cx - shoulderW, shoulderY, cx + shoulderW, shoulderY + r * 0.9);
      blazerGrad.addColorStop(0, "#1b2233");
      blazerGrad.addColorStop(0.5, "#232c42");
      blazerGrad.addColorStop(1, "#161c2b");
      ctx.fillStyle = blazerGrad;
      ctx.beginPath();
      ctx.moveTo(cx - shoulderW, H + 20);
      ctx.quadraticCurveTo(cx - shoulderW, shoulderY, cx - r * 0.55, cy + r * 0.98);
      ctx.quadraticCurveTo(cx, cy + r * 1.18, cx + r * 0.55, cy + r * 0.98);
      ctx.quadraticCurveTo(cx + shoulderW, shoulderY, cx + shoulderW, H + 20);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#f4ead9";
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.24, cy + r * 1.02);
      ctx.lineTo(cx, cy + r * 1.5);
      ctx.lineTo(cx + r * 0.24, cy + r * 1.02);
      ctx.quadraticCurveTo(cx, cy + r * 1.16, cx - r * 0.24, cy + r * 1.02);
      ctx.fill();

      ctx.strokeStyle = "#c9a24b";
      ctx.lineWidth = r * 0.03;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.06, cy + r * 1.08);
      ctx.lineTo(cx - r * 0.11, cy + r * 1.42);
      ctx.lineTo(cx, cy + r * 1.58);
      ctx.lineTo(cx + r * 0.11, cy + r * 1.42);
      ctx.lineTo(cx + r * 0.06, cy + r * 1.08);
      ctx.stroke();

      const neckGrad = ctx.createLinearGradient(cx, cy + r * 0.6, cx, cy + r * 1.1);
      neckGrad.addColorStop(0, "#e8c5a8");
      neckGrad.addColorStop(1, "#d3a988");
      ctx.fillStyle = neckGrad;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.22, cy + r * 0.62);
      ctx.lineTo(cx - r * 0.26, cy + r * 1.05);
      ctx.lineTo(cx + r * 0.26, cy + r * 1.05);
      ctx.lineTo(cx + r * 0.22, cy + r * 0.62);
      ctx.closePath();
      ctx.fill();

      const faceGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.15, cx, cy, r * 1.05);
      faceGrad.addColorStop(0, "#f2d3b6");
      faceGrad.addColorStop(0.55, "#e6bb98");
      faceGrad.addColorStop(1, "#c99b78");
      ctx.fillStyle = faceGrad;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.72, cy - r * 0.35);
      ctx.quadraticCurveTo(cx - r * 0.78, cy + r * 0.35, cx - r * 0.42, cy + r * 0.78);
      ctx.quadraticCurveTo(cx, cy + r * 1.02, cx + r * 0.42, cy + r * 0.78);
      ctx.quadraticCurveTo(cx + r * 0.78, cy + r * 0.35, cx + r * 0.72, cy - r * 0.35);
      ctx.quadraticCurveTo(cx + r * 0.62, cy - r * 0.92, cx, cy - r * 1.02);
      ctx.quadraticCurveTo(cx - r * 0.62, cy - r * 0.92, cx - r * 0.72, cy - r * 0.35);
      ctx.closePath();
      ctx.fill();

      const hairGrad = ctx.createLinearGradient(cx - r * 0.8, cy - r * 1.1, cx + r * 0.8, cy - r * 0.2);
      hairGrad.addColorStop(0, "#171a22");
      hairGrad.addColorStop(1, "#2a2f3d");
      ctx.fillStyle = hairGrad;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.78, cy - r * 0.28);
      ctx.quadraticCurveTo(cx - r * 0.9, cy - r * 1.05, cx - r * 0.18, cy - r * 1.28);
      ctx.quadraticCurveTo(cx + r * 0.55, cy - r * 1.32, cx + r * 0.82, cy - r * 0.85);
      ctx.quadraticCurveTo(cx + r * 0.9, cy - r * 0.5, cx + r * 0.7, cy - r * 0.32);
      ctx.quadraticCurveTo(cx + r * 0.5, cy - r * 0.68, cx + r * 0.1, cy - r * 0.78);
      ctx.quadraticCurveTo(cx - r * 0.35, cy - r * 0.82, cx - r * 0.58, cy - r * 0.5);
      ctx.quadraticCurveTo(cx - r * 0.68, cy - r * 0.36, cx - r * 0.78, cy - r * 0.28);
      ctx.closePath();
      ctx.fill();

      const eyeY = cy - r * 0.06;
      const eyeSpacing = r * 0.33;
      const eyeW = r * 0.16;
      const eyeH = r * 0.09;
      const gazeDx = gazeRef.current.x * eyeW * 0.3;
      const gazeDy = gazeRef.current.y * eyeH * 0.3;

      [-1, 1].forEach((side) => {
        const ex = cx + side * eyeSpacing;
        const browY = eyeY - eyeH * 2.1 - browRaiseRef.current * eyeH * 0.8;
        const browTilt = thinking ? side * 0.18 : 0.08 * -side;
        ctx.save();
        ctx.translate(ex, browY);
        ctx.rotate(browTilt);
        ctx.strokeStyle = "#3a2a1e";
        ctx.lineWidth = eyeH * 0.4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-eyeW * 0.65, 0);
        ctx.quadraticCurveTo(0, -eyeH * 0.5, eyeW * 0.65, -eyeH * 0.1);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = "#fbf6ee";
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eyeW, eyeH * Math.max(blinkStateRef.current, 0.06), 0, 0, Math.PI * 2);
        ctx.fill();

        const irisGrad = ctx.createRadialGradient(ex + gazeDx, eyeY + gazeDy, 1, ex + gazeDx, eyeY + gazeDy, eyeH * 0.85);
        irisGrad.addColorStop(0, "#5b7a99");
        irisGrad.addColorStop(1, "#2f4053");
        ctx.fillStyle = irisGrad;
        ctx.beginPath();
        ctx.ellipse(ex + gazeDx, eyeY + gazeDy, eyeH * 0.85, eyeH * 0.85 * blinkStateRef.current, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#171a22";
        ctx.beginPath();
        ctx.ellipse(ex + gazeDx, eyeY + gazeDy, eyeH * 0.42, eyeH * 0.42 * blinkStateRef.current, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.arc(ex + gazeDx - eyeH * 0.22, eyeY + gazeDy - eyeH * 0.22, eyeH * 0.16 * blinkStateRef.current, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#3a2a1e";
        ctx.lineWidth = eyeH * 0.16;
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eyeW, eyeH * Math.max(blinkStateRef.current, 0.06), 0, 0, Math.PI * 2);
        ctx.stroke();
      });

      ctx.strokeStyle = "rgba(120,80,60,0.35)";
      ctx.lineWidth = r * 0.02;
      ctx.beginPath();
      ctx.moveTo(cx, cy + r * 0.06);
      ctx.quadraticCurveTo(cx + r * 0.05, cy + r * 0.2, cx, cy + r * 0.26);
      ctx.stroke();

      const mouthY = cy + r * 0.44;
      const mouthW = r * 0.28;

      if (mouthOpenRef.current > 0.12) {
        const mouthH = r * 0.12 * (0.2 + mouthOpenRef.current * 0.8);
        ctx.fillStyle = "#7a3b3b";
        ctx.beginPath();
        ctx.ellipse(cx, mouthY, mouthW, mouthH + r * 0.02, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#4a2020";
        ctx.beginPath();
        ctx.ellipse(cx, mouthY, mouthW * 0.86, mouthH * 0.86, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,250,244,0.92)";
        ctx.beginPath();
        ctx.ellipse(cx, mouthY - mouthH * 0.32, mouthW * 0.5, mouthH * 0.32, 0, 0, Math.PI);
        ctx.fill();
      } else {
        const moodCurve = thinking ? -0.08 : listening ? 0.4 : 0.3;
        const curveDepth = r * 0.1 * moodCurve;
        ctx.strokeStyle = "#8a4b48";
        ctx.lineWidth = r * 0.032;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(cx - mouthW * 0.75, mouthY);
        ctx.quadraticCurveTo(cx, mouthY + curveDepth, cx + mouthW * 0.75, mouthY);
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(201,162,75,0.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.02, r * 1.18, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [isSpeaking, thinking, listening]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[#0c0e14] rounded-2xl overflow-hidden border border-[#c9a24b]/10">
      <canvas ref={canvasRef} width={280} height={280} className="w-full h-full object-contain" />
      {isSpeaking && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#c9a24b]/10 border border-[#c9a24b]/25 px-2.5 py-1 rounded-full backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-1 rounded-full bg-[#c9a24b]" style={{ height: "10px", animation: `sb 0.6s ease-in-out ${i * 0.15}s infinite alternate` }} />
          ))}
          <span className="text-[9px] tracking-[0.14em] text-[#e8cf9a] font-serif ml-1">SPEAKING</span>
        </div>
      )}
      {thinking && !isSpeaking && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <span className="text-[9px] tracking-[0.14em] text-neutral-300 font-serif">THINKING</span>
        </div>
      )}
      {listening && !isSpeaking && !thinking && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-[#78c4a4]/10 border border-[#78c4a4]/25 px-2.5 py-1 rounded-full backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <span className="text-[9px] tracking-[0.14em] text-[#a7dcc3] font-serif">LISTENING</span>
        </div>
      )}
      <style>{`@keyframes sb { from { transform: scaleY(0.3); } to { transform: scaleY(1); } }`}</style>
    </div>
  );
}