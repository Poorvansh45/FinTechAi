"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Sparkles, TrendingUp, Search, PieChart, Globe, FileText, 
  Calendar, Plus, Mic, ArrowUp, User, Bot, Copy, Check, 
  RefreshCw, ShieldAlert, ArrowLeft, Send
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authHeader } from "@/lib/api/authToken";

interface ChatMessage {
  role: "user" | "ai";
  text: string;
  ts: string;
}

const QUICK_CHIPS = [
  { icon: TrendingUp, label: "Market Outlook", prompt: "Give me an overview of the current global market outlook and main sector rotation trends." },
  { icon: Search, label: "Stock Analysis", prompt: "Analyze AAPL and NVDA. Compare their key financials, valuation multiples, and structural growth drivers." },
  { icon: PieChart, label: "Portfolio Review", prompt: "How can I check if my portfolio is well-diversified? What metrics (like Sharpe ratio or beta) should I focus on?" },
  { icon: FileText, label: "News Summary", prompt: "Summarize the latest financial news events and central bank rate expectations." },
  { icon: Calendar, label: "Earnings Analysis", prompt: "Analyze recent corporate earnings trends. Which sectors are reporting the strongest surprises?" }
];

const CORE_CARDS = [
  {
    icon: TrendingUp,
    iconColor: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    title: "Market Insights",
    desc: "Get AI-powered insights on market trends and opportunities."
  },
  {
    icon: PieChart,
    iconColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    title: "Portfolio Intelligence",
    desc: "Analyze your portfolio performance, risk and allocation."
  },
  {
    icon: Search,
    iconColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    title: "Stock Research",
    desc: "Deep dive into stocks with financials, ratios, and forecasts."
  },
  {
    icon: Globe,
    iconColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    title: "Macro Analysis",
    desc: "Understand macro trends, sectors, and global economic impact."
  }
];

