'use client';

import { Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { MARKET_BREADTH, FEAR_GREED } from '@/lib/market-data';

function Donut({ pct, color, size = 56 }: { pct: number; color: string; size?: number }) {
  const r = (size - 7) / 2, c = 2 * Math.PI * r, offset = c * (1 - pct / 100);
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={4.5} className="stroke-slate-200 dark:stroke-white/5"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={4.5} stroke={color} strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" style={{transition:'stroke-dashoffset 0.8s ease'}}/>
    </svg>
  );
}

function Bar({ value, max, color, label, display }: { value: number; max: number; color: string; label: string; display: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-0.5">
        <span className="text-slate-500 font-medium">{label}</span>
        <span className="font-bold tabular-nums" style={{color}}>{display}</span>
      </div>
      <div className="h-1 rounded-full bg-slate-200 dark:bg-white/5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{width:`${Math.min((value/max)*100,100)}%`, background: color}}/>
      </div>
    </div>
  );
}

function FearGreedGauge() {
  const { value, label } = FEAR_GREED;
  const color = value >= 70 ? '#22c55e' : value >= 40 ? '#eab308' : '#ef4444';
  const angle = (value / 100) * 180 - 90;
  return (
    <div className="flex flex-col items-center">
      <svg width={80} height={46} viewBox="0 0 80 46">
        <path d="M 6 42 A 34 34 0 0 1 74 42" fill="none" strokeWidth={5} className="stroke-slate-200 dark:stroke-white/5" strokeLinecap="round"/>
        <path d="M 6 42 A 34 34 0 0 1 74 42" fill="none" strokeWidth={5} stroke={color} strokeLinecap="round" strokeDasharray={`${(value/100)*107} 107`} style={{transition:'stroke-dasharray 0.8s ease'}}/>
        <line x1="40" y1="42" x2={40+24*Math.cos(angle*Math.PI/180)} y2={42+24*Math.sin(angle*Math.PI/180)} strokeWidth={1.5} stroke={color} strokeLinecap="round"/>
        <circle cx="40" cy="42" r="2.5" fill={color}/>
      </svg>
      <span className="text-[15px] font-bold tabular-nums -mt-1" style={{color}}>{value}</span>
      <span className="text-[9px] font-semibold text-slate-500">{label}</span>
    </div>
  );
}

export function MarketBreadth() {
  const b = MARKET_BREADTH;
  const total = b.advances + b.declines + b.unchanged;
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-0.5 h-3.5 rounded-full bg-gradient-to-b from-emerald-500 to-cyan-500"/>
        <Activity className="w-3 h-3 text-emerald-500"/>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Market Breadth</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-slate-200/80 dark:from-white/[0.04] to-transparent"/>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {/* Advance/Decline */}
        <div className="glass-card p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500">Advance / Decline</span>
            <span className="text-[9px] text-slate-400 tabular-nums">{total} stocks</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <Donut pct={(b.advances/total)*100} color="#22c55e"/>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{Math.round((b.advances/total)*100)}%</span>
              </div>
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold"><ArrowUpRight className="w-2.5 h-2.5"/>Adv</span>
                <span className="font-bold tabular-nums text-slate-900 dark:text-white">{b.advances}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold"><ArrowDownRight className="w-2.5 h-2.5"/>Dec</span>
                <span className="font-bold tabular-nums text-slate-900 dark:text-white">{b.declines}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-medium">Unch</span>
                <span className="font-bold tabular-nums text-slate-400">{b.unchanged}</span>
              </div>
            </div>
          </div>
        </div>
        {/* Sentiment & Momentum */}
        <div className="glass-card p-3">
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-2">Sentiment & Momentum</div>
          <div className="flex items-start gap-3">
            <FearGreedGauge/>
            <div className="flex-1 space-y-2 pt-0.5">
              <Bar value={b.momentumScore} max={100} color="#6366f1" label="Momentum" display={`${b.momentumScore}/100`}/>
              <Bar value={b.volumeAboveAvg} max={100} color="#3b82f6" label="Vol > Avg" display={`${b.volumeAboveAvg}%`}/>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">▲ {b.newHighs} Highs</span>
                <span className="text-[10px] text-red-600 dark:text-red-400 font-semibold">▼ {b.newLows} Lows</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
