'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from 'lucide-react';
import { getCalendarData, type CalendarDay } from '@/lib/api/journalApi';

interface Props {
  version: number; // triggers reload
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function cellColor(day: CalendarDay | undefined): string {
  if (!day) return 'transparent';
  if (day.type === 'profit')  return 'rgba(34,197,94,0.55)';
  if (day.type === 'loss')    return 'rgba(239,68,68,0.55)';
  return 'rgba(100,116,139,0.3)';
}
function cellBorder(day: CalendarDay | undefined): string {
  if (!day) return '1px solid rgba(255,255,255,0.04)';
  if (day.type === 'profit')  return '1px solid rgba(34,197,94,0.3)';
  if (day.type === 'loss')    return '1px solid rgba(239,68,68,0.3)';
  return '1px solid rgba(100,116,139,0.2)';
}

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

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let startOffset = firstDay.getDay() - 1; // Monday-based
  if (startOffset < 0) startOffset = 6;

  const dayMap = new Map(data.map(d => [d.date, d]));
  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = Array(startOffset).fill(null);

  for (let d = 1; d <= daysInMonth; d++) {
    currentWeek.push(d);
    if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  const dateStr = (day: number) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  return (
    <div className="glass-card p-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <CalIcon className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs font-black">Performance Calendar</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prev} className="p-1 rounded-lg hover:bg-white/5 transition-colors"><ChevronLeft className="w-3.5 h-3.5 text-slate-400" /></button>
          <button onClick={goToday} className="px-2 py-0.5 text-[10px] font-bold text-indigo-400 hover:bg-indigo-400/10 rounded-md transition-colors">Today</button>
          <button onClick={next} className="p-1 rounded-lg hover:bg-white/5 transition-colors"><ChevronRight className="w-3.5 h-3.5 text-slate-400" /></button>
        </div>
      </div>

      {/* Month / Year */}
      <div className="text-[11px] font-bold text-slate-400 mb-2">
        {MONTHS[month]} {year}
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[8px] font-bold uppercase tracking-wider text-slate-600">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 flex flex-col gap-1">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full h-full skeleton rounded-xl" style={{ minHeight: 120 }} />
          </div>
        ) : (
          weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((day, di) => {
                if (day === null) return <div key={di} />;
                const entry = dayMap.get(dateStr(day));
                const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();

                return (
                  <div
                    key={di}
                    className={`relative flex flex-col items-center justify-center rounded-lg transition-all ${isToday ? 'ring-1 ring-indigo-400' : ''}`}
                    style={{
                      background: cellColor(entry),
                      border: cellBorder(entry),
                      minHeight: 32,
                    }}
                    title={entry ? `${entry.tradeCount} trade(s) · ${entry.pnl >= 0 ? '+' : ''}${entry.pnl.toFixed(2)}` : `${day}`}
                  >
                    <span className={`text-[9px] font-bold ${entry ? 'text-white' : 'text-slate-600'}`}>
                      {day}
                    </span>
                    {entry && (
                      <span className={`text-[7px] font-bold tabular-nums ${entry.pnl >= 0 ? 'text-emerald-200' : 'text-red-200'}`}>
                        {entry.pnl >= 0 ? '+' : ''}{entry.pnl.toFixed(0)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {[
          { label: 'Profit', color: 'rgba(34,197,94,0.55)' },
          { label: 'Loss', color: 'rgba(239,68,68,0.55)' },
          { label: 'No trades', color: 'transparent' },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1 text-[8px] text-slate-500">
            <span className="w-2.5 h-2.5 rounded" style={{ background: l.color, border: '1px solid rgba(255,255,255,0.1)' }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
