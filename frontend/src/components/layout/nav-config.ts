import {
  LayoutDashboard, Activity, Globe, TrendingUp, ShieldAlert, Zap, BarChart2,
  ScanLine, Filter, Gauge, Waves, BookMarked, Layers,
  FlaskConical, RotateCcw, GitCompare, PieChart, Sigma, AreaChart,
  BookOpen, History, LineChart, Brain, PlayCircle,
  Sparkles, MessageSquare, Eye, AlertTriangle, Lightbulb, Bot, Briefcase,
  Radar,
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
      { href: '/markets',          label: 'Mission Control', icon: Radar,          desc: 'Institutional market overview', badge: 'Live' },
      { href: '/markets/pulse',    label: 'Market Pulse',    icon: Activity,       desc: 'AI narrative and sentiment engine'     },
      { href: '/markets/movers',   label: 'Top Movers Pro',  icon: TrendingUp,     desc: 'Momentum, volume and opportunities', badge: '⭐' },
      { href: '/markets/sectors',  label: 'Sector Rotation', icon: RotateCcw,      desc: 'Capital flow and sector leadership'    },
      { href: '/markets/macro',    label: 'Macro Intel',     icon: Globe,          desc: 'Geopolitics, central banks and risk events'          },
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
    id: 'quant-lab',
    label: 'Quant Lab',
    href: '/quant-lab',
    color: 'text-violet-400',
    glowColor: 'rgba(139,92,246,0.15)',
    items: [
      { href: '/quant-lab/optimizer',    label: 'Portfolio Optimizer',  icon: Briefcase,    desc: 'MPT-based portfolio optimization',        badge: 'New' },
      { href: '/quant-lab/research',     label: 'Quant Research',       icon: GitCompare,   desc: 'Asset correlation & statistical analysis'       },
      { href: '/quant-lab/strategies',   label: 'Strategy Lab',         icon: FlaskConical, desc: 'Design & backtest trading strategies'           },
      { href: '/quant-lab/risk',         label: 'Risk Analytics',       icon: ShieldAlert,  desc: 'Volatility, drawdown & tail-risk analysis'      },
      { href: '/quant-lab/trends',       label: 'Trend Analyzer',       icon: TrendingUp,   desc: 'Momentum, breakout & mean-reversion signals'    },
      { href: '/quant-lab/replay',       label: 'Trade Replay',         icon: PlayCircle,   desc: 'Replay and learn from historical trades'        },
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
      { href: '/analytics',           label: 'Performance Analytics', icon: LineChart, desc: 'PnL, win rate & deep stats'      },
    ],
  },
  {
    id: 'ai-copilot',
    label: 'AI Copilot',
    href: '/ai-copilot',
    color: 'text-pink-400',
    glowColor: 'rgba(236,72,153,0.15)',
    items: [
      { href: '/ai-insights',           label: 'AI Trade Review',     icon: Sparkles,      desc: 'AI analysis of your trades',  badge: 'AI' },
      { href: '/ai-copilot/mistakes',   label: 'Mistake Detection',   icon: AlertTriangle, desc: 'Pattern-based error detection'       },
      { href: '/ai-copilot/suggest',    label: 'AI Suggestions',      icon: Lightbulb,     desc: 'Personalized improvement tips'       },
      { href: '/ai-copilot/patterns',   label: 'Pattern Recognition', icon: Eye,           desc: 'Chart & behavioral pattern AI'       },
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
