import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI, Type } from "@google/genai";

export interface ProsperoTickerSignal {
  ticker: string;
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  convictionScore: number;
  prosperoMetrics: {
    institutionalFlow: "ACCUMULATION" | "DISTRIBUTION" | "NEUTRAL";
    downsideRiskAlert: boolean;
    upsideBreakoutAlert: boolean;
  };
  keyRationale: string;
}

export interface ProsperoDigest {
  title: string;
  publishDate: string;
  macroRegime: "BULLISH" | "BEARISH" | "NEUTRAL" | "HIGH_VOLATILITY";
  macroSummary: string;
  tickerSignals: ProsperoTickerSignal[];
}

const DIGEST_FILE_PATH = path.join(process.cwd(), "prospero_digests.json");

// Default initial data for simulation/fallback
const INITIAL_PROSPERO_DIGEST: ProsperoDigest = {
  title: "Prospero.ai Macro Flow and Institutional Accumulation Monitor",
  publishDate: new Date().toISOString(),
  macroRegime: "BULLISH",
  macroSummary: "Institutional dark pool net flow indicates heavy accumulation in key tech clusters. Broad market momentum remains supportive of short-put cash yield strategies, as long as strikes are kept below Bollinger lower support boundaries. Recommended focus lies in hyper-scalers showing consistent net accumulation.",
  tickerSignals: [
    {
      ticker: "NVDA",
      sentiment: "BULLISH",
      convictionScore: 0.9,
      prosperoMetrics: {
        institutionalFlow: "ACCUMULATION",
        downsideRiskAlert: false,
        upsideBreakoutAlert: true
      },
      keyRationale: "Net institutional net accumulation continues to pace at 5-day highs. Dark pool blocks indicate massive buyer interest at major Fibonacci retracements."
    },
    {
      ticker: "TSLA",
      sentiment: "NEUTRAL",
      convictionScore: 0.2,
      prosperoMetrics: {
        institutionalFlow: "NEUTRAL",
        downsideRiskAlert: false,
        upsideBreakoutAlert: false
      },
      keyRationale: "Retail volume remains high but institutional net flow shows mixed distribution and accumulation near key moving average support."
    },
    {
      ticker: "META",
      sentiment: "BULLISH",
      convictionScore: 0.75,
      prosperoMetrics: {
        institutionalFlow: "ACCUMULATION",
        downsideRiskAlert: false,
        upsideBreakoutAlert: false
      },
      keyRationale: "Steady buyer accumulation inside dark pools with stable option implied volatility, supporting conservative short-put yield premium harvesting."
    },
    {
      ticker: "SNOW",
      sentiment: "BEARISH",
      convictionScore: -0.7,
      prosperoMetrics: {
        institutionalFlow: "DISTRIBUTION",
        downsideRiskAlert: true,
        upsideBreakoutAlert: false
      },
      keyRationale: "Heavy institutional distribution observed over the last two quarters. Retracing key level; option strikes should be placed at least 15% out-of-the-money."
    }
  ]
};

// Ensure the local storage file exists
export function loadProsperoDigests(): ProsperoDigest {
  try {
    if (fs.existsSync(DIGEST_FILE_PATH)) {
      const content = fs.readFileSync(DIGEST_FILE_PATH, "utf-8");
      return JSON.parse(content);
    }
  } catch (e) {
    console.error("Error loading Prospero digests:", e);
  }
  // Fallback to default
  saveProsperoDigests(INITIAL_PROSPERO_DIGEST);
  return INITIAL_PROSPERO_DIGEST;
}

