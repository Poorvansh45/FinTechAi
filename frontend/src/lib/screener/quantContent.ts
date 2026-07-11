/**
 * Plain-English glossary + FAQ content for the proprietary scanner footers.
 * Written for a non-quant retail user — every term explained simply.
 */

export const LAUNCHPAD_TERMS = [
  { term: "Confidence", def: "Our 0–100 score for how clean the setup is. It's a weighted blend of the five factors shown in each card's 'Why this setup' panel — not a promise of profit." },
  { term: "Signal Strength", def: "A simple label (Strong / Medium / Weak) derived from Confidence, so you can scan at a glance." },
  { term: "Fair Value Gap (FVG)", def: "A price gap left by a strong 3-candle move where buyers were so aggressive that a small 'unfilled' zone remains. It often acts as support on the way up." },
  { term: "EMA200 Distance", def: "How far today's price is above/below its 200-day average. LaunchPad wants −10% to +20% — healthy uptrend, not over-stretched." },
  { term: "ATR (Average True Range)", def: "A stock's typical daily move. We place the stop using ATR so a ₹50 and a ₹5000 stock get equally sensible risk." },
  { term: "Entry / Stop / Target", def: "Entry = current price. Stop = just below the FVG support (where the idea is wrong). Target = a level set at the reward multiple below." },
  { term: "Risk : Reward", def: "How much you aim to gain vs risk. 1:2 means the target is twice as far as the stop. Higher is better, all else equal." },
  { term: "Gap %", def: "Size of the FVG relative to price. A bigger gap means stronger buying pressure created it." },
  { term: "Days Since Formation", def: "How fresh the FVG is. For a 5–7 day swing, newer gaps are stronger — freshness is one of the confidence factors." },
  { term: "Holding Period", def: "How long this style of trade is typically held — 5 to 7 trading days for LaunchPad." },
];

export const LAUNCHPAD_FAQS = [
  { q: "What exactly is LaunchPad looking for?", a: "A stock in a healthy uptrend (price within −10% to +20% of its 200-day average) that is holding just above a fresh, unfilled bullish Fair Value Gap. The gap acts as support and the idea is a continuation of the up-move over the next 5–7 days." },
  { q: "How is Confidence calculated? Is it a guarantee?", a: "No — it's an explainability score, not a prediction of profit. It's a weighted average of five measurable factors: how close price is to the support (proximity), how big the gap is (gap quality), trend health vs the 200 EMA, how fresh the gap is (freshness), and momentum (RSI). Open 'Why this setup' on any card to see each factor." },
  { q: "Where does the Stop Loss come from?", a: "It's placed just below the FVG's floor, cushioned by a fraction of the stock's ATR (its typical daily range). If that distance would be unrealistically tight, we widen it to a sensible ATR-based level. Nothing is hardcoded." },
  { q: "Why is the Target set at a 1:2 reward?", a: "The target is derived — it's twice the distance from entry to stop. So the Risk:Reward you see is a real consequence of where the support and ATR put your stop, not an arbitrary number." },
  { q: "Is the data live?", a: "Setups are computed from end-of-day OHLCV history refreshed by the daily scan. Prices shown are the latest close, so treat entries as reference levels and confirm on your own chart before acting." },
  { q: "Is this financial advice?", a: "No. This is an educational, model-generated screen of historical price structure. It doesn't know your goals or risk tolerance. Always do your own research and manage position size." },
];

export const ALPHAZONE_TERMS = [
  { term: "Institutional Score", def: "Our 0–100 rating of the demand zone's quality — a blend of the underlying SMC structure score, how fresh the zone is, and how close price is to it." },
  { term: "Demand Zone", def: "A price area where large buyers previously stepped in aggressively (a Smart-Money 'order block'). Price often reacts up from these zones." },
  { term: "Zone Type (Fresh / Retested)", def: "Fresh = price hasn't returned to the zone yet (usually stronger). Retested = price has already tapped it one or more times." },
  { term: "Distance from Zone", def: "How far current price is from the zone. 'Inside' or very close means you're near the entry area." },
  { term: "Zone Strength", def: "A simple label (Strong / Medium / Weak) derived from the Institutional Score." },
  { term: "Entry / Stop / Target", def: "Entry = top of the demand zone. Stop = below the zone (where the zone has failed). Target = set at the reward multiple." },
  { term: "Projected Return", def: "The move from entry to target, as a %. It's derived from the actual zone size and reward multiple — not a guess." },
  { term: "Expected Holding", def: "A rough estimate of trading days to reach target, based on the move size and typical swing pace. Alpha Zone is a longer, 3–6 week style." },
];

export const ALPHAZONE_FAQS = [
  { q: "What is Alpha Zone scanning for?", a: "Unmitigated institutional demand zones (Smart-Money order blocks) that price is near or inside. The idea is a reversal/bounce from a level where big buyers previously acted — a longer-horizon swing than LaunchPad." },
  { q: "How is the Institutional Score built?", a: "It's a weighted blend: the SMC structure score computed by the scanner (50%), zone freshness — fresh zones score higher than repeatedly-tested ones (25%), and proximity — closer to the zone scores higher (25%). Every card shows the breakdown." },
  { q: "Where are Entry, Stop and Target placed?", a: "Entry at the top of the demand zone, stop below the zone (where the setup is invalidated), and target derived at the reward multiple. All levels come from the actual zone geometry plus ATR — no fabricated numbers." },
  { q: "What does 'Fresh' vs 'Retested' mean for me?", a: "Fresh zones haven't been tapped since forming and often hold better. Retested zones have already been hit — they can still work but the edge typically decays with each touch." },
  { q: "How long are these trades meant to be held?", a: "Alpha Zone is a longer institutional swing — roughly 3–6 weeks — versus LaunchPad's 5–7 days. The 'Expected Holding' on each card is a rough estimate, not a deadline." },
  { q: "Is this financial advice?", a: "No. It's an educational, model-generated screen based on historical price structure and Smart-Money concepts. Do your own research and manage risk before acting." },
];
