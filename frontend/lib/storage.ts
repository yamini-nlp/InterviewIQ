const KEY = "interviewiq_session_meta";

export interface SessionMeta {
  session_id: string;
  mode: "practice" | "simulation";
  job_role: string;
  job_description: string;
}

export function saveSession(data: SessionMeta & { questions?: any[]; report?: any }) {
  if (typeof window !== "undefined") {
    const meta: SessionMeta = {
      session_id: data.session_id,
      mode: data.mode,
      job_role: data.job_role,
      job_description: data.job_description,
    };
    localStorage.setItem(KEY, JSON.stringify(meta));
    if (data.questions) {
      sessionStorage.setItem("interviewiq_questions", JSON.stringify(data.questions));
    }
  }
}

export function loadSession(): (SessionMeta & { questions?: any[] }) | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  const meta = JSON.parse(raw) as SessionMeta;
  const rawQ = sessionStorage.getItem("interviewiq_questions");
  const questions = rawQ ? JSON.parse(rawQ) : undefined;
  return { ...meta, questions };
}

export function clearSession() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem("interviewiq_questions");
  }
}