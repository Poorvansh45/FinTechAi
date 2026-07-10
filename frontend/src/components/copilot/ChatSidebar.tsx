"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Trash2, Pencil, Check, X, MessageSquare, Loader2,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionMeta } from "@/lib/api/copilot";
import { displayTitle, groupSessionsByDate, setSessionTitle } from "@/lib/copilot/sessions";

const COLLAPSE_KEY = "copilot_sidebar_collapsed";
const EXPANDED_W = 272;
const COLLAPSED_W = 68;
const WIDTH_TRANSITION = { duration: 0.28, ease: [0.4, 0, 0.2, 1] as const };

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(COLLAPSE_KEY) === "1";
}

interface SidebarProps {
  sessions: SessionMeta[];
  currentSessionId: string | null;
  loading?: boolean;
  onNewChat: () => void;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onRenamed: () => void; // notify parent to re-render after a local title change
  open: boolean; // mobile drawer
  onClose: () => void;
}

// ── Row (a single conversation entry) ───────────────────────────────────────────
function SessionRow({
  session,
  active,
  onSelect,
  onDelete,
  onRenamed,
}: {
  session: SessionMeta;
  active: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRenamed: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "group relative flex items-center gap-2 rounded-xl px-2.5 py-2.5 text-[12.5px] cursor-pointer transition-all duration-200",
        active
          ? "bg-gradient-to-r from-violet-500/[0.16] to-violet-500/[0.03] text-white shadow-[0_0_0_1px_rgba(139,92,246,0.12)]"
          : "text-slate-400 hover:bg-white/[0.045] hover:text-slate-200 hover:translate-x-[1px]",
      )}
      onClick={() => !editing && onSelect(session.session_id)}
    >
      {active && (
        <motion.span
          layoutId="activeSessionBar"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.6)]"
        />
      )}
      <MessageSquare className={cn("w-3.5 h-3.5 flex-shrink-0", active ? "text-violet-300" : "text-slate-500")} />

      {editing ? (
        <motion.input
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (editValue.trim()) {
                setSessionTitle(session.session_id, editValue);
                onRenamed();
              }
              setEditing(false);
            }
            if (e.key === "Escape") setEditing(false);
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-grow bg-transparent border-b border-violet-500/40 text-[12.5px] text-white focus:outline-none"
        />
      ) : (
        <span className="flex-grow truncate">{displayTitle(session.session_id, "Conversation")}</span>
      )}

      {editing ? (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (editValue.trim()) {
                setSessionTitle(session.session_id, editValue);
                onRenamed();
              }
              setEditing(false);
            }}
            className="p-0.5 text-green-400 hover:text-green-300"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setEditing(false); }} className="p-0.5 text-slate-500 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      ) : (
        <div className="hidden group-hover:flex items-center gap-0.5 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditValue(displayTitle(session.session_id, "Conversation"));
              setEditing(true);
            }}
            title="Rename"
            className="p-1 rounded-md hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(session.session_id); }}
            title="Delete"
            className="p-1 rounded-md hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ── Full (expanded) body used both in the desktop rail and mobile drawer ──────────
function SidebarBody({
  sessions,
  currentSessionId,
  loading,
  onNewChat,
  onSelect,
  onDelete,
  onRenamed,
  collapsed = false,
  onToggleCollapse,
  searchRef,
}: Omit<SidebarProps, "open" | "onClose"> & {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  searchRef?: React.RefObject<HTMLInputElement>;
}) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? sessions.filter((s) => displayTitle(s.session_id, "Conversation").toLowerCase().includes(q))
      : sessions;
    return groupSessionsByDate(filtered);
  }, [sessions, query]);

  // ── Collapsed icon rail ──────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="flex flex-col items-center h-full py-3 gap-2">
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title="Expand sidebar"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors mb-2"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onNewChat}
          title="New Chat"
          className="w-9 h-9 rounded-xl flex items-center justify-center border border-violet-500/20 bg-violet-500/[0.08] hover:bg-violet-500/[0.16] text-violet-300 transition-all"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={onToggleCollapse}
          title="Search chats"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Collapse toggle */}
      {onToggleCollapse && (
        <div className="flex justify-end px-2 pt-2.5">
          <button
            onClick={onToggleCollapse}
            title="Collapse sidebar"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* New chat */}
      <div className="px-3 pt-1 pb-2">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-violet-500/20 bg-violet-500/[0.08] hover:bg-violet-500/[0.16] hover:shadow-[0_0_20px_rgba(139,92,246,0.1)] text-[13px] font-semibold text-violet-200 transition-all duration-200"
        >
          <Plus className="w-4 h-4" /> New Chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02] focus-within:border-violet-500/30 focus-within:bg-white/[0.03] transition-all">
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            className="flex-grow bg-transparent border-0 text-[11.5px] text-slate-200 placeholder:text-slate-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Sessions */}
      <div className="flex-grow overflow-y-auto custom-scrollbar px-2 pb-3 space-y-4">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-[11px] text-slate-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="px-3 py-6 text-center text-[11px] text-slate-600">No conversations yet.</div>
        )}

        {groups.map((group) => (
          <div key={group.label} className="space-y-1">
            <div className="px-2.5 text-[9px] font-bold uppercase tracking-widest text-slate-600">{group.label}</div>
            <AnimatePresence initial={false}>
              {group.sessions.map((s) => (
                <SessionRow
                  key={s.session_id}
                  session={s}
                  active={s.session_id === currentSessionId}
                  onSelect={onSelect}
                  onDelete={onDelete}
                  onRenamed={onRenamed}
                />
              ))}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChatSidebar(props: SidebarProps) {
  const { open, onClose } = props;
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Restore persisted collapsed state after mount (avoids SSR/client mismatch).
  useEffect(() => {
    setCollapsed(readCollapsed());
    setHydrated(true);
  }, []);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      if (prev) {
        // was collapsed -> now expanding: focus search once the panel opens
        setTimeout(() => searchRef.current?.focus(), WIDTH_TRANSITION.duration * 1000);
      }
      return next;
    });
  };

  return (
    <>
      {/* Desktop: in-page left column, animated width */}
      <motion.aside
        initial={false}
        animate={{ width: hydrated && collapsed ? COLLAPSED_W : EXPANDED_W }}
        transition={WIDTH_TRANSITION}
        className="hidden lg:flex flex-col flex-shrink-0 border-r border-white/[0.05] bg-[#080B14]/90 backdrop-blur-md overflow-hidden relative"
      >
        {/* subtle top glow to tie into the hero's glass aesthetic */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-24 bg-violet-500/[0.06] blur-[60px] rounded-full pointer-events-none" />
        <SidebarBody {...props} collapsed={hydrated && collapsed} onToggleCollapse={toggleCollapse} searchRef={searchRef} />
      </motion.aside>

      {/* Mobile: drawer (always expanded — it's already an overlay you can dismiss) */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={onClose}
            />
            <motion.aside
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 border-r border-white/[0.06] bg-[#080B14]/95 backdrop-blur-md shadow-2xl"
            >
              <SidebarBody {...props} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
