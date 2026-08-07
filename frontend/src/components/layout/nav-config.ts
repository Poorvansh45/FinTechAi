import {
  LayoutDashboard, Activity, Globe, TrendingUp, ShieldAlert, Zap, BarChart2,
  ScanLine, Filter, Gauge, Waves, BookMarked, Layers,
  FlaskConical, RotateCcw, GitCompare, PieChart, Sigma, AreaChart,
  BookOpen, History, LineChart, Brain, PlayCircle, Landmark,
  Sparkles, MessageSquare, Eye, AlertTriangle, Lightbulb, Bot, Briefcase,
  Radar,
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
  color: string;
  glowColor: string;
  items?: NavItem[];
}

export const NAV_MODULES: NavModule[] = [
  {
    id: 'markets',
    label: 'Markets',
    href: '/markets',
    color: 'text-blue-400',
    glowColor: 'rgba(59,130,246,0.15)',
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
    color: 'text-emerald-400',
    glowColor: 'rgba(52,211,153,0.15)',
    items: [
      { href: '/screener',              label: 'Technical Screener', icon: Filter,     desc: 'RSI, EMA %, MACD distance'     },
      { href: '/screener/smc',          label: 'SMC Scanner',        icon: Layers,     desc: 'BOS, CHoCH, demand zones'      },
      { href: '/screener/volume',       label: 'Volume Surge',       icon: Waves,      desc: 'Per-surge history & stats'     },
      { href: '/screener/fvg',          label: 'FVG Scanner',        icon: ScanLine,   desc: 'ICT fair value gaps scored'    },
      { href: '/screener/watchlists',   label: 'Smart Watchlists',   icon: BookMarked, desc: 'Track picks across scanners'   },
    ],
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    href: '/portfolio',
    color: 'text-violet-400',
    glowColor: 'rgba(139,92,246,0.15)',
    items: [
      { href: '/portfolio', label: 'Portfolio Optimizer', icon: Briefcase, desc: 'Analyze or build your portfolio', badge: 'New' },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    href: '/workspace',
    color: 'text-amber-400',
    glowColor: 'rgba(251,191,36,0.12)',
    items: [
      { href: '/journal',             label: 'Trading Journal',       icon: BookOpen,  desc: 'Log and review all trades'       },
      { href: '/journal/equity',      label: 'Equity Journal',        icon: Landmark,  desc: 'Long-term holdings, IPOs & notes' },
      { href: '/workspace/history',   label: 'Trade History',         icon: History,   desc: 'Full trade history & filters'    },
      { href: '/analytics',           label: 'Performance Analytics', icon: LineChart, desc: 'PnL, win rate & deep stats'      },
    ],
  },
  {
    id: 'ai-copilot',
    label: 'FinTechAI Copilot',
    href: '/ai-copilot',
    color: 'text-pink-400',
    glowColor: 'rgba(236,72,153,0.15)',
    items: [
      { href: '/ai-copilot', label: 'FinTechAI Copilot', icon: Brain, desc: 'Your all-in-one AI financial analyst', badge: 'AI' }
    ],
  },
];

export const MOBILE_TABS = [
  { href: '/markets',     label: 'Markets',   icon: LayoutDashboard },
  { href: '/screener',    label: 'Screener',  icon: ScanLine        },
  { href: '/ai-copilot',  label: 'AI',        icon: Sparkles        },
  { href: '/journal',     label: 'Journal',   icon: BookOpen        },
];
