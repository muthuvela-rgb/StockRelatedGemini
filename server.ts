import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- GOOGLE GENAI CLIENT SETUP ---
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAIClient;
}

// In-memory cache for SEC filing summaries
const secSummaryCache = new Map<string, any>();

// --- CONSTANTS & WATCHLIST ---
const DEFAULT_WATCHLIST = ["NVDA", "AAPL", "MSFT", "MU", "AMZN", "META", "TSLA", "AMD", "PLTR", "QQQ"];
const WATCHLIST_FILE = path.join(process.cwd(), "watchlist.json");

function getWatchlist(): string[] {
  try {
    if (fs.existsSync(WATCHLIST_FILE)) {
      const data = JSON.parse(fs.readFileSync(WATCHLIST_FILE, "utf-8"));
      if (Array.isArray(data) && data.length > 0) {
        return data.map((t) => String(t).trim().toUpperCase());
      }
    }
  } catch (e) {
    console.error("Error reading watchlist:", e);
  }
  return DEFAULT_WATCHLIST;
}

function saveWatchlist(tickers: string[]) {
  try {
    fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(tickers, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving watchlist:", e);
  }
}

// QQQ Constituents Snapshot
const QQQ_CONSTITUENTS = [
  "NVDA", "AAPL", "MSFT", "MU", "AMZN", "AMD", "GOOGL", "GOOG", "TSLA", "AVGO",
  "META", "WMT", "INTC", "CSCO", "COST", "PLTR", "AMAT", "LRCX", "NFLX", "PANW",
  "SPCX", "KLAC", "TXN", "AMGN", "SNDK", "LIN", "MRVL", "CRWD", "TMUS", "PEP",
  "STX", "GILD", "ADI", "SHOP", "QCOM", "BKNG", "ASML", "WDC", "ISRG", "VRTX",
  "SBUX", "FTNT", "ADP", "ADBE", "ARM", "CEG", "INTU", "MELI", "APP", "MAR",
  "CMCSA", "CSX", "MNST", "DASH", "CDNS", "REGN", "MDLZ", "CTAS", "ABNB", "DDOG",
  "SNPS", "ROST", "ORLY", "WBD", "HON", "AEP", "PCAR", "LITE", "BKR", "MPWR",
  "PDD", "TER", "FAST", "FANG", "NXPI", "PYPL", "ADSK", "AXON", "XEL",
  "ALAB", "NBIS", "CCEP", "FER", "EXC", "IDXX", "PAYX", "TTWO", "RKLB", "ODFL",
  "KDP", "MCHP", "ROP", "CRWV", "TRI", "WDAY", "DXCM", "MSTR", "GEHC", "ALNY",
  "CPRT", "KHC"
];

const SPY_CONSTITUENTS = [
  "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "BRK-B", "UNH", "JNJ",
  "JPM", "XOM", "V", "PG", "MA", "AVGO", "HD", "CVX", "MRK", "ABBV",
  "COST", "PEP", "ADBE", "WMT", "BAC", "MCD", "CSCO", "CRM", "NFLX", "ACN"
];

// --- STATISTICAL / OPTIONS MATHEMATICS ---
function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x > 0 ? 1 - p : p;
}

function normalPdf(x: number): number {
  return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

export function calculateGreeks(
  strike: number,
  spot: number,
  iv: number,
  daysToExpiration: number,
  isCall = true,
  riskFreeRate = 0.045
) {
  const T = Math.max(daysToExpiration, 0.5) / 365.0;
  const sigma = iv > 0 ? iv : 0.3;
  const K = strike;

  if (sigma <= 0 || T <= 0 || spot <= 0 || K <= 0) {
    return { delta: null, gamma: null, theta: null, vega: null, rho: null };
  }

  const d1 = (Math.log(spot / K) + (riskFreeRate + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  const pdfD1 = normalPdf(d1);

  // Delta
  const delta = isCall ? normalCdf(d1) : normalCdf(d1) - 1.0;

  // Gamma
  const gamma = pdfD1 / (spot * sigma * Math.sqrt(T));

  // Theta (daily decay)
  let theta: number;
  if (isCall) {
    theta =
      (-((spot * pdfD1 * sigma) / (2 * Math.sqrt(T))) -
        riskFreeRate * K * Math.exp(-riskFreeRate * T) * normalCdf(d2)) /
      365.0;
  } else {
    theta =
      (-((spot * pdfD1 * sigma) / (2 * Math.sqrt(T))) +
        riskFreeRate * K * Math.exp(-riskFreeRate * T) * normalCdf(-d2)) /
      365.0;
  }

  // Vega (for 1% IV change)
  const vega = (spot * pdfD1 * Math.sqrt(T)) / 100.0;

  // Rho (for 1% rate change)
  let rho: number;
  if (isCall) {
    rho = (K * T * Math.exp(-riskFreeRate * T) * normalCdf(d2)) / 100.0;
  } else {
    rho = (-K * T * Math.exp(-riskFreeRate * T) * normalCdf(-d2)) / 100.0;
  }

  return {
    delta: Number(delta.toFixed(4)),
    gamma: Number(gamma.toFixed(4)),
    theta: Number(theta.toFixed(4)),
    vega: Number(vega.toFixed(4)),
    rho: Number(rho.toFixed(4)),
  };
}

// Margin Requirement Estimation
// 1. Reg-T Standard Naked Put Margin (FINRA Rule 4210):
//    Max of:
//    a) 20% of current stock price - OTM amount + Option Premium (Standard Reg-T formula)
//    b) 10% of strike price + Option Premium
//    c) Minimum floor of $2.50/share (or $250/contract)
// 2. Portfolio Margin (TIMS stress model):
//    Evaluated under a standard 15% downside stress with standard regulatory minimum cushion (not falling below 10% notional or $2.50/sh floor).
function estimatePortfolioMargin(
  currentPrice: number,
  strike: number,
  premium: number,
  shockPct = 15.0,
  floorPerShare = 2.50,
  floorPctOfPrice = 10.0,
  premiumBufferPct = 0.0
): number {
  if (currentPrice <= 0 || strike <= 0) return strike;

  // Reg-T / FINRA 4210 Standard Naked Put Margin per share
  const otmAmount = Math.max(currentPrice - strike, 0);
  const regTRuleA = (0.20 * currentPrice) - otmAmount + premium;
  const regTRuleB = (0.10 * strike) + premium;
  const regTMinimum = Math.max(floorPerShare, (floorPctOfPrice / 100) * strike);
  const standardMargin = Math.max(regTRuleA, regTRuleB, regTMinimum);

  // OCC TIMS Stress Valuation Model:
  // Evaluates position loss under a -shockPct move (e.g. -15% down)
  const stressedPrice = currentPrice * (1 - shockPct / 100);
  const stressedLoss = Math.max(strike - stressedPrice, 0);
  // Collateral requires covering the stressed loss plus premium margin
  const stressedRequirement = stressedLoss + Math.max(premium, 0);

  // Regulatory PM minimum floor: at least 10% of underlying spot or strike, or $2.50/share minimum
  const regulatoryFloor = Math.max(
    floorPerShare,
    (floorPctOfPrice / 100) * Math.min(currentPrice, strike),
    premium * (1 + premiumBufferPct / 100)
  );

  const pmRequirement = Math.max(stressedRequirement, regulatoryFloor);

  // Return the calculated requirement, capped at maximum cash-secured strike liability
  return Math.min(strike, Math.max(pmRequirement, regulatoryFloor));
}

// Technical calculations
function computeRsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const deltas: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    deltas.push(closes[i] - closes[i - 1]);
  }
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (deltas[i] > 0) avgGain += deltas[i];
    else avgLoss += Math.abs(deltas[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period; i < deltas.length; i++) {
    const gain = deltas[i] > 0 ? deltas[i] : 0;
    const loss = deltas[i] < 0 ? Math.abs(deltas[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(2));
}

function computeBollinger(closes: number[], period = 20, numStd = 2.0) {
  if (closes.length < period) return null;
  const window = closes.slice(-period);
  const sum = window.reduce((a, b) => a + b, 0);
  const sma = sum / period;
  const variance = window.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
  const std = Math.sqrt(variance);
  const upper = sma + numStd * std;
  const lower = sma - numStd * std;
  const price = closes[closes.length - 1];
  const percentB = upper === lower ? 0.5 : (price - lower) / (upper - lower);

  let zone = "lower half";
  if (percentB > 1) zone = "above upper band";
  else if (percentB > 0.5) zone = "upper half";
  else if (percentB >= 0) zone = "lower half";
  else zone = "below lower band";

  return {
    sma: Number(sma.toFixed(2)),
    upper_band: Number(upper.toFixed(2)),
    lower_band: Number(lower.toFixed(2)),
    percent_b: Number(percentB.toFixed(3)),
    zone,
  };
}

function computeHistoricalVol(closes: number[]) {
  if (closes.length < 5) return { volPct: null, volDollarYr: null };
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (returns.length - 1);
  const dailyStd = Math.sqrt(variance);
  const annualizedPct = dailyStd * Math.sqrt(252) * 100;
  const lastClose = closes[closes.length - 1];
  const dollarMove = dailyStd * Math.sqrt(365) * lastClose;
  return {
    volPct: Number(annualizedPct.toFixed(2)),
    volDollarYr: Number(dollarMove.toFixed(2)),
  };
}

// --- YAHOO & FINANCIAL DATA FETCHERS ---
const HTTP_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

let cachedYahooCookie: string | null = null;
let cachedYahooCrumb: string | null = null;
let yahooAuthPromise: Promise<{ cookie: string; crumb: string }> | null = null;

async function getYahooAuth(forceRefresh = false): Promise<{ cookie: string; crumb: string }> {
  if (!forceRefresh && cachedYahooCookie && cachedYahooCrumb) {
    return { cookie: cachedYahooCookie, crumb: cachedYahooCrumb };
  }

  if (yahooAuthPromise && !forceRefresh) {
    return yahooAuthPromise;
  }

  yahooAuthPromise = (async () => {
    try {
      const cookieRes = await fetch("https://fc.yahoo.com", {
        headers: HTTP_HEADERS,
      });
      const cookie = cookieRes.headers.get("set-cookie") || "";

      const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
        headers: {
          ...HTTP_HEADERS,
          Cookie: cookie,
        },
      });
      const crumb = await crumbRes.text();

      cachedYahooCookie = cookie;
      cachedYahooCrumb = crumb;
      return { cookie, crumb };
    } catch (err) {
      console.error("Failed to get Yahoo crumb/cookie:", err);
      return { cookie: cachedYahooCookie || "", crumb: cachedYahooCrumb || "" };
    } finally {
      yahooAuthPromise = null;
    }
  })();

  return yahooAuthPromise;
}

async function fetchYahooChart(ticker: string, range = "1y", interval = "1d") {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`;
    const res = await fetch(url, { headers: HTTP_HEADERS });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.chart?.result?.[0] || null;
  } catch (e) {
    console.error(`Error fetching chart for ${ticker}:`, e);
    return null;
  }
}

async function fetchYahooOptions(ticker: string, dateTimestamp?: number, retry = true): Promise<any> {
  try {
    const { cookie, crumb } = await getYahooAuth();
    let url = `https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(ticker)}`;
    const params = new URLSearchParams();
    if (crumb) params.set("crumb", crumb);
    if (dateTimestamp) params.set("date", String(dateTimestamp));
    const qs = params.toString();
    if (qs) url += `?${qs}`;

    const headers: Record<string, string> = {
      ...HTTP_HEADERS,
      Accept: "application/json",
    };
    if (cookie) headers["Cookie"] = cookie;

    const res = await fetch(url, { headers });
    if (res.status === 401 && retry) {
      await getYahooAuth(true);
      return fetchYahooOptions(ticker, dateTimestamp, false);
    }
    if (!res.ok) return null;
    const json = await res.json();
    return json?.optionChain?.result?.[0] || null;
  } catch (e) {
    console.error(`Error fetching options for ${ticker}:`, e);
    return null;
  }
}

async function fetchYahooQuoteSummary(ticker: string, retry = true): Promise<any> {
  try {
    const { cookie, crumb } = await getYahooAuth();
    let url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=financialData,defaultKeyStatistics,summaryDetail,upgradeDowngradeHistory`;
    if (crumb) url += `&crumb=${encodeURIComponent(crumb)}`;

    const headers: Record<string, string> = {
      ...HTTP_HEADERS,
      Accept: "application/json",
    };
    if (cookie) headers["Cookie"] = cookie;

    const res = await fetch(url, { headers });
    if (res.status === 401 && retry) {
      await getYahooAuth(true);
      return fetchYahooQuoteSummary(ticker, false);
    }
    if (!res.ok) return null;
    const json = await res.json();
    return json?.quoteSummary?.result?.[0] || null;
  } catch (e) {
    return null;
  }
}

