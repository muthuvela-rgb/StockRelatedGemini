export interface HistoricalBar {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma20: number | null;
  bollingerUpper: number | null;
  bollingerLower: number | null;
  bollingerBandwidth: number | null;
  bollingerPercentB: number | null;
  rsi14: number | null;
  rsiOverbought?: boolean;
  rsiOversold?: boolean;
  bollingerUpperBreach?: boolean;
  bollingerLowerBreach?: boolean;
}

export interface ChartTechnicalSummary {
  ticker: string;
  companyName: string;
  currentPrice: number;
  previousClose: number;
  periodStartPrice: number;
  periodEndPrice: number;
  periodChange: number;
  periodChangePct: number;
  periodHigh: number;
  periodLow: number;
  sma20: number | null;
  priceVsSma20Pct: number | null;
  bollingerUpper: number | null;
  bollingerLower: number | null;
  bollingerBandwidth: number | null;
  bollingerPercentB: number | null;
  rsi14: number | null;
  rsiSignal: "Overbought (RSI > 70)" | "Oversold (RSI < 30)" | "Bullish Momentum (55-70)" | "Neutral (45-55)" | "Bearish Momentum (30-45)" | "Insufficient Data";
  bollingerSignal: "Above Upper Band (+2σ)" | "Below Lower Band (-2σ)" | "Within Normal Bands" | "Band Squeeze (Low Volatility)";
  technicalInsight: string;
  firstDate: string;
  lastDate: string;
  dataPointsCount: number;
  currency: string;
}

export interface MultiTickerComparisonItem {
  ticker: string;
  currentPrice: number;
  periodChangePct: number;
  data: Array<{
    date: string;
    timestamp: number;
    close: number;
    pctReturn: number;
  }>;
}

export interface HistoricalChartResponse {
  primaryTicker: string;
  range: string;
  interval: string;
  bars: HistoricalBar[];
  summary: ChartTechnicalSummary;
  comparisons?: MultiTickerComparisonItem[];
  availableRanges: string[];
}

const HTTP_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
};

