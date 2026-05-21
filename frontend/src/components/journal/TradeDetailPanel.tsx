"use client";

import { useMemo } from "react";
import { X, TrendingUp, TrendingDown, Clock, Target, Zap, CheckCircle, XCircle } from "lucide-react";
import { derive } from "@/lib/journal/types";
import type { Trade } from "@/lib/journal/types";

interface Props {
  trade: Trade;
  setupName: (id: string) => string;
  onClose: () => void;
}

export function TradeDetailPanel({ trade, setupName, onClose }: Props) {
  const m = useMemo(() => derive(trade), [trade]);

  const pnl = m.pnl;
  const isProfit = pnl != null && pnl > 0;
  const isLoss = pnl != null && pnl < 0;
  const isOpen = trade.exitPrice == null;

  const rr = (() => {
    if (!trade.exitPrice) return null;
    const dir = trade.side === "Buy" ? 1 : -1;
    const diff = (trade.exitPrice - trade.entryPrice) * dir;
    return diff.toFixed(4);
  })();

  const duration = m.durationMin != null
    ? m.durationMin >= 60
      ? `${Math.floor(m.durationMin / 60)}h ${m.durationMin % 60}m`
      : `${m.durationMin}m`
    : null;

  return (
    <div className="glass-card h-full flex flex-col animate-slideLeft">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${trade.side === "Buy" ? "bg-green-500/15" : "bg-red-500/15"}`}>
            {trade.side === "Buy"
              ? <TrendingUp className="w-4.5 h-4.5 text-green-400" style={{ width: 18, height: 18 }} />
              : <TrendingDown className="w-4.5 h-4.5 text-red-400" style={{ width: 18, height: 18 }} />}
          </div>
          <div>
            <div className="font-bold text-sm">{trade.instrument}</div>
            <div className="text-[10px] text-muted-foreground">{trade.marketType} · {setupName(trade.setupId)}</div>
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-white/5">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* P&L Banner */}
        <div className="rounded-2xl p-4 text-center"
          style={{
            background: isOpen ? "rgba(255,255,255,0.03)" : isProfit ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)",
            border: `1px solid ${isOpen ? "rgba(255,255,255,0.06)" : isProfit ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
          }}>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            {isOpen ? "Open Trade" : "Realised P&L"}
          </div>
          <div className={`text-3xl font-bold tabular-nums ${isOpen ? "text-foreground" : isProfit ? "profit" : "loss"}`}>
            {isOpen ? "—" : `${pnl! >= 0 ? "+" : ""}${pnl!.toFixed(2)}`}
          </div>
          {!isOpen && (
            <div className={`text-xs mt-1 font-medium ${isProfit ? "text-green-400" : "text-red-400"}`}>
              {isProfit ? "✓ Winning Trade" : "✗ Losing Trade"}
            </div>
          )}
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Entry",    val: String(trade.entryPrice), icon: Target },
            { label: "Exit",     val: trade.exitPrice != null ? String(trade.exitPrice) : "Open", icon: Target },
            { label: "Side",     val: trade.side,  icon: trade.side === "Buy" ? TrendingUp : TrendingDown },
            { label: "Quantity", val: String(trade.quantity), icon: Zap },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{s.label}</div>
              <div className="text-sm font-bold tabular-nums">{s.val}</div>
            </div>
          ))}
        </div>

        {/* Duration */}
        {duration && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            Duration: <span className="font-medium text-foreground">{duration}</span>
          </div>
        )}

        {/* Points / Pips */}
        {m.points != null && (
          <div className="rounded-xl p-3"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Trade Metrics</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] text-muted-foreground">Points</div>
                <div className={`text-sm font-bold tabular-nums ${m.points >= 0 ? "profit" : "loss"}`}>
                  {m.points >= 0 ? "+" : ""}{m.points.toFixed(4)}
                </div>
              </div>
              {m.pips != null && (
                <div>
                  <div className="text-[10px] text-muted-foreground">Pips</div>
                  <div className={`text-sm font-bold tabular-nums ${m.pips >= 0 ? "profit" : "loss"}`}>
                    {m.pips >= 0 ? "+" : ""}{m.pips}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="divider-gradient" />

        {/* Trade metadata */}
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Entry Time</span>
            <span className="font-medium tabular-nums">
              {new Date(trade.entryAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          {trade.exitAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Exit Time</span>
              <span className="font-medium tabular-nums">
                {new Date(trade.exitAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          )}
          {trade.entryModel && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entry Model</span>
              <span className="font-medium">{trade.entryModel}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Criteria Met</span>
            <span>
              {trade.criteriaMet
                ? <span className="flex items-center gap-1 text-green-400"><CheckCircle className="w-3 h-3" />Yes</span>
                : <span className="flex items-center gap-1 text-red-400"><XCircle className="w-3 h-3" />No</span>}
            </span>
          </div>
        </div>

        {/* Notes */}
        {trade.comments && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Notes</div>
            <div className="ai-bubble text-xs leading-relaxed text-foreground">
              {trade.comments}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
