"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useCamera } from "@/hooks/useCamera";
import { VideoOff, PauseCircle } from "lucide-react";
import { MLIMAnalysis } from "@/types/mlim";

export interface FaceDetectionData {
  x: number; y: number; width: number; height: number;
  expressions: Record<string, number>;
  dominantExpression: string;
  confidence: number;
}

interface Props {
  isSpeaking?: boolean;
  mlimAnalysis?: MLIMAnalysis | null;
  mlimAnalyzing?: boolean;
  onFaceData?: (data: FaceDetectionData | null) => void;
  suspended?: boolean;
}

const EC: Record<string, string> = { happy: "#10b981", sad: "#60a5fa", angry: "#ef4444", fearful: "#f59e0b", disgusted: "#a855f7", surprised: "#06b6d4", neutral: "#9ca3af" };
function ec(e: string) { return EC[e] || "#9ca3af"; }

export function VideoPanel({ isSpeaking = false, mlimAnalysis = null, mlimAnalyzing = false, onFaceData, suspended = false }: Props) {
  const { videoRef, active, error, startCamera, stopCamera } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const faceApiRef = useRef<any>(null);
  const [faceData, setFaceData] = useState<FaceDetectionData | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const onFaceDataRef = useRef(onFaceData);
  useEffect(() => { onFaceDataRef.current = onFaceData; }, [onFaceData]);

  useEffect(() => { startCamera(); return () => { stopCamera(); }; }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const faceapi = await import("face-api.js");
        faceApiRef.current = faceapi;
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceExpressionNet.loadFromUri("/models"),
        ]);
        setModelsLoaded(true);
      } catch {}
    };
    load();
  }, []);

  useEffect(() => {
    if (!active || !modelsLoaded || !faceApiRef.current || suspended) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }
    const faceapi = faceApiRef.current;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const detect = async () => {
      if (video.readyState < 2) { animRef.current = requestAnimationFrame(detect); return; }
      const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 })).withFaceExpressions();
      const ctx = canvas.getContext("2d");
      if (!ctx) { animRef.current = requestAnimationFrame(detect); return; }
      canvas.width = video.videoWidth || canvas.offsetWidth;
      canvas.height = video.videoHeight || canvas.offsetHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-canvas.width, 0);
      if (detection) {
        const { box } = detection.detection;
        const exprs = detection.expressions as Record<string, number>;
        const dominant = Object.entries(exprs).sort((a, b) => b[1] - a[1])[0];
        const color = ec(dominant[0]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.strokeRect(box.x, box.y, box.width, box.height);
        ctx.shadowBlur = 0;
        const cl = 12;
        ctx.lineWidth = 2.5;
        [[box.x, box.y, cl, 0, 0, cl], [box.x + box.width, box.y, -cl, 0, 0, cl], [box.x, box.y + box.height, cl, 0, 0, -cl], [box.x + box.width, box.y + box.height, -cl, 0, 0, -cl]].forEach(([cx, cy, dx1, dy1, dx2, dy2]) => {
          ctx.beginPath(); ctx.moveTo(cx + dx1, cy + dy1); ctx.lineTo(cx, cy); ctx.lineTo(cx + dx2, cy + dy2); ctx.stroke();
        });
        ctx.font = "bold 9px monospace"; ctx.fillStyle = "#facc15"; ctx.shadowColor = "#000"; ctx.shadowBlur = 3;
        ctx.fillText(`${dominant[0].toUpperCase()} ${(dominant[1] * 100).toFixed(0)}%`, box.x, box.y - 5);
        ctx.shadowBlur = 0;
        const fd: FaceDetectionData = { x: Math.round(canvas.width - box.x - box.width), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height), expressions: exprs, dominantExpression: dominant[0], confidence: detection.detection.score };
        setFaceData(fd);
        onFaceDataRef.current?.(fd);
      } else {
        setFaceData(null);
        onFaceDataRef.current?.(null);
      }
      ctx.restore();
      animRef.current = requestAnimationFrame(detect);
    };
    detect();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [active, modelsLoaded, suspended]);

  return (
    <div className="relative rounded-2xl overflow-hidden bg-night-800 border border-white/5 w-full h-full">
      <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ transform: "none" }} />

      {suspended && (
        <div className="absolute inset-0 bg-night-900/95 flex flex-col items-center justify-center gap-3 z-20">
          <PauseCircle size={36} className="text-red-400" />
          <p className="text-sm text-red-400 font-mono font-bold">CAMERA SUSPENDED</p>
          <p className="text-xs text-gray-500 font-mono">Return to window to resume</p>
        </div>
      )}

      {!active && !suspended && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-500 bg-night-800">
          <VideoOff size={32} />
          <p className="text-sm">{error || "Starting camera..."}</p>
        </div>
      )}

      {mlimAnalyzing && !suspended && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-lg border border-accent/20">
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <span className="text-[9px] text-accent font-mono">ANALYZING</span>
        </div>
      )}

      {faceData && !suspended && (
        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded border border-white/10">
          <span className="text-[9px] font-bold font-mono uppercase" style={{ color: ec(faceData.dominantExpression) }}>{faceData.dominantExpression}</span>
          <span className="text-[8px] text-gray-500 font-mono ml-1">{(faceData.confidence * 100).toFixed(0)}%</span>
        </div>
      )}

      {mlimAnalysis && !suspended && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-2 pt-6 pb-2 space-y-1">
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { l: "SENTIMENT", v: mlimAnalysis.asl.sentiment.toUpperCase(), c: mlimAnalysis.asl.sentiment === "positive" ? "#10b981" : mlimAnalysis.asl.sentiment === "negative" ? "#ef4444" : "#9ca3af" },
              { l: "ENGAGEMENT", v: `${(mlimAnalysis.gstl.engagement_level * 100).toFixed(0)}%`, c: "#60a5fa" },
              { l: "READINESS", v: `${(mlimAnalysis.gstl.readiness_estimate * 100).toFixed(0)}%`, c: "#10b981" },
            ].map((x) => (
              <div key={x.l} className="text-center">
                <p className="text-[7px] text-gray-500 font-mono">{x.l}</p>
                <p className="text-[10px] font-bold font-mono" style={{ color: x.c }}>{x.v}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-mono font-bold uppercase" style={{ color: (() => { const m: Record<string, string> = { genuine_answer: "#10b981", face_saving_assertion: "#f59e0b", sarcastic_response: "#ef4444" }; return m[mlimAnalysis.ifl.intent_label] || "#a78bfa"; })() }}>{mlimAnalysis.ifl.intent_label.replace(/_/g, " ")}</span>
            {mlimAnalysis.gstl.stress_indicators > 0.6 && <span className="text-[8px] text-red-400 font-mono bg-red-500/15 px-1 py-0.5 rounded">HIGH STRESS</span>}
          </div>
        </div>
      )}

      <div className="absolute bottom-1.5 left-2 z-10">
        <span className="text-[8px] text-gray-400 bg-black/50 px-1 py-0.5 rounded font-mono border border-white/10">YOU</span>
      </div>
      {isSpeaking && !suspended && (
        <div className="absolute bottom-1.5 right-2 z-10 flex items-center gap-1 bg-accent/20 border border-accent/30 px-1.5 py-0.5 rounded backdrop-blur-sm">
          <div className="w-1 h-1 rounded-full bg-accent animate-pulse" />
          <span className="text-[8px] text-accent font-mono">MIC ON</span>
        </div>
      )}
      <div className={`absolute inset-0 border-2 rounded-2xl transition-all duration-300 pointer-events-none ${isSpeaking && !suspended ? "border-accent/60" : "border-transparent"}`} />
    </div>
  );
}