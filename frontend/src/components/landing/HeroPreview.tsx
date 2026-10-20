import { cn } from "@/lib/utils";

/**
 * Illustrative workspace preview for the landing hero.
 *
 * Everything here is static sample content (no network, no timers) so the
 * block has a fixed size and never shifts while the page loads. The module
 * names match the real routes: Markets, SMC Zone Screener, Portfolio, AI Copilot.
 */

const WATCHLIST = [
  { sym: "INFY", chg: "+0.82%", up: true },
  { sym: "HDFCBANK", chg: "-0.36%", up: false },
  { sym: "TATASTEEL", chg: "+1.12%", up: true },
  { sym: "SBIN", chg: "+0.24%", up: true },
  { sym: "ITC", chg: "-0.11%", up: false },
];

const SETUPS = [
  { sym: "TATASTEEL", setup: "Demand zone", zone: "142.0 – 145.5", dist: "1.8%", active: true },
  { sym: "INFY", setup: "Bullish FVG", zone: "1,498 – 1,512", dist: "0.9%", active: false },
  { sym: "SBIN", setup: "Bullish FVG", zone: "812 – 820", dist: "3.2%", active: false },
  { sym: "ITC", setup: "Supply zone", zone: "468 – 474", dist: "2.4%", active: false },
];

const EXPOSURE = [
  { label: "Information Technology", pct: 38 },
  { label: "Financials", pct: 31 },
  { label: "Materials", pct: 18 },
  { label: "Other", pct: 13 },
];

// [open, close, high, low] — a pullback into a demand zone, then a bounce.
const CANDLES: [number, number, number, number][] = [
  [118, 120, 121, 117], [120, 122, 123, 119], [122, 121, 124, 120], [121, 124, 125, 120],
  [124, 126, 127, 123], [126, 125, 128, 124], [125, 122, 126, 121], [122, 120, 123, 119],
  [120, 118, 121, 117], [118, 119, 120, 116], [119, 115, 120, 114], [115, 113, 116, 112],
  [113, 111, 114, 110], [111, 112, 113, 110], [112, 111, 113, 110], [111, 113, 114, 110],
  [113, 116, 117, 112], [116, 118, 119, 115], [118, 117, 120, 116], [117, 119, 120, 116],
  [119, 121, 122, 118], [121, 120, 122, 119],
];

const W = 480;
const H = 180;
const PAD = 8;
const P_MIN = 108;
const P_MAX = 129;
const y = (p: number) => PAD + ((P_MAX - p) / (P_MAX - P_MIN)) * (H - PAD * 2);
const STEP = W / CANDLES.length;
const ZONE_FROM = 10;

function ZoneChart() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      role="img"
      aria-label="Sample candlestick chart showing price pulling back into a shaded demand zone"
    >
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="rgb(var(--neutral-800))" strokeWidth={1} />
      ))}
      <rect
        x={ZONE_FROM * STEP}
        y={y(113)}
        width={W - ZONE_FROM * STEP}
        height={y(110) - y(113)}
        fill="rgb(var(--brand-500) / 0.16)"
        stroke="rgb(var(--brand-500) / 0.55)"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      {CANDLES.map(([o, c, h, l], i) => {
        const up = c >= o;
        const color = up ? "rgb(var(--positive-500))" : "rgb(var(--negative-500))";
        const cx = i * STEP + STEP / 2;
        const bodyTop = y(Math.max(o, c));
        const bodyH = Math.max(2, Math.abs(y(o) - y(c)));
        return (
          <g key={i}>
            <line x1={cx} x2={cx} y1={y(h)} y2={y(l)} stroke={color} strokeWidth={1.25} />
            <rect x={cx - STEP * 0.28} y={bodyTop} width={STEP * 0.56} height={bodyH} fill={color} rx={1} />
          </g>
        );
      })}
    </svg>
  );
}

function PanelTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <h3 className="text-label font-semibold text-foreground">{children}</h3>
      {aside}
    </div>
  );
}

