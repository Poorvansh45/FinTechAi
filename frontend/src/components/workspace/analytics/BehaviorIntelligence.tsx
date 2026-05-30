'use client';

import { computeBehaviorInsights } from '@/lib/journal/behavior-analytics';
import { InsightCard } from '@/components/workspace/InsightCard';
import { SectionHeader } from '@/components/workspace/SectionHeader';
import type { Trade } from '@/lib/journal/types';

interface Props {
  trades: Trade[];
  setupName: (id: string) => string;
}

export function BehaviorIntelligence({ trades, setupName }: Props) {
  const insights = computeBehaviorInsights(trades, setupName);

  return (
    <div>
      <SectionHeader title="Behavior Intelligence" live />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {insights.map((ins) => (
          <InsightCard key={ins.id} text={ins.text} severity={ins.severity} />
        ))}
      </div>
    </div>
  );
}
