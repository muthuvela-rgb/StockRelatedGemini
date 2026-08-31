import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck,
  Zap,
  Flame,
  Layers,
  Sparkles,
  TrendingDown,
  Clock,
  DollarSign,
  Activity,
  Filter,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  Info,
  SlidersHorizontal,
  ArrowUpRight,
  TrendingUp,
  PieChart as PieChartIcon,
  X,
  Target,
  ExternalLink,
  HelpCircle,
  Download
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart
} from "recharts";
import {
  RecommendedPut,
  RiskTier,
  PutRecommendationsResponse,
  AiPortfolioStrategy
} from "../types";
import { formatCurrency, formatPct, formatLargeNumber } from "../lib/utils";

interface PutRecommendationsViewerProps {
  watchlist: string[];
}

export const PutRecommendationsViewer: React.FC<PutRecommendationsViewerProps> = ({ watchlist }) => {
  // Filters & State
  const [universe, setUniverse] = useState<"watchlist" | "qqq" | "spy" | "custom">("watchlist");
  const [customTickers, setCustomTickers] = useState<string>("NVDA, AAPL, MSFT, AMZN, META, TSLA");
  const [horizon, setHorizon] = useState<"all" | "weeklies" | "sweetspot" | "monthly" | "extended">("sweetspot");
  const [minAnnualReturn, setMinAnnualReturn] = useState<number>(8);
  const [minBid, setMinBid] = useState<number>(0.35);
  const [activeTierTab, setActiveTierTab] = useState<RiskTier | "all">("least_risk");
  const [sortBy, setSortBy] = useState<"score" | "annual_cash" | "annual_margin" | "cushion" | "pop" | "theta">("annual_cash");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Loading & Data State
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<PutRecommendationsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Selected item for Payoff Diagram Modal
  const [selectedTrade, setSelectedTrade] = useState<RecommendedPut | null>(null);
  const [contractQuantity, setContractQuantity] = useState<number>(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // AI Strategy Modal State
  const [aiModalOpen, setAiModalOpen] = useState<boolean>(false);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiStrategy, setAiStrategy] = useState<AiPortfolioStrategy | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Determine DTE range from horizon selection
  const dteRange = useMemo(() => {
    switch (horizon) {
      case "weeklies":
        return { minDte: 5, maxDte: 16 };
      case "sweetspot":
        return { minDte: 20, maxDte: 45 };
      case "monthly":
        return { minDte: 14, maxDte: 35 };
      case "extended":
        return { minDte: 30, maxDte: 60 };
      case "all":
      default:
        return { minDte: 6, maxDte: 65 };
    }
  }, [horizon]);

  // Fetch Put Recommendations
  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);

    let targetTickers: string[] = [];
    if (universe === "watchlist") {
      targetTickers = watchlist.length > 0 ? watchlist : ["NVDA", "AAPL", "MSFT", "AMZN", "META", "TSLA", "QQQ"];
    } else if (universe === "qqq") {
      targetTickers = ["NVDA", "AAPL", "MSFT", "MU", "AMZN", "AMD", "GOOGL", "TSLA", "AVGO", "META", "COST", "PLTR", "AMAT", "NFLX", "QQQ"];
    } else if (universe === "spy") {
      targetTickers = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "JPM", "V", "XOM", "COST", "PEP", "SPY"];
    } else {
      targetTickers = customTickers
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean);
    }

    try {
      const res = await fetch("/api/put-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickers: targetTickers,
          minDte: dteRange.minDte,
          maxDte: dteRange.maxDte,
          minBid,
          minAnnualMarginReturn: minAnnualReturn,
          minOpenInterest: 3,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned error ${res.status}`);
      }

      const resData: PutRecommendationsResponse = await res.json();
      setData(resData);
    } catch (err: any) {
      console.error("Error fetching put recommendations:", err);
      setError(err.message || "Failed to load put recommendations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [universe, horizon]);

  // Fetch AI Strategy Briefing
  const generateAiStrategy = async () => {
    if (!data) return;
    setAiLoading(true);
    setAiError(null);
    setAiModalOpen(true);

    try {
      const res = await fetch("/api/ai-put-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leastRisk: data.least_risk.slice(0, 4),
          mediumRisk: data.medium_risk.slice(0, 4),
          highRisk: data.high_risk.slice(0, 4),
          tickers: data.tickers_scanned,
        }),
      });

      if (!res.ok) throw new Error(`AI generation error ${res.status}`);
      const resJson = await res.json();
      if (resJson.strategy) {
        setAiStrategy(resJson.strategy);
      } else {
        throw new Error("No strategy returned");
      }
    } catch (e: any) {
      console.error("Error generating AI put strategy:", e);
      setAiError(e.message || "Failed to generate AI strategic allocation");
    } finally {
      setAiLoading(false);
    }
  };

  // Copy trade order to clipboard
  const handleCopyTrade = (item: RecommendedPut) => {
    const text = `SELL -1 ${item.ticker} 100 ${item.expiration} $${item.strike.toFixed(2)} PUT @ $${item.bid.toFixed(2)} LMT (POP: ${item.probability_of_profit}%, Ann Margin: ${item.annualized_return_margin.toFixed(1)}%, Cushion: ${item.cushion_to_strike_pct}%)`;
    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Current list filtered and sorted
  const currentList = useMemo(() => {
    if (!data) return [];
    let list: RecommendedPut[] = [];
    if (activeTierTab === "least_risk") list = [...data.least_risk];
    else if (activeTierTab === "medium_risk") list = [...data.medium_risk];
    else if (activeTierTab === "high_risk") list = [...data.high_risk];
    else list = [...data.all_recommendations];

    // Filter by ticker search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      list = list.filter((r) => r.ticker.includes(q) || r.contract_symbol.includes(q));
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === "score") return b.score - a.score;
      if (sortBy === "annual_margin") return b.annualized_return_margin - a.annualized_return_margin;
      if (sortBy === "annual_cash") return b.annualized_return_cash_secured - a.annualized_return_cash_secured;
      if (sortBy === "cushion") return b.cushion_to_strike_pct - a.cushion_to_strike_pct;
      if (sortBy === "pop") return b.probability_of_profit - a.probability_of_profit;
      if (sortBy === "theta") return b.daily_theta_decay - a.daily_theta_decay;
      return 0;
    });

    return list;
  }, [data, activeTierTab, searchQuery, sortBy]);

  // Generate payoff data for selected trade
  const payoffChartData = useMemo(() => {
    if (!selectedTrade) return [];
    const spot = selectedTrade.current_price;
    const strike = selectedTrade.strike;
    const premium = selectedTrade.bid;
    const qty = contractQuantity || 1;
    const maxProfit = premium * 100 * qty;

    const points: Array<{ price: number; pnl: number; isSpot?: boolean; isStrike?: boolean; isBreakeven?: boolean }> = [];
    const minPrice = Math.max(0.1, spot * 0.7);
    const maxPrice = spot * 1.15;
    const step = (maxPrice - minPrice) / 30;

    for (let p = minPrice; p <= maxPrice; p += step) {
      let pnl = maxProfit;
      if (p < strike) {
        pnl = (premium - (strike - p)) * 100 * qty;
      }
      points.push({
        price: Number(p.toFixed(2)),
        pnl: Number(pnl.toFixed(2)),
      });
    }

    // Ensure spot, strike, breakeven are covered
    const breakeven = strike - premium;
    points.push({ price: Number(breakeven.toFixed(2)), pnl: 0, isBreakeven: true });
    points.push({ price: Number(strike.toFixed(2)), pnl: maxProfit, isStrike: true });
    points.push({ price: Number(spot.toFixed(2)), pnl: maxProfit, isSpot: true });

    points.sort((a, b) => a.price - b.price);
    return points;
  }, [selectedTrade, contractQuantity]);

  return (
    <div className="space-y-6">
      {/* Hero Header & Control Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white font-display flex items-center gap-2">
                  Sell Put Options Recommender
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-medium">
                    3 Risk Tiers
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Quantitative put-selling recommendation engine categorized into <strong className="text-emerald-400">Least Risk</strong> (Deep OTM, 85%+ POP), <strong className="text-amber-400">Medium Risk</strong> (Sweet-Spot 70-85% POP), and <strong className="text-rose-400">High Risk</strong> (Aggressive High Yield).
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={generateAiStrategy}
              disabled={loading || !data}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-purple-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>AI Allocation Strategy</span>
            </button>

            <button
              onClick={fetchRecommendations}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs sm:text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>{loading ? "Evaluating Chains..." : "Run Recommendations"}</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-5 text-xs">
          {/* Universe Selector */}
          <div>
            <label className="block text-slate-400 font-medium mb-1.5 flex items-center justify-between">
              <span>Universe</span>
              <span className="text-[10px] font-mono text-cyan-400">
                {universe === "watchlist" ? `${watchlist.length} Tickers` : universe.toUpperCase()}
              </span>
            </label>
            <select
              value={universe}
              onChange={(e: any) => setUniverse(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs cursor-pointer font-medium"
            >
              <option value="watchlist">My Watchlist ({watchlist.length} tickers)</option>
              <option value="qqq">QQQ Tech Leaders (15 mega-caps)</option>
              <option value="spy">SPY Blue Chips (13 market leaders)</option>
              <option value="custom">Custom Tickers...</option>
            </select>
          </div>

          {/* Expiration Horizon */}
          <div>
            <label className="block text-slate-400 font-medium mb-1.5 flex items-center justify-between">
              <span>Expiration Horizon</span>
              <span className="text-[10px] font-mono text-slate-400">
                {dteRange.minDte}-{dteRange.maxDte} DTE
              </span>
            </label>
            <select
              value={horizon}
              onChange={(e: any) => setHorizon(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs cursor-pointer font-medium"
            >
              <option value="sweetspot">Sweet Spot (20 to 45 DTE - Optimal Theta)</option>
              <option value="weeklies">Weeklies (5 to 16 DTE - High Decay)</option>
              <option value="monthly">Monthly Standard (14 to 35 DTE)</option>
              <option value="extended">Extended (30 to 60 DTE - Safe Cushion)</option>
              <option value="all">All Horizons (6 to 65 DTE)</option>
            </select>
          </div>

          {/* Min Annual Return Slider */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-slate-400 font-medium">Min Annual Margin Return</label>
              <span className="text-emerald-400 font-bold font-mono">{minAnnualReturn}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={60}
              step={5}
              value={minAnnualReturn}
              onChange={(e) => setMinAnnualReturn(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
              <span>5%</span>
              <span>25%</span>
              <span>60%</span>
            </div>
          </div>

          {/* Min Bid Premium */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-slate-400 font-medium">Min Bid Premium</label>
              <span className="text-cyan-400 font-bold font-mono">${minBid.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.20}
              max={3.00}
              step={0.10}
              value={minBid}
              onChange={(e) => setMinBid(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
              <span>$0.20</span>
              <span>$1.50</span>
              <span>$3.00</span>
            </div>
          </div>

          {/* Sort By Selection */}
          <div>
            <label className="block text-slate-400 font-medium mb-1.5">Sort Output By</label>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs cursor-pointer font-medium"
            >
              <option value="annual_cash">Annualized Cash Yield % (Cash Secured - Default)</option>
              <option value="score">Composite Score (0-100 High-to-Low)</option>
              <option value="annual_margin">Annualized Margin Yield % (Portfolio Margin)</option>
              <option value="cushion">Downside Cushion % (Safest Strike)</option>
              <option value="pop">Probability of Profit (POP %)</option>
              <option value="theta">Daily Theta Decay ($/day/contract)</option>
            </select>
          </div>
        </div>

        {universe === "custom" && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center gap-3">
            <span className="text-slate-400 text-xs shrink-0">Tickers (comma separated):</span>
            <input
              type="text"
              value={customTickers}
              onChange={(e) => setCustomTickers(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              placeholder="e.g. NVDA, AAPL, MSFT, AMD, GOOGL"
            />
            <button
              onClick={fetchRecommendations}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchRecommendations} className="underline text-rose-400 font-bold ml-2">
            Retry
          </button>
        </div>
      )}

      {/* Risk Tiers Interactive Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Least Risk Card */}
          <div
            onClick={() => setActiveTierTab("least_risk")}
            className={`p-5 rounded-2xl border transition-all cursor-pointer ${
              activeTierTab === "least_risk"
                ? "bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/40"
                : "bg-slate-900/90 border-slate-800 hover:border-emerald-500/40 hover:bg-slate-900"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-white text-sm">Least Risk</h3>
                  <span className="text-[10px] text-emerald-400 font-mono">Conservative • 85%+ POP</span>
                </div>
              </div>
              <span className="text-2xl font-black text-emerald-400 font-mono">
                {data.tier_summaries.least_risk.count}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
              Deep OTM protection (Δ ≤ 0.15). Maximum cushion with low assignment probability.
            </p>

            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 font-mono text-[11px]">
              <div>
                <span className="text-slate-500 block text-[10px]">Avg POP</span>
                <span className="text-emerald-300 font-bold">{data.tier_summaries.least_risk.avg_pop}%</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Avg Cash Yield</span>
                <span className="text-emerald-400 font-bold">{data.tier_summaries.least_risk.avg_cash_return}%</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Avg Buffer</span>
                <span className="text-slate-200 font-bold">{data.tier_summaries.least_risk.avg_cushion}%</span>
              </div>
            </div>

            {data.tier_summaries.least_risk.top_pick && (
              <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Top Pick:</span>
                <span className="text-emerald-300 font-bold font-mono">
                  {data.tier_summaries.least_risk.top_pick.ticker} ${data.tier_summaries.least_risk.top_pick.strike}P ({data.tier_summaries.least_risk.top_pick.annualized_return_cash_secured}% cash / {data.tier_summaries.least_risk.top_pick.annualized_return_margin}% PM)
                </span>
              </div>
            )}
          </div>

          {/* Medium Risk Card */}
          <div
            onClick={() => setActiveTierTab("medium_risk")}
            className={`p-5 rounded-2xl border transition-all cursor-pointer ${
              activeTierTab === "medium_risk"
                ? "bg-amber-950/40 border-amber-500/60 shadow-lg shadow-amber-950/50 ring-1 ring-amber-500/40"
                : "bg-slate-900/90 border-slate-800 hover:border-amber-500/40 hover:bg-slate-900"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                  <Zap className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-white text-sm">Medium Risk</h3>
                  <span className="text-[10px] text-amber-400 font-mono">Balanced • 70-85% POP</span>
                </div>
              </div>
              <span className="text-2xl font-black text-amber-400 font-mono">
                {data.tier_summaries.medium_risk.count}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
              Optimal risk-adjusted theta harvest (Δ 0.16–0.30). The classic sweet spot for monthly options selling.
            </p>

            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 font-mono text-[11px]">
              <div>
                <span className="text-slate-500 block text-[10px]">Avg POP</span>
                <span className="text-amber-300 font-bold">{data.tier_summaries.medium_risk.avg_pop}%</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Avg Cash Yield</span>
                <span className="text-amber-400 font-bold">{data.tier_summaries.medium_risk.avg_cash_return}%</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Avg Buffer</span>
                <span className="text-slate-200 font-bold">{data.tier_summaries.medium_risk.avg_cushion}%</span>
              </div>
            </div>

            {data.tier_summaries.medium_risk.top_pick && (
              <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Top Pick:</span>
                <span className="text-amber-300 font-bold font-mono">
                  {data.tier_summaries.medium_risk.top_pick.ticker} ${data.tier_summaries.medium_risk.top_pick.strike}P ({data.tier_summaries.medium_risk.top_pick.annualized_return_cash_secured}% cash / {data.tier_summaries.medium_risk.top_pick.annualized_return_margin}% PM)
                </span>
              </div>
            )}
          </div>

          {/* High Risk Card */}
          <div
            onClick={() => setActiveTierTab("high_risk")}
            className={`p-5 rounded-2xl border transition-all cursor-pointer ${
              activeTierTab === "high_risk"
                ? "bg-rose-950/40 border-rose-500/60 shadow-lg shadow-rose-950/50 ring-1 ring-rose-500/40"
                : "bg-slate-900/90 border-slate-800 hover:border-rose-500/40 hover:bg-slate-900"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
                  <Flame className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-white text-sm">High Risk</h3>
                  <span className="text-[10px] text-rose-400 font-mono">Aggressive • High Yield</span>
                </div>
              </div>
              <span className="text-2xl font-black text-rose-400 font-mono">
                {data.tier_summaries.high_risk.count}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
              Maximum premium extraction (Δ &gt; 0.30) & elevated IV plays. For active accumulators and high yield seekers.
            </p>

            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 font-mono text-[11px]">
              <div>
                <span className="text-slate-500 block text-[10px]">Avg POP</span>
                <span className="text-rose-300 font-bold">{data.tier_summaries.high_risk.avg_pop}%</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Avg Cash Yield</span>
                <span className="text-rose-400 font-bold">{data.tier_summaries.high_risk.avg_cash_return}%</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Avg Buffer</span>
                <span className="text-slate-200 font-bold">{data.tier_summaries.high_risk.avg_cushion}%</span>
              </div>
            </div>

            {data.tier_summaries.high_risk.top_pick && (
              <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Top Pick:</span>
                <span className="text-rose-300 font-bold font-mono">
                  {data.tier_summaries.high_risk.top_pick.ticker} ${data.tier_summaries.high_risk.top_pick.strike}P ({data.tier_summaries.high_risk.top_pick.annualized_return_cash_secured}% cash / {data.tier_summaries.high_risk.top_pick.annualized_return_margin}% PM)
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tier Switcher Tabs & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md">
        {/* Tier Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none">
          <button
            onClick={() => setActiveTierTab("least_risk")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTierTab === "least_risk"
                ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Least Risk</span>
            {data && (
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                activeTierTab === "least_risk" ? "bg-emerald-600 text-emerald-100" : "bg-slate-800 text-emerald-400"
              }`}>
                {data.least_risk.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTierTab("medium_risk")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTierTab === "medium_risk"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Medium Risk</span>
            {data && (
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                activeTierTab === "medium_risk" ? "bg-amber-600 text-amber-100" : "bg-slate-800 text-amber-400"
              }`}>
                {data.medium_risk.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTierTab("high_risk")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTierTab === "high_risk"
                ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>High Risk</span>
            {data && (
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                activeTierTab === "high_risk" ? "bg-rose-600 text-rose-100" : "bg-slate-800 text-rose-400"
              }`}>
                {data.high_risk.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTierTab("all")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTierTab === "all"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Combined</span>
            {data && (
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                activeTierTab === "all" ? "bg-blue-700 text-blue-100" : "bg-slate-800 text-slate-400"
              }`}>
                {data.all_recommendations.length}
              </span>
            )}
          </button>
        </div>

        {/* Search & View Mode Switcher */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <input
              type="text"
              placeholder="Filter ticker (e.g. NVDA)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1.5 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-700">
            <button
              onClick={() => setViewMode("cards")}
              className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-all ${
                viewMode === "cards" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-all ${
                viewMode === "table" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="py-16 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-spin">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white font-display">
              Scanning Watchlist Options Chains & Computing Greeks...
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Running Black-Scholes risk modeling, OCC TIMS margin calculations, Wilder RSI(14) and 20d Bollinger support tests across active tickers.
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && currentList.length === 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <Info className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">No put option contracts matched current criteria</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Try adjusting your Min Bid (${minBid.toFixed(2)}), lowering the Min Annual Return ({minAnnualReturn}%), or selecting "All Horizons".
          </p>
          <button
            onClick={() => {
              setMinAnnualReturn(5);
              setMinBid(0.20);
              setHorizon("all");
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-xl mt-2 cursor-pointer"
          >
            Relax Screen Filters
          </button>
        </div>
      )}

      {/* CARDS VIEW */}
      {!loading && viewMode === "cards" && currentList.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {currentList.map((item) => {
            const isLeast = item.risk_tier === "least_risk";
            const isMed = item.risk_tier === "medium_risk";

            const tierBadgeColor = isLeast
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
              : isMed
              ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
              : "bg-rose-500/20 text-rose-300 border-rose-500/30";

            const scoreColor =
              item.score >= 80 ? "text-emerald-400 border-emerald-500/40 bg-emerald-950/40" :
              item.score >= 65 ? "text-amber-400 border-amber-500/40 bg-amber-950/40" :
              "text-cyan-400 border-cyan-500/40 bg-cyan-950/40";

            return (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all group"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between pb-3.5 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-white font-mono tracking-tight">
                          {item.ticker}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          Spot: ${item.current_price.toFixed(2)}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${tierBadgeColor}`}>
                          {item.risk_tier === "least_risk" ? "Least Risk" : item.risk_tier === "medium_risk" ? "Medium Risk" : "High Risk"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-300">
                        <span className="font-bold text-white font-mono text-sm">
                          ${item.strike.toFixed(2)} Strike
                        </span>
                        <span className="text-slate-500">•</span>
                        <span className="text-cyan-300 font-mono font-medium">
                          {item.expiration} ({item.dte} DTE)
                        </span>
                      </div>
                    </div>

                    {/* Composite Score Circle */}
                    <div className="text-right">
                      <div className={`px-2.5 py-1 rounded-xl border font-mono font-bold text-xs inline-flex items-center gap-1 shadow-inner ${scoreColor}`}>
                        <Target className="w-3.5 h-3.5" />
                        <span>Score {item.score}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {item.probability_of_profit}% POP
                      </div>
                    </div>
                  </div>

                    {/* Core Financial & Return Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3.5">
                    {/* Annualized Cash-Secured Yield (Default Primary) */}
                    <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block font-sans">Cash Yield (Ann)</span>
                      <span className="text-base font-black text-emerald-400 font-mono">
                        {item.annualized_return_cash_secured.toFixed(1)}%
                      </span>
                      <span className="text-[10px] text-slate-500 block font-mono">
                        Margin: {item.annualized_return_margin.toFixed(1)}%
                      </span>
                    </div>

                    {/* Premium / Contract */}
                    <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block font-sans">Premium Collect</span>
                      <span className="text-base font-black text-cyan-300 font-mono">
                        ${item.premium_per_contract.toFixed(0)}
                      </span>
                      <span className="text-[10px] text-slate-500 block font-mono">
                        Bid: ${item.bid.toFixed(2)} (Ask ${item.ask.toFixed(2)})
                      </span>
                    </div>

                    {/* Downside Safety Cushion */}
                    <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block font-sans">Downside Buffer</span>
                      <span className="text-base font-black text-slate-100 font-mono">
                        {item.cushion_to_strike_pct.toFixed(1)}%
                      </span>
                      <span className="text-[10px] text-slate-500 block font-mono">
                        Breakeven: ${item.breakeven_price.toFixed(2)}
                      </span>
                    </div>

                    {/* Daily Theta Decay */}
                    <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block font-sans">Daily Theta Decay</span>
                      <span className="text-base font-black text-amber-300 font-mono">
                        +${item.daily_theta_decay.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 block font-mono">
                        Δ {item.greeks.delta?.toFixed(2) || "N/A"}
                      </span>
                    </div>
                  </div>

                  {/* Strategy Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {item.strategy_flags.map((flag, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-300 border border-slate-700/80 font-medium"
                      >
                        {flag}
                      </span>
                    ))}
                    {item.technicals.rsi_14 !== null && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-md border font-mono ${
                        item.technicals.rsi_14 < 35
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                          : item.technicals.rsi_14 > 70
                          ? "bg-rose-500/10 text-rose-300 border-rose-500/20"
                          : "bg-slate-800/90 text-slate-300 border-slate-700/80"
                      }`}>
                        RSI: {item.technicals.rsi_14.toFixed(0)}
                      </span>
                    )}
                  </div>

                  {/* Quantitative Rationale */}
                  <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60 text-xs text-slate-300 leading-relaxed font-sans mb-3.5">
                    <p className="text-[11px] text-slate-300">
                      {item.rationale}
                    </p>
                  </div>
                </div>

                {/* Action Toolbar */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                    <span>Vol: {(item.volume || 0).toLocaleString()}</span>
                    <span>OI: {(item.open_interest || 0).toLocaleString()}</span>
                    <span>IV: {item.greeks.iv_pct.toFixed(0)}%</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyTrade(item)}
                      title="Copy execution text to clipboard"
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                    >
                      {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => {
                        setSelectedTrade(item);
                        setContractQuantity(1);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all cursor-pointer"
                    >
                      <span>Payoff Diagram</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TABLE VIEW */}
      {!loading && viewMode === "table" && currentList.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/90 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                  <th className="py-3 px-3.5 font-bold">Ticker / Spot</th>
                  <th className="py-3 px-3 font-bold">Strike</th>
                  <th className="py-3 px-3 font-bold">Expiration / DTE</th>
                  <th className="py-3 px-3 font-bold">Risk Tier</th>
                  <th className="py-3 px-3 font-bold">POP</th>
                  <th className="py-3 px-3 font-bold">Delta (Δ)</th>
                  <th className="py-3 px-3 font-bold">Bid (Ask)</th>
                  <th className="py-3 px-3 font-bold">Buffer %</th>
                  <th className="py-3 px-3 font-bold text-emerald-400">Cash Ann %</th>
                  <th className="py-3 px-3 font-bold text-slate-300">Margin Ann %</th>
                  <th className="py-3 px-3 font-bold text-amber-300">Theta/Day</th>
                  <th className="py-3 px-3 font-bold text-center">Score</th>
                  <th className="py-3 px-3.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {currentList.map((item) => {
                  const isLeast = item.risk_tier === "least_risk";
                  const isMed = item.risk_tier === "medium_risk";

                  const tierBadgeColor = isLeast
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : isMed
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    : "bg-rose-500/20 text-rose-300 border-rose-500/30";

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-white">{item.ticker}</div>
                        <div className="text-[10px] text-slate-400">${item.current_price.toFixed(2)}</div>
                      </td>
                      <td className="py-3 px-3 font-bold text-cyan-300 text-sm">
                        ${item.strike.toFixed(2)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-slate-200">{item.expiration}</div>
                        <div className="text-[10px] text-slate-400 font-sans">{item.dte} DTE</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${tierBadgeColor}`}>
                          {isLeast ? "Least" : isMed ? "Medium" : "High"}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-emerald-300">
                        {item.probability_of_profit}%
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {item.greeks.delta?.toFixed(2) || "N/A"}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-white">${item.bid.toFixed(2)}</span>
                        <span className="text-[10px] text-slate-500 ml-1">(${item.ask.toFixed(2)})</span>
                      </td>
                      <td className="py-3 px-3 text-slate-200 font-semibold">
                        {item.cushion_to_strike_pct.toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 font-black text-emerald-400 text-sm">
                        {item.annualized_return_cash_secured.toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 text-slate-400">
                        {item.annualized_return_margin.toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 text-amber-300 font-bold">
                        +${item.daily_theta_decay.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 bg-slate-950 rounded-lg border border-slate-700 text-cyan-300 font-bold text-xs">
                          {item.score}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleCopyTrade(item)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                            title="Copy trade"
                          >
                            {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedTrade(item);
                              setContractQuantity(1);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold cursor-pointer"
                          >
                            Payoff
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PAYOFF & POSITION SIZING MODAL */}
      {selectedTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-bold text-white font-mono">
                    {selectedTrade.ticker} ${selectedTrade.strike.toFixed(2)} PUT
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                    {selectedTrade.expiration} ({selectedTrade.dte} DTE)
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Spot: ${selectedTrade.current_price.toFixed(2)} • Breakeven: ${selectedTrade.breakeven_price.toFixed(2)} ({selectedTrade.cushion_to_breakeven_pct}% safety cushion)
                </p>
              </div>
              <button
                onClick={() => setSelectedTrade(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Position Sizer */}
            <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-xs font-semibold text-slate-300">Contract Quantity:</span>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 5, 10].map((qty) => (
                    <button
                      key={qty}
                      onClick={() => setContractQuantity(qty)}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-bold cursor-pointer transition-all ${
                        contractQuantity === qty
                          ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      {qty}x
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={contractQuantity}
                    onChange={(e) => setContractQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-center font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-5 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px]">Total Premium</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    ${(selectedTrade.bid * 100 * contractQuantity).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Est. Margin Collateral</span>
                  <span className="text-slate-200 font-bold text-sm">
                    {formatCurrency(selectedTrade.capital_basis_margin * contractQuantity)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Daily Theta</span>
                  <span className="text-amber-300 font-bold text-sm">
                    +${(selectedTrade.daily_theta_decay * contractQuantity).toFixed(2)}/day
                  </span>
                </div>
              </div>
            </div>

            {/* Payoff Chart */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Expiration Payoff Profile ({contractQuantity} contracts)
                </span>
                <span className="text-[11px] font-mono">
                  Max Profit: <strong className="text-emerald-400">${(selectedTrade.bid * 100 * contractQuantity).toFixed(2)}</strong> (Above ${selectedTrade.strike.toFixed(2)})
                </span>
              </div>

              <div className="h-64 bg-slate-950 rounded-xl p-3 border border-slate-800/80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={payoffChartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="price"
                      stroke="#64748b"
                      fontSize={11}
                      fontFamily="monospace"
                      tickFormatter={(val) => `$${val}`}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      fontFamily="monospace"
                      tickFormatter={(val) => `$${val}`}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const d: any = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs font-mono text-slate-200">
                            <div className="text-slate-400">Stock Price: ${d.price.toFixed(2)}</div>
                            <div className={`font-bold mt-1 text-sm ${d.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              P&L: {d.pnl >= 0 ? `+$${d.pnl.toFixed(2)}` : `-$${Math.abs(d.pnl).toFixed(2)}`}
                            </div>
                            {d.isSpot && <div className="text-cyan-400 text-[10px] mt-1">★ Current Spot Price</div>}
                            {d.isStrike && <div className="text-amber-400 text-[10px] mt-1">★ Strike Price</div>}
                            {d.isBreakeven && <div className="text-rose-400 text-[10px] mt-1">★ Breakeven Level</div>}
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                    <ReferenceLine x={selectedTrade.current_price} stroke="#38bdf8" strokeDasharray="3 3" label={{ value: "Spot", fill: "#38bdf8", fontSize: 10, position: "top" }} />
                    <ReferenceLine x={selectedTrade.strike} stroke="#fbbf24" strokeDasharray="3 3" label={{ value: "Strike", fill: "#fbbf24", fontSize: 10, position: "top" }} />
                    <ReferenceLine x={selectedTrade.breakeven_price} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: "Breakeven", fill: "#f43f5e", fontSize: 10, position: "bottom" }} />
                    <Line
                      type="monotone"
                      dataKey="pnl"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Order Copy & Details */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                onClick={() => handleCopyTrade(selectedTrade)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                {copiedId === selectedTrade.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedId === selectedTrade.id ? "Trade Alert Copied!" : "Copy Order Text"}</span>
              </button>

              <button
                onClick={() => setSelectedTrade(null)}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                Close Payoff Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI PORTFOLIO ALLOCATION STRATEGY MODAL */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* AI Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-display">
                    AI Watchlist Put-Selling Portfolio Strategy
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Powered by Gemini 2.5 • Institutional Volatility Structuring
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAiModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {aiLoading && (
              <div className="py-16 text-center space-y-3">
                <div className="inline-flex p-3 rounded-full bg-purple-500/20 text-purple-300 animate-pulse">
                  <Sparkles className="w-6 h-6 animate-spin" />
                </div>
                <h4 className="text-sm font-bold text-white">Synthesizing 3-Tier Allocation Strategy...</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Analyzing current implied volatility regimes, probability distributions, and technical support levels across your watchlist.
                </p>
              </div>
            )}

            {aiError && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-300 text-xs">
                <span>{aiError}</span>
              </div>
            )}

            {!aiLoading && aiStrategy && (
              <div className="space-y-5 text-xs text-slate-200">
                {/* Market Regime Banner */}
                <div className="bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900 border border-purple-500/30 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300 font-mono">
                      Market Volatility Regime
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/40 font-mono font-bold text-[10px]">
                      {aiStrategy.market_regime}
                    </span>
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    {aiStrategy.executive_summary}
                  </p>
                </div>

                {/* Recommended Allocation Split */}
                <div className="space-y-2">
                  <h4 className="font-bold text-white font-sans text-xs flex items-center gap-1.5">
                    <PieChartIcon className="w-4 h-4 text-cyan-400" />
                    Recommended Capital Allocation Across Risk Tiers
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                    <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-3 text-center">
                      <span className="text-[10px] text-emerald-400 block uppercase">Least Risk</span>
                      <span className="text-xl font-black text-emerald-300">{aiStrategy.allocation.least_risk_pct}%</span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">Core Foundation</span>
                    </div>

                    <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3 text-center">
                      <span className="text-[10px] text-amber-400 block uppercase">Medium Risk</span>
                      <span className="text-xl font-black text-amber-300">{aiStrategy.allocation.medium_risk_pct}%</span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">Theta Engine</span>
                    </div>

                    <div className="bg-rose-950/30 border border-rose-500/40 rounded-xl p-3 text-center">
                      <span className="text-[10px] text-rose-400 block uppercase">High Risk</span>
                      <span className="text-xl font-black text-rose-300">{aiStrategy.allocation.high_risk_pct}%</span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">Tactical Yield</span>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                      <span className="text-[10px] text-slate-400 block uppercase">Dry Powder / Buffer</span>
                      <span className="text-xl font-black text-slate-200">{aiStrategy.allocation.cash_reserve_pct}%</span>
                      <span className="text-[9px] text-slate-500 block mt-0.5">Margin Reserve</span>
                    </div>
                  </div>
                </div>

                {/* Tier-by-Tier Guidance */}
                <div className="space-y-2">
                  <h4 className="font-bold text-white font-sans text-xs">Tier Strategic Profiles</h4>
                  <div className="space-y-2 text-[11px]">
                    <div className="bg-slate-950/80 rounded-lg p-3 border border-emerald-500/30">
                      <strong className="text-emerald-400 font-mono block mb-1">🟢 Least Risk Strategy:</strong>
                      <span className="text-slate-300 leading-relaxed">{aiStrategy.tier_guidance.least_risk_rationale}</span>
                    </div>
                    <div className="bg-slate-950/80 rounded-lg p-3 border border-amber-500/30">
                      <strong className="text-amber-400 font-mono block mb-1">🟡 Medium Risk Strategy:</strong>
                      <span className="text-slate-300 leading-relaxed">{aiStrategy.tier_guidance.medium_risk_rationale}</span>
                    </div>
                    <div className="bg-slate-950/80 rounded-lg p-3 border border-rose-500/30">
                      <strong className="text-rose-400 font-mono block mb-1">🔴 High Risk Strategy:</strong>
                      <span className="text-slate-300 leading-relaxed">{aiStrategy.tier_guidance.high_risk_rationale}</span>
                    </div>
                  </div>
                </div>

                {/* Specific Trade Recommendations */}
                {aiStrategy.recommended_trades && aiStrategy.recommended_trades.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-bold text-white font-sans text-xs">Model Actionable Picks</h4>
                    <div className="space-y-2">
                      {aiStrategy.recommended_trades.map((trade, i) => (
                        <div key={i} className="bg-slate-950 rounded-xl p-3 border border-slate-800 space-y-1">
                          <div className="flex items-center justify-between font-mono">
                            <span className="font-bold text-white text-xs">
                              {trade.ticker} ${trade.strike}P • {trade.expiration}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                              {trade.tier}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300">{trade.action_thesis}</p>
                          <p className="text-[10px] text-slate-500 font-mono">Risk / Catalyst: {trade.catalyst_or_risk}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risk Management Rules */}
                <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 space-y-1.5">
                  <h4 className="font-bold text-amber-300 font-sans text-xs">Essential Risk Management Protocols</h4>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300">
                    {aiStrategy.risk_rules.map((rule, idx) => (
                      <li key={idx}>{rule}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-800 text-right">
              <button
                onClick={() => setAiModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-purple-600/20"
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default PutRecommendationsViewer;
