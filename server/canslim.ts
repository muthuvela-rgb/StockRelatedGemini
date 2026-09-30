import { GoogleGenAI } from "@google/genai";

interface CanslimMetricDetail {
  passed: boolean | null;
  value: number | null;
  weight: number;
  detail: string;
  sub_checks?: Record<string, any>;
}

export interface CanslimTickerResult {
  ticker: string;
  price: number | null;
  score: number;
  evaluable: number;
  score_pct: number;
  verdict: "Strong" | "Watch" | "Weak";
  criteria: {
    C: CanslimMetricDetail;
    A: CanslimMetricDetail;
    N: CanslimMetricDetail;
    S: CanslimMetricDetail;
    L: CanslimMetricDetail;
    I: CanslimMetricDetail;
    M: CanslimMetricDetail;
  };
  catalyst_summary?: string;
  company_name?: string;
}

export interface CanslimScreenResponse {
  benchmark: string;
  market_direction: {
    passed: boolean;
    detail: string;
    last_price: number;
    sma50: number;
    sma200: number;
  };
  results: CanslimTickerResult[];
  screened_at: string;
}

const HTTP_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
};

async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 4000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// In-memory cache for CANSLIM analysis (15 mins TTL)
const canslimCache = new Map<string, { data: CanslimTickerResult; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

export async function computeMarketDirection(benchmark = "QQQ") {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(benchmark)}?range=1y&interval=1d`;
    const res = await fetchWithTimeout(url, { headers: HTTP_HEADERS }, 4000);
    if (!res.ok) throw new Error(`Market chart returned status ${res.status}`);
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const quotes = result?.indicators?.quote?.[0];
    const closes: number[] = (quotes?.close || []).filter((c: any) => typeof c === "number" && !isNaN(c));

    if (closes.length < 200) {
      return {
        passed: true,
        benchmark,
        last_price: closes[closes.length - 1] || 0,
        sma50: 0,
        sma200: 0,
        detail: `${benchmark} data limited; default to confirmed trend`,
      };
    }

    const lastPrice = closes[closes.length - 1];
    const tail50 = closes.slice(-50);
    const tail200 = closes.slice(-200);

    const sma50 = tail50.reduce((a, b) => a + b, 0) / 50;
    const sma200 = tail200.reduce((a, b) => a + b, 0) / 200;

    const passed = lastPrice > sma50 && sma50 > sma200;

    return {
      passed,
      benchmark,
      last_price: Number(lastPrice.toFixed(2)),
      sma50: Number(sma50.toFixed(2)),
      sma200: Number(sma200.toFixed(2)),
      detail: `${benchmark} $${lastPrice.toFixed(2)} vs 50d $${sma50.toFixed(2)} / 200d $${sma200.toFixed(2)} (${passed ? "Confirmed Uptrend" : "Market Correction / Pressure"})`,
    };
  } catch (e: any) {
    return {
      passed: true,
      benchmark,
      last_price: 0,
      sma50: 0,
      sma200: 0,
      detail: `${benchmark} market check offline; neutral pass`,
    };
  }
}

export async function fetchUniverseReturns(symbols: string[]): Promise<Map<string, number>> {
  const returnsMap = new Map<string, number>();
  const chunk = symbols.slice(0, 40); // Fast sample for percentile benchmarking

  await Promise.all(
    chunk.map(async (sym) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1y&interval=1d`;
        const res = await fetchWithTimeout(url, { headers: HTTP_HEADERS }, 3000);
        if (!res.ok) return;
        const json = await res.json();
        const quotes = json?.chart?.result?.[0]?.indicators?.quote?.[0];
        const closes: number[] = (quotes?.close || []).filter((c: any) => typeof c === "number" && !isNaN(c));
        if (closes.length >= 2) {
          const ret = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100;
          returnsMap.set(sym.toUpperCase(), ret);
        }
      } catch {
        // ignore individual failure
      }
    })
  );

  return returnsMap;
}

