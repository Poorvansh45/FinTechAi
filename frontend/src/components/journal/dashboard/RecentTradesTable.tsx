'use client';

import { useRouter } from 'next/navigation';
import { Clock, ChevronRight, BookOpen } from 'lucide-react';
import type { TradeSummary } from '@/lib/api/journalApi';

interface Props {
  trades: TradeSummary[];
  loading?: boolean;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(min: number | null): string {
  if (min === null) return '—';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  return min % 60 > 0 ? `${h}h ${min % 60}m` : `${h}h`;
}

function OutcomeBadge({ outcome }: { outcome: TradeSummary['outcome'] }) {
  const map: Record<string, { bg: string; color: string }> = {
    Win:       { bg: 'rgba(34,197,94,0.12)',  color: '#4ade80' },
    Loss:      { bg: 'rgba(239,68,68,0.12)',  color: '#f87171' },
    Open:      { bg: 'rgba(99,102,241,0.12)', color: '#818cf8' },
    Breakeven: { bg: 'rgba(100,116,139,0.12)',color: '#94a3b8' },
  };
  const s = map[outcome] ?? map.Open;
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: s.bg, color: s.color }}>
      {outcome === 'Breakeven' ? 'BE' : outcome}
    </span>
  );
}

function SideBadge({ side }: { side: 'Buy' | 'Sell' }) {
  return (
    <span
      className="text-[9px] font-bold px-1.5 py-0.5 rounded"
      style={side === 'Buy'
        ? { background: 'rgba(34,197,94,0.12)', color: '#4ade80' }
        : { background: 'rgba(239,68,68,0.12)', color: '#f87171' }}
    >
      {side}
    </span>
  );
}

const TH = 'text-[9px] font-bold uppercase tracking-wider text-slate-500 px-3 py-2 text-left';
const TD = 'text-[11px] px-3 py-2.5';

export function RecentTradesTable({ trades, loading }: Props) {
  const router = useRouter();

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs font-black">Recent Trades</span>
        </div>
        <button
          onClick={() => router.push('/workspace/history')}
          className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 transition-colors"
        >
          View all trades <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-10 skeleton rounded-lg" />)}
        </div>
      ) : trades.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10">
          <BookOpen className="w-8 h-8 text-slate-700" />
          <p className="text-[11px] text-slate-500">No trades recorded yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <table className="w-full min-w-[700px]">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <th className={TH}>Date</th>
                <th className={TH}>Instrument</th>
                <th className={TH}>Side</th>
                <th className={TH}>Setup</th>
                <th className={`${TH} text-right`}>Entry</th>
                <th className={`${TH} text-right`}>Exit</th>
                <th className={`${TH} text-right`}>P&amp;L</th>
                <th className={`${TH} text-right`}>R Multiple</th>
                <th className={`${TH} text-right`}>Duration</th>
                <th className={`${TH} text-center`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => {
                const isPos = (t.pnl ?? 0) >= 0;
                return (
                  <tr key={t.id}
                    className="terminal-row-hover cursor-pointer transition-colors"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td className={`${TD} text-muted-foreground whitespace-nowrap`}>{fmtDate(t.entryAt)}</td>
                    <td className={`${TD} font-bold`}>{t.instrument}</td>
                    <td className={TD}><SideBadge side={t.side} /></td>
                    <td className={`${TD} text-muted-foreground truncate max-w-[100px]`}>{t.setupName}</td>
                    <td className={`${TD} text-right tabular-nums`}>{t.entryPrice.toFixed(2)}</td>
                    <td className={`${TD} text-right tabular-nums text-muted-foreground`}>{t.exitPrice?.toFixed(2) ?? '—'}</td>
                    <td className={`${TD} text-right font-bold tabular-nums ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                      {t.pnl !== null ? `${isPos ? '+' : ''}${t.pnl.toFixed(2)}` : '—'}
                    </td>
                    <td className={`${TD} text-right tabular-nums text-muted-foreground`}>
                      {t.rMultiple !== null ? `${t.rMultiple.toFixed(2)}R` : '—'}
                    </td>
                    <td className={`${TD} text-right tabular-nums text-muted-foreground`}>{fmtDuration(t.durationMin)}</td>
                    <td className={`${TD} text-center`}><OutcomeBadge outcome={t.outcome} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
