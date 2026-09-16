import {
  NasdaqConstituent,
  RebalanceEvent,
  RebalanceTrade,
  SimulationEquityPoint,
  SimulationMetrics,
  NasdaqSimulationResult,
} from "../src/types";

// Standard top 50 Nasdaq-100 companies with benchmark market cap and sector data
export interface NasdaqCompanyMetadata {
  ticker: string;
  name: string;
  marketCapBillions: number;
  sector: string;
}

export const NASDAQ_TOP_COMPANIES: NasdaqCompanyMetadata[] = [
  { ticker: "NVDA", name: "NVIDIA Corporation", marketCapBillions: 3150, sector: "Semiconductors" },
  { ticker: "AAPL", name: "Apple Inc.", marketCapBillions: 3400, sector: "Consumer Electronics" },
  { ticker: "MSFT", name: "Microsoft Corporation", marketCapBillions: 3100, sector: "Software - Infrastructure" },
  { ticker: "AMZN", name: "Amazon.com Inc.", marketCapBillions: 2100, sector: "Internet Retail" },
  { ticker: "GOOGL", name: "Alphabet Inc. (Class A)", marketCapBillions: 2050, sector: "Internet Content & Information" },
  { ticker: "META", name: "Meta Platforms Inc.", marketCapBillions: 1450, sector: "Internet Content & Information" },
  { ticker: "TSLA", name: "Tesla Inc.", marketCapBillions: 780, sector: "Auto Manufacturers" },
  { ticker: "AVGO", name: "Broadcom Inc.", marketCapBillions: 800, sector: "Semiconductors" },
  { ticker: "COST", name: "Costco Wholesale Corp.", marketCapBillions: 390, sector: "Discount Stores" },
  { ticker: "ASML", name: "ASML Holding N.V.", marketCapBillions: 330, sector: "Semiconductor Equipment" },
  { ticker: "NFLX", name: "Netflix Inc.", marketCapBillions: 300, sector: "Entertainment" },
  { ticker: "AMD", name: "Advanced Micro Devices", marketCapBillions: 235, sector: "Semiconductors" },
  { ticker: "LIN", name: "Linde plc", marketCapBillions: 220, sector: "Specialty Chemicals" },
  { ticker: "QCOM", name: "QUALCOMM Inc.", marketCapBillions: 195, sector: "Semiconductors" },
  { ticker: "TMUS", name: "T-Mobile US Inc.", marketCapBillions: 225, sector: "Telecom Services" },
  { ticker: "TXN", name: "Texas Instruments Inc.", marketCapBillions: 185, sector: "Semiconductors" },
  { ticker: "AMAT", name: "Applied Materials Inc.", marketCapBillions: 175, sector: "Semiconductor Equipment" },
  { ticker: "INTU", name: "Intuit Inc.", marketCapBillions: 180, sector: "Software - Application" },
  { ticker: "BKNG", name: "Booking Holdings Inc.", marketCapBillions: 155, sector: "Travel Services" },
  { ticker: "ISRG", name: "Intuitive Surgical Inc.", marketCapBillions: 165, sector: "Medical Instruments" },
  { ticker: "HON", name: "Honeywell International", marketCapBillions: 135, sector: "Conglomerates" },
  { ticker: "VRTX", name: "Vertex Pharmaceuticals", marketCapBillions: 120, sector: "Biotechnology" },
  { ticker: "LRCX", name: "Lam Research Corp.", marketCapBillions: 120, sector: "Semiconductor Equipment" },
  { ticker: "PANW", name: "Palo Alto Networks", marketCapBillions: 115, sector: "Software - Infrastructure" },
  { ticker: "ADP", name: "Automatic Data Processing", marketCapBillions: 115, sector: "Staffing & Employment" },
  { ticker: "GILD", name: "Gilead Sciences Inc.", marketCapBillions: 110, sector: "Drug Manufacturers" },
  { ticker: "SBUX", name: "Starbucks Corporation", marketCapBillions: 110, sector: "Restaurants" },
  { ticker: "REGN", name: "Regeneron Pharmaceuticals", marketCapBillions: 110, sector: "Biotechnology" },
  { ticker: "MDLZ", name: "Mondelez International", marketCapBillions: 95, sector: "Confectioners" },
  { ticker: "ADI", name: "Analog Devices Inc.", marketCapBillions: 110, sector: "Semiconductors" },
  { ticker: "KLAC", name: "KLA Corporation", marketCapBillions: 95, sector: "Semiconductor Equipment" },
  { ticker: "SNPS", name: "Synopsys Inc.", marketCapBillions: 85, sector: "Software - Infrastructure" },
  { ticker: "CDNS", name: "Cadence Design Systems", marketCapBillions: 82, sector: "Software - Application" },
  { ticker: "CSX", name: "CSX Corporation", marketCapBillions: 70, sector: "Railroads" },
  { ticker: "MELI", name: "MercadoLibre Inc.", marketCapBillions: 95, sector: "Internet Retail" },
  { ticker: "CRWD", name: "CrowdStrike Holdings", marketCapBillions: 85, sector: "Software - Infrastructure" },
  { ticker: "MAR", name: "Marriott International", marketCapBillions: 75, sector: "Lodging" },
  { ticker: "CTAS", name: "Cintas Corporation", marketCapBillions: 75, sector: "Specialty Business Services" },
  { ticker: "PYPL", name: "PayPal Holdings Inc.", marketCapBillions: 70, sector: "Credit Services" },
  { ticker: "ORLY", name: "O'Reilly Automotive", marketCapBillions: 65, sector: "Auto Parts" },
  { ticker: "ABNB", name: "Airbnb Inc.", marketCapBillions: 80, sector: "Travel Services" },
  { ticker: "DASH", name: "DoorDash Inc.", marketCapBillions: 60, sector: "Internet Retail" },
  { ticker: "FTNT", name: "Fortinet Inc.", marketCapBillions: 65, sector: "Software - Infrastructure" },
  { ticker: "CEG", name: "Constellation Energy", marketCapBillions: 60, sector: "Utilities - Regulated" },
  { ticker: "NXPI", name: "NXP Semiconductors", marketCapBillions: 60, sector: "Semiconductors" },
  { ticker: "PCAR", name: "PACCAR Inc.", marketCapBillions: 50, sector: "Farm & Heavy Construction" },
  { ticker: "CCEP", name: "Coca-Cola Europacific", marketCapBillions: 42, sector: "Beverages - Non-Alcoholic" },
  { ticker: "ROST", name: "Ross Stores Inc.", marketCapBillions: 50, sector: "Apparel Retail" },
  { ticker: "MCHP", name: "Microchip Technology", marketCapBillions: 45, sector: "Semiconductors" },
  { ticker: "ODFL", name: "Old Dominion Freight Line", marketCapBillions: 40, sector: "Trucking" },
];