async function fetchYahooNews(ticker: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&newsCount=10&quotesCount=0`;
    const res = await fetch(url, { headers: HTTP_HEADERS });
    if (!res.ok) return [];
    const json = await res.json();
    const news = json?.news || [];
    return news.map((item: any) => ({
      title: item.title || "",
      publisher: item.publisher || "Yahoo Finance",
      link: item.link || "",
      published_at: item.providerPublishTime
        ? new Date(item.providerPublishTime * 1000).toISOString().split("T")[0]
        : "",
    }));
  } catch (e) {
    return [];
  }
}

async function fetchStockTwits(ticker: string) {
  try {
    const url = `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(ticker)}.json`;
    const res = await fetch(url, { headers: HTTP_HEADERS });
    if (!res.ok) return null;
    const json = await res.json();
    const messages = json?.messages || [];
    let bullish = 0;
    let bearish = 0;
    for (const msg of messages) {
      const sentiment = msg?.entities?.sentiment?.basic;
      if (sentiment === "Bullish") bullish++;
      else if (sentiment === "Bearish") bearish++;
    }
    const total = bullish + bearish;
    if (total === 0) return null;
    return {
      bullish_pct: Number(((bullish / total) * 100).toFixed(1)),
      bearish_pct: Number(((bearish / total) * 100).toFixed(1)),
      sample_size: total,
    };
  } catch (e) {
    return null;
  }
}

// --- FULL TECHNICALS FETCHER ---
async function getTechnicalsForTicker(ticker: string) {
  const chart = await fetchYahooChart(ticker, "1y", "1d");
  const quoteSummary = await fetchYahooQuoteSummary(ticker);

  const meta = chart?.meta || {};
  const currentPrice = meta.regularMarketPrice || meta.chartPreviousClose || null;
  const fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh || null;
  const fiftyTwoWeekLow = meta.fiftyTwoWeekLow || null;

  const timestamps = chart?.timestamp || [];
  const rawCloses = chart?.indicators?.quote?.[0]?.close || [];
  const closes: number[] = [];
  let maxHigh = currentPrice || 0;
  for (let i = 0; i < rawCloses.length; i++) {
    if (rawCloses[i] !== null && rawCloses[i] !== undefined) {
      closes.push(rawCloses[i]);
      if (rawCloses[i] > maxHigh) maxHigh = rawCloses[i];
    }
  }

  const allTimeHigh = Math.max(maxHigh, fiftyTwoWeekHigh || 0);
  const distanceToAth = currentPrice && allTimeHigh ? ((currentPrice - allTimeHigh) / allTimeHigh) * 100 : null;
  const distanceTo52w = currentPrice && fiftyTwoWeekHigh ? ((currentPrice - fiftyTwoWeekHigh) / fiftyTwoWeekHigh) * 100 : null;

  const rsi = computeRsi(closes, 14);
  const bollinger = computeBollinger(closes, 20, 2.0);
  const histVol = computeHistoricalVol(closes);

  // Fibonacci
  let fibonacci = null;
  if (fiftyTwoWeekHigh && fiftyTwoWeekLow && fiftyTwoWeekHigh > fiftyTwoWeekLow) {
    const range = fiftyTwoWeekHigh - fiftyTwoWeekLow;
    fibonacci = {
      level_0: Number(fiftyTwoWeekLow.toFixed(2)),
      level_236: Number((fiftyTwoWeekLow + range * 0.236).toFixed(2)),
      level_382: Number((fiftyTwoWeekLow + range * 0.382).toFixed(2)),
      level_500: Number((fiftyTwoWeekLow + range * 0.5).toFixed(2)),
      level_618: Number((fiftyTwoWeekLow + range * 0.618).toFixed(2)),
      level_1000: Number(fiftyTwoWeekHigh.toFixed(2)),
    };
  }

  // Analyst data
  const finData = quoteSummary?.financialData || {};
  const targetMean = finData.targetMeanPrice?.raw || null;
  const analystCount = finData.numberOfAnalystOpinions?.raw || null;
  const analystUpside = targetMean && currentPrice ? ((targetMean - currentPrice) / currentPrice) * 100 : null;
  const marketCap = quoteSummary?.defaultKeyStatistics?.marketCap?.raw || finData.marketCap?.raw || null;

  // Implied volatility from options chain nearest ATM
  let impliedVol: number | null = null;
  try {
    const opt = await fetchYahooOptions(ticker);
    const puts = opt?.options?.[0]?.puts || [];
    if (puts.length > 0 && currentPrice) {
      const atmPut = puts.reduce((prev: any, curr: any) =>
        Math.abs(curr.strike - currentPrice) < Math.abs(prev.strike - currentPrice) ? curr : prev
      );
      if (atmPut?.impliedVolatility) {
        impliedVol = Number((atmPut.impliedVolatility * 100).toFixed(2));
      }
    }
  } catch (e) {}

  return {
    ticker,
    current_price: currentPrice ? Number(currentPrice.toFixed(2)) : null,
    market_cap: marketCap,
    fifty_two_week_high: fiftyTwoWeekHigh ? Number(fiftyTwoWeekHigh.toFixed(2)) : null,
    fifty_two_week_low: fiftyTwoWeekLow ? Number(fiftyTwoWeekLow.toFixed(2)) : null,
    all_time_high: allTimeHigh ? Number(allTimeHigh.toFixed(2)) : null,
    distance_to_ath_pct: distanceToAth !== null ? Number(distanceToAth.toFixed(2)) : null,
    distance_to_52w_high_pct: distanceTo52w !== null ? Number(distanceTo52w.toFixed(2)) : null,
    analyst_target_mean: targetMean ? Number(targetMean.toFixed(2)) : null,
    analyst_count: analystCount,
    analyst_upside_pct: analystUpside !== null ? Number(analystUpside.toFixed(2)) : null,
    rsi_14: rsi,
    bollinger,
    implied_volatility_pct: impliedVol,
    historical_volatility_pct: histVol.volPct,
    historical_volatility_dollar_yr: histVol.volDollarYr,
    fibonacci,
    next_earnings_date: quoteSummary?.summaryDetail?.earningsDate?.[0]?.fmt || null,
  };
}

// ==========================================
// API ROUTES
// ==========================================

// Health
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Watchlist endpoints
app.get("/api/watchlist", (req: Request, res: Response) => {
  res.json({ tickers: getWatchlist() });
});

app.post("/api/watchlist", (req: Request, res: Response) => {
  const { tickers } = req.body;
  if (Array.isArray(tickers)) {
    const clean = Array.from(new Set(tickers.map((t) => String(t).trim().toUpperCase()))).filter(Boolean);
    saveWatchlist(clean);
    res.json({ success: true, tickers: clean });
  } else {
    res.status(400).json({ error: "tickers array required" });
  }
});

// Universes
app.get("/api/universes", (req: Request, res: Response) => {
  res.json({
    universes: [
      { id: "watchlist", name: "My Watchlist", count: getWatchlist().length, tickers: getWatchlist() },
      { id: "qqq", name: "QQQ / Nasdaq-100", count: QQQ_CONSTITUENTS.length, tickers: QQQ_CONSTITUENTS },
      { id: "spy", name: "SPY / S&P 500 Top", count: SPY_CONSTITUENTS.length, tickers: SPY_CONSTITUENTS },
    ],
  });
});

// Technicals Screen
app.get("/api/technicals", async (req: Request, res: Response) => {
  try {
    const tickersParam = req.query.tickers as string;
    const tickers = tickersParam
      ? tickersParam.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean)
      : getWatchlist();

    const results = [];
    for (const t of tickers) {
      const data = await getTechnicalsForTicker(t);
      results.push(data);
    }

    res.json({ results });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Stock Fall Detector
app.get("/api/fall-detector", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const fallPct = parseFloat(req.query.fallPct as string) || 10.0;
    const minMarketCap = parseFloat(req.query.minMarketCap as string) || 1e10; // $10B default
    const tickersParam = req.query.tickers as string;
    const includeContext = req.query.noContext !== "true";
    const includeTechnicals = req.query.noTechnicals !== "true";

    const tickers = tickersParam
      ? tickersParam.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean)
      : QQQ_CONSTITUENTS;

    const fallenStocks: any[] = [];

    for (const ticker of tickers) {
      const chart = await fetchYahooChart(ticker, "3mo", "1d");
      if (!chart) continue;

      const timestamps = chart.timestamp || [];
      const closes = chart.indicators?.quote?.[0]?.close || [];
      const pairs: Array<[number, number]> = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] !== null && closes[i] !== undefined) {
          pairs.push([timestamps[i], closes[i]]);
        }
      }
      if (pairs.length < 2) continue;

      const cutoff = pairs[pairs.length - 1][0] - days * 86400;
      let window = pairs.filter((p) => p[0] >= cutoff);
      if (window.length < 2) window = pairs.slice(-2);

      const startPrice = window[0][1];
      const endPrice = window[window.length - 1][1];
      const pctChange = ((endPrice - startPrice) / startPrice) * 100;

      if (pctChange <= -fallPct) {
        const quoteSummary = await fetchYahooQuoteSummary(ticker);
        const shares = quoteSummary?.defaultKeyStatistics?.sharesOutstanding?.raw || 1e9;
        const marketCapBefore = startPrice * shares;

        if (marketCapBefore >= minMarketCap) {
          const startDateStr = new Date(window[0][0] * 1000).toISOString().split("T")[0];
          const endDateStr = new Date(window[window.length - 1][0] * 1000).toISOString().split("T")[0];

          let technicalsData = undefined;
          if (includeTechnicals) {
            technicalsData = await getTechnicalsForTicker(ticker);
          }

          let contextData = undefined;
          if (includeContext) {
            const headlines = await fetchYahooNews(ticker);
            const social = await fetchStockTwits(ticker);

            const finData = quoteSummary?.financialData || {};
            const meanTarget = finData.targetMeanPrice?.raw || null;
            const numAnalysts = finData.numberOfAnalystOpinions?.raw || null;
            const recommendation = finData.recommendationKey || null;
            const upsidePct = meanTarget && endPrice ? ((meanTarget - endPrice) / endPrice) * 100 : null;

            const recentActions = (quoteSummary?.upgradeDowngradeHistory?.history || []).slice(0, 3).map((item: any) => ({
              firm: item.firm || "",
              action: item.action || "",
              from_grade: item.fromGrade || "",
              to_grade: item.toGrade || "",
              price_target: item.currentPriceTarget || null,
              date: item.epochGradeDate ? new Date(item.epochGradeDate * 1000).toISOString().split("T")[0] : "",
            }));

            contextData = {
              headlines,
              social: social || undefined,
              analyst: {
                recommendation,
                mean_target_price: meanTarget,
                num_analysts: numAnalysts,
                upside_pct: upsidePct ? Number(upsidePct.toFixed(2)) : null,
                recent_actions: recentActions,
              },
            };
          }

          fallenStocks.push({
            ticker,
            start_price: Number(startPrice.toFixed(2)),
            end_price: Number(endPrice.toFixed(2)),
            pct_change: Number(pctChange.toFixed(2)),
            start_date: startDateStr,
            end_date: endDateStr,
            shares_outstanding: shares,
            market_cap_before: marketCapBefore,
            technicals: technicalsData,
            context: contextData,
          });
        }
      }
    }

    fallenStocks.sort((a, b) => a.pct_change - b.pct_change);
    res.json({
      days,
      fallPct,
      minMarketCap,
      scanned_count: tickers.length,
      fallen_count: fallenStocks.length,
      results: fallenStocks,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Put Options Annualized Return Scanner
app.post("/api/options-scan", async (req: Request, res: Response) => {
  try {
    const {
      tickers,
      minDays = 0,
      maxDays = 365,
      strikeMode = "band", // 'band' | 'single' | 'bollinger'
      singleStrike = null,
      singleStrikeType = "dollar", // 'dollar' | 'pct'
      singleStrikePct = 85.0,
      pctLow = 30.0,
      pctHigh = 100.0,
      bollingerPeriod = 20,
      bollingerStd = 2.0,
      noMargin = false,
      marginShockPct = 15.0,
      marginFloor = 0.375,
      marginFloorPct = 5.0,
      marginPremiumBufferPct = 0.0,
      noFallback = false,
    } = req.body;

    const tickerList: string[] = (
      Array.isArray(tickers) && tickers.length > 0 ? tickers : getWatchlist()
    ).map((t: string) => String(t).trim().toUpperCase());

    const allRecords: any[] = [];
    const summaryList: any[] = [];
    const today = new Date();

    for (const ticker of tickerList) {
      const optData = await fetchYahooOptions(ticker);
      if (!optData) continue;

      const meta = optData.quote || {};
      const currentPrice = meta.regularMarketPrice || meta.ask || meta.bid || 0;
      if (!currentPrice || currentPrice <= 0) continue;

      // Compute underlying stock RSI(14) and 20-period Bollinger Bands
      const chart = await fetchYahooChart(ticker, "3mo", "1d");
      const closes: number[] = (chart?.indicators?.quote?.[0]?.close || []).filter(
        (c: any) => c !== null && c !== undefined
      );
      const rsi = computeRsi(closes, 14);
      const bollinger = computeBollinger(closes, Number(bollingerPeriod) || 20, Number(bollingerStd) || 2.0);

      let targetStrike: number | null = null;
      if (strikeMode === "single") {
        if (singleStrikeType === "pct" && singleStrikePct) {
          targetStrike = (currentPrice * Number(singleStrikePct)) / 100;
        } else if (singleStrike !== null && singleStrike !== undefined && !isNaN(Number(singleStrike))) {
          targetStrike = Number(singleStrike);
        }
      } else if (strikeMode === "bollinger") {
        if (bollinger) targetStrike = bollinger.lower_band;
      }

      const rawExpirations: number[] = optData.expirationDates || [];
      const validExpirations: Array<{ timestamp: number; dateStr: string; dte: number }> = [];

      for (const expTs of rawExpirations) {
        const expDate = new Date(expTs * 1000);
        const diffTime = expDate.getTime() - today.getTime();
        const dte = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (dte >= minDays && dte <= maxDays) {
          const dateStr = expDate.toISOString().split("T")[0];
          validExpirations.push({ timestamp: expTs, dateStr, dte });
        }
      }

      for (const exp of validExpirations) {
        let chain = optData;
        if (optData.expirationDates?.[0] !== exp.timestamp) {
          const fetched = await fetchYahooOptions(ticker, exp.timestamp);
          if (fetched) chain = fetched;
        }

        const puts: any[] = chain?.options?.[0]?.puts || [];
        if (puts.length === 0) continue;

        let selectedPuts: any[] = [];
        if (targetStrike !== null) {
          // Snap to closest listed strike
          const nearest = puts.reduce((prev, curr) =>
            Math.abs(curr.strike - targetStrike!) < Math.abs(prev.strike - targetStrike!) ? curr : prev
          );
          if (nearest) selectedPuts = [nearest];
        } else {
          const low = (currentPrice * pctLow) / 100;
          const high = (currentPrice * pctHigh) / 100;
          selectedPuts = puts.filter((p) => p.strike >= low && p.strike <= high);
        }

        for (const put of selectedPuts) {
          const strike = put.strike;
          let bid = put.bid || 0;
          let ask = put.ask || 0;
          const last = put.lastPrice || 0;

          let bidFallback = false;
          let askFallback = false;
          if (bid === 0 && last > 0 && !noFallback) {
            bid = last;
            bidFallback = true;
          }
          if (ask === 0 && last > 0 && !noFallback) {
            ask = last;
            askFallback = true;
          }

          const moneyness = (strike / currentPrice) * 100;
          const dte = Math.max(exp.dte, 1);

          // Portfolio margin basis
          const capitalBasisPM = estimatePortfolioMargin(
            currentPrice,
            strike,
            bid,
            marginShockPct,
            marginFloor,
            marginFloorPct,
            marginPremiumBufferPct
          );
          const capitalBasisCashSecured = strike;

          const annualReturnPM = (bid / capitalBasisPM) * (365.0 / dte) * 100;
          const annualReturnCash = (bid / capitalBasisCashSecured) * (365.0 / dte) * 100;

          const chosenCapitalBasis = noMargin ? capitalBasisCashSecured : capitalBasisPM;
          const chosenAnnualReturn = noMargin ? annualReturnCash : annualReturnPM;

          let strikeBbPos: any = null;
          if (bollinger) {
            const isBelow = strike < bollinger.lower_band;
            const diff = Number((strike - bollinger.lower_band).toFixed(2));
            const pctFromLower = Number(((strike - bollinger.lower_band) / bollinger.lower_band * 100).toFixed(1));
            let zoneLabel = "Below Lower Band";
            let zoneKey = "below_lower";
            if (strike >= bollinger.upper_band) {
              zoneLabel = "Above Upper Band";
              zoneKey = "above_upper";
            } else if (strike >= bollinger.sma) {
              zoneLabel = "Between Mid & Upper Band";
              zoneKey = "upper_half";
            } else if (strike >= bollinger.lower_band) {
              zoneLabel = "Between Lower & Mid Band";
              zoneKey = "lower_half";
            }

            strikeBbPos = {
              zone: zoneKey,
              zone_label: zoneLabel,
              is_below_lower: isBelow,
              diff_from_lower: diff,
              pct_from_lower: pctFromLower,
              lower_band: bollinger.lower_band,
              sma: bollinger.sma,
              upper_band: bollinger.upper_band,
            };
          }

          allRecords.push({
            ticker,
            expiration: exp.dateStr,
            days_to_expiration: dte,
            strike,
            current_price: Number(currentPrice.toFixed(2)),
            moneyness_pct: Number(moneyness.toFixed(2)),
            bid: Number(bid.toFixed(2)),
            ask: Number(ask.toFixed(2)),
            last_price: Number(last.toFixed(2)),
            volume: put.volume || 0,
            open_interest: put.openInterest || 0,
            implied_volatility: Number(((put.impliedVolatility || 0) * 100).toFixed(2)),
            capital_basis: Number(chosenCapitalBasis.toFixed(2)),
            capital_basis_cash_secured: Number(capitalBasisCashSecured.toFixed(2)),
            annualized_return_pct: Number(chosenAnnualReturn.toFixed(2)),
            annualized_return_pct_cash_secured: Number(annualReturnCash.toFixed(2)),
            bid_used_fallback: bidFallback,
            ask_used_fallback: askFallback,
            market_cap: meta.marketCap || undefined,
            rsi_14: rsi,
            bollinger: bollinger,
            strike_bollinger_position: strikeBbPos,
          });
        }
      }

      summaryList.push({
        ticker,
        current_price: currentPrice,
        market_cap: meta.marketCap,
        rsi_14: rsi,
        bollinger: bollinger,
      });
    }

    allRecords.sort((a, b) => b.annualized_return_pct - a.annualized_return_pct);

    res.json({
      total_records: allRecords.length,
      records: allRecords,
      summary: summaryList,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Option Chain with Black-Scholes Greeks
app.get("/api/option-chain", async (req: Request, res: Response) => {
  try {
    const ticker = (req.query.ticker as string || "QQQ").toUpperCase();
    const expirationIdx = parseInt(req.query.expirationIndex as string) || 0;
    const requestedExpDate = req.query.expiration as string;

    const optData = await fetchYahooOptions(ticker);
    if (!optData) {
      return res.status(404).json({ error: `No options data found for ${ticker}` });
    }

    const rawExpirations: number[] = optData.expirationDates || [];
    if (rawExpirations.length === 0) {
      return res.status(404).json({ error: `No expiration dates for ${ticker}` });
    }

    const expDates = rawExpirations.map((ts) => new Date(ts * 1000).toISOString().split("T")[0]);
    let targetExpTs = rawExpirations[Math.min(expirationIdx, rawExpirations.length - 1)];

    if (requestedExpDate && expDates.includes(requestedExpDate)) {
      const idx = expDates.indexOf(requestedExpDate);
      targetExpTs = rawExpirations[idx];
    }

    const chain =
      targetExpTs === rawExpirations[0]
        ? optData
        : (await fetchYahooOptions(ticker, targetExpTs)) || optData;

    const currentPrice = chain.quote?.regularMarketPrice || 100;
    const expDateStr = new Date(targetExpTs * 1000).toISOString().split("T")[0];
    const today = new Date();
    const expDate = new Date(targetExpTs * 1000);
    const dte = Math.max(Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)), 1);

    const rawCalls = chain.options?.[0]?.calls || [];
    const rawPuts = chain.options?.[0]?.puts || [];

    const calls = rawCalls.map((c: any) => {
      const greeks = calculateGreeks(c.strike, currentPrice, c.impliedVolatility || 0.3, dte, true);
      return {
        strike: c.strike,
        contractSymbol: c.contractSymbol,
        lastPrice: c.lastPrice || 0,
        bid: c.bid || 0,
        ask: c.ask || 0,
        volume: c.volume || 0,
        openInterest: c.openInterest || 0,
        impliedVolatility: Number(((c.impliedVolatility || 0) * 100).toFixed(2)),
        inTheMoney: c.inTheMoney || false,
        ...greeks,
      };
    });

    const puts = rawPuts.map((p: any) => {
      const greeks = calculateGreeks(p.strike, currentPrice, p.impliedVolatility || 0.3, dte, false);
      return {
        strike: p.strike,
        contractSymbol: p.contractSymbol,
        lastPrice: p.lastPrice || 0,
        bid: p.bid || 0,
        ask: p.ask || 0,
        volume: p.volume || 0,
        openInterest: p.openInterest || 0,
        impliedVolatility: Number(((p.impliedVolatility || 0) * 100).toFixed(2)),
        inTheMoney: p.inTheMoney || false,
        ...greeks,
      };
    });

    // Technicals for underlying stock
    const chart = await fetchYahooChart(ticker, "3mo", "1d");
    const closes: number[] = (chart?.indicators?.quote?.[0]?.close || []).filter(
      (c: any) => c !== null && c !== undefined
    );
    const rsi = computeRsi(closes, 14);
    const bollinger = computeBollinger(closes, 20, 2.0);

    res.json({
      ticker,
      current_price: currentPrice,
      expirations: expDates,
      selected_expiration: expDateStr,
      days_to_expiration: dte,
      calls,
      puts,
      rsi_14: rsi,
      bollinger,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Premium vs Strike Curves & Analysis
app.get("/api/premium-curves", async (req: Request, res: Response) => {
  try {
    const ticker = (req.query.ticker as string || "QQQ").toUpperCase();
    const optionType = (req.query.optionType as string || "put").toLowerCase();
    const priceType = (req.query.priceType as string || "bid").toLowerCase();
    const numExpirations = parseInt(req.query.numExpirations as string) || 3;
    const requestedExp = req.query.expiration as string;
    const strikeRange = (req.query.strikeRange as string) || "20-150";
    const noStrikeRange = req.query.noStrikeRange === "true";
    const noFallback = req.query.noFallback === "true";

    const optData = await fetchYahooOptions(ticker);
    if (!optData) {
      return res.status(404).json({ error: `No options data for ${ticker}` });
    }

    const currentPrice = optData.quote?.regularMarketPrice || null;
    const rawExpirations: number[] = optData.expirationDates || [];
    const expDateStrs = rawExpirations.map((ts) => new Date(ts * 1000).toISOString().split("T")[0]);

    // Calculate RSI and Bollinger Bands for ticker
    const chart = await fetchYahooChart(ticker, "3mo", "1d");
    const closes: number[] = (chart?.indicators?.quote?.[0]?.close || []).filter(
      (c: any) => c !== null && c !== undefined
    );
    const rsi = computeRsi(closes, 14);
    const bollinger = computeBollinger(closes, 20, 2.0);

    let chosenExpStrs: string[] = [];
    if (requestedExp) {
      chosenExpStrs = [requestedExp];
    } else {
      chosenExpStrs = expDateStrs.slice(0, numExpirations);
    }

    let lowPct = 20, highPct = 150;
    if (!noStrikeRange && strikeRange) {
      const parts = strikeRange.replace("%", "").split("-");
      if (parts.length === 2) {
        lowPct = parseFloat(parts[0]) || 20;
        highPct = parseFloat(parts[1]) || 150;
      }
    }

    const minStrike = currentPrice && !noStrikeRange ? (currentPrice * lowPct) / 100 : 0;
    const maxStrike = currentPrice && !noStrikeRange ? (currentPrice * highPct) / 100 : 1e9;

    const records: any[] = [];

    for (const expStr of chosenExpStrs) {
      const idx = expDateStrs.indexOf(expStr);
      if (idx === -1) continue;
      const ts = rawExpirations[idx];

      const chain =
        ts === rawExpirations[0] ? optData : (await fetchYahooOptions(ticker, ts)) || optData;

      const contracts = optionType === "call" ? chain.options?.[0]?.calls || [] : chain.options?.[0]?.puts || [];

      for (const row of contracts) {
        const strike = row.strike;
        if (strike < minStrike || strike > maxStrike) continue;

        const bid = row.bid || 0;
        const ask = row.ask || 0;
        const last = row.lastPrice || 0;

        let premium = priceType === "ask" ? ask : bid;
        let usedFallback = false;

        if (bid === 0 && ask === 0 && last > 0 && !noFallback) {
          premium = last;
          usedFallback = true;
        }

        let strikeBbPos: any = null;
        if (bollinger) {
          const isBelow = strike < bollinger.lower_band;
          const diff = Number((strike - bollinger.lower_band).toFixed(2));
          const pctFromLower = Number(((strike - bollinger.lower_band) / bollinger.lower_band * 100).toFixed(1));
          let zoneLabel = "Below Lower Band";
          let zoneKey = "below_lower";
          if (strike >= bollinger.upper_band) {
            zoneLabel = "Above Upper Band";
            zoneKey = "above_upper";
          } else if (strike >= bollinger.sma) {
            zoneLabel = "Between Mid & Upper Band";
            zoneKey = "upper_half";
          } else if (strike >= bollinger.lower_band) {
            zoneLabel = "Between Lower & Mid Band";
            zoneKey = "lower_half";
          }

          strikeBbPos = {
            zone: zoneKey,
            zone_label: zoneLabel,
            is_below_lower: isBelow,
            diff_from_lower: diff,
            pct_from_lower: pctFromLower,
            lower_band: bollinger.lower_band,
            sma: bollinger.sma,
            upper_band: bollinger.upper_band,
          };
        }

        records.push({
          expiration: expStr,
          strike,
          premium: Number(premium.toFixed(2)),
          bid: Number(bid.toFixed(2)),
          ask: Number(ask.toFixed(2)),
          lastPrice: Number(last.toFixed(2)),
          volume: row.volume || 0,
          openInterest: row.openInterest || 0,
          used_fallback: usedFallback,
          premium_to_strike: Number((premium / strike).toFixed(4)),
          rsi_14: rsi,
          bollinger: bollinger,
          strike_bollinger_position: strikeBbPos,
        });
      }
    }

    records.sort((a, b) => (a.expiration === b.expiration ? a.strike - b.strike : a.expiration.localeCompare(b.expiration)));

    // Highest ratio point
    let highestRatioPoint = null;
    if (records.length > 0) {
      highestRatioPoint = records.reduce((prev, curr) =>
        curr.premium_to_strike > prev.premium_to_strike ? curr : prev
      );
    }

    // Steepest slope per expiration
    const steepestSlopes: any[] = [];
    for (const exp of chosenExpStrs) {
      const sub = records.filter((r) => r.expiration === exp);
      let bestSlope: any = null;
      for (let i = 0; i < sub.length - 1; i++) {
        const a = sub[i];
        const b = sub[i + 1];
        const dStrike = b.strike - a.strike;
        if (dStrike <= 0) continue;
        const slope = (b.premium - a.premium) / dStrike;
        if (!bestSlope || slope > bestSlope.slope) {
          bestSlope = {
            expiration: exp,
            strike_a: a.strike,
            strike_b: b.strike,
            premium_a: a.premium,
            premium_b: b.premium,
            slope: Number(slope.toFixed(4)),
          };
        }
      }
      if (bestSlope) steepestSlopes.push(bestSlope);
    }

    // 20-bin widest premium jump
    const widestBins: any[] = [];
    if (currentPrice) {
      const numBins = 20;
      const binWidth = currentPrice / numBins;
      for (const exp of chosenExpStrs) {
        const sub = records.filter((r) => r.expiration === exp);
        let bestBin: any = null;
        for (let i = 0; i < numBins; i++) {
          const lo = i * binWidth;
          const hi = i === numBins - 1 ? currentPrice : (i + 1) * binWidth;
          const inBin = sub.filter((r) => r.strike >= lo && (i === numBins - 1 ? r.strike <= hi : r.strike < hi));
          if (inBin.length >= 2) {
            const first = inBin[0];
            const last = inBin[inBin.length - 1];
            const diff = last.premium - first.premium;
            if (!bestBin || diff > bestBin.diff) {
              bestBin = {
                expiration: exp,
                bin_lo: Number(lo.toFixed(2)),
                bin_hi: Number(hi.toFixed(2)),
                strike_lo: first.strike,
                strike_hi: last.strike,
                premium_lo: first.premium,
                premium_hi: last.premium,
                diff: Number(diff.toFixed(2)),
              };
            }
          }
        }
        if (bestBin) widestBins.push(bestBin);
      }
    }

    // Gap markers between consecutive pairs
    const gapMarkers: any[] = [];
    if (chosenExpStrs.length >= 2) {
      for (let i = 0; i < chosenExpStrs.length - 1; i++) {
        const expA = chosenExpStrs[i];
        const expB = chosenExpStrs[i + 1];
        const subA = records.filter((r) => r.expiration === expA);
        const subB = records.filter((r) => r.expiration === expB);

        const strikesA = new Map(subA.map((r) => [r.strike, r.premium]));
        const commonGaps: Array<{ strike: number; gap: number; pA: number; pB: number }> = [];

        for (const item of subB) {
          if (strikesA.has(item.strike)) {
            const pA = strikesA.get(item.strike)!;
            const pB = item.premium;
            commonGaps.push({
              strike: item.strike,
              gap: Math.abs(pB - pA),
              pA,
              pB,
            });
          }
        }

        if (commonGaps.length > 0) {
          const widest = commonGaps.reduce((prev, curr) => (curr.gap > prev.gap ? curr : prev));
          gapMarkers.push({
            type: "widest",
            exp_a: expA,
            exp_b: expB,
            strike: widest.strike,
            gap: Number(widest.gap.toFixed(2)),
            low_premium: Math.min(widest.pA, widest.pB),
            high_premium: Math.max(widest.pA, widest.pB),
            low_expiration: widest.pA <= widest.pB ? expA : expB,
            high_expiration: widest.pA <= widest.pB ? expB : expA,
          });

          const nonZero = commonGaps.filter((g) => g.gap > 0);
          if (nonZero.length > 1) {
            const narrowest = nonZero.reduce((prev, curr) => (curr.gap < prev.gap ? curr : prev));
            if (narrowest.strike !== widest.strike) {
              gapMarkers.push({
                type: "narrowest",
                exp_a: expA,
                exp_b: expB,
                strike: narrowest.strike,
                gap: Number(narrowest.gap.toFixed(2)),
                low_premium: Math.min(narrowest.pA, narrowest.pB),
                high_premium: Math.max(narrowest.pA, narrowest.pB),
                low_expiration: narrowest.pA <= narrowest.pB ? expA : expB,
                high_expiration: narrowest.pA <= narrowest.pB ? expB : expA,
              });
            }
          }
        }
      }
    }

    res.json({
      ticker,
      current_price: currentPrice,
      expirations: chosenExpStrs,
      records,
      highest_ratio_point: highestRatioPoint,
      steepest_slopes: steepestSlopes,
      widest_bins: widestBins,
      gap_markers: gapMarkers,
      rsi_14: rsi,
      bollinger: bollinger,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Premium vs Expiration Date given a Target Strike Price
app.get("/api/premium-vs-expiration", async (req: Request, res: Response) => {
  try {
    const ticker = ((req.query.ticker as string) || "NVDA").toUpperCase();
    const optionType = ((req.query.optionType as string) || "put").toLowerCase();
    const priceType = ((req.query.priceType as string) || "bid").toLowerCase();
    const months = parseInt(req.query.months as string) || 12;
    const reqStrike = req.query.strike ? parseFloat(req.query.strike as string) : null;
    const reqPct = req.query.pctOfPrice ? parseFloat(req.query.pctOfPrice as string) : null;
    const noFallback = req.query.noFallback === "true";

    const optData = await fetchYahooOptions(ticker);
    if (!optData) {
      return res.status(404).json({ error: `No options data found for ${ticker}` });
    }

    const currentPrice = optData.quote?.regularMarketPrice || null;
    if (!currentPrice) {
      return res.status(404).json({ error: `Unable to get current price for ${ticker}` });
    }

    // Compute RSI & Bollinger for underlying stock
    const chart = await fetchYahooChart(ticker, "3mo", "1d");
    const closes: number[] = (chart?.indicators?.quote?.[0]?.close || []).filter(
      (c: any) => c !== null && c !== undefined
    );
    const rsi = computeRsi(closes, 14);
    const bollinger = computeBollinger(closes, 20, 2.0);

    let targetStrike = reqStrike;
    if (targetStrike === null && reqPct !== null) {
      targetStrike = (currentPrice * reqPct) / 100;
    }
    if (targetStrike === null) {
      // Default to 85% of spot price
      targetStrike = currentPrice * 0.85;
    }

    const rawExpirations: number[] = optData.expirationDates || [];
    const today = new Date();
    const maxDays = months * 30.5;

    const validExpirations: Array<{ timestamp: number; dateStr: string; dte: number }> = [];
    for (const expTs of rawExpirations) {
      const expDate = new Date(expTs * 1000);
      const diffTime = expDate.getTime() - today.getTime();
      const dte = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (dte >= 0 && dte <= maxDays) {
        const dateStr = expDate.toISOString().split("T")[0];
        validExpirations.push({ timestamp: expTs, dateStr, dte });
      }
    }

    const points: any[] = [];

    for (const exp of validExpirations) {
      const chain =
        exp.timestamp === rawExpirations[0]
          ? optData
          : (await fetchYahooOptions(ticker, exp.timestamp)) || optData;

      const contracts = optionType === "call" ? chain.options?.[0]?.calls || [] : chain.options?.[0]?.puts || [];
      if (contracts.length === 0) continue;

      // Find nearest listed strike to targetStrike
      const nearest = contracts.reduce((prev: any, curr: any) =>
        Math.abs(curr.strike - targetStrike!) < Math.abs(prev.strike - targetStrike!) ? curr : prev
      );

      if (!nearest) continue;

      const bid = nearest.bid || 0;
      const ask = nearest.ask || 0;
      const last = nearest.lastPrice || 0;

      let premium = priceType === "ask" ? ask : bid;
      let usedFallback = false;
      if (bid === 0 && ask === 0 && last > 0 && !noFallback) {
        premium = last;
        usedFallback = true;
      }

      const dte = Math.max(1, exp.dte);
      const marginBasis = estimatePortfolioMargin(currentPrice, nearest.strike, premium, 15.0, 0.375, 5.0, 0.0);
      const annReturnMargin = ((premium / marginBasis) * (365 / dte)) * 100;
      const annReturnCashSecured = ((premium / nearest.strike) * (365 / dte)) * 100;

      let strikeBbPos: any = null;
      if (bollinger) {
        const isBelow = nearest.strike < bollinger.lower_band;
        const diff = Number((nearest.strike - bollinger.lower_band).toFixed(2));
        const pctFromLower = Number(((nearest.strike - bollinger.lower_band) / bollinger.lower_band * 100).toFixed(1));
        let zoneLabel = "Below Lower Band";
        let zoneKey = "below_lower";
        if (nearest.strike >= bollinger.upper_band) {
          zoneLabel = "Above Upper Band";
          zoneKey = "above_upper";
        } else if (nearest.strike >= bollinger.sma) {
          zoneLabel = "Between Mid & Upper Band";
          zoneKey = "upper_half";
        } else if (nearest.strike >= bollinger.lower_band) {
          zoneLabel = "Between Lower & Mid Band";
          zoneKey = "lower_half";
        }

        strikeBbPos = {
          zone: zoneKey,
          zone_label: zoneLabel,
          is_below_lower: isBelow,
          diff_from_lower: diff,
          pct_from_lower: pctFromLower,
          lower_band: bollinger.lower_band,
          sma: bollinger.sma,
          upper_band: bollinger.upper_band,
        };
      }

      points.push({
        expiration: exp.dateStr,
        dte,
        target_strike: Number(targetStrike.toFixed(2)),
        snapped_strike: nearest.strike,
        strike_diff: Number((nearest.strike - targetStrike).toFixed(2)),
        moneyness_pct: Number(((nearest.strike / currentPrice) * 100).toFixed(2)),
        premium: Number(premium.toFixed(2)),
        bid: Number(bid.toFixed(2)),
        ask: Number(ask.toFixed(2)),
        last_price: Number(last.toFixed(2)),
        volume: nearest.volume || 0,
        open_interest: nearest.openInterest || 0,
        implied_volatility: nearest.impliedVolatility ? Number((nearest.impliedVolatility * 100).toFixed(2)) : 0,
        used_fallback: usedFallback,
        capital_basis_margin: Number(marginBasis.toFixed(2)),
        annualized_return_margin: Number(annReturnMargin.toFixed(2)),
        annualized_return_cash_secured: Number(annReturnCashSecured.toFixed(2)),
        rsi_14: rsi,
        bollinger: bollinger,
        strike_bollinger_position: strikeBbPos,
      });
    }

    points.sort((a, b) => a.dte - b.dte);

    // Calculate knee of curve (point of highest slope deceleration)
    let kneePoint: any = null;
    if (points.length >= 3) {
      let maxSlopeDrop = -Infinity;
      for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const next = points[i + 1];

        const slope1 = (curr.premium - prev.premium) / Math.max(1, curr.dte - prev.dte);
        const slope2 = (next.premium - curr.premium) / Math.max(1, next.dte - curr.dte);
        const drop = slope1 - slope2;

        if (drop > maxSlopeDrop && slope1 > 0) {
          maxSlopeDrop = drop;
          kneePoint = curr;
        }
      }
    }

    res.json({
      ticker,
      current_price: currentPrice,
      target_strike: Number(targetStrike.toFixed(2)),
      target_strike_pct: Number(((targetStrike / currentPrice) * 100).toFixed(1)),
      option_type: optionType,
      price_type: priceType,
      points,
      knee_point: kneePoint,
      rsi_14: rsi,
      bollinger: bollinger,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// SEC EDGAR Earnings Report
let secTickerMapCache: Record<string, number> | null = null;

async function getSecTickerCikMap() {
  if (secTickerMapCache) return secTickerMapCache;
  try {
    const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
      headers: { "User-Agent": "muthu.vela@gmail.com StockRelated/1.0" },
    });
    if (!res.ok) return {};
    const data: any = await res.json();
    const map: Record<string, number> = {};
    for (const key of Object.keys(data)) {
      const row = data[key];
      if (row?.ticker && row?.cik_str) {
        map[row.ticker.toUpperCase()] = row.cik_str;
      }
    }
    secTickerMapCache = map;
    return map;
  } catch (e) {
    console.error("SEC CIK map fetch error:", e);
    return {};
  }
}

// --- SEC DOCUMENT FETCHING & GEMINI SUMMARIZATION ---
async function fetchSecDocumentText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "muthu.vela@gmail.com StockRelated/1.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
      },
    });

    if (!res.ok) {
      return `[SEC.gov returned HTTP ${res.status}: ${res.statusText}]`;
    }

    const raw = await res.text();
    if (!raw || raw.trim().length === 0) {
      return "[Empty document retrieved from SEC.gov]";
    }

    // Strip HTML scripts, styles, XML headers, tags, and decode common entities
    let cleaned = raw
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&#\d+;/g, " ")
      .replace(/\r\n|\r|\n/g, "\n")
      .replace(/\t/g, " ")
      .replace(/ +/g, " ")
      .replace(/\n\s*\n\s*\n+/g, "\n\n")
      .trim();

    // Limit to 45,000 characters to ensure fast inference while capturing key disclosures
    if (cleaned.length > 45000) {
      cleaned = cleaned.slice(0, 45000) + "\n\n[...Truncated for AI analysis...]";
    }

    return cleaned;
  } catch (e: any) {
    console.error("Error fetching SEC document text:", e);
    return `[Failed to fetch document from SEC: ${e.message}]`;
  }
}

async function summarizeSecFilingWithGemini(params: {
  ticker: string;
  form: string;
  date: string;
  url: string;
  epsData?: any;
  revData?: any;
}) {
  const cacheKey = `${params.ticker}_${params.form}_${params.date}_${params.url}`;
  if (secSummaryCache.has(cacheKey)) {
    return secSummaryCache.get(cacheKey);
  }

  const docText = await fetchSecDocumentText(params.url);
  const ai = getGenAI();

  const prompt = `Analyze this official SEC EDGAR ${params.form} filing for ${params.ticker} filed on ${params.date}.
