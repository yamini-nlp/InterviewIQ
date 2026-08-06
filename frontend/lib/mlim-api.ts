import { refreshAccessToken } from "@/lib/auth";
import {
  MLIMAnalyzeRequest,
  MLIMAnalysis,
  MLIMSessionSummary,
  ASLOutput,
  PELOutput,
  GSTLOutput,
  IFLOutput,
} from "@/types/mlim";

const BASE = "/api/proxy";

export type MLIMLayerName = "asl" | "pel" | "gstl" | "ifl";
export type MLIMLayerData = ASLOutput | PELOutput | GSTLOutput | IFLOutput;

export async function authorizedFetch(url: string, init: RequestInit): Promise<Response> {
  const withCredentials = (): RequestInit => ({
    ...init,
    credentials: "include",
  });

  let response = await fetch(url, withCredentials());

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await fetch(url, withCredentials());
    }
  }

  return response;
}

async function mlimGetFetch<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await authorizedFetch(`${BASE}${path}`, { method: "GET" });
  } catch (e) {
    throw new Error("Network error connecting to MLIM service");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "MLIM request failed" }));
    throw new Error(err.detail || "MLIM request failed");
  }
  return res.json();
}

export async function getSessionAnalyses(sessionId: string): Promise<MLIMAnalysis[]> {
  const data = await mlimGetFetch<{ analyses: MLIMAnalysis[] }>(
    `/api/mlim/session/${sessionId}/analyses`
  );
  return data.analyses;
}

export async function getMLIMSessionSummary(sessionId: string): Promise<MLIMSessionSummary> {
  return mlimGetFetch<MLIMSessionSummary>(`/api/mlim/session/${sessionId}/summary`);
}

async function mlimFetch<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await authorizedFetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error("Network error connecting to MLIM service");
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

export async function streamMlimAnalysis(
  request: MLIMAnalyzeRequest,
  onLayer: (layer: MLIMLayerName, data: MLIMLayerData) => void,
  onDone: (analysis: MLIMAnalysis) => void,
  onError: (message: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const url = `${BASE}/api/mlim/analyze/stream`;

  let response: Response;
  try {
    response = await authorizedFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) return;
    onError("Network error connecting to MLIM stream");
    return;
  }

  if (!response.ok || !response.body) {
    if (signal?.aborted) return;
    const err = await response
      .json()
      .catch(() => ({ detail: "MLIM stream request failed" }));
    onError(err.detail || `MLIM stream request failed: ${response.status}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      let done: boolean;
      let value: Uint8Array | undefined;
      try {
        ({ done, value } = await reader.read());
      } catch (e) {
        if (signal?.aborted) return;
        onError("MLIM stream read error");
        return;
      }

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw) continue;

        let parsed: Record<string, any>;
        try {
          parsed = JSON.parse(raw);
        } catch {
          continue;
        }

        if (parsed.type === "layer" && typeof parsed.layer === "string" && parsed.data) {
          onLayer(parsed.layer as MLIMLayerName, parsed.data as MLIMLayerData);
        } else if (parsed.type === "done" && parsed.analysis) {
          onDone(parsed.analysis as MLIMAnalysis);
        } else if (parsed.type === "error") {
          onError(parsed.message ?? "Unknown MLIM stream error");
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
    }
  }
}