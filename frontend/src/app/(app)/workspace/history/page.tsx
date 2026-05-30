'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { History, Search, X } from 'lucide-react';
import { listSetups, listTradesBySetup, seedDemo, ensureTradeIdsUnique, deleteTrade } from '@/lib/journal/storage';
import type { Setup, Trade } from '@/lib/journal/types';
import { TradeTable } from '@/components/workspace/TradeTable';
import { LiveIndicator } from '@/components/workspace/LiveIndicator';

export default function TradeHistoryPage() {
  const [setups, setSetups] = useState<Setup[]>([]);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [selected, setSelected] = useState<Trade | null>(null);
  const [filterText, setFilterText] = useState('');
  const [closedOnly, setClosedOnly] = useState(true);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => {
    const s = listSetups();
    setSetups(s);
    const trades = s
      .flatMap((x) => listTradesBySetup(x.id))
      .sort((a, b) => new Date(b.entryAt).getTime() - new Date(a.entryAt).getTime());
    setAllTrades(trades);
  }, []);

  useEffect(() => {
    seedDemo();
    ensureTradeIdsUnique();
    refresh();
  }, [refresh, version]);

  const setupName = (id: string) => setups.find((s) => s.id === id)?.name ?? '—';

  const filtered = useMemo(() => {
    return allTrades.filter((t) => {
      if (closedOnly && t.exitPrice == null) return false;
      if (filterText && !t.instrument.toLowerCase().includes(filterText.toLowerCase())) return false;
      return true;
    });
  }, [allTrades, filterText, closedOnly]);

  return (
    <div className="space-y-4 animate-fadeIn pb-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            Trade History
            <LiveIndicator label="Archive" />
          </h1>
          <p className="text-[10px] text-muted-foreground mt-0.5">{filtered.length} trades · full history view</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={closedOnly} onChange={(e) => setClosedOnly(e.target.checked)} className="accent-indigo-500" />
          Closed only
        </label>
      </div>

      <div className="glass-card p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search instrument…"
            className="w-full bg-transparent border border-white/8 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-indigo-500/50"
          />
        </div>
        {filterText && (
          <button type="button" onClick={() => setFilterText('')} className="text-xs text-red-400 flex items-center gap-1">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      <TradeTable
        trades={filtered}
        selectedId={selected?.id ?? null}
        setupName={setupName}
        onSelect={setSelected}
        onDelete={(id) => {
          deleteTrade(id);
          setVersion((v) => v + 1);
          if (selected?.id === id) setSelected(null);
        }}
        maxHeight="70vh"
      />
    </div>
  );
}