// In-memory price cache for historical daily series: ticker:years -> { dates: string[], closes: number[], expiresAt: number }
interface CachedHistory {
  dates: string[];
  closes: number[];
  expiresAt: number;
}

const priceHistoryCache = new Map<string, CachedHistory>();

// Default HTTP Headers mimicking modern browser for Yahoo Finance API
const YAHOO_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json",
};

/**
 * Fetch daily close series for a given ticker over a given number of years.
 * Uses cached data when available (24 hr TTL).
 */
export async function getDailyPrices(ticker: string, years: number): Promise<{ dates: string[]; closes: number[] } | null> {
  const sym = ticker.toUpperCase().trim();
  const rangeStr = `${Math.max(1, Math.min(10, Math.round(years)))}y`;
  const cacheKey = `${sym}:${rangeStr}`;
  const cached = priceHistoryCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return { dates: cached.dates, closes: cached.closes };
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${rangeStr}&interval=1d`;
    const res = await fetch(url, { headers: YAHOO_HEADERS });
    if (!res.ok) {
      console.warn(`[NasdaqSimulator] Failed to fetch prices for ${sym}: HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result || !result.timestamp || !result.indicators?.quote?.[0]?.close) {
      return null;
    }

    const timestamps: number[] = result.timestamp;
    const rawCloses: (number | null)[] = result.indicators.quote[0].close;

    const dates: string[] = [];
    const closes: number[] = [];

    let lastValidClose = 0;
    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      const close = rawCloses[i];
      if (close !== null && close !== undefined && !isNaN(close) && close > 0) {
        lastValidClose = close;
      } else if (lastValidClose === 0) {
        continue;
      }

      const d = new Date(ts * 1000);
      const dateStr = d.toISOString().split("T")[0];
      dates.push(dateStr);
      closes.push(Number(lastValidClose.toFixed(2)));
    }

    if (dates.length === 0) return null;

    const data: CachedHistory = {
      dates,
      closes,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };
    priceHistoryCache.set(cacheKey, data);
    return { dates, closes };
  } catch (err: any) {
    console.error(`[NasdaqSimulator] Exception fetching ${sym}:`, err?.message);
    return null;
  }
}

