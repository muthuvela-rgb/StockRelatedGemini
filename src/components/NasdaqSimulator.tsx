import React, { useState, useEffect, useMemo } from "react";
import {
  Play,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Layers,
  PieChart,
  BarChart2,
  Code,
  Download,
  Copy,
  Check,
  Info,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
  Brush,
} from "recharts";
import { NasdaqSimulationResult, RebalanceEvent } from "../types";

export const NasdaqSimulator: React.FC = () => {
  // Simulator input parameters
  const [universeSelection, setUniverseSelection] = useState<string>("top-10");
  const [initialAmount, setInitialAmount] = useState<number>(100000);
  const [rebalanceMonths, setRebalanceMonths] = useState<number>(3);
  const [years, setYears] = useState<number>(3);
  const [rebalanceMode, setRebalanceMode] = useState<"target-reset" | "nasdaq-capped">("target-reset");

  // Derived cohort parameters
  const isBottom = universeSelection.startsWith("bottom-");
  const topN = parseInt(universeSelection.split("-")[1], 10) || 10;

  // Simulation state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NasdaqSimulationResult | null>(null);

  // Active view tab inside simulator
  const [viewTab, setViewTab] = useState<"charts" | "constituents" | "rebalances" | "script">("charts");

  // Python modal / script copy state
  const [isScriptModalOpen, setIsScriptModalOpen] = useState<boolean>(false);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  // Expandable rebalance row in audit table
  const [expandedRebalanceIdx, setExpandedRebalanceIdx] = useState<number | null>(null);

  // Fetch simulation with optional instant override parameters
  const runSimulation = async (overrides?: {
    initialAmount?: number;
    universeSelection?: string;
    topN?: number;
    rebalanceMonths?: number;
    years?: number;
    rebalanceMode?: "target-reset" | "nasdaq-capped";
  }) => {
    const effAmount = overrides?.initialAmount !== undefined ? overrides.initialAmount : initialAmount;
    const effUniverse = overrides?.universeSelection !== undefined ? overrides.universeSelection : universeSelection;
    const effTopN = overrides?.topN !== undefined ? overrides.topN : (parseInt(effUniverse.split("-")[1], 10) || 10);
    const effModeSelection = effUniverse.startsWith("bottom-") ? "bottom" : "top";
    const effRebal = overrides?.rebalanceMonths !== undefined ? overrides.rebalanceMonths : rebalanceMonths;
    const effYears = overrides?.years !== undefined ? overrides.years : years;
    const effMode = overrides?.rebalanceMode !== undefined ? overrides.rebalanceMode : rebalanceMode;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backtest/nasdaq-market-cap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initialAmount: effAmount,
          topN: effTopN,
          selectionMode: effModeSelection,
          universeSelection: effUniverse,
          rebalanceMonths: effRebal,
          years: effYears,
          rebalanceMode: effMode,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to execute backtest simulation.");
      }
      setResult(data.result);
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred while running the simulation.");
    } finally {
      setLoading(false);
    }
  };

  // Run automatically on first mount
  useEffect(() => {
    runSimulation();
  }, []);

  const handleCopyScript = () => {
    if (!result?.pythonScript) return;
    navigator.clipboard.writeText(result.pythonScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const handleDownloadScript = () => {
    const effMode = universeSelection.startsWith("bottom-") ? "bottom" : "top";
    const effCount = parseInt(universeSelection.split("-")[1], 10) || 10;
    const url = `/api/backtest/nasdaq-script?initialAmount=${initialAmount}&topN=${effCount}&selectionMode=${effMode}&universeSelection=${universeSelection}&rebalanceMonths=${rebalanceMonths}&years=${years}&rebalanceMode=${rebalanceMode}&download=true`;
    window.open(url, "_blank");
  };

  // Format currency helpers
  const fmtCurr = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  const fmtCurrPrecise = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

  // Quick preset amount selections
  const PRESET_AMOUNTS = [10000, 25000, 50000, 100000, 250000, 1000000];

  return (
    <div className="space-y-6 pb-16">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                <BarChart2 className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
                  Nasdaq Market-Cap Rebalancing Simulator
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                    Backtest Engine
                  </span>
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Simulate portfolio returns invested proportionately by market capitalization in top Nasdaq companies with periodic reallocations.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsScriptModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition flex items-center gap-2 shadow-sm"
            >
              <Code className="w-4 h-4 text-emerald-400" />
              Standalone Python Script
            </button>
            <button
              onClick={() => runSimulation()}
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition flex items-center gap-2 shadow-lg shadow-emerald-950"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              {loading ? "Simulating..." : "Run Simulation"}
            </button>
          </div>
        </div>

        {/* Informational Summary Tagline */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Weighting model: <strong>Proportional to Market Cap</strong> • Dynamic capitalization drift calculated daily • Benchmarked against <strong>QQQ</strong> (Nasdaq-100) & <strong>SPY</strong> (S&P 500).
            </span>
          </div>
          {result && (
            <div className="text-slate-500 font-mono text-[11px]">
              Active Period: {result.params.startDate} to {result.params.endDate} ({result.equityCurve.length} Trading Days)
            </div>
          )}
        </div>
      </div>

      {/* Control Panel Parameters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* 1. Initial Investment */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              Initial Investment ($)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-500 text-sm">$</span>
              <input
                type="number"
                min={1000}
                step={1000}
                value={initialAmount}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setInitialAmount(val);
                }}
                onBlur={() => runSimulation()}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => {
                    setInitialAmount(amt);
                    runSimulation({ initialAmount: amt });
                  }}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-mono transition ${
                    initialAmount === amt
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-slate-800/80 hover:bg-slate-800 text-slate-400 border border-slate-700/60"
                  }`}
                >
                  ${amt >= 1000000 ? `${amt / 1000000}M` : `${amt / 1000}k`}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Constituent Universe (Top / Bottom) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                Constituent Universe
              </label>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full font-sans ${
                  isBottom
                    ? "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                    : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                }`}
              >
                {isBottom ? `Bottom ${topN}` : `Top ${topN}`}
              </span>
            </div>
            <select
              value={universeSelection}
              onChange={(e) => {
                const val = e.target.value;
                setUniverseSelection(val);
                runSimulation({ universeSelection: val });
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <optgroup label="Top Mega-Cap Constituents">
                <option value="top-5">Top 5 Largest Nasdaq Stocks</option>
                <option value="top-10">Top 10 Largest Nasdaq Stocks (Default)</option>
                <option value="top-15">Top 15 Largest Nasdaq Stocks</option>
                <option value="top-20">Top 20 Largest Nasdaq Stocks</option>
                <option value="top-25">Top 25 Largest Nasdaq Stocks</option>
                <option value="top-30">Top 30 Largest Nasdaq Stocks</option>
                <option value="top-50">Top 50 Largest Nasdaq Stocks</option>
              </optgroup>
              <optgroup label="Bottom Constituents (Smallest in Nasdaq-100)">
                <option value="bottom-5">Bottom 5 Smallest Nasdaq-100 Stocks</option>
                <option value="bottom-10">Bottom 10 Smallest Nasdaq-100 Stocks</option>
                <option value="bottom-15">Bottom 15 Smallest Nasdaq-100 Stocks</option>
                <option value="bottom-20">Bottom 20 Smallest Nasdaq-100 Stocks</option>
              </optgroup>
            </select>

            {/* Quick Cohort Selectors */}
            <div className="space-y-1 pt-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-medium w-12">Top:</span>
                <div className="flex flex-wrap gap-1">
                  {[5, 10, 15, 20, 50].map((n) => (
                    <button
                      key={`top-${n}`}
                      onClick={() => {
                        const val = `top-${n}`;
                        setUniverseSelection(val);
                        runSimulation({ universeSelection: val });
                      }}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono transition ${
                        universeSelection === `top-${n}`
                          ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 font-bold"
                          : "bg-slate-800/80 hover:bg-slate-800 text-slate-400 border border-slate-700/60"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-purple-400 font-medium w-12">Bottom:</span>
                <div className="flex flex-wrap gap-1">
                  {[5, 10, 15, 20].map((n) => (
                    <button
                      key={`bottom-${n}`}
                      onClick={() => {
                        const val = `bottom-${n}`;
                        setUniverseSelection(val);
                        runSimulation({ universeSelection: val });
                      }}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono transition ${
                        universeSelection === `bottom-${n}`
                          ? "bg-purple-500/25 text-purple-200 border border-purple-500/50 font-bold"
                          : "bg-slate-800/80 hover:bg-slate-800 text-purple-400/80 border border-purple-500/30"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              {isBottom
                ? "Smallest Nasdaq-100 components by market cap (CPRT, GEHC, ALNY, DXCM, AXON...)"
                : "Largest mega-caps by market cap (NVDA, AAPL, GOOGL, MSFT, AMZN...)"}
            </p>
          </div>

          {/* 3. Rebalance Frequency */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                Rebalance Frequency
              </span>
              {result && (
                <span className="text-[11px] text-emerald-400 font-mono">
                  {result.metrics.totalRebalances} rebalance{result.metrics.totalRebalances === 1 ? "" : "s"}
                </span>
              )}
            </label>
            <select
              value={rebalanceMonths}
              onChange={(e) => {
                const val = Number(e.target.value);
                setRebalanceMonths(val);
                runSimulation({ rebalanceMonths: val });
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value={1}>Every 1 Month (Monthly - 12x/yr)</option>
              <option value={2}>Every 2 Months (Bi-Monthly - 6x/yr)</option>
              <option value={3}>Every 3 Months (Quarterly - 4x/yr Default)</option>
              <option value={6}>Every 6 Months (Semi-Annually - 2x/yr)</option>
              <option value={12}>Every 12 Months (Annually - 1x/yr)</option>
            </select>
            <p className="text-[11px] text-slate-500">
              Re-allocates back to target weights every {rebalanceMonths} month{rebalanceMonths > 1 ? "s" : ""}; trims gainers and buys laggards.
            </p>
          </div>

          {/* 4. Lookback Duration */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ClockIcon className="w-3.5 h-3.5 text-emerald-400" />
              Backtest Horizon (Years)
            </label>
            <select
              value={years}
              onChange={(e) => {
                const val = Number(e.target.value);
                setYears(val);
                runSimulation({ years: val });
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value={1}>Last 1 Year</option>
              <option value={2}>Last 2 Years</option>
              <option value={3}>Last 3 Years (Default)</option>
              <option value={5}>Last 5 Years</option>
              <option value={7}>Last 7 Years</option>
              <option value={10}>Last 10 Years</option>
            </select>
            <p className="text-[11px] text-slate-500">
              Historical trading daily bars retrieved from market close records.
            </p>
          </div>
        </div>

        {/* Methodology Toggle */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Reallocation Methodology:</span>
            <div className="inline-flex p-1 bg-slate-950 border border-slate-800 rounded-xl">
              <button
                onClick={() => {
                  setRebalanceMode("target-reset");
                  runSimulation({ rebalanceMode: "target-reset" });
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  rebalanceMode === "target-reset"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Target Market-Cap Reset (Standard)
              </button>
              <button
                onClick={() => {
                  setRebalanceMode("nasdaq-capped");
                  runSimulation({ rebalanceMode: "nasdaq-capped" });
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  rebalanceMode === "nasdaq-capped"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Nasdaq-100 Capped (14% Max Cap)
              </button>
            </div>
          </div>
          <div className="text-slate-400 font-mono text-[11px]">
            {rebalanceMode === "target-reset"
              ? "Re-weights constituents back to market-cap baseline at each interval."
              : "Constrains maximum single-stock weight to 14%, matching official Nasdaq-100 rules."}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-2xl p-4 text-xs flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <strong className="font-semibold">Simulation Error:</strong> {error}
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !result && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center shadow-xl space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin mx-auto" />
          <div>
            <h3 className="text-base font-semibold text-white">Running Nasdaq Historical Backtest...</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Downloading historical daily prices for {isBottom ? `bottom ${topN} smallest` : `top ${topN} largest`} Nasdaq-100 stocks, calculating market cap drift, and executing periodic rebalance schedules.
            </p>
          </div>
        </div>
      )}

      {/* Performance Metric Cards */}
      {result && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Ending Value & Net Profit */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>Ending Strategy Value</span>
              <span className={`font-semibold flex items-center ${result.metrics.totalGain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {result.metrics.totalGain >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {fmtPct(result.metrics.totalReturnPct)}
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              {fmtCurr(result.metrics.endingValue)}
            </div>
            <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between pt-2 border-t border-slate-800/80 font-mono">
              <span>vs Buy & Hold:</span>
              <span className={(result.metrics.endingValue - (result.metrics.buyAndHoldEndingValue || 0)) >= 0 ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
                {(result.metrics.endingValue - (result.metrics.buyAndHoldEndingValue || 0)) >= 0 ? "+" : ""}{fmtCurr(result.metrics.endingValue - (result.metrics.buyAndHoldEndingValue || 0))}
              </span>
            </div>
          </div>

          {/* Card 2: Annualized Return (CAGR) vs Benchmarks */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 shadow-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>Annualized Return (CAGR)</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                {result.metrics.cagrPct.toFixed(2)}% / yr
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-white tracking-tight flex items-baseline gap-2">
              {fmtPct(result.metrics.cagrPct)}
            </div>
            <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between pt-2 border-t border-slate-800/80 font-mono">
              <span>Buy & Hold: <strong className="text-slate-300">{fmtPct(result.metrics.buyAndHoldCagrPct || 0)}</strong></span>
              <span>QQQ: <strong className="text-indigo-400">{fmtPct(result.metrics.qqqCagrPct)}</strong></span>
            </div>
          </div>

          {/* Card 3: Risk-Adjusted Return (Sharpe & Sortino) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 shadow-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>Risk-Adjusted Ratios</span>
              <span className="text-[11px] text-slate-400">Rf = 4.0%</span>
            </div>
            <div className="text-2xl font-bold font-mono text-white tracking-tight flex items-baseline gap-2">
              {result.metrics.sharpeRatio.toFixed(2)}
              <span className="text-xs text-slate-400 font-normal">Sharpe</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between pt-2 border-t border-slate-800/80 font-mono">
              <span>Sortino: <strong className="text-slate-200">{result.metrics.sortinoRatio.toFixed(2)}</strong></span>
              <span>Ann. Vol: <strong className="text-slate-200">{result.metrics.annualizedVolatilityPct.toFixed(1)}%</strong></span>
            </div>
          </div>

          {/* Card 4: Max Drawdown & Turnover */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 shadow-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>Maximum Drawdown</span>
              <span className="text-rose-400 text-xs font-semibold">Peak-to-Trough</span>
            </div>
            <div className="text-2xl font-bold font-mono text-rose-400 tracking-tight">
              {result.metrics.maxDrawdownPct.toFixed(1)}%
            </div>
            <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between pt-2 border-t border-slate-800/80 font-mono">
              <span>Rebalances: <strong className="text-emerald-400">{result.metrics.totalRebalances}</strong></span>
              <span>Turnover: <strong className="text-slate-200">{fmtCurr(result.metrics.cumulativeTurnover)}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Main Analysis Views (Tabs) */}
      {result && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Sub Navigation Bar */}
          <div className="p-3 border-b border-slate-800 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setViewTab("charts")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  viewTab === "charts"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Performance Charts
              </button>

              <button
                onClick={() => setViewTab("constituents")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  viewTab === "constituents"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <PieChart className="w-3.5 h-3.5" />
                Constituents & Weights ({result.constituents.length})
              </button>

              <button
                onClick={() => setViewTab("rebalances")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  viewTab === "rebalances"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Rebalance Log ({result.rebalanceEvents.length})
              </button>

              <button
                onClick={() => setViewTab("script")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  viewTab === "script"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                Python Script
              </button>
            </div>

            {/* Quick Benchmark Comparison Pills */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Rebalanced: {fmtPct(result.metrics.totalReturnPct)}
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Buy & Hold: {fmtPct(result.metrics.buyAndHoldTotalReturnPct || 0)}
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                QQQ: {fmtPct(result.metrics.qqqTotalReturnPct)}
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                SPY: {fmtPct(result.metrics.spyTotalReturnPct)}
              </span>
            </div>
          </div>

          {/* VIEW TAB 1: CHARTS */}
          {viewTab === "charts" && (
            <div className="p-6 space-y-6">
              {/* Equity Curve Chart */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Portfolio Growth vs Benchmarks</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Tracking growth of ${initialAmount.toLocaleString()} initial capital under periodic market-cap rebalancing.
                    </p>
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    Strategy Alpha:{" "}
                    <strong className={result.metrics.alphaPct >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      {fmtPct(result.metrics.alphaPct)}
                    </strong>{" "}
                    • Beta: <strong className="text-slate-200">{result.metrics.beta.toFixed(2)}</strong>
                  </div>
                </div>

                <div className="h-80 w-full bg-slate-950/60 rounded-xl p-3 border border-slate-800">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={result.equityCurve} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="date"
                        stroke="#64748b"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(d) => {
                          const parts = d.split("-");
                          return `${parts[1]}/${parts[0]?.slice(2)}`;
                        }}
                      />
                      <YAxis
                        stroke="#64748b"
                        domain={["auto", "auto"]}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "#334155",
                          borderRadius: "0.75rem",
                          fontSize: "12px",
                        }}
                        formatter={(value: any, name: any) => [
                          fmtCurrPrecise(Number(value)),
                          name === "portfolioValue"
                            ? `${result.params.selectionMode === "bottom" ? "Bottom" : "Top"} ${result.params.topN} Rebalanced`
                            : name === "buyAndHoldValue"
                            ? "Buy & Hold (No Rebalance)"
                            : name === "qqqValue"
                            ? "QQQ Benchmark"
                            : "SPY Benchmark",
                        ]}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Legend
                        verticalAlign="top"
                        height={36}
                        formatter={(val) => {
                          if (val === "portfolioValue") return `Rebalanced Strategy (${fmtCurr(result.metrics.endingValue)})`;
                          if (val === "buyAndHoldValue") return `Buy & Hold (${fmtCurr(result.metrics.buyAndHoldEndingValue || 0)})`;
                          if (val === "qqqValue") return `QQQ ETF (${fmtCurr(result.metrics.qqqEndingValue)})`;
                          if (val === "spyValue") return `SPY ETF (${fmtCurr(result.metrics.spyEndingValue)})`;
                          return val;
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="portfolioValue"
                        name="portfolioValue"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={false}
                      />
                      {result.equityCurve[0]?.buyAndHoldValue !== undefined && (
                        <Line
                          type="monotone"
                          dataKey="buyAndHoldValue"
                          name="buyAndHoldValue"
                          stroke="#94a3b8"
                          strokeWidth={1.8}
                          strokeDasharray="4 4"
                          dot={false}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="qqqValue"
                        name="qqqValue"
                        stroke="#6366f1"
                        strokeWidth={1.8}
                        strokeDasharray="4 4"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="spyValue"
                        name="spyValue"
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        strokeDasharray="2 2"
                        dot={false}
                      />
                      {result.equityCurve.length > 5 && (
                        <Brush
                          dataKey="date"
                          height={20}
                          stroke="#38bdf8"
                          fill="#090d16"
                          travellerWidth={8}
                          tickFormatter={(d) => {
                            const parts = d.split("-");
                            return `${parts[1]}/${parts[0]?.slice(2)}`;
                          }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Drawdown Chart */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Historical Portfolio Drawdown (%)
                  </h4>
                  <span className="text-xs font-mono text-rose-400 font-semibold">
                    Max Drawdown: {result.metrics.maxDrawdownPct.toFixed(2)}%
                  </span>
                </div>
                <div className="h-36 w-full bg-slate-950/60 rounded-xl p-3 border border-slate-800">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={result.equityCurve} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="date"
                        stroke="#64748b"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(d) => {
                          const parts = d.split("-");
                          return `${parts[1]}/${parts[0]?.slice(2)}`;
                        }}
                      />
                      <YAxis
                        stroke="#64748b"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => `${v}%`}
                        domain={["dataMin", 0]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "#334155",
                          borderRadius: "0.5rem",
                          fontSize: "11px",
                        }}
                        formatter={(value: any) => [`${Number(value).toFixed(2)}%`, "Drawdown"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="drawdownPct"
                        stroke="#f43f5e"
                        fill="#f43f5e"
                        fillOpacity={0.25}
                      />
                      {result.equityCurve.length > 5 && (
                        <Brush
                          dataKey="date"
                          height={18}
                          stroke="#f43f5e"
                          fill="#090d16"
                          travellerWidth={8}
                          tickFormatter={(d) => {
                            const parts = d.split("-");
                            return `${parts[1]}/${parts[0]?.slice(2)}`;
                          }}
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* VIEW TAB 2: CONSTITUENTS & ALLOCATIONS */}
          {viewTab === "constituents" && (
            <div>
              <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      result.params.selectionMode === "bottom"
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    }`}
                  >
                    {result.params.universeName || `${result.params.selectionMode === "bottom" ? "Bottom" : "Top"} ${result.params.topN} Universe`}
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">
                    {result.constituents.length} active constituents weighted by market cap
                  </span>
                </div>
                <div className="text-slate-400 font-mono text-[11px]">
                  Total Basket Market Cap: ${(result.constituents.reduce((acc, s) => acc + s.marketCap, 0) >= 1000 ? `${(result.constituents.reduce((acc, s) => acc + s.marketCap, 0) / 1000).toFixed(2)}T` : `${result.constituents.reduce((acc, s) => acc + s.marketCap, 0).toFixed(1)}B`)}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Rank / Ticker</th>
                    <th className="py-3 px-4">Company & Sector</th>
                    <th className="py-3 px-4 text-right">Est. Market Cap</th>
                    <th className="py-3 px-4 text-right">Start Weight</th>
                    <th className="py-3 px-4 text-right">End Weight</th>
                    <th className="py-3 px-4 text-right">Start Price</th>
                    <th className="py-3 px-4 text-right">End Price</th>
                    <th className="py-3 px-4 text-right">Return %</th>
                    <th className="py-3 px-4 text-right">Dollar P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {result.constituents.map((stock, i) => (
                    <tr key={stock.ticker} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-bold font-sans">
                            {i + 1}
                          </span>
                          <span className="font-bold text-white text-sm font-sans">{stock.ticker}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <div className="text-slate-200 font-medium">{stock.name}</div>
                        <div className="text-[10px] text-slate-500">{stock.sector}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-200">
                        ${stock.marketCap >= 1000 ? `${(stock.marketCap / 1000).toFixed(2)}T` : `${stock.marketCap.toFixed(1)}B`}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400">
                        {stock.initialWeightPct.toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-400">
                        {stock.endingWeightPct.toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400">
                        ${stock.startPrice.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-200">
                        ${stock.endPrice.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        <span className={stock.returnPct >= 0 ? "text-emerald-400" : "text-rose-400"}>
                          {fmtPct(stock.returnPct)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        <span className={stock.dollarContribution >= 0 ? "text-emerald-400" : "text-rose-400"}>
                          {stock.dollarContribution >= 0 ? "+" : ""}{fmtCurr(stock.dollarContribution)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          )}

          {/* VIEW TAB 3: REBALANCE SCHEDULE AUDIT */}
          {viewTab === "rebalances" && (
            <div className="p-4 space-y-3">
              <div className="text-xs text-slate-400 mb-2 flex items-center justify-between">
                <span>
                  Total Rebalancing Iterations: <strong>{result.rebalanceEvents.length}</strong> (Reallocated every {rebalanceMonths} months)
                </span>
                <span className="font-mono text-slate-400">
                  Total Turnover: <strong>{fmtCurr(result.metrics.cumulativeTurnover)}</strong>
                </span>
              </div>

              <div className="space-y-2">
                {result.rebalanceEvents.map((evt, idx) => {
                  const isExpanded = expandedRebalanceIdx === idx;
                  return (
                    <div
                      key={evt.date}
                      className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden transition"
                    >
                      <div
                        onClick={() => setExpandedRebalanceIdx(isExpanded ? null : idx)}
                        className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold font-mono">
                            #{evt.periodIndex}
                          </span>
                          <div>
                            <div className="text-xs font-bold text-white font-mono flex items-center gap-2">
                              {evt.date}
                              <span className="text-[11px] font-normal text-slate-400 font-sans">
                                (Quarter / Cycle Reallocation)
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Portfolio Value at Checkpoint: <strong className="text-slate-300 font-mono">{fmtCurr(evt.portfolioValue)}</strong>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-mono">
                          <div className="text-right">
                            <span className="text-slate-400">Turnover: </span>
                            <span className="text-slate-200 font-semibold">{fmtCurr(evt.turnoverAmount)}</span>
                            <span className="text-[10px] text-slate-500 ml-1">({evt.turnoverPct}%)</span>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-slate-800/80 p-3 bg-slate-900/60 overflow-x-auto">
                          <table className="w-full text-left text-[11px] text-slate-300 font-mono">
                            <thead>
                              <tr className="text-slate-500 border-b border-slate-800">
                                <th className="pb-1.5">Ticker</th>
                                <th className="pb-1.5">Action</th>
                                <th className="pb-1.5 text-right">Price</th>
                                <th className="pb-1.5 text-right">Prev Shares</th>
                                <th className="pb-1.5 text-right">New Shares</th>
                                <th className="pb-1.5 text-right">Target Weight</th>
                                <th className="pb-1.5 text-right">Trade Dollar</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/40">
                              {evt.trades.map((tr) => (
                                <tr key={tr.ticker} className="hover:bg-slate-800/30">
                                  <td className="py-1 font-bold text-white">{tr.ticker}</td>
                                  <td className="py-1">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                        tr.action === "BUY"
                                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                          : tr.action === "SELL"
                                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                          : "bg-slate-800 text-slate-400"
                                      }`}
                                    >
                                      {tr.action}
                                    </span>
                                  </td>
                                  <td className="py-1 text-right text-slate-300">${tr.price.toFixed(2)}</td>
                                  <td className="py-1 text-right text-slate-400">{tr.previousShares.toFixed(2)}</td>
                                  <td className="py-1 text-right text-slate-200">{tr.newShares.toFixed(2)}</td>
                                  <td className="py-1 text-right text-emerald-400">{tr.newWeightPct.toFixed(2)}%</td>
                                  <td className="py-1 text-right font-medium text-slate-200">
                                    ${tr.tradeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW TAB 4: STANDALONE PYTHON SCRIPT */}
          {viewTab === "script" && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">Standalone Python Backtest Script</h4>
                  <p className="text-xs text-slate-400">
                    Run this exact market-cap simulation on your local computer or in Google Colab using yfinance and pandas.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyScript}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition flex items-center gap-1.5"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedScript ? "Copied!" : "Copy Code"}
                  </button>
                  <button
                    onClick={handleDownloadScript}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download .py
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 overflow-x-auto">
                <pre className="text-xs font-mono text-slate-300 leading-relaxed">
                  <code>{result.pythonScript}</code>
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Standalone Script Modal */}
      {isScriptModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
                  <Code className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">Python Backtest Script</h3>
                  <p className="text-xs text-slate-400">
                    Proportionate market-cap rebalancer script with Yahoo Finance integration
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyScript}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition flex items-center gap-1.5"
                >
                  {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedScript ? "Copied!" : "Copy Code"}
                </button>
                <button
                  onClick={handleDownloadScript}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .py
                </button>
                <button
                  onClick={() => setIsScriptModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto bg-slate-950 font-mono text-xs text-slate-300">
              <pre className="whitespace-pre">
                <code>{result?.pythonScript || "# Script will appear once simulation runs..."}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <polyline points="12 6 12 12 16 14" strokeWidth="2" />
    </svg>
  );
}