export function HeroPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn("overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900", className)}
      aria-label="Workspace preview with sample data"
    >
      <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-2.5">
        <span className="text-label font-medium text-neutral-300">Workspace preview</span>
        <span className="rounded border border-neutral-700 px-1.5 py-0.5 text-caption text-neutral-400">
          Sample data
        </span>
      </div>

      <div className="grid md:grid-cols-[148px_minmax(0,1fr)]">
        {/* Watchlist — secondary, hidden on small screens */}
        <aside className="hidden border-r border-neutral-800 p-3 md:block">
          <PanelTitle>Watchlist</PanelTitle>
          <ul className="space-y-0.5">
            {WATCHLIST.map((w) => (
              <li key={w.sym} className="flex items-center justify-between rounded px-1.5 py-1.5">
                <span className="text-caption font-medium text-foreground">{w.sym}</span>
                <span
                  className={cn(
                    "font-mono text-caption tabular-nums",
                    w.up ? "text-positive-400" : "text-negative-400",
                  )}
                >
                  {w.chg}
                </span>
              </li>
            ))}
          </ul>
        </aside>

        {/* Primary — SMC zone screener */}
        <section className="min-w-0 p-3 sm:p-4">
          <PanelTitle
            aside={
              <span className="rounded bg-brand-500/10 px-1.5 py-0.5 font-mono text-caption text-brand-300">
                TATASTEEL · 15m
              </span>
            }
          >
            SMC Zone Screener
          </PanelTitle>

          <div className="rounded-md border border-neutral-800 bg-neutral-950/50 p-2">
            <ZoneChart />
            <div className="mt-1 flex items-center gap-2 px-1 text-caption text-neutral-400">
              <span className="h-2 w-3 rounded-sm border border-dashed border-brand-500/70 bg-brand-500/20" aria-hidden />
              Demand zone
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-md border border-neutral-800">
            <table className="w-full text-left text-caption">
              <thead className="bg-neutral-950/40 text-neutral-400">
                <tr>
                  <th className="px-2.5 py-1.5 font-medium">Symbol</th>
                  <th className="px-2.5 py-1.5 font-medium">Setup</th>
                  <th className="hidden px-2.5 py-1.5 font-medium sm:table-cell">Zone</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">To zone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {SETUPS.map((r) => (
                  <tr key={r.sym} className={r.active ? "bg-brand-500/[0.07]" : undefined}>
                    <td className="px-2.5 py-1.5 font-medium text-foreground">{r.sym}</td>
                    <td className="px-2.5 py-1.5 text-neutral-300">{r.setup}</td>
                    <td className="hidden px-2.5 py-1.5 font-mono tabular-nums text-neutral-300 sm:table-cell">{r.zone}</td>
                    <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-neutral-300">{r.dist}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Secondary — portfolio risk and AI-assisted review */}
      <div className="grid gap-px border-t border-neutral-800 bg-neutral-800 sm:grid-cols-2">
        <section className="bg-neutral-900 p-3 sm:p-4">
          <PanelTitle aside={<span className="text-caption text-neutral-400">Sector exposure</span>}>
            Portfolio analysis
          </PanelTitle>
          <ul className="space-y-2">
            {EXPOSURE.map((e) => (
              <li key={e.label}>
                <div className="mb-1 flex justify-between text-caption">
                  <span className="text-neutral-300">{e.label}</span>
                  <span className="font-mono tabular-nums text-neutral-400">{e.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-neutral-800">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${e.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-neutral-900 p-3 sm:p-4">
          <PanelTitle aside={<span className="text-caption text-neutral-400">TATASTEEL</span>}>
            AI-assisted review
          </PanelTitle>
          <p className="text-caption leading-relaxed text-neutral-300">
            Price is pulling back toward the 142–145 demand zone. The daily trend is still lower, so
            check volume and higher-timeframe structure before treating this as more than a candidate.
          </p>
          <p className="mt-2 text-caption text-neutral-400">Assistive analysis, not a recommendation.</p>
        </section>
      </div>
    </div>
  );
}
