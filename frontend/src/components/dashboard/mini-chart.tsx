"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  createChart,
  ColorType,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";

export type Candle = { time: string; open: number; high: number; low: number; close: number; volume?: number };

export function MiniChart({ symbol, candles }: { symbol: string; candles: Candle[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const macdRef = useRef<HTMLDivElement | null>(null);
  const rsiRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | any>(null);

  const processed = useMemo(() => {
    // Basic bullish FVG detection (similar to provided logic):
    // bullish FVG when current low > high[2] AND close[1] > high[2]
    const boxes: { from: number; to: number; top: number; bottom: number }[] = [];
    const supZones: { from: number; to: number; level: number }[] = [];
    // Indicators: MACD(12,26,9) and RSI(14)
    const macd: { time: number; macd: number; signal: number; hist: number }[] = [];
    const rsi: { time: number; value: number }[] = [];

    // Simple swing low support: find most recent local minimum (HL pattern)
    const n = candles.length;
    if (n >= 5) {
      for (let i = 2; i < n - 2; i++) {
        const a = candles[i - 1];
        const b = candles[i];
        const c = candles[i + 1];
        if (b.low < a.low && b.low < c.low) {
          supZones.push({ from: i, to: n - 1, level: b.low });
          break;
        }
      }
    }

    for (let i = 2; i < candles.length; i++) {
      const cur = candles[i];
      const prev1 = candles[i - 1];
      const prev2 = candles[i - 2];
      if (cur.low > prev2.high && prev1.close > prev2.high) {
        // bullish FVG between prev2.high and cur.low
        boxes.push({ from: i - 2, to: i, top: cur.low, bottom: prev2.high });
      }
    }

    // Helper EMA
    const ema = (vals: number[], period: number) => {
      const k = 2 / (period + 1);
      const out: number[] = [];
      let prev: number | null = null;
      for (let i = 0; i < vals.length; i++) {
        const v = vals[i];
        if (prev == null) prev = v;
        else prev = v * k + prev * (1 - k);
        out.push(prev);
      }
      return out;
    };

    // MACD
    if (n > 35) {
      const closes = candles.map(c => c.close);
      const ema12 = ema(closes, 12);
      const ema26 = ema(closes, 26);
      const macdLine = closes.map((_, i) => ema12[i] - ema26[i]);
      const signalLine = ema(macdLine, 9);
      for (let i = 0; i < n; i++) {
        macd.push({
          time: new Date(candles[i].time).getTime() / 1000,
          macd: macdLine[i],
          signal: signalLine[i],
          hist: macdLine[i] - signalLine[i],
        });
      }
    }

    // RSI(14)
    if (n > 15) {
      const gains: number[] = [0];
      const losses: number[] = [0];
      for (let i = 1; i < n; i++) {
        const ch = candles[i].close - candles[i - 1].close;
        gains.push(Math.max(ch, 0));
        losses.push(Math.max(-ch, 0));
      }
      // Wilder's smoothing
      const avg = (arr: number[], p: number) => {
        let ag = arr.slice(1, p + 1).reduce((a, b) => a + b, 0) / p;
        let al = losses.slice(1, p + 1).reduce((a, b) => a + b, 0) / p;
        const out: number[] = [];
        out[p] = 100 - 100 / (1 + (ag / (al || 1e-9)));
        for (let i = p + 1; i < n; i++) {
          ag = (ag * (p - 1) + gains[i]) / p;
          al = (al * (p - 1) + losses[i]) / p;
          out[i] = 100 - 100 / (1 + (ag / (al || 1e-9)));
        }
        return out;
      };
      const r = avg(gains, 14);
      for (let i = 0; i < n; i++) {
        rsi.push({ time: new Date(candles[i].time).getTime() / 1000, value: r[i] ?? 50 });
      }
    }

    return { boxes, supZones, macd, rsi };
  }, [candles]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      height: 260,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#94a3b8' },
      grid: { horzLines: { color: '#1f2937' }, vertLines: { color: '#1f2937' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: { mode: 0 },
    });
    // Version-safe helpers
    const addLine = (opts: { color: string; lineWidth?: number }) =>
      ((chart as any).addLineSeries ? (chart as any).addLineSeries(opts) : (chart as any).addSeries({ type: 'line', ...opts }));

    const series = (chart as any).addCandlestickSeries
      ? (chart as any).addCandlestickSeries({ upColor: '#16a34a', downColor: '#ef4444', wickUpColor: '#16a34a', wickDownColor: '#ef4444', borderVisible: false })
      : (chart as any).addSeries({ type: 'candlestick', upColor: '#16a34a', downColor: '#ef4444', wickUpColor: '#16a34a', wickDownColor: '#ef4444', borderVisible: false });
    const toTs = (iso: string): UTCTimestamp => Math.floor(new Date(iso).getTime() / 1000) as UTCTimestamp;
    const cndl: CandlestickData[] = candles.map(c => ({ time: toTs(c.time), open: c.open, high: c.high, low: c.low, close: c.close }));
    series.setData(cndl);

    // Draw supports
    const timeAt = (i: number): UTCTimestamp => Math.floor(new Date(candles[i].time).getTime() / 1000) as UTCTimestamp;
    (processed as any).supZones.forEach((z: any) => {
      const mk = (val: number, width = 2, color = '#3b82f6') => {
        const s = addLine({ color, lineWidth: width });
        s.setData([
          { time: timeAt(z.from), value: val },
          { time: timeAt(z.to), value: val },
        ]);
      };
      mk(z.level, 3, '#3b82f6');
      mk(z.level * 1.0015, 1, '#3b82f680');
      mk(z.level * 0.9985, 1, '#3b82f680');
    });

    // Draw bullish FVG bounds
    (processed as any).boxes.forEach((b: any) => {
      const top = addLine({ color: '#16a34aCC', lineWidth: 2 });
      top.setData([
        { time: timeAt(b.from), value: b.top },
        { time: timeAt(b.to), value: b.top },
      ]);
      const bottom = addLine({ color: '#16a34a99', lineWidth: 2 });
      bottom.setData([
        { time: timeAt(b.from), value: b.bottom },
        { time: timeAt(b.to), value: b.bottom },
      ]);
      const mid = addLine({ color: '#16a34a55', lineWidth: 1 });
      const midVal = (b.top + b.bottom) / 2;
      mid.setData([
        { time: timeAt(b.from), value: midVal },
        { time: timeAt(b.to), value: midVal },
      ]);
    });

    chartRef.current = chart;
    seriesRef.current = series;
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [candles, processed, symbol]);

  // MACD and RSI panes using additional charts stacked below
  useEffect(() => {
    if (!macdRef.current || !rsiRef.current) return;
    const { macd, rsi } = processed as any;
    // Clear
    macdRef.current.innerHTML = '';
    rsiRef.current.innerHTML = '';

    // Helper creators
    const mk = (el: HTMLDivElement, height: number) => createChart(el, {
      height,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#94a3b8' },
      grid: { horzLines: { color: '#1f2937' }, vertLines: { color: '#1f2937' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: { mode: 0 },
    });
    const addLine = (c: any, opts: { color: string; lineWidth?: number }) =>
      (c.addLineSeries ? c.addLineSeries(opts) : c.addSeries({ type: 'line', ...opts } as any));
    const addHist = (c: any, opts: { color: string }) =>
      (c.addHistogramSeries ? c.addHistogramSeries({ color: opts.color } as any) : c.addSeries({ type: 'histogram', color: opts.color } as any));

    // MACD pane
    if (Array.isArray(macd) && macd.length) {
      const c = mk(macdRef.current, 140);
      const toData = (arr: { time: number; value: number }[]) => arr.map(d => ({ time: d.time as any, value: d.value }));
      const macdLine = addLine(c, { color: '#22c55e', lineWidth: 2 });
      const signalLine = addLine(c, { color: '#f97316', lineWidth: 2 });
      const histSeries = addHist(c, { color: '#60a5fa' });
      macdLine.setData(macd.map((d: any) => ({ time: d.time as any, value: d.macd })));
      signalLine.setData(macd.map((d: any) => ({ time: d.time as any, value: d.signal })));
      histSeries.setData(macd.map((d: any) => ({ time: d.time as any, value: d.hist })));
    }

    // RSI pane
    if (Array.isArray(rsi) && rsi.length) {
      const c = mk(rsiRef.current, 120);
      const rsiLine = addLine(c, { color: '#a78bfa', lineWidth: 2 });
      rsiLine.setData(rsi.map((d: any) => ({ time: d.time as any, value: d.value })));
      // Draw 70/30 levels
      const lvl = (v: number, color: string) => {
        const s = addLine(c, { color, lineWidth: 1 });
        s.setData([
          { time: rsi[0].time as any, value: v },
          { time: rsi[rsi.length - 1].time as any, value: v },
        ]);
      };
      lvl(70, '#64748b');
      lvl(30, '#64748b');
    }
  }, [processed]);

  return (
    <div className="space-y-3">
      <div ref={containerRef} />
      <div ref={macdRef} />
      <div ref={rsiRef} />
    </div>
  );
}
