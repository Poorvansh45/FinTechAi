"use client";

import { useCallback, useMemo, useState } from "react";
import { createSetup, createTrade } from "@/lib/journal/storage";
import type { Setup, Trade, TradeStatus } from "@/lib/journal/types";
import {
  buildAssistantInsights,
  calculateExitMetrics,
  calculateTradeRisk,
  validateTradeCapture,
} from "@/services/trade-capture-calculations";
import type {
  TradeCaptureData,
  TradeRiskSnapshot,
} from "@/types/trade-capture";

const DRAFT_KEY = "trade_capture_draft_v2";

function nowLocalInput(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowTime(): string {
  return new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function createDefaultCapture(setups: Setup[]): TradeCaptureData {
  return {
    marketType: setups[0]?.marketType ?? "Indices",
    symbol: "",
    direction: "Buy",
    entryPrice: "",
    stopLoss: "",
    takeProfit: "",
    positionSize: "1",
    entryAt: nowLocalInput(),
    setupId: setups[0]?.id ?? "",
    setup: "",
    timeframe: "5m",
    htfBias: "",
    session: "London",
    tags: [],
    customSetupName: "",
    status: "Open",
    // New fields
    confidence: 5,
    exitPrice: "",
    exitDate: todayDate(),
    exitTime: nowTime(),
    exitStatus: "Open",
  };
}

function readDraft(setups: Setup[]): TradeCaptureData {
  if (typeof window === "undefined") return createDefaultCapture(setups);
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return createDefaultCapture(setups);
    return { ...createDefaultCapture(setups), ...JSON.parse(raw) };
  } catch {
    return createDefaultCapture(setups);
  }
}

function toNumber(value: string): number {
  return Number(value);
}

function toIsoFromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

function resolveSetup(data: TradeCaptureData): { setupId: string; setupName: string } {
  const setupName = data.customSetupName.trim() || data.setup;
  if (!data.customSetupName.trim()) {
    return { setupId: data.setupId, setupName };
  }

  const setup = createSetup({
    name: setupName,
    marketType: data.marketType,
    tags: data.tags,
    params: {
      entryCriteria: setupName,
      riskRules: "Captured from Add Trade ticket",
    },
  });

  return { setupId: setup.id, setupName: setup.name };
}

function buildTradePayload(
  data: TradeCaptureData,
  risk: TradeRiskSnapshot,
  status: TradeStatus
): Omit<Trade, "id"> {
  const setup = resolveSetup(data);

  // Build exit datetime if exit fields are filled
  let exitPrice: number | null = null;
  let exitAt: string | null = null;
  const exitNum = Number(data.exitPrice);
  if (data.exitPrice && Number.isFinite(exitNum)) {
    exitPrice = exitNum;
  }
  if (data.exitDate && data.exitTime) {
    try {
      const dt = new Date(`${data.exitDate}T${data.exitTime}`);
      if (!isNaN(dt.getTime())) {
        exitAt = dt.toISOString();
      }
    } catch {
      // ignore
    }
  }

  // Map exitStatus to TradeStatus
  const resolvedStatus: TradeStatus =
    data.exitStatus === "Closed" || data.exitStatus === "Breakeven"
      ? "Closed"
      : status;

  return {
    setupId: setup.setupId,
    status: resolvedStatus,
    instrument: data.symbol.trim().toUpperCase(),
    marketType: data.marketType,
    side: data.direction,
    entryPrice: toNumber(data.entryPrice),
    exitPrice,
    entryAt: toIsoFromLocalInput(data.entryAt),
    exitAt,
    quantity: toNumber(data.positionSize),
    comments: "",
    criteriaMet: undefined,
    criteriaNotes: undefined,
    entryModel: setup.setupName,
    stopLoss: toNumber(data.stopLoss),
    target: toNumber(data.takeProfit),
    session: data.session,
    setupTag: setup.setupName,
    tags: data.tags,
    timeframe: data.timeframe || undefined,
    htfBias: data.htfBias || undefined,
    confidence: data.confidence,
    tradeContext: {
      setup: setup.setupName,
      timeframe: data.timeframe,
      htfBias: data.htfBias,
      session: data.session,
      tags: data.tags,
    },
    riskSnapshot: risk,
  };
}

export function useTradeCapture(setups: Setup[], onSaved: () => void) {
  const [data, setData] = useState<TradeCaptureData>(() => readDraft(setups));
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const risk = useMemo(() => calculateTradeRisk(data), [data]);
  const exitMetrics = useMemo(() => calculateExitMetrics(data, risk), [data, risk]);
  const validation = useMemo(() => validateTradeCapture(data, risk), [data, risk]);
  const assistantInsights = useMemo(
    () => buildAssistantInsights(risk, validation),
    [risk, validation]
  );

  const updateField = useCallback(
    <K extends keyof TradeCaptureData>(key: K, value: TradeCaptureData[K]) => {
      setData((current) => ({ ...current, [key]: value }));
    },
    []
  );

  const addTag = useCallback((tag: string) => {
    const normalized = tag.trim();
    if (!normalized) return;
    setData((current) => ({
      ...current,
      tags: current.tags.includes(normalized) ? current.tags : [...current.tags, normalized],
    }));
  }, []);

  const removeTag = useCallback((tag: string) => {
    setData((current) => ({
      ...current,
      tags: current.tags.filter((item) => item !== tag),
    }));
  }, []);

  const saveDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    setDraftSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }, [data]);

  const persistTrade = useCallback((status: TradeStatus) => {
    if (!validation.canSaveTrade) return;
    createTrade(buildTradePayload(data, risk, status));
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DRAFT_KEY);
    }
    onSaved();
  }, [data, onSaved, risk, validation.canSaveTrade]);

  return {
    data,
    risk,
    exitMetrics,
    validation,
    assistantInsights,
    draftSavedAt,
    updateField,
    addTag,
    removeTag,
    saveDraft,
    saveTrade: () => persistTrade("Draft"),
    createTrade: () => persistTrade("Open"),
  };
}