/**
 * Executes a full market-cap weighted reallocation simulation.
 */
export async function runNasdaqMarketCapSimulation(params: {
  initialAmount: number;
  topN: number;
  rebalanceMonths: number;
  years: number;
  rebalanceMode?: "target-reset" | "nasdaq-capped";
}): Promise<NasdaqSimulationResult> {
  const initialAmount = Math.max(1000, Number(params.initialAmount) || 100000);
  const topN = Math.max(3, Math.min(50, Number(params.topN) || 10));
  const rebalanceMonths = Math.max(1, Math.min(24, Number(params.rebalanceMonths) || 3));
  const years = Math.max(1, Math.min(10, Number(params.years) || 3));
  const rebalanceMode = params.rebalanceMode === "nasdaq-capped" ? "nasdaq-capped" : "target-reset";

  // 1. Select top N companies from the ranked universe
  const selectedUniverse = NASDAQ_TOP_COMPANIES.slice(0, topN);
  const tickers = selectedUniverse.map((c) => c.ticker);

  // 2. Fetch historical prices for all constituents + QQQ + SPY
  const fetchTasks = [
    ...tickers.map((t) => getDailyPrices(t, years)),
    getDailyPrices("QQQ", years),
    getDailyPrices("SPY", years),
  ];
  const results = await Promise.all(fetchTasks);

  const priceMap: Map<string, Map<string, number>> = new Map();
  const activeTickers: string[] = [];

  for (let i = 0; i < tickers.length; i++) {
    const sym = tickers[i];
    const data = results[i];
    if (data && data.dates.length > 50) {
      activeTickers.push(sym);
      const datePrice = new Map<string, number>();
      for (let j = 0; j < data.dates.length; j++) {
        datePrice.set(data.dates[j], data.closes[j]);
      }
      priceMap.set(sym, datePrice);
    }
  }

  const qqqData = results[tickers.length];
  const spyData = results[tickers.length + 1];

  const qqqPriceMap = new Map<string, number>();
  if (qqqData) {
    for (let j = 0; j < qqqData.dates.length; j++) {
      qqqPriceMap.set(qqqData.dates[j], qqqData.closes[j]);
    }
  }

  const spyPriceMap = new Map<string, number>();
  if (spyData) {
    for (let j = 0; j < spyData.dates.length; j++) {
      spyPriceMap.set(spyData.dates[j], spyData.closes[j]);
    }
  }

  // 3. Find common trading dates across all active constituents and benchmarks
  const referenceDates = qqqData ? qqqData.dates : (results.find((r) => r && r.dates.length > 0)?.dates || []);
  const commonTradingDates: string[] = [];

  for (const date of referenceDates) {
    let allHave = true;
    for (const t of activeTickers) {
      if (!priceMap.get(t)?.has(date)) {
        allHave = false;
        break;
      }
    }
    if (allHave && qqqPriceMap.has(date) && spyPriceMap.has(date)) {
      commonTradingDates.push(date);
    }
  }

  if (commonTradingDates.length < 20) {
    throw new Error("Insufficient common trading price history for the selected Nasdaq companies.");
  }

  const startDate = commonTradingDates[0];
  const endDate = commonTradingDates[commonTradingDates.length - 1];

  // 4. Initial Portfolio Setup (t = 0)
  // Baseline market caps of active tickers
  const activeCompanyMeta = selectedUniverse.filter((c) => activeTickers.includes(c.ticker));
  const totalInitialMarketCap = activeCompanyMeta.reduce((sum, c) => sum + c.marketCapBillions, 0);

  // Baseline target market-cap weights (proportionate to capitalization)
  const initialWeightsPct: Record<string, number> = {};
  const targetWeightsDecimal: Record<string, number> = {};
  let currentPortfolioValue = initialAmount;
  let sharesHeld: Record<string, number> = {};
  const buyAndHoldShares: Record<string, number> = {};

  for (const c of activeCompanyMeta) {
    const rawWeight = c.marketCapBillions / totalInitialMarketCap;
    targetWeightsDecimal[c.ticker] = rawWeight;
    initialWeightsPct[c.ticker] = Number((rawWeight * 100).toFixed(2));
    const targetDollars = initialAmount * rawWeight;
    const startPrice = priceMap.get(c.ticker)!.get(startDate)!;
    const shares = targetDollars / startPrice;
    sharesHeld[c.ticker] = shares;
    buyAndHoldShares[c.ticker] = shares;
  }

  // Benchmark initial shares
  const qqqStartPrice = qqqPriceMap.get(startDate) || 1;
  const spyStartPrice = spyPriceMap.get(startDate) || 1;
  const qqqShares = initialAmount / qqqStartPrice;
  const spyShares = initialAmount / spyStartPrice;

  // Track simulation series
  const equityCurve: SimulationEquityPoint[] = [];
  const rebalanceEvents: RebalanceEvent[] = [];

  let peakValue = initialAmount;
  let maxDrawdownPct = 0;

  // Rebalance schedule: determine rebalance dates every M months
  // Trading days approx ~ 21 days per month
  const rebalanceIntervalTradingDays = Math.round(rebalanceMonths * 21);
  let nextRebalanceIndex = rebalanceIntervalTradingDays;
  let periodIndex = 1;

  for (let dayIdx = 0; dayIdx < commonTradingDates.length; dayIdx++) {
    const currentDate = commonTradingDates[dayIdx];

    // Compute portfolio value at day's close
    let dailyVal = 0;
    let bhVal = 0;
    for (const t of activeTickers) {
      const price = priceMap.get(t)!.get(currentDate)!;
      dailyVal += sharesHeld[t] * price;
      bhVal += buyAndHoldShares[t] * price;
    }
    currentPortfolioValue = dailyVal;

    // Track peak & drawdown
    if (currentPortfolioValue > peakValue) {
      peakValue = currentPortfolioValue;
    }
    const currentDrawdownPct = peakValue > 0 ? ((currentPortfolioValue - peakValue) / peakValue) * 100 : 0;
    if (currentDrawdownPct < maxDrawdownPct) {
      maxDrawdownPct = currentDrawdownPct;
    }

    // Benchmark values
    const qqqVal = (qqqPriceMap.get(currentDate) || 0) * qqqShares;
    const spyVal = (spyPriceMap.get(currentDate) || 0) * spyShares;

    const portfolioReturnPct = ((currentPortfolioValue - initialAmount) / initialAmount) * 100;
    const qqqReturnPct = ((qqqVal - initialAmount) / initialAmount) * 100;
    const spyReturnPct = ((spyVal - initialAmount) / initialAmount) * 100;

    equityCurve.push({
      date: currentDate,
      portfolioValue: Number(currentPortfolioValue.toFixed(2)),
      buyAndHoldValue: Number(bhVal.toFixed(2)),
      qqqValue: Number(qqqVal.toFixed(2)),
      spyValue: Number(spyVal.toFixed(2)),
      portfolioReturnPct: Number(portfolioReturnPct.toFixed(2)),
      qqqReturnPct: Number(qqqReturnPct.toFixed(2)),
      spyReturnPct: Number(spyReturnPct.toFixed(2)),
      drawdownPct: Number(currentDrawdownPct.toFixed(2)),
    });

    // Check if rebalance triggers on this day (or if it's not the final day)
    const isRebalanceDay = dayIdx === nextRebalanceIndex && dayIdx < commonTradingDates.length - 5;
    if (isRebalanceDay) {
      const rebalTargetWeights: Record<string, number> = {};

      if (rebalanceMode === "nasdaq-capped") {
        // Dynamic drifted caps with 14% max single stock cap
        let driftedTotal = 0;
        const driftedCaps: Record<string, number> = {};
        for (const t of activeTickers) {
          const startP = priceMap.get(t)!.get(startDate)!;
          const currP = priceMap.get(t)!.get(currentDate)!;
          const baseCap = activeCompanyMeta.find((c) => c.ticker === t)?.marketCapBillions || 100;
          const currentCap = baseCap * (currP / startP);
          driftedCaps[t] = currentCap;
          driftedTotal += currentCap;
        }

        const rawWeights: Record<string, number> = {};
        for (const t of activeTickers) {
          rawWeights[t] = driftedCaps[t] / driftedTotal;
        }

        const maxCap = 0.14;
        let excessWeight = 0;
        let uncappedTotal = 0;
        for (const t of activeTickers) {
          if (rawWeights[t] > maxCap) {
            excessWeight += rawWeights[t] - maxCap;
            rebalTargetWeights[t] = maxCap;
          } else {
            uncappedTotal += rawWeights[t];
          }
        }
        for (const t of activeTickers) {
          if (rawWeights[t] <= maxCap) {
            rebalTargetWeights[t] = rawWeights[t] + (uncappedTotal > 0 ? excessWeight * (rawWeights[t] / uncappedTotal) : 0);
          }
        }
      } else {
        // Target Market-Cap Rebalancing (Systematic Target Reset):
        // Reallocates back to target market-cap proportions.
        // Trims stocks that grew above target weight; buys stocks that lagged.
        for (const t of activeTickers) {
          rebalTargetWeights[t] = targetWeightsDecimal[t];
        }
      }

      // Rebalance shares to match new target weights
      const trades: RebalanceTrade[] = [];
      let periodTurnover = 0;
      const newSharesHeld: Record<string, number> = {};

      for (const t of activeTickers) {
        const targetWeight = rebalTargetWeights[t];
        const targetDollars = currentPortfolioValue * targetWeight;
        const currentPrice = priceMap.get(t)!.get(currentDate)!;
        const targetShares = targetDollars / currentPrice;

        const prevShares = sharesHeld[t];
        const shareDiff = targetShares - prevShares;
        const tradeDollar = Math.abs(shareDiff * currentPrice);

        periodTurnover += tradeDollar / 2;

        let action: "BUY" | "SELL" | "HOLD" = "HOLD";
        if (shareDiff > 0.001) action = "BUY";
        else if (shareDiff < -0.001) action = "SELL";

        trades.push({
          ticker: t,
          action,
          previousShares: Number(prevShares.toFixed(3)),
          newShares: Number(targetShares.toFixed(3)),
          price: Number(currentPrice.toFixed(2)),
          tradeAmount: Number(tradeDollar.toFixed(2)),
          newWeightPct: Number((targetWeight * 100).toFixed(2)),
        });

        newSharesHeld[t] = targetShares;
      }

      sharesHeld = newSharesHeld;

      rebalanceEvents.push({
        date: currentDate,
        periodIndex: periodIndex++,
        portfolioValue: Number(currentPortfolioValue.toFixed(2)),
        turnoverAmount: Number(periodTurnover.toFixed(2)),
        turnoverPct: Number(((periodTurnover / currentPortfolioValue) * 100).toFixed(2)),
        trades,
      });

      nextRebalanceIndex += rebalanceIntervalTradingDays;
    }
  }

  // 5. Final Constituents Breakdown
  const constituents: NasdaqConstituent[] = [];
  const finalTotalValue = currentPortfolioValue;

  for (const c of activeCompanyMeta) {
    const t = c.ticker;
    const startPrice = priceMap.get(t)!.get(startDate)!;
    const endPrice = priceMap.get(t)!.get(endDate)!;
    const returnPct = ((endPrice - startPrice) / startPrice) * 100;
    const endValue = sharesHeld[t] * endPrice;
    const endingWeightPct = (endValue / finalTotalValue) * 100;
    const initialAllocation = initialAmount * (initialWeightsPct[t] / 100);
    const dollarContribution = endValue - initialAllocation;

    const latestCap = c.marketCapBillions * (endPrice / startPrice);

    constituents.push({
      ticker: t,
      name: c.name,
      marketCap: Number(latestCap.toFixed(1)),
      sector: c.sector,
      initialWeightPct: initialWeightsPct[t] || 0,
      endingWeightPct: Number(endingWeightPct.toFixed(2)),
      startPrice: Number(startPrice.toFixed(2)),
      endPrice: Number(endPrice.toFixed(2)),
      returnPct: Number(returnPct.toFixed(2)),
      dollarContribution: Number(dollarContribution.toFixed(2)),
    });
  }

  // Sort constituents by ending weight descending
  constituents.sort((a, b) => b.endingWeightPct - a.endingWeightPct);

  // 6. Performance & Statistical Metrics Calculation
  const totalGain = currentPortfolioValue - initialAmount;
  const totalReturnPct = (totalGain / initialAmount) * 100;
  const actualYears = Math.max(0.2, commonTradingDates.length / 252);
  const cagrPct = (Math.pow(currentPortfolioValue / initialAmount, 1 / actualYears) - 1) * 100;

  // Buy & Hold benchmark calculation
  const bhEndVal = Object.entries(buyAndHoldShares).reduce((sum, [t, s]) => {
    return sum + s * (priceMap.get(t)?.get(endDate) || 0);
  }, 0);
  const bhTotalReturnPct = ((bhEndVal - initialAmount) / initialAmount) * 100;
  const bhCagrPct = (Math.pow(bhEndVal / initialAmount, 1 / actualYears) - 1) * 100;

  // Daily returns for Sharpe and Volatility
  const dailyReturns: number[] = [];
  const qqqDailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1].portfolioValue;
    const curr = equityCurve[i].portfolioValue;
    if (prev > 0) dailyReturns.push((curr - prev) / prev);

    const qqqPrev = equityCurve[i - 1].qqqValue;
    const qqqCurr = equityCurve[i].qqqValue;
    if (qqqPrev > 0) qqqDailyReturns.push((qqqCurr - qqqPrev) / qqqPrev);
  }

  // Standard deviation of daily returns
  const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / (dailyReturns.length || 1);
  const variance =
    dailyReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / Math.max(1, dailyReturns.length - 1);
  const dailyVol = Math.sqrt(variance);
  const annualizedVolatilityPct = dailyVol * Math.sqrt(252) * 100;

  // Risk free rate assumption: 4.0%
  const riskFreeRatePct = 4.0;
  const excessReturn = cagrPct - riskFreeRatePct;
  const sharpeRatio = annualizedVolatilityPct > 0 ? Number((excessReturn / annualizedVolatilityPct).toFixed(2)) : 0;

  // Downside deviation for Sortino
  const downsideReturns = dailyReturns.filter((r) => r < 0);
  const downsideVariance =
    downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / Math.max(1, dailyReturns.length);
  const downsideVol = Math.sqrt(downsideVariance) * Math.sqrt(252) * 100;
  const sortinoRatio = downsideVol > 0 ? Number((excessReturn / downsideVol).toFixed(2)) : 0;

  // Benchmark metrics
  const qqqFinalVal = (qqqPriceMap.get(endDate) || 0) * qqqShares;
  const qqqTotalReturnPct = ((qqqFinalVal - initialAmount) / initialAmount) * 100;
  const qqqCagrPct = (Math.pow(qqqFinalVal / initialAmount, 1 / actualYears) - 1) * 100;

  const spyFinalVal = (spyPriceMap.get(endDate) || 0) * spyShares;
  const spyTotalReturnPct = ((spyFinalVal - initialAmount) / initialAmount) * 100;
  const spyCagrPct = (Math.pow(spyFinalVal / initialAmount, 1 / actualYears) - 1) * 100;

  // Beta against QQQ
  const qqqMean = qqqDailyReturns.reduce((a, b) => a + b, 0) / (qqqDailyReturns.length || 1);
  let covar = 0;
  let qqqVar = 0;
  for (let i = 0; i < Math.min(dailyReturns.length, qqqDailyReturns.length); i++) {
    covar += (dailyReturns[i] - meanReturn) * (qqqDailyReturns[i] - qqqMean);
    qqqVar += Math.pow(qqqDailyReturns[i] - qqqMean, 2);
  }
  const beta = qqqVar > 0 ? Number((covar / qqqVar).toFixed(2)) : 1.0;
  const alphaPct = Number((cagrPct - (riskFreeRatePct + beta * (qqqCagrPct - riskFreeRatePct))).toFixed(2));

  const cumulativeTurnover = rebalanceEvents.reduce((sum, e) => sum + e.turnoverAmount, 0);

  const metrics: SimulationMetrics = {
    initialAmount,
    endingValue: Number(currentPortfolioValue.toFixed(2)),
    totalGain: Number(totalGain.toFixed(2)),
    totalReturnPct: Number(totalReturnPct.toFixed(2)),
    cagrPct: Number(cagrPct.toFixed(2)),
    annualizedVolatilityPct: Number(annualizedVolatilityPct.toFixed(2)),
    sharpeRatio,
    sortinoRatio,
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
    buyAndHoldEndingValue: Number(bhEndVal.toFixed(2)),
    buyAndHoldTotalReturnPct: Number(bhTotalReturnPct.toFixed(2)),
    buyAndHoldCagrPct: Number(bhCagrPct.toFixed(2)),
    qqqEndingValue: Number(qqqFinalVal.toFixed(2)),
    qqqTotalReturnPct: Number(qqqTotalReturnPct.toFixed(2)),
    qqqCagrPct: Number(qqqCagrPct.toFixed(2)),
    spyEndingValue: Number(spyFinalVal.toFixed(2)),
    spyTotalReturnPct: Number(spyTotalReturnPct.toFixed(2)),
    spyCagrPct: Number(spyCagrPct.toFixed(2)),
    alphaPct,
    beta,
    totalRebalances: rebalanceEvents.length,
    cumulativeTurnover: Number(cumulativeTurnover.toFixed(2)),
  };

  // 7. Generate Standalone Python Script
  const pythonScript = generateStandalonePythonScript({
    initialAmount,
    topN,
    rebalanceMonths,
    years,
    rebalanceMode,
    tickers: activeTickers,
  });

  return {
    params: {
      initialAmount,
      topN,
      rebalanceMonths,
      years,
      rebalanceMode,
      startDate,
      endDate,
    },
    metrics,
    constituents,
    rebalanceEvents,
    equityCurve,
    pythonScript,
  };
}