URL: ${params.url}

Latest XBRL Reported Facts:
- EPS: ${params.epsData ? `$${params.epsData.value} (${params.epsData.fiscal_period} ${params.epsData.fiscal_year})` : "N/A"}
- Revenue: ${params.revData ? `$${params.revData.value} (${params.revData.fiscal_period} ${params.revData.fiscal_year})` : "N/A"}

SEC Document Text Content:
${docText}

Provide an executive, high-density financial and strategic breakdown of this ${params.form} submission. Focus on:
1. Core message & why this filing matters to equity and options traders.
2. Financial numbers (Revenue, EPS, guidance changes, operating margins, segment growth).
3. Material events, major contracts, leadership changes, legal updates, or financing details.
4. Risk factors and macroeconomic commentary.
5. Implications for implied volatility, downside put options risk, and sentiment.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an elite Wall Street securities analyst and SEC filing forensic specialist. You produce precise, insightful, and actionable breakdowns of 10-K, 10-Q, and 8-K filings with zero fluff.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "Short descriptive headline of the filing (e.g. Q3 2025 Earnings Release & Record Data Center Revenue)",
            },
            summary: {
              type: Type.STRING,
              description: "2-3 sentence executive synthesis of the filing's core findings and market significance.",
            },
            sentiment: {
              type: Type.STRING,
              description: "Overall tone: Bullish, Neutral, Bearish, or Mixed",
            },
            key_takeaways: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 to 6 high-impact takeaway bullet points with specific figures and facts.",
            },
            financial_highlights: {
              type: Type.OBJECT,
              properties: {
                revenue: { type: Type.STRING, description: "Revenue metric or comparison" },
                net_income_or_eps: { type: Type.STRING, description: "EPS or net income figure" },
                guidance: { type: Type.STRING, description: "Forward-looking guidance provided" },
                margins_or_growth: { type: Type.STRING, description: "Operating margins or growth rate" },
              },
            },
            material_events: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Notable corporate developments, mergers, agreements, or debt/capital actions.",
            },
            risk_factors: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Key risks highlighted in the filing or macro uncertainties.",
            },
            options_implications: {
              type: Type.STRING,
              description: "Analysis of market impact, implied volatility crush/expansion, and put-selling margin safety.",
            },
          },
          required: ["title", "summary", "sentiment", "key_takeaways", "options_implications"],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    const result = {
      ticker: params.ticker,
      form: params.form,
      date: params.date,
      url: params.url,
      title: parsed.title || `${params.ticker} ${params.form} Filing (${params.date})`,
      summary: parsed.summary || "Summary generated from SEC EDGAR disclosure.",
      sentiment: (parsed.sentiment as any) || "Neutral",
      key_takeaways: parsed.key_takeaways || [],
      financial_highlights: parsed.financial_highlights || {},
      material_events: parsed.material_events || [],
      risk_factors: parsed.risk_factors || [],
      options_implications: parsed.options_implications || "",
      generated_at: new Date().toISOString(),
    };

    secSummaryCache.set(cacheKey, result);
    return result;
  } catch (err: any) {
    console.error(`Gemini summarization error for ${params.ticker} ${params.form}:`, err);
    return {
      ticker: params.ticker,
      form: params.form,
      date: params.date,
      url: params.url,
      title: `${params.ticker} ${params.form} Filing Analysis`,
      summary: `Failed to generate AI summary: ${err.message}`,
      sentiment: "Neutral",
      key_takeaways: ["Error during model generation. Please try again."],
      options_implications: "N/A",
      generated_at: new Date().toISOString(),
    };
  }
}

