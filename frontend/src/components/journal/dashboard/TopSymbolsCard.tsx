'use client';

import { withAlpha } from '@/lib/utils';
import { Hash, ChevronRight } from 'lucide-react';
import type { SymbolPerformance } from '@/lib/api/journalApi';

interface Props {
  symbols: SymbolPerformance[];
  loading?: boolean;
}

const SYMBOL_COLORS = ['rgb(var(--brand-400))', 'rgb(var(--brand-400))', 'rgb(var(--warning-400))', 'rgb(var(--positive-400))'];

export function TopSymbolsCard({ symbols, loading }: Props) {
  if (loading) return <div className="glass-card p-4 h-52 skeleton rounded-xl" />;

  return (
    <div className="glass-card p-4 flex flex-col">
      <h3 className="text-xs font-bold mb-3">Top Symbols</h3>

      {symbols.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <Hash className="w-6 h-6 text-neutral-500" />
          <p className="text-[11px] text-neutral-500">No symbol data yet</p>
        </div>
      ) : (
        <div className="space-y-2.5 flex-1">
          {symbols.map((s, i) => {
            const isPositive = s.totalPnl >= 0;
            const color = SYMBOL_COLORS[i % SYMBOL_COLORS.length];
            return (
              <div key={s.symbol} className="flex items-center gap-2.5">
                {/* Symbol icon */}
                <span
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                  style={{ background: `${withAlpha(color, 0.09)}`, color }}
                >
                  {s.symbol.replace('NSE:', '').replace('BSE:', '').slice(0, 3)}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold truncate">{s.symbol}</div>
                  <div className="text-[11px] text-muted-foreground">{s.tradeCount} trades</div>
                </div>

                {/* P&L */}
                <span className={`text-[11px] font-bold tabular-nums flex-shrink-0 ${isPositive ? 'text-positive-400' : 'text-negative-400'}`}>
                  {isPositive ? '+' : ''}{s.totalPnl.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {symbols.length > 0 && (
        <button className="flex items-center gap-0.5 text-[11px] text-brand-400 font-semibold mt-2.5 hover:text-brand-300 transition-colors">
          View all symbols <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
