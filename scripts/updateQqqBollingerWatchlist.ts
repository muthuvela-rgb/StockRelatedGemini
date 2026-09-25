/**
 * Dynamic QQQ Bollinger Band Watchlist Builder
 *
 * Each run:
 *   1. Fetches QQQ's CURRENT constituents live from Invesco's public holdings
 *      feed (falls back to the Nasdaq-100 index API, then a static list if
 *      both are unreachable) — so the universe stays current across
 *      quarterly/ad-hoc index rebalances without manual edits.
 *   2. Pulls daily history for QQQ + every constituent from Tradier and
 *      computes 20-day/2-std Bollinger %B for each.
 *   3. Filters/ranks symbols against the selected Bollinger trigger mode.
 *   4. Creates or updates a Tradier watchlist with the resulting symbols,
 *      and writes a timestamped JSON snapshot for auditing.
 *
 * Usage:
 *   tsx scripts/updateQqqBollingerWatchlist.ts [options]
 *
 * Options:
 *   --mode <extremes|oversold|overbought|squeeze>  (default: extremes)
 *   --watchlist-name <name>                        (default: QQQ-Bollinger-Dynamic)
 *   --period <n>                                   (default: 20)
 *   --stddev <n>                                   (default: 2)
 *   --squeeze-threshold <pct>                      (default: 6, i.e. band width < 6% of SMA)
 *   --limit <n>                                    (max symbols kept after ranking, default: 25)
 *   --dry-run                                      (skip the Tradier watchlist push)
 *
 * Requires TRADIER_API_TOKEN (and optionally TRADIER_BASE_URL) in the
 * environment — same variables the main server uses.
 */

import fs from "fs";
import path from "path";

// --- CLI ARGS ---
type Mode = "extremes" | "oversold" | "overbought" | "squeeze";

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (flag: string, fallback: string) => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : fallback;
  };
  return {
    mode: get("--mode", "extremes") as Mode,
    watchlistName: get("--watchlist-name", "QQQ-Bollinger-Dynamic"),
    period: Number(get("--period", "20")),
    stddev: Number(get("--stddev", "2")),
    squeezeThresholdPct: Number(get("--squeeze-threshold", "6")),
    limit: Number(get("--limit", "25")),
    dryRun: argv.includes("--dry-run"),
  };
}

// --- STATIC LAST-RESORT FALLBACK (kept intentionally small; only used if
// both live constituent sources fail) ---
const STATIC_FALLBACK_CONSTITUENTS = [
  "NVDA", "AAPL", "MSFT", "AMZN", "AVGO", "GOOGL", "META", "TSLA", "MU", "AMD",
  "COST", "NFLX", "PLTR", "ADBE", "CSCO", "QCOM", "TXN", "AMAT", "INTU", "AMGN",
];

// --- TRADIER CLIENT ---
function getTradierConfig() {
  const token = (process.env.TRADIER_API_TOKEN || process.env.TRADIER_ACCESS_TOKEN || "").trim();
  let baseUrl = (process.env.TRADIER_BASE_URL || "https://api.tradier.com/v1").trim();
  if (!baseUrl.startsWith("http")) baseUrl = `https://${baseUrl}`;
  baseUrl = baseUrl.replace(/\/+$/, "");
  if (!baseUrl.endsWith("/v1")) baseUrl = `${baseUrl}/v1`;
  return { token, baseUrl, isConfigured: Boolean(token) };
}

function tradierHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
}

async function fetchTradierDailyCloses(symbol: string, lookbackDays = 90): Promise<number[]> {
  const { token, baseUrl, isConfigured } = getTradierConfig();
  if (!isConfigured) throw new Error("TRADIER_API_TOKEN is not set in the environment.");

  const start = new Date(Date.now() - lookbackDays * 86400000).toISOString().split("T")[0];
  const url = `${baseUrl}/markets/history?symbol=${encodeURIComponent(symbol)}&interval=daily&start=${start}`;
  const res = await fetch(url, { headers: tradierHeaders(token) });
  if (!res.ok) {
    throw new Error(`Tradier history request failed for ${symbol}: ${res.status} ${res.statusText}`);
  }
  const json: any = await res.json().catch(() => null);
  const rawDays = json?.history?.day;
  if (!rawDays) return [];
  const days: any[] = Array.isArray(rawDays) ? rawDays : [rawDays];
  return days
    .map((d) => Number(d?.close))
    .filter((c) => Number.isFinite(c) && c > 0);
}

interface TradierWatchlistSummary {
  id: string;
  name: string;
  symbols: string[];
}

