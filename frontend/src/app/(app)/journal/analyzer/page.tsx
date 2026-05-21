"use client";

import { useMemo, useState, useEffect } from "react";
import { AIJournalAnalyzer } from "@/components/journal/AIJournalAnalyzer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listSetups, listTradesBySetup } from "@/lib/journal/storage";
import type { Trade, Setup } from "@/lib/journal/types";

export default function AnalyzerPage() {
  const [setups, setSetups] = useState<Setup[]>([]);
  useEffect(()=>{ setSetups(listSetups()); }, []);

  const allTrades: Trade[] = useMemo(() =>
    setups.flatMap(s => listTradesBySetup(s.id)).sort((a,b)=> new Date(a.entryAt).getTime() - new Date(b.entryAt).getTime())
  , [setups]);
  const setupName = (id: string) => setups.find(s=>s.id===id)?.name || "";

  return (
    <div className="container px-4 md:px-6 py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Journal Analyzer</CardTitle>
        </CardHeader>
        <CardContent>
          <AIJournalAnalyzer trades={allTrades} setupName={setupName} />
        </CardContent>
      </Card>
    </div>
  );
}
