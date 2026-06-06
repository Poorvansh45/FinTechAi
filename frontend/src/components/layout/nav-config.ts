import {
  LayoutDashboard, Activity, Globe, TrendingUp, ShieldAlert, Zap, BarChart2,
  ScanLine, Filter, Gauge, Waves, BookMarked, Layers,
  FlaskConical, RotateCcw, GitCompare, PieChart, Sigma, AreaChart,
  BookOpen, History, LineChart, Brain, PlayCircle,
  Sparkles, MessageSquare, Eye, AlertTriangle, Lightbulb, Bot, Briefcase,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: any;
  desc: string;
  badge?: string;
}

export interface NavModule {
  id: string;
  label: string;
  href: string;
  color: string;        // tailwind text color for active/icon
  glowColor: string;    // rgba for glow
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
      { href: '/markets',          label: 'Overview',        icon: LayoutDashboard, desc: 'Market intelligence summary'     },
      { href: '/markets/pulse',    label: 'Market Pulse',    icon: Activity,        desc: 'Breadth, fear & greed, volume'  },
      { href: '/markets/sectors',  label: 'Sector Heatmap',  icon: Globe,           desc: 'Real-time sector performance'   },
      { href: '/markets/trends',   label: 'Trend Analyzer',  icon: TrendingUp,      desc: 'Momentum & breakout signals'    },
      { href: '/markets/risk',     label: 'Risk Analytics',  icon: ShieldAlert,     desc: 'Volatility & drawdown analysis' },
      { href: '/markets/movers',   label: 'Top Movers',      icon: Zap,             desc: 'Gainers, losers & volume surges', badge: 'Live' },
      { href: '/markets/signals',  label: 'AI Signals',      icon: BarChart2,       desc: 'AI-detected setups & alerts',   badge: 'AI'  },
    ],
  },
  {
    id: 'screener',
    label: 'Screener',
    href: '/screener',
    color: 'text-emerald-400',
    glowColor: 'rgba(52,211,153,0.15)',
    items: [
      { href: '/screener',              label: 'Technical Filters',  icon: Filter,     desc: 'RSI, MACD, EMA & more'         },
      { href: '/screener/smc',          label: 'SMC Scanner',        icon: Layers,     desc: 'Institutional demand zones'    },
      { href: '/screener/volume',       label: 'Volume Breakouts',   icon: Waves,      desc: 'Unusual volume detection'      },
      { href: '/screener/fvg',          label: 'FVG Scanner',        icon: ScanLine,   desc: 'Fair value gap opportunities'  },
      { href: '/screener/watchlists',   label: 'Smart Watchlists',   icon: BookMarked, desc: 'AI-curated watchlists'         },
      { href: '/screener/custom',       label: 'Custom Conditions',  icon: Layers,     desc: 'Build your own scan logic',    badge: 'Coming soon' },
    ],
  },
  {
    id: 'quant-lab',
    label: 'Quant Lab',
    href: '/quant-lab',
    color: 'text-violet-400',
    glowColor: 'rgba(139,92,246,0.15)',
    items: [
      { href: '/quant-lab/optimizer',    label: 'Portfolio Optimizer',  icon: Briefcase,    desc: 'MPT-based portfolio optimization', badge: 'New' },
      { href: '/quant-lab/research',     label: 'Quant Research',       icon: GitCompare,   desc: 'Asset correlation & statistical analysis' },
      { href: '/quant-lab/strategies',   label: 'Strategy Lab',         icon: FlaskConical, desc: 'Design & backtest trading strategies' },
      { href: '/quant-lab/replay',       label: 'Trade Replay',         icon: PlayCircle,   desc: 'Replay and learn from historical trades' },
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
      { href: '/workspace/history',   label: 'Trade History',         icon: History,   desc: 'Full trade history & filters'    },
      { href: '/analytics',           label: 'Performance Analytics', icon: LineChart,  desc: 'PnL, win rate & deep stats'     },
    ],
  },
  {
    id: 'ai-copilot',
    label: 'AI Copilot',
    href: '/ai-copilot',
    color: 'text-pink-400',
    glowColor: 'rgba(236,72,153,0.15)',
    items: [
      { href: '/ai-insights',           label: 'AI Trade Review',    icon: Sparkles,      desc: 'AI analysis of your trades',  badge: 'AI' },
      { href: '/ai-copilot/mistakes',   label: 'Mistake Detection',  icon: AlertTriangle, desc: 'Pattern-based error detection'       },
      { href: '/ai-copilot/suggest',    label: 'AI Suggestions',     icon: Lightbulb,     desc: 'Personalized improvement tips'       },
      { href: '/ai-copilot/patterns',   label: 'Pattern Recognition',icon: Eye,           desc: 'Chart & behavioral pattern AI'       },
      { href: '/ai-copilot/explain',    label: 'Market Explanation',  icon: Bot,           desc: 'Plain-English market summaries'      },
      { href: '/ai-copilot/chat',       label: 'AI Chat Assistant',   icon: MessageSquare, desc: 'Ask anything about your trades', badge: 'New' },
    ],
  },
];

export const MOBILE_TABS = [
  { href: '/markets',     label: 'Markets',   icon: LayoutDashboard },
  { href: '/screener',    label: 'Screener',  icon: ScanLine        },
  { href: '/ai-insights', label: 'AI',        icon: Sparkles        },
  { href: '/journal',     label: 'Journal',   icon: BookOpen        },
];
