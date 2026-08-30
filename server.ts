import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- CONSTANTS & WATCHLIST ---
const DEFAULT_WATCHLIST = ["SPCX", "MU", "SNDK", "ALAB", "NVDA", "SKHY", "META", "TSLA", "QQQ"];
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

// Portfolio Margin Requirement Estimation
function estimatePortfolioMargin(
  currentPrice: number,
  strike: number,
  premium: number,
  shockPct = 15.0,
  floorPerShare = 0.375,
  floorPctOfPrice = 5.0,
  premiumBufferPct = 0.0
): number {
  const stressedPrice = currentPrice * (1 - shockPct / 100);
  const stressedLoss = Math.max(strike - stressedPrice, 0);
  const netRequirement = Math.max(stressedLoss - premium, 0);
  const notionalFloor = Math.max(floorPerShare, (floorPctOfPrice / 100) * currentPrice);
  const premiumFloor = premium * (1 + premiumBufferPct / 100);
  const floor = Math.max(notionalFloor, premiumFloor);
  return Math.max(netRequirement, floor);
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
const HTTP_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

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

async function fetchYahooOptions(ticker: string, dateTimestamp?: number) {
  try {
    let url = `https://query1.finance.yahoo.com/v7/finance/options/${encodeURIComponent(ticker)}`;
    if (dateTimestamp) {
      url += `?date=${dateTimestamp}`;
    }
    const res = await fetch(url, { headers: HTTP_HEADERS });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.optionChain?.result?.[0] || null;
  } catch (e) {
    console.error(`Error fetching options for ${ticker}:`, e);
    return null;
  }
}

async function fetchYahooQuoteSummary(ticker: string) {
  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=financialData,defaultKeyStatistics,summaryDetail,upgradeDowngradeHistory`;
    const res = await fetch(url, { headers: HTTP_HEADERS });
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

      let targetStrike: number | null = null;
      if (strikeMode === "single" && singleStrike) {
        targetStrike = singleStrike;
      } else if (strikeMode === "bollinger") {
        const chart = await fetchYahooChart(ticker, "3mo", "1d");
        const closes: number[] = (chart?.indicators?.quote?.[0]?.close || []).filter(
          (c: any) => c !== null && c !== undefined
        );
        const b = computeBollinger(closes, bollingerPeriod, bollingerStd);
        if (b) targetStrike = b.lower_band;
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
          });
        }
      }

      summaryList.push({
        ticker,
        current_price: currentPrice,
        market_cap: meta.marketCap,
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

    res.json({
      ticker,
      current_price: currentPrice,
      expirations: expDates,
      selected_expiration: expDateStr,
      days_to_expiration: dte,
      calls,
      puts,
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

          for (let i = 0; i < forms.length && filingsList.length < 5; i++) {
            if (["10-K", "10-Q", "8-K"].includes(forms[i])) {
              const accnNoDash = accns[i].replace(/-/g, "");
              const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${accnNoDash}/${primaryDocs[i]}`;
              filingsList.push({
                form: forms[i],
                date: dates[i],
                url,
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
