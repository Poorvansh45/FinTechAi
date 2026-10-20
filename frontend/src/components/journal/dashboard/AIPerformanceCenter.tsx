'use client';

import { withAlpha } from '@/lib/utils';
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, Clock, Zap, Brain } from 'lucide-react';
import type { AIInsight } from '@/lib/api/journalApi';

interface Props {
  insights: AIInsight[];
  loading?: boolean;
}

const TYPE_META: Record<AIInsight['type'], { icon: React.ElementType; color: string; bg: string; label: string }> = {
  session:     { icon: Clock,         color: 'rgb(var(--brand-400))', bg: 'rgb(var(--brand-400) / 0.06)', label: 'Session' },
  setup:       { icon: TrendingUp,    color: 'rgb(var(--positive-400))', bg: 'rgb(var(--positive-400) / 0.06)',  label: 'Setup' },
  risk:        { icon: AlertTriangle, color: 'rgb(var(--warning-400))', bg: 'rgb(var(--warning-400) / 0.06)',  label: 'Risk' },
  improvement: { icon: Lightbulb,     color: 'rgb(var(--brand-400))', bg: 'rgb(var(--brand-400) / 0.06)',  label: 'Improve' },
  streak:      { icon: Zap,           color: 'rgb(var(--negative-400))', bg: 'rgb(var(--negative-400) / 0.06)', label: 'Streak' },
};

export function AIPerformanceCenter({ insights, loading }: Props) {
  return (
    <div className="glass-card p-5 relative overflow-hidden" style={{ border: '1px solid rgb(var(--brand-500) / 0.12)' }}>
      {/* Ambient glow */}

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-xl flex items-center justify-center"
          style={{ background: 'rgb(var(--brand-600))', border: '1px solid rgb(var(--brand-500) / 0.2)' }}>
          <Brain className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold">AI Performance Insights</h3>
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1"
              style={{ background: 'rgb(var(--brand-500) / 0.12)', color: 'rgb(var(--brand-400))' }}>
              <Sparkles className="w-2.5 h-2.5" /> Behavioral
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Pattern analysis derived from your trading history</p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 skeleton rounded-xl" />)}
        </div>
      ) : insights.length === 0 ? (
        <div className="py-6 px-4 rounded-xl flex flex-col items-center text-center gap-3"
          style={{ background: 'rgb(var(--brand-500) / 0.04)', border: '1px dashed rgb(var(--brand-500) / 0.12)' }}>
          <Brain className="w-8 h-8 text-brand-400" />
          <div>
            <p className="text-[12px] font-bold text-neutral-400 mb-1">Behavioral analysis locked</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-sm">
              Log at least <strong className="text-neutral-400">3 closed trades</strong> to unlock session patterns, setup insights, and risk behaviour detection.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {insights.map((insight) => {
            const meta = TYPE_META[insight.type] ?? TYPE_META.improvement;
            const Icon = meta.icon;
            return (
              <div key={insight.id}
                className="group relative flex gap-3 p-3.5 rounded-xl transition-all duration-200"
                style={{ background: meta.bg, border: `1px solid ${withAlpha(meta.color, 0.09)}` }}>
                {/* Left accent */}
                <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full" style={{ background: meta.color }} />

                <span className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
                  style={{ background: `${withAlpha(meta.color, 0.08)}`, color: meta.color }}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[11px] font-bold px-1 py-0.5 rounded"
                      style={{ background: `${withAlpha(meta.color, 0.08)}`, color: meta.color }}>{meta.label}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ml-auto ${
                      insight.severity === 'positive' ? 'bg-positive-400' :
                      insight.severity === 'warn' ? 'bg-warning-400' : 'bg-brand-400'
                    }`} />
                  </div>
                  <div className="text-[11px] font-bold mb-0.5" style={{ color: meta.color }}>{insight.title}</div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{insight.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
