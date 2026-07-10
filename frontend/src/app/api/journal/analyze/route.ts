import { NextRequest, NextResponse } from "next/server";
import { isRateLimited, rateLimitKey, verifyAuth } from "@/lib/api/aiRouteGuard";

const MAX_TRADES = 500;

export async function POST(req: NextRequest) {
  try {
    const userId = await verifyAuth(req);
    if (!userId) {
      return NextResponse.json({ text: "Not authorized." }, { status: 401 });
    }
    if (isRateLimited(rateLimitKey(req, userId))) {
      return NextResponse.json({ text: "Too many requests. Please slow down." }, { status: 429 });
    }

    const body = await req.json();
    const { trades, kpi } = body || {};

    if (trades !== undefined && !Array.isArray(trades)) {
      return NextResponse.json({ text: "Invalid trades payload." }, { status: 400 });
    }
    if (Array.isArray(trades) && trades.length > MAX_TRADES) {
      return NextResponse.json({ text: "Too many trades in this request." }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    const prompt = buildPrompt(trades || [], kpi || {});

    if (!apiKey) {
      // Fallback text if no key configured
      const text = defaultInsightText(prompt);
      return NextResponse.json({ text });
    }

    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=" + apiKey;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = defaultInsightText(prompt) + `\n\n[API error ${res.status}]`;
      return NextResponse.json({ text }, { status: 200 });
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || defaultInsightText(prompt);
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ text: "Failed to analyze journal." }, { status: 200 });
  }
}

function buildPrompt(trades: any[], kpi: any) {
  const header = `You are an expert trading coach AI. Analyze the trading journal and provide clear sections:\nPROS:\nCONS:\nSUGGESTIONS:\nVIEW:`;
  const stats = `KPI: total=${kpi.totalTrades ?? 0}, winRate=${kpi.winRate?.toFixed?.(2) ?? kpi.winRate ?? 0}%, avgPnl=${kpi.avgPnl ?? 0}, best=${kpi.best ?? 0}, worst=${kpi.worst ?? 0}`;
  const lines = trades.slice(0, 300).map((t) => {
    return `- ${t.entryAt} | ${t.marketType} | ${t.instrument} | side=${t.side} | qty=${t.quantity} | entry=${t.entryPrice} | exit=${t.exitPrice ?? ''}`;
  });
  return `${header}\n${stats}\nTRADES:\n${lines.join("\n")}`;
}

function defaultInsightText(prompt: string) {
  // very small deterministic fallback output with the required markers
  return [
    "PROS:",
    "- You maintain consistent journaling and track PnL across markets.",
    "- You have some profitable stretches; best trade shows solid execution.",
    "",
    "CONS:",
    "- Position sizing appears inconsistent across trades.",
    "- Exits may not follow a defined rule; losing trades extend too long.",
    "",
    "SUGGESTIONS:",
    "- Define a fixed R multiple for stop loss and a partial take-profit plan.",
    "- Focus on top 1–2 setups with highest avg PnL and win rate.",
    "- Avoid trading during low-liquidity times; review the hours of worst results.",
    "",
    "VIEW:",
    "- Momentum is improving; with stricter risk rules, expectancy can increase.",
  ].join("\n");
}