// ==========================================
// PUT RECOMMENDATIONS ACROSS RISK TIERS
// ==========================================

function computePutRecommendationScore(
  tier: "least_risk" | "medium_risk" | "high_risk",
  annualMarginReturn: number,
  pop: number,
  cushionPct: number,
  dte: number,
  iv: number,
  hv: number,
  rsi: number | null,
  isBelowBollingerLower: boolean,
  spreadPct: number,
  openInterest: number
): number {
  let score = 50;

  if (tier === "least_risk") {
    score += Math.min(25, Math.max(0, (pop - 80) * 1.5));
    score += Math.min(15, Math.max(0, cushionPct * 0.6));
    score += Math.min(15, Math.max(0, annualMarginReturn * 0.4));
  } else if (tier === "medium_risk") {
    score += Math.min(20, Math.max(0, (pop - 68) * 1.2));
    score += Math.min(15, Math.max(0, cushionPct * 0.9));
    score += Math.min(20, Math.max(0, annualMarginReturn * 0.35));
  } else {
    score += Math.min(15, Math.max(0, (pop - 50) * 0.8));
    score += Math.min(28, Math.max(0, annualMarginReturn * 0.28));
    score += Math.min(10, Math.max(0, cushionPct * 1.0));
  }

  // Sweet spot DTE (20 to 45 days is peak theta decay efficiency)
  if (dte >= 20 && dte <= 45) {
    score += 8;
  } else if (dte >= 14 && dte <= 60) {
    score += 4;
  }

  // Technical support: below lower Bollinger band is great downside protection
  if (isBelowBollingerLower) {
    score += 7;
  }

  // Volatility edge: IV > HV (selling rich premium)
  if (iv > 0 && hv > 0 && iv > hv * 1.1) {
    score += 6;
  }

  // Healthy RSI (not catastrophic freefall < 25, nor overbought > 70)
  if (rsi !== null && rsi >= 35 && rsi <= 60) {
    score += 4;
  }

  // Spread penalty / reward
  if (spreadPct > 20) {
    score -= Math.min(10, (spreadPct - 20) * 0.5);
  } else if (spreadPct <= 5) {
    score += 4;
  }

  // Liquidity bonus
  if (openInterest >= 100) {
    score += 4;
  }

  return Math.max(10, Math.min(99, Math.round(score)));
}

