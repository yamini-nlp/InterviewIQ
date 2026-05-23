"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { loadSession, saveSession } from "@/lib/storage";
import { simulateRespond, generateReport, transcribeAudio } from "@/lib/api";
import { Question } from "@/types";
import { Navbar } from "@/components/layout/Navbar";
import { VideoPanel } from "@/components/interview/VideoPanel";
import { TimerBar } from "@/components/interview/TimerBar";
import { InterviewerAvatar } from "@/components/interview/InterviewerAvatar";
import { LiveAnalyticsPanel } from "@/components/interview/LiveAnalyticsPanel";
import { useMLIM } from "@/hooks/useMLIM";
import { useCheatingDetection } from "@/hooks/useCheatingDetection";
import { Loader2, ChevronRight, AlertTriangle, Mic, MicOff, Send, Keyboard, Volume2 } from "lucide-react";

interface Message {
  role: "ai" | "user";
  text: string;
}

type InputMode = "voice" | "text";

export default function Simulation() {
  const router = useRouter();
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
  const [transcribing, setTranscribing] = useState(false);
  const [avatarSpeaking, setAvatarSpeaking] = useState(false);
  const [avatarText, setAvatarText] = useState("");
  const [speakEnabled, setSpeakEnabled] = useState(true);
  const [faceData, setFaceData] = useState<any>(null);
  const [timerActive, setTimerActive] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mlim = useMLIM();
  const cheating = useCheatingDetection(true);

  useEffect(() => {
    const s = loadSession();
    if (!s) { router.push("/setup"); return; }
    setSession(s);
    const firstQ = s.questions[0]?.text || "";
    const fullIntro = `Welcome. I'll be conducting your ${s.job_role} interview today. Let's begin.\n\n${firstQ}`;
    setMessages([{ role: "ai", text: fullIntro }]);
    if (speakEnabled) {
      setAvatarText(fullIntro);
      setAvatarSpeaking(true);
    } else {
      setTimerActive(true);
    }
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
      const [{ response }] = await Promise.all([
        simulateRespond({
          session_id: session.session_id,
          question_text: current.text,
          answer_text: answerToSubmit,
          interviewer_style: "professional",
        }),
        mlim.analyze({
          sessionId: session.session_id,
          questionId: current.id,
          questionText: current.text,
          answerText: answerToSubmit,
          jobRole: session.job_role,
        }),
      ]);
      setMessages((m) => [...m, { role: "ai", text: response }]);
      setAnswered(true);
      speakText(response);
    } catch {
      const fallback = "Noted. Thank you for your response.";
      setMessages((m) => [...m, { role: "ai", text: fallback }]);
      setAnswered(true);
      speakText(fallback);
    } finally {
      setLoading(false);
    }
  }, [answer, loading, session, currentIndex, mlim, speakText]);

  const handleNext = useCallback(async () => {
    if (!session) return;
    const questions: Question[] = session.questions;
    const isLast = currentIndex === questions.length - 1;
    if (isLast) {
      setGeneratingReport(true);
      try {
        const report = await generateReport(session.session_id);
        saveSession({ ...session, report });
        router.push(`/report/${session.session_id}`);
      } catch {
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
  }, [session, currentIndex, router, speakText]);

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

  const startRecording = useCallback(async () => {
    if (isRecording || transcribing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setTranscribing(true);
        try {
          const { transcript } = await transcribeAudio(blob);
          if (transcript.trim()) setAnswer(transcript);
        } catch {} finally { setTranscribing(false); }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {}
  }, [isRecording, transcribing]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
    setIsRecording(false);
  }, []);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (!session) return null;

  const questions: Question[] = session.questions;
  const current = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const cheatingData = cheating.getSummary();

  return (
    <div className="min-h-screen bg-night-950 flex flex-col">
      <Navbar />

      {cheating.showWarning && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-red-500/90 backdrop-blur-sm text-white px-4 py-2.5 rounded-xl shadow-lg border border-red-400/50 animate-fade-in">
          <AlertTriangle size={16} />
          <span className="text-sm font-medium">{cheating.warningMessage}</span>
        </div>
      )}

      {generatingReport && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass rounded-2xl p-8 flex flex-col items-center gap-4">
            <Loader2 size={32} className="animate-spin text-accent" />
            <p className="text-white font-display text-lg">Generating your report...</p>
            <p className="text-gray-400 text-sm">Evaluating all your answers</p>
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
              />

              <div className="absolute top-3 right-3 w-36 h-28 rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-night-800 z-20">
                <InterviewerAvatar text={avatarText} speaking={avatarSpeaking} onSpeakEnd={handleAvatarSpeakEnd} />
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
                  <span className="text-[8px] text-gray-400 bg-black/50 px-1.5 py-0.5 rounded font-mono border border-white/10">AI INTERVIEWER</span>
                </div>
              </div>

              <div className="absolute top-3 left-3 z-10">
                <button
                  onClick={() => setSpeakEnabled((v) => !v)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-mono border backdrop-blur-sm transition-all ${speakEnabled ? "bg-accent/20 border-accent/30 text-accent" : "bg-black/50 border-white/10 text-gray-500"}`}
                >
                  <Volume2 size={10} />
                  {speakEnabled ? "VOICE ON" : "VOICE OFF"}
                </button>
              </div>
            </div>

            <div className="glass rounded-2xl overflow-hidden flex-shrink-0" style={{ height: "220px" }}>
              <div className="flex items-start gap-3 px-4 pt-3 pb-2 border-b border-white/5">
                <span className="text-[10px] text-gray-600 font-mono mt-0.5 flex-shrink-0">Q{currentIndex + 1}</span>
                <p className="text-sm text-gray-200 leading-snug line-clamp-2">{current?.text}</p>
              </div>

              <div className="px-4 py-2 h-10 overflow-hidden">
                {messages.filter((m) => m.role === "ai").slice(-1).map((m, i) => (
                  <p key={i} className="text-xs text-gray-500 leading-relaxed line-clamp-2">{m.text}</p>
                ))}
              </div>

              <div className="px-4 pb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex gap-1.5">
                    <button onClick={() => setInputMode("text")} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all ${inputMode === "text" ? "bg-accent/20 border-accent/30 text-accent" : "bg-white/5 border-white/10 text-gray-500 hover:text-gray-300"}`}>
                      <Keyboard size={10} /> TEXT
                    </button>
                    <button onClick={() => setInputMode("voice")} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all ${inputMode === "voice" ? "bg-accent/20 border-accent/30 text-accent" : "bg-white/5 border-white/10 text-gray-500 hover:text-gray-300"}`}>
                      <Mic size={10} /> VOICE
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {timerActive && !answered && (
                      <div className="w-28">
                        <TimerBar key={timerKey} duration={120} onTimeout={handleTimeout} />
                      </div>
                    )}
                    <span className="text-[10px] text-gray-600 font-mono">{currentIndex + 1}/{questions.length}</span>
                  </div>
                </div>

                {inputMode === "text" ? (
                  <div className="flex gap-2">
                    <textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !answered && answer.trim()) { e.preventDefault(); handleSubmit(); } }}
                      placeholder="Type your answer... (Enter to submit)"
                      rows={2}
                      disabled={answered || loading}
                      className="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none resize-none disabled:opacity-50"
                    />
                    {!answered ? (
                      <button onClick={() => handleSubmit()} disabled={loading || !answer.trim() || answered} className="w-10 rounded-xl bg-accent hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0">
                        {loading ? <Loader2 size={16} className="animate-spin text-white" /> : <Send size={16} className="text-white" />}
                      </button>
                    ) : (
                      <button onClick={handleNext} disabled={generatingReport || avatarSpeaking} className="px-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors flex-shrink-0 text-white text-sm font-medium">
                        {generatingReport ? <Loader2 size={14} className="animate-spin" /> : avatarSpeaking ? <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /><span className="text-xs">Speaking</span></div> : isLast ? "Report" : <><ChevronRight size={14} /> Next</>}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {transcribing ? (
                      <div className="flex items-center gap-2 text-sm text-gray-400 flex-1">
                        <Loader2 size={14} className="animate-spin" /> Transcribing...
                      </div>
                    ) : !answered ? (
                      <>
                        <button onClick={isRecording ? stopRecording : startRecording} disabled={answered || loading} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all flex-1 justify-center ${isRecording ? "bg-red-500/20 border-red-500/40 text-red-400 animate-pulse" : "bg-accent/15 border-accent/30 text-accent hover:bg-accent/25"}`}>
                          {isRecording ? <><MicOff size={14} /> Stop Recording</> : <><Mic size={14} /> Start Recording</>}
                        </button>
                        {answer && (
                          <button onClick={() => handleSubmit()} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors">
                            <Send size={14} /> Submit
                          </button>
                        )}
                      </>
                    ) : (
                      <button onClick={handleNext} disabled={generatingReport || avatarSpeaking} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-medium transition-colors flex-1 justify-center">
                        {generatingReport ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : avatarSpeaking ? <><div className="w-2 h-2 rounded-full bg-white animate-pulse" /> Speaking...</> : isLast ? "View Report" : <><ChevronRight size={14} /> Next Question</>}
                      </button>
                    )}
                    {answer && !answered && !transcribing && (
                      <div className="flex-1 bg-white/5 rounded-xl px-3 py-2 border border-white/10">
                        <p className="text-xs text-gray-300 line-clamp-2">{answer}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="w-64 flex-shrink-0 border-l border-white/5 p-3 pt-4 overflow-hidden flex flex-col bg-night-900">
            <LiveAnalyticsPanel
              mlimAnalysis={mlim.latestAnalysis}
              mlimAnalyzing={mlim.isAnalyzing}
              faceData={faceData}
              currentQuestionIndex={currentIndex}
              totalQuestions={questions.length}
              integrityScore={cheatingData.integrity_score}
              tabSwitches={cheatingData.tab_switches}
              copyPastes={cheatingData.copy_pastes}
            />
          </div>
        </div>
      </main>
    </div>
  );
}