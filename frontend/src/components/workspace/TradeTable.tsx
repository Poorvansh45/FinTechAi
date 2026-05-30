'use client';

import { X } from 'lucide-react';
import { derive, getTradeSession, type Trade } from '@/lib/journal/types';

const SETUP_COLORS: Record<string, string> = {
  breakout: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  reversal: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  momentum: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  sweep: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
  fvg: 'bg-pink-500/15 text-pink-300 border-pink-500/25',
  default: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
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
          <thead className="sticky top-0 z-10" style={{ background: 'rgba(8,12,20,0.95)', backdropFilter: 'blur(8px)' }}>
            <tr className="border-b border-white/5 text-muted-foreground">
              {['Instrument', 'Side', 'Setup', 'Entry', 'Exit', 'RR', 'P&L', 'Session', 'Conf', ''].map((h) => (
                <th key={h} className="text-left py-2 px-2 font-semibold whitespace-nowrap text-[9px] uppercase tracking-wide">
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
                    <button type="button" onClick={emptyAction} className="text-indigo-400 hover:underline">
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
                    className={`border-b border-white/[0.03] cursor-pointer transition-all terminal-row-hover ${
                      isSel ? 'glow-active' : ''
                    }`}
                    style={isSel ? { background: 'rgba(99,102,241,0.08)', borderLeft: '2px solid #6366f1' } : {}}
                  >
                    <td className="py-2 px-2 font-semibold whitespace-nowrap">{t.instrument}</td>
                    <td className="py-2 px-2">
                      <span className={t.side === 'Buy' ? 'profit-badge' : 'loss-badge'}>{t.side}</span>
                    </td>
                    <td className="py-2 px-2 max-w-[88px]">
                      <span className={`inline-block px-1.5 py-0.5 rounded border text-[9px] font-medium truncate max-w-full ${setupTagStyle(tag)}`}>
                        {tag}
                      </span>
                    </td>
                    <td className="py-2 px-2 tabular-nums">{t.entryPrice}</td>
                    <td className="py-2 px-2 tabular-nums">
                      {t.exitPrice ?? <span className="text-orange-400 text-[9px] font-bold">OPEN</span>}
                    </td>
                    <td className="py-2 px-2 tabular-nums text-slate-400">{m.rr != null ? m.rr.toFixed(1) : '—'}</td>
                    <td className={`py-2 px-2 tabular-nums font-bold ${pnl == null ? 'text-muted-foreground' : pnl >= 0 ? 'profit' : 'loss'}`}>
                      {pnl == null ? '—' : `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`}
                    </td>
                    <td className="py-2 px-2 text-[9px] text-muted-foreground">{session ?? '—'}</td>
                    <td className="py-2 px-2">
                      {conf != null ? (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            conf >= 7 ? 'bg-emerald-500/15 text-emerald-400' : conf >= 5 ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'
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
                        className="text-muted-foreground hover:text-red-400 p-0.5 rounded"
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