// In-memory cache for fast responsive charting (5 minute TTL)
const chartCache = new Map<string, { data: HistoricalChartResponse; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Calculates start timestamp for user selected duration up to 50 years
 */
function getPeriodTimestamps(
  range: string,
  from?: string,
  to?: string
): { period1: number; period2: number; defaultInterval: string } {
  const now = Math.floor(Date.now() / 1000);
  let period2 = now;

  if (to) {
    const toTs = Math.floor(new Date(to).getTime() / 1000);
    if (!isNaN(toTs) && toTs > 0) period2 = toTs;
  }

  if (from) {
    const fromTs = Math.floor(new Date(from).getTime() / 1000);
    if (!isNaN(fromTs) && fromTs > 0) {
      const daysDiff = (period2 - fromTs) / 86400;
      const defaultInterval = daysDiff > 365 * 10 ? "1mo" : daysDiff > 365 * 3 ? "1wk" : "1d";
      return { period1: fromTs, period2, defaultInterval };
    }
  }

  const normalized = range.toLowerCase().trim();
  switch (normalized) {
    case "1m":
    case "1mo":
      return { period1: period2 - 31 * 86400, period2, defaultInterval: "1d" };
    case "3m":
    case "3mo":
      return { period1: period2 - 93 * 86400, period2, defaultInterval: "1d" };
    case "6m":
    case "6mo":
      return { period1: period2 - 186 * 86400, period2, defaultInterval: "1d" };
    case "1y":
      return { period1: period2 - 366 * 86400, period2, defaultInterval: "1d" };
    case "2y":
      return { period1: period2 - 732 * 86400, period2, defaultInterval: "1d" };
    case "5y":
      return { period1: period2 - Math.floor(5 * 365.25 * 86400), period2, defaultInterval: "1wk" };
    case "10y":
      return { period1: period2 - Math.floor(10 * 365.25 * 86400), period2, defaultInterval: "1wk" };
    case "20y":
      return { period1: period2 - Math.floor(20 * 365.25 * 86400), period2, defaultInterval: "1wk" };
    case "30y":
      return { period1: period2 - Math.floor(30 * 365.25 * 86400), period2, defaultInterval: "1mo" };
    case "50y":
      return { period1: period2 - Math.floor(50 * 365.25 * 86400), period2, defaultInterval: "1mo" };
    case "max":
      return { period1: 0, period2, defaultInterval: "1mo" };
    default:
      return { period1: period2 - 366 * 86400, period2, defaultInterval: "1d" };
  }
}

/**
 * Fetch raw Yahoo Finance chart series
 */
async function fetchYahooRawChart(ticker: string, period1: number, period2: number, interval: string) {
  const hosts = ["query2.finance.yahoo.com", "query1.finance.yahoo.com"];
  for (const host of hosts) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(
        ticker
      )}?period1=${period1}&period2=${period2}&interval=${interval}&includeAdjustedClose=true`;

      const res = await fetch(url, { headers: HTTP_HEADERS, signal: AbortSignal.timeout(6500) });
      if (res.ok) {
        const json = await res.json();
        if (json?.chart?.result?.[0]) {
          return json.chart.result[0];
        }
      }

      // Fallback without period1=0 if 0 is rejected
      if (period1 === 0) {
        const fallbackUrl = `https://${host}/v8/finance/chart/${encodeURIComponent(
          ticker
        )}?range=max&interval=${interval}`;
        const fbRes = await fetch(fallbackUrl, { headers: HTTP_HEADERS, signal: AbortSignal.timeout(6500) });
        if (fbRes.ok) {
          const json = await fbRes.json();
          if (json?.chart?.result?.[0]) {
            return json.chart.result[0];
          }
        }
      }
    } catch {
      // Continue to next host fallback
    }
  }
  return null;
}

/**
 * Compute 20 SMA, Bollinger Bands (20, 2σ), and Wilder's RSI (14)
 */
function computeTechnicals(bars: HistoricalBar[]): HistoricalBar[] {
  const n = bars.length;
  if (n === 0) return bars;

  const smaPeriod = 20;
  const rsiPeriod = 14;

  // 1. Compute 20-Day SMA & Bollinger Bands
  for (let i = 0; i < n; i++) {
    if (i >= smaPeriod - 1) {
      let sum = 0;
      for (let k = 0; k < smaPeriod; k++) {
        sum += bars[i - k].close;
      }
      const sma = sum / smaPeriod;
      let variance = 0;
      for (let k = 0; k < smaPeriod; k++) {
        const diff = bars[i - k].close - sma;
        variance += diff * diff;
      }
      const stdDev = Math.sqrt(variance / smaPeriod);
      const upper = sma + 2 * stdDev;
      const lower = sma - 2 * stdDev;
      const bandwidth = sma > 0 ? ((upper - lower) / sma) * 100 : 0;
      const percentB = upper !== lower ? (bars[i].close - lower) / (upper - lower) : 0.5;

      bars[i].sma20 = Number(sma.toFixed(2));
      bars[i].bollingerUpper = Number(upper.toFixed(2));
      bars[i].bollingerLower = Number(lower.toFixed(2));
      bars[i].bollingerBandwidth = Number(bandwidth.toFixed(2));
      bars[i].bollingerPercentB = Number(percentB.toFixed(2));
      bars[i].bollingerUpperBreach = bars[i].close > upper;
      bars[i].bollingerLowerBreach = bars[i].close < lower;
    } else {
      bars[i].sma20 = null;
      bars[i].bollingerUpper = null;
      bars[i].bollingerLower = null;
      bars[i].bollingerBandwidth = null;
      bars[i].bollingerPercentB = null;
      bars[i].bollingerUpperBreach = false;
      bars[i].bollingerLowerBreach = false;
    }
  }

  // 2. Compute Wilder's RSI (14)
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      bars[i].rsi14 = null;
      bars[i].rsiOverbought = false;
      bars[i].rsiOversold = false;
      continue;
    }

    const delta = bars[i].close - bars[i - 1].close;
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;

    if (i < rsiPeriod) {
      avgGain += gain;
      avgLoss += loss;
      bars[i].rsi14 = null;
      bars[i].rsiOverbought = false;
      bars[i].rsiOversold = false;
    } else if (i === rsiPeriod) {
      avgGain = (avgGain + gain) / rsiPeriod;
      avgLoss = (avgLoss + loss) / rsiPeriod;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = Number((100 - 100 / (1 + rs)).toFixed(1));
      bars[i].rsi14 = rsi;
      bars[i].rsiOverbought = rsi >= 70;
      bars[i].rsiOversold = rsi <= 30;
    } else {
      avgGain = (avgGain * (rsiPeriod - 1) + gain) / rsiPeriod;
      avgLoss = (avgLoss * (rsiPeriod - 1) + loss) / rsiPeriod;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = Number((100 - 100 / (1 + rs)).toFixed(1));
      bars[i].rsi14 = rsi;
      bars[i].rsiOverbought = rsi >= 70;
      bars[i].rsiOversold = rsi <= 30;
    }
  }

  return bars;
}

/**
 * Generate technical interpretation and summary statistics
 */
function buildSummary(
  ticker: string,
  meta: any,
  bars: HistoricalBar[]
): ChartTechnicalSummary {
  if (bars.length === 0) {
    return {
      ticker,
      companyName: ticker,
      currentPrice: 0,
      previousClose: 0,
      periodStartPrice: 0,
      periodEndPrice: 0,
      periodChange: 0,
      periodChangePct: 0,
      periodHigh: 0,
      periodLow: 0,
      sma20: null,
      priceVsSma20Pct: null,
      bollingerUpper: null,
      bollingerLower: null,
      bollingerBandwidth: null,
      bollingerPercentB: null,
      rsi14: null,
      rsiSignal: "Insufficient Data",
      bollingerSignal: "Within Normal Bands",
      technicalInsight: "Insufficient price history to calculate technical indicators.",
      firstDate: "",
      lastDate: "",
      dataPointsCount: 0,
      currency: "USD",
    };
  }

  const latest = bars[bars.length - 1];
  const first = bars[0];
  const currentPrice = latest.close;
  const previousClose = meta?.chartPreviousClose || (bars.length > 1 ? bars[bars.length - 2].close : currentPrice);
  const periodStartPrice = first.close;
  const periodEndPrice = currentPrice;
  const periodChange = Number((periodEndPrice - periodStartPrice).toFixed(2));
  const periodChangePct = periodStartPrice > 0 ? Number((((periodEndPrice - periodStartPrice) / periodStartPrice) * 100).toFixed(2)) : 0;

  let periodHigh = -Infinity;
  let periodLow = Infinity;
  for (const b of bars) {
    if (b.high > periodHigh) periodHigh = b.high;
    if (b.low < periodLow) periodLow = b.low;
  }
  if (periodHigh === -Infinity) periodHigh = currentPrice;
  if (periodLow === Infinity) periodLow = currentPrice;

  const sma20 = latest.sma20;
  const priceVsSma20Pct = sma20 && sma20 > 0 ? Number((((currentPrice - sma20) / sma20) * 100).toFixed(2)) : null;

  const rsi = latest.rsi14;
  let rsiSignal: ChartTechnicalSummary["rsiSignal"] = "Neutral (45-55)";
  if (rsi === null) rsiSignal = "Insufficient Data";
  else if (rsi >= 70) rsiSignal = "Overbought (RSI > 70)";
  else if (rsi <= 30) rsiSignal = "Oversold (RSI < 30)";
  else if (rsi >= 55) rsiSignal = "Bullish Momentum (55-70)";
  else if (rsi <= 45) rsiSignal = "Bearish Momentum (30-45)";

  let bollingerSignal: ChartTechnicalSummary["bollingerSignal"] = "Within Normal Bands";
  if (latest.bollingerUpper && currentPrice >= latest.bollingerUpper) {
    bollingerSignal = "Above Upper Band (+2σ)";
  } else if (latest.bollingerLower && currentPrice <= latest.bollingerLower) {
    bollingerSignal = "Below Lower Band (-2σ)";
  } else if (latest.bollingerBandwidth && latest.bollingerBandwidth < 8.0) {
    bollingerSignal = "Band Squeeze (Low Volatility)";
  }

  // Construct comprehensive human-readable technical narrative
  const insights: string[] = [];
  if (priceVsSma20Pct !== null) {
    if (priceVsSma20Pct > 5) {
      insights.push(`Strong bullish posture trading +${priceVsSma20Pct}% above its 20-day SMA ($${sma20})`);
    } else if (priceVsSma20Pct > 0) {
      insights.push(`Holding above its 20-day SMA ($${sma20}) by +${priceVsSma20Pct}%`);
    } else if (priceVsSma20Pct < -5) {
      insights.push(`Extended below 20-day SMA ($${sma20}) by ${priceVsSma20Pct}%, facing near-term downward pressure`);
    } else {
      insights.push(`Consolidating near its 20-day SMA ($${sma20}) at ${priceVsSma20Pct}%`);
    }
  }

  if (rsi !== null) {
    if (rsi >= 70) {
      insights.push(`RSI is overbought at ${rsi}, signaling elevated exhaustion risk or strong momentum continuation`);
    } else if (rsi <= 30) {
      insights.push(`RSI is oversold at ${rsi}, indicating potential mean-reversion rebound territory`);
    } else {
      insights.push(`RSI is balanced at ${rsi} (neutral-momentum)`);
    }
  }

  if (latest.bollingerUpper && latest.bollingerLower) {
    if (currentPrice > latest.bollingerUpper) {
      insights.push(`Price is piercing the Upper Bollinger Band ($${latest.bollingerUpper}), reflecting high positive volatility`);
    } else if (currentPrice < latest.bollingerLower) {
      insights.push(`Price is testing the Lower Bollinger Band ($${latest.bollingerLower}), a typical dip-buying test zone`);
    } else if (latest.bollingerBandwidth && latest.bollingerBandwidth < 8) {
      insights.push(`Bollinger Bandwidth is tightly compressed (${latest.bollingerBandwidth}%), precursing an impending volatility breakout`);
    } else {
      insights.push(`Oscillating inside normal 2σ Bollinger envelope ($${latest.bollingerLower} – $${latest.bollingerUpper})`);
    }
  }

  return {
    ticker,
    companyName: meta?.shortName || meta?.longName || ticker,
    currentPrice: Number(currentPrice.toFixed(2)),
    previousClose: Number(previousClose.toFixed(2)),
    periodStartPrice: Number(periodStartPrice.toFixed(2)),
    periodEndPrice: Number(periodEndPrice.toFixed(2)),
    periodChange,
    periodChangePct,
    periodHigh: Number(periodHigh.toFixed(2)),
    periodLow: Number(periodLow.toFixed(2)),
    sma20,
    priceVsSma20Pct,
    bollingerUpper: latest.bollingerUpper,
    bollingerLower: latest.bollingerLower,
    bollingerBandwidth: latest.bollingerBandwidth,
    bollingerPercentB: latest.bollingerPercentB,
    rsi14: rsi,
    rsiSignal,
    bollingerSignal,
    technicalInsight: insights.join(". ") + ".",
    firstDate: first.date,
    lastDate: latest.date,
    dataPointsCount: bars.length,
    currency: meta?.currency || "USD",
  };
}

/**
 * Main handler to fetch historical chart with full technicals
 */
export async function getHistoricalStockChart(params: {
  ticker: string;
  comparisonTickers?: string[];
  range?: string;
  interval?: string;
  from?: string;
  to?: string;
}): Promise<HistoricalChartResponse | null> {
  const primaryTicker = params.ticker.trim().toUpperCase();
  const range = (params.range || "1y").toLowerCase();

  const { period1, period2, defaultInterval } = getPeriodTimestamps(range, params.from, params.to);
  const interval = (params.interval || defaultInterval).toLowerCase();

  const cacheKey = `${primaryTicker}_${period1}_${period2}_${interval}_${(params.comparisonTickers || []).join(",")}`;
  const cached = chartCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // 1. Fetch Primary Ticker
  const rawChart = await fetchYahooRawChart(primaryTicker, period1, period2, interval);
  if (!rawChart || !rawChart.timestamp || rawChart.timestamp.length === 0) {
    return null;
  }

  const timestamps: number[] = rawChart.timestamp;
  const quote = rawChart.indicators?.quote?.[0] || {};
  const opens: (number | null)[] = quote.open || [];
  const highs: (number | null)[] = quote.high || [];
  const lows: (number | null)[] = quote.low || [];
  const closes: (number | null)[] = quote.close || [];
  const volumes: (number | null)[] = quote.volume || [];

  const rawBars: HistoricalBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const c = closes[i];
    if (c === null || c === undefined || isNaN(c)) continue;

    const dateStr = new Date(ts * 1000).toISOString().split("T")[0];
    rawBars.push({
      date: dateStr,
      timestamp: ts,
      open: opens[i] !== null && !isNaN(opens[i]!) ? Number(opens[i]!.toFixed(2)) : Number(c.toFixed(2)),
      high: highs[i] !== null && !isNaN(highs[i]!) ? Number(highs[i]!.toFixed(2)) : Number(c.toFixed(2)),
      low: lows[i] !== null && !isNaN(lows[i]!) ? Number(lows[i]!.toFixed(2)) : Number(c.toFixed(2)),
      close: Number(c.toFixed(2)),
      volume: volumes[i] !== null && !isNaN(volumes[i]!) ? Math.round(volumes[i]!) : 0,
      sma20: null,
      bollingerUpper: null,
      bollingerLower: null,
      bollingerBandwidth: null,
      bollingerPercentB: null,
      rsi14: null,
    });
  }

  if (rawBars.length === 0) {
    return null;
  }

  // Calculate full technical indicator series
  const bars = computeTechnicals(rawBars);
  const summary = buildSummary(primaryTicker, rawChart.meta, bars);

  // 2. Fetch Comparison Tickers if requested
  const comparisons: MultiTickerComparisonItem[] = [];
  if (params.comparisonTickers && params.comparisonTickers.length > 0) {
    for (const compTicker of params.comparisonTickers) {
      const cleanComp = compTicker.trim().toUpperCase();
      if (!cleanComp || cleanComp === primaryTicker) continue;

      try {
        const compRaw = await fetchYahooRawChart(cleanComp, period1, period2, interval);
        if (compRaw && compRaw.timestamp && compRaw.timestamp.length > 0) {
          const compTs: number[] = compRaw.timestamp;
          const compCloses: (number | null)[] = compRaw.indicators?.quote?.[0]?.close || [];
          const compBars: Array<{ date: string; timestamp: number; close: number; pctReturn: number }> = [];

          let baseClose: number | null = null;
          for (let i = 0; i < compTs.length; i++) {
            const c = compCloses[i];
            if (c === null || c === undefined || isNaN(c)) continue;
            if (baseClose === null && c > 0) baseClose = c;

            const pctReturn = baseClose && baseClose > 0 ? Number((((c - baseClose) / baseClose) * 100).toFixed(2)) : 0;
            compBars.push({
              date: new Date(compTs[i] * 1000).toISOString().split("T")[0],
              timestamp: compTs[i],
              close: Number(c.toFixed(2)),
              pctReturn,
            });
          }

          if (compBars.length > 0) {
            const currentPrice = compBars[compBars.length - 1].close;
            const periodChangePct = compBars[compBars.length - 1].pctReturn;
            comparisons.push({
              ticker: cleanComp,
              currentPrice,
              periodChangePct,
              data: compBars,
            });
          }
        }
      } catch (e) {
        console.error(`Failed to fetch comparison ticker ${cleanComp}:`, e);
      }
    }
  }

  const result: HistoricalChartResponse = {
    primaryTicker,
    range,
    interval,
    bars,
    summary,
    comparisons,
    availableRanges: ["1M", "3M", "6M", "1Y", "2Y", "5Y", "10Y", "20Y", "30Y", "50Y", "MAX"],
  };

  chartCache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}
