import { MLIMAnalysis, MLIMAnalyzeRequest, MLIMSessionSummary } from "@/types/mlim";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function runMLIMAnalysis(req: MLIMAnalyzeRequest): Promise<MLIMAnalysis> {
  const res = await fetch(`${API_URL}/api/mlim/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error("MLIM analysis failed");
  return res.json();
}

export async function getMLIMSessionSummary(sessionId: string): Promise<MLIMSessionSummary> {
  const res = await fetch(`${API_URL}/api/mlim/session/${sessionId}/summary`);
  if (!res.ok) throw new Error("MLIM summary fetch failed");
  return res.json();
}

export async function getMLIMAnalyses(sessionId: string): Promise<{ analyses: MLIMAnalysis[] }> {
  const res = await fetch(`${API_URL}/api/mlim/session/${sessionId}/analyses`);
  if (!res.ok) throw new Error("MLIM analyses fetch failed");
  return res.json();
}