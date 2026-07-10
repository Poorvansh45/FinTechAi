/**
 * FinAI Edge — AI Copilot API client
 * ====================================
 * Typed wrapper over the Phase 2A FastAPI copilot (`/api/v2/copilot/*`).
 * Auth is the Express-issued JWT attached as `Authorization: Bearer` (the
 * FastAPI service cannot see Express's host-only cookie cross-origin).
 *
 * Backend contract (frozen — do not change server-side):
 *   POST   /chat                  { message, session_id? } -> ChatResponse
 *   GET    /history/{user_id}      -> { sessions: SessionMeta[] }
 *   GET    /history/{user_id}?session_id=  -> { messages: StoredMessage[] }
 *   DELETE /session/{id}           -> { success, messages_deleted }
 * The path user_id is ignored server-side (identity from token) — we pass "me".
 */

import { env } from '@/config/env';
import { authHeader } from '@/lib/api/authToken';

const BASE = `${env.fastapiUrl}/api/v2/copilot`;

// ── Types (mirror the backend ChatResponse / persisted docs) ───────────────────
export interface ChatResponse {
  answer: string;
  agent_used: string;
  tools_called: string[];
  reasoning_summary: string;
  suggestions: string[];
  session_id: string;
}

export interface SessionMeta {
  session_id: string;
  updated_at?: string;
  created_at?: string;
  message_count?: number;
}

export interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  agent?: string | null;
  created_at?: string;
}

/** Thrown on 401 so the UI can prompt the user to sign in. */
export class CopilotAuthError extends Error {
  constructor(message = 'Sign in to use the AI Copilot.') {
    super(message);
    this.name = 'CopilotAuthError';
  }
}

export class CopilotError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'CopilotError';
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const auth = await authHeader();
  if (!auth.Authorization && !path.startsWith('/health')) {
    // No token cached — the copilot requires an authenticated session.
    throw new CopilotAuthError();
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...auth,
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err; // stop-generation
    throw new CopilotError(0, 'Could not reach the AI Copilot service.');
  }

  if (res.status === 401) throw new CopilotAuthError();

  const text = await res.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* leave as text */
  }

  if (!res.ok) {
    const detail =
      typeof data === 'object' && data && 'detail' in data
        ? String((data as { detail?: unknown }).detail)
        : `Request failed (${res.status})`;
    throw new CopilotError(res.status, detail);
  }
  return data as T;
}

/** Send a chat turn. `signal` supports Stop-generation via AbortController. */
export function sendChat(
  message: string,
  sessionId?: string,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  return request<ChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify({ message, session_id: sessionId }),
    signal,
  });
}

/** List the authenticated user's sessions (most-recent first). */
export async function getSessions(): Promise<SessionMeta[]> {
  const data = await request<{ sessions: SessionMeta[] }>('/history/me');
  return data.sessions ?? [];
}

/** Load all messages for one session, chronological order. */
export async function getSessionMessages(sessionId: string): Promise<StoredMessage[]> {
  const data = await request<{ messages: StoredMessage[] }>(
    `/history/me?session_id=${encodeURIComponent(sessionId)}`,
  );
  return data.messages ?? [];
}

export function deleteSession(sessionId: string): Promise<{ success: boolean; messages_deleted: number }> {
  return request(`/session/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
}
