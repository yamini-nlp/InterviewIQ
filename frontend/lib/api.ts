import { refreshAccessToken } from "@/lib/auth";

const BASE = "/api/proxy";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const makeRequest = async () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    return fetch(`${BASE}${path}`, {
      ...options,
      credentials: "include",
      headers: { ...headers, ...(options?.headers as Record<string, string> || {}) },
    });
  };

  let res = await makeRequest();

  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await makeRequest();
    } else {
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new Error("Session expired. Please log in again.");
    }
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
  mode?: "practice" | "simulation";
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
  const form = new FormData();
  form.append("audio", blob, "audio.webm");

  const doFetch = () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    return fetch(`${BASE}/api/questions/transcribe`, {
      method: "POST",
      body: form,
      credentials: "include",
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
  };

  let res: Response;
  try {
    res = await doFetch();
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Transcription timed out. Please try again.");
    }
    throw new Error("Transcription failed");
  }

  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      try {
        res = await doFetch();
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          throw new Error("Transcription timed out. Please try again.");
        }
        throw new Error("Transcription failed");
      }
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
  question_id: string;
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

export async function downloadReportPDF(session_id: string): Promise<Blob> {
  const doFetch = () =>
    fetch(`${BASE}/api/reports/${session_id}/pdf`, {
      credentials: "include",
    });

  let res = await doFetch();
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) throw new Error("Session expired. Please log in again.");
    res = await doFetch();
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Couldn't generate the PDF. Please try again." }));
    throw new Error(err.detail || "Couldn't generate the PDF. Please try again.");
  }
  return res.blob();
}

export async function exportUserData(): Promise<Blob> {
  const doFetch = () =>
    fetch(`${BASE}/api/privacy/export`, {
      credentials: "include",
    });

  let res = await doFetch();
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) throw new Error("Session expired. Please log in again.");
    res = await doFetch();
  }
  if (!res.ok) throw new Error("Couldn't export your data. Please try again.");
  return res.blob();
}

export async function deleteAccount() {
  return apiFetch<{ deleted: boolean; counts: Record<string, number> }>("/api/privacy/account", {
    method: "DELETE",
    body: JSON.stringify({ confirm: true }),
  });
}

export async function logoutAllDevices() {
  return apiFetch<{ message: string; revoked_count: number }>("/api/auth/logout-all", {
    method: "POST",
  });
}