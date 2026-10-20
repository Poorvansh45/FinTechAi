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
      <span className="text-[11px] font-bold text-neutral-500">Follow-ups</span>
      <div className="flex flex-col gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            className="group flex items-center gap-2 text-left px-3 py-2 rounded-xl border border-foreground/[0.05] bg-foreground/[0.02] hover:border-brand-500/25 hover:bg-brand-500/[0.06] transition-all text-[11px] text-neutral-300 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CornerDownRight className="w-3 h-3 text-neutral-500 group-hover:text-brand-400 transition-colors flex-shrink-0" />
            <span>{s}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
