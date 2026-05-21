"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TradeForm } from "@/components/journal/TradeForm";
import { computeStats, createTrade, getSetup, listTradesBySetup, updateTrade, deleteTrade } from "@/lib/journal/storage";
import type { Trade } from "@/lib/journal/types";
import { derive } from "@/lib/journal/types";

export default function SetupDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [setupName, setSetupName] = useState<string>("");
  const [market, setMarket] = useState<string>("Stocks");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [adding, setAdding] = useState(false);
  const [onlyCriteria, setOnlyCriteria] = useState(false);

  useEffect(() => {
    const s = getSetup(params.id);
    if (!s) {
      router.replace("/journal");
      return;
    }
    setSetupName(s.name);
    setMarket(s.marketType);
    setTrades(listTradesBySetup(s.id));
  }, [params.id, router]);

  const stats = useMemo(() => computeStats(params.id), [params.id, trades]);
  const withMetrics = useMemo(() => {
    return trades.map((t) => ({ t, m: derive(t) }));
  }, [trades]);
  const equity = useMemo(() => {
    // cumulative PnL over time (realized only)
    const realized = withMetrics.filter(({ m }) => m.pnl != null).sort((a, b) => new Date(a.t.exitAt || a.t.entryAt).getTime() - new Date(b.t.exitAt || b.t.entryAt).getTime());
    let acc = 0;
    return realized.map(({ t, m }) => {
      acc += m.pnl || 0;
      return { x: new Date(t.exitAt || t.entryAt).getTime(), y: acc };
    });
  }, [withMetrics]);
  const shownTrades = useMemo(
    () => (onlyCriteria ? trades.filter((t) => t.criteriaMet) : trades),
    [trades, onlyCriteria]
  );

  const refresh = () => setTrades(listTradesBySetup(params.id));

  return (
    <div className="container px-4 md:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{setupName}</h1>
          <div className="text-xs text-muted-foreground">{market}</div>
        </div>
        <div className="flex gap-2">
          <Link href="/journal"><Button variant="secondary">Back to Journal</Button></Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm items-end">
            <Stat label="Trades" value={stats.totalTrades} />
            <Stat label="Win rate" value={`${Math.round(stats.winRate * 100)}%`} />
            <Stat label="Avg return" value={`${stats.avgReturnPct.toFixed(2)}%`} />
            <Stat label="Best / Worst" value={`${stats.bestPct.toFixed(2)}% / ${stats.worstPct.toFixed(2)}%`} />
            <div className="hidden md:block">
              <div className="text-xs text-muted-foreground mb-1">Equity Curve</div>
              <Sparkline data={equity} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Trades</CardTitle>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={onlyCriteria} onChange={(e) => setOnlyCriteria(e.target.checked)} />
              Show only criteria-met
            </label>
            <Button onClick={() => setAdding((v) => !v)}>{adding ? "Close" : "Add Trade"}</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {adding && (
            <TradeForm
              defaultMarket={market as any}
              onSubmit={(data) => {
                createTrade({ ...data, setupId: params.id });
                setAdding(false);
                refresh();
              }}
              onCancel={() => setAdding(false)}
            />
          )}

          <TradesTable trades={shownTrades} onDelete={(id) => { deleteTrade(id); refresh(); }} />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function TradesTable({ trades, onDelete }: { trades: Trade[]; onDelete: (id: string) => void }) {
  if (!trades.length) return <div className="text-sm text-muted-foreground">No trades yet.</div>;
  return (
    <div className="overflow-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <Th>Time</Th>
            <Th>Instrument</Th>
            <Th>Side</Th>
            <Th>Entry</Th>
            <Th>Exit</Th>
            <Th>Qty</Th>
            <Th>P/L</Th>
            <Th>Criteria</Th>
            <Th>Comments</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            const m = derive(t);
            const pnl = m.pnl ?? 0;
            const pnlCls = pnl > 0 ? 'text-green-600' : pnl < 0 ? 'text-red-600' : 'text-muted-foreground';
            return (
              <tr key={t.id} className="border-t">
                <Td>{new Date(t.entryAt).toLocaleString()}</Td>
                <Td>{t.instrument}</Td>
                <Td>{t.side}</Td>
                <Td>{t.entryPrice}</Td>
                <Td>{t.exitPrice ?? '-'}</Td>
                <Td>{t.quantity}</Td>
                <Td className={pnlCls}>{pnl.toFixed(2)}</Td>
                <Td>
                  {t.criteriaMet ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-[11px]">Met</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-muted text-muted-foreground text-[11px]">—</span>
                  )}
                </Td>
                <Td className="max-w-[260px] truncate" title={t.comments}>{t.comments}</Td>
                <Td>
                  <Button size="sm" variant="destructive" onClick={() => onDelete(t.id)}>Delete</Button>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className = '' }: { children?: any; className?: string }) {
  return <th className={`text-left p-2 font-medium ${className}`}>{children}</th>;
}

function Td({ children, className = '', title }: { children?: any; className?: string; title?: string }) {
  return (
    <td className={`p-2 align-top ${className}`} title={title}>
      {children}
    </td>
  );
}

function Sparkline({ data }: { data: { x: number; y: number }[] }) {
  const w = 160;
  const h = 36;
  if (!data || data.length < 2) return <div className="text-xs text-muted-foreground">No data</div>;
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const scaleX = (x: number) => (w - 4) * (x - minX) / Math.max(1, (maxX - minX)) + 2;
  const scaleY = (y: number) => h - ((h - 4) * (y - minY) / Math.max(1, (maxY - minY)) + 2);
  const path = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(d.x).toFixed(1)} ${scaleY(d.y).toFixed(1)}`)
    .join(' ');
  const last = ys[ys.length - 1] - ys[0];
  const stroke = last >= 0 ? '#16a34a' : '#ef4444';
  return (
    <svg width={w} height={h} className="block">
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" />
    </svg>
  );
}
