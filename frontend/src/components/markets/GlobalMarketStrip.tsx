'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { GLOBAL_INDICES, type MarketIndex } from '@/lib/market-data';

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const h = 22, w = 52;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  const color = positive ? '#22c55e' : '#ef4444';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-shrink-0 opacity-80">
      <defs><linearGradient id={`sg-${positive?'g':'r'}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.4"/><stop offset="100%" stopColor={color} stopOpacity="0"/>
      </linearGradient></defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#sg-${positive?'g':'r'})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0px 2px 4px ${color}40)` }}/>
    </svg>
  );
}

function MomentumDot({ m }: { m: MarketIndex['momentum'] }) {
  const cls = m === 'strong-bull' || m === 'bullish' ? 'bg-emerald-500' : m === 'neutral' ? 'bg-slate-400' : 'bg-red-500';
  return <span className={`w-1.5 h-1.5 rounded-full ${cls} flex-shrink-0`} title={m} />;
}

function IndexCard({ idx }: { idx: MarketIndex }) {
  const pos = idx.changePct >= 0;
  return (
    <div className={`group relative flex-shrink-0 w-[164px] rounded-xl p-3 border transition-all duration-200
      glass-card ${pos ? 'dark:bg-[rgba(34,197,94,0.03)] dark:hover:border-emerald-500/30 dark:hover:shadow-[0_0_20px_rgba(34,197,94,0.1)]' : 'dark:bg-[rgba(239,68,68,0.03)] dark:hover:border-red-500/30 dark:hover:shadow-[0_0_20px_rgba(239,68,68,0.1)]'}`}>
      <div className={`absolute top-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-${pos ? 'emerald' : 'red'}-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}/>
      <div className="flex items-center gap-1.5 mb-1">
        <MomentumDot m={idx.momentum}/>
        <span className="text-[10px] font-bold text-slate-500 tracking-wide">{idx.symbol}</span>
      </div>
      <div className="flex items-end justify-between gap-1">
        <div>
          <div className="text-[15px] font-bold tabular-nums text-slate-900 dark:text-white leading-tight">
            {idx.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`flex items-center gap-0.5 text-[11px] font-bold tabular-nums ${pos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {pos ? <TrendingUp className="w-2.5 h-2.5"/> : <TrendingDown className="w-2.5 h-2.5"/>}
            {pos?'+':''}{idx.changePct.toFixed(2)}%
          </div>
        </div>
        <Sparkline data={idx.sparkline} positive={pos}/>
      </div>
    </div>
  );
}

export function GlobalMarketStrip() {
  return (
    <section className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-0.5 h-3.5 rounded-full bg-gradient-to-b from-blue-500 to-violet-500"/>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Global Markets</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-slate-200/80 dark:from-white/[0.04] to-transparent"/>
        <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>Live
        </span>
      </div>
      <div className="space-y-2">
        {GLOBAL_INDICES.map(({ region, indices }) => (
          <div key={region}>
            <div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-600 mb-1 pl-0.5">{region}</div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
              {indices.map(idx => <IndexCard key={idx.symbol} idx={idx}/>)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
