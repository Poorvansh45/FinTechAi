"use client";

import { CornerDownRight } from "lucide-react";

/** Clickable follow-up suggestions returned by the copilot. */
export function FollowUps({
  suggestions,
  onPick,
  disabled,
}: {
  suggestions?: string[];
  onPick: (text: string) => void;
  disabled?: boolean;
}) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div className="space-y-1.5 pt-1">
      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Follow-ups</span>
      <div className="flex flex-col gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            className="group flex items-center gap-2 text-left px-3 py-2 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:border-violet-500/25 hover:bg-violet-500/[0.06] transition-all text-[11px] text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CornerDownRight className="w-3 h-3 text-slate-600 group-hover:text-violet-400 transition-colors flex-shrink-0" />
            <span>{s}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
