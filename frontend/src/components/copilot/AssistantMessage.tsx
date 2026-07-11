"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, Copy, Check, RefreshCw, Brain, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UiMessage } from "@/lib/copilot/types";
import { AgentBadge } from "./AgentBadge";
import { ToolBadges } from "./ToolBadges";
import { Sources } from "./Sources";
import { FollowUps } from "./FollowUps";
import { MarkdownContent } from "./MarkdownContent";

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function AssistantMessage({
  message,
  streaming = false,
  canRegenerate = false,
  onRegenerate,
  onPickFollowUp,
}: {
  message: UiMessage;
  streaming?: boolean;
  canRegenerate?: boolean;
  onRegenerate?: () => void;
  onPickFollowUp?: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex gap-4 p-4 md:p-5 rounded-2xl border bg-[#090D1A]/50 backdrop-blur-sm border-white/[0.05] mr-3 md:mr-12"
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-violet-500/10 border border-violet-500/20 text-violet-400">
        <Bot className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        {/* Header: agent badge + actions */}
        <div className="flex items-center justify-between gap-2">
          <AgentBadge agent={message.agent} />
          {!streaming && (
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-600 mr-1">{formatTime(message.ts)}</span>
              <button
                onClick={handleCopy}
                title="Copy"
                className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              {canRegenerate && onRegenerate && (
                <button
                  onClick={onRegenerate}
                  title="Regenerate"
                  className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Answer — rendered as themed GitHub-Flavored Markdown */}
        <div className="select-text">
          <MarkdownContent text={streaming ? `${message.text}▌` : message.text} />
        </div>

        {/* Metadata (only once the response is complete) */}
        {!streaming && (
          <>
            <ToolBadges tools={message.tools} />

            {message.reasoning && (
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] overflow-hidden">
                <button
                  onClick={() => setShowReasoning((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Brain className="w-3 h-3" /> Reasoning
                  </span>
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showReasoning && "rotate-180")} />
                </button>
                {showReasoning && (
                  <p className="px-3 pb-3 text-[11px] text-slate-400 leading-relaxed">{message.reasoning}</p>
                )}
              </div>
            )}

            <Sources agent={message.agent} tools={message.tools} />

            {onPickFollowUp && (
              <FollowUps suggestions={message.suggestions} onPick={onPickFollowUp} />
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
