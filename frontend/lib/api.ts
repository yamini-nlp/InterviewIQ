import { getAccessToken, refreshAccessToken } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_URL;

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  let token = getAccessToken();

  const makeRequest = async (t: string | null) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    };
    return fetch(`${BASE}${path}`, {
      ...options,
      headers: { ...headers, ...(options?.headers as Record<string, string> || {}) },
    });
  };

  let res = await makeRequest(token);

  if (res.status === 401) {
    token = await refreshAccessToken();
    if (token) res = await makeRequest(token);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export async function generateQuestions(payload: {
  job_role: string;
  job_description: string;
  resume_text?: string;
  num_technical?: number;
  num_behavioral?: number;
  num_scenario?: number;
}) {
  return apiFetch<{ session_id: string; questions: any[] }>("/api/questions/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function transcribeAudio(blob: Blob): Promise<{ transcript: string }> {
  let token = getAccessToken();
  const form = new FormData();
  form.append("audio", blob, "audio.webm");

  let res = await fetch(`${BASE}/api/questions/transcribe`, {
    method: "POST",
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status === 401) {
    token = await refreshAccessToken();
    if (token) {
      res = await fetch(`${BASE}/api/questions/transcribe`, {
        method: "POST",
        body: form,
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  }

  if (!res.ok) throw new Error("Transcription failed");
  return res.json();
}

export async function evaluateAnswer(payload: {
  session_id: string;
  question_id: string;
  question_text: string;
  question_category: string;
  question_difficulty: string;
  answer_text: string;
  job_role: string;
}) {
  return apiFetch<any>("/api/evaluate/answer", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function simulateRespond(payload: {
  session_id: string;
  question_text: string;
  answer_text: string;
  interviewer_style?: string;
  mlim_modifier?: string;
  clarification_prompt?: string;
}) {
  return apiFetch<{ response: string }>("/api/simulate/respond", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function generateReport(session_id: string) {
  return apiFetch<any>(`/api/reports/generate/${session_id}`, { method: "POST" });
}

export async function getReport(session_id: string) {
  return apiFetch<any>(`/api/reports/${session_id}`);
}

export async function getSessions() {
  return apiFetch<{ sessions: any[] }>("/api/reports/sessions/all");
}