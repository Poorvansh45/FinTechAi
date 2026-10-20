"use client";

import { toolBadges } from "@/lib/copilot/agentMeta";

/** Chips for each tool the agent executed (e.g. Risk Engine, Health Score). */
export function ToolBadges({ tools }: { tools?: string[] }) {
  const badges = toolBadges(tools);
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-bold text-neutral-500">Tools</span>
      {badges.map((b) => {
        const Icon = b.Icon;
        return (
          <span
            key={b.label}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-foreground/[0.06] bg-foreground/[0.03] text-[11px] font-medium text-neutral-300"
          >
            <Icon className="w-2.5 h-2.5 text-neutral-400" />
            {b.label}
          </span>
        );
      })}
    </div>
  );
}