app.post("/api/put-recommendations", async (req: Request, res: Response) => {
  try {
    const {
      tickers,
      minDte = 7,
      maxDte = 60,
      minBid = 0.35,
      minOpenInterest = 5,
      marginShockPct = 15.0,
      minAnnualMarginReturn = 8.0,
    } = req.body;

    const tickerList: string[] = (
      Array.isArray(tickers) && tickers.length > 0 ? tickers : getWatchlist()
    ).map((t: string) => String(t).trim().toUpperCase());

    const leastRiskList: any[] = [];
    const mediumRiskList: any[] = [];
    const highRiskList: any[] = [];
    const allList: any[] = [];
    const marketContextMap: Record<string, any> = {};

    let totalContractsEvaluated = 0;
    const today = new Date();

    // Process tickers in parallel batches of 4
    const batchSize = 4;
    for (let b = 0; b < tickerList.length; b += batchSize) {
      const batch = tickerList.slice(b, b + batchSize);

      await Promise.all(
        batch.map(async (ticker) => {
          try {
            // Concurrently fetch options chain and technicals
            const [optData, technicals] = await Promise.all([
              fetchYahooOptions(ticker),
              getTechnicalsForTicker(ticker),
            ]);

            if (!optData) return;
            const meta = optData.quote || {};
            const currentPrice = meta.regularMarketPrice || meta.ask || meta.bid || 0;
            if (!currentPrice || currentPrice <= 0) return;

            const rsi = technicals?.rsi_14 ?? null;
            const bollingerLower = technicals?.bollinger?.lower_band ?? null;
            const bollingerUpper = technicals?.bollinger?.upper_band ?? null;
            const bollingerZone = technicals?.bollinger?.zone ?? null;
            const histVolPct = technicals?.historical_volatility_pct ?? null;
            const atmIv = technicals?.implied_volatility_pct ?? null;
            const fiftyTwoWeekHigh = technicals?.fifty_two_week_high ?? null;
            const distTo52wHigh = technicals?.distance_to_52w_high_pct ?? null;
            const marketCap = meta.marketCap || technicals?.market_cap || null;
            const nextEarningsDate = technicals?.next_earnings_date || null;

            marketContextMap[ticker] = {
              price: currentPrice,
              rsi,
              iv: atmIv,
              hv: histVolPct,
              bollinger_lower: bollingerLower,
              bollinger_upper: bollingerUpper,
              dist_to_52w_high_pct: distTo52wHigh,
            };

            const rawExpirations: number[] = optData.expirationDates || [];
            const validExpirations: Array<{ timestamp: number; dateStr: string; dte: number }> = [];

            for (const expTs of rawExpirations) {
              const expDate = new Date(expTs * 1000);
              const diffTime = expDate.getTime() - today.getTime();
              const dte = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              if (dte >= minDte && dte <= maxDte) {
                const dateStr = expDate.toISOString().split("T")[0];
                validExpirations.push({ timestamp: expTs, dateStr, dte });
              }
            }

            // Evaluate up to 4 expirations per ticker to balance depth and performance
            const targetExpirations = validExpirations.slice(0, 4);

            for (const exp of targetExpirations) {
              let chain = optData;
              if (optData.expirationDates?.[0] !== exp.timestamp) {
                const fetched = await fetchYahooOptions(ticker, exp.timestamp);
                if (fetched) chain = fetched;
              }

              const puts: any[] = chain?.options?.[0]?.puts || [];
              if (puts.length === 0) continue;

              for (const put of puts) {
                totalContractsEvaluated++;
                const strike = put.strike;
                if (!strike || strike <= 0) continue;

                const bid = put.bid || 0;
                const ask = put.ask || 0;
                const last = put.lastPrice || 0;
                const oi = put.openInterest || 0;
                const volume = put.volume || 0;

                // Price selection
                let execBid = bid;
                if (execBid <= 0 && last > 0 && last >= minBid) {
                  execBid = last;
                }
                if (execBid < minBid) continue;
                if (oi < minOpenInterest && volume < minOpenInterest) continue;

                // Moneyness & Cushion
                const moneyness = (strike / currentPrice) * 100;
                // Exclude ITM puts (moneyness > 100%) since selling naked/CSP is focused on OTM
                if (moneyness > 99.5) continue;

                const cushionToStrikePct = Number((((currentPrice - strike) / currentPrice) * 100).toFixed(2));
                const breakevenPrice = Number((strike - execBid).toFixed(2));
                const cushionToBreakevenPct = Number((((currentPrice - breakevenPrice) / currentPrice) * 100).toFixed(2));

                // Greeks & IV
                const ivRaw = put.impliedVolatility || 0.3;
                const ivPct = Number((ivRaw * 100).toFixed(2));
                const greeks = calculateGreeks(strike, currentPrice, ivRaw, exp.dte, false);

                const absDelta = Math.abs(greeks.delta || 0.2);

                // Probability of Profit (POP) calculation
                // Using standard lognormal approximation: POP ≈ (1 - |Delta|) * 100 adjusted for cushion
                const pop = Math.min(99.2, Math.max(50.0, Number(((1 - absDelta * 0.95) * 100).toFixed(1))));
                const probAssignment = Number((100 - pop).toFixed(1));

                // Financial Basis & Returns
                const cashBasisPerShare = strike;
                const marginBasisPerShare = estimatePortfolioMargin(
                  currentPrice,
                  strike,
                  execBid,
                  marginShockPct
                );

                const annualReturnCash = (execBid / cashBasisPerShare) * (365 / exp.dte) * 100;
                const annualReturnMargin = (execBid / marginBasisPerShare) * (365 / exp.dte) * 100;

                if (annualReturnMargin < minAnnualMarginReturn) continue;

                const spreadPct = execBid > 0 && ask > 0 ? Number((((ask - execBid) / execBid) * 100).toFixed(1)) : 0;
                const dailyTheta = Math.abs(greeks.theta || 0) * 100;
                const isBelowBollingerLower = bollingerLower !== null && strike <= bollingerLower;
                const ivToHvRatio = histVolPct && histVolPct > 0 ? Number((ivPct / histVolPct).toFixed(2)) : null;

                // Strategy Flags
                const flags: string[] = [];
                if (isBelowBollingerLower) flags.push("Below Lower Bollinger");
                if (ivToHvRatio && ivToHvRatio >= 1.15) flags.push("Rich IV / Vol Edge");
                if (exp.dte >= 20 && exp.dte <= 45) flags.push("Sweet Spot Theta (20-45d)");
                if (cushionToStrikePct >= 18) flags.push("Deep OTM Safety Buffer");
                if (spreadPct <= 8) flags.push("Tight Bid-Ask Spread");
                if (oi >= 250) flags.push("High Open Interest");
                if (annualReturnMargin >= 40) flags.push("High Yield Harvest");

                // Risk Tier Categorization
                // Incorporating Delta, Downside Cushion, POP, Bollinger Band Lower support, and RSI(14)
                let riskTier: "least_risk" | "medium_risk" | "high_risk" = "medium_risk";
                let riskTierLabel = "Medium Risk (Balanced)";

                // Least Risk criteria:
                // 1. Delta <= 0.16 or deep cushion (>=15%) & high POP (>=84%)
                // 2. OR Strike is below Lower Bollinger Band + Delta <= 0.22 + not severely overbought (RSI <= 68)
                const qualifiesLeastRisk =
                  (absDelta <= 0.16) ||
                  (cushionToStrikePct >= 15.0 && pop >= 84.0) ||
                  (isBelowBollingerLower && absDelta <= 0.20 && pop >= 80.0 && (rsi === null || rsi <= 65));

                // High Risk criteria:
                // Delta > 0.32 or elevated vulnerability (RSI > 75 overbought or extreme RSI < 25 falling knife) or narrow cushion (< 6%)
                const qualifiesHighRisk =
                  absDelta > 0.30 ||
                  cushionToStrikePct < 6.0 ||
                  pop < 70.0 ||
                  (rsi !== null && rsi > 78);

                if (qualifiesLeastRisk) {
                  riskTier = "least_risk";
                  riskTierLabel = "Least Risk (Conservative)";
                } else if (qualifiesHighRisk) {
                  riskTier = "high_risk";
                  riskTierLabel = "High Risk (Aggressive)";
                } else {
                  riskTier = "medium_risk";
                  riskTierLabel = "Medium Risk (Balanced)";
                }

                const score = computePutRecommendationScore(
                  riskTier,
                  annualReturnMargin,
                  pop,
                  cushionToStrikePct,
                  exp.dte,
                  ivPct,
                  histVolPct || 0,
                  rsi,
                  isBelowBollingerLower,
                  spreadPct,
                  oi
                );

                // Algorithmic Trade Rationale with RSI & Bollinger Band details
                let bbRsiContext = "";
                if (isBelowBollingerLower) {
                  bbRsiContext = ` [Strike below 20d Lower BB $${bollingerLower?.toFixed(2)}]`;
                } else if (bollingerZone) {
                  bbRsiContext = ` [BB zone: ${bollingerZone.replace(/_/g, " ")}]`;
                }
                const rsiStr = rsi !== null ? ` | RSI(14): ${rsi.toFixed(0)}` : "";

                let rationale = "";
                if (riskTier === "least_risk") {
                  rationale = `Safe Delta ${greeks.delta?.toFixed(2) || "-0.12"} positioned ${cushionToStrikePct}% ($${(currentPrice - strike).toFixed(2)}) below spot${bbRsiContext}${rsiStr}. Offers ${pop}% POP with $${(execBid * 100).toFixed(0)} premium ($${dailyTheta.toFixed(2)}/day theta) and ${annualReturnMargin.toFixed(1)}% annualized margin return.`;
                } else if (riskTier === "medium_risk") {
                  rationale = `Optimal Delta ${greeks.delta?.toFixed(2) || "-0.22"} sweet-spot with ${cushionToStrikePct}% downside cushion${bbRsiContext}${rsiStr}. Delivers strong ${annualReturnMargin.toFixed(1)}% annualized margin return with ${pop}% POP and $${dailyTheta.toFixed(2)}/day theta decay.`;
                } else {
                  rationale = `High-yield Delta ${greeks.delta?.toFixed(2) || "-0.35"} generating ${annualReturnMargin.toFixed(1)}% annualized margin yield ($${(execBid * 100).toFixed(0)} premium)${bbRsiContext}${rsiStr} with ${cushionToStrikePct}% buffer and rapid $${dailyTheta.toFixed(2)}/day theta decay.`;
                }

                const item = {
                  id: `${ticker}_${exp.dateStr}_${strike}P`,
                  ticker,
                  current_price: Number(currentPrice.toFixed(2)),
                  strike,
                  expiration: exp.dateStr,
                  dte: exp.dte,
                  risk_tier: riskTier,
                  risk_tier_label: riskTierLabel,
                  score,
                  bid: Number(execBid.toFixed(2)),
                  ask: Number(ask.toFixed(2)),
                  mid: Number(((execBid + (ask > 0 ? ask : execBid)) / 2).toFixed(2)),
                  spread_pct: spreadPct,
                  last_price: Number(last.toFixed(2)),
                  volume,
                  open_interest: oi,
                  contract_symbol: put.contractSymbol || `${ticker}${exp.dateStr.replace(/-/g, "")}P${strike * 1000}`,
                  moneyness_pct: Number(moneyness.toFixed(2)),
                  cushion_to_strike_pct: cushionToStrikePct,
                  breakeven_price: breakevenPrice,
                  cushion_to_breakeven_pct: cushionToBreakevenPct,
                  premium_per_contract: Number((execBid * 100).toFixed(2)),
                  capital_basis_margin: Number((marginBasisPerShare * 100).toFixed(2)),
                  capital_basis_cash_secured: Number((cashBasisPerShare * 100).toFixed(2)),
                  annualized_return_margin: Number(annualReturnMargin.toFixed(1)),
                  annualized_return_cash_secured: Number(annualReturnCash.toFixed(1)),
                  daily_theta_decay: Number(dailyTheta.toFixed(2)),
                  probability_of_profit: pop,
                  probability_of_assignment: probAssignment,
                  greeks: {
                    delta: greeks.delta,
                    gamma: greeks.gamma,
                    theta: greeks.theta,
                    vega: greeks.vega,
                    rho: greeks.rho,
                    iv_pct: ivPct,
                  },
                  technicals: {
                    rsi_14: rsi,
                    bollinger_zone: bollingerZone,
                    bollinger_lower: bollingerLower,
                    is_below_bollinger_lower: isBelowBollingerLower,
                    hist_vol_pct: histVolPct,
                    iv_to_hv_ratio: ivToHvRatio,
                    fifty_two_week_high: fiftyTwoWeekHigh,
                    dist_to_52w_high_pct: distTo52wHigh,
                    market_cap: marketCap,
                    next_earnings_date: nextEarningsDate,
                  },
                  rationale,
                  strategy_flags: flags,
                };

                allList.push(item);
                if (riskTier === "least_risk") leastRiskList.push(item);
                else if (riskTier === "medium_risk") mediumRiskList.push(item);
                else highRiskList.push(item);
              }
            }
          } catch (err) {
            console.error(`Error processing recommendations for ${ticker}:`, err);
          }
        })
      );
    }

    // Sort each list by algorithmic score descending, then annualized margin return descending
    const sortFn = (a: any, b: any) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.annualized_return_margin - a.annualized_return_margin;
    };

    leastRiskList.sort(sortFn);
    mediumRiskList.sort(sortFn);
    highRiskList.sort(sortFn);
    allList.sort(sortFn);

    const computeSummary = (list: any[]) => {
      if (list.length === 0) {
        return {
          count: 0,
          avg_pop: 0,
          avg_margin_return: 0,
          avg_cash_return: 0,
          avg_cushion: 0,
          avg_theta: 0,
        };
      }
      const count = list.length;
      const avg_pop = Number((list.reduce((s, i) => s + i.probability_of_profit, 0) / count).toFixed(1));
      const avg_margin_return = Number((list.reduce((s, i) => s + i.annualized_return_margin, 0) / count).toFixed(1));
      const avg_cash_return = Number((list.reduce((s, i) => s + i.annualized_return_cash_secured, 0) / count).toFixed(1));
      const avg_cushion = Number((list.reduce((s, i) => s + i.cushion_to_strike_pct, 0) / count).toFixed(1));
      const avg_theta = Number((list.reduce((s, i) => s + i.daily_theta_decay, 0) / count).toFixed(2));
      return {
        count,
        avg_pop,
        avg_margin_return,
        avg_cash_return,
        avg_cushion,
        avg_theta,
        top_pick: list[0] || undefined,
      };
    };

    res.json({
      least_risk: leastRiskList,
      medium_risk: mediumRiskList,
      high_risk: highRiskList,
      all_recommendations: allList,
      tickers_scanned: tickerList,
      total_contracts_evaluated: totalContractsEvaluated,
      tier_summaries: {
        least_risk: computeSummary(leastRiskList),
        medium_risk: computeSummary(mediumRiskList),
        high_risk: computeSummary(highRiskList),
      },
      market_context: marketContextMap,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("Error in /api/put-recommendations:", e);
    res.status(500).json({ error: e.message || "Failed to generate put recommendations" });
  }
});

// AI Strategic Portfolio Allocation with Gemini
app.post("/api/ai-put-strategy", async (req: Request, res: Response) => {
  try {
    const { leastRisk, mediumRisk, highRisk, tickers } = req.body;

    const sampleLeast = (leastRisk || []).slice(0, 3).map((r: any) => `${r.ticker} $${r.strike}P exp ${r.expiration} (${r.dte}d) | Yield Margin: ${r.annualized_return_margin}% | POP: ${r.probability_of_profit}% | Cushion: ${r.cushion_to_strike_pct}% | Score: ${r.score}`);
    const sampleMed = (mediumRisk || []).slice(0, 3).map((r: any) => `${r.ticker} $${r.strike}P exp ${r.expiration} (${r.dte}d) | Yield Margin: ${r.annualized_return_margin}% | POP: ${r.probability_of_profit}% | Cushion: ${r.cushion_to_strike_pct}% | Score: ${r.score}`);
    const sampleHigh = (highRisk || []).slice(0, 3).map((r: any) => `${r.ticker} $${r.strike}P exp ${r.expiration} (${r.dte}d) | Yield Margin: ${r.annualized_return_margin}% | POP: ${r.probability_of_profit}% | Cushion: ${r.cushion_to_strike_pct}% | Score: ${r.score}`);

    const prompt = `You are a Senior Quantitative Portfolio Manager and Volatility Structurer.
Analyze the following top sell put option opportunities across three risk tiers (Least Risk, Medium Risk, High Risk) for the user's watchlist universe (${tickers ? tickers.join(", ") : "mega-caps"}).

Least Risk candidates (Deep OTM, >85% POP, fortress safety):
${sampleLeast.join("\n")}

Medium Risk candidates (Balanced sweet-spot, 70-85% POP, optimal alpha):
${sampleMed.join("\n")}

High Risk candidates (Aggressive, high yield / IV harvest, 55-70% POP):
${sampleHigh.join("\n")}

Provide an institutional-grade strategic allocation and trade recommendations in strict JSON.`;

    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            market_regime: { type: Type.STRING, description: "Current market volatility and options selling regime summary (e.g., 'Elevated Tech IV • Prime Premium Selling')" },
            allocation: {
              type: Type.OBJECT,
              properties: {
                least_risk_pct: { type: Type.NUMBER, description: "Recommended portfolio percentage in Least Risk puts" },
                medium_risk_pct: { type: Type.NUMBER, description: "Recommended portfolio percentage in Medium Risk puts" },
                high_risk_pct: { type: Type.NUMBER, description: "Recommended portfolio percentage in High Risk puts" },
                cash_reserve_pct: { type: Type.NUMBER, description: "Recommended dry powder / margin cash buffer percentage" },
              },
              required: ["least_risk_pct", "medium_risk_pct", "high_risk_pct", "cash_reserve_pct"],
            },
            executive_summary: { type: Type.STRING, description: "2 to 3 concise sentences providing executive trade guidance across the 3 risk buckets." },
            tier_guidance: {
              type: Type.OBJECT,
              properties: {
                least_risk_rationale: { type: Type.STRING, description: "Guidance and target profile for the least risk bucket" },
                medium_risk_rationale: { type: Type.STRING, description: "Guidance and target profile for the medium risk bucket" },
                high_risk_rationale: { type: Type.STRING, description: "Guidance and target profile for the high risk bucket" },
              },
              required: ["least_risk_rationale", "medium_risk_rationale", "high_risk_rationale"],
            },
            recommended_trades: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  ticker: { type: Type.STRING },
                  tier: { type: Type.STRING },
                  strike: { type: Type.NUMBER },
                  expiration: { type: Type.STRING },
                  action_thesis: { type: Type.STRING },
                  catalyst_or_risk: { type: Type.STRING },
                },
                required: ["ticker", "tier", "strike", "expiration", "action_thesis", "catalyst_or_risk"],
              },
            },
            risk_rules: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 to 4 non-negotiable risk management rules (e.g., close at 50% profit, roll if tested at 21 DTE, max margin utilization).",
            },
          },
          required: ["market_regime", "allocation", "executive_summary", "tier_guidance", "recommended_trades", "risk_rules"],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    res.json({ success: true, strategy: parsed });
  } catch (err: any) {
    console.error("Error generating AI put strategy:", err);
    res.status(500).json({ error: err.message || "Failed to generate AI put strategy" });
  }
});

