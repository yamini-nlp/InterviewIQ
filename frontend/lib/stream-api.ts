import { authorizedFetch } from "@/lib/mlim-api";

const BASE = "/api/proxy";

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone: (fullText: string) => void;
  onError: (message: string) => void;
}

export async function streamInterviewerResponse(
  sessionId: string,
  questionIndex: number,
  callbacks: StreamCallbacks,
  options?: {
    interviewerStyle?: string;
    mlimModifier?: string;
    clarificationPrompt?: string;
  }
): Promise<void> {
  const params = new URLSearchParams({
    question_index: String(questionIndex),
    interviewer_style: options?.interviewerStyle ?? "professional",
    mlim_modifier: options?.mlimModifier ?? "",
    clarification_prompt: options?.clarificationPrompt ?? "",
  });

  const url = `${BASE}/api/sessions/${sessionId}/stream?${params.toString()}`;

  let response: Response;
  try {
    response = await authorizedFetch(url, { method: "GET" });
  } catch (e) {
    callbacks.onError("Network error connecting to stream");
    return;
  }

  if (!response.ok || !response.body) {
    callbacks.onError(`Stream request failed: ${response.status}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    let done: boolean;
    let value: Uint8Array | undefined;
    try {
      ({ done, value } = await reader.read());
    } catch {
      callbacks.onError("Stream read error");
      break;
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

      if (parsed.type === "chunk" && typeof parsed.text === "string") {
        callbacks.onChunk(parsed.text);
      } else if (parsed.type === "done" && typeof parsed.full_text === "string") {
        callbacks.onDone(parsed.full_text);
      } else if (parsed.type === "error") {
        callbacks.onError(parsed.message ?? "Unknown stream error");
      }
    }
  }
}