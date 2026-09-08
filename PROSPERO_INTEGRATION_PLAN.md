# Prospero.ai Newsletter Integration Plan

This document outlines the architecture, access approaches, and options scoring formula for integrating the [Prospero.ai Substack](https://prosperoai.substack.com/) newsletter into the options recommendation and scoring engine.

---

## 1. Objectives

1. Automatically ingest newsletter articles from Prospero.ai.
2. Summarize each issue using Gemini AI to extract:
   - Overall macro regime / market sentiment (Bullish, Bearish, Neutral, Volatile).
   - Ticker-specific mentions (e.g. `NVDA`, `AAPL`, `TSLA`, `SPY`, `QQQ`).
   - Dark pool / institutional net flow signals and upside/downside flags.
3. Factor these signals into the options scoring model:
   - Reward aligned safe put setups (+5 to +10 score bonus).
   - Flag and penalize tickers facing institutional outflow or downside alert (-15 score penalty, strike cushion widening).
4. Present a dedicated newsletter intelligence drawer/badge in the UI.

---

## 2. Ingestion Approaches

### Approach A: Public RSS Ingestion
- **URL**: `https://prosperoai.substack.com/feed`
- **Mechanism**: Server polling endpoint (`/api/newsletter/prospero/sync`) fetching RSS XML.
- **Pros**: Zero credentials, zero authentication barriers.
- **Limitation**: Only provides public or preview sections of paywalled posts.

---

### Approach B: Email Ingestion (Full-Text for Paid / Subscriber Posts)

Since subscriber posts are emailed directly to `muthu.vela@gmail.com`, this bypasses Substack's login/CAPTCHA mechanisms while obtaining 100% full content.

#### Option 1: Direct Gmail OAuth (Polling)
- **Scope**: `https://www.googleapis.com/auth/gmail.readonly`
- **Query**: `from:prosperoai.substack.com newer_than:7d`
- **Flow**:
  1. Triggered on a schedule (every 1-2 hours) or manually via "Sync Newsletter" button.
  2. Reads new message IDs, decodes message payload, extracts plain text & HTML body.
  3. Checks against existing IDs in Firestore (`newsletter_digests/{messageId}`) to prevent re-processing.
- **Pros**: One-click Google sign-in; no external email service needed.

#### Option 2: Inbound Webhook (Push-Based)
- **Inbound Address**: Dedicated parser address (e.g., via Postmark Inbound, SendGrid Parse, or Cloudflare Email Workers).
- **Gmail Filter**: 1-time forwarding rule in `muthu.vela@gmail.com`:
  - Condition: `From: prosperoai.substack.com`
  - Action: `Forward to <inbound-address>`
- **Server Endpoint**: `POST /api/webhooks/inbound-newsletter`
- **Pros**: Real-time push, zero OAuth maintenance, zero inbox access needed.

---

## 3. Gemini Extraction Schema

When an article is ingested, the server sends the cleaned content to Gemini with the following schema:

```json
{
  "title": "string",
  "publishDate": "ISO date string",
  "macroRegime": "BULLISH | BEARISH | NEUTRAL | HIGH_VOLATILITY",
  "macroSummary": "3-4 concise sentences for options sellers",
  "tickerSignals": [
    {
      "ticker": "string",
      "sentiment": "BULLISH | BEARISH | NEUTRAL",
      "convictionScore": "number between -1.0 and 1.0",
      "prosperoMetrics": {
        "institutionalFlow": "ACCUMULATION | DISTRIBUTION | NEUTRAL",
        "downsideRiskAlert": "boolean",
        "upsideBreakoutAlert": "boolean"
      },
      "keyRationale": "string"
    }
  ]
}
```

---

## 4. Options Scoring Formula Integration

In `server.ts`, calculate the updated score as:

```typescript
let prosperoBonus = 0;
const signal = getProsperoSignal(ticker);

if (signal) {
  if (signal.sentiment === "BULLISH" && signal.prosperoMetrics.institutionalFlow === "ACCUMULATION") {
    prosperoBonus += 10;
    contract.strategyFlags.push("Prospero: Institutional Inflow (+10)");
  } else if (signal.sentiment === "BULLISH") {
    prosperoBonus += 5;
    contract.strategyFlags.push("Prospero: Bullish (+5)");
  } else if (signal.sentiment === "BEARISH" || signal.prosperoMetrics.downsideRiskAlert) {
    prosperoBonus -= 15;
    contract.strategyFlags.push("Prospero Warning: Downside Risk Alert (-15)");
    contract.recommendedStrike = widenOtmCushion(contract.strike, 0.05); // suggest 5% wider strike
  }
}

contract.compositeScore = Math.min(100, Math.max(0, contract.compositeScore + prosperoBonus));
```

---

## 5. Next Steps When Ready to Implement

1. Choose between **Option 1 (Gmail OAuth)** vs. **Option 2 (Inbound Webhook)**.
2. If Option 1: run `set_up_oauth` with `https://www.googleapis.com/auth/gmail.readonly`.
3. Scaffold the Firestore collection `newsletter_digests` in `firebase-blueprint.json` and `firestore.rules`.
4. Implement the backend sync worker in `server.ts` and the UI drawer in the frontend.
