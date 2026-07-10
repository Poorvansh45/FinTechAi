/**
 * Session helpers — local title overrides + date grouping.
 *
 * The backend has no session title/rename endpoint (it's frozen), so titles are
 * a frontend concern: we auto-title from the first user message and let the user
 * override the title locally (persisted in localStorage, keyed by session_id).
 */

import { isToday, isYesterday, differenceInCalendarDays } from 'date-fns';
import type { SessionMeta } from '@/lib/api/copilot';

const TITLES_KEY = 'copilot_titles';

type TitleMap = Record<string, string>;

function readTitles(): TitleMap {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(TITLES_KEY) || '{}') as TitleMap;
  } catch {
    return {};
  }
}

function writeTitles(map: TitleMap): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TITLES_KEY, JSON.stringify(map));
}

export function getSessionTitle(sessionId: string): string | undefined {
  return readTitles()[sessionId];
}

export function setSessionTitle(sessionId: string, title: string): void {
  const map = readTitles();
  map[sessionId] = title.trim().slice(0, 80);
  writeTitles(map);
}

export function removeSessionTitle(sessionId: string): void {
  const map = readTitles();
  delete map[sessionId];
  writeTitles(map);
}

/** Derive a short title from the first user message. */
export function deriveTitle(firstMessage: string): string {
  const clean = firstMessage.replace(/\s+/g, ' ').trim();
  return clean.length > 48 ? `${clean.slice(0, 48)}…` : clean || 'New chat';
}

/** Display title: local override → derived → fallback. */
export function displayTitle(sessionId: string, fallback?: string): string {
  return getSessionTitle(sessionId) || fallback || 'New chat';
}

// ── Date grouping (Today / Yesterday / Previous 7 Days / Older) ─────────────────
export type SessionGroup = { label: string; sessions: SessionMeta[] };

const GROUP_ORDER = ['Today', 'Yesterday', 'Previous 7 Days', 'Older'] as const;

function bucketFor(dateStr?: string): (typeof GROUP_ORDER)[number] {
  if (!dateStr) return 'Older';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Older';
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  if (differenceInCalendarDays(new Date(), d) <= 7) return 'Previous 7 Days';
  return 'Older';
}

export function groupSessionsByDate(sessions: SessionMeta[]): SessionGroup[] {
  const buckets: Record<string, SessionMeta[]> = {};
  for (const s of sessions) {
    const key = bucketFor(s.updated_at || s.created_at);
    (buckets[key] ??= []).push(s);
  }
  return GROUP_ORDER.filter((label) => buckets[label]?.length).map((label) => ({
    label,
    sessions: buckets[label],
  }));
}
