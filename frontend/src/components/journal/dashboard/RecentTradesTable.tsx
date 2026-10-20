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
    Win:       { bg: 'rgb(var(--positive-500) / 0.12)',  color: 'rgb(var(--positive-400))' },
    Loss:      { bg: 'rgb(var(--negative-500) / 0.12)',  color: 'rgb(var(--negative-400))' },
    Open:      { bg: 'rgb(var(--brand-500) / 0.12)', color: 'rgb(var(--brand-400))' },
    Breakeven: { bg: 'rgb(var(--neutral-500) / 0.12)',color: 'rgb(var(--neutral-400))' },
  };
  const s = map[outcome] ?? map.Open;
  return (
    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ background: s.bg, color: s.color }}>
      {outcome === 'Breakeven' ? 'BE' : outcome}
    </span>
  );
}

function SideBadge({ side }: { side: 'Buy' | 'Sell' }) {
  return (
    <span
      className="text-[11px] font-bold px-1.5 py-0.5 rounded"
      style={side === 'Buy'
        ? { background: 'rgb(var(--positive-500) / 0.12)', color: 'rgb(var(--positive-400))' }
        : { background: 'rgb(var(--negative-500) / 0.12)', color: 'rgb(var(--negative-400))' }}
    >
      {side}
    </span>
  );
}

const TH = 'text-[11px] font-bold text-neutral-500 px-3 py-2 text-left';
const TD = 'text-[11px] px-3 py-2.5';

export function RecentTradesTable({ trades, loading }: Props) {
  const router = useRouter();

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgb(var(--foreground) / 0.05)' }}>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-brand-400" />
          <span className="text-xs font-bold">Recent Trades</span>
        </div>
        <button
          onClick={() => router.push('/workspace/history')}
          className="text-[11px] font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-0.5 transition-colors"
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
          <BookOpen className="w-8 h-8 text-neutral-500" />
          <p className="text-[11px] text-neutral-500">No trades recorded yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <table className="w-full min-w-[700px]">
            <thead>
              <tr style={{ borderBottom: '1px solid rgb(var(--foreground) / 0.04)' }}>
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
                    style={{ borderBottom: '1px solid rgb(var(--foreground) / 0.03)' }}>
                    <td className={`${TD} text-muted-foreground whitespace-nowrap`}>{fmtDate(t.entryAt)}</td>
                    <td className={`${TD} font-bold`}>{t.instrument}</td>
                    <td className={TD}><SideBadge side={t.side} /></td>
                    <td className={`${TD} text-muted-foreground truncate max-w-[100px]`}>{t.setupName}</td>
                    <td className={`${TD} text-right tabular-nums`}>{t.entryPrice.toFixed(2)}</td>
                    <td className={`${TD} text-right tabular-nums text-muted-foreground`}>{t.exitPrice?.toFixed(2) ?? '—'}</td>
                    <td className={`${TD} text-right font-bold tabular-nums ${isPos ? 'text-positive-400' : 'text-negative-400'}`}>
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