async function listTradierWatchlists(): Promise<TradierWatchlistSummary[]> {
  const { token, baseUrl } = getTradierConfig();
  const res = await fetch(`${baseUrl}/watchlists`, { headers: tradierHeaders(token) });
  if (!res.ok) throw new Error(`Failed to list Tradier watchlists: ${res.status} ${res.statusText}`);
  const json: any = await res.json().catch(() => null);
  const raw = json?.watchlists?.watchlist;
  if (!raw) return [];
  const list: any[] = Array.isArray(raw) ? raw : [raw];
  return list.map((w) => {
    const rawItems = w?.items?.item;
    const items: any[] = rawItems ? (Array.isArray(rawItems) ? rawItems : [rawItems]) : [];
    return {
      id: String(w.id),
      name: String(w.name),
      symbols: items.map((it) => String(it.symbol).toUpperCase()),
    };
  });
}

async function createTradierWatchlist(name: string, symbols: string[]): Promise<string> {
  const { token, baseUrl } = getTradierConfig();
  const body = new URLSearchParams({ name, symbols: symbols.join(",") });
  const res = await fetch(`${baseUrl}/watchlists`, {
    method: "POST",
    headers: { ...tradierHeaders(token), "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Failed to create Tradier watchlist "${name}": ${res.status} ${res.statusText}`);
  const json: any = await res.json().catch(() => null);
  const id = json?.watchlist?.id;
  if (!id) throw new Error(`Tradier did not return a watchlist id for "${name}".`);
  return String(id);
}

async function addTradierWatchlistSymbols(id: string, symbols: string[]): Promise<void> {
  if (symbols.length === 0) return;
  const { token, baseUrl } = getTradierConfig();
  const body = new URLSearchParams({ symbols: symbols.join(",") });
  const res = await fetch(`${baseUrl}/watchlists/${encodeURIComponent(id)}/symbols`, {
    method: "POST",
    headers: { ...tradierHeaders(token), "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Failed to add symbols to watchlist ${id}: ${res.status} ${res.statusText}`);
}

async function removeTradierWatchlistSymbol(id: string, symbol: string): Promise<void> {
  const { token, baseUrl } = getTradierConfig();
  const res = await fetch(`${baseUrl}/watchlists/${encodeURIComponent(id)}/symbols/${encodeURIComponent(symbol)}`, {
    method: "DELETE",
    headers: tradierHeaders(token),
  });
  if (!res.ok) {
    console.warn(`  ! Failed to remove stale symbol ${symbol} from watchlist ${id}: ${res.status} ${res.statusText}`);
  }
}

/** Creates the watchlist if missing, otherwise reconciles it to exactly match `symbols`. */
async function syncTradierWatchlist(name: string, symbols: string[]): Promise<{ id: string; added: string[]; removed: string[] }> {
  const existing = await listTradierWatchlists();
  const match = existing.find((w) => w.name.toLowerCase() === name.toLowerCase());

  if (!match) {
    const id = await createTradierWatchlist(name, symbols);
    return { id, added: symbols, removed: [] };
  }

  const currentSet = new Set(match.symbols);
  const desiredSet = new Set(symbols);
  const toAdd = symbols.filter((s) => !currentSet.has(s));
  const toRemove = match.symbols.filter((s) => !desiredSet.has(s));

  if (toAdd.length > 0) await addTradierWatchlistSymbols(match.id, toAdd);
  for (const sym of toRemove) await removeTradierWatchlistSymbol(match.id, sym);

  return { id: match.id, added: toAdd, removed: toRemove };
}

// --- DYNAMIC QQQ CONSTITUENTS ---
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

async function fetchLiveQqqConstituents(): Promise<{ symbols: string[]; source: string }> {
  try {
    const symbols = await fetchConstituentsFromInvesco();
    return { symbols, source: "invesco-holdings-csv" };
  } catch (e) {
    console.warn(`[constituents] Invesco source failed: ${(e as Error).message}`);
  }
  try {
    const symbols = await fetchConstituentsFromNasdaqApi();
    return { symbols, source: "nasdaq100-api" };
  } catch (e) {
    console.warn(`[constituents] Nasdaq-100 API fallback failed: ${(e as Error).message}`);
  }
  console.warn("[constituents] All live sources failed; using static fallback list. Results may be stale.");
  return { symbols: STATIC_FALLBACK_CONSTITUENTS, source: "static-fallback" };
}

// --- BOLLINGER MATH (mirrors computeBollinger in server.ts) ---
interface BollingerResult {
  sma: number;
  upperBand: number;
  lowerBand: number;
  percentB: number;
  bandwidthPct: number; // (upper - lower) / sma * 100
}

function computeBollinger(closes: number[], period: number, numStd: number): BollingerResult | null {
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

// --- MAIN ---
interface ScannedSymbol {
  symbol: string;
  price: number;
  bollinger: BollingerResult;
}

function matchesMode(s: ScannedSymbol, mode: Mode, squeezeThresholdPct: number): boolean {
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

function rankKey(s: ScannedSymbol, mode: Mode): number {
  // Lower rankKey = more extreme / more interesting, sorted ascending.
  if (mode === "oversold") return s.bollinger.percentB;
  if (mode === "overbought") return -s.bollinger.percentB;
  if (mode === "squeeze") return s.bollinger.bandwidthPct;
  // extremes: rank by distance from the 0.5 midpoint, most extreme first.
  return -Math.abs(s.bollinger.percentB - 0.5);
}

async function scanSymbol(symbol: string, period: number, stddev: number): Promise<ScannedSymbol | null> {
  try {
    const closes = await fetchTradierDailyCloses(symbol, Math.max(period * 3, 90));
    const bollinger = computeBollinger(closes, period, stddev);
    if (!bollinger || closes.length === 0) return null;
    return { symbol, price: closes[closes.length - 1], bollinger };
  } catch (e) {
    console.warn(`  ! Skipping ${symbol}: ${(e as Error).message}`);
    return null;
  }
}

async function scanInBatches(symbols: string[], period: number, stddev: number, batchSize = 8): Promise<ScannedSymbol[]> {
  const results: ScannedSymbol[] = [];
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((s) => scanSymbol(s, period, stddev)));
    for (const r of batchResults) if (r) results.push(r);
    // Small stagger to stay well within Tradier's rate limit across ~100 symbols.
    if (i + batchSize < symbols.length) await new Promise((r) => setTimeout(r, 400));
  }
  return results;
}

async function main() {
  const opts = parseArgs();
  const { isConfigured } = getTradierConfig();
  if (!isConfigured) {
    console.error("TRADIER_API_TOKEN is not set. Set it in the environment before running this script.");
    process.exit(1);
  }

  console.log(`[1/4] Fetching live QQQ constituents...`);
  const { symbols: constituents, source } = await fetchLiveQqqConstituents();
  console.log(`      -> ${constituents.length} symbols from source: ${source}`);

  console.log(`[2/4] Scanning ${constituents.length + 1} symbols (constituents + QQQ) via Tradier (period=${opts.period}, stddev=${opts.stddev})...`);
  const universe = ["QQQ", ...constituents];
  const scanned = await scanInBatches(universe, opts.period, opts.stddev);
  const qqqRegime = scanned.find((s) => s.symbol === "QQQ") || null;
  const constituentResults = scanned.filter((s) => s.symbol !== "QQQ");
  console.log(`      -> Got usable data for ${scanned.length}/${universe.length} symbols.`);
  if (qqqRegime) {
    console.log(`      -> QQQ regime: %B=${qqqRegime.bollinger.percentB}, price=$${qqqRegime.price}, band=[${qqqRegime.bollinger.lowerBand}, ${qqqRegime.bollinger.upperBand}]`);
  }

  console.log(`[3/4] Applying mode "${opts.mode}" filter and ranking...`);
  const matched = constituentResults
    .filter((s) => matchesMode(s, opts.mode, opts.squeezeThresholdPct))
    .sort((a, b) => rankKey(a, opts.mode) - rankKey(b, opts.mode))
    .slice(0, opts.limit);
  console.log(`      -> ${matched.length} symbols matched (capped at --limit ${opts.limit}).`);

  const finalSymbols = Array.from(new Set(["QQQ", ...matched.map((m) => m.symbol)]));

  const snapshot = {
    generatedAt: new Date().toISOString(),
    mode: opts.mode,
    period: opts.period,
    stddev: opts.stddev,
    constituentSource: source,
    universeSize: constituents.length,
    qqqRegime,
    watchlistName: opts.watchlistName,
    symbols: finalSymbols,
    matches: matched,
  };

  const outPath = path.join(process.cwd(), "qqq_bollinger_watchlist_snapshot.json");
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2), "utf-8");
  console.log(`      -> Snapshot written to ${outPath}`);

  if (opts.dryRun) {
    console.log(`[4/4] --dry-run set: skipping Tradier watchlist sync. Matched symbols: ${finalSymbols.join(", ")}`);
    return;
  }

  console.log(`[4/4] Syncing Tradier watchlist "${opts.watchlistName}"...`);
  const { id, added, removed } = await syncTradierWatchlist(opts.watchlistName, finalSymbols);
  console.log(`      -> Watchlist id=${id}. Added: [${added.join(", ") || "none"}]. Removed: [${removed.join(", ") || "none"}].`);
  console.log(`Done.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
