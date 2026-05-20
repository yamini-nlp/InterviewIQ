"use client";
import { useEffect } from "react";
import { useCamera } from "@/hooks/useCamera";
import { VideoOff, Mic } from "lucide-react";
import { MLIMOverlay } from "@/components/mlim/MLIMOverlay";
import { MLIMAnalysis } from "@/types/mlim";

interface Props {
  isSpeaking?: boolean;
  mlimAnalysis?: MLIMAnalysis | null;
  mlimAnalyzing?: boolean;
}

export function VideoPanel({ isSpeaking = false, mlimAnalysis = null, mlimAnalyzing = false }: Props) {
  const { videoRef, active, error, startCamera, stopCamera } = useCamera();

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="relative rounded-2xl overflow-hidden bg-night-800 border border-white/5 aspect-video w-full">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover scale-x-[-1]"
      />
      {!active && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-500">
          <VideoOff size={32} />
          <p className="text-sm">{error || "Starting camera..."}</p>
        </div>
      )}

      <MLIMOverlay analysis={mlimAnalysis} isAnalyzing={mlimAnalyzing} />

      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10">
        <span className="text-xs text-gray-400 bg-black/40 px-2 py-1 rounded-lg">You</span>
        {isSpeaking && (
          <div className="flex items-center gap-1.5 bg-accent/20 border border-accent/30 px-2 py-1 rounded-lg">
            <Mic size={12} className="text-accent animate-pulse" />
            <span className="text-xs text-accent">Speaking</span>
          </div>
        )}
      </div>
      <div className={`absolute inset-0 border-2 rounded-2xl transition-all duration-300 pointer-events-none z-10 ${isSpeaking ? "border-accent/60" : "border-transparent"}`} />
    </div>
  );
}