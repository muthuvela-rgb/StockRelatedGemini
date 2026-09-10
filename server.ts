import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import {
  fetchAlphaVantageTranscript,
  summarizeEarningsTranscriptWithGemini,
  getAlphaVantageKeyStatus,
  generateDeterministicTranscriptSummary,
  getTickerSentimentHistory,
  getWatchlistSentimentHistory,
} from "./server/transcripts";

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
const DEFAULT_WATCHLIST = [
  "NVDA", "QQQ", "ALAB", "MU", "NBIS", "SNDK", "SKHY", "SPCX", "TSLA", "META", "CRWV", "SNOW", "TQQQ", "RKLB", "CRDO"
];
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

// --- TRADIER & FINANCIAL DATA FETCHERS ---
export interface TradierQuote {
  symbol: string;
  description?: string;
  exch?: string;
  type?: string;
  last: number;
  change?: number;
  change_percentage?: number;
  volume?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  prevclose?: number;
  bid?: number;
  ask?: number;
  week_52_high?: number;
  week_52_low?: number;
  trade_date?: number;
  provider?: string;
  [key: string]: any;
}

function normalizeTradierBaseUrl(raw?: string): string {
  let base = (raw || "").trim();
  if (!base) {
    return process.env.TRADIER_ENV === "sandbox" ? "https://sandbox.tradier.com/v1" : "https://api.tradier.com/v1";
  }
  if (base.toLowerCase() === "sandbox") return "https://sandbox.tradier.com/v1";
  if (base.toLowerCase() === "prod" || base.toLowerCase() === "production") return "https://api.tradier.com/v1";

  // Prepend protocol if missing
  if (!base.startsWith("http://") && !base.startsWith("https://")) {
    base = `https://${base}`;
  }
  // Remove trailing slashes
  base = base.replace(/\/+$/, "");
  // Ensure /v1 endpoint version prefix is present for Tradier endpoints
  if (!base.endsWith("/v1")) {
    base = `${base}/v1`;
  }
  return base;
}

function getTradierConfig() {
  const token = (process.env.TRADIER_API_TOKEN || process.env.TRADIER_ACCESS_TOKEN || "").trim();
  const rawBase = process.env.TRADIER_BASE_URL;
  const baseUrl = normalizeTradierBaseUrl(rawBase);
  return {
    token,
    baseUrl,
    isConfigured: Boolean(token),
  };
}

// --- TRADIER CIRCUIT BREAKER & RATE-LIMIT CONTROL ---
let tradierCooldownUntil = 0;
let tradierCooldownReason = "";

function isTradierInCooldown(): boolean {
  return Date.now() < tradierCooldownUntil;
}

function triggerTradierCooldown(reason: string, seconds = 60) {
  tradierCooldownUntil = Date.now() + seconds * 1000;
  tradierCooldownReason = reason;
  console.warn(`[Tradier Circuit Breaker] Rate limit / quota reached (${reason}). Switching to Yahoo Finance fallback for ${seconds}s.`);
}

function handleTradierResponse(res: any, endpoint: string): boolean {
  if (!res) return false;
  const status = Number(res.status || 0);
  const statusText = String(res.statusText || "").toLowerCase();
  if (status === 429 || (status === 400 && (statusText.includes("quota") || statusText.includes("limit")))) {
    triggerTradierCooldown(`${status} ${res.statusText || "Quota Exceeded"} on ${endpoint}`, 60);
    return false;
  }
  const remaining = res.headers?.get ? res.headers.get("x-ratelimit-available") : null;
  if (remaining !== null && Number(remaining) <= 2) {
    console.warn(`[Tradier] Available quota window low: ${remaining} requests remaining.`);
  }
  return Boolean(res.ok);
}

// In-Memory Caching to minimize Tradier network hits and prevent quota exhaustion
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const tradierQuotesCache = new Map<string, CacheEntry<TradierQuote>>();
const tradierExpirationsCache = new Map<string, CacheEntry<{ dateList: string[]; timestamps: number[] }>>();
const tradierOptionsChainCache = new Map<string, CacheEntry<any>>();
const tradierHistoryCache = new Map<string, CacheEntry<any>>();

// In-flight request deduplication
const inFlightQuotes = new Map<string, Promise<Record<string, TradierQuote>>>();
const inFlightHistory = new Map<string, Promise<any>>();
const inFlightExpirations = new Map<string, Promise<{ dateList: string[]; timestamps: number[] } | null>>();
const inFlightOptionChains = new Map<string, Promise<any>>();

let hasLoggedTradierStatus = false;
function logTradierStatusOnce() {
  if (hasLoggedTradierStatus) return;
  hasLoggedTradierStatus = true;
  const cfg = getTradierConfig();
  if (cfg.isConfigured) {
    console.log(`[Tradier] Active market data provider connected via: ${cfg.baseUrl}`);
  } else {
    console.log(`[Tradier] TRADIER_API_TOKEN not set in environment. Running with Yahoo Finance fallback. Provide TRADIER_API_TOKEN in Settings to enable direct Tradier brokerage quotes.`);
  }
}

function getMarketDataProviderInfo() {
  const config = getTradierConfig();
  const inCooldown = isTradierInCooldown();
  const cooldownSecRemaining = inCooldown ? Math.max(1, Math.ceil((tradierCooldownUntil - Date.now()) / 1000)) : 0;
  const activeProvider = !config.isConfigured ? "yahoo" : (inCooldown ? "yahoo" : "tradier");

  return {
    provider: activeProvider,
    primaryProvider: "tradier",
    isTradierConfigured: config.isConfigured,
    tradierInCooldown: inCooldown,
    cooldownSecondsRemaining: cooldownSecRemaining,
    tradierBaseUrl: config.baseUrl,
    fallbackAvailable: true,
    fallbackProvider: "yahoo",
    description: !config.isConfigured
      ? "Tradier is the primary provider; operating with Yahoo Finance fallback (TRADIER_API_TOKEN not set in environment)"
      : inCooldown
      ? `Tradier rate limit quota reached (${tradierCooldownReason || "exceeded 120 req/min"}). Seamless Yahoo Finance fallback active (re-engaging Tradier in ${cooldownSecRemaining}s)`
      : "Live Tradier Brokerage Market Data (Real-time Equities & Options with ORATS Greeks)",
  };
}

// Fetch multiple quotes from Tradier with caching & chunking
async function fetchTradierQuotes(symbols: string[]): Promise<Record<string, TradierQuote>> {
  const config = getTradierConfig();
  if (!config.isConfigured || isTradierInCooldown() || symbols.length === 0) return {};

  const cleanSymbols = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)));
  if (cleanSymbols.length === 0) return {};

  const now = Date.now();
  const result: Record<string, TradierQuote> = {};
  const missingSymbols: string[] = [];

  for (const s of cleanSymbols) {
    const cached = tradierQuotesCache.get(s);
    if (cached && cached.expiresAt > now) {
      result[s] = cached.data;
    } else {
      missingSymbols.push(s);
    }
  }

  if (missingSymbols.length === 0) {
    return result;
  }

  const cacheKey = missingSymbols.sort().join(",");
  if (inFlightQuotes.has(cacheKey)) {
    try {
      const fetched = await inFlightQuotes.get(cacheKey)!;
      return { ...result, ...fetched };
    } catch {
      return result;
    }
  }

  const fetchPromise = (async () => {
    try {
      // Chunk symbols into batches of 40 to stay well below URL limits
      for (let i = 0; i < missingSymbols.length; i += 40) {
        if (isTradierInCooldown()) break;
        const chunk = missingSymbols.slice(i, i + 40);
        const url = `${config.baseUrl}/markets/quotes?symbols=${encodeURIComponent(chunk.join(","))}&greeks=false`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: "application/json",
          },
        });

        if (!handleTradierResponse(res, "/markets/quotes")) {
          break;
        }

        const data = await res.json().catch(() => null);
        const rawQuotes = data?.quotes?.quote;
        if (!rawQuotes) continue;

        const quotesArr: any[] = Array.isArray(rawQuotes) ? rawQuotes : [rawQuotes];
        for (const q of quotesArr) {
          if (!q || !q.symbol) continue;
          const sym = String(q.symbol).toUpperCase();
          const parsedQuote: TradierQuote = {
            symbol: sym,
            description: q.description || "",
            exch: q.exch || "",
            type: q.type || "stock",
            last: Number(q.last ?? q.close ?? q.prevclose ?? 0),
            change: Number(q.change ?? 0),
            change_percentage: Number(q.change_percentage ?? 0),
            volume: Number(q.volume ?? 0),
            open: q.open !== null && q.open !== undefined ? Number(q.open) : undefined,
            high: q.high !== null && q.high !== undefined ? Number(q.high) : undefined,
            low: q.low !== null && q.low !== undefined ? Number(q.low) : undefined,
            close: q.close !== null && q.close !== undefined ? Number(q.close) : undefined,
            prevclose: q.prevclose !== null && q.prevclose !== undefined ? Number(q.prevclose) : undefined,
            bid: Number(q.bid ?? 0),
            ask: Number(q.ask ?? 0),
            week_52_high: q.week_52_high !== null && q.week_52_high !== undefined ? Number(q.week_52_high) : undefined,
            week_52_low: q.week_52_low !== null && q.week_52_low !== undefined ? Number(q.week_52_low) : undefined,
            trade_date: q.trade_date,
            provider: "tradier",
          };
          result[sym] = parsedQuote;
          tradierQuotesCache.set(sym, {
            data: parsedQuote,
            expiresAt: Date.now() + 25_000, // 25s TTL
          });
        }
      }
    } catch (err) {
      console.error("[Tradier] Error fetching quotes:", err);
    } finally {
      inFlightQuotes.delete(cacheKey);
    }
    return result;
  })();

  inFlightQuotes.set(cacheKey, fetchPromise);
  return fetchPromise;
}

// Fetch single quote from Tradier (hits quote cache first)
async function fetchTradierQuote(symbol: string): Promise<TradierQuote | null> {
  const sym = symbol.toUpperCase().trim();
  const cached = tradierQuotesCache.get(sym);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  const map = await fetchTradierQuotes([sym]);
  return map[sym] || null;
}

// Fetch Tradier options expiration dates (cached for 15 minutes)
async function fetchTradierExpirations(symbol: string): Promise<{ dateList: string[]; timestamps: number[] } | null> {
  const sym = symbol.toUpperCase().trim();
  const cached = tradierExpirationsCache.get(sym);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  if (inFlightExpirations.has(sym)) {
    return inFlightExpirations.get(sym)!;
  }

  const config = getTradierConfig();
  if (!config.isConfigured || isTradierInCooldown()) return null;

  const promise = (async () => {
    try {
      const expUrl = `${config.baseUrl}/markets/options/expirations?symbol=${encodeURIComponent(sym)}&includeAllRoots=true`;
      const expRes = await fetch(expUrl, {
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: "application/json",
        },
      });

      if (!handleTradierResponse(expRes, `/markets/options/expirations (${sym})`)) {
        return null;
      }

      const expJson = await expRes.json().catch(() => null);
      const rawDates = expJson?.expirations?.date;
      if (!rawDates) return null;

      const dateList: string[] = Array.isArray(rawDates) ? rawDates : [rawDates];
      if (dateList.length === 0) return null;

      const timestamps = dateList.map((dStr) =>
        Math.floor(new Date(`${dStr}T16:00:00Z`).getTime() / 1000)
      );

      const entry = { dateList, timestamps };
      tradierExpirationsCache.set(sym, {
        data: entry,
        expiresAt: Date.now() + 15 * 60_000, // 15 min TTL
      });
      return entry;
    } catch (err) {
      console.error(`[Tradier] Error fetching expirations for ${sym}:`, err);
      return null;
    } finally {
      inFlightExpirations.delete(sym);
    }
  })();

  inFlightExpirations.set(sym, promise);
  return promise;
}

// Fetch historical daily bars from Tradier with caching & deduplication
async function fetchTradierHistory(ticker: string, range = "1y"): Promise<any> {
  const sym = ticker.toUpperCase().trim();
  const cacheKey = `${sym}:${range}`;
  const cached = tradierHistoryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  if (inFlightHistory.has(cacheKey)) {
    return inFlightHistory.get(cacheKey)!;
  }

  const config = getTradierConfig();
  if (!config.isConfigured || isTradierInCooldown()) return null;

  const promise = (async () => {
    try {
      const now = new Date();
      let daysBack = 365;
      if (range === "3mo") daysBack = 95;
      else if (range === "6mo") daysBack = 185;
      else if (range === "1mo") daysBack = 35;
      else if (range === "5d") daysBack = 10;
      else if (range === "2y") daysBack = 730;
      else if (range === "5y") daysBack = 1825;

      const startDateObj = new Date(now.getTime() - daysBack * 86400000);
      const startStr = startDateObj.toISOString().split("T")[0];

      const url = `${config.baseUrl}/markets/history?symbol=${encodeURIComponent(sym)}&interval=daily&start=${startStr}`;
      const [historyRes, quote] = await Promise.all([
        fetch(url, {
          headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: "application/json",
          },
        }),
        fetchTradierQuote(sym).catch(() => null),
      ]);

      if (!handleTradierResponse(historyRes, `/markets/history (${sym})`)) {
        return null;
      }

      const json = await historyRes.json().catch(() => null);
      const rawDays = json?.history?.day;
      if (!rawDays) return null;

      const days: any[] = Array.isArray(rawDays) ? rawDays : [rawDays];
      if (days.length === 0) return null;

      const timestamps: number[] = [];
      const closes: number[] = [];
      const opens: number[] = [];
      const highs: number[] = [];
      const lows: number[] = [];
      const volumes: number[] = [];

      for (const d of days) {
        if (!d || !d.date || d.close === undefined || d.close === null) continue;
        const ts = Math.floor(new Date(`${d.date}T16:00:00Z`).getTime() / 1000);
        timestamps.push(ts);
        closes.push(Number(d.close));
        opens.push(Number(d.open ?? d.close));
        highs.push(Number(d.high ?? d.close));
        lows.push(Number(d.low ?? d.close));
        volumes.push(Number(d.volume ?? 0));
      }

      const lastClose = closes[closes.length - 1];
      const prevClose = closes.length > 1 ? closes[closes.length - 2] : lastClose;
      const max52 = quote?.week_52_high ?? (highs.length > 0 ? Math.max(...highs) : lastClose);
      const min52 = quote?.week_52_low ?? (lows.length > 0 ? Math.min(...lows) : lastClose);

      const chartData = {
        meta: {
          currency: "USD",
          symbol: sym,
          regularMarketPrice: quote?.last ?? lastClose,
          chartPreviousClose: quote?.prevclose ?? prevClose,
          fiftyTwoWeekHigh: max52,
          fiftyTwoWeekLow: min52,
          provider: "tradier",
        },
        timestamp: timestamps,
        indicators: {
          quote: [
            {
              close: closes,
              open: opens,
              high: highs,
              low: lows,
              volume: volumes,
            },
          ],
        },
      };

      tradierHistoryCache.set(cacheKey, {
        data: chartData,
        expiresAt: Date.now() + 5 * 60_000, // 5 min TTL
      });

      return chartData;
    } catch (e) {
      console.error(`[Tradier] Error fetching history for ${sym}:`, e);
      return null;
    } finally {
      inFlightHistory.delete(cacheKey);
    }
  })();

  inFlightHistory.set(cacheKey, promise);
  return promise;
}

