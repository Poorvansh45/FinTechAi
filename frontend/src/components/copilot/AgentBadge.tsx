"use client";

import { cn } from "@/lib/utils";
import { agentMeta } from "@/lib/copilot/agentMeta";

/** Pill showing which specialist agent produced the response. */
export function AgentBadge({ agent }: { agent?: string }) {
  const meta = agentMeta(agent);
  const Icon = meta.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold tracking-wide",
        meta.border,
        meta.color,
      )}
    >
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}