app.get("/api/sec-earnings", async (req: Request, res: Response) => {
  try {
    const tickersParam = req.query.tickers as string;
    const tickers = tickersParam
      ? tickersParam.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean)
      : ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA"];

    const cikMap = await getSecTickerCikMap();
    const results: any[] = [];

    for (const ticker of tickers) {
      const cik = cikMap[ticker];
      if (!cik) {
        // Fallback info from Yahoo
        const qs = await fetchYahooQuoteSummary(ticker);
        results.push({
          ticker,
          cik: "N/A",
          error: "No CIK mapping found in SEC directory",
          eps: qs?.defaultKeyStatistics?.trailingEps?.raw
            ? {
                tag: "TrailingEPS",
                unit: "USD",
                value: qs.defaultKeyStatistics.trailingEps.raw,
                period_end: "Recent",
              }
            : null,
          revenue: qs?.financialData?.totalRevenue?.raw
            ? {
                tag: "TotalRevenue",
                unit: "USD",
                value: qs.financialData.totalRevenue.raw,
                period_end: "Recent",
              }
            : null,
          filings: [],
        });
        continue;
      }

      try {
        const paddedCik = String(cik).padStart(10, "0");
        const subRes = await fetch(`https://data.sec.gov/submissions/CIK${paddedCik}.json`, {
          headers: { "User-Agent": "muthu.vela@gmail.com StockRelated/1.0" },
        });

        let filingsList: any[] = [];
        if (subRes.ok) {
          const subData: any = await subRes.json();
          const recent = subData?.filings?.recent || {};
          const forms: string[] = recent.form || [];
          const dates: string[] = recent.filingDate || [];
          const accns: string[] = recent.accessionNumber || [];
          const primaryDocs: string[] = recent.primaryDocument || [];
          const primaryDocDescs: string[] = recent.primaryDocDescription || [];

          for (let i = 0; i < forms.length && filingsList.length < 8; i++) {
            if (["10-K", "10-Q", "8-K"].includes(forms[i])) {
              const accnNoDash = accns[i].replace(/-/g, "");
              const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${accnNoDash}/${primaryDocs[i]}`;
              const cacheKey = `${ticker}_${forms[i]}_${dates[i]}_${url}`;
              
              filingsList.push({
                form: forms[i],
                date: dates[i],
                url,
                accession_number: accns[i],
                primary_doc: primaryDocs[i],
                description: primaryDocDescs[i] || `${forms[i]} Disclosure`,
                ai_summary: secSummaryCache.get(cacheKey) || null,
              });
            }
          }
        }

        // Fetch concept EPS
        let epsData: any = null;
        for (const tag of ["EarningsPerShareDiluted", "EarningsPerShareBasic"]) {
          try {
            const conceptRes = await fetch(
              `https://data.sec.gov/api/xbrl/companyconcept/CIK${paddedCik}/us-gaap/${tag}.json`,
              { headers: { "User-Agent": "muthu.vela@gmail.com StockRelated/1.0" } }
            );
            if (conceptRes.ok) {
              const cJson: any = await conceptRes.json();
              const units = cJson?.units?.["USD/shares"] || cJson?.units?.["USD"] || [];
              if (units.length > 0) {
                const sorted = units.sort((a: any, b: any) => (b.end || "").localeCompare(a.end || ""));
                const latest = sorted[0];
                epsData = {
                  tag,
                  unit: "USD/share",
                  value: latest.val,
                  period_end: latest.end,
                  fiscal_period: latest.fp,
                  fiscal_year: latest.fy,
                  form: latest.form,
                  filed: latest.filed,
                };
                break;
              }
            }
          } catch (e) {}
        }

        // Fetch concept Revenue
        let revData: any = null;
        for (const tag of ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax"]) {
          try {
            const conceptRes = await fetch(
              `https://data.sec.gov/api/xbrl/companyconcept/CIK${paddedCik}/us-gaap/${tag}.json`,
              { headers: { "User-Agent": "muthu.vela@gmail.com StockRelated/1.0" } }
            );
            if (conceptRes.ok) {
              const cJson: any = await conceptRes.json();
              const units = cJson?.units?.["USD"] || [];
              if (units.length > 0) {
                const sorted = units.sort((a: any, b: any) => (b.end || "").localeCompare(a.end || ""));
                const latest = sorted[0];
                revData = {
                  tag,
                  unit: "USD",
                  value: latest.val,
                  period_end: latest.end,
                  fiscal_period: latest.fp,
                  fiscal_year: latest.fy,
                  form: latest.form,
                  filed: latest.filed,
                };
                break;
              }
            }
          } catch (e) {}
        }

        results.push({
          ticker,
          cik,
          eps: epsData,
          revenue: revData,
          filings: filingsList,
        });
      } catch (err: any) {
        results.push({
          ticker,
          cik,
          error: `Error querying SEC EDGAR: ${err.message}`,
          filings: [],
        });
      }
    }

    res.json({ results });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Single Filing Summarization with Gemini
app.post("/api/sec-summarize-filing", async (req: Request, res: Response) => {
  try {
    const { ticker, form, date, url, epsData, revData } = req.body;
    if (!ticker || !form || !url) {
      return res.status(400).json({ error: "Missing ticker, form, or url" });
    }

    const summary = await summarizeSecFilingWithGemini({
      ticker,
      form,
      date: date || new Date().toISOString().split("T")[0],
      url,
      epsData,
      revData,
    });

    res.json({ success: true, summary });
  } catch (e: any) {
    console.error("Error in /api/sec-summarize-filing:", e);
    res.status(500).json({ error: e.message || "Failed to summarize filing" });
  }
});

// Batch Summarize Filings for given items
app.post("/api/sec-summarize-batch", async (req: Request, res: Response) => {
  try {
    const { filings } = req.body; // Array of { ticker, form, date, url, epsData, revData }
    if (!Array.isArray(filings) || filings.length === 0) {
      return res.status(400).json({ error: "filings array is required" });
    }

    // Limit to max 12 filings per batch to maintain fast response
    const targetFilings = filings.slice(0, 12);
    const summaries: any[] = [];

    // Process with controlled concurrency (up to 3 parallel requests)
    const chunkSize = 3;
    for (let i = 0; i < targetFilings.length; i += chunkSize) {
      const chunk = targetFilings.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(
        chunk.map((f) =>
          summarizeSecFilingWithGemini({
            ticker: f.ticker,
            form: f.form,
            date: f.date,
            url: f.url,
            epsData: f.epsData,
            revData: f.revData,
          })
        )
      );
      summaries.push(...chunkResults);
    }

    res.json({ success: true, count: summaries.length, summaries });
  } catch (e: any) {
    console.error("Error in /api/sec-summarize-batch:", e);
    res.status(500).json({ error: e.message || "Failed to batch summarize filings" });
  }
});

// ==========================================
// VITE MIDDLEWARE & SERVER STARTUP
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`StockRelated server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