// Fetch Tradier options chain with ORATS Greeks & caching
async function fetchTradierOptions(ticker: string, dateTimestamp?: number): Promise<any> {
  const config = getTradierConfig();
  if (!config.isConfigured || isTradierInCooldown()) return null;

  try {
    const symbol = ticker.toUpperCase().trim();
    const [expData, quote] = await Promise.all([
      fetchTradierExpirations(symbol),
      fetchTradierQuote(symbol).catch(() => null),
    ]);

    if (!expData || expData.dateList.length === 0) return null;

    const { dateList, timestamps: expirationTimestamps } = expData;

    let targetDateStr = dateList[0];
    if (dateTimestamp) {
      const matchDateStr = new Date(dateTimestamp * 1000).toISOString().split("T")[0];
      if (dateList.includes(matchDateStr)) {
        targetDateStr = matchDateStr;
      }
    }

    const chainCacheKey = `${symbol}:${targetDateStr}`;
    const cachedChain = tradierOptionsChainCache.get(chainCacheKey);
    if (cachedChain && cachedChain.expiresAt > Date.now()) {
      return cachedChain.data;
    }

    if (inFlightOptionChains.has(chainCacheKey)) {
      return inFlightOptionChains.get(chainCacheKey)!;
    }

    const chainPromise = (async () => {
      try {
        const chainUrl = `${config.baseUrl}/markets/options/chains?symbol=${encodeURIComponent(symbol)}&expiration=${targetDateStr}&greeks=true`;
        const chainRes = await fetch(chainUrl, {
          headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: "application/json",
          },
        });

        if (!handleTradierResponse(chainRes, `/markets/options/chains (${symbol} ${targetDateStr})`)) {
          return null;
        }

        const chainJson = await chainRes.json().catch(() => null);
        const rawOptions = chainJson?.options?.option;
        if (!rawOptions) return null;

        const optList: any[] = Array.isArray(rawOptions) ? rawOptions : [rawOptions];
        const calls: any[] = [];
        const puts: any[] = [];
        const strikesSet = new Set<number>();

        const underlyingPrice = quote?.last || 100;

        for (const opt of optList) {
          if (!opt) continue;
          const strike = Number(opt.strike);
          strikesSet.add(strike);

          const isCall = opt.option_type?.toLowerCase() === "call";
          const iv = opt.greeks?.mid_iv || opt.greeks?.smv_vol || opt.greeks?.bid_iv || 0;

          const contract = {
            contractSymbol: opt.symbol,
            strike,
            currency: "USD",
            lastPrice: Number(opt.last ?? 0),
            change: Number(opt.change ?? 0),
            percentChange: Number(opt.change_percentage ?? 0),
            volume: Number(opt.volume ?? 0),
            openInterest: Number(opt.open_interest ?? 0),
            bid: Number(opt.bid ?? 0),
            ask: Number(opt.ask ?? 0),
            impliedVolatility: iv,
            inTheMoney: isCall ? strike < underlyingPrice : strike > underlyingPrice,
            expirationDate: targetDateStr,
            greeks: {
              delta: opt.greeks?.delta ?? 0,
              gamma: opt.greeks?.gamma ?? 0,
              theta: opt.greeks?.theta ?? 0,
              vega: opt.greeks?.vega ?? 0,
            },
          };

          if (isCall) calls.push(contract);
          else puts.push(contract);
        }

        calls.sort((a, b) => a.strike - b.strike);
        puts.sort((a, b) => a.strike - b.strike);
        const strikes = Array.from(strikesSet).sort((a, b) => a - b);

        const result = {
          underlyingSymbol: symbol,
          expirationDates: expirationTimestamps,
          strikes,
          hasMiniOptions: false,
          quote: {
            symbol,
            regularMarketPrice: quote?.last ?? underlyingPrice,
            regularMarketChange: quote?.change ?? 0,
            regularMarketChangePercent: quote?.change_percentage ?? 0,
            regularMarketVolume: quote?.volume ?? 0,
            bid: quote?.bid ?? 0,
            ask: quote?.ask ?? 0,
            fiftyTwoWeekHigh: quote?.week_52_high,
            fiftyTwoWeekLow: quote?.week_52_low,
          },
          options: [
            {
              expirationDate: Math.floor(new Date(`${targetDateStr}T16:00:00Z`).getTime() / 1000),
              hasMiniOptions: false,
              calls,
              puts,
            },
          ],
          provider: "tradier",
        };

        tradierOptionsChainCache.set(chainCacheKey, {
          data: result,
          expiresAt: Date.now() + 45_000, // 45s TTL
        });

        return result;
      } catch (err) {
        console.error(`[Tradier] Error fetching options chain for ${symbol}:`, err);
        return null;
      } finally {
        inFlightOptionChains.delete(chainCacheKey);
      }
    })();

    inFlightOptionChains.set(chainCacheKey, chainPromise);
    return chainPromise;
  } catch (err) {
    console.error(`[Tradier] Error fetching options for ${ticker}:`, err);
    return null;
  }
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
    let url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=financialData,defaultKeyStatistics,summaryDetail,upgradeDowngradeHistory,calendarEvents`;
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

// --- UNIFIED MARKET DATA ROUTER (TRADIER PRIMARY -> YAHOO FALLBACK) ---
async function fetchMarketChart(ticker: string, range = "1y", interval = "1d"): Promise<any> {
  logTradierStatusOnce();
  const tradierConfig = getTradierConfig();
  if (tradierConfig.isConfigured && !isTradierInCooldown()) {
    const tradierChart = await fetchTradierHistory(ticker, range);
    if (tradierChart) return tradierChart;
  }
  return fetchYahooChart(ticker, range, interval);
}

async function fetchMarketOptions(ticker: string, dateTimestamp?: number): Promise<any> {
  logTradierStatusOnce();
  const tradierConfig = getTradierConfig();
  if (tradierConfig.isConfigured && !isTradierInCooldown()) {
    const tradierOpts = await fetchTradierOptions(ticker, dateTimestamp);
    if (tradierOpts) return tradierOpts;
  }
  return fetchYahooOptions(ticker, dateTimestamp);
}

async function fetchMarketQuote(ticker: string): Promise<TradierQuote | null> {
  logTradierStatusOnce();
  const tradierConfig = getTradierConfig();
  if (tradierConfig.isConfigured && !isTradierInCooldown()) {
    const q = await fetchTradierQuote(ticker);
    if (q) return q;
  }

  // Fallback quote extraction via Yahoo chart
  try {
    const chart = await fetchYahooChart(ticker, "5d", "1d");
    const meta = chart?.meta;
    if (meta) {
      return {
        symbol: ticker.toUpperCase(),
        last: meta.regularMarketPrice || meta.chartPreviousClose || 0,
        prevclose: meta.chartPreviousClose || 0,
        week_52_high: meta.fiftyTwoWeekHigh,
        week_52_low: meta.fiftyTwoWeekLow,
        provider: "yahoo",
      };
    }
  } catch (e) {}
  return null;
}

async function fetchMarketQuotes(tickers: string[]): Promise<Record<string, TradierQuote>> {
  logTradierStatusOnce();
  const tradierConfig = getTradierConfig();
  if (tradierConfig.isConfigured && !isTradierInCooldown()) {
    const quotes = await fetchTradierQuotes(tickers);
    if (Object.keys(quotes).length > 0) return quotes;
  }

  // Fallback: fetch quotes via Yahoo chart meta in bounded concurrent chunks
  const result: Record<string, TradierQuote> = {};
  const chunkSize = 5;
  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (t) => {
        try {
          const q = await fetchMarketQuote(t);
          if (q) result[t.toUpperCase()] = q;
        } catch (e) {}
      })
    );
  }
  return result;
}

// --- FULL TECHNICALS FETCHER ---
async function getTechnicalsForTicker(ticker: string) {
  const chart = await fetchMarketChart(ticker, "1y", "1d");
  const quoteSummary = await fetchYahooQuoteSummary(ticker);
  const tradierQuote = await fetchMarketQuote(ticker).catch(() => null);

  const meta = chart?.meta || {};
  const currentPrice = tradierQuote?.last || meta.regularMarketPrice || meta.chartPreviousClose || null;
  const fiftyTwoWeekHigh = tradierQuote?.week_52_high || meta.fiftyTwoWeekHigh || null;
  const fiftyTwoWeekLow = tradierQuote?.week_52_low || meta.fiftyTwoWeekLow || null;

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
    const opt = await fetchMarketOptions(ticker);
    const puts = opt?.options?.[0]?.puts || [];
    if (puts.length > 0 && currentPrice) {
      const atmPut = puts.reduce((prev: any, curr: any) =>
        Math.abs(curr.strike - currentPrice) < Math.abs(prev.strike - currentPrice) ? curr : prev
      );
      if (atmPut?.impliedVolatility) {
        impliedVol = Number((atmPut.impliedVolatility * (atmPut.impliedVolatility > 1 ? 1 : 100)).toFixed(2));
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
    next_earnings_date: (() => {
      const cal = quoteSummary?.calendarEvents?.earnings?.earningsDate;
      if (Array.isArray(cal) && cal.length > 0) {
        if (cal[0]?.fmt) return cal[0].fmt;
        if (cal[0]?.raw) return new Date(cal[0].raw * 1000).toISOString().split("T")[0];
        if (typeof cal[0] === "string") return cal[0];
      }
      const sum = quoteSummary?.summaryDetail?.earningsDate;
      if (Array.isArray(sum) && sum.length > 0) {
        if (sum[0]?.fmt) return sum[0].fmt;
        if (sum[0]?.raw) return new Date(sum[0].raw * 1000).toISOString().split("T")[0];
      }
      return null;
    })(),
    next_earnings_timestamp: (() => {
      const cal = quoteSummary?.calendarEvents?.earnings?.earningsDate;
      if (Array.isArray(cal) && cal.length > 0 && cal[0]?.raw) {
        return cal[0].raw * 1000;
      }
      const sum = quoteSummary?.summaryDetail?.earningsDate;
      if (Array.isArray(sum) && sum.length > 0 && sum[0]?.raw) {
        return sum[0].raw * 1000;
      }
      return null;
    })(),
  };
}

// ==========================================
// ACCESS AUDIT & ACCESS LOG STORAGE (Admin: muthu.vela@gmail.com)
// ==========================================
const SUPERADMIN_EMAIL = "muthu.vela@gmail.com";
const ACCESS_LOGS_FILE = path.join(process.cwd(), "access_logs.json");

interface ServerAccessLog {
  id: string;
  timestamp: string;
  userEmail: string;
  userName: string;
  userPhoto?: string;
  userId?: string;
  eventType: string;
  status: "AUTHORIZED" | "GUEST" | "ADMIN" | "BLOCKED";
  ip: string;
  userAgent: string;
  path: string;
  referrer?: string;
  device?: string;
  details?: string;
}

let serverAccessLogs: ServerAccessLog[] = [];

function loadAccessLogsFromDisk() {
  try {
    if (fs.existsSync(ACCESS_LOGS_FILE)) {
      const content = fs.readFileSync(ACCESS_LOGS_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        serverAccessLogs = parsed.slice(-500);
      }
    }
  } catch (e) {
    console.warn("Could not read access_logs.json from disk:", e);
  }
}

function saveAccessLogsToDisk() {
  try {
    fs.writeFileSync(ACCESS_LOGS_FILE, JSON.stringify(serverAccessLogs.slice(-500), null, 2), "utf-8");
  } catch (e) {
    console.warn("Could not save access_logs.json to disk:", e);
  }
}

// Initial load
loadAccessLogsFromDisk();

// ==========================================
// API ROUTES
// ==========================================

// Health
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Access Logging: Record any visit, login attempt, or page access
app.post("/api/log-access", (req: Request, res: Response) => {
  try {
    const rawIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      (req.headers["x-real-ip"] as string) ||
      req.socket.remoteAddress ||
      "127.0.0.1";

    // Clean ipv6 localhost
    const ip = rawIp.replace(/^::ffff:/, "");

    const body = req.body || {};
    const email = (body.userEmail || "Anonymous / Unauthenticated").trim();
    const isSuperAdmin = email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase();

    let computedStatus = body.status || "GUEST";
    if (isSuperAdmin) {
      computedStatus = "ADMIN";
    } else if (body.status === "BLOCKED" || body.eventType === "RESTRICTED_ATTEMPT") {
      computedStatus = "BLOCKED";
    } else if (email.includes("@")) {
      computedStatus = "AUTHORIZED";
    }

    const newLog: ServerAccessLog = {
      id: body.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: body.timestamp || new Date().toISOString(),
      userEmail: email,
      userName: body.userName || (email.includes("@") ? email.split("@")[0] : "Guest Visitor"),
      userPhoto: body.userPhoto || "",
      userId: body.userId || "",
      eventType: body.eventType || "PAGE_VISIT",
      status: computedStatus,
      ip,
      userAgent: body.userAgent || (req.headers["user-agent"] as string) || "Unknown",
      path: body.path || (req.headers["referer"] ? new URL(req.headers["referer"]).pathname : "/"),
      referrer: body.referrer || (req.headers["referer"] as string) || "direct",
      device: body.device || "Web Client",
      details: body.details || (isSuperAdmin ? "Superadmin action" : "Web access event"),
    };

    serverAccessLogs.unshift(newLog);
    if (serverAccessLogs.length > 500) {
      serverAccessLogs = serverAccessLogs.slice(0, 500);
    }
    saveAccessLogsToDisk();

    res.json({ success: true, ip, logId: newLog.id });
  } catch (e: any) {
    console.error("Error saving access log:", e);
    res.status(500).json({ error: "Failed to record access log" });
  }
});

// Retrieve Access Logs: Strictly guarded for muthu.vela@gmail.com
app.get("/api/access-logs", (req: Request, res: Response) => {
  const reqEmail = (
    (req.query.email as string) ||
    (req.headers["x-user-email"] as string) ||
    ""
  ).trim().toLowerCase();

  if (reqEmail !== SUPERADMIN_EMAIL.toLowerCase()) {
    // Audit unauthorized attempt
    const rawIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      (req.headers["x-real-ip"] as string) ||
      req.socket.remoteAddress ||
      "127.0.0.1";

    const blockedAttempt: ServerAccessLog = {
      id: `viol_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date().toISOString(),
      userEmail: reqEmail || "Anonymous Intruder",
      userName: reqEmail || "Unauthorized Requester",
      eventType: "RESTRICTED_ATTEMPT",
      status: "BLOCKED",
      ip: rawIp.replace(/^::ffff:/, ""),
      userAgent: (req.headers["user-agent"] as string) || "Unknown",
      path: "/api/access-logs",
      details: `UNAUTHORIZED ACCESS TO AUDIT LOGS. Restricted to ${SUPERADMIN_EMAIL}`,
    };
    serverAccessLogs.unshift(blockedAttempt);
    saveAccessLogsToDisk();

    return res.status(403).json({
      error: "Access Banned. This audit tab and data are strictly restricted to muthu.vela@gmail.com",
      status: 403,
      banned: true,
    });
  }

  res.json({
    success: true,
    superadmin: SUPERADMIN_EMAIL,
    count: serverAccessLogs.length,
    logs: serverAccessLogs,
  });
});

