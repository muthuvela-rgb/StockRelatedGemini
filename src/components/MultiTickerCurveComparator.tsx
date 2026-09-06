import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  Search,
  RefreshCw,
  Sliders,
  DollarSign,
  Activity,
  Sparkles,
  Shield,
  BarChart2,
  Calendar,
  Layers,
  ChevronRight,
  Plus,
  X,
  Check,
  Zap,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Flame,
  Info
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Area
} from "recharts";
import { MultiTickerCompareAnalysis, MultiTickerCompareResult, PremiumVsExpirationPoint } from "../types";
import { formatCurrency, formatPct } from "../lib/utils";
import { BollingerRsiTooltipBadge } from "./BollingerRsiTooltipBadge";
import { ChartPointInspector } from "./ChartPointInspector";

export const COMPARISON_PALETTE = [
  "#38bdf8", // Sky blue
  "#10b981", // Emerald green
  "#f59e0b", // Amber / gold
  "#ec4899", // Pink
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#14b8a6", // Teal
  "#e11d48", // Rose red
  "#a855f7", // Violet
  "#84cc16", // Lime
  "#eab308", // Yellow
];

const PRESETS = [
  { label: "Mega-Cap Tech", tickers: ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META"] },
  { label: "Index ETFs", tickers: ["SPY", "QQQ", "IWM", "DIA"] },
  { label: "Semiconductors", tickers: ["NVDA", "AMD", "TSM", "AVGO", "MU"] },
  { label: "High Volatility", tickers: ["TSLA", "PLTR", "COIN", "MSTR", "AMD"] },
  { label: "Defensive / Dividend", tickers: ["JNJ", "PG", "KO", "WMT", "BRK-B"] },
  { label: "Financials", tickers: ["JPM", "BAC", "MS", "GS", "V"] },
];

export type MetricType = "cash_return" | "premium" | "iv" | "cushion" | "margin_return";

interface MultiTickerCurveComparatorProps {
  initialTickers?: string[];
  initialOptionType?: "put" | "call";
  initialPriceType?: "bid" | "ask";
}

export const MultiTickerCurveComparator: React.FC<MultiTickerCurveComparatorProps> = ({
  initialTickers = ["NVDA", "AAPL", "MSFT", "AMD", "QQQ"],
  initialOptionType = "put",
  initialPriceType = "bid",
}) => {
  const [tickers, setTickers] = useState<string[]>(initialTickers);
  const [tickerInput, setTickerInput] = useState("");
  const [activeTickers, setActiveTickers] = useState<string[]>(initialTickers);
  const [optionType, setOptionType] = useState<"put" | "call">(initialOptionType);
  const [priceType, setPriceType] = useState<"bid" | "ask">(initialPriceType);
  const [targetStrikePct, setTargetStrikePct] = useState<number>(50);
  const [primaryMetric, setPrimaryMetric] = useState<MetricType>("cash_return");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MultiTickerCompareAnalysis | null>(null);

  // Inspector state
  const [inspectedPoint, setInspectedPoint] = useState<any | null>(null);
  const [selectedPointKey, setSelectedPointKey] = useState<string | null>(null);

  const fetchComparison = async (tickersToFetch = tickers) => {
    if (tickersToFetch.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/compare-premium-curves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickers: tickersToFetch,
          optionType,
          priceType,
          targetStrikePct,
          months: 18,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}: ${res.statusText}`);
      }

      const result: MultiTickerCompareAnalysis = await res.json();
      setData(result);
      // Ensure activeTickers has valid items
      setActiveTickers((prev) => {
        const available = result.tickers || [];
        const filtered = prev.filter((t) => available.includes(t));
        return filtered.length > 0 ? filtered : available;
      });
    } catch (err: any) {
      setError(err.message || "Failed to fetch comparison curves");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComparison();
  }, [optionType, priceType, targetStrikePct]);

  const handleAddTicker = (t: string) => {
    const cleaned = t.trim().toUpperCase();
    if (!cleaned) return;
    const split = cleaned.split(/[\s,]+/).filter(Boolean);
    const updated = Array.from(new Set([...tickers, ...split])).slice(0, 15);
    setTickers(updated);
    setActiveTickers(updated);
    setTickerInput("");
    fetchComparison(updated);
  };

  const handleRemoveTicker = (t: string) => {
    if (tickers.length <= 1) return;
    const updated = tickers.filter((item) => item !== t);
    setTickers(updated);
    setActiveTickers((prev) => prev.filter((item) => item !== t));
    fetchComparison(updated);
  };

  const handleApplyPreset = (presetTickers: string[]) => {
    setTickers(presetTickers);
    setActiveTickers(presetTickers);
    fetchComparison(presetTickers);
  };

  const toggleTickerVisibility = (t: string) => {
    if (activeTickers.includes(t)) {
      if (activeTickers.length > 1) {
        setActiveTickers(activeTickers.filter((item) => item !== t));
      }
    } else {
      setActiveTickers([...activeTickers, t]);
    }
  };

  const selectAllTickers = () => {
    if (data?.tickers) {
      setActiveTickers(data.tickers);
    }
  };

  const isolateTicker = (t: string) => {
    setActiveTickers([t]);
  };

  // Color map for tickers
  const tickerColorMap: Record<string, string> = {};
  tickers.forEach((t, i) => {
    tickerColorMap[t] = COMPARISON_PALETTE[i % COMPARISON_PALETTE.length];
  });

  // Metrics helper
  const getMetricDataKey = (ticker: string, metric: MetricType) => {
    switch (metric) {
      case "cash_return":
        return `${ticker}_cash_return`;
      case "premium":
        return `${ticker}_premium`;
      case "iv":
        return `${ticker}_iv`;
      case "cushion":
        return `${ticker}_cushion`;
      case "margin_return":
        return `${ticker}_margin_return`;
    }
  };

  const getMetricLabel = (metric: MetricType) => {
    switch (metric) {
      case "cash_return":
        return "Cash-Secured Return (Ann %)";
      case "premium":
        return "Option Premium ($)";
      case "iv":
        return "Implied Volatility (IV %)";
      case "cushion":
        return "Downside Cushion (%)";
      case "margin_return":
        return "Margin Return (Ann %)";
    }
  };

  const getMetricUnit = (metric: MetricType) => {
    switch (metric) {
      case "premium":
        return "$";
      case "cash_return":
      case "iv":
      case "cushion":
      case "margin_return":
        return "%";
    }
  };

  // Top summary stats
  const tickerSummaries = Object.values(data?.results_by_ticker || {});
  const highestYieldTicker = [...tickerSummaries].sort((a, b) => b.avg_cash_return - a.avg_cash_return)[0];
  const lowestIvTicker = [...tickerSummaries].sort((a, b) => a.avg_iv - b.avg_iv)[0];
  const highestIvTicker = [...tickerSummaries].sort((a, b) => b.avg_iv - a.avg_iv)[0];

  type MultiTableSortKey =
    | "ticker"
    | "current_price"
    | "target_strike"
    | "avg_cash_return"
    | "avg_margin_return"
    | "avg_iv"
    | "rsi_14"
    | "knee_point";

  const [tableSortField, setTableSortField] = useState<MultiTableSortKey>("avg_cash_return");
  const [tableSortDir, setTableSortDir] = useState<"asc" | "desc">("desc");

  const handleTableSort = (field: MultiTableSortKey) => {
    if (tableSortField === field) {
      setTableSortDir(tableSortDir === "asc" ? "desc" : "asc");
    } else {
      setTableSortField(field);
      setTableSortDir(field === "ticker" ? "asc" : "desc");
    }
  };

  const sortedTickerSummaries = useMemo(() => {
    const list = [...tickerSummaries];
    return list.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;
      switch (tableSortField) {
        case "ticker":
          valA = a.ticker;
          valB = b.ticker;
          break;
        case "current_price":
          valA = a.current_price;
          valB = b.current_price;
          break;
        case "target_strike":
          valA = a.target_strike;
          valB = b.target_strike;
          break;
        case "avg_cash_return":
          valA = a.avg_cash_return;
          valB = b.avg_cash_return;
          break;
        case "avg_margin_return":
          valA = a.avg_margin_return;
          valB = b.avg_margin_return;
          break;
        case "avg_iv":
          valA = a.avg_iv;
          valB = b.avg_iv;
          break;
        case "rsi_14":
          valA = a.rsi_14 ?? -1;
          valB = b.rsi_14 ?? -1;
          break;
        case "knee_point":
          valA = a.knee_point?.annualized_return_cash_secured ?? -1;
          valB = b.knee_point?.annualized_return_cash_secured ?? -1;
          break;
      }
      if (typeof valA === "string") {
        return tableSortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return tableSortDir === "asc" ? (valA ?? 0) - (valB ?? 0) : (valB ?? 0) - (valA ?? 0);
    });
  }, [tickerSummaries, tableSortField, tableSortDir]);

  return (
    <div className="space-y-6">
      {/* Top Controls Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        {/* Ticker Management Row */}
        <div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <label className="text-sm font-bold text-white">
                Compare User-Provided Tickers ({tickers.length} active)
              </label>
            </div>
            
            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-medium text-[11px] mr-1">Presets:</span>
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => handleApplyPreset(p.tickers)}
                  className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-medium transition cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active Tickers Chips & Add Form */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            {tickers.map((t) => {
              const isVisible = activeTickers.includes(t);
              const color = tickerColorMap[t] || "#38bdf8";
              return (
                <div
                  key={t}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all ${
                    isVisible
                      ? "bg-slate-800/90 text-white shadow-sm"
                      : "bg-slate-900/40 text-slate-500 border-slate-800/50 line-through opacity-60"
                  }`}
                  style={{ borderColor: isVisible ? color : "#334155" }}
                >
                  <button
                    onClick={() => toggleTickerVisibility(t)}
                    title={isVisible ? "Hide from plot" : "Show on plot"}
                    className="flex items-center gap-1.5 cursor-pointer"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span>{t}</span>
                  </button>

                  <button
                    onClick={() => isolateTicker(t)}
                    title="Focus only this ticker"
                    className="text-[10px] text-slate-400 hover:text-white px-1 py-0.5 rounded hover:bg-slate-700 cursor-pointer ml-0.5"
                  >
                    only
                  </button>

                  {tickers.length > 1 && (
                    <button
                      onClick={() => handleRemoveTicker(t)}
                      className="text-slate-400 hover:text-rose-400 ml-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Input to Add Ticker */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddTicker(tickerInput);
              }}
              className="flex items-center gap-1.5 ml-auto"
            >
              <input
                type="text"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                placeholder="+ Add ticker(s)"
                className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs font-semibold uppercase placeholder:normal-case placeholder:text-slate-500 w-32 outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </form>
          </div>
        </div>

        {/* Options & Target Moneyness Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-800 text-xs">
          {/* Primary Metric to Plot */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Plot Metric</label>
            <select
              value={primaryMetric}
              onChange={(e) => setPrimaryMetric(e.target.value as MetricType)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 outline-none cursor-pointer font-medium"
            >
              <option value="cash_return">💵 Cash-Secured Annual Return (%)</option>
              <option value="premium">💰 Option Premium ($)</option>
              <option value="iv">📈 Implied Volatility (IV %)</option>
              <option value="cushion">🛡️ Downside Cushion to Strike (%)</option>
              <option value="margin_return">⚡ Annualized Margin Return (%)</option>
            </select>
          </div>

          {/* Option Type */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Option Type</label>
            <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setOptionType("put")}
                className={`flex-1 py-1 text-center rounded font-semibold transition cursor-pointer ${
                  optionType === "put" ? "bg-rose-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                Puts (Cash-Secured)
              </button>
              <button
                onClick={() => setOptionType("call")}
                className={`flex-1 py-1 text-center rounded font-semibold transition cursor-pointer ${
                  optionType === "call" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                Calls (Covered)
              </button>
            </div>
          </div>

          {/* Price Basis */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Price Basis</label>
            <select
              value={priceType}
              onChange={(e) => setPriceType(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 outline-none cursor-pointer"
            >
              <option value="bid">Bid Price (Real Execution)</option>
              <option value="ask">Ask Price (Maximum Target)</option>
            </select>
          </div>

          {/* Target Strike Moneyness */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-slate-300 font-semibold">Target Strike (% of Spot)</label>
              <span className="text-indigo-400 font-bold font-mono">{targetStrikePct}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="range"
                min="20"
                max="100"
                step="5"
                value={targetStrikePct}
                onChange={(e) => setTargetStrikePct(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex gap-1 shrink-0">
                {[30, 50, 70, 90].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setTargetStrikePct(pct)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition ${
                      targetStrikePct === pct
                        ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/40"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3">
          <Info className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Comparison Summary Cards */}
      {data && tickerSummaries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider block">
                Highest Avg Cash-Secured Yield
              </span>
              {highestYieldTicker ? (
                <div>
                  <span className="text-lg font-bold text-white font-mono">
                    {highestYieldTicker.ticker} • {highestYieldTicker.avg_cash_return.toFixed(1)}% Ann.
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Spot: ${highestYieldTicker.current_price.toFixed(2)} | Target Strike: ${highestYieldTicker.target_strike.toFixed(2)} ({highestYieldTicker.target_strike_pct}%)
                  </p>
                </div>
              ) : (
                <span className="text-xs text-slate-500">N/A</span>
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-indigo-400 font-bold uppercase tracking-wider block">
                Lowest Volatility / Most Stable
              </span>
              {lowestIvTicker ? (
                <div>
                  <span className="text-lg font-bold text-white font-mono">
                    {lowestIvTicker.ticker} • {lowestIvTicker.avg_iv.toFixed(1)}% Avg IV
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    RSI(14): {lowestIvTicker.rsi_14?.toFixed(1) || "N/A"} | Avg Cash Yield: {lowestIvTicker.avg_cash_return.toFixed(1)}%
                  </p>
                </div>
              ) : (
                <span className="text-xs text-slate-500">N/A</span>
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-amber-400 font-bold uppercase tracking-wider block">
                Highest Implied Volatility
              </span>
              {highestIvTicker ? (
                <div>
                  <span className="text-lg font-bold text-white font-mono">
                    {highestIvTicker.ticker} • {highestIvTicker.avg_iv.toFixed(1)}% Avg IV
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Generates rich option premiums for high-risk harvesting
                  </p>
                </div>
              ) : (
                <span className="text-xs text-slate-500">N/A</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Multi-Ticker Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <span>Multi-Ticker Curve Comparison: {getMetricLabel(primaryMetric)}</span>
              <span className="text-xs px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-mono font-bold">
                Target: {targetStrikePct}% of Spot
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Comparing {activeTickers.length} active tickers across {data?.expirations.length || 0} chronological expiration horizons
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={selectAllTickers}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
            >
              Show All
            </button>
            <button
              onClick={() => fetchComparison()}
              disabled={loading}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Refresh Data
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span className="flex items-center gap-1.5 text-indigo-400">
            <Sparkles className="w-3.5 h-3.5" />
            Click any dot on the chart to inspect full contract strike, Greeks, RSI, and Bollinger Bands
          </span>
        </div>

        <div className="h-80 sm:h-96 w-full">
          {loading && !data ? (
            <div className="h-full flex items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
              <span>Fetching option chains & computing curves across all tickers...</span>
            </div>
          ) : data && data.overlaid_chart_data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data.overlaid_chart_data}
                margin={{ top: 15, right: 30, left: 10, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="label"
                  stroke="#64748b"
                  fontSize={11}
                  angle={-20}
                  textAnchor="end"
                  height={45}
                />
                <YAxis
                  stroke="#818cf8"
                  fontSize={11}
                  unit={getMetricUnit(primaryMetric)}
                  domain={[0, "auto"]}
                  label={{
                    value: getMetricLabel(primaryMetric),
                    angle: -90,
                    position: "insideLeft",
                    fill: "#818cf8",
                    fontSize: 11,
                  }}
                />
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const rowData = payload[0]?.payload;
                    return (
                      <div className="bg-slate-950 border border-slate-700 rounded-xl p-3 shadow-2xl text-xs max-w-xs space-y-2">
                        <div className="font-bold text-white border-b border-slate-800 pb-1 flex justify-between">
                          <span>{label}</span>
                          <span className="text-slate-400 font-mono">{rowData?.dte} DTE</span>
                        </div>
                        <div className="space-y-1.5">
                          {activeTickers.map((t) => {
                            const contract = rowData?.stocks?.[t];
                            if (!contract) return null;
                            const color = tickerColorMap[t] || "#38bdf8";
                            let valDisplay = "";
                            if (primaryMetric === "cash_return") {
                              valDisplay = `${contract.returnCashSecured?.toFixed(1) || 0}% Ann.`;
                            } else if (primaryMetric === "premium") {
                              valDisplay = `$${contract.premium?.toFixed(2) || 0}`;
                            } else if (primaryMetric === "iv") {
                              valDisplay = `${contract.iv?.toFixed(1) || 0}% IV`;
                            } else if (primaryMetric === "cushion") {
                              valDisplay = `${contract.cushion?.toFixed(1) || 0}% Cushion`;
                            } else if (primaryMetric === "margin_return") {
                              valDisplay = `${contract.returnMargin?.toFixed(1) || 0}% Ann.`;
                            }

                            return (
                              <div key={t} className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-1.5 font-bold" style={{ color }}>
                                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }} />
                                  {t} (Strike ${contract.strike})
                                </span>
                                <span className="font-mono font-bold text-white">{valDisplay}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "0.75rem" }} />

                {activeTickers.map((t) => {
                  const color = tickerColorMap[t] || "#38bdf8";
                  const dataKey = getMetricDataKey(t, primaryMetric);

                  return (
                    <Line
                      key={t}
                      type="monotone"
                      dataKey={dataKey}
                      name={t}
                      stroke={color}
                      strokeWidth={2.5}
                      connectNulls={true}
                      dot={((props: any): any => {
                        const { cx, cy, payload, key: rechartsKey, index } = props;
                        const fallbackKey = rechartsKey || `cmp-${t}-${payload?.expiration || index}`;
                        if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) {
                          return <g key={`empty-${fallbackKey}`} />;
                        }
                        const stockObj = payload?.stocks?.[t];
                        if (!stockObj) return <g key={`empty-${fallbackKey}`} />;

                        const pointId = `cmp-${t}-${payload.expiration}`;
                        const isSelected = selectedPointKey === pointId;

                        return (
                          <g
                            key={fallbackKey}
                            className="cursor-pointer group"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPointKey(pointId);
                              setInspectedPoint({
                                ...stockObj,
                                target_strike: stockObj.strike,
                                snapped_strike: stockObj.strike,
                                current_price: stockObj.spot,
                                annualized_return_cash_secured: stockObj.returnCashSecured,
                                annualized_return_margin: stockObj.returnMargin,
                                implied_volatility: stockObj.iv,
                                cushion_to_strike_pct: stockObj.cushion,
                                themeColor: color,
                              });
                            }}
                          >
                            <circle cx={cx} cy={cy} r={14} fill="transparent" />
                            {isSelected && (
                              <circle cx={cx} cy={cy} r={9} fill="none" stroke="#38bdf8" strokeWidth={2.5} className="animate-pulse" />
                            )}
                            <circle
                              cx={cx}
                              cy={cy}
                              r={isSelected ? 6 : 4}
                              fill={isSelected ? "#ffffff" : color}
                              stroke={isSelected ? color : "#0f172a"}
                              strokeWidth={isSelected ? 2.5 : 1.5}
                              className="transition-all duration-150 group-hover:scale-150 group-hover:stroke-white group-hover:stroke-[2px]"
                            />
                          </g>
                        );
                      }) as any}
                      activeDot={false}
                    />
                  );
                })}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              No comparison curve data available for the selected tickers.
            </div>
          )}
        </div>

        {/* Inspector Modal / Box */}
        {inspectedPoint && (
          <ChartPointInspector
            point={inspectedPoint}
            onClose={() => setInspectedPoint(null)}
            themeColor={inspectedPoint.themeColor || "#38bdf8"}
          />
        )}
      </div>

      {/* Multi-Ticker Comparison Matrix Table */}
      {data && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-indigo-400" />
                <span>Ticker Matrix & Yield Comparison ({targetStrikePct}% Target Strike)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Summary across all comparison symbols ranked by Cash-Secured Annualized Yield
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs select-none">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th
                    onClick={() => handleTableSort("ticker")}
                    className={`py-3 px-3 cursor-pointer hover:text-white transition-colors ${tableSortField === "ticker" ? "text-blue-400" : ""}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Ticker</span>
                      {tableSortField === "ticker" ? (
                        tableSortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-400" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-600 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleTableSort("current_price")}
                    className={`py-3 px-3 cursor-pointer hover:text-white transition-colors ${tableSortField === "current_price" ? "text-blue-400" : ""}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Spot Price</span>
                      {tableSortField === "current_price" ? (
                        tableSortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-400" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-600 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleTableSort("target_strike")}
                    className={`py-3 px-3 cursor-pointer hover:text-white transition-colors ${tableSortField === "target_strike" ? "text-blue-400" : ""}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Target Strike</span>
                      {tableSortField === "target_strike" ? (
                        tableSortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-400" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-600 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleTableSort("avg_cash_return")}
                    className={`py-3 px-3 cursor-pointer hover:text-white transition-colors ${tableSortField === "avg_cash_return" ? "text-emerald-300" : "text-emerald-400"}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Avg Cash Return</span>
                      {tableSortField === "avg_cash_return" ? (
                        tableSortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-600 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleTableSort("avg_margin_return")}
                    className={`py-3 px-3 cursor-pointer hover:text-white transition-colors ${tableSortField === "avg_margin_return" ? "text-blue-400" : ""}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Avg Margin Return</span>
                      {tableSortField === "avg_margin_return" ? (
                        tableSortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-400" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-600 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleTableSort("avg_iv")}
                    className={`py-3 px-3 cursor-pointer hover:text-white transition-colors ${tableSortField === "avg_iv" ? "text-blue-400" : ""}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Avg IV</span>
                      {tableSortField === "avg_iv" ? (
                        tableSortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-400" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-600 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleTableSort("rsi_14")}
                    className={`py-3 px-3 cursor-pointer hover:text-white transition-colors ${tableSortField === "rsi_14" ? "text-blue-400" : ""}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>RSI (14)</span>
                      {tableSortField === "rsi_14" ? (
                        tableSortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-400" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-600 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleTableSort("knee_point")}
                    className={`py-3 px-3 cursor-pointer hover:text-white transition-colors ${tableSortField === "knee_point" ? "text-blue-400" : ""}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Sweet-Spot Knee Point</span>
                      {tableSortField === "knee_point" ? (
                        tableSortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-400" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-600 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {sortedTickerSummaries.map((item, idx) => {
                    const color = tickerColorMap[item.ticker] || "#38bdf8";
                    const isVisible = activeTickers.includes(item.ticker);

                    return (
                      <tr
                        key={item.ticker}
                        className={`hover:bg-slate-800/40 transition ${!isVisible ? "opacity-40" : ""}`}
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="font-bold text-white text-sm">{item.ticker}</span>
                            {idx === 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-sans font-bold">
                                #1 Yield
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-slate-200 font-bold">
                          ${item.current_price.toFixed(2)}
                        </td>

                        <td className="py-3 px-3">
                          <span className="text-indigo-300 font-bold">
                            ${item.target_strike.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-sans ml-1">
                            ({item.target_strike_pct}%)
                          </span>
                        </td>

                        <td className="py-3 px-3 text-emerald-400 font-bold text-sm">
                          {item.avg_cash_return.toFixed(1)}%
                        </td>

                        <td className="py-3 px-3 text-slate-300">
                          {item.avg_margin_return.toFixed(1)}%
                        </td>

                        <td className="py-3 px-3 text-amber-300">
                          {item.avg_iv.toFixed(1)}%
                        </td>

                        <td className="py-3 px-3">
                          {item.rsi_14 !== null && item.rsi_14 !== undefined ? (
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                item.rsi_14 < 30
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : item.rsi_14 > 70
                                  ? "bg-rose-500/20 text-rose-400"
                                  : "bg-slate-800 text-slate-300"
                              }`}
                            >
                              {item.rsi_14.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-slate-500">N/A</span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          {item.knee_point ? (
                            <div className="flex items-center gap-1 text-[11px] text-amber-300 font-sans">
                              <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                              <span>
                                {item.knee_point.expiration} ({item.knee_point.dte}d) @ {item.knee_point.annualized_return_cash_secured.toFixed(1)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px] font-sans">N/A</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => toggleTickerVisibility(item.ticker)}
                            className={`px-2.5 py-1 rounded text-xs font-sans font-semibold transition cursor-pointer ${
                              isVisible
                                ? "bg-slate-800 hover:bg-slate-700 text-slate-300"
                                : "bg-indigo-600 hover:bg-indigo-500 text-white"
                            }`}
                          >
                            {isVisible ? "Hide" : "Show"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
