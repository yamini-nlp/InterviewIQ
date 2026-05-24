import { getAccessToken, refreshAccessToken } from "@/lib/auth";
import { MLIMAnalyzeRequest, MLIMAnalysis } from "@/types/mlim";

const BASE = process.env.NEXT_PUBLIC_API_URL;

async function mlimFetch<T>(path: string, body: unknown): Promise<T> {
  let token = getAccessToken();
  const makeReq = async (t: string | null) =>
    fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
      body: JSON.stringify(body),
    });

  let res = await makeReq(token);
  if (res.status === 401) {
    token = await refreshAccessToken();
    if (token) res = await makeReq(token);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "MLIM request failed" }));
    throw new Error(err.detail || "MLIM request failed");
  }
  return res.json();
}

export async function runMLIMAnalysis(req: MLIMAnalyzeRequest): Promise<MLIMAnalysis> {
  return mlimFetch<MLIMAnalysis>("/api/mlim/analyze", req);
}