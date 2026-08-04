"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { loadSession, saveSession } from "@/lib/storage";
import { simulateRespond, generateReport } from "@/lib/api";
import { Question } from "@/types";
import { VideoPanel } from "@/components/interview/VideoPanel";
import { TimerBar } from "@/components/interview/TimerBar";
import { InterviewerAvatar } from "@/components/interview/InterviewerAvatar";
import { LiveAnalyticsPanel } from "@/components/interview/LiveAnalyticsPanel";
import { AudioRecorder } from "@/components/interview/AudioRecorder";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/hooks/useToast";
import { useMLIM } from "@/hooks/useMLIM";
import { useCheatingDetection } from "@/hooks/useCheatingDetection";
import { Loader2, ChevronRight, AlertTriangle, Send, Keyboard, Mic, Volume2, SkipForward } from "lucide-react";

interface Message {
  role: "ai" | "user";
  text: string;
}

type InputMode = "voice" | "text";

export default function Simulation() {
  const router = useRouter();
  const { toast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [isRecording, setIsRecording] = useState(false);
  const [avatarSpeaking, setAvatarSpeaking] = useState(false);
  const [avatarText, setAvatarText] = useState("");
  const [speakEnabled, setSpeakEnabled] = useState(true);
  const [faceData, setFaceData] = useState<any>(null);
  const [timerActive, setTimerActive] = useState(false);

  const audioStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const mlim = useMLIM();
  const cheating = useCheatingDetection(true, audioStreamRef, videoStreamRef);

  useEffect(() => {
    const s = loadSession();
    if (!s) { router.push("/setup"); return; }
    setSession(s);
    const firstQ = s.questions?.[0]?.text || "";
    const fullIntro = `Welcome. I'll be conducting your ${s.job_role} interview today. Let's begin.\n\n${firstQ}`;
    setMessages([{ role: "ai", text: fullIntro }]);
    if (speakEnabled) {
      setAvatarText(fullIntro);
      setAvatarSpeaking(true);
    } else {
      setTimerActive(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAvatarSpeakEnd = useCallback(() => {
    setAvatarSpeaking(false);
    setTimerActive(true);
  }, []);

  const speakText = useCallback((text: string) => {
    if (!speakEnabled) { setTimerActive(true); return; }
    setAvatarText(text);
    setAvatarSpeaking(true);
  }, [speakEnabled]);

  const handleSubmit = useCallback(async (submittedAnswer?: string) => {
    const answerToSubmit = submittedAnswer ?? answer;
    if (!answerToSubmit.trim() || loading || !session) return;
    setLoading(true);
    setTimerActive(false);
    const questions: Question[] = session.questions;
    const current = questions[currentIndex];
    setMessages((m) => [...m, { role: "user", text: answerToSubmit }]);
    setAnswer("");

    try {
      const mlimPromise = mlim.analyze({
        sessionId: session.session_id,
        questionId: current.id,
        questionText: current.text,
        answerText: answerToSubmit,
        jobRole: session.job_role,
        faceSnapshot: faceData,
      });

      const respondPromise = simulateRespond({
        session_id: session.session_id,
        question_text: current.text,
        answer_text: answerToSubmit,
        interviewer_style: "professional",
      });

      const [mlimResult, { response }] = await Promise.all([mlimPromise, respondPromise]);

      if (!mlimResult) {
        toast({
          title: "Analytics not captured",
          description: "This answer's MLIM analysis couldn't be recorded, but your interview continues normally.",
          variant: "warning",
        });
      }

      setMessages((m) => [...m, { role: "ai", text: response }]);
      setAnswered(true);
      speakText(response);
    } catch (e) {
      const fallback = "Noted. Thank you for your response.";
      setMessages((m) => [...m, { role: "ai", text: fallback }]);
      setAnswered(true);
      speakText(fallback);
      toast({
        title: "Response failed",
        description: e instanceof Error ? e.message : "Continuing with a default response.",
        variant: "warning",
      });
    } finally {
      setLoading(false);
    }
  }, [answer, loading, session, currentIndex, mlim, speakText, faceData, toast]);

  const handleNext = useCallback(async () => {
    if (!session) return;
    setAvatarSpeaking(false);
    const questions: Question[] = session.questions;
    const isLast = currentIndex === questions.length - 1;
    if (isLast) {
      setGeneratingReport(true);
      try {
        await cheating.flushEvents(session.session_id, "");
        const report = await generateReport(session.session_id);
        saveSession({ ...session, report });
        router.push(`/report/${session.session_id}`);
      } catch (e) {
        toast({ title: "Report generation had an issue", description: e instanceof Error ? e.message : "Opening your report anyway.", variant: "warning" });
        router.push(`/report/${session.session_id}`);
      } finally {
        setGeneratingReport(false);
      }
    } else {
      const next = questions[currentIndex + 1];
      setCurrentIndex((i) => i + 1);
      setAnswer("");
      setAnswered(false);
      setTimerKey((k) => k + 1);
      setTimerActive(false);
      setMessages((m) => [...m, { role: "ai", text: next.text }]);
      speakText(next.text);
    }
  }, [session, currentIndex, router, speakText, cheating, toast]);

  const handleSkip = useCallback(() => {
    if (answered || loading || !session) return;
    setTimerActive(false);
    setMessages((m) => [...m, { role: "user", text: "(Question skipped)" }]);
    setAnswer("");
    handleNext();
  }, [answered, loading, session, handleNext]);

  const handleTimeout = useCallback(() => {
    if (!answered && answer.trim()) {
      handleSubmit();
    } else if (!answered) {
      setMessages((m) => [...m, { role: "user", text: "(No answer provided)" }]);
      const aiMsg = "Alright, let's move on to the next question.";
      setMessages((m) => [...m, { role: "ai", text: aiMsg }]);
      setAnswered(true);
      speakText(aiMsg);
    }
  }, [answered, answer, handleSubmit, speakText]);

  const handleTranscript = useCallback((text: string) => {
    if (text.trim()) setAnswer(text);
  }, []);

  if (!session) return null;

  const questions: Question[] = session.questions;
  const current = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const cheatingData = cheating.getSummary();

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">

      {cheating.showWarning && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-error-500/90 backdrop-blur-sm text-white px-4 py-2.5 rounded-xl shadow-lg border border-error-400/50 animate-fade-in">
          <AlertTriangle size={16} />
          <span className="text-sm font-medium">{cheating.warningMessage}</span>
        </div>
      )}

      {generatingReport && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass rounded-2xl p-8 flex flex-col items-center gap-4 w-72">
            <Loader2 size={32} className="animate-spin text-primary-400" />
            <p className="text-neutral-900 font-display text-lg">Generating your report...</p>
            <div className="w-full space-y-2">
              <Skeleton height={10} />
              <Skeleton height={10} width="80%" />
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 pt-16 flex overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
        <div className="flex w-full h-full">
          <div className="flex-1 flex flex-col p-4 gap-3 min-w-0">
            <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden">
              <VideoPanel
                isSpeaking={isRecording}
                mlimAnalysis={mlim.latestAnalysis}
                mlimAnalyzing={mlim.isAnalyzing}
                onFaceData={setFaceData}
                suspended={cheating.suspended}
                streamRef={videoStreamRef}
              />

              <div className="absolute top-3 right-3 w-36 h-28 rounded-xl overflow-hidden border border-neutral-200 shadow-2xl bg-neutral-100 z-20">
                <InterviewerAvatar
                  text={avatarText}
                  speaking={avatarSpeaking}
                  onSpeakEnd={handleAvatarSpeakEnd}
                  thinking={loading && !avatarSpeaking}
                  listening={isRecording && !avatarSpeaking}
                />
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
                  <span className="text-[8px] text-neutral-400 bg-black/50 px-1.5 py-0.5 rounded font-mono border border-neutral-200">AI INTERVIEWER</span>
                </div>
              </div>

              <div className="absolute top-3 left-3 z-10">
                <button
                  onClick={() => setSpeakEnabled((v) => !v)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-mono border backdrop-blur-sm transition-all active:scale-95 ${speakEnabled ? "bg-primary-500/20 border-primary-500/30 text-primary-300" : "bg-black/50 border-neutral-200 text-neutral-500"}`}
                >
                  <Volume2 size={10} />
                  {speakEnabled ? "VOICE ON" : "VOICE OFF"}
                </button>
              </div>
            </div>

            <div className="glass rounded-2xl overflow-hidden flex-shrink-0 transition-shadow duration-300 hover:shadow-lg" style={{ height: "220px" }}>
              <div className="flex items-start gap-3 px-4 pt-3 pb-2 border-b border-neutral-200">
                <span className="text-[10px] text-neutral-600 font-mono mt-0.5 flex-shrink-0">Q{currentIndex + 1}</span>
                <p className="text-sm text-neutral-800 leading-snug line-clamp-2">{current?.text}</p>
              </div>

              <div className="px-4 py-2 h-10 overflow-hidden">
                {messages.filter((m) => m.role === "ai").slice(-1).map((m, i) => (
                  <p key={i} className="text-xs text-neutral-500 leading-relaxed line-clamp-2 animate-fade-in">{m.text}</p>
                ))}
              </div>

              <div className="px-4 pb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setInputMode("text")}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all active:scale-95 ${inputMode === "text" ? "bg-primary-500/20 border-primary-500/30 text-primary-300" : "bg-neutral-100 border-neutral-200 text-neutral-500 hover:text-neutral-700"}`}
                    >
                      <Keyboard size={10} /> TEXT
                    </button>
                    <button
                      onClick={() => setInputMode("voice")}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all active:scale-95 ${inputMode === "voice" ? "bg-primary-500/20 border-primary-500/30 text-primary-300" : "bg-neutral-100 border-neutral-200 text-neutral-500 hover:text-neutral-700"}`}
                    >
                      <Mic size={10} /> VOICE
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {!answered && (
                      <button
                        onClick={handleSkip}
                        disabled={loading}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono border border-neutral-200 text-neutral-500 hover:text-neutral-700 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <SkipForward size={10} /> SKIP
                      </button>
                    )}
                    {timerActive && !answered && (
                      <div className="w-28">
                        <TimerBar key={timerKey} duration={120} onTimeout={handleTimeout} />
                      </div>
                    )}
                    <span className="text-[10px] text-neutral-600 font-mono">{currentIndex + 1}/{questions.length}</span>
                  </div>
                </div>

                {inputMode === "text" ? (
                  <div className="flex gap-2">
                    <textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && !answered && answer.trim()) {
                          e.preventDefault();
                          handleSubmit();
                        }
                      }}
                      placeholder="Type your answer... (Enter to submit)"
                      rows={2}
                      disabled={answered || loading}
                      className="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none resize-none disabled:opacity-50"
                    />
                    {!answered ? (
                      <Button
                        onClick={() => handleSubmit()}
                        disabled={loading || !answer.trim()}
                        loading={loading}
                        size="icon"
                        className="flex-shrink-0 active:scale-95"
                        aria-label="Submit answer"
                      >
                        {!loading && <Send size={16} />}
                      </Button>
                    ) : (
                      <Button
                        onClick={handleNext}
                        disabled={generatingReport}
                        variant="secondary"
                        className="flex-shrink-0 active:scale-95"
                      >
                        {generatingReport ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : isLast ? "Report" : <><ChevronRight size={14} /> Next</>}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {!answered ? (
                      <>
                        <AudioRecorder
                          onTranscript={handleTranscript}
                          disabled={answered || loading}
                          onRecordingChange={setIsRecording}
                          streamRef={audioStreamRef}
                        />
                        {answer && !isRecording && (
                          <Button
                            onClick={() => handleSubmit()}
                            disabled={loading}
                            loading={loading}
                            leftIcon={<Send size={14} />}
                            className="active:scale-95"
                          >
                            Submit
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button
                        onClick={handleNext}
                        disabled={generatingReport}
                        variant="secondary"
                        className="flex-1 justify-center active:scale-95"
                      >
                        {generatingReport ? (
                          <><Loader2 size={14} className="animate-spin" /> Generating...</>
                        ) : isLast ? "View Report" : <><ChevronRight size={14} /> Next Question</>}
                      </Button>
                    )}
                    {answer && !answered && !isRecording && (
                      <div className="flex-1 bg-neutral-100 rounded-xl px-3 py-2 border border-neutral-200">
                        <p className="text-xs text-neutral-600 line-clamp-2">{answer}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="w-64 flex-shrink-0 border-l border-neutral-200 p-3 pt-4 overflow-hidden flex flex-col bg-neutral-100">
            <LiveAnalyticsPanel
              mlimAnalysis={mlim.latestAnalysis}
              mlimAnalyzing={mlim.isAnalyzing}
              faceData={faceData}
              currentQuestionIndex={currentIndex}
              totalQuestions={questions.length}
              integrityScore={cheatingData.integrity_score}
              tabSwitches={cheatingData.tab_switches}
              windowBlurs={cheatingData.window_blurs}
              copyPastes={cheatingData.copy_pastes}
              suspended={cheating.suspended}
            />
          </div>
        </div>
      </main>
    </div>
  );
}