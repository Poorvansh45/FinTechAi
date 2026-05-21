"use client";

import { useState } from "react";
import { Setup, MarketType } from "@/lib/journal/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function SetupForm({ onSubmit, onCancel, initial }: { onSubmit: (data: Omit<Setup, "id" | "createdAt" | "updatedAt">) => void; onCancel?: () => void; initial?: Partial<Setup> }) {
  const [name, setName] = useState(initial?.name || "");
  const [marketType, setMarketType] = useState<MarketType>((initial?.marketType as MarketType) || "Stocks");
  const [tags, setTags] = useState<string>((initial?.tags || []).join(", "));
  const [entryCriteria, setEntryCriteria] = useState(initial?.params?.entryCriteria || "");
  const [stopLoss, setStopLoss] = useState(initial?.params?.stopLoss || "");
  const [target, setTarget] = useState(initial?.params?.target || "");
  const [riskRules, setRiskRules] = useState(initial?.params?.riskRules || "");
  const [notes, setNotes] = useState(initial?.params?.notes || "");

  const submit = () => {
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      marketType,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      params: { entryCriteria, stopLoss, target, riskRules, notes },
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="s-name">Setup name</Label>
        <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Momentum Breakout" />
      </div>
      <div>
        <Label htmlFor="s-market">Market type</Label>
        <select id="s-market" value={marketType} onChange={(e) => setMarketType(e.target.value as MarketType)} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
          <option>Indices</option>
          <option>Stocks</option>
          <option>FNO</option>
          <option>Forex</option>
        </select>
      </div>
      <div>
        <Label htmlFor="s-tags">Tags (comma separated)</Label>
        <Input id="s-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="momentum, intraday" />
      </div>
      <div>
        <Label>Entry criteria</Label>
        <Textarea rows={2} value={entryCriteria} onChange={(e) => setEntryCriteria(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label>Stop loss</Label>
          <Input value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="e.g., ATR*1.5" />
        </div>
        <div>
          <Label>Target</Label>
          <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g., 2R" />
        </div>
        <div>
          <Label>Risk rules</Label>
          <Input value={riskRules} onChange={(e) => setRiskRules(e.target.value)} placeholder="e.g., 1% per trade" />
        </div>
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        )}
        <Button type="button" onClick={submit}>{initial ? 'Save Changes' : 'Save Setup'}</Button>
      </div>
    </div>
  );
}
