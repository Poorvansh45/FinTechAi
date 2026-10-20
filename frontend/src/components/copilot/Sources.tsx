"use client";

import { Database } from "lucide-react";
import { sourcesFor } from "@/lib/copilot/agentMeta";

/** Small "sources" row shown under a response (which engines were used). */
export function Sources({ agent, tools }: { agent?: string; tools?: string[] }) {
  const sources = sourcesFor(agent, tools);
  if (sources.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-500">
        <Database className="w-2.5 h-2.5" /> Sources
      </span>
      {sources.map((s) => (
        <span
          key={s}
          className="px-2 py-0.5 rounded-md bg-foreground/[0.02] border border-foreground/[0.05] text-[11px] text-neutral-400"
        >
          {s}
        </span>
      ))}
    </div>
  );
}
