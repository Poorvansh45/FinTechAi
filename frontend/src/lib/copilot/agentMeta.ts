/**
 * Display metadata for agents, tools, and sources.
 *
 * Maps the raw backend identifiers (agent_used, tools_called) to human labels,
 * icons, and themed colors used by the message badges. Purely presentational —
 * no logic depends on it.
 */

import {
  Briefcase, LineChart, GraduationCap, PiggyBank, Bot,
  Activity, HeartPulse, Scale, Gauge, Sigma, Database, type LucideIcon,
} from 'lucide-react';

export interface AgentMeta {
  label: string;
  color: string; // text color class
  border: string; // border + bg tint classes
  Icon: LucideIcon;
}

export const AGENT_META: Record<string, AgentMeta> = {
  portfolio: { label: 'Portfolio Analyst', color: 'text-violet-300', border: 'border-violet-500/25 bg-violet-500/10', Icon: Briefcase },
  market: { label: 'Market Analyst', color: 'text-blue-300', border: 'border-blue-500/25 bg-blue-500/10', Icon: LineChart },
  planning: { label: 'Planning Agent', color: 'text-amber-300', border: 'border-amber-500/25 bg-amber-500/10', Icon: PiggyBank },
  education: { label: 'Education Agent', color: 'text-emerald-300', border: 'border-emerald-500/25 bg-emerald-500/10', Icon: GraduationCap },
  none: { label: 'FinTechAI Copilot', color: 'text-slate-300', border: 'border-white/10 bg-white/5', Icon: Bot },
};

export function agentMeta(agent?: string): AgentMeta {
  return AGENT_META[(agent || 'none').toLowerCase()] ?? AGENT_META.none;
}

// ── Tool badges ─────────────────────────────────────────────────────────────────
interface ToolBadge {
  label: string;
  Icon: LucideIcon;
}

const TOOL_MAP: Record<string, ToolBadge> = {
  get_user_holdings: { label: 'Portfolio Analysis', Icon: Briefcase },
  analyze_portfolio: { label: 'Portfolio Analysis', Icon: Briefcase },
  get_health_score: { label: 'Health Score', Icon: HeartPulse },
  rebalance_portfolio: { label: 'Rebalancer', Icon: Scale },
  calculate_risk: { label: 'Risk Engine', Icon: Gauge },
  calculate_volatility: { label: 'Risk Engine', Icon: Gauge },
  calculate_cagr: { label: 'Analytics Engine', Icon: Sigma },
  get_quote: { label: 'Market Service', Icon: Activity },
  get_stock_info: { label: 'Market Service', Icon: Activity },
  compare_stocks: { label: 'Market Service', Icon: Activity },
  sector_analysis: { label: 'Market Service', Icon: Activity },
  sip_calculator: { label: 'Planning Calculator', Icon: PiggyBank },
  compound_interest: { label: 'Planning Calculator', Icon: PiggyBank },
  future_value: { label: 'Planning Calculator', Icon: PiggyBank },
  risk_profile_mapper: { label: 'Risk Profiler', Icon: Gauge },
  update_financial_profile: { label: 'Memory', Icon: Database },
  get_financial_profile: { label: 'Memory', Icon: Database },
};

/** Dedup + map raw tool names to display badges. */
export function toolBadges(tools: string[] = []): ToolBadge[] {
  const seen = new Set<string>();
  const out: ToolBadge[] = [];
  for (const t of tools) {
    const badge = TOOL_MAP[t];
    if (badge && !seen.has(badge.label)) {
      seen.add(badge.label);
      out.push(badge);
    }
  }
  return out;
}

// ── Sources (which engines produced the answer) ─────────────────────────────────
export function sourcesFor(agent?: string, tools: string[] = []): string[] {
  const sources = new Set<string>();
  const has = (...names: string[]) => names.some((n) => tools.includes(n));

  if (has('get_user_holdings', 'analyze_portfolio', 'get_health_score', 'rebalance_portfolio')) {
    sources.add('Portfolio Engine');
  }
  if (has('calculate_risk', 'calculate_volatility', 'calculate_cagr')) {
    sources.add('Analytics Engine');
  }
  if (has('get_quote', 'get_stock_info', 'compare_stocks', 'sector_analysis')) {
    sources.add('Market Data');
  }
  if (has('sip_calculator', 'compound_interest', 'future_value', 'risk_profile_mapper')) {
    sources.add('Planning Engine');
  }
  if (sources.size === 0) {
    // No tools ran (e.g. education) — the model reasoned directly.
    sources.add('FinAI Copilot');
  }
  return [...sources];
}
