"use client";

import { TrendingUp, PieChart, Search, Globe, Plus, Mic, ArrowUp, ShieldAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SuggestedPrompts } from "./SuggestedPrompts";

// Preserved from the original hero — do not restyle (design is intentional).
const CORE_CARDS: { icon: LucideIcon; iconColor: string; title: string; desc: string }[] = [
  { icon: TrendingUp, iconColor: "text-brand-400 bg-brand-500/10 border-brand-500/20", title: "Market Insights", desc: "Get AI-powered insights on market trends and opportunities." },
  { icon: PieChart, iconColor: "text-positive-400 bg-positive-500/10 border-positive-500/20", title: "Portfolio Intelligence", desc: "Analyze your portfolio performance, risk and allocation." },
  { icon: Search, iconColor: "text-brand-400 bg-brand-500/10 border-brand-500/20", title: "Stock Research", desc: "Deep dive into stocks with financials, ratios, and forecasts." },
  { icon: Globe, iconColor: "text-warning-400 bg-warning-500/10 border-warning-500/20", title: "Macro Analysis", desc: "Understand macro trends, sectors, and global economic impact." },
];

export function WelcomeScreen({
  input,
  onInputChange,
  onSend,
  disabled,
}: {
  input: string;
  onInputChange: (v: string) => void;
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="max-w-4xl mx-auto w-full px-4 md:px-6 flex flex-col items-center justify-start pt-6 pb-8 md:pt-10 md:pb-12 space-y-5 md:space-y-7 animate-fadeIn relative">
      {/* Animated Glowing Backdrop */}

      {/* Top Pill badge */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md border border-brand-500/20 bg-brand-500/5 text-[11px] font-semibold text-brand-300">
        <span className="relative flex h-1.5 w-1.5">
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-500" />
        </span>
        <span>Nivro Copilot</span>
      </div>

      {/* Headline */}
      <div className="space-y-3 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
          How can I <span className="text-brand-400 font-bold">help?</span>
        </h1>
        <p className="text-neutral-400 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
          Your all-in-one AI financial analyst. Ask anything about markets, stocks, portfolios, trading, macroeconomy, news, or your investments.
        </p>
      </div>

      {/* Giant Search/Chat Bar */}
      <form
        onSubmit={(e) => { e.preventDefault(); onSend(input); }}
        className="w-full max-w-2xl flex items-center gap-3 bg-neutral-900/80 border border-foreground/[0.08] hover:border-brand-500/30 rounded-xl p-2.5 transition-all duration-300 focus-within:border-brand-500/40"
      >
        <button type="button" disabled title="Attachments coming soon" className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-500 bg-foreground/5 cursor-not-allowed">
          <Plus className="w-4 h-4" />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Ask anything..."
          disabled={disabled}
          className="flex-grow bg-transparent border-0 px-2 py-2 text-xs md:text-sm text-foreground placeholder:text-neutral-500 focus:outline-none focus:ring-0 disabled:opacity-50"
        />
        <button type="button" title="Voice input (UI only)" className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-500 hover:text-foreground transition-colors">
          <Mic className="w-4 h-4" />
        </button>
        <button
          type="submit"
          disabled={!input.trim() || disabled}
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
            input.trim() && !disabled
              ? "bg-brand-600 hover:bg-brand-700 text-white active:scale-95"
              : "bg-foreground/5 text-neutral-500 cursor-not-allowed",
          )}
        >
          <ArrowUp className="w-4 h-4 stroke-[2.5px]" />
        </button>
      </form>

      {/* Dynamic starter prompts */}
      <div className="pt-1">
        <SuggestedPrompts onPick={onSend} disabled={disabled} />
      </div>

      {/* Core Feature Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full pt-6 border-t border-foreground/[0.04]">
        {CORE_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="p-5 rounded-xl border border-foreground/[0.04] bg-neutral-900/40 flex flex-col space-y-4 hover:border-brand-500/25 hover:bg-neutral-900/50 transition-all duration-300 group">
              <div className={cn("p-2.5 rounded-xl border w-fit flex items-center justify-center transition-transform group-hover:scale-105", card.iconColor)}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-foreground tracking-wide">{card.title}</h3>
                <p className="text-[11px] text-neutral-500 leading-normal">{card.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Disclaimer */}
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-500 select-none pt-2">
        <ShieldAlert className="w-3.5 h-3.5 text-neutral-500" />
        <span>Nivro Copilot can make mistakes. Verify important information.</span>
      </div>
    </div>
  );
}