/**
 * Generates an executable standalone Python script with yfinance
 */
export function generateStandalonePythonScript(params: {
  initialAmount: number;
  topN: number;
  rebalanceMonths: number;
  years: number;
  rebalanceMode?: "target-reset" | "nasdaq-capped";
  tickers: string[];
}): string {
  const { initialAmount, topN, rebalanceMonths, years, tickers, rebalanceMode = "target-reset" } = params;

  return `#!/usr/bin/env python3
"""
Nasdaq Market-Cap Weighted Periodic Rebalancing Simulator
=========================================================
Simulates an investment of $${initialAmount.toLocaleString()} proportionately weighted
by market capitalization across the top ${topN} Nasdaq companies,
reallocated every ${rebalanceMonths} month(s) over the last ${years} year(s).

Requirements:
    pip install yfinance pandas numpy matplotlib

Usage:
    python nasdaq_simulator.py
"""

import datetime
import numpy as np
import pandas as pd
import yfinance as yf
import matplotlib.pyplot as plt

# ================= Configuration =================
INITIAL_CAPITAL = ${initialAmount}
TOP_N = ${topN}
REBALANCE_MONTHS = ${rebalanceMonths}
YEARS = ${years}

# Top Nasdaq tickers selected by market capitalization
CONSTITUENTS = ${JSON.stringify(tickers, null, 2)}
BENCHMARKS = ["QQQ", "SPY"]
ALL_TICKERS = CONSTITUENTS + BENCHMARKS

def run_simulation():
    print(f"=== Running Nasdaq Market-Cap Backtest ===")
    print(f"Initial Capital: $\{INITIAL_CAPITAL:,.2f\}")
    print(f"Top N Companies: {TOP_N}")
    print(f"Rebalance Interval: Every {REBALANCE_MONTHS} month(s)")
    print(f"Lookback Window: Last {YEARS} year(s)\\n")

    end_date = datetime.date.today()
    start_date = end_date - datetime.timedelta(days=int(YEARS * 365.25 + 30))

    print(f"Fetching historical daily price data from Yahoo Finance ({start_date} to {end_date})...")
    data = yf.download(ALL_TICKERS, start=start_date, end=end_date, interval="1d", auto_adjust=True)
    prices = data["Close"].dropna(how="all")

    # Filter tickers that have valid price history
    valid_tickers = [t for t in CONSTITUENTS if t in prices.columns and prices[t].dropna().shape[0] > 50]
    print(f"Active Constituents with valid price history ({len(valid_tickers)}): {valid_tickers}")

    # Align common dates across all active stocks and benchmarks
    aligned_prices = prices[valid_tickers + BENCHMARKS].dropna()
    trading_dates = aligned_prices.index

    # Fetch approximate market caps using yfinance fast_info
    print("Retrieving constituent market caps...")
    market_caps = {}
    for t in valid_tickers:
        try:
            ticker_obj = yf.Ticker(t)
            mc = ticker_obj.fast_info.get("market_cap", None)
            if mc is None or mc <= 0:
                mc = 100_000_000_000 # default $100B fallback
            market_caps[t] = mc
        except Exception:
            market_caps[t] = 100_000_000_000

    total_mc = sum(market_caps.values())
    initial_weights = {t: market_caps[t] / total_mc for t in valid_tickers}

    # Setup initial holdings
    start_date_actual = trading_dates[0]
    shares = {}
    for t in valid_tickers:
        allocation = INITIAL_CAPITAL * initial_weights[t]
        start_p = aligned_prices.loc[start_date_actual, t]
        shares[t] = allocation / start_p

    # Benchmark initial shares
    qqq_start = aligned_prices.loc[start_date_actual, "QQQ"]
    spy_start = aligned_prices.loc[start_date_actual, "SPY"]
    qqq_shares = INITIAL_CAPITAL / qqq_start
    spy_shares = INITIAL_CAPITAL / spy_start

    portfolio_values = []
    qqq_values = []
    spy_values = []
    rebalance_log = []

    rebalance_interval_days = int(REBALANCE_MONTHS * 21)
    next_rebal_idx = rebalance_interval_days
    current_shares = dict(shares)

    print("\\nSimulating daily portfolio path and periodic reallocations...")
    for idx, dt in enumerate(trading_dates):
        # Calculate daily portfolio value
        daily_val = sum(current_shares[t] * aligned_prices.loc[dt, t] for t in valid_tickers)
        portfolio_values.append(daily_val)

        qqq_val = qqq_shares * aligned_prices.loc[dt, "QQQ"]
        spy_val = spy_shares * aligned_prices.loc[dt, "SPY"]
        qqq_values.append(qqq_val)
        spy_values.append(spy_val)

        # Trigger rebalancing: systematic reallocation back to target market-cap weights
        if idx == next_rebal_idx and idx < len(trading_dates) - 5:
            turnover = 0
            for t in valid_tickers:
                target_weight = initial_weights[t]
                target_dollars = daily_val * target_weight
                curr_price = aligned_prices.loc[dt, t]
                new_share_count = target_dollars / curr_price
                trade_dollars = abs(new_share_count - current_shares[t]) * curr_price
                turnover += trade_dollars / 2
                current_shares[t] = new_share_count

            rebalance_log.append({
                "Date": dt.strftime("%Y-%m-%d"),
                "Portfolio_Value": daily_val,
                "Turnover_Dollars": turnover,
            })
            next_rebal_idx += rebalance_interval_days

    # Results Analysis
    end_val = portfolio_values[-1]
    total_gain = end_val - INITIAL_CAPITAL
    total_return_pct = (total_gain / INITIAL_CAPITAL) * 100
    num_years = len(trading_dates) / 252.0
    cagr = ((end_val / INITIAL_CAPITAL) ** (1.0 / num_years) - 1.0) * 100

    qqq_end = qqq_values[-1]
    qqq_return_pct = ((qqq_end - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100
    qqq_cagr = ((qqq_end / INITIAL_CAPITAL) ** (1.0 / num_years) - 1.0) * 100

    spy_end = spy_values[-1]
    spy_return_pct = ((spy_end - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100
    spy_cagr = ((spy_end / INITIAL_CAPITAL) ** (1.0 / num_years) - 1.0) * 100

    # Max Drawdown
    peak = np.maximum.accumulate(portfolio_values)
    drawdowns = (np.array(portfolio_values) - peak) / peak
    max_dd_pct = np.min(drawdowns) * 100

    # Sharpe
    daily_rets = pd.Series(portfolio_values).pct_change().dropna()
    ann_vol = daily_rets.std() * np.sqrt(252) * 100
    sharpe = (cagr - 4.0) / ann_vol if ann_vol > 0 else 0

    print("\\n" + "=" * 55)
    print("           SIMULATION PERFORMANCE SUMMARY")
    print("=" * 55)
    print(f"Strategy Ending Value:    $\{end_val:,.2f\}")
    print(f"Total Return / Net Profit: +$\{total_gain:,.2f\} ({total_return_pct:+.2f}%)")
    print(f"CAGR (Annualized Return): {cagr:.2f}%")
    print(f"Annualized Volatility:    {ann_vol:.2f}%")
    print(f"Sharpe Ratio (Rf=4%):     {sharpe:.2f}")
    print(f"Max Drawdown:             {max_dd_pct:.2f}%")
    print(f"Total Rebalances:         {len(rebalance_log)}")
    print("-" * 55)
    print(f"QQQ Benchmark Return:     {qqq_return_pct:+.2f}% (CAGR: {qqq_cagr:.2f}%) | $\{qqq_end:,.2f\}")
    print(f"SPY Benchmark Return:     {spy_return_pct:+.2f}% (CAGR: {spy_cagr:.2f}%) | $\{spy_end:,.2f\}")
    print("=" * 55)

    # Plot Equity Curves
    plt.figure(figsize=(12, 6))
    plt.plot(trading_dates, portfolio_values, label=f"Top {TOP_N} Nasdaq Market-Cap Strategy ({cagr:.1f}% CAGR)", color="#10b981", lw=2)
    plt.plot(trading_dates, qqq_values, label=f"QQQ Nasdaq-100 ETF ({qqq_cagr:.1f}% CAGR)", color="#6366f1", lw=1.5, ls="--")
    plt.plot(trading_dates, spy_values, label=f"SPY S&P 500 ETF ({spy_cagr:.1f}% CAGR)", color="#f59e0b", lw=1.5, ls=":")
    plt.title(f"Market-Cap Weighted Periodic Rebalancing Backtest ({YEARS} Years)", fontsize=14, fontweight="bold")
    plt.xlabel("Date", fontsize=11)
    plt.ylabel("Portfolio Value ($)", fontsize=11)
    plt.grid(True, alpha=0.3)
    plt.legend(loc="upper left")
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    run_simulation()
`;
}
