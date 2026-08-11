"use client";

import { useRef, useEffect } from "react";
import { Plus, Mic, Send, Square } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_CHARS = 4000; // mirrors backend ChatRequest max_length

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  loading: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea up to a cap.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading) onSend();
    }
    // Shift+Enter → newline (default behaviour)
  };

  const canSend = value.trim().length > 0 && !loading;
  const over = value.length > MAX_CHARS;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-end gap-2 bg-[#0A0F1D]/90 backdrop-blur-md border border-white/[0.08] rounded-[26px] p-2.5 focus-within:border-violet-500/40 focus-within:shadow-[0_0_28px_rgba(139,92,246,0.06)] transition-all duration-300">
        {/* Attachment (disabled — future) */}
        <button
          type="button"
          disabled
          title="Attachments coming soon"
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 bg-white/5 cursor-not-allowed flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>

        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={loading ? "Analyzing…" : "Ask a follow-up…  (Enter to send, Shift+Enter for newline)"}
          className="flex-grow resize-none bg-transparent border-0 px-2 py-2.5 min-h-[24px] text-xs md:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-0 max-h-40 leading-relaxed"
        />

        {/* Voice (UI only) */}
        <button
          type="button"
          title="Voice input (UI only)"
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:text-white transition-colors flex-shrink-0"
        >
          <Mic className="w-4 h-4" />
        </button>

        {/* Send / Stop */}
        {loading ? (
          <button
            type="button"
            onClick={onStop}
            title="Stop generating"
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-white/10 hover:bg-white/20 text-white transition-all"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => canSend && onSend()}
            disabled={!canSend}
            title="Send"
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
              canSend
                ? "bg-[#8B5CF6] hover:bg-[#7C3AED] hover:scale-105 text-white shadow-[0_0_12px_rgba(139,92,246,0.3)] active:scale-95"
                : "bg-white/5 text-slate-600 cursor-not-allowed",
            )}
          >
            <Send className="w-4 h-4 stroke-[2.5px]" />
          </button>
        )}
      </div>

      {/* Footer: counter + disclaimer */}
      <div className="flex items-center justify-between mt-2 px-2">
        <span className="text-[9px] text-slate-600 select-none">
          Nivro Copilot can make mistakes. Verify important information.
        </span>
        <span className={cn("text-[9px] tabular-nums", over ? "text-red-400" : "text-slate-600")}>
          {value.length}/{MAX_CHARS}
        </span>
      </div>
    </div>
  );
}
