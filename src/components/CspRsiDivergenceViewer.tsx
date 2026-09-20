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
} from "lucide-react";
import type { CspRsiDivergenceCandidate, CspRsiDivergenceResponse, UserWatchlist } from "../types";

interface CspRsiDivergenceViewerProps {
  watchlist: string[];
  watchlists?: UserWatchlist[];
  activeWatchlistIndex?: number;
  onSelectWatchlistIndex?: (index: number) => void;
  onSelectTradeForPayoff?: (trade: any) => void;
}

export const CspRsiDivergenceViewer: React.FC<CspRsiDivergenceViewerProps> = ({
  watchlist,
  watchlists,
  activeWatchlistIndex,
  onSelectWatchlistIndex,
  onSelectTradeForPayoff,
}) => {
  const [universe, setUniverse] = useState<"expanded_500" | "qqq" | "spy" | "watchlist" | "custom">("expanded_500");
  const [customTickers, setCustomTickers] = useState<string>("NVDA, AMD, INTC, TSLA, AAPL, AMZN, META, GOOGL, MSFT, PLTR");
  const [activeTier, setActiveTier] = useState<"all" | "tier_1" | "tier_2" | "tier_3">("all");
  const [minCashReturn, setMinCashReturn] = useState<number>(5);
  const [minBufferFilter, setMinBufferFilter] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedContract, setCopiedContract] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<CspRsiDivergenceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAlgorithmDetails, setShowAlgorithmDetails] = useState<boolean>(false);

  const runScan = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      let tickersToSend: string[] | undefined = undefined;
      if (universe === "custom") {
        tickersToSend = customTickers.split(/[\s,]+/).map((t) => t.trim().toUpperCase()).filter(Boolean);
      } else if (universe === "watchlist") {
        tickersToSend = watchlist;
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
  }, [universe]);

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

    if (minCashReturn > 0) {
      list = list.filter((c) => (c.recommended_put?.annualized_return_cash || 0) >= minCashReturn);
    }

    if (minBufferFilter > 0) {
      list = list.filter((c) => (c.recommended_put?.cushion_to_strike_pct || 0) >= minBufferFilter);
    }

    return list;
  }, [data, activeTier, searchQuery, minCashReturn, minBufferFilter]);

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
                    500+ Liquid Universe
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
                <span className="font-semibold text-emerald-400 block mb-1">4. BB &amp; Volume Surge</span>
                <p className="text-slate-400">
                  <code className="text-amber-300">Price &le; BB_lower * 1.02</code> (within 2%) + <code className="text-amber-300">Vol_jump &ge; 1.5x</code> on bullish/neutral candle.
                </p>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span><strong>Tier-1:</strong> All 6 conditions passed (Strong CSP)</span>
              <span><strong>Tier-2:</strong> Volume surge unconfirmed (Moderate CSP)</span>
              <span><strong>Tier-3:</strong> Daily RSI 40–50 with early 4H divergence (Watchlist)</span>
            </div>
          </div>
        )}

        {/* Universe Selector & Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
          {/* Universe Selector */}
          <div>
            <label className="text-slate-400 font-medium text-xs block mb-1.5">Universe to Scan</label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setUniverse("expanded_500")}
                className={`py-1.5 px-2 rounded-lg font-medium transition cursor-pointer text-center ${
                  universe === "expanded_500"
                    ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Expanded 500+
              </button>
              <button
                onClick={() => setUniverse("qqq")}
                className={`py-1.5 px-2 rounded-lg font-medium transition cursor-pointer text-center ${
                  universe === "qqq"
                    ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Nasdaq 100
              </button>
              <button
                onClick={() => setUniverse("watchlist")}
                className={`py-1.5 px-2 rounded-lg font-medium transition cursor-pointer text-center ${
                  universe === "watchlist"
                    ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                My Watchlist
              </button>
              <button
                onClick={() => setUniverse("custom")}
                className={`py-1.5 px-2 rounded-lg font-medium transition cursor-pointer text-center ${
                  universe === "custom"
                    ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Custom Tickers
              </button>
            </div>

            {/* Watchlist Slot Switcher if universe === 'watchlist' */}
            {universe === "watchlist" && watchlists && watchlists.length > 0 && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500">Active Watchlist:</span>
                <div className="flex gap-1">
                  {watchlists.map((w, idx) => (
                    <button
                      key={w.id}
                      onClick={() => onSelectWatchlistIndex && onSelectWatchlistIndex(idx)}
                      className={`text-[10px] px-2 py-0.5 rounded font-mono transition cursor-pointer ${
                        activeWatchlistIndex === idx
                          ? "bg-emerald-500 text-slate-950 font-bold"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {w.name} ({w.tickers.length})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Min Annual Return Slider */}
          <div>
            <div className="flex justify-between items-center mb-1.5 text-xs">
              <label className="text-slate-400 font-medium">Min Annual Cash Return</label>
              <span className="text-emerald-400 font-bold font-mono">{minCashReturn}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              step={1}
              value={minCashReturn}
              onChange={(e) => setMinCashReturn(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
              <span>0% (All)</span>
              <span>15%</span>
              <span>25%</span>
              <span>40%</span>
            </div>
          </div>

          {/* Min Buffer Slider */}
          <div>
            <div className="flex justify-between items-center mb-1.5 text-xs">
              <label className="text-slate-400 font-medium flex items-center gap-1">
                <span>Min Buffer to Strike</span>
                {minBufferFilter > 0 && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                    Active
                  </span>
                )}
              </label>
              <span className="text-emerald-400 font-bold font-mono">&ge; {minBufferFilter}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={minBufferFilter}
              onChange={(e) => setMinBufferFilter(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
              <span>0%</span>
              <span>10%</span>
              <span>20%</span>
              <span>30%</span>
            </div>
          </div>

          {/* Search Input */}
          <div>
            <label className="text-slate-400 font-medium text-xs block mb-1.5">Filter by Ticker / Symbol</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="e.g. DG, ALB, LULU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Custom Tickers Input Bar */}
        {universe === "custom" && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <label className="text-slate-400 text-xs font-medium block mb-1">
              Custom Tickers List (comma or space separated)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customTickers}
                onChange={(e) => setCustomTickers(e.target.value)}
                placeholder="NVDA, AMD, AAPL, MSFT, TSLA..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={() => runScan(true)}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                Scan Custom
              </button>
            </div>
          </div>
        )}
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
              Evaluating Daily, 4-Hour, and Weekly OHLCV bars across the {universe === "expanded_500" ? "Expanded 500+ Liquid Universe" : universe} for RSI exhaustion, Bollinger Band proximity, and volume surges...
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
                      <span className="text-xl font-extrabold text-white font-mono">{c.ticker}</span>
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
                      <span>Volume Surge:</span>
                      <span
                        className={`font-mono font-bold ${
                          c.vol_jump >= 1.5 ? "text-emerald-400" : "text-amber-400"
                        }`}
                      >
                        {c.vol_jump}x 20d avg
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span>Candle:</span>
                      <span className="capitalize font-semibold text-slate-200">
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
                        <span className="text-[9px] text-slate-500 block">Buffer to Strike</span>
                        <span className="font-bold text-emerald-400">+{put.cushion_to_strike_pct}%</span>
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
