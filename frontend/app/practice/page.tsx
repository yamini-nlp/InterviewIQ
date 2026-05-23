"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { loadSession, saveSession } from "@/lib/storage";
import { evaluateAnswer, generateReport, transcribeAudio } from "@/lib/api";
import { Question, Feedback } from "@/types";
import { Navbar } from "@/components/layout/Navbar";
import { VideoPanel, FaceDetectionData } from "@/components/interview/VideoPanel";
import { FeedbackCard } from "@/components/interview/FeedbackCard";
import { TimerBar } from "@/components/interview/TimerBar";
import { InterviewerAvatar } from "@/components/interview/InterviewerAvatar";
import { LiveAnalyticsPanel } from "@/components/interview/LiveAnalyticsPanel";
import { Button } from "@/components/ui/Button";
import { useMLIM } from "@/hooks/useMLIM";
import { useCheatingDetection } from "@/hooks/useCheatingDetection";
import { Loader2, ChevronRight, AlertTriangle, Mic, MicOff, Keyboard, Volume2, VolumeX } from "lucide-react";

type InputMode = "text" | "voice";

export default function Practice() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [avatarSpeaking, setAvatarSpeaking] = useState(false);
  const [avatarText, setAvatarText] = useState("");
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [faceData, setFaceData] = useState<FaceDetectionData | null>(null);
  const [suspended, setSuspended] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mlim = useMLIM();
  const cheating = useCheatingDetection(true);

  useEffect(() => {
    const s = loadSession();
    if (!s) { router.push("/setup"); return; }
    setSession(s);
    const q = s.questions[0]?.text || "";
    const intro = `Welcome. Let's begin your ${s.job_role} practice session.\n\n${q}`;
    if (ttsEnabled) { setAvatarText(intro); setAvatarSpeaking(true); }
    else setTimerActive(true);
  }, []);

  useEffect(() => {
    const onHide = () => setSuspended(true);
    const onShow = () => setSuspended(false);
    const onBlur = () => setSuspended(true);
    const onFocus = () => setSuspended(false);
    document.addEventListener("visibilitychange", () => { if (document.hidden) onHide(); else onShow(); });
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const speak = useCallback((text: string) => {
    if (!ttsEnabled) { setTimerActive(true); return; }
    setAvatarText(text);
    setAvatarSpeaking(true);
  }, [ttsEnabled]);

  const handleAvatarEnd = useCallback(() => {
    setAvatarSpeaking(false);
    setTimerActive(true);
  }, []);

  const handleSubmit = useCallback(async (overrideAnswer?: string) => {
    const ans = overrideAnswer ?? answer;
    if (!ans.trim() || loading || !session) return;
    setLoading(true);
    setTimerActive(false);
    const questions: Question[] = session.questions;
    const current = questions[currentIndex];
    try {
      const [fb] = await Promise.all([
        evaluateAnswer({ session_id: session.session_id, question_id: current.id, question_text: current.text, question_category: current.category, question_difficulty: current.difficulty, answer_text: ans, job_role: session.job_role }),
        mlim.analyze({ sessionId: session.session_id, questionId: current.id, questionText: current.text, answerText: ans, jobRole: session.job_role }),
      ]);
      setFeedback(fb);
      const fbText = `Score: ${fb.score} out of 10. ${fb.feedback || ""}`;
      speak(fbText.slice(0, 180));
    } catch {}
    finally { setLoading(false); }
  }, [answer, loading, session, currentIndex, mlim, speak]);

  const handleNext = useCallback(async () => {
    if (!session) return;
    const questions: Question[] = session.questions;
    const isLast = currentIndex === questions.length - 1;
    if (isLast) {
      const report = await generateReport(session.session_id);
      saveSession({ ...session, report });
      router.push(`/report/${session.session_id}`);
    } else {
      const next = questions[currentIndex + 1];
      setCurrentIndex((i) => i + 1);
      setAnswer("");
      setFeedback(null);
      setTimerKey((k) => k + 1);
      setTimerActive(false);
      speak(next.text);
    }
  }, [session, currentIndex, router, speak]);

  const handleTimeout = useCallback(() => {
    if (!feedback && answer.trim()) handleSubmit();
    else if (!feedback) handleSubmit("(No answer provided)");
  }, [feedback, answer, handleSubmit]);

  const startRecording = useCallback(async () => {
    if (isRecording || transcribing || suspended) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        if (micStreamRef.current) { micStreamRef.current.getTracks().forEach((t) => t.stop()); micStreamRef.current = null; }
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setTranscribing(true);
        try { const { transcript } = await transcribeAudio(blob); if (transcript.trim()) setAnswer(transcript); }
        catch {} finally { setTranscribing(false); }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {}
  }, [isRecording, transcribing, suspended]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
    setIsRecording(false);
  }, []);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (!session) return null;
  const questions: Question[] = session.questions;
  const current = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const summary = cheating.getSummary();

  return (
    <div className="min-h-screen bg-night-950 flex flex-col overflow-hidden">
      <Navbar />

      {cheating.showWarning && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-red-500/90 backdrop-blur-sm text-white px-4 py-2.5 rounded-xl shadow-lg border border-red-400/50 animate-fade-in">
          <AlertTriangle size={16} />
          <span className="text-sm font-medium">{cheating.warningMessage}</span>
        </div>
      )}

      {suspended && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center gap-4">
          <AlertTriangle size={48} className="text-red-400" />
          <p className="text-xl font-bold text-red-400">Session Suspended</p>
          <p className="text-gray-400 text-sm">Camera & microphone disabled. Click here or return to window.</p>
          <button onClick={() => setSuspended(false)} className="px-6 py-2.5 bg-accent rounded-xl text-white font-medium text-sm">Resume Session</button>
        </div>
      )}

      <main className="flex-1 pt-16 flex overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
        <div className="flex w-full h-full">
          <div className="flex-1 flex flex-col p-3 gap-3 min-w-0">
            <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden">
              <VideoPanel
                isSpeaking={isRecording}
                mlimAnalysis={mlim.latestAnalysis}
                mlimAnalyzing={mlim.isAnalyzing}
                onFaceData={setFaceData}
                suspended={suspended}
              />
              <div className="absolute top-2 right-2 w-32 h-24 rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-night-800 z-20">
                <InterviewerAvatar text={avatarText} speaking={avatarSpeaking && !suspended} onSpeakEnd={handleAvatarEnd} />
                <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2">
                  <span className="text-[7px] text-gray-500 bg-black/50 px-1 py-0.5 rounded font-mono">AI INTERVIEWER</span>
                </div>
              </div>
              <button
                onClick={() => setTtsEnabled((v) => !v)}
                className={`absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-mono border backdrop-blur-sm transition-all ${ttsEnabled ? "bg-accent/20 border-accent/30 text-accent" : "bg-black/50 border-white/10 text-gray-500"}`}
              >
                {ttsEnabled ? <><Volume2 size={9} /> TTS ON</> : <><VolumeX size={9} /> TTS OFF</>}
              </button>
            </div>

            <div className="glass rounded-2xl flex-shrink-0" style={{ height: "240px" }}>
              <div className="px-4 pt-3 pb-2 border-b border-white/5">
                <div className="flex items-start gap-2">
                  <span className="text-[9px] text-gray-600 font-mono mt-0.5 flex-shrink-0">Q{currentIndex + 1}/{questions.length}</span>
                  <p className="text-sm text-gray-200 leading-snug line-clamp-2">{current?.text}</p>
                </div>
              </div>

              {!feedback ? (
                <div className="px-4 py-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1.5">
                      <button onClick={() => setInputMode("text")} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-mono border transition-all ${inputMode === "text" ? "bg-accent/20 border-accent/30 text-accent" : "bg-white/5 border-white/10 text-gray-500"}`}>
                        <Keyboard size={9} /> TEXT
                      </button>
                      <button onClick={() => setInputMode("voice")} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-mono border transition-all ${inputMode === "voice" ? "bg-accent/20 border-accent/30 text-accent" : "bg-white/5 border-white/10 text-gray-500"}`}>
                        <Mic size={9} /> VOICE
                      </button>
                    </div>
                    {timerActive && (
                      <div className="w-28">
                        <TimerBar key={timerKey} duration={120} onTimeout={handleTimeout} />
                      </div>
                    )}
                  </div>

                  {inputMode === "text" ? (
                    <div className="flex gap-2">
                      <textarea
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && answer.trim()) { e.preventDefault(); handleSubmit(); } }}
                        placeholder="Type your answer... (Enter to submit)"
                        rows={3}
                        disabled={loading || !!feedback || suspended}
                        className="flex-1 rounded-xl px-3 py-2 text-sm resize-none disabled:opacity-50"
                      />
                      <Button onClick={() => handleSubmit()} disabled={!answer.trim() || loading || !!feedback || suspended} className="flex-shrink-0 px-3">
                        {loading ? <Loader2 size={14} className="animate-spin" /> : "Submit"}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {transcribing ? (
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Loader2 size={13} className="animate-spin" /> Transcribing...
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={isRecording ? stopRecording : startRecording}
                            disabled={!!feedback || loading || suspended}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${isRecording ? "bg-red-500/20 border-red-500/40 text-red-400 animate-pulse" : "bg-accent/15 border-accent/30 text-accent hover:bg-accent/25"}`}
                          >
                            {isRecording ? <><MicOff size={13} /> Stop</> : <><Mic size={13} /> Record</>}
                          </button>
                          {answer && !isRecording && (
                            <Button onClick={() => handleSubmit()} disabled={loading || !!feedback} className="flex-shrink-0 px-3">Submit</Button>
                          )}
                        </div>
                      )}
                      {answer && (
                        <div className="bg-white/5 rounded-xl px-3 py-1.5 border border-white/10">
                          <p className="text-xs text-gray-300 line-clamp-2">{answer}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-4 py-2.5 space-y-2 overflow-y-auto" style={{ maxHeight: "180px" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-gray-500 font-mono">SCORE</span>
                    <span className="text-sm font-bold" style={{ color: feedback.score >= 7 ? "#10b981" : feedback.score >= 5 ? "#f59e0b" : "#ef4444" }}>{feedback.score}/10</span>
                  </div>
                  {feedback.feedback && <p className="text-xs text-gray-400 line-clamp-3">{feedback.feedback}</p>}
                  <Button
                    onClick={handleNext}
                    disabled={avatarSpeaking}
                    className="w-full"
                    size="sm"
                  >
                    {avatarSpeaking ? <><div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse mr-2" />Speaking...</> : isLast ? "View Report" : <>Next <ChevronRight size={13} /></>}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="w-60 flex-shrink-0 border-l border-white/5 p-2.5 pt-3 overflow-hidden flex flex-col bg-night-900">
            <LiveAnalyticsPanel
              mlimAnalysis={mlim.latestAnalysis}
              mlimAnalyzing={mlim.isAnalyzing}
              faceData={faceData}
              currentQuestionIndex={currentIndex}
              totalQuestions={questions.length}
              integrityScore={summary.integrity_score}
              tabSwitches={summary.tab_switches}
              windowBlurs={summary.window_blurs}
              copyPastes={summary.copy_pastes}
              suspended={suspended}
            />
          </div>
        </div>
      </main>
    </div>
  );
}