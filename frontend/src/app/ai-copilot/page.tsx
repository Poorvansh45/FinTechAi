"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PanelLeft, Plus, LogIn } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import {
  sendChat, getSessions, getSessionMessages, deleteSession,
  CopilotAuthError, type SessionMeta,
} from "@/lib/api/copilot";
import { deriveTitle, setSessionTitle, removeSessionTitle } from "@/lib/copilot/sessions";
import { type UiMessage, newId } from "@/lib/copilot/types";
import { ChatSidebar } from "@/components/copilot/ChatSidebar";
import { MessageList } from "@/components/copilot/MessageList";
import { ChatInput } from "@/components/copilot/ChatInput";
import { WelcomeScreen } from "@/components/copilot/WelcomeScreen";

export default function AICopilotPage() {
  const { status } = useAuth();

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<UiMessage | null>(null);
  const [authError, setAuthError] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, forceRender] = useState(0);
  const [promptTriggered, setPromptTriggered] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const typeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load session list once authenticated ──────────────────────────────────
  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      setSessions(await getSessions());
    } catch (err) {
      if (err instanceof CopilotAuthError) setAuthError(true);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      setAuthError(false);
      refreshSessions();
    }
  }, [status, refreshSessions]);

  // ── Type-out animation, resolves when fully rendered ──────────────────────
  const typeOut = (full: string, base: UiMessage): Promise<void> =>
    new Promise((resolve) => {
      const speed = Math.max(4, Math.floor(full.length / 300));
      let i = 0;
      typeTimer.current = setInterval(() => {
        i += speed;
        if (i >= full.length) {
          if (typeTimer.current) clearInterval(typeTimer.current);
          typeTimer.current = null;
          setStreamingMessage({ ...base, text: full });
          resolve();
        } else {
          setStreamingMessage({ ...base, text: full.slice(0, i) });
        }
      }, 15);
    });

  const commitAssistant = (msg: UiMessage) => {
    setMessages((prev) => [...prev, msg]);
    setStreamingMessage(null);
  };

  // ── Core send ─────────────────────────────────────────────────────────────
  const runTurn = useCallback(
    async (text: string, pushUser = true) => {
      const prompt = text.trim();
      if (!prompt || thinking || streamingMessage) return;

      setAuthError(false);
      if (pushUser) {
        setMessages((prev) => [...prev, { id: newId(), role: "user", text: prompt, ts: new Date().toISOString() }]);
      }
      setThinking(true);

      const wasNewSession = !currentSessionId;
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await sendChat(prompt, currentSessionId ?? undefined, controller.signal);
        setCurrentSessionId(res.session_id);

        // Title + sidebar refresh for a freshly created session
        if (wasNewSession) {
          setSessionTitle(res.session_id, deriveTitle(prompt));
          refreshSessions();
        }

        const base: UiMessage = {
          id: newId(),
          role: "assistant",
          text: "",
          ts: new Date().toISOString(),
          agent: res.agent_used,
          tools: res.tools_called,
          reasoning: res.reasoning_summary,
          suggestions: res.suggestions,
        };
        setThinking(false);
        await typeOut(res.answer, base);
        commitAssistant({ ...base, text: res.answer });
      } catch (err) {
        setThinking(false);
        if (err instanceof DOMException && err.name === "AbortError") {
          setStreamingMessage(null);
          return; // user stopped before the response arrived
        }
        if (err instanceof CopilotAuthError) {
          setAuthError(true);
          return;
        }
        commitAssistant({
          id: newId(),
          role: "assistant",
          text: "I couldn't reach the analysis service. Please check your connection and try again.",
          ts: new Date().toISOString(),
          agent: "none",
        });
      } finally {
        abortRef.current = null;
      }
    },
    [thinking, streamingMessage, currentSessionId, refreshSessions],
  );

  useEffect(() => {
    if (status === "authenticated" && !promptTriggered && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const prompt = params.get("prompt");
      if (prompt) {
        setPromptTriggered(true);
        // Clear query parameters so refresh doesn't trigger again
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);

        setTimeout(() => {
          runTurn(prompt);
        }, 500);
      }
    }
  }, [status, promptTriggered, runTurn]);

  const handleSend = (text: string) => {
    setInput("");
    runTurn(text);
  };

  const handleStop = () => {
    // Abort an in-flight request…
    abortRef.current?.abort();
    // …or stop the type-out and keep what's rendered so far.
    if (typeTimer.current) {
      clearInterval(typeTimer.current);
      typeTimer.current = null;
      if (streamingMessage) commitAssistant(streamingMessage);
    }
    setThinking(false);
  };

  const handleRegenerate = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setMessages((prev) => {
      // Drop the trailing assistant message before regenerating.
      const copy = [...prev];
      while (copy.length && copy[copy.length - 1].role === "assistant") copy.pop();
      return copy;
    });
    runTurn(lastUser.text, false);
  };

  // ── Session management ──────────────────────────────────────────────────────
  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setStreamingMessage(null);
    setSidebarOpen(false);
  };

  const handleSelectSession = async (id: string) => {
    setSidebarOpen(false);
    if (id === currentSessionId) return;
    setCurrentSessionId(id);
    setMessages([]);
    setThinking(true);
    try {
      const stored = await getSessionMessages(id);
      setMessages(
        stored.map((m) => ({
          id: newId(),
          role: m.role === "assistant" ? "assistant" : "user",
          text: m.content,
          ts: m.created_at || new Date().toISOString(),
          agent: m.agent || undefined,
        })),
      );
    } catch (err) {
      if (err instanceof CopilotAuthError) setAuthError(true);
    } finally {
      setThinking(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteSession(id);
    } catch {
      /* best-effort; still update UI */
    }
    removeSessionTitle(id);
    if (id === currentSessionId) handleNewChat();
    refreshSessions();
  };

  // Cleanup timers on unmount
  useEffect(() => () => {
    if (typeTimer.current) clearInterval(typeTimer.current);
    abortRef.current?.abort();
  }, []);

  const isWelcome = messages.length === 0 && !thinking && !streamingMessage;
  const busy = thinking || !!streamingMessage;

  // ── Unauthenticated state ────────────────────────────────────────────────────
  if (status === "unauthenticated" || authError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-160px)] rounded-3xl border border-white/[0.06] bg-[#070B14] text-center px-6">
        <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
          <LogIn className="w-5 h-5 text-violet-400" />
        </div>
        <h2 className="text-lg font-bold text-white">Sign in to use the Copilot</h2>
        <p className="text-sm text-slate-400 max-w-sm mt-2">
          The AI Copilot analyses your own portfolio and remembers your preferences, so it needs an
          authenticated session.
        </p>
        <Link
          href="/auth"
          className="mt-5 px-5 py-2.5 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm font-semibold transition-colors"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-100px)] rounded-3xl border border-white/[0.06] bg-[#070B14] relative z-10 overflow-hidden">
      <ChatSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        loading={sessionsLoading}
        onNewChat={handleNewChat}
        onSelect={handleSelectSession}
        onDelete={handleDeleteSession}
        onRenamed={() => forceRender((v) => v + 1)}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 md:px-6 py-2.5 border-b border-white/[0.04] bg-[#090D1A]/60 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Chats"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
            {!isWelcome && (
              <button
                onClick={handleNewChat}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] text-xs font-semibold text-slate-400 hover:text-white transition-all hover:bg-white/[0.04]"
              >
                <Plus className="w-3.5 h-3.5" /> New Chat
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Agentic Copilot</span>
          </div>
        </div>

        {/* Body */}
        {isWelcome ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <WelcomeScreen input={input} onInputChange={setInput} onSend={handleSend} disabled={busy} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <MessageList
              messages={messages}
              streamingMessage={streamingMessage}
              thinking={thinking}
              onRegenerate={handleRegenerate}
              onPickFollowUp={handleSend}
            />
            <div className="p-4 md:p-6 border-t border-white/[0.04] bg-[#070B14]/80 backdrop-blur-md">
              <ChatInput value={input} onChange={setInput} onSend={() => handleSend(input)} onStop={handleStop} loading={busy} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
