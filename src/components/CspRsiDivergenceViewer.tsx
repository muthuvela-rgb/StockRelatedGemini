import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Zap,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Search,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  BarChart3,
  Flame,
  Info,
  ExternalLink,
  Copy,
  Check,
  ChevronRight,
  Filter,
  Cpu,
  Sparkles,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";
import type { CspRsiDivergenceCandidate, CspRsiDivergenceResponse } from "../types";
import { SP500_COMPONENTS, SMH_COMPONENTS, QQQ_COMPONENTS } from "../data/universePresets";
import { TickerSymbolButton } from "../context/TickerHudContext";
import { useWatchlistOptions } from "../hooks/useWatchlistSelection";
import { MoneynessRangeSlider } from "./sliders/MoneynessRangeSlider";
import { CashReturnRangeSlider } from "./sliders/CashReturnRangeSlider";
import { OptionPremiumRangeSlider } from "./sliders/OptionPremiumRangeSlider";
import { RsiRangeSlider } from "./sliders/RsiRangeSlider";
import { DeltaRangeSlider } from "./DeltaRangeSlider";
import { BollingerBandSlider } from "./BollingerBandSlider";
import { useBollingerFilter } from "../context/BollingerFilterContext";

interface CspRsiDivergenceViewerProps {
  watchlist: string[];
  onSelectTradeForPayoff?: (trade: any) => void;
}

