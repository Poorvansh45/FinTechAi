"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, TrendingUp, TrendingDown, ExternalLink } from "lucide-react";
import { MiniChart } from "@/components/dashboard/mini-chart";
import { TvMini } from "@/components/dashboard/tv-mini";

type Row = Record<string, any>;
type Candle = { time: string; open: number; high: number; low: number; close: number; volume?: number };

export default function ScreenerPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useTv, setUseTv] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const fetchRows = async () => {
    setLoadingRows(true);
    try {
      const res = await fetch(`/api/screener?limit=200&demand=any`, { cache: "no-store" });
      const json = await res.json();
      setRows(Array.isArray(json.rows) ? json.rows : []);
    } catch { setRows([]); }
    finally { setLoadingRows(false); }
  };

  useEffect(() => { fetchRows(); }, []);

  const filtered = useMemo(() => {
    if (!query) return rows;
    const q = query.toLowerCase();
    return rows.filter(r => {
      const sym = String(r["FIXED SYMBOL"] || r["SYMBOL"] || r["symbol"] || "").toLowerCase();
      const name = String(r["STOCK NAME"] || r["name"] || "").toLowerCase();
      return sym.includes(q) || name.includes(q);
    });
  }, [rows, query]);

  const loadCandles = async (row: Row) => {
    setSelected(row); setCandles(null); setLoading(true); setError(null);
    try {
      if (!useTv) {
        const symbol = String(row["FIXED SYMBOL"] || row["SYMBOL"] || row["symbol"] || "").trim();
        if (!symbol) return;
        const res = await fetch(`/api/price?symbol=${encodeURIComponent(symbol)}&days=365&interval=1d`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Price API error (${res.status})`);
        const json = await res.json();
        setProvider(String(json.provider || ""));
        setCached(Boolean(json.cached));
        const arr = Array.isArray(json.candles) ? json.candles : [];
        setCandles(arr);
        if (!arr.length) setUseTv(true);
      }
    } catch (e: any) { setError(String(e?.message || e)); setUseTv(true); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!useTv && selected && (!candles || !candles.length) && !loading) loadCandles(selected);
  }, [useTv]);

  useEffect(() => {
    if (!selected && rows.length > 0) loadCandles(rows[0]);
  }, [rows]);

  const sym = selected ? String(selected["FIXED SYMBOL"] || selected["SYMBOL"] || selected["symbol"] || "") : "";
  const name = selected ? String(selected["STOCK NAME"] || selected["name"] || "") : "";
  const price = selected ? (selected["CMP"] || selected["cmp"] || selected["Price"] || selected["Close"]) : null;
  const chg = selected ? (selected["PERCENT CHANGE"] || selected["%change"] || selected["change_pct"] || selected["Change %"]) : null;
  const tvLink = sym ? `https://in.tradingview.com/chart/?symbol=${encodeURIComponent(sym.includes(":") ? sym : `NSE:${sym}`)}` : null;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Stock Screener</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{rows.length} stocks loaded from CSV</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>TradingView</span>
            <button
              onClick={() => setUseTv(v => !v)}
              className="relative inline-flex h-5 w-9 rounded-full transition-colors"
              style={{ background: useTv ? "linear-gradient(135deg,#4f46e5,#7c3aed)" : "rgba(255,255,255,0.1)" }}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${useTv ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          </div>
          <button onClick={fetchRows} disabled={loadingRows}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "#a5b4fc" }}>
            <RefreshCw className={`w-3.5 h-3.5 ${loadingRows ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main split */}
      <div className="flex gap-4" style={{ height: "calc(100vh - 200px)" }}>
        {/* Stock list */}
        <div className="w-64 flex-shrink-0 glass-card flex flex-col overflow-hidden">
          <div className="p-3 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full bg-white/5 border border-white/8 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-indigo-500/50 text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingRows && (
              <div className="p-4 space-y-2">
                {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}
              </div>
            )}
            {!loadingRows && filtered.length === 0 && (
              <div className="p-4 text-xs text-muted-foreground text-center">No stocks. Upload a CSV to /backend/data/stocks.csv</div>
            )}
            {filtered.map((r, i) => {
              const s = String(r["FIXED SYMBOL"] || r["SYMBOL"] || r["symbol"] || "");
              const n = String(r["STOCK NAME"] || r["name"] || "");
              const c = r["PERCENT CHANGE"] || r["%change"] || r["change_pct"];
              const up = c != null ? parseFloat(c) >= 0 : true;
              const isSel = selected === r;
              return (
                <button key={i} onClick={() => loadCandles(r)}
                  className="w-full text-left px-3 py-2.5 flex items-center justify-between transition-all border-l-2"
                  style={{
                    background: isSel ? "rgba(99,102,241,0.1)" : "transparent",
                    borderLeftColor: isSel ? "#6366f1" : "transparent",
                  }}>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{s}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{n}</div>
                  </div>
                  {c != null && (
                    <div className={`text-[10px] font-bold tabular-nums ml-2 flex-shrink-0 ${up ? "text-green-400" : "text-red-400"}`}>
                      {up ? "+" : ""}{parseFloat(c).toFixed(2)}%
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chart area */}
        <div className="flex-1 glass-card flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a stock to view chart
            </div>
          ) : (
            <>
              {/* Stock header */}
              <div className="flex items-center justify-between p-4 border-b border-white/5 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
                    style={{ background: "linear-gradient(135deg,rgba(79,70,229,0.2),rgba(124,58,237,0.15))", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}>
                    {sym.slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{sym}</div>
                    <div className="text-[10px] text-muted-foreground">{name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {price && (
                    <div className="text-right">
                      <div className="text-sm font-bold tabular-nums">₹{price}</div>
                      {chg != null && (
                        <div className={`text-xs font-semibold tabular-nums ${parseFloat(chg) >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {parseFloat(chg) >= 0 ? <TrendingUp className="w-3 h-3 inline mr-0.5" /> : <TrendingDown className="w-3 h-3 inline mr-0.5" />}
                          {parseFloat(chg) >= 0 ? "+" : ""}{parseFloat(chg).toFixed(2)}%
                        </div>
                      )}
                    </div>
                  )}
                  {tvLink && (
                    <a href={tvLink} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                      TradingView
                    </a>
                  )}
                </div>
              </div>

              {/* Chart */}
              <div className="flex-1 p-4 overflow-hidden">
                {loading && (
                  <div className="h-full flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                      <span className="text-xs text-muted-foreground">Loading chart…</span>
                    </div>
                  </div>
                )}
                {!loading && error && useTv && (
                  <div className="mb-2 text-xs text-red-400 px-2">{error}</div>
                )}
                {!loading && !useTv && candles && candles.length > 0 && (
                  <div className="h-full">
                    <MiniChart symbol={sym} candles={candles} />
                  </div>
                )}
                {!loading && !useTv && (!candles || !candles.length) && (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    No price data available
                  </div>
                )}
                {useTv && <TvMini symbol={sym} />}

                {!useTv && provider && (
                  <div className="mt-2 text-[10px] text-muted-foreground">
                    Provider: {provider}{cached ? " · cached" : ""}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
