'use client';

import { Trophy, ChevronRight } from 'lucide-react';
import type { SetupPerformance } from '@/lib/api/journalApi';

interface Props {
  setups: SetupPerformance[];
  loading?: boolean;
}

export function BestSetupsCard({ setups, loading }: Props) {
  if (loading) return <div className="glass-card p-4 h-52 skeleton rounded-xl" />;

  return (
    <div className="glass-card p-4 flex flex-col">
      <h3 className="text-xs font-bold mb-3">Best Performing Setups</h3>

      {setups.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <Trophy className="w-6 h-6 text-neutral-500" />
          <p className="text-[11px] text-neutral-500">No setup data yet</p>
        </div>
      ) : (
        <div className="space-y-2.5 flex-1">
          {setups.map((s, i) => {
            const isPositive = s.totalPnl >= 0;
            return (
              <div key={s.name} className="flex items-center gap-2.5">
                {/* Rank */}
                <span
                  className="w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                  style={{
                    background: i === 0 ? 'rgb(var(--positive-500) / 0.15)' : 'rgb(var(--foreground) / 0.04)',
                    color: i === 0 ? 'rgb(var(--positive-400))' : 'rgb(var(--neutral-500))',
                  }}
                >
                  {i + 1}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold truncate">{s.name}</div>
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

      {setups.length > 0 && (
        <button className="flex items-center gap-0.5 text-[11px] text-brand-400 font-semibold mt-2.5 hover:text-brand-300 transition-colors">
          View all setups <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
