'use client';

import { useState } from 'react';
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, Clock, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import type { AIInsight } from '@/lib/api/journalApi';

interface Props {
  insights: AIInsight[];
  loading?: boolean;
}

const TYPE_META: Record<AIInsight['type'], { icon: React.ElementType; color: string; bg: string; border: string; label: string }> = {
  session:     { icon: Clock,         color: '#a78bfa', bg: 'rgba(167,139,250,0.08)',  border: 'rgba(167,139,250,0.18)', label: 'Session' },
  setup:       { icon: TrendingUp,    color: '#34d399', bg: 'rgba(52,211,153,0.08)',   border: 'rgba(52,211,153,0.18)',  label: 'Setup'   },
  risk:        { icon: AlertTriangle, color: '#fb923c', bg: 'rgba(251,146,60,0.08)',   border: 'rgba(251,146,60,0.18)',  label: 'Risk'    },
  improvement: { icon: Lightbulb,     color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',   border: 'rgba(96,165,250,0.18)',  label: 'Improve' },
  streak:      { icon: Zap,           color: '#f87171', bg: 'rgba(248,113,113,0.08)',  border: 'rgba(248,113,113,0.18)', label: 'Streak'  },
};

const SEVERITY_STYLES: Record<AIInsight['severity'], { dot: string; badge: string }> = {
  positive: { dot: 'bg-emerald-400', badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  warn:     { dot: 'bg-orange-400',  badge: 'text-orange-400 bg-orange-400/10 border-orange-400/20'   },
  info:     { dot: 'bg-indigo-400',  badge: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20'   },
};

function InsightCard({ insight, expanded }: { insight: AIInsight; expanded: boolean }) {
  const meta = TYPE_META[insight.type] ?? TYPE_META.improvement;
  const sev  = SEVERITY_STYLES[insight.severity];
  const IconComp = meta.icon;

  return (
    <div
      className="group relative flex gap-3 p-3.5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 insight-card"
      style={{ background: meta.bg, border: `1px solid ${meta.border}` }}
    >
      {/* Left accent line */}
      <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full" style={{ background: meta.color }} />

      {/* Icon */}
      <span
        className="flex items-center justify-center w-8 h-8 rounded-xl flex-shrink-0 mt-0.5"
        style={{ background: `${meta.color}18`, color: meta.color }}
      >
        <IconComp className="w-4 h-4" />
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {/* Type badge */}
          <span
            className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full"
            style={{ background: `${meta.color}18`, color: meta.color }}
          >
            {meta.label}
          </span>
          {/* Severity badge */}
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${sev.badge}`}>
            {insight.severity}
          </span>
          {/* Severity dot */}
          <span className={`w-1.5 h-1.5 rounded-full ml-auto flex-shrink-0 ${sev.dot}`} />
        </div>

        <div className="text-[12px] font-black mb-1" style={{ color: meta.color }}>
          {insight.title}
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{insight.body}</p>
      </div>
    </div>
  );
}

const PREVIEW_COUNT = 3;

export function AIInsightStrip({ insights, loading }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? insights : insights.slice(0, PREVIEW_COUNT);
  const hasMore = insights.length > PREVIEW_COUNT;

  return (
    <div className="glass-card p-4">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black">AI Behavioral Insights</span>
          {insights.length > 0 && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
            >
              {insights.length}
            </span>
          )}
        </div>
        <p className="ml-auto text-[10px] text-muted-foreground hidden sm:block">
          Derived from your trading patterns
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 skeleton rounded-2xl" />
          ))}
        </div>
      ) : insights.length === 0 ? (
        <div
          className="flex items-center gap-3 px-4 py-5 rounded-2xl"
          style={{ background: 'rgba(99,102,241,0.05)', border: '1px dashed rgba(99,102,241,0.15)' }}
        >
          <Sparkles className="w-5 h-5 text-indigo-500 flex-shrink-0" />
          <div>
            <p className="text-[12px] font-bold text-slate-400 mb-0.5">Behavioral analysis locked</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Log at least <strong className="text-slate-400">3 closed trades</strong> to unlock session patterns,
              setup insights, and risk behaviour detection.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visible.map((insight) => (
              <InsightCard key={insight.id} insight={insight} expanded={expanded} />
            ))}
          </div>

          {hasMore && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors mx-auto"
            >
              {expanded ? (
                <><ChevronUp className="w-3 h-3" /> Show less</>
              ) : (
                <><ChevronDown className="w-3 h-3" /> Show {insights.length - PREVIEW_COUNT} more insights</>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}
