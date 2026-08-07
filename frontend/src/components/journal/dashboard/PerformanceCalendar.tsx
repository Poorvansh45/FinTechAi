'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from 'lucide-react';
import { getCalendarData, type CalendarDay } from '@/lib/api/journalApi';

interface Props {
  version: number; // triggers reload
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function PerformanceCalendar({ version }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [data, setData] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getCalendarData(year, month).then((d) => { setData(d); setLoading(false); });
  }, [year, month, version]);

  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); };
  const prev = () => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); };

  // Month roll-up. The day-by-day grid this replaced was mostly empty cells —
  // 20-odd blanks around a handful of traded days — so it spent a lot of the
  // column saying nothing. These are the same figures read directly.
  const profitDays = data.filter((d) => d.type === 'profit').length;
  const lossDays = data.filter((d) => d.type === 'loss').length;
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayEntry = data.find((d) => d.date === todayIso);

  const monthPnl = data.reduce((sum, d) => sum + d.pnl, 0);
  const tradedDays = data.filter((d) => d.tradeCount > 0);
  const totalTrades = data.reduce((sum, d) => sum + d.tradeCount, 0);
  const best = tradedDays.length ? tradedDays.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null;
  const worst = tradedDays.length ? tradedDays.reduce((a, b) => (b.pnl < a.pnl ? b : a)) : null;
  const dayNum = (iso: string) => Number(iso.slice(8, 10));

  const money = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v).toLocaleString('en-IN')}`;
  const pnlTone = (v: number) => (v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-slate-400');

  return (
    <div className="glass-card p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalIcon className="w-4 h-4 text-indigo-400" />
          <span className="text-[13px] font-bold">Performance Calendar</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prev} className="p-1 rounded-lg hover:bg-white/5 transition-colors"><ChevronLeft className="w-3.5 h-3.5 text-slate-400" /></button>
          <button onClick={goToday} className="px-2 py-0.5 text-[10px] font-bold text-indigo-400 hover:bg-indigo-400/10 rounded-md transition-colors">Today</button>
          <button onClick={next} className="p-1 rounded-lg hover:bg-white/5 transition-colors"><ChevronRight className="w-3.5 h-3.5 text-slate-400" /></button>
        </div>
      </div>

      {/* Roll-up strip — answers "how did the month go" without counting cells */}
      <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Profit days</div>
          <div className="mt-1 text-base font-black tabular-nums text-emerald-400">{loading ? '—' : profitDays}</div>
        </div>
        <div className="border-l border-white/[0.06] pl-3">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Loss days</div>
          <div className="mt-1 text-base font-black tabular-nums text-red-400">{loading ? '—' : lossDays}</div>
        </div>
        <div className="border-l border-white/[0.06] pl-3">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Today</div>
          <div className={`mt-1 text-base font-black tabular-nums ${
            !todayEntry ? 'text-slate-600' : todayEntry.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {loading ? '—' : todayEntry ? `${todayEntry.pnl >= 0 ? '+' : ''}${todayEntry.pnl.toFixed(0)}` : '—'}
          </div>
        </div>
      </div>

      {/* Month / Year */}
      <div className="text-[11px] font-bold text-slate-400 mb-2">
        {MONTHS[month]} {year}
      </div>

      {/* Month detail — the rest of what the grid was carrying, read out
          directly instead of having to hover 30 cells to find it. */}
      <div className="flex-1 space-y-px">
        {loading ? (
          <div className="space-y-2 pt-1">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-9 skeleton rounded-lg" />)}
          </div>
        ) : totalTrades === 0 ? (
          <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-1.5 text-center">
            <CalIcon className="h-6 w-6 text-slate-700" />
            <p className="text-[11px] font-medium text-slate-500">No trades this month</p>
            <p className="text-[10px] text-slate-600">Use the arrows to check another month</p>
          </div>
        ) : (
          <>
            {[
              { label: 'Month P&L', value: money(monthPnl), tone: pnlTone(monthPnl), sub: `${totalTrades} trade${totalTrades === 1 ? '' : 's'}` },
              { label: 'Traded days', value: String(tradedDays.length), tone: 'text-slate-200', sub: `${profitDays}W · ${lossDays}L` },
              best ? { label: 'Best day', value: money(best.pnl), tone: 'text-emerald-400', sub: `${MONTHS[month].slice(0, 3)} ${dayNum(best.date)}` } : null,
              worst ? { label: 'Worst day', value: money(worst.pnl), tone: pnlTone(worst.pnl), sub: `${MONTHS[month].slice(0, 3)} ${dayNum(worst.date)}` } : null,
            ].filter(Boolean).map((r: any) => (
              <div key={r.label} className="flex items-center justify-between border-b border-white/[0.04] py-2.5 last:border-0">
                <span className="text-[11px] text-slate-500">{r.label}</span>
                <span className="flex items-baseline gap-2">
                  <span className="text-[10px] text-slate-600">{r.sub}</span>
                  <span className={`font-mono text-[13px] font-bold tabular-nums ${r.tone}`}>{r.value}</span>
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
