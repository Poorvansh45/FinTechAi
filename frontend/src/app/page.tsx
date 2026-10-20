"use client";

import { withAlpha } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { LightBeamButton } from "@/components/ui/light-beam-button";
import { HeroPreview } from "@/components/landing/HeroPreview";
import {
  ArrowRight, Bot, Plug, Sparkles, Settings2, CheckCircle2, Lock,
  Globe, Briefcase, ScanLine, ChevronRight, BookOpen,
} from "lucide-react";

// Roadmap items (not yet available)
const UPCOMING = [
  {
    icon: Plug,
    title: "MT5 Integration",
    tag: "Coming Soon",
    desc: "Connect a MetaTrader 5 account to fetch executed trades into the journal.",
    bullets: ["Fetch trades from MT5", "Reduce manual entry"],
    color: "rgb(var(--brand-400))",
  },
  {
    icon: Sparkles,
    title: "Smart Auto Journaling",
    tag: "In Development",
    desc: "Suggest setup tags and entry notes for imported trades, for you to confirm or edit.",
    bullets: ["Suggested setup tags", "Session detection", "Duplicate trade filtering"],
    color: "rgb(var(--positive-400))",
  },
  {
    icon: Bot,
    title: "AI Trade Assistant",
    tag: "Planned",
    desc: "Review trades as you log them and point out patterns worth a second look.",
    bullets: ["Risk-to-reward observations", "Recurring mistake patterns"],
    color: "rgb(var(--brand-400))",
  },
  {
    icon: Settings2,
    title: "Custom Strategy Builder",
    tag: "Planned",
    desc: "Define your own setup rules and risk parameters, then track results per strategy.",
    bullets: ["Entry and exit rules", "Per-strategy analytics"],
    color: "rgb(var(--warning-400))",
  },
];

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  "Coming Soon":    { bg: "rgb(var(--brand-500) / 0.15)",  text: "rgb(var(--brand-300))" },
  "In Development": { bg: "rgb(var(--positive-500) / 0.12)",   text: "rgb(var(--positive-400))" },
  "Planned":        { bg: "rgb(var(--warning-500) / 0.12)",  text: "rgb(var(--warning-400))" },
};

// Each card links to the real route it describes.
const MODULES = [
  {
    href: "/markets",
    icon: Globe,
    title: "Market Monitor",
    desc: "Market pulse, sector performance, top movers and a macro view, so you can read the broader context first.",
  },
  {
    href: "/screener",
    icon: ScanLine,
    title: "SMC Zone Screener",
    desc: "Scan for smart-money zones and fair value gaps, alongside technical, volume and watchlist scanners.",
  },
  {
    href: "/portfolio",
    icon: Briefcase,
    title: "Portfolio Analysis",
    desc: "Review holdings and risk metrics, and run the optimizer to compare alternative weightings.",
  },
  {
    href: "/ai-copilot",
    icon: Sparkles,
    title: "AI Copilot",
    desc: "Ask questions about markets, your portfolio and your trades. Answers come from Google Gemini and are meant to assist, not replace, your own judgment.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Find the setup",
    body: "Scan the market for candidate zones and gaps, or start from a watchlist you already follow.",
  },
  {
    n: "2",
    title: "Examine the context",
    body: "Check sector and market conditions, how the position fits your portfolio, and what the AI Copilot flags for a second look.",
  },
  {
    n: "3",
    title: "Record and review",
    body: "Log the trade in the journal and review your results over time against the plan you wrote.",
  },
];

