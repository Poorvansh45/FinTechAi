import {
  LayoutDashboard, Activity, Globe, TrendingUp, ScanLine, Filter, Waves, BookMarked, Layers,
  RotateCcw, PieChart, BookOpen, History, LineChart, Brain, Landmark, Sparkles, Briefcase, Radar,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: any;
  desc: string;
  badge?: string;
  /** Optional group heading rendered above this item (e.g. "Live Overview").
   * Items sharing a section value are grouped together; items without one
   * render as a single flat list — same component, two layouts. */
  section?: string;
}

export interface NavModule {
  id: string;
  label: string;
  href: string;
  /** Small status tag shown beside the label in the top bar (e.g. "Beta"). */
  badge?: string;
  items?: NavItem[];
}

export const NAV_MODULES: NavModule[] = [
  {
    id: 'markets',
    label: 'Markets',
    href: '/markets',
    items: [
      { href: '/markets',          label: 'Mission Control', icon: Radar,          desc: 'Institutional market overview', badge: 'Live', section: 'Live Overview' },
      { href: '/markets/pulse',    label: 'Market Pulse',    icon: Activity,       desc: 'AI narrative and sentiment engine', section: 'Live Overview' },
      { href: '/markets/movers',   label: 'Top Movers Pro',  icon: TrendingUp,     desc: 'Momentum, volume and opportunities', badge: 'Popular', section: 'Discovery' },
      { href: '/markets/sectors',  label: 'Sector Rotation', icon: RotateCcw,      desc: 'Capital flow and sector leadership', section: 'Discovery' },
      { href: '/markets/macro',    label: 'Macro Intel',     icon: Globe,          desc: 'Geopolitics, central banks and risk events', section: 'Macro Intelligence' },
    ],
  },
  {
    id: 'screener',
    label: 'Screener',
    href: '/screener',
    items: [
      { href: '/screener',              label: 'Technical Screener', icon: Filter,     desc: 'RSI, EMA %, MACD distance'     },
      { href: '/screener/smc',          label: 'SMC Scanner',        icon: Layers,     desc: 'BOS, CHoCH, demand zones'      },
      { href: '/screener/volume',       label: 'Volume Surge',       icon: Waves,      desc: 'Per-surge history & stats'     },
      { href: '/screener/fvg',          label: 'FVG Scanner',        icon: ScanLine,   desc: 'ICT fair value gaps scored'    },
      { href: '/screener/watchlists',   label: 'Smart Watchlists',   icon: BookMarked, desc: 'Track picks across scanners'   },
    ],
  },
  {
    id: 'sector-xpert',
    label: 'Sector Xpert',
    href: '/sector-xpert',
    badge: 'Beta',
    items: [
      { href: '/sector-xpert', label: 'Sector Xpert', icon: PieChart, desc: 'Explore India\'s market sectors & leadership', badge: 'Beta' },
    ],
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    href: '/portfolio',
    items: [
      { href: '/portfolio', label: 'Portfolio Optimizer', icon: Briefcase, desc: 'Analyze or build your portfolio', badge: 'New' },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    href: '/workspace',
    items: [
      { href: '/journal',             label: 'Trading Journal',       icon: BookOpen,  desc: 'Log and review all trades'       },
      { href: '/journal/equity',      label: 'Equity Journal',        icon: Landmark,  desc: 'Long-term holdings, IPOs & notes' },
      { href: '/workspace/history',   label: 'Trade History',         icon: History,   desc: 'Full trade history & filters'    },
      { href: '/analytics',           label: 'Performance Analytics', icon: LineChart, desc: 'PnL, win rate & deep stats'      },
    ],
  },
  {
    id: 'ai-copilot',
    label: 'Nivro Copilot',
    href: '/ai-copilot',
    items: [
      { href: '/ai-copilot', label: 'Nivro Copilot', icon: Brain, desc: 'Your all-in-one AI financial analyst', badge: 'AI' }
    ],
  },
];

export const MOBILE_TABS = [
  { href: '/home',        label: 'Home',      icon: LayoutDashboard },
  { href: '/markets',     label: 'Markets',   icon: Activity        },
  { href: '/screener',    label: 'Screener',  icon: ScanLine        },
  { href: '/ai-copilot',  label: 'AI',        icon: Sparkles        },
  { href: '/journal',     label: 'Journal',   icon: BookOpen        },
];

/** Groups items by `section`, preserving first-seen order for both the
 * sections themselves and the items inside each. Items without a `section`
 * collect under a single unlabeled group, so a module with 1-2 flat items
 * renders as a plain list — grouping is opt-in per item. */
export function groupBySection(items: NavItem[]): { section: string | null; items: NavItem[] }[] {
  const order: (string | null)[] = [];
  const buckets = new Map<string | null, NavItem[]>();
  for (const item of items) {
    const key = item.section ?? null;
    if (!buckets.has(key)) { buckets.set(key, []); order.push(key); }
    buckets.get(key)!.push(item);
  }
  return order.map((section) => ({ section, items: buckets.get(section)! }));
}

/** Tone for each nav badge, keyed by what the badge MEANS — "Live" is green
 * everywhere and nothing else competes with it. */
export const NAV_BADGE_TONE: Record<string, string> = {
  Live:    'border-positive-500/30 bg-positive-500/10 text-positive-400',
  New:     'border-brand-500/30 bg-brand-500/10 text-brand-400',
  AI:      'border-brand-500/30 bg-brand-500/10 text-brand-400',
  Beta:    'border-border bg-muted text-muted-foreground',
  Popular: 'border-warning-500/30 bg-warning-500/10 text-warning-400',
};
export const NAV_BADGE_FALLBACK = 'border-border bg-muted text-muted-foreground';
