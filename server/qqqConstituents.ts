// Dynamic QQQ (Nasdaq-100) constituent resolution.
// Shared by the web server's /api/watchlist/qqq-bollinger endpoint and the
// standalone scripts/updateQqqBollingerWatchlist.ts CLI script, so both stay
// in sync on how the live universe is resolved each time they're called.

const STATIC_FALLBACK_CONSTITUENTS = [
  "NVDA", "AAPL", "MSFT", "AMZN", "AVGO", "GOOGL", "META", "TSLA", "MU", "AMD",
  "COST", "NFLX", "PLTR", "ADBE", "CSCO", "QCOM", "TXN", "AMAT", "INTU", "AMGN",
];

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

/** Primary source: Invesco's official public QQQ holdings CSV download (refreshed daily). */
async function fetchConstituentsFromInvesco(): Promise<string[]> {
  const url =
    "https://www.invesco.com/us/financial-products/etfs/holdings/main/holdings/0?audienceType=Investor&action=download&ticker=QQQ";
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Accept: "text/csv,*/*",
    },
  });
  if (!res.ok) throw new Error(`Invesco holdings download failed: ${res.status} ${res.statusText}`);
  const text = await res.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  const headerIdx = lines.findIndex((l) => /symbol/i.test(l) && /weight/i.test(l));
  if (headerIdx === -1) throw new Error("Invesco CSV format unrecognized (no Symbol/Weight header found).");

  const header = parseCsvLine(lines[headerIdx]).map((h) => h.toLowerCase());
  const symbolCol = header.findIndex((h) => h.includes("symbol") || h.includes("holding ticker"));
  if (symbolCol === -1) throw new Error("Invesco CSV format unrecognized (no Symbol column).");

  const symbols: string[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const raw = (cells[symbolCol] || "").toUpperCase().trim();
    if (/^[A-Z.]{1,6}$/.test(raw) && raw !== "USD") symbols.push(raw);
  }

  if (symbols.length < 50) throw new Error(`Invesco CSV parsed too few symbols (${symbols.length}); treating as failure.`);
  return Array.from(new Set(symbols));
}

/** Fallback source: Nasdaq's public Nasdaq-100 index constituents API. */
async function fetchConstituentsFromNasdaqApi(): Promise<string[]> {
  const res = await fetch("https://api.nasdaq.com/api/quote/list-type/nasdaq100", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Nasdaq-100 API failed: ${res.status} ${res.statusText}`);
  const json: any = await res.json().catch(() => null);
  const rows: any[] = json?.data?.data?.rows || [];
  const symbols = rows.map((r) => String(r.symbol).toUpperCase()).filter((s) => /^[A-Z.]{1,6}$/.test(s));
  if (symbols.length < 50) throw new Error(`Nasdaq-100 API returned too few symbols (${symbols.length}); treating as failure.`);
  return Array.from(new Set(symbols));
}

export interface LiveQqqConstituentsResult {
  symbols: string[];
  source: "invesco-holdings-csv" | "nasdaq100-api" | "static-fallback";
}

/** Resolves QQQ's CURRENT constituents live, each call, with graceful fallbacks. */
export async function fetchLiveQqqConstituents(): Promise<LiveQqqConstituentsResult> {
  try {
    const symbols = await fetchConstituentsFromInvesco();
    return { symbols, source: "invesco-holdings-csv" };
  } catch (e) {
    console.warn(`[qqq-constituents] Invesco source failed: ${(e as Error).message}`);
  }
  try {
    const symbols = await fetchConstituentsFromNasdaqApi();
    return { symbols, source: "nasdaq100-api" };
  } catch (e) {
    console.warn(`[qqq-constituents] Nasdaq-100 API fallback failed: ${(e as Error).message}`);
  }
  console.warn("[qqq-constituents] All live sources failed; using static fallback list. Results may be stale.");
  return { symbols: STATIC_FALLBACK_CONSTITUENTS, source: "static-fallback" };
}

export interface BollingerResult {
  sma: number;
  upperBand: number;
  lowerBand: number;
  percentB: number;
  bandwidthPct: number;
}

export function computeBollingerFromCloses(closes: number[], period: number, numStd: number): BollingerResult | null {
  if (closes.length < period) return null;
  const window = closes.slice(-period);
  const sma = window.reduce((a, b) => a + b, 0) / period;
  const variance = window.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
  const std = Math.sqrt(variance);
  const upperBand = sma + numStd * std;
  const lowerBand = sma - numStd * std;
  const price = closes[closes.length - 1];
  const percentB = upperBand === lowerBand ? 0.5 : (price - lowerBand) / (upperBand - lowerBand);
  const bandwidthPct = sma > 0 ? ((upperBand - lowerBand) / sma) * 100 : 0;
  return {
    sma: Number(sma.toFixed(2)),
    upperBand: Number(upperBand.toFixed(2)),
    lowerBand: Number(lowerBand.toFixed(2)),
    percentB: Number(percentB.toFixed(3)),
    bandwidthPct: Number(bandwidthPct.toFixed(2)),
  };
}

export type BollingerScanMode = "extremes" | "oversold" | "overbought" | "squeeze";

export interface ScannedSymbol {
  symbol: string;
  price: number;
  bollinger: BollingerResult;
}

export function matchesBollingerMode(s: ScannedSymbol, mode: BollingerScanMode, squeezeThresholdPct: number): boolean {
  const pb = s.bollinger.percentB;
  switch (mode) {
    case "oversold":
      return pb <= 0.05;
    case "overbought":
      return pb >= 0.95;
    case "extremes":
      return pb <= 0.05 || pb >= 0.95;
    case "squeeze":
      return s.bollinger.bandwidthPct < squeezeThresholdPct;
  }
}

export function bollingerRankKey(s: ScannedSymbol, mode: BollingerScanMode): number {
  if (mode === "oversold") return s.bollinger.percentB;
  if (mode === "overbought") return -s.bollinger.percentB;
  if (mode === "squeeze") return s.bollinger.bandwidthPct;
  return -Math.abs(s.bollinger.percentB - 0.5);
}
