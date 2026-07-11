"use client";

import { TrendingUp, PieChart, Search, Globe, Plus, Mic, ArrowUp, ShieldAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SuggestedPrompts } from "./SuggestedPrompts";

// Preserved from the original hero — do not restyle (design is intentional).
const CORE_CARDS: { icon: LucideIcon; iconColor: string; title: string; desc: string }[] = [
  { icon: TrendingUp, iconColor: "text-violet-400 bg-violet-500/10 border-violet-500/20", title: "Market Insights", desc: "Get AI-powered insights on market trends and opportunities." },
  { icon: PieChart, iconColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", title: "Portfolio Intelligence", desc: "Analyze your portfolio performance, risk and allocation." },
  { icon: Search, iconColor: "text-blue-400 bg-blue-500/10 border-blue-500/20", title: "Stock Research", desc: "Deep dive into stocks with financials, ratios, and forecasts." },
  { icon: Globe, iconColor: "text-amber-400 bg-amber-500/10 border-amber-500/20", title: "Macro Analysis", desc: "Understand macro trends, sectors, and global economic impact." },
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
      <div className="absolute top-[110px] left-1/2 -translate-x-1/2 w-[600px] h-[150px] bg-gradient-to-r from-violet-500/15 via-fuchsia-500/10 to-indigo-500/15 blur-[90px] rounded-full pointer-events-none -z-10 animate-pulse" style={{ animationDuration: "5s" }} />

      {/* Top Pill badge */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 text-[11px] font-semibold text-violet-300 shadow-[0_0_20px_rgba(139,92,246,0.12)]">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-500" />
        </span>
        <span>FinTechAI Copilot</span>
      </div>

      {/* Headline */}
      <div className="space-y-3 text-center">
        <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
          How can I <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 font-extrabold">help?</span>
        </h1>
        <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
          Your all-in-one AI financial analyst. Ask anything about markets, stocks, portfolios, trading, macroeconomy, news, or your investments.
        </p>
      </div>

      {/* Giant Search/Chat Bar */}
      <form
        onSubmit={(e) => { e.preventDefault(); onSend(input); }}
        className="w-full max-w-2xl flex items-center gap-3 bg-[#0A0F1D]/80 border border-white/[0.08] hover:border-violet-500/30 rounded-[28px] p-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.5),0_0_24px_rgba(139,92,246,0.06)] transition-all duration-300 focus-within:border-violet-500/40 focus-within:shadow-[0_0_35px_rgba(139,92,246,0.12)] backdrop-blur-md"
      >
        <button type="button" disabled title="Attachments coming soon" className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 bg-white/5 cursor-not-allowed">
          <Plus className="w-4 h-4" />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Ask anything..."
          disabled={disabled}
          className="flex-grow bg-transparent border-0 px-2 py-2 text-xs md:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-0 disabled:opacity-50"
        />
        <button type="button" title="Voice input (UI only)" className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:text-white transition-colors">
          <Mic className="w-4 h-4" />
        </button>
        <button
          type="submit"
          disabled={!input.trim() || disabled}
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
            input.trim() && !disabled
              ? "bg-[#8B5CF6] hover:bg-[#7C3AED] hover:scale-105 text-white shadow-[0_0_15px_rgba(139,92,246,0.4)] active:scale-95"
              : "bg-white/5 text-slate-600 cursor-not-allowed",
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full pt-6 border-t border-white/[0.04]">
        {CORE_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="p-5 rounded-2xl border border-white/[0.04] bg-[#0A0E1A]/40 flex flex-col space-y-4 hover:border-violet-500/25 hover:bg-[#0C1226]/50 hover:shadow-[0_12px_30px_rgba(139,92,246,0.06)] transition-all duration-300 group">
              <div className={cn("p-2.5 rounded-xl border w-fit flex items-center justify-center transition-transform group-hover:scale-105", card.iconColor)}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-white tracking-wide">{card.title}</h3>
                <p className="text-[10px] text-slate-500 leading-normal">{card.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Disclaimer */}
      <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-600 select-none pt-2">
        <ShieldAlert className="w-3.5 h-3.5 text-slate-600" />
        <span>FinTechAI Copilot can make mistakes. Verify important information.</span>
      </div>
    </div>
  );
}