const SECONDARY_BTN =
  "flex h-11 items-center justify-center gap-2 rounded-md border border-neutral-700 px-6 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5";

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    router.prefetch("/auth");

    const handleExit = () => setIsExiting(true);
    window.addEventListener("premium-auth-exit", handleExit);
    return () => window.removeEventListener("premium-auth-exit", handleExit);
  }, [router]);

  const handleAuthNavigation = (targetUrl: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        router.push(targetUrl);
      }, 150);
    }, 120);
  };

  return (
    <div className="space-y-16 pb-20 sm:space-y-24 overflow-x-hidden">

      {/* ── HERO ── */}
      <motion.section
        animate={{ opacity: isExiting ? 0 : 1 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="mx-auto grid max-w-7xl gap-10 px-4 pt-6 sm:px-6 sm:pt-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-12 lg:pt-10"
      >
        <div className="max-w-xl space-y-6 lg:max-w-none">
          <p className="font-mono text-label uppercase tracking-wide text-brand-400">
            A setup is not a decision.
          </p>

          <h1 className="text-display text-foreground">
            Find the setup.
            <br />
            Examine the <span className="text-brand-400">context.</span>
          </h1>

          <p className="max-w-lg text-body leading-relaxed text-neutral-300 sm:text-lg">
            Monitor markets, screen for SMC zones, and review portfolio risk in one workspace, with
            AI-assisted analysis when useful.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            {isAuthenticated ? (
              <>
                <LightBeamButton href="/home">
                  Launch Platform <ArrowRight className="h-4 w-4" />
                </LightBeamButton>
                <Link href="#product" className={SECONDARY_BTN}>See Ecosystem</Link>
              </>
            ) : (
              <>
                <LightBeamButton href="/auth?mode=signin" onClick={handleAuthNavigation("/auth?mode=signin")}>
                  Sign In <ArrowRight className="h-4 w-4" />
                </LightBeamButton>
                <Link href="#product" className={SECONDARY_BTN}>See Ecosystem</Link>
              </>
            )}
          </div>

          <ul className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-300" aria-label="Capabilities">
            {["Market Monitor", "SMC Zone Screener", "Portfolio Analysis", "AI Copilot"].map((item, i) => (
              <li key={item} className="flex items-center gap-2">
                {i > 0 && <span className="text-neutral-600" aria-hidden>·</span>}
                {item}
              </li>
            ))}
          </ul>
        </div>

        <HeroPreview />
      </motion.section>

      {/* ── MODULES ── */}
      <section id="product" className="anchor-offset mx-auto max-w-7xl space-y-8 px-4 sm:px-6">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-title text-foreground">One workspace for the research process</h2>
          <p className="text-body text-neutral-400">
            Each module opens the real tool. Use them separately or together.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-5 transition-colors hover:border-neutral-700"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-500/10 text-brand-400">
                <m.icon className="h-[18px] w-[18px]" />
              </span>
              <h3 className="text-subheading text-foreground">{m.title}</h3>
              <p className="flex-1 text-sm leading-relaxed text-neutral-400">{m.desc}</p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-400">
                Open <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>

        <p className="flex items-center gap-2 text-sm text-neutral-400">
          <BookOpen className="h-4 w-4 shrink-0" />
          A trade journal with performance analytics is included for recording and reviewing what you do.
        </p>
      </section>

      {/* ── PROCESS ── */}
      <section id="platform" className="anchor-offset mx-auto max-w-7xl space-y-8 px-4 sm:px-6">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-title text-foreground">Finding a setup is where research starts</h2>
          <p className="text-body text-neutral-400">
            Nivro is built around checking an idea before acting on it.
          </p>
        </div>

        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-lg border border-neutral-800 p-5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-700 font-mono text-caption text-neutral-300">
                {s.n}
              </span>
              <h3 className="mt-3 text-subheading text-foreground">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="anchor-offset mx-auto max-w-7xl space-y-8 px-4 sm:px-6">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-title text-foreground">Plans</h2>
          <p className="text-body text-neutral-400">
            Draft plans. Pricing and plan contents may change before launch.
          </p>
        </div>

        <div className="grid items-stretch gap-4 md:grid-cols-3">
          {/* Starter */}
          <div className="flex flex-col justify-between rounded-lg border border-neutral-800 bg-neutral-900 p-6">
            <div className="space-y-5">
              <div>
                <h3 className="text-subheading text-foreground">Starter</h3>
                <p className="mt-1 text-sm text-neutral-400">For building a consistent journaling habit.</p>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-title text-foreground">$0</span>
                <span className="text-caption text-neutral-400">per month</span>
              </div>
              <ul className="space-y-2.5">
                {[
                  "9-step trade journal",
                  "Basic analytics and performance metrics",
                  "Manual trade entry",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-neutral-300">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href="/auth?mode=signin"
              onClick={handleAuthNavigation("/auth?mode=signin")}
              className={`${SECONDARY_BTN} mt-6 w-full`}
            >
              Sign In
            </Link>
          </div>

          {/* Pro */}
          <div className="flex flex-col justify-between rounded-lg border border-brand-500/40 bg-neutral-900 p-6">
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-subheading text-foreground">Pro</h3>
                  <span className="rounded border border-brand-500/40 px-1.5 py-0.5 text-caption text-brand-300">
                    Suggested
                  </span>
                </div>
                <p className="mt-1 text-sm text-neutral-400">For active traders who want research tools and AI review.</p>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-title text-foreground">$49</span>
                <span className="text-caption text-neutral-400">per month</span>
              </div>
              <ul className="space-y-2.5">
                {[
                  "Everything in Starter",
                  "Market Monitor and sector views",
                  "SMC and FVG scanners",
                  "AI Copilot and trade review",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-neutral-300">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
            <LightBeamButton
              href="/auth?mode=signin"
              onClick={handleAuthNavigation("/auth?mode=signin")}
              className="mt-6 w-full"
            >
              Sign In
            </LightBeamButton>
          </div>

          {/* Elite */}
          <div className="flex flex-col justify-between rounded-lg border border-neutral-800 bg-neutral-900 p-6">
            <div className="space-y-5">
              <div>
                <h3 className="text-subheading text-foreground">Elite</h3>
                <p className="mt-1 text-sm text-neutral-400">For systematic researchers managing multiple accounts.</p>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-title text-foreground">$99</span>
                <span className="text-caption text-neutral-400">per month</span>
              </div>
              <ul className="space-y-2.5">
                {[
                  "Everything in Pro",
                  "Portfolio optimizer",
                  "Custom scanning conditions",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-neutral-300">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href="/auth?mode=signin"
              onClick={handleAuthNavigation("/auth?mode=signin")}
              className={`${SECONDARY_BTN} mt-6 w-full`}
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ── ROADMAP ── */}
      <section id="roadmap" className="anchor-offset mx-auto max-w-4xl space-y-8 px-4 sm:px-6">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-title text-foreground">Roadmap</h2>
          <p className="text-body text-neutral-400">
            What is planned next. None of these features are available yet.
          </p>
        </div>

        <ul className="space-y-4">
          {UPCOMING.map((f) => {
            const tagStyle = TAG_COLORS[f.tag] ?? { bg: "rgb(var(--brand-500) / 0.1)", text: "rgb(var(--brand-300))" };
            return (
              <li key={f.title} className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                      style={{ background: withAlpha(f.color, 0.1), color: f.color }}
                    >
                      <f.icon className="h-[18px] w-[18px]" />
                    </span>
                    <h3 className="text-subheading text-foreground">{f.title}</h3>
                  </div>
                  <span
                    className="shrink-0 rounded px-2 py-0.5 text-caption font-medium"
                    style={{ background: tagStyle.bg, color: tagStyle.text }}
                  >
                    {f.tag}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">{f.desc}</p>
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-1.5 text-sm text-neutral-300">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: f.color }} />
                      {b}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex items-center gap-1.5 border-t border-neutral-800 pt-3 text-caption text-neutral-400">
                  <Lock className="h-3 w-3" /> Not yet available
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-8 text-center sm:p-12">
          <h2 className="mx-auto max-w-xl text-title text-foreground">
            Start with the research, then decide.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-body text-neutral-400">
            Sign in to open the screener, the market monitor and your portfolio in one place.
          </p>
          <div className="mt-6 flex justify-center">
            {isAuthenticated ? (
              <LightBeamButton href="/home">
                Launch Platform <ArrowRight className="h-4 w-4" />
              </LightBeamButton>
            ) : (
              <LightBeamButton href="/auth?mode=signin" onClick={handleAuthNavigation("/auth?mode=signin")}>
                Sign In <ArrowRight className="h-4 w-4" />
              </LightBeamButton>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-neutral-800 pb-2 pt-10 text-sm text-neutral-400">
        <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <span className="font-semibold text-foreground">Nivro</span>
            <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Link href="#product" className="transition-colors hover:text-foreground">Product</Link>
              <Link href="#platform" className="transition-colors hover:text-foreground">Platform</Link>
              <Link href="#pricing" className="transition-colors hover:text-foreground">Pricing</Link>
              <Link href="#roadmap" className="transition-colors hover:text-foreground">Roadmap</Link>
            </nav>
          </div>
          <p className="text-caption leading-normal text-neutral-400">
            Risk warning: trading financial instruments involves substantial risk of loss and is not
            suitable for every investor. Nivro provides research tools and AI-assisted analysis. Nothing
            here is investment advice, and a scanner result is a candidate to investigate, not a signal.
          </p>
          <p className="text-caption text-neutral-500">&copy; {new Date().getFullYear()} Nivro. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}
