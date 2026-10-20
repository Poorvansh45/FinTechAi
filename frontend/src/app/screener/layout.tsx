"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Download, Keyboard, X,
  LayoutDashboard, Rocket, Target, CandlestickChart, BarChart3, Landmark, Bookmark,
} from "lucide-react";
import { useScreenerExport } from "@/hooks/useScreenerUtils";

type ScannerTab = {
  href: string;
  label: string;
  icon: any;
  badge?: string;
};

const SCANNER_TABS: ScannerTab[] = [
  { href: "/screener",             label: "Overview",           icon: LayoutDashboard },
  { href: "/screener/launchpad",   label: "LaunchPad",          icon: Rocket },
  { href: "/screener/alpha-zone",  label: "Alpha Zone",         icon: Target },
  { href: "/screener/ipo-vintage", label: "IPO Vintage",        icon: Landmark },
  { href: "/screener/technical",   label: "Technical",          icon: CandlestickChart },
  { href: "/screener/volume",      label: "Volume",             icon: BarChart3 },
  { href: "/screener/watchlists",  label: "Watchlists",         icon: Bookmark },
];

// ── Keyboard Shortcut Help ────────────────────────────────────────────────────
const SHORTCUTS = [
  { key: "1 – 7",    desc: "Switch scanner tab" },
  { key: "R",        desc: "Refresh current page's data" },
  { key: "E",        desc: "Export CSV" },
  { key: "S",        desc: "Save current preset" },
  { key: "/",        desc: "Focus search box" },
  { key: "Esc",      desc: "Close modal / clear search" },
];

function ShortcutHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" className="bg-neutral-900 border border-neutral-700 rounded-xl p-6 max-w-sm w-full shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2"><Keyboard size={16} /> Keyboard Shortcuts</h3>
          <button onClick={onClose} aria-label="Close keyboard shortcuts" className="text-neutral-500 hover:text-foreground"><X size={16} aria-hidden /></button>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map(({ key, desc }) => (
            <div key={key} className="flex items-center justify-between py-1.5 border-b border-neutral-800 last:border-0">
              <span className="text-neutral-400 text-sm">{desc}</span>
              <kbd className="bg-neutral-800 border border-neutral-600 rounded px-2 py-0.5 text-xs text-neutral-300 font-mono">{key}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { ScannerContext } from "./context";

export default function ScreenerLayout({ children }: { children: React.ReactNode }) {
  const pathname      = usePathname();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [scanData, setScanData]       = useState<any[]>([]);
  const refreshFnRef  = useRef<(() => void) | null>(null);
  const searchRef     = useRef<HTMLInputElement | null>(null);

  const { exportCSV } = useScreenerExport();

  // Derive scanner name from pathname
  const scannerName = SCANNER_TABS.find((t) =>
    t.href === "/screener" ? pathname === "/screener" : pathname.startsWith(t.href)
  )?.label ?? "Scanner";

  // ── Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(tag);

      if (e.key === "?" || (e.key === "/" && !typing)) {
        e.preventDefault();
        if (e.key === "?") setShowShortcuts((v) => !v);
        if (e.key === "/" && searchRef.current) searchRef.current.focus();
        return;
      }
      if (e.key === "Escape") { setShowShortcuts(false); if (searchRef.current) searchRef.current.blur(); return; }
      if (typing) return;

      // Tab switching (1–7)
      if (e.key >= "1" && e.key <= "7" && !e.ctrlKey && !e.metaKey) {
        const idx = parseInt(e.key) - 1;
        if (SCANNER_TABS[idx]) window.location.href = SCANNER_TABS[idx].href;
        return;
      }
      if (e.key.toLowerCase() === "r") { refreshFnRef.current?.(); return; }
      if (e.key.toLowerCase() === "e") { exportCSV(scanData, scannerName.toLowerCase().replace(" ", "_")); return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [scanData, scannerName]);

  const isActive = (href: string) =>
    href === "/screener" ? pathname === "/screener" : pathname.startsWith(href);

  // Context value. Scan status/triggering now live entirely on the Overview
  // page (see ScanStepper) — this context only carries per-page data/refresh
  // registration, used for CSV export and the "R" keyboard shortcut.
  const contextValue = {
    registerData:    (rows: any[]) => setScanData(rows),
    registerRefresh: (fn: () => void) => { refreshFnRef.current = fn; },
    registerSearch:  (ref: React.RefObject<HTMLInputElement>) => { searchRef.current = ref.current; },
    scanMeta: null,
  };

  return (
    <ScannerContext.Provider value={contextValue}>
      <div className="min-h-screen bg-neutral-950 text-foreground">
        {showShortcuts && <ShortcutHelp onClose={() => setShowShortcuts(false)} />}

        {/* ── Page header + scanner tabs (one connected block) ─────── */}
        <div className="border-b border-neutral-800/70 bg-neutral-900/30">
          <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
            <div className="flex items-center justify-between gap-4 pb-3 pt-4 sm:pt-5">
              <div className="min-w-0">
                <p className="text-heading text-foreground">Market Screener</p>
                <p className="mt-0.5 text-sm text-neutral-400">Discover and analyze trading setups.</p>
              </div>
              <button
                type="button"
                onClick={() => exportCSV(scanData, scannerName.toLowerCase().replace(" ", "_"))}
                disabled={scanData.length === 0}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-neutral-700 px-3 text-sm font-medium text-neutral-300 transition-colors hover:border-neutral-500 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                title="Export CSV (E)"
              >
                <Download size={14} aria-hidden /> <span className="hidden sm:inline">Export CSV</span>
                <span className="sr-only sm:hidden">Export CSV</span>
              </button>
            </div>

            <nav aria-label="Scanners" className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
              <div className="flex min-w-max items-center gap-1">
                {SCANNER_TABS.map(({ href, label, icon: Icon, badge }) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex h-10 items-center gap-1.5 whitespace-nowrap rounded-t-md px-3 text-label font-medium transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full ${
                        active
                          ? "bg-brand-500/10 text-foreground after:bg-brand-500"
                          : "text-neutral-400 after:bg-transparent hover:bg-foreground/5 hover:text-foreground"
                      }`}
                    >
                      <Icon
                        size={14}
                        strokeWidth={1.75}
                        aria-hidden
                        className={active ? "text-brand-400" : "text-neutral-500 transition-colors group-hover:text-neutral-300"}
                      />
                      <span>{label}</span>
                      {badge && !active && (
                        <span className="hidden rounded border border-positive-500/30 bg-positive-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-positive-300 sm:inline">
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>
        </div>

        {/* ── Page content ─────────────────────────────────────────── */}
        <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 sm:py-5">
          {children}
        </div>
      </div>
    </ScannerContext.Provider>
  );
}
