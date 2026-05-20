"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadSession, saveSession } from "@/lib/storage";
import { evaluateAnswer, generateReport } from "@/lib/api";
import { Question, Feedback } from "@/types";
import { Navbar } from "@/components/layout/Navbar";
import { QuestionCard } from "@/components/interview/QuestionCard";
import { FeedbackCard } from "@/components/interview/FeedbackCard";
import { VideoPanel } from "@/components/interview/VideoPanel";
import { AudioRecorder } from "@/components/interview/AudioRecorder";
import { TimerBar } from "@/components/interview/TimerBar";
import { MLIMPanel } from "@/components/mlim/MLIMPanel";
import { Button } from "@/components/ui/Button";
import { useMLIM } from "@/hooks/useMLIM";
import { Loader2, ChevronRight } from "lucide-react";

export default function Practice() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const mlim = useMLIM();

  useEffect(() => {
    const s = loadSession();
    if (!s) { router.push("/setup"); return; }
    setSession(s);
  }, []);

  if (!session) return null;

  const questions: Question[] = session.questions;
  const current = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;

  const handleSubmit = async () => {
    if (!answer.trim()) return;
    setLoading(true);
    try {
      const [fb] = await Promise.all([
        evaluateAnswer({
          session_id: session.session_id,
          question_id: current.id,
          question_text: current.text,
          question_category: current.category,
          question_difficulty: current.difficulty,
          answer_text: answer,
          job_role: session.job_role,
        }),
        mlim.analyze({
          sessionId: session.session_id,
          questionId: current.id,
          questionText: current.text,
          answerText: answer,
          jobRole: session.job_role,
        }),
      ]);
      setFeedback(fb);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    if (isLast) {
      const report = await generateReport(session.session_id);
      saveSession({ ...session, report });
      router.push(`/report/${session.session_id}`);
    } else {
      setCurrentIndex((i) => i + 1);
      setAnswer("");
      setFeedback(null);
      setTimerKey((k) => k + 1);
    }
  };

  return (
    <div className="min-h-screen bg-night-950">
      <Navbar />
      <main className="pt-24 pb-16 px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <VideoPanel
              isSpeaking={isSpeaking}
              mlimAnalysis={mlim.latestAnalysis}
              mlimAnalyzing={mlim.isAnalyzing}
            />
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-2">Time Remaining</p>
              <TimerBar key={timerKey} duration={120} onTimeout={handleSubmit} />
            </div>
            <div className="glass rounded-xl p-4">
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span>Progress</span><span>{currentIndex + 1} / {questions.length}</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-accent to-accent-light transition-all duration-500"
                  style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
              </div>
            </div>
            <MLIMPanel analysis={mlim.latestAnalysis} history={mlim.analysisHistory} />
          </div>
          <div className="lg:col-span-2 space-y-5">
            <QuestionCard question={current} index={currentIndex} total={questions.length} />
            {!feedback ? (
              <div className="glass rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">Your Answer</p>
                  <AudioRecorder onTranscript={(t) => { setAnswer(t); setIsSpeaking(false); }} disabled={loading} />
                </div>
                <textarea value={answer} onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type or record your answer..." rows={6}
                  className="w-full rounded-xl p-4 text-sm resize-none border border-white/10 focus:border-accent/50 transition-colors" />
                <Button onClick={handleSubmit} disabled={!answer.trim() || loading} className="w-full">
                  {loading ? <><Loader2 size={16} className="animate-spin mr-2" />Evaluating...</> : "Submit Answer"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4 animate-slide-up">
                <FeedbackCard feedback={feedback} />
                <Button onClick={handleNext} className="w-full">
                  {isLast ? "View Final Report" : <>Next Question <ChevronRight size={16} /></>}
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}