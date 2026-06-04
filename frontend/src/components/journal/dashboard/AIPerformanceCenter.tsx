'use client';

import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, Clock, Zap, Brain } from 'lucide-react';
import type { AIInsight } from '@/lib/api/journalApi';

interface Props {
  insights: AIInsight[];
  loading?: boolean;
}

const TYPE_META: Record<AIInsight['type'], { icon: React.ElementType; color: string; bg: string; label: string }> = {
  session:     { icon: Clock,         color: '#a78bfa', bg: 'rgba(167,139,250,0.06)', label: 'Session' },
  setup:       { icon: TrendingUp,    color: '#34d399', bg: 'rgba(52,211,153,0.06)',  label: 'Setup' },
  risk:        { icon: AlertTriangle, color: '#fb923c', bg: 'rgba(251,146,60,0.06)',  label: 'Risk' },
  improvement: { icon: Lightbulb,     color: '#60a5fa', bg: 'rgba(96,165,250,0.06)',  label: 'Improve' },
  streak:      { icon: Zap,           color: '#f87171', bg: 'rgba(248,113,113,0.06)', label: 'Streak' },
};

export function AIPerformanceCenter({ insights, loading }: Props) {
  return (
    <div className="glass-card p-5 relative overflow-hidden" style={{ border: '1px solid rgba(99,102,241,0.12)' }}>
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-[0.08] blur-3xl"
        style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }} />

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.2), rgba(124,58,237,0.15))', border: '1px solid rgba(99,102,241,0.2)' }}>
          <Brain className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black">AI Performance Insights</h3>
            <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>
              <Sparkles className="w-2.5 h-2.5" /> Behavioral
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Pattern analysis derived from your trading history</p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 skeleton rounded-xl" />)}
        </div>
      ) : insights.length === 0 ? (
        <div className="py-6 px-4 rounded-xl flex flex-col items-center text-center gap-3"
          style={{ background: 'rgba(99,102,241,0.04)', border: '1px dashed rgba(99,102,241,0.12)' }}>
          <Brain className="w-8 h-8 text-indigo-500/40" />
          <div>
            <p className="text-[12px] font-bold text-slate-400 mb-1">Behavioral analysis locked</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed max-w-sm">
              Log at least <strong className="text-slate-400">3 closed trades</strong> to unlock session patterns, setup insights, and risk behaviour detection.
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
                style={{ background: meta.bg, border: `1px solid ${meta.color}18` }}>
                {/* Left accent */}
                <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full" style={{ background: meta.color }} />

                <span className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
                  style={{ background: `${meta.color}15`, color: meta.color }}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[9px] font-black uppercase tracking-wider px-1 py-0.5 rounded"
                      style={{ background: `${meta.color}15`, color: meta.color }}>{meta.label}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ml-auto ${
                      insight.severity === 'positive' ? 'bg-emerald-400' :
                      insight.severity === 'warn' ? 'bg-orange-400' : 'bg-indigo-400'
                    }`} />
                  </div>
                  <div className="text-[11px] font-black mb-0.5" style={{ color: meta.color }}>{insight.title}</div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{insight.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
