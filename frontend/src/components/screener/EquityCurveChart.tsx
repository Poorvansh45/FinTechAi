"use client";

import { useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

export type EquityPoint = {
  /** null on the synthetic opening point (starting capital, before any trade). */
  date: string | null;
  symbol: string | null;
  equity: number;
};

type Props = {
  curve: EquityPoint[];
  /** Baseline the curve started from — draws the break-even line. */
  startingCapital: number;
};

const W = 640;
const H = 220;
const PAD = { l: 52, r: 16, t: 14, b: 26 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;

const TEAL = "rgb(45 212 191)";
const RED = "rgb(248 113 113)";

const inr = (v: number) =>
  `₹${Math.round(v).toLocaleString("en-IN")}`;

/** ₹1,23,456 is unreadable on an axis — compact to L/Cr, the scale Indian
 *  traders actually read account values in. */
function axisMoney(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(a >= 1e8 ? 0 : 1)}Cr`;
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(a >= 1e6 ? 0 : 1)}L`;
  if (a >= 1e3) return `₹${Math.round(v / 1e3)}K`;
  return `₹${Math.round(v)}`;
}

/**
 * Scrubbable equity curve.
 *
 * Replaces a static polyline sparkline. The point of this panel is to let the
 * reader interrogate the claim — so every trade is addressable: move the pointer
 * and the crosshair snaps to the nearest trade, naming the symbol, the date, the
 * account value and how far below the running peak it was at the time.
 *
 * Drawn as a plain inline SVG (no chart dependency, matching the rest of the
 * codebase) with framer-motion — already a dependency — only for the reveal.
 */
export function EquityCurveChart({ curve, startingCapital }: Props) {
  const reduced = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hot, setHot] = useState<number | null>(null);

  const geo = useMemo(() => {
    if (!curve || curve.length < 2) return null;

    const vals = curve.map((p) => p.equity);
    // Always include the starting capital in the domain, so "above/below where
    // you began" is readable even if the curve never crosses back.
    const rawMin = Math.min(...vals, startingCapital);
    const rawMax = Math.max(...vals, startingCapital);
    const padY = (rawMax - rawMin || 1) * 0.08;
    const lo = rawMin - padY;
    const hi = rawMax + padY;

    const x = (i: number) => PAD.l + (i / (curve.length - 1)) * PLOT_W;
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * PLOT_H;

    const line = curve
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.equity).toFixed(1)}`)
      .join(" ");
    const area = `${line} L${x(curve.length - 1).toFixed(1)},${y(lo).toFixed(1)} L${x(0).toFixed(1)},${y(lo).toFixed(1)} Z`;

    // Running peak → the drawdown at each point, and where the worst one sat.
    let peak = -Infinity;
    let worstIdx = 0;
    let worstDd = 0;
    const dd = curve.map((p, i) => {
      peak = Math.max(peak, p.equity);
      const d = peak > 0 ? ((p.equity - peak) / peak) * 100 : 0;
      if (d < worstDd) { worstDd = d; worstIdx = i; }
      return d;
    });

    const ticks = [hi, lo + (hi - lo) * 0.5, lo].map((v) => ({ v, y: y(v) }));

    return { x, y, line, area, dd, worstIdx, worstDd, ticks, lo, baselineY: y(startingCapital) };
  }, [curve, startingCapital]);

  if (!geo) return null;

  const onMove = (e: React.PointerEvent) => {
    const el = svgRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Map through the viewBox — the SVG is width-responsive, so client pixels
    // and user units are not 1:1.
    const px = ((e.clientX - r.left) / r.width) * W;
    const t = (px - PAD.l) / PLOT_W;
    const i = Math.round(t * (curve.length - 1));
    setHot(Math.max(0, Math.min(curve.length - 1, i)));
  };

  const point = hot === null ? null : curve[hot];
  const pctFromStart =
    point ? ((point.equity - startingCapital) / startingCapital) * 100 : 0;

  // Card flips to whichever side keeps it inside the plot.
  const CARD_W = 168;
  const cardLeftPct = hot === null ? 0 : (geo.x(hot) / W) * 100;
  const flip = hot !== null && geo.x(hot) > W * 0.55;

  return (
    <div className="relative w-full select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full cursor-crosshair"
        style={{ height: 220 }}
        onPointerMove={onMove}
        onPointerLeave={() => setHot(null)}
      >
        <defs>
          <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={TEAL} stopOpacity="0.20" />
            <stop offset="100%" stopColor={TEAL} stopOpacity="0" />
          </linearGradient>
          <clipPath id="eqClip">
            <rect x={PAD.l} y={PAD.t} width={PLOT_W} height={PLOT_H} />
          </clipPath>
        </defs>

        {/* value gridlines + axis */}
        {geo.ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.l} y1={t.y} x2={W - PAD.r} y2={t.y}
              stroke="rgb(255 255 255 / 0.05)" strokeDasharray="2 5"
            />
            <text
              x={PAD.l - 8} y={t.y + 3} textAnchor="end"
              fontSize={9} fill="rgb(148 163 184 / 0.7)" className="tabular-nums"
            >
              {axisMoney(t.v)}
            </text>
          </g>
        ))}

        {/* break-even on the starting capital — above it is profit, below is loss */}
        <line
          x1={PAD.l} y1={geo.baselineY} x2={W - PAD.r} y2={geo.baselineY}
          stroke="rgb(148 163 184 / 0.35)" strokeWidth={1} strokeDasharray="4 4"
        />
        <text x={W - PAD.r} y={geo.baselineY - 5} textAnchor="end" fontSize={8.5} fill="rgb(148 163 184 / 0.6)">
          start {axisMoney(startingCapital)}
        </text>

        <g clipPath="url(#eqClip)">
          <motion.path
            d={geo.area}
            fill="url(#eqFill)"
            initial={{ opacity: reduced ? 1 : 0 }}
            animate={{ opacity: 1 }}
            transition={reduced ? { duration: 0 } : { duration: 0.5, delay: 0.55 }}
          />
          <motion.path
            d={geo.line}
            fill="none"
            stroke={TEAL}
            strokeWidth={1.6}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: reduced ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={reduced ? { duration: 0 } : { duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
        </g>

        {/* worst drawdown — the number quoted in the headline, shown where it happened */}
        {geo.worstDd < -0.05 && (
          <motion.g
            initial={{ opacity: reduced ? 1 : 0 }}
            animate={{ opacity: hot === null ? 1 : 0.25 }}
            transition={reduced ? { duration: 0 } : { duration: 0.4, delay: 1 }}
          >
            <circle cx={geo.x(geo.worstIdx)} cy={geo.y(curve[geo.worstIdx].equity)} r={3} fill={RED} />
            <text
              x={geo.x(geo.worstIdx)}
              y={geo.y(curve[geo.worstIdx].equity) + 14}
              textAnchor="middle" fontSize={8.5} fill={RED} className="tabular-nums"
            >
              worst {geo.worstDd.toFixed(1)}%
            </text>
          </motion.g>
        )}

        {/* trade-count axis */}
        <text x={PAD.l} y={H - 8} fontSize={8.5} fill="rgb(148 163 184 / 0.6)">
          trade 1
        </text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" fontSize={8.5} fill="rgb(148 163 184 / 0.6)">
          {curve.length - 1} trades
        </text>

        {/* scrub crosshair */}
        {hot !== null && point && (
          <g pointerEvents="none">
            <line
              x1={geo.x(hot)} y1={PAD.t} x2={geo.x(hot)} y2={PAD.t + PLOT_H}
              stroke="rgb(255 255 255 / 0.22)" strokeWidth={1}
            />
            <circle
              cx={geo.x(hot)} cy={geo.y(point.equity)} r={3.5}
              fill={geo.dd[hot] < -0.05 ? RED : TEAL}
              stroke="#0A0E17" strokeWidth={1.5}
            />
          </g>
        )}
      </svg>

      {/* hover card — value big, context muted */}
      {hot !== null && point && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-lg border border-gray-700 bg-gray-950/95 px-2.5 py-1.5 shadow-xl"
          style={{
            width: CARD_W,
            left: `calc(${cardLeftPct}% + ${flip ? -CARD_W - 10 : 10}px)`,
          }}
        >
          <div className="font-mono text-[13px] font-bold text-white">{inr(point.equity)}</div>
          <div className="mt-0.5 text-[10px] text-gray-400">
            {point.symbol ? (
              <>
                after <span className="font-semibold text-gray-200">{point.symbol}</span>
                {point.date ? ` · ${point.date}` : ""}
              </>
            ) : (
              "before the first trade"
            )}
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] tabular-nums">
            <span className={pctFromStart >= 0 ? "text-teal-400" : "text-red-400"}>
              {pctFromStart >= 0 ? "+" : ""}{pctFromStart.toFixed(1)}% vs start
            </span>
            <span className={geo.dd[hot] < -0.05 ? "text-red-400" : "text-gray-600"}>
              {geo.dd[hot] < -0.05 ? `${geo.dd[hot].toFixed(1)}% off peak` : "at peak"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