export const CspRsiDivergenceViewer: React.FC<CspRsiDivergenceViewerProps> = ({
  watchlist,
  onSelectTradeForPayoff,
}) => {
  const watchlistOptions = useWatchlistOptions(watchlist);
  const [selectedWatchlistValue, setSelectedWatchlistValue] = useState<string>("wl-0");
  const selectedWatchlist =
    watchlistOptions.find((o) => o.value === selectedWatchlistValue) || watchlistOptions[0];
  const [universe, setUniverse] = useState<"sp500" | "smh" | "qqq" | "expanded_500" | "watchlist" | "custom">("sp500");
  const [customTickers, setCustomTickers] = useState<string>("NVDA, AMD, INTC, TSLA, AAPL, AMZN, META, GOOGL, MSFT, PLTR");
  const [activeTier, setActiveTier] = useState<"all" | "tier_1" | "tier_2" | "tier_3">("all");
  const [moneynessRange, setMoneynessRange] = useState<[number, number]>([0, 100]);
  const [cashReturnRange, setCashReturnRange] = useState<[number, number]>([5, 100]);
  const [premiumRange, setPremiumRange] = useState<[number, number]>([0, 50]);
  const [rsiRange, setRsiRange] = useState<[number, number]>([0, 100]);
  const [deltaRange, setDeltaRange] = useState<[number, number]>([0.0, 1.0]);
  const { bollingerRange, setBollingerRange, resetBollingerRange, matchesBollingerEntity } = useBollingerFilter();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedContract, setCopiedContract] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<CspRsiDivergenceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAlgorithmDetails, setShowAlgorithmDetails] = useState<boolean>(false);

  const getUniverseTitle = (u: string) => {
    if (u === "smh") return "All components of SMH";
    if (u === "qqq") return "All components of QQQ";
    if (u === "watchlist") return "My Watchlist";
    if (u === "custom") return "Custom Tickers";
    return "All components of S&P 500";
  };

  const runScan = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      let tickersToSend: string[] | undefined = undefined;
      if (universe === "custom") {
        tickersToSend = customTickers.split(/[\s,]+/).map((t) => t.trim().toUpperCase()).filter(Boolean);
      } else if (universe === "watchlist") {
        tickersToSend = selectedWatchlist.tickers;
      }

      const res = await fetch("/api/csp-rsi-divergence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universe,
          tickers: tickersToSend,
          forceRefresh,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to scan universe for CSP candidates");
      }

      const json: CspRsiDivergenceResponse = await res.json();
      setData(json);
    } catch (err: any) {
      console.error("Error in CSP RSI Divergence scan:", err);
      setError(err.message || "An unexpected error occurred while scanning.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runScan();
  }, [universe, selectedWatchlistValue]);

  const handleCopyContract = (symbol: string) => {
    navigator.clipboard.writeText(symbol);
    setCopiedContract(symbol);
    setTimeout(() => setCopiedContract(null), 2000);
  };

  // Filter candidates based on active tab, search, and slider thresholds
  const candidatesToDisplay = React.useMemo(() => {
    if (!data?.all_candidates) return [];
    let list = data.all_candidates;

    if (activeTier !== "all") {
      list = list.filter((c) => c.tier === activeTier);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.ticker.toLowerCase().includes(q) ||
          c.tier_label.toLowerCase().includes(q) ||
          (c.recommended_put?.contract_symbol || "").toLowerCase().includes(q)
      );
    }

    if (cashReturnRange[0] > 0 || cashReturnRange[1] < 100) {
      list = list.filter((c) => {
        const ret = c.recommended_put?.annualized_return_cash || 0;
        return ret >= cashReturnRange[0] && (cashReturnRange[1] >= 100 || ret <= cashReturnRange[1]);
      });
    }

    if (moneynessRange[0] > 0 || moneynessRange[1] < 100) {
      list = list.filter((c) => {
        const m = c.recommended_put?.cushion_to_strike_pct || 0;
        return m >= moneynessRange[0] && (moneynessRange[1] >= 100 || m <= moneynessRange[1]);
      });
    }

    if (premiumRange[0] > 0 || premiumRange[1] < 50) {
      list = list.filter((c) => {
        const p = c.recommended_put?.bid || 0;
        return p >= premiumRange[0] && (premiumRange[1] >= 50 || p <= premiumRange[1]);
      });
    }

    if (rsiRange[0] > 0 || rsiRange[1] < 100) {
      list = list.filter((c) => {
        const rsi = c.rsi_daily;
        if (rsi !== null && rsi !== undefined) {
          return rsi >= rsiRange[0] && rsi <= rsiRange[1];
        }
        return true;
      });
    }

    if (deltaRange[0] > 0.001 || deltaRange[1] < 0.999) {
      list = list.filter((c) => {
        const delta = Math.abs(c.recommended_put?.delta || 0);
        return delta >= deltaRange[0] && delta <= deltaRange[1];
      });
    }

    // Filter by Bollinger Bands (%B) (via centralized predicate)
    list = list.filter(matchesBollingerEntity);

    return list;
  }, [data, activeTier, searchQuery, moneynessRange, cashReturnRange, premiumRange, rsiRange, deltaRange, bollingerRange, matchesBollingerEntity]);

  return (
    <div className="space-y-6">
      {/* Engine Banner & Overview */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500/20 to-emerald-500/20 border border-amber-500/30 text-amber-400">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white font-display flex flex-wrap items-center gap-2">
                  Expanded CSP Candidate Engine
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-medium">
                    RSI Divergence Only
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-medium">
                    {data?.universe_scanned || getUniverseTitle(universe)}
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Systematic Cash-Secured Put screening engine based on <strong>multi-timeframe RSI exhaustion</strong>, confirmed <strong>bullish price/RSI divergence</strong>, <strong>weekly trend filter</strong> (RSI &gt; 45), <strong>Bollinger Band proximity</strong> (within 2%), and <strong>volume surge confirmation</strong>.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowAlgorithmDetails(!showAlgorithmDetails)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
            >
              <Info className="w-4 h-4 text-cyan-400" />
              <span>{showAlgorithmDetails ? "Hide Algorithm Rules" : "Inspect Algorithm"}</span>
            </button>

            <button
              onClick={() => runScan(true)}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 text-xs sm:text-sm font-bold shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>{loading ? "Scanning Universe..." : "Run Scanner"}</span>
            </button>
          </div>
        </div>

        {/* Algorithm Rules Disclosure Panel */}
        {showAlgorithmDetails && (
          <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400 font-mono uppercase tracking-wider text-[11px]">
                Formal 7-Step CSP Candidate Selection Rules
              </span>
              <span className="text-[10px] text-slate-500">Multi-Timeframe Engine</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-[11px]">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="font-semibold text-emerald-400 block mb-1">1. RSI Exhaustion</span>
                <p className="text-slate-400">
                  <code className="text-amber-300">RSI_daily &lt; 40</code> OR <code className="text-amber-300">RSI_4h &lt; 35</code>. Identifies seller capitulation.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="font-semibold text-emerald-400 block mb-1">2. Bullish Divergence</span>
                <p className="text-slate-400">
                  <code className="text-amber-300">Price(L2) &lt; Price(L1)</code> AND <code className="text-amber-300">RSI(L2) &gt; RSI(L1) - 2</code> on Daily or 4H.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="font-semibold text-emerald-400 block mb-1">3. Macro Trend Filter</span>
                <p className="text-slate-400">
                  <code className="text-amber-300">RSI_weekly &gt; 45</code>. Guarantees stock is not in a long-term structural bear market.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="font-semibold text-emerald-400 block mb-1">4. BB &amp; Up-Volume Surge</span>
                <p className="text-slate-400">
                  <code className="text-amber-300">Price &le; BB_lower * 1.02</code> (within 2%) + <code className="text-amber-300">Up-Vol_jump &ge; 1.5x</code> on green candle (down volume strictly excluded).
                </p>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span><strong>Tier-1:</strong> All 6 conditions passed with Up-Volume surge (Strong CSP)</span>
              <span><strong>Tier-2:</strong> Up-volume unconfirmed or down volume day (Moderate CSP)</span>
              <span><strong>Tier-3:</strong> Daily RSI 40–50 with early 4H divergence (Watchlist)</span>
            </div>
          </div>
        )}

        {/* Universe to Scan Presets Section */}
        <div className="pt-5 border-t border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Universe to Scan Presets</span>
            </div>
            <span className="text-[11px] text-slate-400">
              Select a benchmark index or custom universe to scan multi-timeframe RSI divergences
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {/* Preset 1: All components of S&P 500 */}
            <button
              type="button"
              onClick={() => setUniverse("sp500")}
              className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between relative ${
                universe === "sp500" || universe === "expanded_500"
                  ? "bg-amber-500/15 border-amber-500 text-white shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/40"
                  : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Broad Market</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700/60 text-slate-300 font-semibold">
                  {SP500_COMPONENTS.length} stocks
                </span>
              </div>
              <div className="text-xs font-bold text-white leading-tight">All components of S&P 500</div>
              <div className="text-[10px] text-slate-400 mt-1 line-clamp-1">Large-cap US index basket</div>
            </button>

            {/* Preset 2: All components of SMH */}
            <button
              type="button"
              onClick={() => setUniverse("smh")}
              className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between relative ${
                universe === "smh"
                  ? "bg-cyan-500/15 border-cyan-500 text-white shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/40"
                  : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                  <Cpu className="w-3 h-3" />
                  Semiconductors
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700/60 text-cyan-300 font-semibold">
                  {SMH_COMPONENTS.length} stocks
                </span>
              </div>
              <div className="text-xs font-bold text-white leading-tight">All components of SMH</div>
              <div className="text-[10px] text-slate-400 mt-1 line-clamp-1">High-IV chip leaders (NVDA, TSM...)</div>
            </button>

            {/* Preset 3: All components of QQQ */}
            <button
              type="button"
              onClick={() => setUniverse("qqq")}
              className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between relative ${
                universe === "qqq"
                  ? "bg-indigo-500/15 border-indigo-500 text-white shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/40"
                  : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Nasdaq-100</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700/60 text-indigo-300 font-semibold">
                  {QQQ_COMPONENTS.length} stocks
                </span>
              </div>
              <div className="text-xs font-bold text-white leading-tight">All components of QQQ</div>
              <div className="text-[10px] text-slate-400 mt-1 line-clamp-1">Tech & growth champions</div>
            </button>

            {/* Preset 4: My Watchlist */}
            <button
              type="button"
              onClick={() => setUniverse("watchlist")}
              className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between relative ${
                universe === "watchlist"
                  ? "bg-emerald-500/15 border-emerald-500 text-white shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/40"
                  : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Personal</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700/60 text-emerald-300 font-semibold">
                  {selectedWatchlist.tickers.length} stocks
                </span>
              </div>
              <div className="text-xs font-bold text-white leading-tight">My Watchlist</div>
              <div className="text-[10px] text-slate-400 mt-1 line-clamp-1">Choose a slot below</div>
            </button>

            {/* Preset 5: Custom Tickers */}
            <button
              type="button"
              onClick={() => setUniverse("custom")}
              className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between relative ${
                universe === "custom"
                  ? "bg-purple-500/15 border-purple-500 text-white shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/40"
                  : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Flexible</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700/60 text-purple-300 font-semibold">
                  Manual
                </span>
              </div>
              <div className="text-xs font-bold text-white leading-tight">Custom Tickers</div>
              <div className="text-[10px] text-slate-400 mt-1 line-clamp-1">Type or paste any ticker list</div>
            </button>
          </div>

          {/* Active Preset Information Strip & Quick Filters */}
          <div className="mt-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
            {universe === "smh" && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[11px] font-bold">
                      SMH Universe ({SMH_COMPONENTS.length} stocks)
                    </span>
                    <span className="text-slate-400">
                      VanEck Semiconductor ETF holdings. Pure-play chipmakers & fab equipment with elevated implied volatility and rich put premium yields.
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  <span className="text-[10px] text-slate-500 font-medium mr-1">Components:</span>
                  {SMH_COMPONENTS.map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => setSearchQuery(searchQuery === sym ? "" : sym)}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono transition cursor-pointer ${
                        searchQuery === sym
                          ? "bg-cyan-500 text-slate-950 font-bold"
                          : "bg-slate-900 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 border border-slate-800"
                      }`}
                      title={`Click to filter candidates by ${sym}`}
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {universe === "qqq" && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[11px] font-bold">
                      QQQ Universe ({QQQ_COMPONENTS.length} stocks)
                    </span>
                    <span className="text-slate-400">
                      Nasdaq-100 index constituents. Top non-financial growth, tech, software, AI, and consumer innovators with deep options open interest.
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  <span className="text-[10px] text-slate-500 font-medium mr-1">Top components:</span>
                  {QQQ_COMPONENTS.slice(0, 22).map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => setSearchQuery(searchQuery === sym ? "" : sym)}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono transition cursor-pointer ${
                        searchQuery === sym
                          ? "bg-indigo-500 text-slate-950 font-bold"
                          : "bg-slate-900 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 border border-slate-800"
                      }`}
                      title={`Click to filter candidates by ${sym}`}
                    >
                      {sym}
                    </button>
                  ))}
                  <span className="text-[10px] text-slate-500 font-mono">+{QQQ_COMPONENTS.length - 22} more</span>
                </div>
              </div>
            )}

            {(universe === "sp500" || universe === "expanded_500") && (
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[11px] font-bold">
                    S&P 500 Universe ({SP500_COMPONENTS.length} stocks)
                  </span>
                  <span className="text-slate-400">
                    Full official constituent basket of the S&P 500 Index. Multi-timeframe RSI screening across all 11 GICS sectors.
                  </span>
                </div>
              </div>
            )}

            {universe === "watchlist" && (
              <div className="space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[11px] font-bold">
                      Watchlist Scan ({selectedWatchlist.tickers.length} stocks)
                    </span>
                    <span className="text-slate-400">
                      Scanning the selected watchlist below for confirmed oversold divergence setups. This selection is local to this scan.
                    </span>
                  </div>
                </div>
                {watchlistOptions.length > 1 && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-500">Watchlist:</span>
                    <div className="flex flex-wrap gap-1">
                      {watchlistOptions.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => setSelectedWatchlistValue(o.value)}
                          className={`text-[10px] px-2 py-0.5 rounded font-mono transition cursor-pointer ${
                            selectedWatchlistValue === o.value
                              ? "bg-emerald-500 text-slate-950 font-bold"
                              : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {universe === "custom" && (
              <div className="space-y-2 text-xs">
                <label className="text-slate-400 text-xs font-medium block">
                  Custom Tickers List (comma or space separated)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customTickers}
                    onChange={(e) => setCustomTickers(e.target.value)}
                    placeholder="NVDA, AMD, AAPL, MSFT, TSLA..."
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => runScan(true)}
                    disabled={loading}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition cursor-pointer shadow-md shadow-amber-500/20 disabled:opacity-50"
                  >
                    Scan Custom
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Search Input & Reset Filter Row */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Filter candidates by ticker or symbol, e.g. DG, ALB, LULU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            {(moneynessRange[0] > 0 || moneynessRange[1] < 100 || cashReturnRange[0] > 5 || cashReturnRange[1] < 100 || premiumRange[0] > 0 || premiumRange[1] < 50 || rsiRange[0] > 0 || rsiRange[1] < 100 || deltaRange[0] > 0.001 || deltaRange[1] < 0.999 || bollingerRange[0] > -20 || bollingerRange[1] < 120) && (
              <button
                type="button"
                onClick={() => {
                  setMoneynessRange([0, 100]);
                  setCashReturnRange([5, 100]);
                  setPremiumRange([0, 50]);
                  setRsiRange([0, 100]);
                  setDeltaRange([0.0, 1.0]);
                  resetBollingerRange();
                }}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold cursor-pointer transition shrink-0 self-start sm:self-auto"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset All Filter Sliders</span>
              </button>
            )}
          </div>

          {/* 5-Slider Deck: Moneyness Band, Cash Return, Option Premium, RSI (14), and Delta Greek */}
          <div className="pt-3 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                Dynamic Divergence Candidate Filters
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                <strong className={candidatesToDisplay.length === 0 ? "text-rose-400" : "text-amber-400"}>
                  {candidatesToDisplay.length}
                </strong>
                {" "}/ {data?.all_candidates.length || 0} candidates
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <MoneynessRangeSlider
                range={moneynessRange}
                onChange={setMoneynessRange}
              />
              <CashReturnRangeSlider
                range={cashReturnRange}
                onChange={setCashReturnRange}
              />
              <OptionPremiumRangeSlider
                range={premiumRange}
                onChange={setPremiumRange}
              />
              <RsiRangeSlider
                range={rsiRange}
                onChange={setRsiRange}
              />
            </div>

            {/* Delta Greek Range Slider - Moved to next line and made bigger so wide windows never squash it */}
            <div className="mt-3.5 w-full">
              <DeltaRangeSlider
                range={deltaRange}
                onChange={setDeltaRange}
              />
            </div>

            {/* Bollinger Bands (%B) Range Slider - Placed on a separate line below Delta slider */}
            <div className="mt-3.5 w-full">
              <BollingerBandSlider
                range={bollingerRange}
                onChange={setBollingerRange}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Engine Stats & Rejection Diagnostic Cockpit */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[11px] text-slate-400 font-medium block">Scanned Universe</span>
            <div className="text-lg font-bold text-white font-mono mt-0.5">
              {data.stats.scanned_count}
              <span className="text-xs text-slate-500 font-normal ml-1">stocks</span>
            </div>
          </div>

          <div
            onClick={() => setActiveTier("tier_1")}
            className={`p-3.5 rounded-xl border cursor-pointer transition ${
              activeTier === "tier_1"
                ? "bg-emerald-500/15 border-emerald-500/50 shadow-md shadow-emerald-500/10"
                : "bg-slate-900 border-slate-800 hover:border-emerald-500/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-emerald-400 font-medium">Tier-1 Strong</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono mt-0.5">{data.stats.tier_1_count}</div>
          </div>

          <div
            onClick={() => setActiveTier("tier_2")}
            className={`p-3.5 rounded-xl border cursor-pointer transition ${
              activeTier === "tier_2"
                ? "bg-amber-500/15 border-amber-500/50 shadow-md shadow-amber-500/10"
                : "bg-slate-900 border-slate-800 hover:border-amber-500/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-amber-400 font-medium">Tier-2 Moderate</span>
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono mt-0.5">{data.stats.tier_2_count}</div>
          </div>

          <div
            onClick={() => setActiveTier("tier_3")}
            className={`p-3.5 rounded-xl border cursor-pointer transition ${
              activeTier === "tier_3"
                ? "bg-cyan-500/15 border-cyan-500/50 shadow-md shadow-cyan-500/10"
                : "bg-slate-900 border-slate-800 hover:border-cyan-500/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-cyan-400 font-medium">Tier-3 Watchlist</span>
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono mt-0.5">{data.stats.tier_3_count}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[11px] text-slate-400 font-medium block">Exhaustion Filtered</span>
            <div className="text-lg font-bold text-slate-300 font-mono mt-0.5">
              {data.stats.rejection_breakdown.exhaustion}
              <span className="text-[10px] text-slate-500 font-normal ml-1">RSI &ge; 40</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[11px] text-slate-400 font-medium block">Divergence Filtered</span>
            <div className="text-lg font-bold text-slate-300 font-mono mt-0.5">
              {data.stats.rejection_breakdown.divergence}
              <span className="text-[10px] text-slate-500 font-normal ml-1">no div</span>
            </div>
          </div>
        </div>
      )}

      {/* Tier Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTier("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTier === "all"
                ? "bg-slate-700 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 bg-slate-900/60 border border-slate-800"
            }`}
          >
            <span>All Candidates</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] font-mono">
              {data?.all_candidates.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTier("tier_1")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTier === "tier_1"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/10"
                : "text-slate-400 hover:text-slate-200 bg-slate-900/60 border border-slate-800"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Tier-1 Strong CSP</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-950/60 text-emerald-400 text-[10px] font-mono">
              {data?.stats.tier_1_count || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTier("tier_2")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTier === "tier_2"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10"
                : "text-slate-400 hover:text-slate-200 bg-slate-900/60 border border-slate-800"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Tier-2 Moderate CSP</span>
            <span className="px-1.5 py-0.2 rounded-full bg-amber-950/60 text-amber-400 text-[10px] font-mono">
              {data?.stats.tier_2_count || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTier("tier_3")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTier === "tier_3"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10"
                : "text-slate-400 hover:text-slate-200 bg-slate-900/60 border border-slate-800"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Tier-3 Watchlist</span>
            <span className="px-1.5 py-0.2 rounded-full bg-cyan-950/60 text-cyan-400 text-[10px] font-mono">
              {data?.stats.tier_3_count || 0}
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Showing {candidatesToDisplay.length} qualified opportunities
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="inline-flex p-3 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            <RefreshCw className="w-8 h-8 animate-spin" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Running Multi-Timeframe Divergence Scan</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Evaluating Daily, 4-Hour, and Weekly OHLCV bars across {getUniverseTitle(universe)} for RSI exhaustion, Bollinger Band proximity, and volume surges...
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && !loading && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <div>
            <strong className="font-semibold block text-rose-200">Scan Error:</strong>
            {error}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && candidatesToDisplay.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Matching CSP Candidates Found</h3>
          <p className="text-xs text-slate-400 max-w-lg mx-auto">
            {data?.stats.scanned_count
              ? `Out of ${data.stats.scanned_count} tickers scanned, ${data.stats.rejection_breakdown.exhaustion} stocks failed the RSI exhaustion threshold, and ${data.stats.rejection_breakdown.divergence} stocks lacked confirmed swing divergence.`
              : "Try switching to the Expanded 500+ Universe, relaxing the Min Cash Return slider, or entering custom tickers to evaluate."}
          </p>
        </div>
      )}

      {/* Candidates List Cards */}
      {!loading && !error && candidatesToDisplay.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {candidatesToDisplay.map((c) => {
            const put = c.recommended_put;
            const isTier1 = c.tier === "tier_1";
            const isTier2 = c.tier === "tier_2";
            const isTier3 = c.tier === "tier_3";

            return (
              <div
                key={c.ticker}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-lg space-y-4 relative overflow-hidden"
              >
                {/* Tier Accent Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <TickerSymbolButton ticker={c.ticker} className="text-xl font-extrabold font-mono" />
                      <span className="text-sm font-semibold text-slate-300">${c.current_price.toFixed(2)}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          isTier1
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : isTier2
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                        }`}
                      >
                        {c.tier_label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      {c.classification_reason}
                    </p>
                  </div>

                  {put && (
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-400 font-medium block">Ann. Cash Return</span>
                      <span className="text-base font-bold text-emerald-400 font-mono">
                        {put.annualized_return_cash}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Technical Indicator Matrix Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {/* Daily RSI */}
                  <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 block">RSI Daily (14)</span>
                    <div className="font-mono font-bold mt-0.5 flex items-center justify-between">
                      <span className={c.rsi_daily && c.rsi_daily < 40 ? "text-amber-400" : "text-slate-300"}>
                        {c.rsi_daily ?? "N/A"}
                      </span>
                      {c.rsi_daily && c.rsi_daily < 40 && (
                        <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-semibold">
                          Oversold
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 4H RSI */}
                  <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 block">RSI 4-Hour</span>
                    <div className="font-mono font-bold mt-0.5 flex items-center justify-between">
                      <span className={c.rsi_4h && c.rsi_4h < 35 ? "text-amber-400" : "text-slate-300"}>
                        {c.rsi_4h ?? "N/A"}
                      </span>
                      {c.rsi_4h && c.rsi_4h < 35 && (
                        <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-semibold">
                          Capitulation
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Weekly RSI */}
                  <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 block">RSI Weekly (Trend)</span>
                    <div className="font-mono font-bold mt-0.5 flex items-center justify-between">
                      <span className={c.rsi_weekly && c.rsi_weekly > 45 ? "text-emerald-400" : "text-rose-400"}>
                        {c.rsi_weekly ?? "N/A"}
                      </span>
                      <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                        Bull Regime
                      </span>
                    </div>
                  </div>

                  {/* Bollinger Lower Proximity */}
                  <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 block">BB Lower Proximity</span>
                    <div className="font-mono font-bold mt-0.5 flex items-center justify-between">
                      <span className="text-cyan-400">${c.bb_lower?.toFixed(2) ?? "N/A"}</span>
                      {c.bb_distance_pct !== null && (
                        <span className="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-300 font-semibold">
                          {c.bb_distance_pct > 0 ? `+${c.bb_distance_pct}%` : `${c.bb_distance_pct}%`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Swing Divergence & Volume Confirmation Details */}
                <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/70 text-xs space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-slate-300 font-medium">
                        Divergence: <strong className="text-white capitalize">{c.divergence_timeframe} Timeframe</strong>
                      </span>
                    </div>
                    {c.price_drop_pct !== null && c.rsi_delta !== null && (
                      <span className="text-[11px] font-mono text-slate-400">
                        Price {c.price_drop_pct}% | RSI &Delta; +{c.rsi_delta}
                      </span>
                    )}
                  </div>

                  {c.l1_swing_low && c.l2_swing_low && (
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">Prior Swing Low (L1)</span>
                        <span className="text-slate-300">${c.l1_swing_low.price}</span> (RSI {c.l1_swing_low.rsi})
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">Latest Swing Low (L2)</span>
                        <span className="text-emerald-400 font-bold">${c.l2_swing_low.price}</span> (RSI {c.l2_swing_low.rsi})
                      </div>
                    </div>
                  )}

                  {/* Volume Surge & Candle Status */}
                  <div className="flex items-center justify-between text-[11px] pt-1 text-slate-400 border-t border-slate-900">
                    <div className="flex items-center gap-1.5">
                      <span>Up-Vol Surge:</span>
                      <span
                        className={`font-mono font-bold ${
                          (c.vol_jump ?? 0) >= 1.5 ? "text-emerald-400" : c.is_up_volume === false ? "text-rose-400" : "text-amber-400"
                        }`}
                      >
                        {c.is_up_volume === false
                          ? "0x (Down Vol Excluded)"
                          : c.vol_jump !== null && c.vol_jump !== undefined
                          ? `${c.vol_jump}x Up-Vol Avg`
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span>Candle:</span>
                      <span className={`capitalize font-semibold ${c.candle_status === "bullish" ? "text-emerald-400" : c.candle_status === "bearish" ? "text-rose-400" : "text-slate-200"}`}>
                        {c.candle_status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Recommended Cash-Secured Put Contract Box */}
                {put && (
                  <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-950/30 to-slate-950 border border-emerald-500/30 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Recommended CSP Contract
                      </span>
                      <span className="text-[10px] font-mono text-cyan-400 font-medium">
                        {put.strike_vs_bb_lower}
                      </span>
                    </div>

                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white font-mono">
                          ${put.strike} Put
                        </span>
                        <span className="text-xs text-slate-300 font-mono">
                          exp {put.expiration} ({put.dte}d)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyContract(put.contract_symbol)}
                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono flex items-center gap-1 transition cursor-pointer"
                          title="Copy contract symbol"
                        >
                          {copiedContract === put.contract_symbol ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-400" />
                              <span>{put.contract_symbol}</span>
                            </>
                          )}
                        </button>

                        {onSelectTradeForPayoff && (
                          <button
                            onClick={() =>
                              onSelectTradeForPayoff({
                                ticker: c.ticker,
                                strike: put.strike,
                                expiration: put.expiration,
                                dte: put.dte,
                                bid: put.bid,
                                ask: put.ask,
                                current_price: c.current_price,
                                cushion_to_strike_pct: put.cushion_to_strike_pct,
                                annualized_return_cash_secured: put.annualized_return_cash,
                                annualized_return_margin: put.annualized_return_margin,
                                probability_of_profit: put.pop,
                                delta: put.delta,
                                theta: put.daily_theta,
                                risk_tier: isTier1 ? "least_risk" : isTier2 ? "medium_risk" : "high_risk",
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                          >
                            <span>Analyze Payoff</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Key Put Metrics */}
                    <div className="grid grid-cols-4 gap-2 text-[11px] font-mono pt-1 text-slate-300 border-t border-slate-900">
                      <div>
                        <span className="text-[9px] text-slate-500 block">Premium</span>
                        <span className="font-bold text-white">${put.bid.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block">Moneyness</span>
                        <span className="font-bold text-cyan-300">+{put.cushion_to_strike_pct}%</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block">Win Rate (POP)</span>
                        <span className="font-bold text-cyan-300">{put.pop}%</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 block">Delta / Theta</span>
                        <span className="font-bold text-amber-300">
                          {put.delta} / +${put.daily_theta}/d
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
