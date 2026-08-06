"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Filter, Waves, BookMarked, Download, Keyboard, X,
  Rocket, Shield, BarChart3, Landmark
} from "lucide-react";
import { useScreenerExport } from "@/hooks/useScreenerUtils";

type ScannerTab = {
  href: string;
  label: string;
  icon: any;
  activeColor: string;
  iconColor: string;
  badge?: string;
};

const SCANNER_TABS: ScannerTab[] = [
  { href: "/screener",            label: "Overview",           icon: BarChart3,  activeColor: "bg-indigo-500/10 border-indigo-500/30 text-indigo-350",  iconColor: "text-indigo-400" },
  { href: "/screener/launchpad",  label: "🚀 LaunchPad",       icon: Rocket,     activeColor: "bg-purple-500/10 border-purple-500/30 text-purple-300",  iconColor: "text-purple-400" },
  { href: "/screener/alpha-zone", label: "🔷 Alpha Zone",       icon: Shield,     activeColor: "bg-blue-500/10 border-blue-500/30 text-blue-300",     iconColor: "text-blue-400"   },
  { href: "/screener/technical",  label: "📊 Technical Scanner", icon: Filter,     activeColor: "bg-yellow-500/10 border-yellow-500/30 text-yellow-300", iconColor: "text-yellow-400" },
  { href: "/screener/volume",     label: "📈 Volume Scanner",   icon: Waves,      activeColor: "bg-orange-500/10 border-orange-500/30 text-orange-300",  iconColor: "text-orange-400" },
  { href: "/screener/ipo-vintage", label: "🏦 IPO Vintage",     icon: Landmark,   activeColor: "bg-teal-500/10 border-teal-500/30 text-teal-300",     iconColor: "text-teal-400"   },
  { href: "/screener/watchlists", label: "⭐ Watchlists",       icon: BookMarked, activeColor: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300", iconColor: "text-emerald-400" },
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
          <div className="max-w-[1600px] mx-auto flex items-center gap-1 overflow-x-auto py-2 scrollbar-none">
            {SCANNER_TABS.map(({ href, label, icon: Icon, activeColor, iconColor, badge }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-all whitespace-nowrap flex-shrink-0 ${
                    active
                      ? activeColor
                      : "border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
                  }`}
                >
                  <Icon size={14} className={active ? "" : iconColor} />
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