export function saveProsperoDigests(data: ProsperoDigest) {
  try {
    fs.writeFileSync(DIGEST_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving Prospero digests:", e);
  }
}

/**
 * Parses Substack RSS XML using robust regular expressions (avoiding fragile external parser dependencies)
 */
export async function fetchProsperoRssFeed(): Promise<{ title: string; link: string; content: string; date: string }[]> {
  try {
    console.log("[Prospero RSS] Fetching Substacks feed...");
    const response = await fetch("https://prosperoai.substack.com/feed");
    if (!response.ok) {
      throw new Error(`Substack feed returned HTTP status ${response.status}`);
    }
    const xml = await response.text();
    
    // Parse <item> elements using robust regex
    const items: { title: string; link: string; content: string; date: string }[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    
    while ((match = itemRegex.exec(xml)) !== null) {
      const itemContent = match[1];
      
      const titleMatch = itemContent.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || itemContent.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
      const descMatch = itemContent.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || itemContent.match(/<description>([\s\S]*?)<\/description>/);
      const dateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      
      const title = titleMatch ? titleMatch[1].trim() : "Untitled Post";
      const link = linkMatch ? linkMatch[1].trim() : "";
      const content = descMatch ? descMatch[1].trim() : "";
      const date = dateMatch ? dateMatch[1].trim() : new Date().toUTCString();
      
      items.push({ title, link, content, date });
    }
    
    return items;
  } catch (error) {
    console.error("Error fetching Prospero RSS Feed:", error);
    return [];
  }
}

/**
 * Extracts structured option signals from the latest newsletter text using Gemini fallback engine
 */
export async function syncProsperoWithGemini(apiKey: string | undefined): Promise<ProsperoDigest> {
  if (!apiKey) {
    console.warn("[Prospero Sync] No Gemini API Key found. Returning existing digests.");
    return loadProsperoDigests();
  }

  const items = await fetchProsperoRssFeed();
  if (items.length === 0) {
    throw new Error("Could not retrieve any feed items from Prospero Substack.");
  }

  const latestItem = items[0];
  console.log(`[Prospero Sync] Analyzing latest article: "${latestItem.title}"`);

  // Clean HTML from feed content
  const cleanContent = latestItem.content
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 8000); // Truncate to stay safely within token constraints

  const prompt = `You are a professional options trader and macro analyst.
You are analyzing the latest newsletter issue from Prospero.ai, titled: "${latestItem.title}".
Your objective is to summarize the macro outlook and extract specific stock/ticker signals to guide Cash-Secured Put (CSP) option sellers.

Here is the cleaned article content:
"""
${cleanContent}
"""

Analyze the text and extract:
1. The global macro regime (BULLISH, BEARISH, NEUTRAL, or HIGH_VOLATILITY)
2. A 3-4 sentence macro summary tailored for options sellers (where to place strikes, etc.).
3. A list of specific stock tickers mentioned with their sentiment, institutional accumulation/distribution status, conviction scores (-1.0 to 1.0), risk alerts, and rationale.

You MUST respond strictly in valid JSON matching this schema:
{
  "title": "Title of the newsletter issue analyzed",
  "publishDate": "ISO publish date string",
  "macroRegime": "BULLISH | BEARISH | NEUTRAL | HIGH_VOLATILITY",
  "macroSummary": "Your 3-4 sentence options macro takeaway",
  "tickerSignals": [
    {
      "ticker": "STOCK_TICKER (e.g. NVDA, TSLA, AAPL)",
      "sentiment": "BULLISH | BEARISH | NEUTRAL",
      "convictionScore": 0.85,
      "prosperoMetrics": {
        "institutionalFlow": "ACCUMULATION | DISTRIBUTION | NEUTRAL",
        "downsideRiskAlert": false,
        "upsideBreakoutAlert": false
      },
      "keyRationale": "A short sentence explaining why"
    }
  ]
}`;

  const ai = new GoogleGenAI({ apiKey });
  const modelsToTry = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  let parsedDigest: ProsperoDigest | null = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(`[Prospero Sync] Attempting extraction with model: ${modelName}`);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      if (response && response.text) {
        const text = response.text.trim();
        parsedDigest = JSON.parse(text);
        if (parsedDigest && parsedDigest.tickerSignals) {
          console.log("[Prospero Sync] Successfully parsed structured data!");
          break;
        }
      }
    } catch (err) {
      console.warn(`[Prospero Sync] Model ${modelName} failed. Trying next fallback...`, err);
    }
  }

  if (parsedDigest) {
    // Keep fallback fields robust
    parsedDigest.publishDate = latestItem.date;
    parsedDigest.title = latestItem.title;
    saveProsperoDigests(parsedDigest);
    return parsedDigest;
  }

  throw new Error("Gemini failed to extract structured signals from the feed content.");
}
