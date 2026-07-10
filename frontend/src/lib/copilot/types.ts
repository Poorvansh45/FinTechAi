/** Shared UI message shape for the copilot chat. */
export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  ts: string; // ISO timestamp
  // Assistant-only metadata (from the backend ChatResponse)
  agent?: string;
  tools?: string[];
  reasoning?: string;
  suggestions?: string[];
}

export function newId(): string {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