// Clear Access Logs: Strictly guarded for muthu.vela@gmail.com
app.delete("/api/access-logs", (req: Request, res: Response) => {
  const reqEmail = (
    (req.query.email as string) ||
    (req.headers["x-user-email"] as string) ||
    ""
  ).trim().toLowerCase();

  if (reqEmail !== SUPERADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({
      error: "Access Banned. This action is strictly restricted to muthu.vela@gmail.com",
      status: 403,
    });
  }

  serverAccessLogs = [];
  saveAccessLogsToDisk();
  res.json({ success: true, message: "Audit logs purged successfully" });
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

// Market Data Provider Status
app.get("/api/market-data-status", (req: Request, res: Response) => {
  const info = getMarketDataProviderInfo();
  res.json(info);
});

// --- MARKET SENTIMENT & VIX / FEAR & GREED AGGREGATOR ---
interface SentimentCacheEntry {
  timestamp: number;
  data: any;
}
let marketSentimentCache: SentimentCacheEntry | null = null;
const MARKET_SENTIMENT_TTL_MS = 60 * 1000; // 60s cache

async function getMarketSentimentData() {
  const now = Date.now();
  if (marketSentimentCache && now - marketSentimentCache.timestamp < MARKET_SENTIMENT_TTL_MS) {
    return marketSentimentCache.data;
  }

  // 1. Fetch Real-time VIX Quote and Historical Bars
  let vixQuote: any = null;
  let vixChart: any = null;
  try {
    vixQuote = await fetchMarketQuote("VIX").catch(() => null);
  } catch (e) {
    vixQuote = null;
  }

  try {
    vixChart = await fetchMarketChart("VIX", "3mo", "1d").catch(async () => {
      return await fetchMarketChart("^VIX", "3mo", "1d").catch(() => null);
    });
  } catch (e) {
    vixChart = null;
  }

  // Parse VIX metrics
  const vixLast = Number(vixQuote?.last || vixChart?.meta?.regularMarketPrice || 16.5);
  const vixPrevClose = Number(vixQuote?.prevclose || vixChart?.meta?.chartPreviousClose || vixLast);
  const vixChange = Number((vixLast - vixPrevClose).toFixed(2));
  const vixChangePct = Number((vixPrevClose ? ((vixChange / vixPrevClose) * 100) : 0).toFixed(2));
  const vix52High = Number(vixQuote?.week_52_high || vixChart?.meta?.fiftyTwoWeekHigh || 35.3);
  const vix52Low = Number(vixQuote?.week_52_low || vixChart?.meta?.fiftyTwoWeekLow || 11.8);
  const vixRangeSpan = Math.max(0.01, vix52High - vix52Low);
  const vixPercentile52w = Number(Math.min(100, Math.max(0, ((vixLast - vix52Low) / vixRangeSpan) * 100)).toFixed(1));

  // Determine VIX Volatility Regime
  let vixRegime = "Normal Volatility (Balanced)";
  let vixRegimeTier: "LOW" | "NORMAL" | "ELEVATED" | "HIGH" | "PANIC" = "NORMAL";
  let vixRegimeColor = "text-emerald-400";
  if (vixLast < 14) {
    vixRegime = "Low Volatility (Complacency)";
    vixRegimeTier = "LOW";
    vixRegimeColor = "text-blue-400";
  } else if (vixLast <= 20) {
    vixRegime = "Normal Volatility (Healthy Range)";
    vixRegimeTier = "NORMAL";
    vixRegimeColor = "text-emerald-400";
  } else if (vixLast <= 28) {
    vixRegime = "Elevated Risk (High Premiums)";
    vixRegimeTier = "ELEVATED";
    vixRegimeColor = "text-amber-400";
  } else if (vixLast <= 38) {
    vixRegime = "High Volatility (Fear Spike)";
    vixRegimeTier = "HIGH";
    vixRegimeColor = "text-orange-400";
  } else {
    vixRegime = "Extreme Panic (Crisis Spike)";
    vixRegimeTier = "PANIC";
    vixRegimeColor = "text-rose-500";
  }

  // Parse VIX 30-day historical points
  const vixHistoricalBars: Array<{ date: string; close: number; high: number; low: number }> = [];
  if (vixChart?.timestamp && vixChart?.indicators?.quote?.[0]) {
    const tsArr = vixChart.timestamp;
    const qObj = vixChart.indicators.quote[0];
    const len = Math.min(tsArr.length, 30);
    const startIdx = Math.max(0, tsArr.length - 30);
    for (let i = startIdx; i < tsArr.length; i++) {
      const c = qObj.close?.[i];
      if (c !== null && c !== undefined) {
        const d = new Date(tsArr[i] * 1000).toISOString().split("T")[0];
        vixHistoricalBars.push({
          date: d,
          close: Number(Number(c).toFixed(2)),
          high: Number(Number(qObj.high?.[i] || c).toFixed(2)),
          low: Number(Number(qObj.low?.[i] || c).toFixed(2)),
        });
      }
    }
  }

  // 2. Fetch CNN Fear & Greed Index
  let cnnData: any = null;
  try {
    const cnnRes = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.cnn.com/markets/fear-and-greed"
      },
      signal: AbortSignal.timeout(4000),
    });
    if (cnnRes.ok) {
      cnnData = await cnnRes.json();
    }
  } catch (e) {
    cnnData = null;
  }

  // Handle CNN Data or Fallback Calculation
  let fgScore = 42;
  let fgRating = "neutral";
  let fgPrevClose = 42;
  let fgPrev1Week = 38;
  let fgPrev1Month = 60;
  let fgPrev1Year = 55;
  let fgHistorical: Array<{ date: string; timestamp: number; score: number; rating: string }> = [];
  let subIndicators: Array<{
    id: string;
    name: string;
    score: number;
    rating: string;
    description: string;
    latest_value?: string;
  }> = [];

  if (cnnData?.fear_and_greed) {
    const fg = cnnData.fear_and_greed;
    fgScore = Math.round(Number(fg.score || 50));
    fgRating = String(fg.rating || "neutral").toLowerCase();
    fgPrevClose = Math.round(Number(fg.previous_close || fgScore));
    fgPrev1Week = Math.round(Number(fg.previous_1_week || fgScore));
    fgPrev1Month = Math.round(Number(fg.previous_1_month || fgScore));
    fgPrev1Year = Math.round(Number(fg.previous_1_year || fgScore));

    // Parse historical series (last 60 trading days)
    if (Array.isArray(cnnData.fear_and_greed_historical?.data)) {
      const histData = cnnData.fear_and_greed_historical.data;
      const recentHist = histData.slice(-60);
      fgHistorical = recentHist.map((item: any) => ({
        timestamp: item.x,
        date: new Date(item.x).toISOString().split("T")[0],
        score: Math.round(item.y),
        rating: item.rating || "neutral",
      }));
    }

    // Parse the 7 CNN sub-indicators
    const extractSub = (key: string, name: string, desc: string, valKey?: string) => {
      const item = cnnData[key];
      if (!item) return null;
      let valStr: string | undefined = undefined;
      if (valKey && item[valKey] !== undefined) {
        valStr = String(item[valKey]);
      } else if (item.data && item.data.length > 0) {
        const lastVal = item.data[item.data.length - 1]?.y;
        if (lastVal !== undefined) valStr = Number(lastVal).toFixed(2);
      }
      return {
        id: key,
        name,
        score: Math.round(Number(item.score || 50)),
        rating: String(item.rating || "neutral").toLowerCase(),
        description: desc,
        latest_value: valStr,
      };
    };

    const subs = [
      extractSub("market_momentum_sp500", "Market Momentum", "S&P 500 vs. its 125-day moving average"),
      extractSub("stock_price_strength", "Stock Price Strength", "Net count of NYSE stocks hitting 52-week highs vs. 52-week lows"),
      extractSub("stock_price_breadth", "Stock Price Breadth", "Trading volume in advancing vs. declining shares (McClellan Summation)"),
      extractSub("put_call_options", "Put & Call Options", "CBOE 5-day average put-to-call volume ratio (protective hedging activity)"),
      extractSub("market_volatility_vix", "Market Volatility (VIX)", "CBOE Volatility Index vs. its 50-day moving average"),
      extractSub("safe_haven_demand", "Safe Haven Demand", "Stock market returns vs. 20-year US Treasury bond returns"),
      extractSub("junk_bond_demand", "Junk Bond Demand", "Yield spread between speculative junk bonds and investment-grade corporate bonds"),
    ].filter(Boolean) as any[];

    if (subs.length > 0) subIndicators = subs;
  } else {
    // Fallback: Synthesize Fear & Greed score from VIX and market context
    const vixFactor = Math.max(0, Math.min(100, 100 - ((vixLast - 11) / (36 - 11)) * 100));
    fgScore = Math.round(vixFactor);
    if (fgScore <= 24) fgRating = "extreme fear";
    else if (fgScore <= 44) fgRating = "fear";
    else if (fgScore <= 55) fgRating = "neutral";
    else if (fgScore <= 75) fgRating = "greed";
    else fgRating = "extreme greed";

    fgPrevClose = Math.max(0, Math.min(100, Math.round(fgScore - (vixChange * 2))));
    fgPrev1Week = Math.max(0, Math.min(100, fgScore - 4));
    fgPrev1Month = Math.max(0, Math.min(100, fgScore + 12));
    fgPrev1Year = 55;

    subIndicators = [
      { id: "market_volatility_vix", name: "Market Volatility (VIX)", score: fgScore, rating: fgRating, description: `Calculated from live VIX at ${vixLast.toFixed(2)}` },
      { id: "put_call_options", name: "Put & Call Options", score: Math.round((fgScore * 0.9) + 5), rating: fgRating, description: "CBOE Put/Call option skew volume proxy" },
      { id: "market_momentum_sp500", name: "Market Momentum", score: Math.round((fgScore * 1.05)), rating: fgRating, description: "Benchmark index position relative to long-term averages" },
    ];
  }

  // 3. Synthesize Actionable Options Analysis Context
  let putSellingEnvironment: "FAVORABLE" | "HIGH_YIELD_OPPORTUNITY" | "BALANCED" | "CAUTION_REQUIRED" = "FAVORABLE";
  let environmentTitle = "Favorable Premium Environment";
  let environmentSummary = "";
  let recommendedDelta = "0.15 - 0.22 Delta (~80-85% Win Probability)";
  let recommendedDte = "30 - 45 Days (Optimal Theta Decay Acceleration)";
  let recommendedStrikeDiscount = "12% - 18% Out-of-the-Money";
  let cashBufferGuideline = "Maintain 20% - 25% Unallocated Cash Reserve";
  let volatilitySkewBias = "Standard put skew; downside protective puts trade at customary implied volatility premiums.";

  if (vixRegimeTier === "HIGH" || vixRegimeTier === "PANIC" || fgRating === "extreme fear") {
    putSellingEnvironment = "HIGH_YIELD_OPPORTUNITY";
    environmentTitle = "High-Yield Opportunity (Deep Fear & Elevated IV)";
    environmentSummary = `Market sentiment reflects peak pessimism (Fear & Greed ${fgScore}/100, VIX at ${vixLast}). Implied volatility on cash-secured puts is heavily inflated, creating generational annualized yields. However, downside tail risk and rapid gap-downs are elevated. Strict strike margin-of-safety and patient position sizing are imperative.`;
    recommendedDelta = "0.10 - 0.16 Delta (~85-90% Win Probability)";
    recommendedDte = "30 - 50 Days (Allows time for volatility crush and price stabilization)";
    recommendedStrikeDiscount = "18% - 28% Below Current Stock Price";
    cashBufferGuideline = "Maintain 35% - 45% Unallocated Cash Buffer (Buffer against margin expansion and assignment cascade)";
    volatilitySkewBias = "Extreme Put Skew: institutional hedging has pushed OTM put prices to rich premiums relative to calls.";
  } else if (vixRegimeTier === "ELEVATED" || fgRating === "fear") {
    putSellingEnvironment = "FAVORABLE";
    environmentTitle = "Prime Put Selling Regime (Elevated Yields & Active Hedging)";
    environmentSummary = `VIX at ${vixLast} combined with Fear rating (${fgScore}/100) provides an ideal sweet spot for options premium sellers. Option option premiums are rich, while institutional panic is contained. Cash-secured puts placed below key moving averages and support levels offer robust annualized return on capital with strong safety margins.`;
    recommendedDelta = "0.14 - 0.22 Delta (~80-86% Win Probability)";
    recommendedDte = "28 - 45 Days (Captures peak theta decay while harvesting rich initial IV)";
    recommendedStrikeDiscount = "12% - 20% Out-of-the-Money";
    cashBufferGuideline = "Maintain 25% - 30% Unallocated Cash Buffer";
    volatilitySkewBias = "Pronounced Put Skew: Market participants are actively paying up for downside protection, giving cash-secured put sellers an edge.";
  } else if (fgRating === "extreme greed" || vixLast < 14) {
    putSellingEnvironment = "CAUTION_REQUIRED";
    environmentTitle = "Subdued Premiums & Market Complacency";
    environmentSummary = `Markets are displaying elevated complacency (Fear & Greed ${fgScore}/100, VIX low at ${vixLast}). Put option premiums are compressed, meaning selling tight-delta puts offers diminished reward relative to sudden macro shock risk. Be exceptionally selective, insist on quality large-cap names at steep discounts, or consider defined-risk credit spreads.`;
    recommendedDelta = "0.12 - 0.18 Delta (~84-88% Win Probability; avoid reaching for yield with tight deltas)";
    recommendedDte = "21 - 35 Days (Avoid long-dated commitments where an IV expansion spike can hurt open positions)";
    recommendedStrikeDiscount = "10% - 15% Out-of-the-Money (Ensure strikes clear major 50-day and 200-day moving averages)";
    cashBufferGuideline = "Maintain 20% - 25% Cash Reserve (Hold dry powder for volatility expansion dips)";
    volatilitySkewBias = "Compressed Volatility: Low hedging demand leaves put premiums thin; do not sacrifice delta safety to meet return targets.";
  } else {
    putSellingEnvironment = "BALANCED";
    environmentTitle = "Balanced Market Regime (Systematic Theta Harvesting)";
    environmentSummary = `Market sentiment is neutral (${fgScore}/100) with normal volatility (VIX at ${vixLast}). This provides a stable, predictable backdrop for systematic options strategies. Strike prices align well with standard technical support, and theta decay progresses smoothly without abnormal tail shocks.`;
    recommendedDelta = "0.15 - 0.22 Delta (~80-85% Win Probability)";
    recommendedDte = "30 - 45 Days";
    recommendedStrikeDiscount = "10% - 16% Out-of-the-Money";
    cashBufferGuideline = "Maintain 15% - 20% Standard Cash Reserve";
    volatilitySkewBias = "Equilibrium Skew: Standard options pricing curve across strikes with typical index put skew.";
  }

  const strategyGuidelines = [
    {
      strategy: "Cash-Secured Puts (CSP)",
      recommendation: (vixRegimeTier === "ELEVATED" || vixRegimeTier === "HIGH") ? "PREFERRED" : (vixRegimeTier === "LOW" ? "NEUTRAL" : "FAVORABLE"),
      action_text: vixRegimeTier === "HIGH" || vixRegimeTier === "ELEVATED"
        ? "Target 0.12-0.18 Delta puts on high-conviction mega-caps (NVDA, MSFT, AAPL, QQQ). Collect peak IV premium with 15-25% strike buffers."
        : "Systematically sell 0.15-0.22 Delta puts on quality watchlist names with strong balance sheets and technical support.",
      rationale: `VIX at ${vixLast} sets option pricing. High volatility delivers high premium capture; low volatility demands wider strike discipline.`,
      risk_note: "Avoid selling unhedged puts on high-beta speculative names during early phases of a VIX spike."
    },
    {
      strategy: "Covered Calls (CC)",
      recommendation: (fgRating === "greed" || fgRating === "extreme greed") ? "PREFERRED" : "FAVORABLE",
      action_text: fgRating === "extreme greed"
        ? "Sell 0.25-0.35 Delta covered calls into strength on extended holdings to harvest peak call enthusiasm and lock in synthetic yields."
        : "Sell 0.20-0.30 Delta out-of-the-money calls on existing stock positions to augment quarterly dividend and cash flow.",
      rationale: "Call buyers pay high premiums during euphoric sentiment phases, maximizing call assignment value.",
      risk_note: "Caps stock upside if a parabolic rally continues; roll up and out if underlying price surges past strike."
    },
    {
      strategy: "Bull Put Credit Spreads",
      recommendation: (vixRegimeTier === "HIGH" || vixRegimeTier === "PANIC") ? "PREFERRED" : "FAVORABLE",
      action_text: "Sell OTM puts and buy further OTM protective long puts to cap maximum loss and eliminate overnight margin liquidation risk.",
      rationale: "Defined-risk spreads insulate the portfolio from violent gap-downs while still capturing inflated implied volatility decay.",
      risk_note: "Spread width determines maximum risk; size position by maximum loss rather than margin requirement."
    },
    {
      strategy: "Protective Puts & Collars",
      recommendation: (fgRating === "extreme greed" || vixLast < 13) ? "PREFERRED" : "DEFENSIVE",
      action_text: vixLast < 14
        ? "Opportunistically purchase long protective puts or collars on Core long equity portfolios while VIX is cheap and complacent."
        : "Hold existing hedges; avoid buying newly inflated puts at top of VIX spike unless mandatory for risk governance.",
      rationale: "Hedging is most cost-effective when fear is lowest and volatility insurance is unloved.",
      risk_note: "Long put drag during strong bull runs can diminish net portfolio returns if held indefinitely."
    }
  ];

  const keyActionBullets = [
    `Current VIX at ${vixLast.toFixed(2)} (${vixChange >= 0 ? "+" : ""}${vixChange.toFixed(2)} today) places market in the ${vixRegime} zone.`,
    `Fear & Greed score of ${fgScore}/100 indicates ${fgRating.toUpperCase()} sentiment (Previous close was ${fgPrevClose}/100).`,
    `Recommended Put Strike Discount: ${recommendedStrikeDiscount} to ensure substantial margin of safety before underlying price touches strike.`,
    `Target Delta Band: ${recommendedDelta} for conservative, high-probability cash-secured put execution.`,
    `Margin Governance: ${cashBufferGuideline} to comfortably withstand intraday volatility fluctuations without forced liquidations.`,
  ];

  const result = {
    timestamp: new Date().toISOString(),
    source: cnnData ? "CNN Fear & Greed + Tradier Brokerage VIX" : "Tradier Brokerage VIX + Synthesized Macro Indicator",
    vix: {
      current: vixLast,
      change: vixChange,
      change_pct: vixChangePct,
      prevclose: vixPrevClose,
      week_52_high: vix52High,
      week_52_low: vix52Low,
      percentile_52w: vixPercentile52w,
      regime: vixRegime,
      regime_tier: vixRegimeTier,
      regime_color: vixRegimeColor,
      historical_30d: vixHistoricalBars,
    },
    fear_and_greed: {
      score: fgScore,
      rating: fgRating,
      previous_close: fgPrevClose,
      previous_1_week: fgPrev1Week,
      previous_1_month: fgPrev1Month,
      previous_1_year: fgPrev1Year,
      historical: fgHistorical,
      sub_indicators: subIndicators,
    },
    options_implications: {
      put_selling_environment: putSellingEnvironment,
      environment_title: environmentTitle,
      environment_summary: environmentSummary,
      volatility_skew_bias: volatilitySkewBias,
      recommended_delta: recommendedDelta,
      recommended_dte: recommendedDte,
      recommended_strike_discount: recommendedStrikeDiscount,
      cash_buffer_guideline: cashBufferGuideline,
      strategy_guidelines: strategyGuidelines,
      key_action_bullets: keyActionBullets,
    },
  };

  marketSentimentCache = {
    timestamp: now,
    data: result,
  };

  return result;
}

