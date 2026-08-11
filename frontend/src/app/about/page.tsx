export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto py-10 space-y-10 animate-fadeIn">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", color: "#a5b4fc" }}>
          About Nivro
        </div>
        <h1 className="text-3xl font-black gradient-text">Built for Serious Traders</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Nivro is a personal trading performance system designed to help traders
          build discipline, track their edge, and improve through data-driven insights.
        </p>
      </div>

      <div className="glass-card p-6 space-y-4">
        <h2 className="text-base font-bold">Why Nivro?</h2>
        {[
          ["📒 Journal Everything", "Log trades with a 9-step wizard capturing execution, psychology, session, and chart screenshots."],
          ["📊 Understand Your Edge", "Real analytics: profit factor, expectancy, max drawdown, session breakdown — not just win rate."],
          ["🤖 AI-Powered Coaching", "Gemini AI analyzes your journal and gives personalized feedback on patterns and mistakes."],
          ["🔐 100% Private", "All data stored locally in your browser. Nothing is sent to any server."],
          ["🚀 Growing Platform", "MT5 auto-journaling, AI trade assistant, and custom strategy builder are coming soon."],
        ].map(([title, desc]) => (
          <div key={title} className="flex gap-3 p-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="text-lg flex-shrink-0">{title.split(" ")[0]}</div>
            <div>
              <div className="text-sm font-semibold">{title.slice(3)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card p-6 space-y-3">
        <h2 className="text-base font-bold">Tech Stack</h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["Next.js 15", "App Router + React"],
            ["Tailwind CSS", "Utility-first styling"],
            ["Recharts", "Interactive charts"],
            ["Lucide Icons", "Consistent iconography"],
            ["Google Gemini AI", "AI analysis engine"],
            ["Python + yfinance", "Backend data scripts"],
          ].map(([tech, desc]) => (
            <div key={tech} className="rounded-xl px-3 py-2"
              style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.12)" }}>
              <div className="text-xs font-bold text-indigo-300">{tech}</div>
              <div className="text-[10px] text-muted-foreground">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground">
        Nivro · Built with ❤️ for retail traders · 2026
      </div>
    </div>
  );
}
