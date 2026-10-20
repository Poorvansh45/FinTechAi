'use client';

import { X } from 'lucide-react';
import { derive, getTradeSession, type Trade } from '@/lib/journal/types';

const SETUP_COLORS: Record<string, string> = {
  breakout: 'bg-brand-500/15 text-brand-300 border-brand-500/25',
  reversal: 'bg-warning-500/15 text-warning-300 border-warning-500/25',
  momentum: 'bg-positive-500/15 text-positive-300 border-positive-500/25',
  sweep: 'bg-brand-500/15 text-brand-300 border-brand-500/25',
  fvg: 'bg-brand-500/15 text-brand-300 border-brand-500/25',
  default: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
};

function setupTagStyle(tag: string) {
  const lower = tag.toLowerCase();
  for (const key of Object.keys(SETUP_COLORS)) {
    if (key !== 'default' && lower.includes(key)) return SETUP_COLORS[key];
  }
  return SETUP_COLORS.default;
}

interface Props {
  trades: Trade[];
  selectedId: string | null;
  setupName: (id: string) => string;
  onSelect: (trade: Trade | null) => void;
  onDelete: (id: string) => void;
  emptyAction?: () => void;
  maxHeight?: string;
}

export function TradeTable({
  trades,
  selectedId,
  setupName,
  onSelect,
  onDelete,
  emptyAction,
  maxHeight = '58vh',
}: Props) {
  return (
    <div className="glass-card overflow-hidden terminal-row-hover">
      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 z-10" style={{ background: 'rgb(var(--background) / 0.95)', backdropFilter: 'blur(8px)' }}>
            <tr className="border-b border-foreground/5 text-muted-foreground">
              {['Instrument', 'Side', 'Setup', 'Entry', 'Exit', 'RR', 'P&L', 'Session', 'Conf', ''].map((h) => (
                <th key={h} className="text-left py-2 px-2 font-semibold whitespace-nowrap text-[11px]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-10 text-center text-muted-foreground text-sm">
                  No trades.{' '}
                  {emptyAction && (
                    <button type="button" onClick={emptyAction} className="text-brand-400 hover:underline">
                      Add one →
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              trades.map((t, i) => {
                const m = derive(t);
                const pnl = m.pnl;
                const isSel = selectedId === t.id;
                const tag = t.setupTag ?? setupName(t.setupId);
                const session = getTradeSession(t);
                const conf = t.confidence;

                return (
                  <tr
                    key={t.id || i}
                    onClick={() => onSelect(isSel ? null : t)}
                    className={`border-b border-foreground/[0.03] cursor-pointer transition-all terminal-row-hover ${
                      isSel ? 'glow-active' : ''
                    }`}
                    style={isSel ? { background: 'rgb(var(--brand-500) / 0.08)', borderLeft: '2px solid rgb(var(--brand-500))' } : {}}
                  >
                    <td className="py-2 px-2 font-semibold whitespace-nowrap">{t.instrument}</td>
                    <td className="py-2 px-2">
                      <span className={t.side === 'Buy' ? 'profit-badge' : 'loss-badge'}>{t.side}</span>
                    </td>
                    <td className="py-2 px-2 max-w-[88px]">
                      <span className={`inline-block px-1.5 py-0.5 rounded border text-[11px] font-medium truncate max-w-full ${setupTagStyle(tag)}`}>
                        {tag}
                      </span>
                    </td>
                    <td className="py-2 px-2 tabular-nums">{t.entryPrice}</td>
                    <td className="py-2 px-2 tabular-nums">
                      {t.exitPrice ?? <span className="text-warning-400 text-[11px] font-bold">OPEN</span>}
                    </td>
                    <td className="py-2 px-2 tabular-nums text-neutral-400">{m.rr != null ? m.rr.toFixed(1) : '—'}</td>
                    <td className={`py-2 px-2 tabular-nums font-bold ${pnl == null ? 'text-muted-foreground' : pnl >= 0 ? 'profit' : 'loss'}`}>
                      {pnl == null ? '—' : `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`}
                    </td>
                    <td className="py-2 px-2 text-[11px] text-muted-foreground">{session ?? '—'}</td>
                    <td className="py-2 px-2">
                      {conf != null ? (
                        <span
                          className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                            conf >= 7 ? 'bg-positive-500/15 text-positive-400' : conf >= 5 ? 'bg-warning-500/15 text-warning-400' : 'bg-negative-500/15 text-negative-400'
                          }`}
                        >
                          {conf}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(t.id);
                        }}
                        className="text-muted-foreground hover:text-negative-400 p-0.5 rounded"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
