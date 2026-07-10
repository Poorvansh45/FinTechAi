"use client";

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
      {SUGGESTED_PROMPTS.map((chip) => {
        const Icon = chip.icon;
        return (
          <button
            key={chip.label}
            type="button"
            disabled={disabled}
            onClick={() => onPick(chip.prompt)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/[0.05] bg-[#090D1A]/50 hover:bg-white/[0.02] hover:border-violet-500/20 text-[11px] text-slate-400 hover:text-white transition-all active:scale-[0.98] hover:shadow-[0_0_15px_rgba(139,92,246,0.04)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Icon className="w-3 h-3 text-slate-500" />
            <span>{chip.label}</span>
          </button>
        );
      })}
    </div>
  );
}
