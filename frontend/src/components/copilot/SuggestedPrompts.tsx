"use client";

import { motion } from "framer-motion";
import {
  PieChart, Scale, HeartPulse, GitCompare, PiggyBank, Layers, ShieldAlert, type LucideIcon,
} from "lucide-react";

// Dynamic starter prompts geared at the real agents (portfolio/market/planning).
export const SUGGESTED_PROMPTS: { icon: LucideIcon; label: string; prompt: string }[] = [
  { icon: PieChart, label: "Analyze my portfolio", prompt: "Analyze my portfolio and tell me the risks." },
  { icon: Scale, label: "Should I rebalance?", prompt: "Should I rebalance my portfolio? Explain your reasoning." },
  { icon: HeartPulse, label: "Explain my health score", prompt: "Explain my portfolio health score and what drives it." },
  { icon: GitCompare, label: "Compare TCS vs Infosys", prompt: "Compare TCS vs Infosys." },
  { icon: PiggyBank, label: "Build a SIP plan", prompt: "Help me build a SIP plan to reach 1 crore in 15 years." },
  { icon: Layers, label: "Review diversification", prompt: "Review my portfolio diversification." },
  { icon: ShieldAlert, label: "What's my biggest risk?", prompt: "What is my biggest portfolio risk right now?" },
];

export function SuggestedPrompts({
  onPick,
  disabled,
}: {
  onPick: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 max-w-3xl">
      {SUGGESTED_PROMPTS.map((chip, i) => {
        const Icon = chip.icon;
        return (
          <motion.button
            key={chip.label}
            type="button"
            disabled={disabled}
            onClick={() => onPick(chip.prompt)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 * i, ease: [0.16, 1, 0.3, 1] }}
            whileHover={disabled ? undefined : { y: -2, scale: 1.02 }}
            whileTap={disabled ? undefined : { scale: 0.97 }}
            className="group flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/[0.05] bg-[#090D1A]/50 hover:bg-white/[0.035] hover:border-violet-500/25 text-[11px] text-slate-400 hover:text-white transition-colors duration-200 hover:shadow-[0_6px_20px_rgba(139,92,246,0.1)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Icon className="w-3 h-3 text-slate-500 group-hover:text-violet-300 transition-colors duration-200" />
            <span>{chip.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
