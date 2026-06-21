"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Filter, Layers, Waves, ScanLine, TrendingUp, BookMarked,
  RefreshCw, CheckCircle2, Clock, Download, Keyboard, Save,
  FolderOpen, X, AlertTriangle,
} from "lucide-react";
import { useScreenerExport, useSavedFilters, FilterPreset } from "@/hooks/useScreenerUtils";

const FASTAPI_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_FASTAPI_URL || "http://localhost:8000")
    : "http://localhost:8000";

const SCANNER_TABS: {
  href: string;
  label: string;
  icon: any;
  activeColor: string;
  iconColor: string;
  badge?: string;
}[] = [
  { href: "/screener",            label: "Technical",  icon: Filter,     activeColor: "bg-yellow-500/10 border-yellow-500/30 text-yellow-300",  iconColor: "text-yellow-400" },
  { href: "/screener/smc",        label: "SMC",        icon: Layers,     activeColor: "bg-purple-500/10 border-purple-500/30 text-purple-300",  iconColor: "text-purple-400" },
  { href: "/screener/volume",     label: "Volume",     icon: Waves,      activeColor: "bg-orange-500/10 border-orange-500/30 text-orange-300",  iconColor: "text-orange-400" },
  { href: "/screener/fvg",        label: "FVG",        icon: ScanLine,   activeColor: "bg-blue-500/10 border-blue-500/30 text-blue-300",       iconColor: "text-blue-400"   },
  { href: "/screener/watchlists", label: "Watchlists", icon: BookMarked, activeColor: "bg-indigo-500/10 border-indigo-500/30 text-indigo-300",  iconColor: "text-indigo-400" },
];

// ── Keyboard Shortcut Help ────────────────────────────────────────────────────
const SHORTCUTS = [
  { key: "1 – 5",    desc: "Switch scanner tab" },
  { key: "R",        desc: "Refresh / run scan" },
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

// ── Context for child pages to register scan data ─────────────────────────────
const ScannerContext = React.createContext<{
  registerData: (rows: any[]) => void;
  registerRefresh: (fn: () => void) => void;
  registerSearch: (ref: React.RefObject<HTMLInputElement>) => void;
}>({
  registerData: () => {},
  registerRefresh: () => {},
  registerSearch: () => {},
});

export default function ScreenerLayout({ children }: { children: React.ReactNode }) {
  const pathname      = usePathname();
  const [scanMeta, setScanMeta]       = useState<any>(null);
  const [triggering, setTriggering]   = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [scanData, setScanData]       = useState<any[]>([]);
  const refreshFnRef  = useRef<(() => void) | null>(null);
  const searchRef     = useRef<HTMLInputElement | null>(null);

  const { exportCSV } = useScreenerExport();

  // Derive scanner name from pathname
  const scannerName = SCANNER_TABS.find((t) =>
    t.href === "/screener" ? pathname === "/screener" : pathname.startsWith(t.href)
  )?.label ?? "Scanner";

  // ── Scan status ───────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${FASTAPI_URL}/api/v2/scanner/scan-status`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setScanMeta(d.data); })
      .catch(() => {});
  }, [pathname]);

  const handleTriggerScan = async () => {
    setTriggering(true);
    try {
      await fetch(`${FASTAPI_URL}/api/v2/scanner/trigger-scan`, { method: "POST" });
      setScanMeta((m: any) => ({ ...m, status: "running" }));
    } catch {}
    finally { setTriggering(false); }
  };

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

      // Tab switching (1–6)
      if (e.key >= "1" && e.key <= "6" && !e.ctrlKey && !e.metaKey) {
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

  const fmtAge = (iso?: string) => {
    if (!iso) return "Never";
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)    return `${Math.round(diff)}s ago`;
    if (diff < 3600)  return `${Math.round(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
    return `${Math.round(diff / 86400)}d ago`;
  };

  const isStale = (iso?: string) => {
    if (!iso) return true;
    const diffHours = (Date.now() - new Date(iso).getTime()) / 3600000;
    return diffHours >= 24;
  };

  const isActive = (href: string) =>
    href === "/screener" ? pathname === "/screener" : pathname.startsWith(href);

  // Context value
  const contextValue = {
    registerData:    (rows: any[]) => setScanData(rows),
    registerRefresh: (fn: () => void) => { refreshFnRef.current = fn; },
    registerSearch:  (ref: React.RefObject<HTMLInputElement>) => { searchRef.current = ref.current; },
  };

  return (
    <ScannerContext.Provider value={contextValue}>
      <div className="min-h-screen bg-gray-950 text-white">
        {showShortcuts && <ShortcutHelp onClose={() => setShowShortcuts(false)} />}

        {/* ── Scan status bar ──────────────────────────────────────── */}
        <div className="border-b border-gray-800/60 bg-gray-900/40 px-6 py-2">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4 flex-wrap">
            {/* Left: status */}
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {scanMeta?.last_ran ? (
                <>
                  {isStale(scanMeta.last_ran) ? (
                    <>
                      <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 animate-pulse" />
                      <span className="text-amber-500 font-semibold">Data Stale (Run &gt;24h ago)</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />
                      <span>Last scan: <span className="text-gray-300 font-medium">{fmtAge(scanMeta.last_ran)}</span></span>
                    </>
                  )}
                  {scanMeta.symbols_processed != null && (
                    <><span className="text-gray-700">·</span><span>{scanMeta.symbols_processed.toLocaleString()} / {(scanMeta.total_symbols ?? 0).toLocaleString()} symbols</span></>
                  )}
                  {scanMeta.elapsed_seconds != null && (
                    <><span className="text-gray-700">·</span><span>{scanMeta.elapsed_seconds}s</span></>
                  )}
                </>
              ) : (
                <><Clock size={12} className="text-gray-600" /><span className="text-gray-600">No scan data yet</span></>
              )}
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2">
              {scanData.length > 0 && (
                <button
                  onClick={() => exportCSV(scanData, scannerName.toLowerCase().replace(" ", "_"))}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-all"
                  title="Export CSV (E)"
                >
                  <Download size={11} /> Export CSV
                </button>
              )}
              <button
                onClick={handleTriggerScan}
                disabled={triggering}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                title="Refresh data (R)"
              >
                <RefreshCw size={11} className={triggering ? "animate-spin" : ""} />
                {triggering ? "Triggering…" : "Refresh Data"}
              </button>
              <button
                onClick={() => setShowShortcuts(true)}
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-300 border border-gray-800 hover:border-gray-600 px-2.5 py-1.5 rounded-lg transition-all"
                title="Keyboard shortcuts (?)"
              >
                <Keyboard size={11} />
              </button>
            </div>
          </div>
        </div>

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