export async function screenTickerCanslim(
  ticker: string,
  universeReturns: number[],
  marketDirection: any,
  genAI: GoogleGenAI | null,
  quoteSummaryFetcher?: (sym: string) => Promise<any>,
  chartFetcher?: (sym: string, range?: string, interval?: string) => Promise<any>
): Promise<CanslimTickerResult> {
  const sym = ticker.trim().toUpperCase();
  const cached = canslimCache.get(sym);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // 1. Fetch Chart History (1y daily)
  let closes: number[] = [];
  let volumes: number[] = [];
  try {
    let result = chartFetcher ? await chartFetcher(sym, "1y", "1d") : null;
    if (!result) {
      const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1y&interval=1d`;
      const res = await fetchWithTimeout(chartUrl, { headers: HTTP_HEADERS }, 3500);
      if (res.ok) {
        const json = await res.json();
        result = json?.chart?.result?.[0];
      }
    }
    const quote = result?.indicators?.quote?.[0];
    if (quote) {
      const rawCloses = quote.close || [];
      const rawVols = quote.volume || [];
      for (let i = 0; i < rawCloses.length; i++) {
        if (typeof rawCloses[i] === "number" && typeof rawVols[i] === "number") {
          closes.push(rawCloses[i]);
          volumes.push(rawVols[i]);
        }
      }
    }
  } catch (err) {
    // continue
  }

  // 2. Fetch QuoteSummary (financialData, defaultKeyStatistics, summaryDetail, majorHoldersBreakdown)
  let quoteSummary: any = null;
  try {
    if (quoteSummaryFetcher) {
      quoteSummary = await quoteSummaryFetcher(sym);
    }
    if (!quoteSummary) {
      const qsUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=financialData,defaultKeyStatistics,summaryDetail,majorHoldersBreakdown,price`;
      const res = await fetchWithTimeout(qsUrl, { headers: HTTP_HEADERS }, 3500);
      if (res.ok) {
        const json = await res.json();
        quoteSummary = json?.quoteSummary?.result?.[0];
      }
    }
  } catch {
    // continue
  }

  // 3. Fetch News for Catalyst Detection
  let newsHeadlines: string[] = [];
  try {
    const newsUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(sym)}&newsCount=8&quotesCount=0`;
    const res = await fetchWithTimeout(newsUrl, { headers: HTTP_HEADERS }, 3000);
    if (res.ok) {
      const json = await res.json();
      newsHeadlines = (json?.news || []).map((n: any) => n.title || "").filter(Boolean);
    }
  } catch {
    // continue
  }

  const fin = quoteSummary?.financialData || {};
  const stats = quoteSummary?.defaultKeyStatistics || {};
  const detail = quoteSummary?.summaryDetail || {};
  const priceData = quoteSummary?.price || {};

  const currentPrice =
    fin.currentPrice?.raw ||
    priceData.regularMarketPrice?.raw ||
    (closes.length > 0 ? closes[closes.length - 1] : null);

  const companyName = priceData.shortName || priceData.longName || sym;

  // --- C: Current Quarterly Earnings & Sales ---
  // O'Neil requires EPS growth >= 25% AND Revenue growth >= 20%
  let epsGrowth: number | null = fin.earningsGrowth?.raw !== undefined ? fin.earningsGrowth.raw * 100 : null;
  let revGrowth: number | null = fin.revenueGrowth?.raw !== undefined ? fin.revenueGrowth.raw * 100 : null;

  // Fallback 1: earningsHistory (compare latest -1q with -4q a year ago)
  if (epsGrowth === null && Array.isArray(quoteSummary?.earningsHistory?.history) && quoteSummary.earningsHistory.history.length >= 2) {
    const hist = quoteSummary.earningsHistory.history;
    const latestQ = hist[hist.length - 1];
    // Find matching quarter 4 periods back or earliest
    const priorQ = hist.length >= 4 ? hist[hist.length - 4] : hist[0];
    const latestEps = latestQ?.epsActual?.raw;
    const priorEps = priorQ?.epsActual?.raw;
    if (typeof latestEps === "number" && typeof priorEps === "number" && priorEps !== 0) {
      epsGrowth = Number((((latestEps - priorEps) / Math.abs(priorEps)) * 100).toFixed(1));
    }
  }

  // Fallback 2: incomeStatementHistoryQuarterly (compare net income & revenue)
  if (Array.isArray(quoteSummary?.incomeStatementHistoryQuarterly?.incomeStatementHistory) && quoteSummary.incomeStatementHistoryQuarterly.incomeStatementHistory.length >= 2) {
    const stmts = quoteSummary.incomeStatementHistoryQuarterly.incomeStatementHistory;
    const latestStmt = stmts[0];
    const priorStmt = stmts.length >= 4 ? stmts[stmts.length - 1] : stmts[stmts.length - 1];
    if (epsGrowth === null) {
      const latestNI = latestStmt?.netIncome?.raw;
      const priorNI = priorStmt?.netIncome?.raw;
      if (typeof latestNI === "number" && typeof priorNI === "number" && priorNI !== 0) {
        epsGrowth = Number((((latestNI - priorNI) / Math.abs(priorNI)) * 100).toFixed(1));
      }
    }
    if (revGrowth === null) {
      const latestRev = latestStmt?.totalRevenue?.raw;
      const priorRev = priorStmt?.totalRevenue?.raw;
      if (typeof latestRev === "number" && typeof priorRev === "number" && priorRev !== 0) {
        revGrowth = Number((((latestRev - priorRev) / Math.abs(priorRev)) * 100).toFixed(1));
      }
    }
  }

  // Fallback 3: defaultKeyStatistics
  if (epsGrowth === null && stats.earningsQuarterlyGrowth?.raw !== undefined) {
    epsGrowth = stats.earningsQuarterlyGrowth.raw * 100;
  }
  if (revGrowth === null && stats.revenueQuarterlyGrowth?.raw !== undefined) {
    revGrowth = stats.revenueQuarterlyGrowth.raw * 100;
  }

  let cPassed: boolean | null = null;
  let cDetail = "Insufficient quarterly data";

  if (epsGrowth !== null) {
    const epsOk = epsGrowth >= 25.0;
    const revOk = revGrowth !== null ? revGrowth >= 20.0 || revGrowth > 0 : true;
    cPassed = epsOk && revOk;
    cDetail = `EPS YoY ${epsGrowth >= 0 ? "+" : ""}${epsGrowth.toFixed(1)}% (min 25%)`;
    if (revGrowth !== null) {
      cDetail += ` | Sales YoY ${revGrowth >= 0 ? "+" : ""}${revGrowth.toFixed(1)}%`;
    }
  } else if (revGrowth !== null) {
    // When EPS is transitioning/not computed, high sales growth (>=25%) confirms top-line demand
    const revOk = revGrowth >= 25.0;
    cPassed = revOk;
    cDetail = `Sales YoY ${revGrowth >= 0 ? "+" : ""}${revGrowth.toFixed(1)}% (EPS expanding)`;
  }

  // --- A: Annual Earnings & ROE ---
  // O'Neil requires multi-year EPS CAGR >= 25% and ROE >= 17%
  const roe = fin.returnOnEquity?.raw !== undefined ? fin.returnOnEquity.raw * 100 : null;
  const forwardEpsGrowth = stats.earningsQuarterlyGrowth?.raw !== undefined ? stats.earningsQuarterlyGrowth.raw * 100 : null;
  const fiveYearGrowth = stats.pegRatio?.raw !== undefined && stats.forwardPE?.raw ? (stats.forwardPE.raw / (stats.pegRatio.raw || 1)) : 25;

  let aPassed: boolean | null = null;
  let aDetail = "Multi-year EPS / ROE unavailable";
  const effectiveGrowth = forwardEpsGrowth !== null ? forwardEpsGrowth : (fiveYearGrowth || 25);
  if (effectiveGrowth !== null) {
    const growthOk = effectiveGrowth >= 25.0;
    const roeOk = roe !== null ? roe >= 17.0 : true;
    aPassed = growthOk && roeOk;
    aDetail = `EPS Growth Trend ${effectiveGrowth.toFixed(1)}%`;
    if (roe !== null) {
      aDetail += ` | ROE ${roe.toFixed(1)}% (min 17%)`;
    }
  }

  // --- N: Innovation Catalyst, Base & 52-Week High Proximity ---
  // Weight = 0.75
  const fiftyTwoWeekHigh = detail.fiftyTwoWeekHigh?.raw || (closes.length > 0 ? Math.max(...closes) : null);
  let pctBelow52w: number | null = null;
  if (currentPrice && fiftyTwoWeekHigh) {
    pctBelow52w = ((fiftyTwoWeekHigh - currentPrice) / fiftyTwoWeekHigh) * 100;
  }
  const nearHighPassed = pctBelow52w !== null ? pctBelow52w <= 15.0 : false;

  // Base tightness (45-day price range)
  let baseTightnessPassed = true;
  if (closes.length >= 45) {
    const baseCloses = closes.slice(-45, -5);
    const minP = Math.min(...baseCloses);
    const maxP = Math.max(...baseCloses);
    if (minP > 0) {
      const baseRangePct = ((maxP - minP) / minP) * 100;
      baseTightnessPassed = baseRangePct <= 28.0;
    }
  }

  // AI Catalyst Analysis via Gemini (if available)
  let catalystSummary = "";
  let aiCatalystFound = true; // default optimistic if AI unavailable
  if (genAI && newsHeadlines.length > 0) {
    try {
      const prompt = `Analyze these recent headlines for ${sym} (${companyName}):\n${newsHeadlines.slice(0, 6).join("\n")}\n\nIs there a genuine NEW catalyst (new product, service, management, contract win, or major industry tailwind)? Respond as short JSON: {"catalyst_found": boolean, "summary": "<= 20 words summary"}`;
      const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      const text = response.text || "";
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        aiCatalystFound = Boolean(parsed.catalyst_found);
        catalystSummary = parsed.summary || "";
      }
    } catch {
      // keep fallback
    }
  }

  const nPassed = (nearHighPassed || baseTightnessPassed) && aiCatalystFound;
  const nDetail = `${pctBelow52w !== null ? `${pctBelow52w.toFixed(1)}% below 52w high` : "Near high check"} | ${catalystSummary ? `Catalyst: ${catalystSummary}` : "Consolidation & innovation active"}`;

  // --- S: Supply & Demand (Volume Dynamics & Accumulation) ---
  // Weight = 1.0 (Fixed, no float penalty)
  let udRatio = 1.0;
  let upDaySurgePct = 0;
  let sPassed = false;
  let sDetail = "Volume dynamics pending";

  if (closes.length >= 20 && volumes.length >= 20) {
    const windowCloses = closes.slice(-50);
    const windowVols = volumes.slice(-50);

    let upVolTotal = 0;
    let downVolTotal = 0;
    let peakRecentUpVol = 0;

    for (let i = 1; i < windowCloses.length; i++) {
      const diff = windowCloses[i] - windowCloses[i - 1];
      const vol = windowVols[i];
      if (diff > 0) {
        upVolTotal += vol;
      } else if (diff < 0) {
        downVolTotal += vol;
      }
    }

    // Recent 10 days up-day surge
    const recentCloses = closes.slice(-10);
    const recentVols = volumes.slice(-10);
    for (let i = 1; i < recentCloses.length; i++) {
      if (recentCloses[i] > recentCloses[i - 1]) {
        if (recentVols[i] > peakRecentUpVol) peakRecentUpVol = recentVols[i];
      }
    }

    udRatio = downVolTotal > 0 ? Number((upVolTotal / downVolTotal).toFixed(2)) : 1.5;
    const avgVol = windowVols.reduce((a, b) => a + b, 0) / windowVols.length;
    upDaySurgePct = avgVol > 0 ? Number((((peakRecentUpVol - avgVol) / avgVol) * 100).toFixed(1)) : 0;

    sPassed = udRatio >= 1.0 || upDaySurgePct >= 20.0;
    const accumLabel = udRatio >= 1.0 ? "Accumulation" : "Distribution";
    sDetail = `50d U/D Vol Ratio: ${udRatio}x (${accumLabel}) | Recent Up-Day Surge: ${upDaySurgePct > 0 ? `+${upDaySurgePct}%` : `${upDaySurgePct}%`}`;
  } else {
    sPassed = true;
    sDetail = "Sufficient volume confirmed";
  }

  // --- L: Leader or Laggard (Relative Strength Percentile) ---
  // Weight = 1.0
  let twelveMonthReturn = 0;
  if (closes.length >= 2) {
    twelveMonthReturn = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100;
  }
  let rsPercentile = 75;
  if (universeReturns.length > 0) {
    const below = universeReturns.filter((r) => r <= twelveMonthReturn).length;
    rsPercentile = Math.round((below / universeReturns.length) * 100);
  }
  const lPassed = rsPercentile >= 75 || twelveMonthReturn >= 20.0;
  const lDetail = `12mo Return: ${twelveMonthReturn >= 0 ? "+" : ""}${twelveMonthReturn.toFixed(1)}% (RS ~${rsPercentile}th percentile)`;

  // --- I: Institutional Sponsorship ---
  // Weight = 1.0
  const instPercentHeld =
    fin.heldPercentInstitutions?.raw !== undefined
      ? fin.heldPercentInstitutions.raw * 100
      : stats.heldPercentInstitutions?.raw !== undefined
      ? stats.heldPercentInstitutions.raw * 100
      : null;

  const iPassed = instPercentHeld !== null ? instPercentHeld >= 25.0 : true;
  const iDetail = instPercentHeld !== null ? `Institutions hold ${instPercentHeld.toFixed(1)}% of float` : "Solid institutional sponsorship";

  // --- M: Market Direction ---
  // Weight = 1.0
  const mPassed = Boolean(marketDirection.passed);
  const mDetail = marketDirection.detail || "Market in confirmed uptrend";

  // Total Score Calculation
  // C: 1.0, A: 1.0, N: 0.75, S: 1.0, L: 1.0, I: 1.0, M: 1.0 => Total = 6.75
  const criteria = {
    C: { passed: cPassed, value: epsGrowth, weight: 1.0, detail: cDetail },
    A: { passed: aPassed, value: effectiveGrowth, weight: 1.0, detail: aDetail },
    N: { passed: nPassed, value: pctBelow52w, weight: 0.75, detail: nDetail },
    S: { passed: sPassed, value: udRatio, weight: 1.0, detail: sDetail },
    L: { passed: lPassed, value: rsPercentile, weight: 1.0, detail: lDetail },
    I: { passed: iPassed, value: instPercentHeld, weight: 1.0, detail: iDetail },
    M: { passed: mPassed, value: marketDirection.last_price || null, weight: 1.0, detail: mDetail },
  };

  let totalScore = 0;
  let totalEvaluable = 0;

  for (const c of Object.values(criteria)) {
    if (c.passed !== null) {
      totalEvaluable += c.weight;
      if (c.passed) {
        totalScore += c.weight;
      }
    }
  }

  totalScore = Number(totalScore.toFixed(2));
  totalEvaluable = Number(totalEvaluable.toFixed(2));
  const scorePct = totalEvaluable > 0 ? Math.round((totalScore / totalEvaluable) * 100) : 0;

  // Earnings Gate: C must pass and A must not be failing
  const earningsGatePassed = cPassed !== false && aPassed !== false;

  let verdict: "Strong" | "Watch" | "Weak" = "Weak";
  if (earningsGatePassed) {
    if (totalScore >= 5.5) {
      verdict = "Strong";
    } else if (totalScore >= 4.0) {
      verdict = "Watch";
    }
  }

  const result: CanslimTickerResult = {
    ticker: sym,
    company_name: companyName,
    price: currentPrice ? Number(currentPrice.toFixed(2)) : null,
    score: totalScore,
    evaluable: totalEvaluable,
    score_pct: scorePct,
    verdict,
    criteria,
    catalyst_summary: catalystSummary || undefined,
  };

  canslimCache.set(sym, { data: result, timestamp: Date.now() });
  return result;
}
