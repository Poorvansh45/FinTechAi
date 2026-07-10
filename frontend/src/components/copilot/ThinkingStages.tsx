"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Bot } from "lucide-react";

// Simulated reasoning stages. The Phase 2A backend is non-streaming (real SSE
// stage events land in 2C) — this animates progress instead of waiting silently.
const STAGES = [
  "Thinking…",
  "Consulting the right analyst…",
  "Running analytics…",
  "Composing your answer…",
];

export function ThinkingStages() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setI((prev) => (prev < STAGES.length - 1 ? prev + 1 : prev));
    }, 1300);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex gap-4 p-5 rounded-2xl border bg-[#090D1A]/50 border-white/[0.05] mr-12">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-violet-500/10 border border-violet-500/20 text-violet-400">
        <Bot className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-violet-300">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <AnimatePresence mode="wait">
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
            >
              {STAGES[i]}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-5/6 rounded bg-white/5 animate-pulse" />
          <div className="h-3 w-4/6 rounded bg-white/5 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
