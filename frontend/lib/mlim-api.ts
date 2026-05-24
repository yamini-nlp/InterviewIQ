import { MLIMAnalysis, MLIMAnalyzeRequest, MLIMSessionSummary } from "@/types/mlim";
import { getAccessToken, refreshAccessToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function mlimFetch<T>(path: string, body: object): Promise<T> {
  let token = getAccessToken();

  const makeRequest = async (t: string | null) =>
    fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify(body),
    });

  let res = await makeRequest(token);
  if (res.status === 401) {
    token = await refreshAccessToken();
    if (token) res = await makeRequest(token);
  }
  if (!res.ok) throw new Error("MLIM request failed");
  return res.json();
}

async function mlimGet<T>(path: string): Promise<T> {
  let token = getAccessToken();

  const makeRequest = async (t: string | null) =>
    fetch(`${API_URL}${path}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });

  let res = await makeRequest(token);
  if (res.status === 401) {
    token = await refreshAccessToken();
    if (token) res = await makeRequest(token);
  }
  if (!res.ok) throw new Error("MLIM request failed");
  return res.json();
}

export async function runMLIMAnalysis(req: MLIMAnalyzeRequest): Promise<MLIMAnalysis> {
  return mlimFetch<MLIMAnalysis>("/api/mlim/analyze", req);
}

export async function getMLIMSessionSummary(sessionId: string): Promise<MLIMSessionSummary> {
  return mlimGet<MLIMSessionSummary>(`/api/mlim/session/${sessionId}/summary`);
}

export async function getMLIMAnalyses(sessionId: string): Promise<{ analyses: MLIMAnalysis[] }> {
  return mlimGet<{ analyses: MLIMAnalysis[] }>(`/api/mlim/session/${sessionId}/analyses`);
}