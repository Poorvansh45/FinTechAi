"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MarketType, Side, Trade } from "@/lib/journal/types";

export function TradeForm({
  defaultMarket,
  onSubmit,
  onCancel,
}: {
  defaultMarket: MarketType;
  onSubmit: (data: Omit<Trade, "id">) => void;
  onCancel?: () => void;
}) {
  // Market-specific lists (can be moved to a shared constants file later)
  const forexPairs = [
    "XAU/USD",
    "GBP/USD",
    "EUR/USD",
    "USD/INR",
    "EUR/INR",
    "GBP/INR",
    "USD/JPY",
  ];
  const indiaIndices = [
    "NIFTY 50",
    "BANKNIFTY",
    "SENSEX",
    "FINNIFTY",
    "NIFTY MIDCAP",
  ];

  const [instrument, setInstrument] = useState("");
  const [marketType, setMarketType] = useState<MarketType>(defaultMarket);
  const [side, setSide] = useState<Side>("Buy");
  const [entryPrice, setEntryPrice] = useState<number | string>("");
  const [exitPrice, setExitPrice] = useState<number | string>("");
  const [entryAt, setEntryAt] = useState<string>(new Date().toISOString().slice(0, 16));
  const [exitAt, setExitAt] = useState<string>("");
  const [quantity, setQuantity] = useState<number | string>(1);
  const [comments, setComments] = useState("");
  const [criteriaMet, setCriteriaMet] = useState<boolean>(false);
  const [criteriaNotes, setCriteriaNotes] = useState<string>("");

  const submit = () => {
    if (!instrument.trim() || !entryPrice || !entryAt) return;
    const exitDefined = exitPrice !== "" && exitAt !== "";
    onSubmit({
      setupId: "", // caller will override
      instrument: instrument.trim(),
      marketType,
      side,
      entryPrice: Number(entryPrice),
      exitPrice: exitDefined ? Number(exitPrice) : null,
      entryAt: new Date(entryAt).toISOString(),
      exitAt: exitDefined ? new Date(exitAt).toISOString() : null,
      quantity: Number(quantity || 1),
      comments,
      criteriaMet,
      criteriaNotes: criteriaNotes.trim() || undefined,
    } as any);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label>Market</Label>
          <select value={marketType} onChange={(e) => setMarketType(e.target.value as MarketType)} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
            <option>Indices</option>
            <option>Stocks</option>
            <option>FNO</option>
            <option>Forex</option>
          </select>
        </div>
        <div>
          <Label>Side</Label>
          <select value={side} onChange={(e) => setSide(e.target.value as Side)} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
            <option>Buy</option>
            <option>Sell</option>
          </select>
        </div>
        <div>
          <Label>Quantity / Lots</Label>
          <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} min={1} />
        </div>
      </div>

      <div>
        <Label>Instrument</Label>
        {marketType === "Forex" ? (
          <select
            className="w-full h-9 rounded-md border bg-background px-3 text-sm"
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
          >
            <option value="">Select pair</option>
            {forexPairs.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        ) : marketType === "Indices" ? (
          <select
            className="w-full h-9 rounded-md border bg-background px-3 text-sm"
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
          >
            <option value="">Select index</option>
            {indiaIndices.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        ) : (
          <Input value={instrument} onChange={(e) => setInstrument(e.target.value)} placeholder="e.g., NSE:RELIANCE, BANKNIFTY 24OCT FUT, USDINR" />
        )}
        <div className="text-[11px] text-muted-foreground mt-1">
          {marketType === 'Forex' && 'Tip: choose from popular FX pairs.'}
          {marketType === 'Indices' && 'Tip: choose NIFTY/BANKNIFTY/SENSEX variants.'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Entry price</Label>
          <Input type="number" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} />
        </div>
        <div>
          <Label>Exit price</Label>
          <Input type="number" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Entry time</Label>
          <Input type="datetime-local" value={entryAt} onChange={(e) => setEntryAt(e.target.value)} />
        </div>
        <div>
          <Label>Exit time</Label>
          <Input type="datetime-local" value={exitAt} onChange={(e) => setExitAt(e.target.value)} />
        </div>
      </div>

      <div>
        <Label>Comments</Label>
        <Textarea rows={2} value={comments} onChange={(e) => setComments(e.target.value)} />
      </div>

      <div className="rounded-md border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <input id="criteria" type="checkbox" checked={criteriaMet} onChange={(e) => setCriteriaMet(e.target.checked)} />
          <Label htmlFor="criteria">This trade meets the setup's entry criteria</Label>
        </div>
        <Textarea
          rows={2}
          placeholder="Optional notes about how the entry criteria were satisfied (e.g., RSI<30 + volume spike)"
          value={criteriaNotes}
          onChange={(e) => setCriteriaNotes(e.target.value)}
        />
      </div>

      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        )}
        <Button type="button" onClick={submit}>Add Trade</Button>
      </div>
    </div>
  );
}