export default function AICopilotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load chat history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("copilot_chat_history");
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Save chat history
  const saveChatHistory = (history: ChatMessage[]) => {
    setMessages(history);
    localStorage.setItem("copilot_chat_history", JSON.stringify(history));
  };

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, loading]);

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(idx);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReset = () => {
    setStreamingText("");
    saveChatHistory([]);
  };

  const handleSend = async (textToSend: string) => {
    const prompt = textToSend.trim();
    if (!prompt || loading) return;

    setInput("");
    setLoading(true);

    const userMsg: ChatMessage = {
      role: "user",
      text: prompt,
      ts: new Date().toISOString()
    };

    const updatedMessages = [...messages, userMsg];
    saveChatHistory(updatedMessages);

    try {
      const res = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!res.ok) {
        throw new Error("Failed to communicate with AI server");
      }

      const data = await res.json();
      const responseText = data.text || "No insights found.";

      // Stream character by character simulation
      let i = 0;
      const streamSpeed = Math.max(5, Math.floor(responseText.length / 300));
      const interval = setInterval(() => {
        i += streamSpeed;
        if (i >= responseText.length) {
          clearInterval(interval);
          setStreamingText("");
          
          const aiMsg: ChatMessage = {
            role: "ai",
            text: responseText,
            ts: new Date().toISOString()
          };
          
          const latestMessages = [...updatedMessages, aiMsg];
          saveChatHistory(latestMessages);
          setLoading(false);
        } else {
          setStreamingText(responseText.slice(0, i));
        }
      }, 15);

    } catch (err: any) {
      console.error(err);
      const errMessage: ChatMessage = {
        role: "ai",
        text: "Error: FinTechAI Copilot was unable to fetch a response. Please check your network connection and configuration API Key.",
        ts: new Date().toISOString()
      };
      saveChatHistory([...updatedMessages, errMessage]);
      setLoading(false);
    }
  };

  const isWelcomeState = messages.length === 0 && !loading;

  return (
    <div className="flex flex-col min-h-[calc(100vh-100px)] rounded-3xl border border-white/[0.06] bg-[#070B14] relative z-10 overflow-hidden">
      
      {/* ── HEADER TOOLBAR (Active state only) ── */}
      {!isWelcomeState && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04] bg-[#090D1A]/50">
          <div className="flex items-center gap-2">
            <button 
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] text-xs font-semibold text-slate-400 hover:text-white transition-all hover:bg-white/[0.04]"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Start New Chat
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Gemini Active</span>
          </div>
        </div>
      )}

      {/* ── MAIN WORKSPACE CONTAINER ── */}
      <div className="flex-1 flex flex-col justify-between overflow-y-auto custom-scrollbar">
        
        {isWelcomeState ? (
          
          /* ═════════════════════════════════════════════════════════════════
             1. WELCOME SCREEN (Centered, matching user uploaded mockup image)
             ═════════════════════════════════════════════════════════════════ */
          <div className="max-w-4xl mx-auto w-full px-6 flex flex-col items-center justify-center py-12 md:py-16 space-y-10 animate-fadeIn relative">
            
            {/* Animated Glowing Backdrop */}
            <div className="absolute top-[180px] left-1/2 -translate-x-1/2 w-[600px] h-[150px] bg-gradient-to-r from-violet-500/15 via-fuchsia-500/10 to-indigo-500/15 blur-[90px] rounded-full pointer-events-none -z-10 animate-pulse" style={{ animationDuration: "5s" }} />

            {/* Top Pill badge with pulsing ping */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 text-[11px] font-semibold text-violet-300 shadow-[0_0_20px_rgba(139,92,246,0.12)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-500" />
              </span>
              <span>FinTechAI Copilot</span>
            </div>

            {/* Headline */}
            <div className="space-y-4 text-center">
              <h1 className="text-4xl md:text-5xl font-black text-white leading-tight">
                How can I <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 font-extrabold">help?</span>
              </h1>
              <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
                Your all-in-one AI financial analyst. Ask anything about markets, stocks, portfolios, trading, macroeconomy, news, or your investments.
              </p>
            </div>

            {/* Giant Search/Chat Bar with glowing focus and hover */}
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
              className="w-full max-w-2xl flex items-center gap-3 bg-[#0A0F1D]/80 border border-white/[0.08] hover:border-violet-500/30 rounded-[28px] p-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.5),0_0_24px_rgba(139,92,246,0.06)] transition-all duration-300 focus-within:border-violet-500/40 focus-within:shadow-[0_0_35px_rgba(139,92,246,0.12)] backdrop-blur-md"
            >
              {/* Plus Attachment Option */}
              <button 
                type="button"
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything..."
                className="flex-grow bg-transparent border-0 px-2 py-2 text-xs md:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-0"
              />

              {/* Mic Icon */}
              <button 
                type="button"
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:text-white transition-colors"
              >
                <Mic className="w-4 h-4" />
              </button>

              {/* Up-Arrow Submit button with shadow glow */}
              <button
                type="submit"
                disabled={!input.trim()}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
                  input.trim()
                    ? "bg-[#8B5CF6] hover:bg-[#7C3AED] hover:scale-105 text-white shadow-[0_0_15px_rgba(139,92,246,0.4)] active:scale-95"
                    : "bg-white/5 text-slate-600 cursor-not-allowed"
                )}
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5px]" />
              </button>
            </form>

            {/* Quick Chips Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-3xl pt-2">
              {QUICK_CHIPS.map(chip => {
                const Icon = chip.icon;
                return (
                  <button
                    key={chip.label}
                    onClick={() => handleSend(chip.prompt)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/[0.05] bg-[#090D1A]/50 hover:bg-white/[0.02] hover:border-violet-500/20 text-[11px] text-slate-400 hover:text-white transition-all active:scale-[0.98] hover:shadow-[0_0_15px_rgba(139,92,246,0.04)]"
                  >
                    <Icon className="w-3 h-3 text-slate-500" />
                    <span>{chip.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Core Feature Cards Grid with glowing borders and shadow on hover */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full pt-8 border-t border-white/[0.04]">
              {CORE_CARDS.map(card => {
                const Icon = card.icon;
                return (
                  <div 
                    key={card.title} 
                    className="p-5 rounded-2xl border border-white/[0.04] bg-[#0A0E1A]/40 flex flex-col space-y-4 hover:border-violet-500/25 hover:bg-[#0C1226]/50 hover:shadow-[0_12px_30px_rgba(139,92,246,0.06)] transition-all duration-300 group"
                  >
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
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-600 select-none pt-4">
              <ShieldAlert className="w-3.5 h-3.5 text-slate-600" />
              <span>FinTechAI Copilot can make mistakes. Verify important information.</span>
            </div>

          </div>

        ) : (
          
          /* ═════════════════════════════════════════════════════════════════
             2. ACTIVE CHAT LOG VIEW (Centered scroll stream with bottom input)
             ═════════════════════════════════════════════════════════════════ */
          <div className="flex-1 flex flex-col justify-between h-full relative">
            
            {/* Scroll List */}
            <div className="flex-grow overflow-y-auto px-6 py-8 space-y-6">
              <div className="max-w-3xl mx-auto space-y-6">
                
                {/* Chat History Messages */}
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex gap-4 p-5 rounded-2xl border transition-all animate-fadeUp",
                      m.role === "user"
                        ? "bg-white/[0.015] border-white/[0.03] ml-12"
                        : "bg-[#090D1A]/50 border-white/[0.05] mr-12"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      m.role === "user"
                        ? "bg-blue-500/10 border border-blue-500/20 text-blue-400"
                        : "bg-violet-500/10 border border-violet-500/20 text-violet-400"
                    )}>
                      {m.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">
                          {m.role === "user" ? "You" : "FinTechAI Copilot"}
                        </span>
                        {m.role === "ai" && (
                          <button
                            onClick={() => handleCopy(m.text, idx)}
                            className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
                          >
                            {copiedId === idx ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                      <p className="text-xs md:text-[13px] text-slate-300 leading-relaxed whitespace-pre-wrap select-text markdown-render">
                        {m.text}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Streaming Response Bubble */}
                {streamingText && (
                  <div className="flex gap-4 p-5 rounded-2xl border bg-[#090D1A]/50 border-white/[0.05] mr-12 animate-pulse-subtle">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-violet-500/10 border border-violet-500/20 text-violet-400">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-3">
                      <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">FinTechAI Copilot</span>
                      <p className="text-xs md:text-[13px] text-slate-300 leading-relaxed whitespace-pre-wrap select-text">
                        {streamingText}
                      </p>
                    </div>
                  </div>
                )}

                {/* Loading Skeleton */}
                {loading && !streamingText && (
                  <div className="flex gap-4 p-5 rounded-2xl border bg-[#090D1A]/50 border-white/[0.05] mr-12">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-violet-500/10 border border-violet-500/20 text-violet-400">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-3">
                      <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Analysing...</span>
                      <div className="space-y-2">
                        <div className="h-3 w-5/6 rounded bg-white/5 animate-pulse" />
                        <div className="h-3 w-4/6 rounded bg-white/5 animate-pulse" />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Bottom sticky Chat Input */}
            <div className="p-4 md:p-6 border-t border-white/[0.04] bg-[#070B14]/80 backdrop-blur-md sticky bottom-0">
              <div className="max-w-3xl mx-auto">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
                  className="flex items-center gap-3 bg-[#0A0F1D] border border-white/[0.08] rounded-[28px] p-2 relative group focus-within:border-violet-500/40 focus-within:shadow-[0_0_24px_rgba(139,92,246,0.04)] transition-all duration-300"
                >
                  <button 
                    type="button"
                    className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={loading ? "Analyzing query..." : "Ask Copilot follow-up questions..."}
                    disabled={loading}
                    className="flex-grow bg-transparent border-0 px-2 py-2 text-xs md:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-0 disabled:opacity-50"
                  />

                  <button 
                    type="button"
                    className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:text-white transition-colors"
                  >
                    <Mic className="w-4 h-4" />
                  </button>

                  <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
                      input.trim() && !loading
                        ? "bg-[#8B5CF6] hover:bg-[#7C3AED] hover:scale-105 text-white shadow-[0_0_12px_rgba(139,92,246,0.3)] active:scale-95"
                        : "bg-white/5 text-slate-600 cursor-not-allowed"
                    )}
                  >
                    <Send className="w-4 h-4 stroke-[2.5px]" />
                  </button>
                </form>

                <div className="text-center mt-2.5 text-[9px] text-slate-600 select-none">
                  FinTechAI Copilot can make mistakes. Verify important information.
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
