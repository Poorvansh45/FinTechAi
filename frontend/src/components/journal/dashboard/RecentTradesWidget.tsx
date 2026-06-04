'use client';

import { Clock, ChevronRight, BookOpen } from 'lucide-react';
import type { TradeSummary } from '@/lib/api/journalApi';

interface Props {
  trades: TradeSummary[];
  loading?: boolean;
  onViewAll: () => void;
}

function OutcomeBadge({ outcome }: { outcome: TradeSummary['outcome'] }) {
  const styles: Record<string, string> = {
    Win: 'profit-badge',
    Loss: 'loss-badge',
    Open: 'chip',
    Breakeven: 'chip',
  };
  return <span className={styles[outcome] ?? 'chip'}>{outcome}</span>;
}

function SideBadge({ side }: { side: 'Buy' | 'Sell' }) {
  return (
    <span
      className="text-[9px] font-bold px-1.5 py-0.5 rounded"
      style={
        side === 'Buy'
          ? { background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }
          : { background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }
      }
    >
      {side === 'Buy' ? '↑' : '↓'} {side}
    </span>
  );
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function RecentTradesWidget({ trades, loading, onViewAll }: Props) {
  const isEmpty = !loading && trades.length === 0;

  return (
    <div className="glass-card p-4 flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-bold">Recent Trades</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Last {trades.length || 5} entries</p>
        </div>
        {!isEmpty && (
          <button
            onClick={onViewAll}
            className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 transition-colors"
          >
            View all <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 skeleton rounded-xl" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-6">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
          >
            <BookOpen className="w-5 h-5 text-indigo-400" />
          </div>
          <p className="text-xs font-medium text-slate-500 text-center">No trades recorded.</p>
          <p className="text-[10px] text-muted-foreground text-center">
            Add your first trade to see it here.
          </p>
        </div>
      ) : (
        <div className="space-y-2 flex-1">
          {trades.map((t) => {
            const isPos = (t.pnl ?? 0) >= 0;
            return (
              <div
                key={t.id}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl terminal-row-hover cursor-pointer"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                {/* Instrument avatar */}
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black flex-shrink-0"
                  style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}
                >
                  {t.instrument.replace('NSE:', '').replace('BSE:', '').slice(0, 3)}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[11px] font-bold truncate">{t.instrument}</span>
                    <SideBadge side={t.side} />
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <span className="truncate">{t.setupName}</span>
                    <span>·</span>
                    <span>{relativeDate(t.entryAt)}</span>
                  </div>
                </div>

                {/* P&L + outcome */}
                <div className="text-right flex-shrink-0">
                  {t.pnl !== null ? (
                    <div
                      className={`text-[12px] font-bold tabular-nums ${isPos ? 'text-emerald-400' : 'text-red-400'}`}
                    >
                      {isPos ? '+' : ''}{t.pnl.toFixed(2)}
                    </div>
                  ) : (
                    <OutcomeBadge outcome={t.outcome} />
                  )}
                  {t.pnl !== null && (
                    <OutcomeBadge outcome={t.outcome} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