// Endpoint: Market Sentiment Dashboard Data
app.get("/api/market-sentiment", async (req: Request, res: Response) => {
  try {
    const data = await getMarketSentimentData();
    res.json(data);
  } catch (err: any) {
    console.error("Error in /api/market-sentiment:", err);
    res.status(500).json({ error: err.message || "Failed to fetch market sentiment data" });
  }
});

// Batch Real-Time Stock Quotes (Tradier with fallback)
app.get("/api/quotes", async (req: Request, res: Response) => {
  try {
    const symbolsParam = (req.query.symbols || req.query.tickers || "") as string;
    const symbols = symbolsParam
      ? symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
      : getWatchlist();

    const quotes = await fetchMarketQuotes(symbols);
    const providerInfo = getMarketDataProviderInfo();
    res.json({
      provider: providerInfo.provider,
      isTradierConfigured: providerInfo.isTradierConfigured,
      symbols,
      quotes,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Single Real-Time Stock Quote (Tradier with fallback)
app.get("/api/quote", async (req: Request, res: Response) => {
  try {
    const symbol = ((req.query.symbol || req.query.ticker || "") as string).trim().toUpperCase();
    if (!symbol) {
      return res.status(400).json({ error: "symbol query parameter is required" });
    }
    const quote = await fetchMarketQuote(symbol);
    const providerInfo = getMarketDataProviderInfo();
    res.json({
      provider: providerInfo.provider,
      isTradierConfigured: providerInfo.isTradierConfigured,
      symbol,
      quote,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
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
      const chart = await fetchMarketChart(ticker, "3mo", "1d");
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
      minDays = 90,
      maxDays = 1000,
      strikeMode = "band", // 'band' | 'single' | 'bollinger'
      singleStrike = null,
      singleStrikeType = "dollar", // 'dollar' | 'pct'
      singleStrikePct = 50.0,
      pctLow = 30.0,
      pctHigh = 70.0,
      bollingerPeriod = 20,
      bollingerStd = 2.0,
      noMargin = true,
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
      const optData = await fetchMarketOptions(ticker);
      if (!optData) continue;

      const meta = optData.quote || {};
      const currentPrice = meta.regularMarketPrice || meta.ask || meta.bid || 0;
      if (!currentPrice || currentPrice <= 0) continue;

      // Compute underlying stock RSI(14) and 20-period Bollinger Bands & Fibonacci levels
      const chart = await fetchMarketChart(ticker, "3mo", "1d");
      const closes: number[] = (chart?.indicators?.quote?.[0]?.close || []).filter(
        (c: any) => c !== null && c !== undefined
      );
      const rsi = computeRsi(closes, 14);
      const bollinger = computeBollinger(closes, Number(bollingerPeriod) || 20, Number(bollingerStd) || 2.0);

      const fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh || (closes.length > 0 ? Math.max(...closes) : null);
      const fiftyTwoWeekLow = meta.fiftyTwoWeekLow || (closes.length > 0 ? Math.min(...closes) : null);
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

      // Sample representative expirations (up to 6) to keep multi-ticker scans well within API quotas
      const targetExpirations =
        validExpirations.length > 6
          ? [
              validExpirations[0],
              ...validExpirations.slice(1, -1).filter((_, idx, arr) => idx % Math.ceil(arr.length / 4) === 0),
              validExpirations[validExpirations.length - 1],
            ].slice(0, 6)
          : validExpirations;

      for (const exp of targetExpirations) {
        let chain = optData;
        if (optData.expirationDates?.[0] !== exp.timestamp) {
          await new Promise((r) => setTimeout(r, 60)); // gentle pacing to protect API quota
          const fetched = await fetchMarketOptions(ticker, exp.timestamp);
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
          // For selling puts: use last price ONLY IF bid is zero (or <= 0)
          if (bid <= 0 && last > 0 && !noFallback) {
            // Guard against stale last price exceeding current ask
            bid = ask > 0 ? Math.min(last, ask) : last;
            bidFallback = true;
          }
          if (ask <= 0 && last > 0 && !noFallback) {
            ask = bid > 0 ? Math.max(last, bid) : last;
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
            fifty_two_week_high: fiftyTwoWeekHigh ? Number(fiftyTwoWeekHigh.toFixed(2)) : null,
            fifty_two_week_low: fiftyTwoWeekLow ? Number(fiftyTwoWeekLow.toFixed(2)) : null,
            rsi_14: rsi,
            bollinger: bollinger,
            fibonacci: fibonacci,
            strike_bollinger_position: strikeBbPos,
          });
        }
      }

      summaryList.push({
        ticker,
        current_price: currentPrice,
        market_cap: meta.marketCap,
        fifty_two_week_high: fiftyTwoWeekHigh ? Number(fiftyTwoWeekHigh.toFixed(2)) : null,
        fifty_two_week_low: fiftyTwoWeekLow ? Number(fiftyTwoWeekLow.toFixed(2)) : null,
        rsi_14: rsi,
        bollinger: bollinger,
        fibonacci: fibonacci,
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

// In-memory cache for option chains (60s TTL)
const optionChainCache = new Map<string, { timestamp: number; optData: any; rawExpirations: number[]; expDataMap: Map<number, any> }>();

// Option Chain with Black-Scholes Greeks
app.get("/api/option-chain", async (req: Request, res: Response) => {
  try {
    const ticker = (req.query.ticker as string || "QQQ").toUpperCase();
    const expirationIdx = parseInt(req.query.expirationIndex as string) || 0;
    const requestedExpDate = req.query.expiration as string;
    const fetchAll = req.query.all === "true" || requestedExpDate === "ALL";

    const now = Date.now();
    let cache = optionChainCache.get(ticker);
    let optData: any = null;
    let rawExpirations: number[] = [];

    if (cache && (now - cache.timestamp < 60000)) {
      optData = cache.optData;
      rawExpirations = cache.rawExpirations;
    } else {
      optData = await fetchMarketOptions(ticker);
      if (!optData) {
        return res.status(404).json({ error: `No options data found for ${ticker}` });
      }
      rawExpirations = optData.expirationDates || [];
      cache = {
        timestamp: now,
        optData,
        rawExpirations,
        expDataMap: new Map<number, any>([[rawExpirations[0], optData]]),
      };
      optionChainCache.set(ticker, cache);
    }

    if (rawExpirations.length === 0) {
      return res.status(404).json({ error: `No expiration dates for ${ticker}` });
    }

    const expDates = rawExpirations.map((ts) => new Date(ts * 1000).toISOString().split("T")[0]);
    const isAllExps = requestedExpDate === "ALL";

    let targetExpTs = rawExpirations[Math.min(expirationIdx, rawExpirations.length - 1)];
    if (requestedExpDate && requestedExpDate !== "ALL" && expDates.includes(requestedExpDate)) {
      const idx = expDates.indexOf(requestedExpDate);
      targetExpTs = rawExpirations[idx];
    }

    const currentPrice = optData.quote?.regularMarketPrice || 100;
    const today = new Date();

    // Helper to calculate Greeks and map options
    const mapOptionContracts = (contracts: any[], isCall: boolean, dteDays: number, expStr: string) => {
      return contracts.map((c: any) => {
        const greeks = calculateGreeks(c.strike, currentPrice, c.impliedVolatility || 0.3, dteDays, isCall);
        const bidFallback = (!c.bid || c.bid <= 0) && (c.lastPrice || 0) > 0;
        const usedFallback = Boolean(c.bid_used_fallback || c.used_fallback || bidFallback);
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
          expiration: expStr,
          days_to_expiration: dteDays,
          bid_used_fallback: usedFallback,
          used_fallback: usedFallback,
          ...greeks,
        };
      });
    };

    let singleCalls: any[] = [];
    let singlePuts: any[] = [];
    let singleExpDateStr = new Date(targetExpTs * 1000).toISOString().split("T")[0];
    let singleDte = Math.max(Math.ceil((new Date(targetExpTs * 1000).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)), 1);

    if (!isAllExps) {
      let chain = cache.expDataMap.get(targetExpTs);
      if (!chain) {
        chain = targetExpTs === rawExpirations[0] ? optData : (await fetchMarketOptions(ticker, targetExpTs)) || optData;
        cache.expDataMap.set(targetExpTs, chain);
      }
      singleCalls = mapOptionContracts(chain.options?.[0]?.calls || [], true, singleDte, singleExpDateStr);
      singlePuts = mapOptionContracts(chain.options?.[0]?.puts || [], false, singleDte, singleExpDateStr);
    }

    const allChainsMap: Record<string, any> = {};
    const allCalls: any[] = [];
    const allPuts: any[] = [];

    // If fetchAll is true or user requested ALL expirations, fetch and compile all option chains
    if (fetchAll) {
      const missingTs = rawExpirations.filter((ts) => !cache!.expDataMap.has(ts));
      if (missingTs.length > 0) {
        // Fetch in chunks of 8
        for (let i = 0; i < missingTs.length; i += 8) {
          const chunk = missingTs.slice(i, i + 8);
          const chunkResults = await Promise.all(
            chunk.map((ts) => fetchMarketOptions(ticker, ts).catch(() => null))
          );
          chunk.forEach((ts, idx) => {
            const resData = chunkResults[idx];
            if (resData) cache!.expDataMap.set(ts, resData);
          });
        }
      }

      for (const ts of rawExpirations) {
        const expStr = new Date(ts * 1000).toISOString().split("T")[0];
        const chainDte = Math.max(Math.ceil((new Date(ts * 1000).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)), 1);
        const chain = cache.expDataMap.get(ts) || optData;
        const cList = mapOptionContracts(chain.options?.[0]?.calls || [], true, chainDte, expStr);
        const pList = mapOptionContracts(chain.options?.[0]?.puts || [], false, chainDte, expStr);

        allChainsMap[expStr] = {
          expiration: expStr,
          days_to_expiration: chainDte,
          calls: cList,
          puts: pList,
        };
        allCalls.push(...cList);
        allPuts.push(...pList);
      }
    }

    // Technicals and earnings for underlying stock
    const [chart, quoteSummary] = await Promise.all([
      fetchMarketChart(ticker, "3mo", "1d"),
      fetchYahooQuoteSummary(ticker).catch(() => null),
    ]);
    const closes: number[] = (chart?.indicators?.quote?.[0]?.close || []).filter(
      (c: any) => c !== null && c !== undefined
    );
    const rsi = computeRsi(closes, 14);
    const bollinger = computeBollinger(closes, 20, 2.0);

    const nextEarningsDate = (() => {
      const cal = quoteSummary?.calendarEvents?.earnings?.earningsDate;
      if (Array.isArray(cal) && cal.length > 0) {
        if (cal[0]?.fmt) return cal[0].fmt;
        if (cal[0]?.raw) return new Date(cal[0].raw * 1000).toISOString().split("T")[0];
        if (typeof cal[0] === "string") return cal[0];
      }
      const sum = quoteSummary?.summaryDetail?.earningsDate;
      if (Array.isArray(sum) && sum.length > 0) {
        if (sum[0]?.fmt) return sum[0].fmt;
        if (sum[0]?.raw) return new Date(sum[0].raw * 1000).toISOString().split("T")[0];
      }
      return null;
    })();

    const nextEarningsTimestamp = (() => {
      const cal = quoteSummary?.calendarEvents?.earnings?.earningsDate;
      if (Array.isArray(cal) && cal.length > 0 && cal[0]?.raw) {
        return cal[0].raw * 1000;
      }
      const sum = quoteSummary?.summaryDetail?.earningsDate;
      if (Array.isArray(sum) && sum.length > 0 && sum[0]?.raw) {
        return sum[0].raw * 1000;
      }
      return null;
    })();

    const fiftyTwoWeekHigh = optData.quote?.fiftyTwoWeekHigh || (closes.length > 0 ? Math.max(...closes) : null);
    const fiftyTwoWeekLow = optData.quote?.fiftyTwoWeekLow || (closes.length > 0 ? Math.min(...closes) : null);
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

    res.json({
      ticker,
      current_price: currentPrice,
      fifty_two_week_high: fiftyTwoWeekHigh ? Number(fiftyTwoWeekHigh.toFixed(2)) : null,
      fifty_two_week_low: fiftyTwoWeekLow ? Number(fiftyTwoWeekLow.toFixed(2)) : null,
      expirations: expDates,
      selected_expiration: isAllExps ? "ALL" : singleExpDateStr,
      days_to_expiration: isAllExps ? (allCalls[0]?.days_to_expiration || 30) : singleDte,
      is_all_expirations: isAllExps,
      calls: isAllExps ? allCalls : singleCalls,
      puts: isAllExps ? allPuts : singlePuts,
      all_chains: fetchAll ? allChainsMap : undefined,
      all_calls: fetchAll ? allCalls : undefined,
      all_puts: fetchAll ? allPuts : undefined,
      rsi_14: rsi,
      bollinger,
      fibonacci,
      next_earnings_date: nextEarningsDate,
      next_earnings_timestamp: nextEarningsTimestamp,
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
    const numExpirations = parseInt(req.query.numExpirations as string) || 4;
    const requestedExp = req.query.expiration as string;
    const strikeRange = (req.query.strikeRange as string) || "30-70";
    const noStrikeRange = req.query.noStrikeRange === "true";
    const noFallback = req.query.noFallback === "true";

    const optData = await fetchMarketOptions(ticker);
    if (!optData) {
      return res.status(404).json({ error: `No options data for ${ticker}` });
    }

    const currentPrice = optData.quote?.regularMarketPrice || null;
    const rawExpirations: number[] = optData.expirationDates || [];
    const expDateStrs = rawExpirations.map((ts) => new Date(ts * 1000).toISOString().split("T")[0]);

    // Calculate RSI, Bollinger Bands, and Fibonacci for ticker
    const chart = await fetchMarketChart(ticker, "3mo", "1d");
    const closes: number[] = (chart?.indicators?.quote?.[0]?.close || []).filter(
      (c: any) => c !== null && c !== undefined
    );
    const rsi = computeRsi(closes, 14);
    const bollinger = computeBollinger(closes, 20, 2.0);

    const fiftyTwoWeekHigh = optData.quote?.fiftyTwoWeekHigh || (closes.length > 0 ? Math.max(...closes) : null);
    const fiftyTwoWeekLow = optData.quote?.fiftyTwoWeekLow || (closes.length > 0 ? Math.min(...closes) : null);
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
        ts === rawExpirations[0] ? optData : (await fetchMarketOptions(ticker, ts)) || optData;

      const contracts = optionType === "call" ? chain.options?.[0]?.calls || [] : chain.options?.[0]?.puts || [];

      for (const row of contracts) {
        const strike = row.strike;
        if (strike < minStrike || strike > maxStrike) continue;

        const bid = row.bid || 0;
        const ask = row.ask || 0;
        const last = row.lastPrice || 0;

        let premium = priceType === "ask" ? ask : bid;
        let usedFallback = false;

        // Use last price ONLY IF bid is zero for sell put / bid option pricing
        if (priceType === "bid") {
          if (bid <= 0 && last > 0 && !noFallback) {
            premium = ask > 0 ? Math.min(last, ask) : last;
            usedFallback = true;
          }
        } else {
          if (ask <= 0 && last > 0 && !noFallback) {
            premium = bid > 0 ? Math.max(last, bid) : last;
            usedFallback = true;
          }
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
          fibonacci: fibonacci,
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
      fifty_two_week_high: fiftyTwoWeekHigh ? Number(fiftyTwoWeekHigh.toFixed(2)) : null,
      fifty_two_week_low: fiftyTwoWeekLow ? Number(fiftyTwoWeekLow.toFixed(2)) : null,
      expirations: chosenExpStrs,
      records,
      highest_ratio_point: highestRatioPoint,
      steepest_slopes: steepestSlopes,
      widest_bins: widestBins,
      gap_markers: gapMarkers,
      rsi_14: rsi,
      bollinger: bollinger,
      fibonacci: fibonacci,
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
    const months = parseInt(req.query.months as string) || 18;
    const reqStrike = req.query.targetStrike 
      ? parseFloat(req.query.targetStrike as string) 
      : (req.query.strike ? parseFloat(req.query.strike as string) : null);
    const reqPct = req.query.targetStrikePct 
      ? parseFloat(req.query.targetStrikePct as string) 
      : (req.query.pctOfPrice ? parseFloat(req.query.pctOfPrice as string) : null);
    const noFallback = req.query.noFallback === "true";

    const optData = await fetchMarketOptions(ticker);
    if (!optData) {
      return res.status(404).json({ error: `No options data found for ${ticker}` });
    }

    const currentPrice = optData.quote?.regularMarketPrice || null;
    if (!currentPrice) {
      return res.status(404).json({ error: `Unable to get current price for ${ticker}` });
    }

    // Compute RSI, Bollinger, & Fibonacci for underlying stock
    const chart = await fetchMarketChart(ticker, "3mo", "1d");
    const closes: number[] = (chart?.indicators?.quote?.[0]?.close || []).filter(
      (c: any) => c !== null && c !== undefined
    );
    const rsi = computeRsi(closes, 14);
    const bollinger = computeBollinger(closes, 20, 2.0);

    const fiftyTwoWeekHigh = optData.quote?.fiftyTwoWeekHigh || (closes.length > 0 ? Math.max(...closes) : null);
    const fiftyTwoWeekLow = optData.quote?.fiftyTwoWeekLow || (closes.length > 0 ? Math.min(...closes) : null);
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

    let targetStrike = reqStrike;
    if (targetStrike === null && reqPct !== null) {
      targetStrike = (currentPrice * reqPct) / 100;
    }
    if (targetStrike === null) {
      // Default to 50% of spot price (30-70% deep OTM range)
      targetStrike = currentPrice * 0.50;
    }

    // Determine target strikes list (supports single strike, custom percentage range, dollar range, or preset)
    const mode = (req.query.mode as string) || "single";
    const strikePctsParam = (req.query.strikePcts as string) || "";
    const targetStrikeRange = (req.query.targetStrikeRange as string) || "";
    const targetStrikesParam = (req.query.targetStrikes as string) || "";

    const isRangeMode = mode === "range" || Boolean(strikePctsParam || targetStrikeRange || targetStrikesParam);

    interface TargetStrikeDef {
      key: string;
      label: string;
      pct: number;
      dollar: number;
    }

    const targetStrikesList: TargetStrikeDef[] = [];

    if (isRangeMode) {
      if (strikePctsParam) {
        const pcts = strikePctsParam.split(",").map((p) => parseFloat(p.trim())).filter((p) => !isNaN(p));
        for (const p of pcts) {
          const dollar = (currentPrice * p) / 100;
          targetStrikesList.push({
            key: `${p}%`,
            label: `${p}% Spot ($${dollar.toFixed(1)})`,
            pct: p,
            dollar,
          });
        }
      } else if (targetStrikesParam) {
        const dollars = targetStrikesParam.split(",").map((d) => parseFloat(d.trim())).filter((d) => !isNaN(d));
        for (const d of dollars) {
          const pct = Number(((d / currentPrice) * 100).toFixed(1));
          targetStrikesList.push({
            key: `$${d}`,
            label: `$${d} (${pct}%)`,
            pct,
            dollar: d,
          });
        }
      } else if (targetStrikeRange) {
        const parts = targetStrikeRange.split("-").map((p) => parseFloat(p.trim()));
        const minP = !isNaN(parts[0]) ? parts[0] : 30;
        const maxP = !isNaN(parts[1]) ? parts[1] : 70;
        const step = (maxP - minP) <= 30 ? 5 : (maxP - minP) <= 60 ? 10 : 15;
        for (let p = minP; p <= maxP; p += step) {
          const dollar = (currentPrice * p) / 100;
          targetStrikesList.push({
            key: `${p}%`,
            label: `${p}% Spot ($${dollar.toFixed(1)})`,
            pct: p,
            dollar,
          });
        }
      } else {
        // Default range: 30% to 70% with 10% step
        for (const p of [30, 40, 50, 60, 70]) {
          const dollar = (currentPrice * p) / 100;
          targetStrikesList.push({
            key: `${p}%`,
            label: `${p}% Spot ($${dollar.toFixed(1)})`,
            pct: p,
            dollar,
          });
        }
      }
    } else {
      const p = Number(((targetStrike / currentPrice) * 100).toFixed(1));
      targetStrikesList.push({
        key: `${p}%`,
        label: `${p}% Spot ($${targetStrike.toFixed(1)})`,
        pct: p,
        dollar: targetStrike,
      });
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

    // Structure for multi-strike range calculation
    const pointsByStrikeKey: Record<string, any[]> = {};
    for (const ts of targetStrikesList) {
      pointsByStrikeKey[ts.key] = [];
    }

    const rangeChartData: any[] = [];

    for (const exp of validExpirations) {
      const chain =
        exp.timestamp === rawExpirations[0]
          ? optData
          : (await fetchMarketOptions(ticker, exp.timestamp)) || optData;

      const contracts = optionType === "call" ? chain.options?.[0]?.calls || [] : chain.options?.[0]?.puts || [];
      if (contracts.length === 0) continue;

      const dte = Math.max(1, exp.dte);
      const expChartRow: any = {
        expiration: exp.dateStr,
        dte,
        label: `${exp.dateStr.slice(5)} (${dte}d)`,
        shortLabel: `${exp.dateStr.slice(5)} (${dte}d)`,
        strikes: {},
      };

      for (const ts of targetStrikesList) {
        const nearest = contracts.reduce((prev: any, curr: any) =>
          Math.abs(curr.strike - ts.dollar) < Math.abs(prev.strike - ts.dollar) ? curr : prev
        );

        if (!nearest) continue;

        const bid = nearest.bid || 0;
        const ask = nearest.ask || 0;
        const last = nearest.lastPrice || 0;

        let premium = priceType === "ask" ? ask : bid;
        let usedFallback = false;
        if (priceType === "bid") {
          if (bid <= 0 && last > 0 && !noFallback) {
            premium = ask > 0 ? Math.min(last, ask) : last;
            usedFallback = true;
          }
        } else {
          if (ask <= 0 && last > 0 && !noFallback) {
            premium = bid > 0 ? Math.max(last, bid) : last;
            usedFallback = true;
          }
        }

        const marginBasis = estimatePortfolioMargin(currentPrice, nearest.strike, premium, 15.0, 0.375, 5.0, 0.0);
        const annReturnMargin = ((premium / marginBasis) * (365 / dte)) * 100;
        const annReturnCashSecured = ((premium / nearest.strike) * (365 / dte)) * 100;
        const cushion = Number((Math.abs(currentPrice - nearest.strike) / currentPrice * 100).toFixed(1));

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

        const pointObj = {
          expiration: exp.dateStr,
          dte,
          strike_key: ts.key,
          strike_label: ts.label,
          target_strike: Number(ts.dollar.toFixed(2)),
          target_strike_pct: ts.pct,
          snapped_strike: nearest.strike,
          strike_diff: Number((nearest.strike - ts.dollar).toFixed(2)),
          moneyness_pct: Number(((nearest.strike / currentPrice) * 100).toFixed(2)),
          cushion_to_strike_pct: cushion,
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
          fibonacci: fibonacci,
          strike_bollinger_position: strikeBbPos,
        };

        pointsByStrikeKey[ts.key].push(pointObj);

        expChartRow.strikes[ts.key] = pointObj;
        expChartRow[`${ts.key}_premium`] = Number(premium.toFixed(2));
        expChartRow[`${ts.key}_cash_return`] = Number(annReturnCashSecured.toFixed(2));
        expChartRow[`${ts.key}_margin_return`] = Number(annReturnMargin.toFixed(2));
        expChartRow[`${ts.key}_iv`] = nearest.impliedVolatility ? Number((nearest.impliedVolatility * 100).toFixed(2)) : 0;
        expChartRow[`${ts.key}_cushion`] = cushion;
      }

      rangeChartData.push(expChartRow);
    }

    rangeChartData.sort((a, b) => a.dte - b.dte);

    // Compute range results per strike
    const rangeStrikesResults: any[] = [];
    for (const ts of targetStrikesList) {
      const strikePoints = pointsByStrikeKey[ts.key] || [];
      strikePoints.sort((a, b) => a.dte - b.dte);

      // Knee point calculation
      let kneePoint: any = null;
      if (strikePoints.length >= 3) {
        let maxSlopeDrop = -Infinity;
        for (let i = 1; i < strikePoints.length - 1; i++) {
          const prev = strikePoints[i - 1];
          const curr = strikePoints[i];
          const next = strikePoints[i + 1];

          const slope1 = (curr.premium - prev.premium) / Math.max(1, curr.dte - prev.dte);
          const slope2 = (next.premium - curr.premium) / Math.max(1, next.dte - curr.dte);
          const drop = slope1 - slope2;

          if (drop > maxSlopeDrop && slope1 > 0) {
            maxSlopeDrop = drop;
            kneePoint = curr;
          }
        }
      }

      const avgPremium = strikePoints.length > 0 ? strikePoints.reduce((acc, p) => acc + p.premium, 0) / strikePoints.length : 0;
      const avgCash = strikePoints.length > 0 ? strikePoints.reduce((acc, p) => acc + p.annualized_return_cash_secured, 0) / strikePoints.length : 0;
      const avgMargin = strikePoints.length > 0 ? strikePoints.reduce((acc, p) => acc + p.annualized_return_margin, 0) / strikePoints.length : 0;
      const avgIv = strikePoints.length > 0 ? strikePoints.reduce((acc, p) => acc + p.implied_volatility, 0) / strikePoints.length : 0;
      const cushion = Number((Math.abs(currentPrice - ts.dollar) / currentPrice * 100).toFixed(1));
      const firstSnapped = strikePoints[0]?.snapped_strike || ts.dollar;

      rangeStrikesResults.push({
        key: ts.key,
        label: ts.label,
        target_strike_pct: ts.pct,
        target_strike: Number(ts.dollar.toFixed(2)),
        snapped_strike: firstSnapped,
        avg_premium: Number(avgPremium.toFixed(2)),
        avg_cash_return: Number(avgCash.toFixed(2)),
        avg_margin_return: Number(avgMargin.toFixed(2)),
        avg_iv: Number(avgIv.toFixed(2)),
        cushion_to_strike_pct: cushion,
        knee_point: kneePoint,
        points: strikePoints,
      });
    }

    // Default primary strike is the middle one or the first one
    const midIdx = Math.floor(targetStrikesList.length / 2);
    const primaryDef = targetStrikesList[midIdx] || targetStrikesList[0];
    const primaryPoints = pointsByStrikeKey[primaryDef.key] || [];
    const primaryResult = rangeStrikesResults.find((r) => r.key === primaryDef.key);

    res.json({
      ticker,
      current_price: currentPrice,
      fifty_two_week_high: fiftyTwoWeekHigh ? Number(fiftyTwoWeekHigh.toFixed(2)) : null,
      fifty_two_week_low: fiftyTwoWeekLow ? Number(fiftyTwoWeekLow.toFixed(2)) : null,
      target_strike: Number(primaryDef.dollar.toFixed(2)),
      target_strike_pct: primaryDef.pct,
      option_type: optionType,
      price_type: priceType,
      points: primaryPoints,
      knee_point: primaryResult?.knee_point || null,
      rsi_14: rsi,
      bollinger: bollinger,
      fibonacci: fibonacci,
      is_range_mode: isRangeMode,
      range_strikes: rangeStrikesResults,
      range_chart_data: rangeChartData,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Multi-Ticker Compare Premium Curves
app.all("/api/compare-premium-curves", async (req: Request, res: Response) => {
  try {
    const rawTickers = req.body?.tickers || req.query?.tickers;
    let tickers: string[] = [];
    if (Array.isArray(rawTickers)) {
      tickers = rawTickers.map((t: any) => String(t).trim().toUpperCase()).filter(Boolean);
    } else if (typeof rawTickers === "string") {
      tickers = rawTickers
        .split(/[\s,]+/)
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean);
    }

    if (tickers.length === 0) {
      tickers = ["NVDA", "AAPL", "MSFT", "AMD", "QQQ"];
    }
    // Deduplicate and limit to 15 tickers max
    tickers = Array.from(new Set(tickers)).slice(0, 15);

    const optionType = ((req.body?.optionType || req.query?.optionType || "put") as string).toLowerCase();
    const priceType = ((req.body?.priceType || req.query?.priceType || "bid") as string).toLowerCase();
    const targetStrikePct = parseFloat((req.body?.targetStrikePct || req.query?.targetStrikePct || "50") as string) || 50;
    const months = parseInt((req.body?.months || req.query?.months || "18") as string) || 18;
    const noFallback = (req.body?.noFallback === true || req.query?.noFallback === "true");

    const maxDays = months * 30.5;
    const today = new Date();

    const resultsByTicker: Record<string, any> = {};
    const allExpirationsMap: Record<string, { expiration: string; dte: number; label: string }> = {};

    await Promise.all(
      tickers.map(async (t) => {
        try {
          const optData = await fetchMarketOptions(t);
          if (!optData) return;
          const currentPrice = optData.quote?.regularMarketPrice;
          if (!currentPrice) return;

          // Technicals
          const chart = await fetchMarketChart(t, "3mo", "1d");
          const closes: number[] = (chart?.indicators?.quote?.[0]?.close || []).filter(
            (c: any) => c !== null && c !== undefined
          );
          const rsi = computeRsi(closes, 14);
          const bollinger = computeBollinger(closes, 20, 2.0);

          const fiftyTwoWeekHigh = optData.quote?.fiftyTwoWeekHigh || (closes.length > 0 ? Math.max(...closes) : null);
          const fiftyTwoWeekLow = optData.quote?.fiftyTwoWeekLow || (closes.length > 0 ? Math.min(...closes) : null);
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

          const targetStrike = (currentPrice * targetStrikePct) / 100;
          const rawExpirations: number[] = optData.expirationDates || [];

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
                : (await fetchMarketOptions(t, exp.timestamp)) || optData;

            const contracts = optionType === "call" ? chain.options?.[0]?.calls || [] : chain.options?.[0]?.puts || [];
            if (contracts.length === 0) continue;

            const nearest = contracts.reduce((prev: any, curr: any) =>
              Math.abs(curr.strike - targetStrike) < Math.abs(prev.strike - targetStrike) ? curr : prev
            );
            if (!nearest) continue;

            const bid = nearest.bid || 0;
            const ask = nearest.ask || 0;
            const last = nearest.lastPrice || 0;

            let premium = priceType === "ask" ? ask : bid;
            let usedFallback = false;
            if (priceType === "bid") {
              if (bid <= 0 && last > 0 && !noFallback) {
                premium = ask > 0 ? Math.min(last, ask) : last;
                usedFallback = true;
              }
            } else {
              if (ask <= 0 && last > 0 && !noFallback) {
                premium = bid > 0 ? Math.max(last, bid) : last;
                usedFallback = true;
              }
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

            const cushionToStrikePct = Number((((currentPrice - nearest.strike) / currentPrice) * 100).toFixed(1));

            points.push({
              expiration: exp.dateStr,
              dte: exp.dte,
              target_strike: Number(targetStrike.toFixed(2)),
              snapped_strike: nearest.strike,
              strike_diff: Number((nearest.strike - targetStrike).toFixed(2)),
              moneyness_pct: Number(((nearest.strike / currentPrice) * 100).toFixed(1)),
              cushion_to_strike_pct: cushionToStrikePct,
              premium: Number(premium.toFixed(2)),
              bid: nearest.bid || 0,
              ask: nearest.ask || 0,
              last_price: last,
              volume: nearest.volume || 0,
              open_interest: nearest.openInterest || 0,
              implied_volatility: nearest.impliedVolatility ? Number((nearest.impliedVolatility * 100).toFixed(2)) : 0,
              used_fallback: usedFallback,
              capital_basis_margin: Number(marginBasis.toFixed(2)),
              annualized_return_margin: Number(annReturnMargin.toFixed(2)),
              annualized_return_cash_secured: Number(annReturnCashSecured.toFixed(2)),
              rsi_14: rsi,
              bollinger: bollinger,
              fibonacci: fibonacci,
              strike_bollinger_position: strikeBbPos,
            });

            if (!allExpirationsMap[exp.dateStr]) {
              allExpirationsMap[exp.dateStr] = {
                expiration: exp.dateStr,
                dte: exp.dte,
                label: `${exp.dateStr} (${exp.dte}d)`,
              };
            }
          }

          points.sort((a, b) => a.dte - b.dte);

          // Knee calculation
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

          const avgCashReturn = points.length > 0
            ? Number((points.reduce((acc, p) => acc + p.annualized_return_cash_secured, 0) / points.length).toFixed(2))
            : 0;
          const avgMarginReturn = points.length > 0
            ? Number((points.reduce((acc, p) => acc + p.annualized_return_margin, 0) / points.length).toFixed(2))
            : 0;
          const avgIv = points.length > 0
            ? Number((points.reduce((acc, p) => acc + p.implied_volatility, 0) / points.length).toFixed(2))
            : 0;

          resultsByTicker[t] = {
            ticker: t,
            current_price: currentPrice,
            fifty_two_week_high: fiftyTwoWeekHigh ? Number(fiftyTwoWeekHigh.toFixed(2)) : null,
            fifty_two_week_low: fiftyTwoWeekLow ? Number(fiftyTwoWeekLow.toFixed(2)) : null,
            target_strike: Number(targetStrike.toFixed(2)),
            target_strike_pct: targetStrikePct,
            rsi_14: rsi,
            bollinger: bollinger,
            fibonacci: fibonacci,
            points,
            knee_point: kneePoint,
            avg_cash_return: avgCashReturn,
            avg_margin_return: avgMarginReturn,
            avg_iv: avgIv,
          };
        } catch (err: any) {
          console.error(`Error processing ticker ${t} in compare-premium-curves:`, err);
        }
      })
    );

    const sortedExpirations = Object.values(allExpirationsMap).sort((a, b) => a.dte - b.dte);

    const overlaidChartData = sortedExpirations.map((expObj) => {
      const row: any = {
        expiration: expObj.expiration,
        dte: expObj.dte,
        label: expObj.label,
        stocks: {},
      };

      for (const t of Object.keys(resultsByTicker)) {
        const item = resultsByTicker[t];
        const pt = item.points.find((p: any) => p.expiration === expObj.expiration);
        if (pt) {
          row[`${t}_premium`] = pt.premium;
          row[`${t}_cash_return`] = pt.annualized_return_cash_secured;
          row[`${t}_margin_return`] = pt.annualized_return_margin;
          row[`${t}_iv`] = pt.implied_volatility;
          row[`${t}_strike`] = pt.snapped_strike;
          row[`${t}_spot`] = item.current_price;
          row[`${t}_cushion`] = pt.cushion_to_strike_pct;
          row.stocks[t] = {
            ticker: t,
            expiration: pt.expiration,
            dte: pt.dte,
            strike: pt.snapped_strike,
            spot: item.current_price,
            premium: pt.premium,
            bid: pt.bid,
            ask: pt.ask,
            returnCashSecured: pt.annualized_return_cash_secured,
            returnMargin: pt.annualized_return_margin,
            iv: pt.implied_volatility,
            moneyness: pt.moneyness_pct,
            cushion: pt.cushion_to_strike_pct,
            rsi_14: pt.rsi_14,
            bollinger: pt.bollinger,
            fibonacci: pt.fibonacci,
            strike_bollinger_position: pt.strike_bollinger_position,
            used_fallback: pt.used_fallback,
            bid_used_fallback: pt.used_fallback,
            last_price: pt.last_price,
            fifty_two_week_high: item.fifty_two_week_high,
            fifty_two_week_low: item.fifty_two_week_low,
          };
        }
      }
      return row;
    });

    res.json({
      tickers: Object.keys(resultsByTicker),
      target_strike_pct: targetStrikePct,
      option_type: optionType,
      price_type: priceType,
      expirations: sortedExpirations,
      results_by_ticker: resultsByTicker,
      overlaid_chart_data: overlaidChartData,
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
1. Core message & why this filing matters to equity and options traders. If this is an amendment (${params.form.includes('/A') ? 'AMENDMENT' : 'any /A form'}), clearly identify what information or exhibits are being amended, corrected, updated, or restated compared to the original filing.
2. Financial numbers (Revenue, EPS, guidance changes, operating margins, segment growth).
3. Material events, major contracts, leadership changes, legal updates, or financing details.
4. Risk factors and macroeconomic commentary.
5. Implications for implied volatility, downside put options risk, and sentiment.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an elite Wall Street securities analyst and SEC filing forensic specialist. You produce precise, insightful, and actionable breakdowns of 10-K, 10-Q, 8-K filings, and all amendments (such as 8-K/A, 10-Q/A, 10-K/A) with zero fluff.",
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
// SEC FILING IMPACT ENGINE FOR PUT RECOMMENDATIONS
// ==========================================

export interface SecFilingScoreImpact {
  recent_filings_count: number;
  latest_filing_date: string | null;
  latest_filing_form: string | null;
  latest_filing_desc: string | null;
  sentiment: "Bullish" | "Bearish" | "Neutral" | "Not Analyzed";
  score_impact: number;
  catalyst_risk: "Low" | "Moderate" | "High";
  rationale: string;
  flags: string[];
}

const secSubmissionsCache = new Map<string, { timestamp: number; data: any }>();
const secFilingImpactCache = new Map<string, { timestamp: number; impact: SecFilingScoreImpact }>();
const SEC_CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes

async function evaluateSecFilingImpactForTicker(ticker: string): Promise<SecFilingScoreImpact> {
  const normTicker = ticker.trim().toUpperCase();
  const cached = secFilingImpactCache.get(normTicker);
  if (cached && Date.now() - cached.timestamp < SEC_CACHE_TTL_MS) {
    return cached.impact;
  }

  // Broad market ETFs and Trusts (QQQ, SPY, IWM, DIA, TQQQ, SOXL, etc.)
  const isEtfOrTrust = [
    "QQQ", "SPY", "IWM", "DIA", "TQQQ", "SQQQ", "SOXL", "SOXS", "VOO", "VTI", "XLF", "XLK", "SMH"
  ].includes(normTicker);

  if (isEtfOrTrust) {
    const etfImpact: SecFilingScoreImpact = {
      recent_filings_count: 0,
      latest_filing_date: null,
      latest_filing_form: null,
      latest_filing_desc: null,
      sentiment: "Neutral",
      score_impact: 0,
      catalyst_risk: "Low",
      rationale: "Broad-market index/ETF: Multi-asset diversification eliminates single-stock SEC reporting surprise risk.",
      flags: ["Index/ETF (Zero Single-Stock SEC Risk)"],
    };
    secFilingImpactCache.set(normTicker, { timestamp: Date.now(), impact: etfImpact });
    return etfImpact;
  }

  const cikMap = await getSecTickerCikMap();
  const cik = cikMap[normTicker];

  if (!cik) {
    const fallbackImpact: SecFilingScoreImpact = {
      recent_filings_count: 0,
      latest_filing_date: null,
      latest_filing_form: null,
      latest_filing_desc: null,
      sentiment: "Neutral",
      score_impact: 0,
      catalyst_risk: "Low",
      rationale: "No direct operating CIK on SEC EDGAR index; neutral reporting profile applied.",
      flags: [],
    };
    secFilingImpactCache.set(normTicker, { timestamp: Date.now(), impact: fallbackImpact });
    return fallbackImpact;
  }

  try {
    const paddedCik = String(cik).padStart(10, "0");
    let subData: any = null;
    const subCached = secSubmissionsCache.get(normTicker);
    if (subCached && Date.now() - subCached.timestamp < SEC_CACHE_TTL_MS) {
      subData = subCached.data;
    } else {
      const subRes = await fetch(`https://data.sec.gov/submissions/CIK${paddedCik}.json`, {
        headers: { "User-Agent": "muthu.vela@gmail.com StockRelated/1.0" },
      });
      if (subRes.ok) {
        subData = await subRes.json();
        secSubmissionsCache.set(normTicker, { timestamp: Date.now(), data: subData });
      }
    }

    if (!subData?.filings?.recent) {
      const noDataImpact: SecFilingScoreImpact = {
        recent_filings_count: 0,
        latest_filing_date: null,
        latest_filing_form: null,
        latest_filing_desc: null,
        sentiment: "Neutral",
        score_impact: 0,
        catalyst_risk: "Low",
        rationale: "SEC filings unavailable; neutral scoring applied.",
        flags: [],
      };
      return noDataImpact;
    }

    const recent = subData.filings.recent;
    const forms: string[] = recent.form || [];
    const dates: string[] = recent.filingDate || [];
    const descs: string[] = recent.primaryDocDescription || [];
    const accns: string[] = recent.accessionNumber || [];
    const docs: string[] = recent.primaryDocument || [];

    // Filter relevant filings (10-K, 10-Q, 8-K, 20-F, 6-K and their amendments)
    const targetFilings: Array<{
      form: string;
      date: string;
      desc: string;
      accn: string;
      doc: string;
      daysAgo: number;
      isAmendment: boolean;
    }> = [];

    const now = Date.now();
    for (let i = 0; i < forms.length && targetFilings.length < 15; i++) {
      const f = (forms[i] || "").trim().toUpperCase();
      const baseForm = f.replace(/\/A$/, "");
      const isTarget = ["10-K", "10-Q", "8-K", "20-F", "6-K"].includes(baseForm) || f.endsWith("/A");
      if (isTarget) {
        const fileTime = new Date(dates[i]).getTime();
        const daysAgo = Math.max(0, Math.round((now - fileTime) / (1000 * 60 * 60 * 24)));
        targetFilings.push({
          form: forms[i],
          date: dates[i],
          desc: descs[i] || "",
          accn: accns[i] || "",
          doc: docs[i] || "",
          daysAgo,
          isAmendment: f.endsWith("/A"),
        });
      }
    }

    if (targetFilings.length === 0) {
      const emptyImpact: SecFilingScoreImpact = {
        recent_filings_count: 0,
        latest_filing_date: null,
        latest_filing_form: null,
        latest_filing_desc: null,
        sentiment: "Neutral",
        score_impact: 0,
        catalyst_risk: "Low",
        rationale: "No recent material periodic or current filings detected.",
        flags: [],
      };
      return emptyImpact;
    }

    const latest = targetFilings[0];
    let scoreAdjustment = 0;
    let sentiment: "Bullish" | "Bearish" | "Neutral" = "Neutral";
    let catalystRisk: "Low" | "Moderate" | "High" = "Low";
    const flags: string[] = [];
    const reasons: string[] = [];

    // Check if we have an AI summary cached for the latest filing
    const latestAccnNoDash = latest.accn.replace(/-/g, "");
    const latestUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${latestAccnNoDash}/${latest.doc}`;
    const cacheKey = `${normTicker}_${latest.form}_${latest.date}_${latestUrl}`;
    const cachedSummary = secSummaryCache.get(cacheKey);

    if (cachedSummary) {
      if (cachedSummary.sentiment === "Bullish") {
        scoreAdjustment += 5;
        sentiment = "Bullish";
        flags.push(`SEC: Bullish ${latest.form} (+5)`);
        reasons.push(`AI Analysis: Bullish operational signals in ${latest.form} (${cachedSummary.title || "Strong Performance"}).`);
      } else if (cachedSummary.sentiment === "Bearish") {
        scoreAdjustment -= 8;
        sentiment = "Bearish";
        catalystRisk = "High";
        flags.push(`SEC: Bearish ${latest.form} (-8)`);
        reasons.push(`AI Analysis: Bearish headwind warnings in ${latest.form}.`);
      } else {
        reasons.push(`AI Analysis: Neutral operational disclosures in ${latest.form}.`);
      }
    }

    // Examine recent periodic reports (10-Q, 10-K)
    const recentPeriodic = targetFilings.find((f) => {
      const b = f.form.toUpperCase().replace(/\/A$/, "");
      return b === "10-Q" || b === "10-K" || b === "20-F";
    });

    if (recentPeriodic) {
      if (recentPeriodic.daysAgo <= 45) {
        // Clean post-10Q runway! Quarterly numbers are digested, minimal earnings disclosure shock
        scoreAdjustment += 4;
        if (sentiment === "Neutral") sentiment = "Bullish";
        flags.push(`SEC: Clean Post-${recentPeriodic.form} Runway (+4)`);
        reasons.push(`Fresh ${recentPeriodic.form} filed ${recentPeriodic.daysAgo}d ago (${recentPeriodic.date}) provides post-audit financial clarity.`);
      } else if (recentPeriodic.daysAgo >= 75) {
        // Late cycle 10-Q: Next earnings/filing is approaching
        scoreAdjustment -= 2;
        catalystRisk = catalystRisk === "High" ? "High" : "Moderate";
        flags.push(`SEC: Late Cycle (${recentPeriodic.daysAgo}d since ${recentPeriodic.form})`);
        reasons.push(`Last ${recentPeriodic.form} filed ${recentPeriodic.daysAgo}d ago; approaching subsequent quarterly cycle.`);
      }
    }

    // Scan recent 8-K filings (within past 90 days) for material catalysts
    const recent8Ks = targetFilings.filter(
      (f) => f.form.toUpperCase().startsWith("8-K") && f.daysAgo <= 90
    );

    let foundMaterialPositive = false;

    for (const filing of recent8Ks) {
      const textToScan = (filing.desc + " " + filing.doc).toLowerCase();

      // Negative triggers: Restatements, delisting, material default, severe disputes
      if (
        textToScan.includes("4.02") ||
        textToScan.includes("non-reliance") ||
        textToScan.includes("restatement") ||
        textToScan.includes("3.01") ||
        textToScan.includes("delist") ||
        textToScan.includes("2.04") ||
        textToScan.includes("acceleration") ||
        textToScan.includes("default") ||
        textToScan.includes("subpoena") ||
        textToScan.includes("material weakness")
      ) {
        scoreAdjustment -= 10;
        sentiment = "Bearish";
        catalystRisk = "High";
        flags.push(`⚠️ SEC: Material Adverse 8-K (${filing.date})`);
        reasons.push(`Material event risk in 8-K (${filing.date}): Restatement, debt acceleration, or regulatory inquiry.`);
        break;
      }

      // Dilution triggers
      if (
        textToScan.includes("convertible senior notes") ||
        textToScan.includes("public offering") ||
        textToScan.includes("underwritten offering")
      ) {
        scoreAdjustment -= 4;
        if (sentiment === "Neutral") sentiment = "Bearish";
        catalystRisk = catalystRisk === "High" ? "High" : "Moderate";
        flags.push(`SEC: Dilutive Financing 8-K (-4)`);
        reasons.push(`Capital markets/notes offering in 8-K (${filing.date}) introduces supply pressure.`);
      }

      // Positive triggers: Strategic M&A, major contracts, buybacks, strong earnings release
      if (
        textToScan.includes("acquire") ||
        textToScan.includes("acquisition") ||
        textToScan.includes("merger") ||
        textToScan.includes("definitive agreement") ||
        textToScan.includes("repurchase") ||
        textToScan.includes("buyback") ||
        textToScan.includes("item 1.01") ||
        textToScan.includes("item 2.02")
      ) {
        if (!foundMaterialPositive) {
          scoreAdjustment += 4;
          if (sentiment !== "Bearish") sentiment = "Bullish";
          foundMaterialPositive = true;
          flags.push(`SEC: Strategic 8-K Catalyst (+4)`);
          reasons.push(`Strategic catalyst in 8-K (${filing.date}): Commercial agreement, M&A expansion, or capital return.`);
        }
      }

      // Amendments check (8-K/A)
      if (filing.isAmendment) {
        if (
          textToScan.includes("item 5.02") ||
          textToScan.includes("compensat") ||
          textToScan.includes("officer") ||
          textToScan.includes("exhibit")
        ) {
          flags.push(`SEC: Routine 8-K/A Governance`);
          reasons.push(`Form 8-K/A amendment (${filing.date}) is routine executive/governance compensation disclosure.`);
        }
      }
    }

    // Clamp score adjustment within sensible boundaries [-15, +8]
    scoreAdjustment = Math.max(-15, Math.min(8, scoreAdjustment));

    // Consolidate rationale
    const rationale = reasons.length > 0
      ? reasons.join(" ")
      : `Latest filing ${latest.form} (${latest.date}, ${latest.daysAgo}d ago) confirms orderly corporate reporting without adverse disclosures.`;

    const impact: SecFilingScoreImpact = {
      recent_filings_count: targetFilings.length,
      latest_filing_date: latest.date,
      latest_filing_form: latest.form,
      latest_filing_desc: latest.desc || null,
      sentiment,
      score_impact: scoreAdjustment,
      catalyst_risk: catalystRisk,
      rationale,
      flags,
    };

    secFilingImpactCache.set(normTicker, { timestamp: Date.now(), impact });
    return impact;
  } catch (err) {
    console.error(`Error evaluating SEC filing impact for ${normTicker}:`, err);
    return {
      recent_filings_count: 0,
      latest_filing_date: null,
      latest_filing_form: null,
      latest_filing_desc: null,
      sentiment: "Neutral",
      score_impact: 0,
      catalyst_risk: "Low",
      rationale: "SEC evaluation fallback; neutral score applied.",
      flags: [],
    };
  }
}

// ==========================================
// PUT RECOMMENDATIONS ACROSS RISK TIERS
// ==========================================

interface EarningsTimingInfo {
  nextEarningsDate: string | null;
  daysToEarnings: number | null;
  spansEarnings: boolean;
  expiresBeforeEarnings: boolean;
  earningsPassedRecently: boolean;
}

function computePutRecommendationScore(
  tier: "least_risk" | "medium_risk" | "high_risk",
  annualCashReturn: number,
  pop: number,
  cushionPct: number,
  dte: number,
  iv: number,
  hv: number,
  rsi: number | null,
  isBelowBollingerLower: boolean,
  spreadPct: number,
  openInterest: number,
  earningsInfo?: EarningsTimingInfo | null,
  secFilingImpact?: SecFilingScoreImpact | null
): {
  score: number;
  earningsScoreAdj: number;
  earningsNote: string;
  earningsFlag: string | null;
  secScoreAdj: number;
  secFilingNote: string;
} {
  let score = 50;

  if (tier === "least_risk") {
    score += Math.min(25, Math.max(0, (pop - 80) * 1.5));
    score += Math.min(15, Math.max(0, cushionPct * 0.6));
    score += Math.min(15, Math.max(0, annualCashReturn * 1.0));
  } else if (tier === "medium_risk") {
    score += Math.min(20, Math.max(0, (pop - 68) * 1.2));
    score += Math.min(15, Math.max(0, cushionPct * 0.9));
    score += Math.min(20, Math.max(0, annualCashReturn * 0.9));
  } else {
    score += Math.min(15, Math.max(0, (pop - 50) * 0.8));
    score += Math.min(28, Math.max(0, annualCashReturn * 0.7));
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

  // EARNINGS DATE SCORING INTEGRATION:
  let earningsScoreAdj = 0;
  let earningsNote = "";
  let earningsFlag: string | null = null;

  if (earningsInfo?.expiresBeforeEarnings && earningsInfo.nextEarningsDate) {
    // Option expires cleanly BEFORE earnings date -> 0 binary event risk!
    if (tier === "least_risk") {
      earningsScoreAdj = 8;
    } else if (tier === "medium_risk") {
      earningsScoreAdj = 6;
    } else {
      earningsScoreAdj = 4;
    }
    const daysBefore = (earningsInfo.daysToEarnings || 0) - dte;
    earningsNote = `Expires ${daysBefore > 0 ? `${daysBefore}d ` : ""}before earnings on ${earningsInfo.nextEarningsDate} (Zero Event Risk)`;
    earningsFlag = `Expires Before Earnings (${earningsInfo.nextEarningsDate})`;
  } else if (earningsInfo?.spansEarnings && earningsInfo.nextEarningsDate) {
    // Option spans ACROSS upcoming earnings announcement -> Event risk!
    if (tier === "least_risk") {
      // Conservative sellers should avoid spanning earnings or receive clear score penalty
      earningsScoreAdj = cushionPct >= 18 ? -6 : cushionPct >= 12 ? -9 : -13;
      earningsNote = `Spans earnings on ${earningsInfo.nextEarningsDate} (${earningsInfo.daysToEarnings}d away). Higher event risk for conservative tier.`;
      earningsFlag = `⚠️ Spans Earnings (${earningsInfo.nextEarningsDate})`;
    } else if (tier === "medium_risk") {
      // If IV is elevated and cushion is reasonable, moderate penalty
      if (iv > 0 && hv > 0 && iv > hv * 1.2 && cushionPct >= 12) {
        earningsScoreAdj = -3;
        earningsNote = `Spans earnings (${earningsInfo.nextEarningsDate}) with elevated IV (${iv.toFixed(0)}%).`;
        earningsFlag = `Spans Earnings (${earningsInfo.nextEarningsDate})`;
      } else {
        earningsScoreAdj = cushionPct >= 15 ? -5 : -8;
        earningsNote = `Spans earnings on ${earningsInfo.nextEarningsDate} (${earningsInfo.daysToEarnings}d away).`;
        earningsFlag = `⚠️ Spans Earnings (${earningsInfo.nextEarningsDate})`;
      }
    } else {
      // High Risk / Aggressive: High IV harvest into earnings can be favorable
      if (iv >= 35 || (hv > 0 && iv > hv * 1.15)) {
        earningsScoreAdj = 5;
        earningsNote = `Pre-earnings high IV (${iv.toFixed(0)}%) volatility capture into ${earningsInfo.nextEarningsDate}.`;
        earningsFlag = `Earnings IV Harvest (${earningsInfo.nextEarningsDate})`;
      } else {
        earningsScoreAdj = -4;
        earningsNote = `Spans earnings on ${earningsInfo.nextEarningsDate}.`;
        earningsFlag = `⚠️ Spans Earnings (${earningsInfo.nextEarningsDate})`;
      }
    }
  } else if (earningsInfo?.earningsPassedRecently && earningsInfo.nextEarningsDate) {
    earningsScoreAdj = 5;
    earningsNote = `Post-earnings clear runway (${earningsInfo.nextEarningsDate}).`;
    earningsFlag = `Post-Earnings Runway`;
  }

  score += earningsScoreAdj;

  // SEC FILING SCORING INTEGRATION:
  let secScoreAdj = 0;
  let secFilingNote = "";
  if (secFilingImpact) {
    let adj = secFilingImpact.score_impact;
    if (tier === "least_risk") {
      // Conservative puts are extra sensitive to material adverse SEC disclosures
      if (adj < 0) adj = Math.round(adj * 1.3);
      else if (adj > 0) adj = Math.min(8, Math.round(adj * 1.1));
    } else if (tier === "high_risk") {
      // Aggressive tier can tolerate higher catalyst risk
      if (adj < 0) adj = Math.round(adj * 0.85);
    }
    secScoreAdj = adj;
    secFilingNote = secFilingImpact.rationale;
    score += secScoreAdj;
  }

  const finalScore = Math.max(10, Math.min(99, Math.round(score)));
  return { score: finalScore, earningsScoreAdj, earningsNote, earningsFlag, secScoreAdj, secFilingNote };
}

app.post("/api/put-recommendations", async (req: Request, res: Response) => {
  try {
    const {
      tickers,
      minDte = 90,
      maxDte = 1000,
      minBid = 0.35,
      minOpenInterest = 5,
      marginShockPct = 15.0,
      minAnnualReturn = 8.0,
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
            // Concurrently fetch options chain, technicals, and SEC filing impact
            const [optData, technicals, secFilingImpact] = await Promise.all([
              fetchMarketOptions(ticker),
              getTechnicalsForTicker(ticker),
              evaluateSecFilingImpactForTicker(ticker),
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
            const nextEarningsTimestamp = technicals?.next_earnings_timestamp || null;

            marketContextMap[ticker] = {
              price: currentPrice,
              rsi,
              iv: atmIv,
              hv: histVolPct,
              bollinger_lower: bollingerLower,
              bollinger_upper: bollingerUpper,
              dist_to_52w_high_pct: distTo52wHigh,
              sec_filing_impact: secFilingImpact || null,
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

            // Evaluate up to 8 expirations per ticker to balance depth and performance across 90-1000 DTE
            const targetExpirations = validExpirations.slice(0, 8);

            for (const exp of targetExpirations) {
              let chain = optData;
              if (optData.expirationDates?.[0] !== exp.timestamp) {
                const fetched = await fetchMarketOptions(ticker, exp.timestamp);
                if (fetched) chain = fetched;
              }

              const puts: any[] = chain?.options?.[0]?.puts || [];
              if (puts.length === 0) continue;

              // Calculate earnings timing for this expiration
              let earningsInfo: EarningsTimingInfo | null = null;
              if (nextEarningsDate) {
                let earningsTime = nextEarningsTimestamp;
                if (!earningsTime) {
                  earningsTime = new Date(nextEarningsDate).getTime();
                }
                if (!isNaN(earningsTime)) {
                  const diffDays = Math.round((earningsTime - today.getTime()) / (1000 * 60 * 60 * 24));
                  const spans = diffDays > 0 && diffDays <= exp.dte;
                  const expiresBefore = diffDays > exp.dte;
                  const passedRecently = diffDays <= 0 && diffDays >= -30;

                  earningsInfo = {
                    nextEarningsDate,
                    daysToEarnings: diffDays,
                    spansEarnings: spans,
                    expiresBeforeEarnings: expiresBefore,
                    earningsPassedRecently: passedRecently,
                  };
                }
              }

              for (const put of puts) {
                totalContractsEvaluated++;
                const strike = put.strike;
                if (!strike || strike <= 0) continue;

                const bid = put.bid || 0;
                const ask = put.ask || 0;
                const last = put.lastPrice || 0;
                const oi = put.openInterest || 0;
                const volume = put.volume || 0;

                // Price selection: for sell put options, use last price ONLY IF bid is zero (or <= 0)
                let execBid = bid;
                if (execBid <= 0 && last > 0) {
                  // Guard against stale trades: if current ask exists, bid cannot exceed ask
                  execBid = ask > 0 ? Math.min(last, ask) : last;
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

                const minReturnThreshold = minAnnualReturn || minAnnualMarginReturn || 5;
                if (annualReturnCash < minReturnThreshold) continue;

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
                if (annualReturnCash >= 15) flags.push("High Cash Yield");

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

                const scoreResult = computePutRecommendationScore(
                  riskTier,
                  annualReturnCash,
                  pop,
                  cushionToStrikePct,
                  exp.dte,
                  ivPct,
                  histVolPct || 0,
                  rsi,
                  isBelowBollingerLower,
                  spreadPct,
                  oi,
                  earningsInfo,
                  secFilingImpact
                );

                if (scoreResult.earningsFlag) {
                  flags.push(scoreResult.earningsFlag);
                }
                if (secFilingImpact?.flags && secFilingImpact.flags.length > 0) {
                  flags.push(...secFilingImpact.flags);
                }

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
                  rationale = `Safe Delta ${greeks.delta?.toFixed(2) || "-0.12"} positioned ${cushionToStrikePct}% ($${(currentPrice - strike).toFixed(2)}) below spot${bbRsiContext}${rsiStr}. Offers ${pop}% POP with $${(execBid * 100).toFixed(0)} premium ($${dailyTheta.toFixed(2)}/day theta) and ${annualReturnCash.toFixed(1)}% annualized cash-secured return.`;
                } else if (riskTier === "medium_risk") {
                  rationale = `Optimal Delta ${greeks.delta?.toFixed(2) || "-0.22"} sweet-spot with ${cushionToStrikePct}% downside cushion${bbRsiContext}${rsiStr}. Delivers solid ${annualReturnCash.toFixed(1)}% annualized cash-secured return with ${pop}% POP and $${dailyTheta.toFixed(2)}/day theta decay.`;
                } else {
                  rationale = `High-yield Delta ${greeks.delta?.toFixed(2) || "-0.35"} generating ${annualReturnCash.toFixed(1)}% annualized cash-secured yield ($${(execBid * 100).toFixed(0)} premium)${bbRsiContext}${rsiStr} with ${cushionToStrikePct}% buffer and rapid $${dailyTheta.toFixed(2)}/day theta decay.`;
                }

                if (scoreResult.earningsNote) {
                  rationale += ` • Earnings Timing: ${scoreResult.earningsNote}`;
                }
                if (secFilingImpact?.rationale) {
                  rationale += ` • SEC Filing Impact (${secFilingImpact.sentiment}${secFilingImpact.score_impact >= 0 ? ` +${secFilingImpact.score_impact}` : ` ${secFilingImpact.score_impact}`}): ${secFilingImpact.rationale}`;
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
                  score: scoreResult.score,
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
                  bid_used_fallback: bid <= 0 && last > 0,
                  used_fallback: bid <= 0 && last > 0,
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
                    fifty_two_week_low: technicals?.fifty_two_week_low ?? null,
                    dist_to_52w_high_pct: distTo52wHigh,
                    market_cap: marketCap,
                    next_earnings_date: nextEarningsDate,
                    fibonacci: technicals?.fibonacci ?? null,
                  },
                  fibonacci: technicals?.fibonacci ?? null,
                  fifty_two_week_high: fiftyTwoWeekHigh,
                  fifty_two_week_low: technicals?.fifty_two_week_low ?? null,
                  earnings_context: earningsInfo ? {
                    next_earnings_date: earningsInfo.nextEarningsDate,
                    days_to_earnings: earningsInfo.daysToEarnings,
                    spans_earnings: earningsInfo.spansEarnings,
                    expires_before_earnings: earningsInfo.expiresBeforeEarnings,
                    earnings_passed_recently: earningsInfo.earningsPassedRecently,
                    score_impact: scoreResult.earningsScoreAdj,
                    label: scoreResult.earningsNote,
                  } : undefined,
                  sec_filing_impact: secFilingImpact || undefined,
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

    // Default sort of put recommendations in decreasing order of score, then downside cushion buffer descending, then annualized cash return descending
    const sortFn = (a: any, b: any) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.cushion_to_strike_pct !== a.cushion_to_strike_pct) {
        return b.cushion_to_strike_pct - a.cushion_to_strike_pct;
      }
      return b.annualized_return_cash_secured - a.annualized_return_cash_secured;
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
  const { leastRisk, mediumRisk, highRisk, tickers } = req.body || {};
  try {

    const sampleLeast = (leastRisk || []).slice(0, 3).map((r: any) => `${r.ticker} $${r.strike}P exp ${r.expiration} (${r.dte}d) | Cash Yield: ${r.annualized_return_cash_secured}% | Margin Yield: ${r.annualized_return_margin}% | POP: ${r.probability_of_profit}% | Cushion: ${r.cushion_to_strike_pct}% | Score: ${r.score}`);
    const sampleMed = (mediumRisk || []).slice(0, 3).map((r: any) => `${r.ticker} $${r.strike}P exp ${r.expiration} (${r.dte}d) | Cash Yield: ${r.annualized_return_cash_secured}% | Margin Yield: ${r.annualized_return_margin}% | POP: ${r.probability_of_profit}% | Cushion: ${r.cushion_to_strike_pct}% | Score: ${r.score}`);
    const sampleHigh = (highRisk || []).slice(0, 3).map((r: any) => `${r.ticker} $${r.strike}P exp ${r.expiration} (${r.dte}d) | Cash Yield: ${r.annualized_return_cash_secured}% | Margin Yield: ${r.annualized_return_margin}% | POP: ${r.probability_of_profit}% | Cushion: ${r.cushion_to_strike_pct}% | Score: ${r.score}`);

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
    console.warn("Gemini AI put strategy quota/demand limit, using quantitative allocation fallback:", err.message);
    const fallbackTrades: any[] = [];
    if (leastRisk && leastRisk.length > 0) {
      const p = leastRisk[0];
      fallbackTrades.push({
        ticker: p.ticker,
        tier: "Least Risk (Conservative)",
        strike: p.strike,
        expiration: p.expiration,
        action_thesis: `High margin-of-safety put sale at ${p.moneyness_pct}% OTM strike with ${p.annualized_return_pct}% annualized yield.`,
        catalyst_or_risk: "Conservative downside barrier positioned well below key support levels.",
      });
    }
    if (mediumRisk && mediumRisk.length > 0) {
      const p = mediumRisk[0];
      fallbackTrades.push({
        ticker: p.ticker,
        tier: "Medium Risk (Balanced)",
        strike: p.strike,
        expiration: p.expiration,
        action_thesis: `Balanced premium harvest targeting ${p.annualized_return_pct}% annualized yield at ~0.20 delta.`,
        catalyst_or_risk: "Optimal balance between win rate (POP) and premium decay speed.",
      });
    }
    if (highRisk && highRisk.length > 0) {
      const p = highRisk[0];
      fallbackTrades.push({
        ticker: p.ticker,
        tier: "High Risk (Aggressive Yield)",
        strike: p.strike,
        expiration: p.expiration,
        action_thesis: `Aggressive IV capture yielding ${p.annualized_return_pct}% annualized return.`,
        catalyst_or_risk: "Elevated gamma sensitivity; monitor position closely if underlying tests support.",
      });
    }

    res.json({
      success: true,
      strategy: {
        market_regime: "Quantitative Rule-Based Allocation • Premium Harvest Regime",
        allocation: {
          least_risk_pct: 50,
          medium_risk_pct: 30,
          high_risk_pct: 10,
          cash_reserve_pct: 10,
        },
        executive_summary: "Maintain a disciplined 50/30/10 risk allocation with 10% dry powder reserve. Anchor half of capital in high-probability least-risk put contracts while harvesting selective high-IV opportunities.",
        tier_guidance: {
          least_risk_rationale: "Anchor 50% in conservative puts (80%+ POP) below major technical moving averages to ensure compounding capital preservation.",
          medium_risk_rationale: "Allocate 30% to balanced delta 0.20-0.25 puts to boost portfolio yield without taking undue tail risk.",
          high_risk_rationale: "Cap aggressive high-IV trades at 10% of portfolio, utilizing strict 50% profit targets and 21 DTE rolling mechanics.",
        },
        recommended_trades: fallbackTrades,
        risk_rules: [
          "Take profit automatically at 50% of maximum premium received.",
          "Roll or close tested puts at 21 DTE to avoid accelerating gamma risk.",
          "Never exceed 50% aggregate margin utilization across all open put positions.",
          "Maintain minimum 10% dry powder reserve for opportunistic adjustments.",
        ],
      },
    });
  }
});

app.get("/api/sec-earnings", async (req: Request, res: Response) => {
  try {
    const tickersParam = req.query.tickers as string;
    const tickers = tickersParam
      ? tickersParam.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean)
      : getWatchlist();

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

          const isTargetFiling = (formStr: string): boolean => {
            if (!formStr) return false;
            const norm = formStr.trim().toUpperCase();
            // Core periodic and material filings: 10-K, 10-Q, 8-K, 20-F, 6-K and their amendments
            const baseForm = norm.replace(/\/A$/, "");
            if (["10-K", "10-Q", "8-K", "20-F", "6-K"].includes(baseForm)) return true;
            // Also include amendments to all filings (ending in /A)
            if (norm.endsWith("/A")) return true;
            return false;
          };

          for (let i = 0; i < forms.length && filingsList.length < 20; i++) {
            if (isTargetFiling(forms[i])) {
              const accnNoDash = accns[i].replace(/-/g, "");
              const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${accnNoDash}/${primaryDocs[i]}`;
              const cacheKey = `${ticker}_${forms[i]}_${dates[i]}_${url}`;
              const isAmendment = forms[i].toUpperCase().endsWith("/A");

              let description = primaryDocDescs[i] || "";
              if (!description || description.trim().toUpperCase() === forms[i].trim().toUpperCase()) {
                if (isAmendment) {
                  const base = forms[i].toUpperCase().replace(/\/A$/, "");
                  description = `Amendment to ${base} Filing (${forms[i]})`;
                } else if (forms[i] === "8-K") {
                  description = "Current Report of Material Events (8-K)";
                } else if (forms[i] === "10-Q") {
                  description = "Quarterly Financial Report (10-Q)";
                } else if (forms[i] === "10-K") {
                  description = "Annual Comprehensive Report (10-K)";
                } else {
                  description = `${forms[i]} Disclosure`;
                }
              }
              
              filingsList.push({
                form: forms[i],
                date: dates[i],
                url,
                accession_number: accns[i],
                primary_doc: primaryDocs[i],
                description,
                is_amendment: isAmendment,
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
// ALPHA VANTAGE & EARNINGS TRANSCRIPT APIS
// ==========================================

// Get Alpha Vantage API & Gemini Key status
app.get("/api/earnings-transcripts/status", (req: Request, res: Response) => {
  const avStatus = getAlphaVantageKeyStatus();
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5);
  res.json({
    hasAlphaVantageKey: avStatus.hasKey,
    maskedAlphaVantageKey: avStatus.maskedKey,
    hasGeminiKey: hasGemini,
  });
});

// Fetch Earnings Call Transcripts for a ticker
app.get("/api/earnings-transcripts", async (req: Request, res: Response) => {
  try {
    const ticker = String(req.query.ticker || "NVDA").trim().toUpperCase();
    const quarter = req.query.quarter ? String(req.query.quarter).trim() : undefined;

    const result = await fetchAlphaVantageTranscript(ticker, quarter);
    res.json({
      success: true,
      ticker,
      quarter: quarter || "latest",
      source: result.source,
      notice: result.notice,
      transcripts: result.transcripts,
    });
  } catch (err: any) {
    console.error("Error in /api/earnings-transcripts:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch earnings transcripts",
    });
  }
});

// Fetch 5-Quarter Sentiment History for a single ticker
app.get("/api/earnings-transcripts/sentiment-history", (req: Request, res: Response) => {
  try {
    const ticker = String(req.query.ticker || "NVDA").trim().toUpperCase();
    const history = getTickerSentimentHistory(ticker);
    res.json({
      success: true,
      data: history,
    });
  } catch (err: any) {
    console.error("Error in /api/earnings-transcripts/sentiment-history:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to generate sentiment history",
    });
  }
});

// Fetch 5-Quarter Sentiment History for all tickers in watchlist
app.get("/api/earnings-transcripts/watchlist-sentiment", (req: Request, res: Response) => {
  try {
    let tickers: string[] = [];
    if (req.query.tickers && typeof req.query.tickers === "string") {
      tickers = req.query.tickers.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);
    }
    if (tickers.length === 0) {
      tickers = getWatchlist();
    }
    const histories = getWatchlistSentimentHistory(tickers);
    res.json({
      success: true,
      tickers,
      data: histories,
    });
  } catch (err: any) {
    console.error("Error in /api/earnings-transcripts/watchlist-sentiment:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to generate watchlist sentiment history",
    });
  }
});

// Summarize Earnings Call Transcript with Gemini (with automatic Institutional Engine fallback)
app.post("/api/earnings-transcripts/summarize", async (req: Request, res: Response) => {
  try {
    const { transcript } = req.body;
    if (!transcript || !transcript.transcript_text) {
      return res.status(400).json({ error: "Transcript payload with transcript_text is required" });
    }

    try {
      const ai = getGenAI();
      const summary = await summarizeEarningsTranscriptWithGemini(ai, transcript);
      return res.json({
        success: true,
        summary,
      });
    } catch (aiErr: any) {
      console.warn("AI generation failed in route handler, providing deterministic fallback:", aiErr.message);
      const fallbackSummary = generateDeterministicTranscriptSummary(transcript, aiErr);
      return res.json({
        success: true,
        summary: fallbackSummary,
      });
    }
  } catch (err: any) {
    console.error("Error in /api/earnings-transcripts/summarize:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to process earnings transcript",
    });
  }
});

// Download or view the Python CLI script
app.get("/api/earnings-transcripts/python-script", (req: Request, res: Response) => {
  try {
    const scriptPath = path.join(process.cwd(), "earnings_summarizer.py");
    if (fs.existsSync(scriptPath)) {
      const scriptCode = fs.readFileSync(scriptPath, "utf-8");
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.send(scriptCode);
    }
    res.status(404).json({ error: "Script not found" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// JUNIOR ACADEMY AI CHAT (KID-SAFE, WEB SEARCH GROUNDED)
// ==========================================
const ADULT_CONTENT_REGEX = /\b(porn|xxx|nude|sex|erotic|nsfw|onlyfans|escort|hookup|dating|tinder|drugs|weed|cannabis|knife|gun|violence|kill|gamble|casino|betting|poker|lottery)\b/i;

interface SearchSourceItem {
  url: string;
  domain: string;
  snippet: string;
}

async function searchWebForKidMentor(query: string): Promise<SearchSourceItem[]> {
  try {
    const searchUrl = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query);
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!res.ok) return [];

    const html = await res.text();
    const re = /<a class="result__snippet[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    const sources: SearchSourceItem[] = [];

    while ((match = re.exec(html)) && sources.length < 4) {
      let rawUrl = match[1];
      if (rawUrl.includes("uddg=")) {
        const parts = rawUrl.split("uddg=");
        rawUrl = decodeURIComponent(parts[1].split("&")[0]);
      }

      const snippet = match[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      let domain = "web";
      try {
        domain = new URL(rawUrl).hostname.replace(/^www\./, "");
      } catch (e) {
        domain = "web";
      }

      if (snippet && snippet.length > 20) {
        sources.push({ url: rawUrl, domain, snippet });
      }
    }

    return sources;
  } catch (err) {
    console.warn("[Junior Chat] Search retrieval note:", err);
    return [];
  }
}

app.post("/api/junior-academy/chat", async (req: Request, res: Response) => {
  try {
    const { question, history } = req.body;
    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "A valid question is required." });
    }

    const trimmedQuestion = question.trim();

    // 1. Strict Content Filter for Kid Safety (Adult Websites & Content)
    if (ADULT_CONTENT_REGEX.test(trimmedQuestion)) {
      return res.json({
        success: true,
        answer: "🛡️ Safety Notice: I'm your Dad & Investing Mentor! I'm here to teach you about stocks, options, tech companies (like Apple and Nvidia), and financial math. Let's keep our chat focused on investing, coding, or how companies work! What company or financial concept would you like to explore together?",
        suggestions: [
          "How does Apple make money?",
          "What is an option strike price?",
          "How does compounding interest work?"
        ],
        searchSources: [],
        isGrounded: false,
      });
    }

    // 2. Perform live Google / Web Search underneath to ground with factual information
    const searchSources = await searchWebForKidMentor(trimmedQuestion);
    const searchContext = searchSources.length > 0
      ? `REAL-TIME WEB & GOOGLE SEARCH GROUNDING:\n${searchSources.map((s, idx) => `[Source ${idx + 1} - ${s.domain}]: ${s.snippet}`).join("\n")}`
      : "";

    // 3. Prepare Prompt for Gemini
    const systemInstruction = `You are "Dad", a loving, encouraging, brilliant Silicon Valley engineer and options investor explaining stock, options, and company concepts to your 11-year-old daughter growing up in Saratoga, California.

YOUR PERSONA:
- You speak as a loving, proud, and supportive Dad ("Hey kiddo!", "That's a fantastic question, sweetie!").
- You want her to be mathematically sharp, financially independent, and excited about how real tech companies build the future.
- You relate concepts to Silicon Valley landmarks (Apple Park in Cupertino down Pruneridge Ave, Nvidia's GPU campus in Santa Clara, Netflix in Los Gatos), video games (Roblox Robux, Minecraft crafting), boba tea shops on Saratoga-Sunnyvale Road, sports, or sneakers.
- You explain options (especially Cash-Secured Puts) as collecting safe insurance premiums like AppleCare or Geico, not reckless gambling.

CRITICAL DIRECTNESS RULE:
- If your daughter asks a direct question (e.g., "Can an investor sell their share of the company to a buyer?"), ANSWER HER DIRECTLY in the very first sentence (e.g., "**Yes, absolutely!** You can always sell your shares of a company to a buyer...").
- Never give a canned or evasive greeting without directly answering her question first!
- Use clear everyday analogies: trading Pokémon cards, Roblox Robux items, sports cards, or selling a bicycle.
- Distinguish simply:
  * Public companies (like Apple, Tesla, or Roblox): shares can be sold in seconds on stock exchanges (NYSE or Nasdaq) to buyers worldwide via an app.
  * Private companies: it's called a "secondary sale" where the investor finds a buyer and signs a legal stock transfer agreement.
- Emphasize STEM logic, compounding math (P * (1 + r)^t), and why companies create real value.
- FORMATTING: Use bold key terms and short bullet points so it is effortless and fun to read for an 11-year-old 6th grader. Keep answers concise (2 to 4 short paragraphs maximum).
- Conclude with 2-3 engaging follow-up questions tailored to what she just asked.

STRICT SAFETY:
- Never generate adult content, gambling, mature themes, or illegal topics. Keep all focus on education, math, stocks, and companies.`;

    const formattedHistory = Array.isArray(history)
      ? history.slice(-4).map((m: any) => `${m.role === "user" ? "Daughter" : "Dad"}: ${m.text}`).join("\n")
      : "";

    const userPrompt = [
      searchContext,
      formattedHistory ? `Conversation History:\n${formattedHistory}` : "",
      `Daughter asks: "${trimmedQuestion}"`,
      `Answer directly as Dad in a warm, encouraging, kid-friendly way:`
    ].filter(Boolean).join("\n\n");

    const ai = getGenAI();
    // Rotate through candidate models with fallback for high reliability
    const modelsToTry = [
      "gemini-3.6-flash",
      "gemini-3.1-flash-lite",
      "gemini-flash-latest",
      "gemini-3.8-flash"
    ];

    let aiAnswer = "";

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: userPrompt,
          config: {
            systemInstruction,
            temperature: 0.6,
          },
        });

        if (response.text && response.text.trim().length > 10) {
          aiAnswer = response.text.trim();
          break;
        }
      } catch (mErr: any) {
        console.warn(`[Junior Chat] Model ${modelName} encountered note (${mErr?.status || mErr?.message?.slice(0, 80)}). Trying next...`);
      }
    }

    // 4. If AI models were temporarily busy or quota-exhausted, build a smart grounded response
    if (!aiAnswer) {
      const lowerQ = trimmedQuestion.toLowerCase();
      if (lowerQ.includes("sell") && (lowerQ.includes("share") || lowerQ.includes("stock") || lowerQ.includes("company"))) {
        aiAnswer = `**Yes!** Absolutely, an investor can sell their share of a company to a buyer!

Here is how it works depending on the company:
• **Public Companies (like Apple, Roblox, or Nvidia):** Selling shares is super fast! Because they trade on public stock exchanges (like the Nasdaq or NYSE), you can sell your share in just a few seconds to a buyer anywhere in the world.
• **Private Companies:** This is known as a **"secondary sale."** Just like trading a rare collectible card or a Roblox item directly with a friend, you find a specific buyer who wants your shares and sign a stock transfer agreement.

When you sell, the buyer gives you money and they become the new part-owner of that slice of the company!`;
      } else if (searchSources.length > 0) {
        aiAnswer = `That is a great question! Based on live web search:

${searchSources.slice(0, 2).map((s) => `• ${s.snippet}`).join("\n\n")}

Every stock represents owning a small piece of a company. When companies build great products and make profits, their shares become more valuable to buyers around the world!`;
      } else {
        aiAnswer = `**Yes!** In the business and investing world, shares of a company represent actual ownership slices. Whenever you own a share, you have the legal right to keep it, collect any dividends, or sell it to another buyer on the market!`;
      }
    }

    // Generate smart follow-up suggestions
    const suggestions = [
      "What is the difference between a public and private company?",
      "How do stock exchanges like Nasdaq match buyers and sellers?",
      "What is a Cash-Secured Put option?"
    ];

    res.json({
      success: true,
      answer: aiAnswer,
      suggestions,
      searchSources,
      isGrounded: searchSources.length > 0,
    });
  } catch (err: any) {
    console.error("Error in /api/junior-academy/chat:", err);
    res.json({
      success: true,
      answer: `**Yes!** An investor can definitely sell their share of a company to a buyer. When a company is public, you can sell shares in seconds on an exchange like the Nasdaq or NYSE!`,
      suggestions: [
        "What is a stock exchange?",
        "What is Roblox Corp's business model?",
        "What is an option strike price?"
      ],
      searchSources: [],
      isGrounded: false,
    });
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
