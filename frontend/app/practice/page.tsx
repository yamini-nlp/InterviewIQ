"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { loadSession, saveSession } from "@/lib/storage";
import { evaluateAnswer, generateReport } from "@/lib/api";
import { Question, Feedback } from "@/types";
import { VideoPanel, FaceDetectionData } from "@/components/interview/VideoPanel";
import { FeedbackCard } from "@/components/interview/FeedbackCard";
import { TimerBar } from "@/components/interview/TimerBar";
import { InterviewerAvatar } from "@/components/interview/InterviewerAvatar";
import { LiveAnalyticsPanel } from "@/components/interview/LiveAnalyticsPanel";
import { AudioRecorder } from "@/components/interview/AudioRecorder";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/hooks/useToast";
import { useCheatingDetection } from "@/hooks/useCheatingDetection";
import { unlockSpeechSynthesis } from "@/lib/speech";
import { ChevronRight, AlertTriangle, Keyboard, Mic, Volume2, VolumeX, SkipForward, Play } from "lucide-react";

type InputMode = "text" | "voice";

export default function Practice() {
  const router = useRouter();
  const { toast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [isRecording, setIsRecording] = useState(false);
  const [avatarSpeaking, setAvatarSpeaking] = useState(false);
  const [avatarText, setAvatarText] = useState("");
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [faceData, setFaceData] = useState<FaceDetectionData | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [started, setStarted] = useState(false);

  const micStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const lastAnswerRef = useRef("");
  const mlim = useMLIM();
  const cheating = useCheatingDetection(true, micStreamRef, videoStreamRef);

  useEffect(() => {
    const s = loadSession();
    if (!s) { router.push("/setup"); return; }
    setSession(s);
  }, []);

  const handleBegin = useCallback(() => {
    if (!session) return;
    unlockSpeechSynthesis();
    setStarted(true);
    const q = session.questions?.[0]?.text || "";
    const intro = `Welcome. Let's begin your ${session.job_role} practice session.\n\n${q}`;
    if (ttsEnabled) { setAvatarText(intro); setAvatarSpeaking(true); }
    else setTimerActive(true);
  }, [session, ttsEnabled]);

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
    lastAnswerRef.current = ans;
    setLoading(true);
    setFeedbackError(null);
    setTimerActive(false);
    const questions: Question[] = session.questions;
    const current = questions[currentIndex];
    try {
      const [fb, mlimResult] = await Promise.all([
        evaluateAnswer({ session_id: session.session_id, question_id: current.id, question_text: current.text, question_category: current.category, question_difficulty: current.difficulty, answer_text: ans, job_role: session.job_role }),
        mlim.analyze({ sessionId: session.session_id, questionId: current.id, questionText: current.text, answerText: ans, jobRole: session.job_role, faceSnapshot: faceData as Record<string, unknown> | null }),
      ]);
      setFeedback(fb);
      if (!mlimResult) {
        toast({
          title: "Analytics not captured",
          description: "This answer's MLIM analysis couldn't be recorded, but your feedback is unaffected.",
          variant: "warning",
        });
      }
      toast({ title: "Answer submitted", description: "Your feedback is ready.", variant: "success" });
      const fbText = `Score: ${fb.score} out of 10. ${fb.feedback || ""}`;
      speak(fbText.slice(0, 180));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not generate feedback.";
      setFeedbackError(message);
      toast({ title: "Feedback failed", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [answer, loading, session, currentIndex, mlim, speak, toast, faceData]);

  const retryFeedback = useCallback(() => {
    handleSubmit(lastAnswerRef.current);
  }, [handleSubmit]);

  const handleNext = useCallback(async () => {
    if (!session) return;
    setAvatarSpeaking(false);
    const questions: Question[] = session.questions;
    const isLast = currentIndex === questions.length - 1;
    if (isLast) {
      try {
        const report = await generateReport(session.session_id);
        saveSession({ ...session, report });
        router.push(`/report/${session.session_id}`);
      } catch (e) {
        toast({ title: "Could not generate report", description: e instanceof Error ? e.message : "Please try again.", variant: "error" });
      }
    } else {
      const next = questions[currentIndex + 1];
      setCurrentIndex((i) => i + 1);
      setAnswer("");
      setFeedback(null);
      setFeedbackError(null);
      setSkipped(false);
      setTimerKey((k) => k + 1);
      setTimerActive(false);
      speak(next.text);
    }
  }, [session, currentIndex, router, speak, toast]);

  const handleSkip = useCallback(() => {
    if (feedback || loading || !session) return;
    setTimerActive(false);
    setSkipped(true);
  }, [feedback, loading, session]);

  const handleTimeout = useCallback(() => {
    if (!feedback && answer.trim()) handleSubmit();
    else if (!feedback) handleSubmit("(No answer provided)");
  }, [feedback, answer, handleSubmit]);

  const handleTranscript = useCallback((text: string) => {
    if (text.trim()) setAnswer(text);
  }, []);

  if (!session) return null;
  const questions: Question[] = session.questions;
  const current = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const summary = cheating.getSummary();
  const showResult = loading || !!feedback || !!feedbackError;

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col overflow-hidden">

      {cheating.showWarning && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-error-500/90 backdrop-blur-sm text-white px-4 py-2.5 rounded-xl shadow-lg border border-error-400/50 animate-fade-in">
          <AlertTriangle size={16} />
          <span className="text-sm font-medium">{cheating.warningMessage}</span>
        </div>
      )}

      {cheating.suspended && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center gap-4">
          <AlertTriangle size={48} className="text-error-400" />
          <p className="text-xl font-bold text-error-400">Session Suspended</p>
          <p className="text-neutral-400 text-sm">Tab switch flagged. Camera & microphone disabled — return to this window to resume.</p>
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
                suspended={cheating.suspended}
                streamRef={videoStreamRef}
              />
              <div className="absolute top-2 right-2 w-32 h-24 rounded-xl overflow-hidden border border-neutral-200 shadow-2xl bg-neutral-100 z-20">
                <InterviewerAvatar text={avatarText} speaking={avatarSpeaking && !cheating.suspended} onSpeakEnd={handleAvatarEnd} />
                <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2">
                  <span className="text-[7px] text-neutral-500 bg-black/50 px-1 py-0.5 rounded font-mono">AI INTERVIEWER</span>
                </div>
              </div>
              <button
                onClick={() => setTtsEnabled((v) => !v)}
                className={`absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-mono border backdrop-blur-sm transition-all active:scale-95 ${ttsEnabled ? "bg-primary-500/20 border-primary-500/30 text-primary-300" : "bg-black/50 border-neutral-200 text-neutral-500"}`}
              >
                {ttsEnabled ? <><Volume2 size={9} /> TTS ON</> : <><VolumeX size={9} /> TTS OFF</>}
              </button>
            </div>

            <div className="glass rounded-2xl flex-shrink-0 flex flex-col overflow-hidden transition-shadow duration-300 hover:shadow-lg" style={{ maxHeight: "46vh" }}>
              <div className="px-4 pt-3 pb-2 border-b border-neutral-200 flex-shrink-0">
                <div className="flex items-start gap-2 mb-1.5">
                  <span className="text-[9px] text-neutral-600 font-mono mt-0.5 flex-shrink-0">Q{currentIndex + 1}/{questions.length}</span>
                  <p className="text-sm text-neutral-800 leading-snug line-clamp-2">{current?.text}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge text={current.category} type="category" size="sm" />
                  <Badge text={current.difficulty} type="difficulty" size="sm" />
                </div>
              </div>

              <div className="overflow-y-auto">
                {skipped ? (
                  <div className="px-4 py-3 space-y-3">
                    <p className="text-xs text-neutral-500">Question skipped — no feedback generated for this one.</p>
                    <Button onClick={handleNext} className="w-full active:scale-95" size="sm">
                      {isLast ? "View Report" : <>Next <ChevronRight size={13} /></>}
                    </Button>
                  </div>
                ) : !showResult ? (
                  <div className="px-4 py-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1.5">
                        <button onClick={() => setInputMode("text")} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-mono border transition-all active:scale-95 ${inputMode === "text" ? "bg-primary-500/20 border-primary-500/30 text-primary-300" : "bg-neutral-100 border-neutral-200 text-neutral-500"}`}>
                          <Keyboard size={9} /> TEXT
                        </button>
                        <button onClick={() => setInputMode("voice")} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-mono border transition-all active:scale-95 ${inputMode === "voice" ? "bg-primary-500/20 border-primary-500/30 text-primary-300" : "bg-neutral-100 border-neutral-200 text-neutral-500"}`}>
                          <Mic size={9} /> VOICE
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSkip}
                          disabled={loading}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-mono border border-neutral-200 text-neutral-500 hover:text-neutral-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                          <SkipForward size={9} /> SKIP
                        </button>
                        {timerActive && (
                          <div className="w-28">
                            <TimerBar key={timerKey} duration={120} onTimeout={handleTimeout} />
                          </div>
                        )}
                      </div>
                    </div>

                    {inputMode === "text" ? (
                      <div className="flex gap-2">
                        <textarea
                          value={answer}
                          onChange={(e) => setAnswer(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && answer.trim()) { e.preventDefault(); handleSubmit(); } }}
                          placeholder="Type your answer... (Enter to submit)"
                          rows={3}
                          disabled={loading || cheating.suspended}
                          className="flex-1 rounded-xl px-3 py-2 text-sm resize-none disabled:opacity-50"
                        />
                        <Button onClick={() => handleSubmit()} disabled={!answer.trim() || loading || cheating.suspended} loading={loading} className="flex-shrink-0 px-3 active:scale-95">
                          Submit
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <AudioRecorder
                            onTranscript={handleTranscript}
                            disabled={loading || cheating.suspended}
                            onRecordingChange={setIsRecording}
                            streamRef={micStreamRef}
                          />
                          {answer && !isRecording && (
                            <Button onClick={() => handleSubmit()} disabled={loading} loading={loading} className="flex-shrink-0 px-3 active:scale-95">Submit</Button>
                          )}
                        </div>
                        {answer && !isRecording && (
                          <div className="bg-neutral-100 rounded-xl px-3 py-1.5 border border-neutral-200">
                            <p className="text-xs text-neutral-600 line-clamp-2">{answer}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="px-4 py-3 space-y-3">
                    <FeedbackCard feedback={feedback} loading={loading} error={feedbackError} onRetry={retryFeedback} onSkip={handleSkip} />
                    {feedback && (
                      <Button
                        onClick={handleNext}
                        className="w-full active:scale-95"
                        size="sm"
                      >
                        {isLast ? "View Report" : <>Next <ChevronRight size={13} /></>}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="w-60 flex-shrink-0 border-l border-neutral-200 p-2.5 pt-3 overflow-hidden flex flex-col bg-neutral-100">
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
              suspended={cheating.suspended}
            />
          </div>
        </div>
      </main>
    </div>
  );
}