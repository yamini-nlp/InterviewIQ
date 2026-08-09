"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { generateQuestions } from "@/lib/api";
import { saveSession } from "@/lib/storage";
import { Loader2, ChevronRight } from "lucide-react";

const roles = [
  "Software Engineer","Data Scientist","Product Manager","Data Analyst",
  "Frontend Developer","Backend Developer","DevOps Engineer",
  "Machine Learning Engineer","UX Designer","QA Engineer",
];

export default function Setup() {
  const router = useRouter();
  const [jobRole, setJobRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [mode, setMode] = useState<"practice" | "simulation">("practice");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleStart = async () => {
    if (!jobRole || !jobDescription.trim()) { setError("Please fill in all fields."); return; }
    setLoading(true); setError("");
    try {
      const data = await generateQuestions({ job_role: jobRole, job_description: jobDescription, mode });
      saveSession({ session_id: data.session_id, questions: data.questions, mode, job_role: jobRole, job_description: jobDescription });
      router.push(mode === "practice" ? "/practice" : "/simulation");
    } catch (e: any) {
      setError(e.message || "Failed to generate questions");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="pt-24 pb-16 px-6 max-w-3xl mx-auto">
        <div className="mb-10">
          <h1 className="font-display text-4xl font-bold mb-2">Setup Interview</h1>
          <p className="text-neutral-500">Configure your session and let AI generate tailored questions.</p>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Interview Mode</CardTitle></CardHeader>
            <div className="grid grid-cols-2 gap-3">
              {(["practice", "simulation"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={`p-4 rounded-xl border text-left transition-all ${mode === m ? "border-accent/60 bg-accent/10" : "border-neutral-200 hover:border-neutral-300"}`}>
                  <p className="font-semibold capitalize mb-1">{m}</p>
                  <p className="text-xs text-neutral-500">{m === "practice" ? "Get instant AI feedback after each answer" : "Realistic interview — feedback only at the end"}</p>
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader><CardTitle>Job Role</CardTitle></CardHeader>
            <div className="flex flex-wrap gap-2 mb-4">
              {roles.map((r) => (
                <button key={r} onClick={() => setJobRole(r)} className={`text-sm px-3 py-1.5 rounded-lg border transition-all ${jobRole === r ? "border-accent/60 bg-accent/10 text-accent" : "border-neutral-200 hover:border-neutral-300 text-neutral-500"}`}>
                  {r}
                </button>
              ))}
            </div>
            <input type="text" placeholder="Or type a custom role..." value={jobRole} onChange={(e) => setJobRole(e.target.value)}
              className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent/40 placeholder-neutral-400" />
          </Card>
          <Card>
            <CardHeader><CardTitle>Job Description</CardTitle></CardHeader>
            <textarea placeholder="Paste the job description here..." value={jobDescription} onChange={(e) => setJobDescription(e.target.value)}
              rows={6} className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/40 placeholder-neutral-400 resize-none" />
          </Card>
          {error && <p className="text-sm text-error-500 bg-error-500/10 border border-error-500/20 px-4 py-2.5 rounded-xl">{error}</p>}
          <Button size="lg" className="w-full" onClick={handleStart} disabled={loading}>
            {loading ? <><Loader2 size={16} className="animate-spin" /> Generating Questions...</> : <>Start Interview <ChevronRight size={16} /></>}
          </Button>
        </div>
      </main>
    </div>
  );
}