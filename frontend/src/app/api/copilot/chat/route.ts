import { NextRequest, NextResponse } from "next/server";
import { isRateLimited, rateLimitKey, verifyAuth } from "@/lib/api/aiRouteGuard";

const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 4000;

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
    const { messages } = body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ text: "No message content provided." }, { status: 400 });
    }
    if (messages.length > MAX_MESSAGES) {
      return NextResponse.json({ text: "Too many messages in this request." }, { status: 400 });
    }
    for (const m of messages) {
      if (typeof m?.text !== "string" || m.text.length === 0) {
        return NextResponse.json({ text: "Invalid message payload." }, { status: 400 });
      }
      if (m.text.length > MAX_MESSAGE_LENGTH) {
        return NextResponse.json({ text: "Message is too long." }, { status: 400 });
      }
    }

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    // Convert messages to Gemini API format (user / model roles)
    const contents = messages.map((m: any) => ({
      role: m.role === "ai" ? "model" : "user",
      parts: [{ text: m.text }],
    }));

    const systemInstruction = {
      parts: [
        {
          text: `You are FinTechAI Copilot, an elite AI financial analyst, quant researcher, and trading coach.
You combine the deep market intelligence of Bloomberg AI, the clean synthesis of Perplexity, and the conversational capabilities of ChatGPT.

Answer the user's questions about markets, stocks, portfolios, trading, screening, macro events, or investments.
Provide highly structured responses using Markdown:
- Use bolding, tables, and bullet points.
- Structure recommendations clearly.
- Highlight risk warnings.
- Keep answers professional, quantitative, and actionable.

Always maintain a sophisticated, institutional-grade tone.`,
        },
      ],
    };

    if (!apiKey) {
      // Mock fallback response for demo mode
      const lastUserQuery = messages.filter(m => m.role === "user").at(-1)?.text || "general markets";
      const text = `[Demo Mode] Here is a mock response from FinTechAI Copilot regarding your query: "${lastUserQuery}". To activate live AI analysis, please configure your GOOGLE_API_KEY / GEMINI_API_KEY environment variable.

### Analysis & Outlook

1. **Market Sentiment**: Capital flows suggest selective risk-on behavior, heavily focused on defensive dividend growth and energy sectors as bond yields consolidate.
2. **Key Levels**:
   - Immediate Resistance: Major resistance lies at recent swing highs.
   - Key Support: Strong demand blocks are formed 2.5% below current market prices.
3. **Actionable Insights**:
   - Recommend analyzing asset correlations before adding to current tech index weights.
   - Utilize technical scanners (like FVG / SMC) to capture pullback entries rather than chasing breakouts.

*Warning: Leverage should be kept to a minimum in high-volatility environments.*`;
      return NextResponse.json({ text });
    }

    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=" + apiKey;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!res.ok) {
      const errorMsg = `[API error ${res.status}] Failed to connect to Gemini services. Please verify your API key and connection.`;
      return NextResponse.json({ text: errorMsg }, { status: 200 });
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to extract response from AI agent.";
    return NextResponse.json({ text });
  } catch (e: any) {
    console.error("Error in AI Copilot Chat API:", e);
    return NextResponse.json({ text: "Failed to generate AI response due to internal server error." }, { status: 500 });
  }
}
