"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Download, Keyboard, X,
  LayoutDashboard, Rocket, Target, CandlestickChart, BarChart3, Landmark, Bookmark,
} from "lucide-react";
import { useScreenerExport } from "@/hooks/useScreenerUtils";

/**
 * Nav is monochrome at rest, blue on hover (generic "interactive" cue), and
 * reveals its own category color only when active (identity cue) — so at most
 * one accent is ever visible at a time. Tailwind needs literal class strings
 * per key (no `text-${x}-400` interpolation), same pattern as
 * components/screener/filters/types.ts's ACCENT map.
 */
type Category = "neutral" | "blue" | "cyan" | "orange" | "emerald" | "indigo";

const CATEGORY_STYLES: Record<Category, { text: string; bg: string; border: string; icon: string }> = {
  neutral: { text: "text-gray-200",   bg: "bg-gray-500/[0.08]",    border: "border-gray-400",   icon: "text-gray-300" },
  blue:    { text: "text-blue-200",   bg: "bg-blue-500/[0.08]",    border: "border-blue-400",   icon: "text-blue-300" },
  cyan:    { text: "text-cyan-200",   bg: "bg-cyan-500/[0.08]",    border: "border-cyan-400",   icon: "text-cyan-300" },
  orange:  { text: "text-orange-200", bg: "bg-orange-500/[0.08]",  border: "border-orange-400", icon: "text-orange-300" },
  emerald: { text: "text-emerald-200",bg: "bg-emerald-500/[0.08]", border: "border-emerald-400",icon: "text-emerald-300" },
  indigo:  { text: "text-indigo-200", bg: "bg-indigo-500/[0.08]",  border: "border-indigo-400", icon: "text-indigo-300" },
};

type ScannerTab = {
  href: string;
  label: string;
  icon: any;
  category: Category;
  badge?: string;
};

const SCANNER_TABS: ScannerTab[] = [
  { href: "/screener",             label: "Overview",           icon: LayoutDashboard,  category: "neutral" },
  { href: "/screener/launchpad",   label: "LaunchPad",          icon: Rocket,           category: "blue" },
  { href: "/screener/alpha-zone",  label: "Alpha Zone",         icon: Target,           category: "cyan" },
  { href: "/screener/ipo-vintage", label: "IPO Vintage",        icon: Landmark,         category: "indigo" },
  { href: "/screener/technical",   label: "Technical Scanner",  icon: CandlestickChart, category: "orange" },
  { href: "/screener/volume",      label: "Volume Scanner",     icon: BarChart3,        category: "emerald" },
  { href: "/screener/watchlists",  label: "Watchlists",         icon: Bookmark,         category: "neutral" },
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
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2"><Keyboard size={16} /> Keyboard Shortcuts</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16} /></button>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map(({ key, desc }) => (
            <div key={key} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
              <span className="text-gray-400 text-sm">{desc}</span>
              <kbd className="bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-xs text-gray-300 font-mono">{key}</kbd>
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
      <div className="min-h-screen bg-gray-950 text-white">
        {showShortcuts && <ShortcutHelp onClose={() => setShowShortcuts(false)} />}

        {/* ── Export bar ───────────────────────────────────────────── */}
        {scanData.length > 0 && (
          <div className="border-b border-gray-800/60 bg-gray-900/40 px-6 py-2">
            <div className="max-w-[1600px] mx-auto flex items-center justify-end">
              <button
                onClick={() => exportCSV(scanData, scannerName.toLowerCase().replace(" ", "_"))}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-all"
                title="Export CSV (E)"
              >
                <Download size={11} /> Export CSV
              </button>
            </div>
          </div>
        )}

        {/* ── Scanner tab strip ────────────────────────────────────── */}
        <div className="border-b border-gray-800/60 bg-gray-900/20 px-6">
          <div className="max-w-[1600px] mx-auto flex items-center gap-1 overflow-x-auto py-1.5 scrollbar-none">
            {SCANNER_TABS.map(({ href, label, icon: Icon, category, badge }) => {
              const active = isActive(href);
              const style = CATEGORY_STYLES[category];
              return (
                <Link
                  key={href}
                  href={href}
                  className={`group relative flex items-center gap-2 px-3.5 py-2.5 rounded-t-md border-b-2 text-[13px] font-medium whitespace-nowrap flex-shrink-0 transition-colors duration-200 ${
                    active
                      ? `${style.border} ${style.text} ${style.bg}`
                      : "border-transparent text-gray-500 hover:text-gray-200 hover:bg-blue-500/[0.06] hover:border-blue-500/30"
                  }`}
                >
                  <Icon
                    size={15}
                    strokeWidth={1.75}
                    className={active ? style.icon : "text-gray-500 group-hover:text-blue-300 transition-colors duration-200"}
                  />
                  <span>{label}</span>
                  {badge && !active && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── Page content ─────────────────────────────────────────── */}
        <div className="max-w-[1600px] mx-auto px-6 py-8">
          {children}
        </div>
      </div>
    </ScannerContext.Provider>
  );
}
