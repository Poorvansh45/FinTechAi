"use client";

import { User } from "lucide-react";
import { motion } from "framer-motion";

export function UserMessage({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex gap-4 p-4 md:p-5 rounded-xl border bg-foreground/[0.015] backdrop-blur-sm border-foreground/[0.03] ml-3 md:ml-12"
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-brand-500/10 border border-brand-500/20 text-brand-400">
        <User className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <span className="text-[11px] font-bold text-neutral-500">You</span>
        <p className="text-xs md:text-[13px] text-neutral-200 leading-relaxed whitespace-pre-wrap select-text">
          {text}
        </p>
      </div>
    </motion.div>
  );
}
