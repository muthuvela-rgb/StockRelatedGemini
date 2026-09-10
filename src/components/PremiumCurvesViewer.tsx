import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  Search,
  RefreshCw,
  Sliders,
  Maximize2,
  AlertCircle,
  HelpCircle,
  BarChart2,
  Calendar,
  Sparkles,
  Target,
  Layers,
  Clock,
  DollarSign,
  Activity,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
  ComposedChart,
  ReferenceLine,
  ReferenceArea
} from "recharts";
import { PremiumCurveAnalysis, PremiumVsExpirationAnalysis } from "../types";
import { formatCurrency, formatPct } from "../lib/utils";
import { BollingerRsiTooltipBadge } from "./BollingerRsiTooltipBadge";
import { ChartPointInspector } from "./ChartPointInspector";
import { MultiTickerCurveComparator } from "./MultiTickerCurveComparator";
import { VerticalPutOptimizerPanel } from "./VerticalPutOptimizerPanel";
import { VerticalPutSpread } from "../utils/verticalPutOptimizer";

const STRIKE_RANGE_COLORS = [
  "#38bdf8", // sky blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
  "#e11d48", // rose
  "#a855f7", // violet
  "#84cc16", // lime
];

const EXPIRATION_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // purple
  "#06b6d4", // cyan
];

export const PremiumCurvesViewer: React.FC = () => {
  const [viewMode, setViewMode] = useState<"multi_exp_strike" | "single_strike_exp" | "compare_tickers">("single_strike_exp");
  const [ticker, setTicker] = useState("QQQ");
  const [optionType, setOptionType] = useState<"put" | "call">("put");
  const [priceType, setPriceType] = useState<"bid" | "ask">("bid");
  const [numExpirations, setNumExpirations] = useState(4);
  const [strikeRange, setStrikeRange] = useState("30-70");
  const [useLogScale, setUseLogScale] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Multi-exp data
  const [analysis, setAnalysis] = useState<PremiumCurveAnalysis | null>(null);

  // Single target strike vs expiration data (pct, dollar, or range)
  const [singleStrikeType, setSingleStrikeType] = useState<"dollar" | "pct" | "range">("pct");
  const [targetStrike, setTargetStrike] = useState<number | string>("");
  const [targetStrikePct, setTargetStrikePct] = useState<number>(50);

  // Range mode parameters
  const [rangePreset, setRangePreset] = useState<string>("30-70");
  const [rangeMinPct, setRangeMinPct] = useState<number>(30);
  const [rangeMaxPct, setRangeMaxPct] = useState<number>(70);
  const [rangeStepPct, setRangeStepPct] = useState<number>(10);
  const [activeRangeStrikes, setActiveRangeStrikes] = useState<string[]>([]);
  const [rangePlotMetric, setRangePlotMetric] = useState<"premium" | "cash_return" | "iv" | "cushion" | "margin_return">("premium");

  const [expAnalysis, setExpAnalysis] = useState<PremiumVsExpirationAnalysis | null>(null);
  const [showSecondaryReturnLine, setShowSecondaryReturnLine] = useState(true);
  const [inspectedCurvePoint, setInspectedCurvePoint] = useState<any | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [optimizerExp, setOptimizerExp] = useState<string>("");
  const [selectedVerticalPutSpread, setSelectedVerticalPutSpread] = useState<VerticalPutSpread | null>(null);

  const fetchCurves = async () => {
    setLoading(true);
    setError(null);
    try {
      if (viewMode === "multi_exp_strike") {
        const q = new URLSearchParams({
          ticker: ticker.trim().toUpperCase(),
          optionType,
          priceType,
          numExpirations: String(numExpirations),
          strikeRange,
        });

        const res = await fetch(`/api/premium-curves?${q.toString()}`);
        if (!res.ok) throw new Error(`Server returned ${res.status}: ${res.statusText}`);
        const data: PremiumCurveAnalysis = await res.json();
        setAnalysis(data);
      } else {
        const q = new URLSearchParams({
          ticker: ticker.trim().toUpperCase(),
          optionType,
          priceType,
          months: "36",
        });

        if (singleStrikeType === "range") {
          q.set("mode", "range");
          if (rangePreset === "custom") {
            const customPcts: number[] = [];
            for (let p = rangeMinPct; p <= rangeMaxPct; p += Math.max(1, rangeStepPct)) {
              customPcts.push(p);
            }
            q.set("strikePcts", customPcts.join(","));
          } else {
            q.set("targetStrikeRange", rangePreset);
          }
        } else if (singleStrikeType === "dollar" && targetStrike) {
          q.set("targetStrike", String(targetStrike));
        } else {
          q.set("targetStrikePct", String(targetStrikePct));
        }

        const res = await fetch(`/api/premium-vs-expiration?${q.toString()}`);
        if (!res.ok) throw new Error(`Server returned ${res.status}: ${res.statusText}`);
        const data: PremiumVsExpirationAnalysis = await res.json();
        setExpAnalysis(data);

        // Sync active range strikes
        if (data.range_strikes && data.range_strikes.length > 0) {
          const keys = data.range_strikes.map((s) => s.key);
          setActiveRangeStrikes((prev) => {
            const valid = prev.filter((k) => keys.includes(k));
            return valid.length > 0 ? valid : keys;
          });
        }
      }
    } catch (e: any) {
      setError(e.message || "Failed to analyze premium curves");
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch automatically whenever parameters change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCurves();
    }, 200);
    return () => clearTimeout(timer);
  }, [
    viewMode,
    ticker,
    optionType,
    priceType,
    numExpirations,
    strikeRange,
    singleStrikeType,
    targetStrikePct,
    targetStrike,
    rangePreset,
    rangeMinPct,
    rangeMaxPct,
    rangeStepPct,
  ]);

  type StrikeRangeSortKey =
    | "key"
    | "snapped_strike"
    | "cushion_to_strike_pct"
    | "avg_premium"
    | "avg_cash_return"
    | "avg_margin_return"
    | "avg_iv"
    | "knee_point";

  const [strikeSortField, setStrikeSortField] = useState<StrikeRangeSortKey>("avg_cash_return");
  const [strikeSortDir, setStrikeSortDir] = useState<"asc" | "desc">("desc");

  const handleStrikeSort = (field: StrikeRangeSortKey) => {
    if (strikeSortField === field) {
      setStrikeSortDir(strikeSortDir === "asc" ? "desc" : "asc");
    } else {
      setStrikeSortField(field);
      setStrikeSortDir(field === "key" || field === "snapped_strike" ? "asc" : "desc");
    }
  };

  const sortedRangeStrikes = useMemo(() => {
    if (!expAnalysis?.range_strikes) return [];
    const list = [...expAnalysis.range_strikes];
    return list.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;
      switch (strikeSortField) {
        case "key":
          valA = a.target_strike ?? 0;
          valB = b.target_strike ?? 0;
          break;
        case "snapped_strike":
          valA = a.snapped_strike ?? 0;
          valB = b.snapped_strike ?? 0;
          break;
        case "cushion_to_strike_pct":
          valA = a.cushion_to_strike_pct ?? 0;
          valB = b.cushion_to_strike_pct ?? 0;
          break;
        case "avg_premium":
          valA = a.avg_premium ?? 0;
          valB = b.avg_premium ?? 0;
          break;
        case "avg_cash_return":
          valA = a.avg_cash_return ?? 0;
          valB = b.avg_cash_return ?? 0;
          break;
        case "avg_margin_return":
          valA = a.avg_margin_return ?? 0;
          valB = b.avg_margin_return ?? 0;
          break;
        case "avg_iv":
          valA = a.avg_iv ?? 0;
          valB = b.avg_iv ?? 0;
          break;
        case "knee_point":
          valA = a.knee_point?.premium ?? -1;
          valB = b.knee_point?.premium ?? -1;
          break;
      }
      return strikeSortDir === "asc" ? (valA ?? 0) - (valB ?? 0) : (valB ?? 0) - (valA ?? 0);
    });
  }, [expAnalysis?.range_strikes, strikeSortField, strikeSortDir]);

  // Helpers for tooltip formatting
  const formatExpDateDetail = (expStr: string) => {
    try {
      const d = new Date(expStr + "T00:00:00");
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return expStr;
    }
  };

  const getDteFromExp = (expStr: string): number => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const exp = new Date(expStr + "T00:00:00");
      const diff = exp.getTime() - today.getTime();
      return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
    } catch {
      return 0;
    }
  };

  // Pivot records for multi-line chart (each strike row has exp1, exp2, etc.)
  const expirations = analysis?.expirations || [];
  const chartDataMap: Record<number, any> = {};

  if (analysis?.records) {
    for (const r of analysis.records) {
      if (!chartDataMap[r.strike]) {
        chartDataMap[r.strike] = {
          strike: r.strike,
          detailsByExp: {},
        };
      }
      chartDataMap[r.strike][r.expiration] = r.premium;
      chartDataMap[r.strike].detailsByExp[r.expiration] = r;
    }
  }

  const chartData = Object.values(chartDataMap).sort((a, b) => a.strike - b.strike);

  // Single target strike vs expiration points
  const expPoints = expAnalysis?.points || [];
  const kneePoint = expAnalysis?.knee_point;

  const formattedExpPoints = expPoints.map((p) => ({
    ...p,
    ticker: expAnalysis?.ticker,
    strike: p.snapped_strike || p.target_strike,
    spot: expAnalysis?.current_price,
    moneyness: expAnalysis?.current_price ? (((p.snapped_strike || p.target_strike) / expAnalysis.current_price) * 100) : 100,
    returnCashSecured: p.annualized_return_cash_secured,
    returnMargin: p.annualized_return_margin,
    returnPct: p.annualized_return_cash_secured,
    rsi_14: p.rsi_14 || expAnalysis?.rsi_14,
    bollinger: p.bollinger || expAnalysis?.bollinger,
    fibonacci: p.fibonacci || expAnalysis?.fibonacci,
    fifty_two_week_high: expAnalysis?.fifty_two_week_high,
    fifty_two_week_low: expAnalysis?.fifty_two_week_low,
    shortLabel: `${p.expiration.slice(5)} (${p.dte}d)`,
    isKnee: kneePoint && p.expiration === kneePoint.expiration,
  }));

  return (
    <div className="space-y-6">
      {/* Search and Options */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white font-display flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              Options Premium & Decay Curve Visualizer
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Plot <strong>Premium ($) vs Expiration Date</strong> for a target strike or compare decay across strike curves.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs font-semibold">
              <button
                onClick={() => setViewMode("single_strike_exp")}
                className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "single_strike_exp"
                    ? "bg-cyan-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Premium vs Expiration
              </button>
              <button
                onClick={() => setViewMode("multi_exp_strike")}
                className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "multi_exp_strike"
                    ? "bg-blue-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Strike Curves
              </button>
              <button
                onClick={() => setViewMode("compare_tickers")}
                className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "compare_tickers"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Compare Tickers
              </button>
            </div>

            {viewMode !== "compare_tickers" && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && fetchCurves()}
                  placeholder="Ticker"
                  className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs font-bold w-24 uppercase outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={fetchCurves}
                  disabled={loading}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Plot
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Options Row */}
        {viewMode !== "compare_tickers" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Option Type</label>
            <select
              value={optionType}
              onChange={(e) => setOptionType(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 outline-none cursor-pointer"
            >
              <option value="put">Puts</option>
              <option value="call">Calls</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Price Basis</label>
            <select
              value={priceType}
              onChange={(e) => setPriceType(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 outline-none cursor-pointer"
            >
              <option value="bid">Bid Price</option>
              <option value="ask">Ask Price</option>
            </select>
          </div>

          {viewMode === "single_strike_exp" ? (
            <div className="col-span-2 flex flex-col gap-2.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-cyan-400" />
                    Target Strike Mode
                  </label>
                  <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[10px]">
                    <button
                      onClick={() => setSingleStrikeType("pct")}
                      className={`cursor-pointer px-2 py-0.5 rounded transition font-medium ${
                        singleStrikeType === "pct" ? "bg-cyan-600 text-white font-bold shadow" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      % Spot
                    </button>
                    <button
                      onClick={() => {
                        setSingleStrikeType("dollar");
                        if (!targetStrike && expAnalysis?.current_price) {
                          setTargetStrike(Math.round((expAnalysis.current_price * targetStrikePct) / 100));
                        }
                      }}
                      className={`cursor-pointer px-2 py-0.5 rounded transition font-medium ${
                        singleStrikeType === "dollar" ? "bg-cyan-600 text-white font-bold shadow" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Dollar ($)
                    </button>
                    <button
                      onClick={() => setSingleStrikeType("range")}
                      className={`cursor-pointer px-2 py-0.5 rounded transition font-medium flex items-center gap-1 ${
                        singleStrikeType === "range" ? "bg-cyan-600 text-white font-bold shadow" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <Layers className="w-3 h-3" />
                      Range (Multi-Strike)
                    </button>
                  </div>
                </div>

                {singleStrikeType === "pct" && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="10"
                        max="200"
                        step="1"
                        value={targetStrikePct}
                        onChange={(e) => setTargetStrikePct(parseFloat(e.target.value) || 50)}
                        className="w-16 bg-slate-800 border border-slate-700 text-white font-mono rounded px-2 py-1.5 text-xs outline-none focus:border-cyan-500"
                      />
                      <span className="text-slate-400 text-xs font-mono">%</span>
                    </div>

                    {expAnalysis?.current_price && (
                      <span className="text-[11px] text-cyan-400/90 font-mono font-semibold ml-1">
                        ≈ ${((expAnalysis.current_price * targetStrikePct) / 100).toFixed(1)}
                      </span>
                    )}

                    <div className="flex items-center gap-1 ml-auto flex-wrap">
                      {[30, 40, 50, 60, 70, 80, 90].map((p) => (
                        <button
                          key={p}
                          onClick={() => setTargetStrikePct(p)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition ${
                            targetStrikePct === p
                              ? "bg-cyan-600 text-white font-bold shadow"
                              : "bg-slate-800 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {singleStrikeType === "dollar" && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 text-xs">$</span>
                      <input
                        type="number"
                        step="0.5"
                        value={targetStrike}
                        onChange={(e) => setTargetStrike(e.target.value)}
                        placeholder="e.g. 520"
                        className="w-28 bg-slate-800 border border-slate-700 text-white font-mono rounded px-2.5 py-1.5 text-xs outline-none focus:border-cyan-500"
                      />
                    </div>
                    {expAnalysis?.current_price && targetStrike && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        ({((parseFloat(String(targetStrike)) / expAnalysis.current_price) * 100).toFixed(1)}% of Spot)
                      </span>
                    )}
                  </div>
                )}

                {singleStrikeType === "range" && (
                  <div className="space-y-2.5">
                    {/* Range Presets */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-400 font-medium mr-1">Range:</span>
                      {[
                        { id: "30-70", label: "30% - 70% (Deep OTM)" },
                        { id: "20-50", label: "20% - 50% (Ultra Safe)" },
                        { id: "50-80", label: "50% - 80% (Moderate)" },
                        { id: "70-95", label: "70% - 95% (Near ATM)" },
                        { id: "30-100", label: "30% - 100% (Wide)" },
                        { id: "custom", label: "Custom" },
                      ].map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setRangePreset(p.id)}
                          className={`px-2 py-1 rounded text-[10px] font-mono cursor-pointer transition ${
                            rangePreset === p.id
                              ? "bg-cyan-600 text-white font-bold shadow"
                              : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    {/* Custom Range Inputs */}
                    {rangePreset === "custom" && (
                      <div className="flex flex-wrap items-center gap-3 p-2 bg-slate-800/60 rounded-lg border border-slate-700 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">Min %:</span>
                          <input
                            type="number"
                            min="10"
                            max="150"
                            step="5"
                            value={rangeMinPct}
                            onChange={(e) => setRangeMinPct(parseFloat(e.target.value) || 20)}
                            className="w-14 bg-slate-900 border border-slate-700 text-white font-mono rounded px-1.5 py-1 text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">Max %:</span>
                          <input
                            type="number"
                            min="20"
                            max="200"
                            step="5"
                            value={rangeMaxPct}
                            onChange={(e) => setRangeMaxPct(parseFloat(e.target.value) || 80)}
                            className="w-14 bg-slate-900 border border-slate-700 text-white font-mono rounded px-1.5 py-1 text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">Step %:</span>
                          <input
                            type="number"
                            min="2"
                            max="25"
                            step="1"
                            value={rangeStepPct}
                            onChange={(e) => setRangeStepPct(parseFloat(e.target.value) || 10)}
                            className="w-14 bg-slate-900 border border-slate-700 text-white font-mono rounded px-1.5 py-1 text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {/* Plot Metric Selector & Strike Toggles */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[11px] text-slate-400 font-medium mr-1">Plot Metric:</span>
                        {[
                          { id: "premium", label: "Premium ($)" },
                          { id: "cash_return", label: "Cash Return (Ann %)" },
                          { id: "iv", label: "Implied Vol (IV %)" },
                          { id: "cushion", label: "Cushion (%)" },
                          { id: "margin_return", label: "Margin Return (Ann %)" },
                        ].map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setRangePlotMetric(m.id as any)}
                            className={`px-2 py-0.5 rounded text-[10px] cursor-pointer transition ${
                              rangePlotMetric === m.id
                                ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40"
                                : "bg-slate-800 text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>

                      {expAnalysis?.range_strikes && expAnalysis.range_strikes.length > 0 && (
                        <div className="flex items-center gap-2 text-[10px]">
                          <button
                            onClick={() => {
                              if (expAnalysis?.range_strikes) {
                                setActiveRangeStrikes(expAnalysis.range_strikes.map((s) => s.key));
                              }
                            }}
                            className="text-cyan-400 hover:underline cursor-pointer font-medium"
                          >
                            Select All
                          </button>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-400">
                            {activeRangeStrikes.length} of {expAnalysis.range_strikes.length} strikes visible
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Active Strike Chips */}
                    {expAnalysis?.range_strikes && expAnalysis.range_strikes.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {expAnalysis.range_strikes.map((s, idx) => {
                          const color = STRIKE_RANGE_COLORS[idx % STRIKE_RANGE_COLORS.length];
                          const isActive = activeRangeStrikes.includes(s.key);
                          return (
                            <button
                              key={s.key}
                              onClick={() => {
                                if (isActive) {
                                  if (activeRangeStrikes.length > 1) {
                                    setActiveRangeStrikes(activeRangeStrikes.filter((k) => k !== s.key));
                                  }
                                } else {
                                  setActiveRangeStrikes([...activeRangeStrikes, s.key]);
                                }
                              }}
                              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border transition cursor-pointer ${
                                isActive
                                  ? "bg-slate-800 text-slate-200 font-bold shadow-sm"
                                  : "bg-slate-900/60 text-slate-500 border-slate-800 opacity-60 hover:opacity-100"
                              }`}
                              style={{ borderColor: isActive ? color : "#334155" }}
                            >
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: isActive ? color : "#475569" }}
                              />
                              <span>{s.key}</span>
                              <span className="text-slate-400 text-[9px]">(${s.snapped_strike})</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Strike Range (% Spot)</label>
                <select
                  value={strikeRange}
                  onChange={(e) => setStrikeRange(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 outline-none cursor-pointer font-mono text-xs"
                >
                  <option value="30-70">30% - 70% (Deep OTM)</option>
                  <option value="20-50">20% - 50% (Ultra Safe)</option>
                  <option value="50-80">50% - 80% (Moderate OTM)</option>
                  <option value="70-95">70% - 95% (Near ATM)</option>
                  <option value="30-100">30% - 100% (Wide OTM)</option>
                  <option value="20-150">20% - 150% (Full Spectrum)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-slate-300 font-semibold mb-1">Expirations</label>
                  <select
                    value={numExpirations}
                    onChange={(e) => setNumExpirations(parseInt(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 outline-none cursor-pointer"
                  >
                    <option value="2">2 Expirations</option>
                    <option value="3">3 Expirations</option>
                    <option value="4">4 Expirations</option>
                    <option value="5">5 Expirations</option>
                    <option value="6">6 Expirations</option>
                    <option value="8">8 Expirations</option>
                  </select>
                </div>

                <div className="flex items-end pb-0.5">
                  <button
                    onClick={() => setUseLogScale(!useLogScale)}
                    title="Toggle Log Scale"
                    className={`py-1.5 px-2.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                      useLogScale
                        ? "bg-blue-600 border-blue-500 text-white shadow"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                    }`}
                  >
                    {useLogScale ? "Log" : "Linear"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        )}
      </div>

      {/* VIEW MODE 3: MULTI-TICKER COMPARISON */}
      {viewMode === "compare_tickers" && (
        <MultiTickerCurveComparator
          initialTickers={[ticker, "AAPL", "MSFT", "AMD", "QQQ"].filter((t, i, arr) => arr.indexOf(t) === i)}
          initialOptionType={optionType}
          initialPriceType={priceType}
        />
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* VIEW MODE 1: TARGET STRIKE (SINGLE OR RANGE) VS EXPIRATION DATE */}
      {viewMode === "single_strike_exp" && expAnalysis && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white font-display flex items-center gap-2 flex-wrap">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span>
                  {expAnalysis.ticker} {optionType.toUpperCase()} •{" "}
                  {singleStrikeType === "range"
                    ? `Strike Range (${rangePreset === "custom" ? `${rangeMinPct}% - ${rangeMaxPct}%` : rangePreset}%) vs Expiration`
                    : `Premium ($) vs Expiration Date`}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono font-bold">
                  Spot: ${expAnalysis.current_price.toFixed(2)}
                </span>
                {singleStrikeType !== "range" && (
                  <span className="text-xs px-2.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-mono font-bold">
                    Target Strike: ${expAnalysis.target_strike.toFixed(2)} ({expAnalysis.target_strike_pct.toFixed(1)}%)
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {singleStrikeType === "range"
                  ? `Comparing decay & returns across ${activeRangeStrikes.length} target strikes across ${(expAnalysis.range_chart_data || []).length} expiration dates`
                  : `Visualizes premium progression across ${formattedExpPoints.length} expiration dates snapped to closest listed strikes`}
              </p>
            </div>

            {singleStrikeType !== "range" && kneePoint && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs shrink-0">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Knee Point: <strong>{kneePoint.expiration} ({kneePoint.dte}d)</strong> @ ${kneePoint.premium.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <Sparkles className="w-3.5 h-3.5" />
              Click any dot on the curves to inspect full contract specifications, Greeks & technical indicators
            </span>
          </div>

          {/* RANGE MODE CHART */}
          {singleStrikeType === "range" ? (
            <div className="space-y-4">
              <div className="h-80 sm:h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={expAnalysis.range_chart_data || []}
                    margin={{ top: 15, right: 30, left: 10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="shortLabel"
                      stroke="#64748b"
                      fontSize={11}
                      angle={-20}
                      textAnchor="end"
                      height={45}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      unit={rangePlotMetric === "premium" ? "$" : "%"}
                      domain={[0, "auto"]}
                      label={{
                        value:
                          rangePlotMetric === "premium"
                            ? "Option Premium ($)"
                            : rangePlotMetric === "cash_return"
                            ? "Cash-Secured Return (Ann %)"
                            : rangePlotMetric === "iv"
                            ? "Implied Volatility (IV %)"
                            : rangePlotMetric === "cushion"
                            ? "Downside Cushion (%)"
                            : "Margin Return (Ann %)",
                        angle: -90,
                        position: "insideLeft",
                        fill: "#94a3b8",
                        fontSize: 11,
                      }}
                    />
                    <RechartsTooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        const row = payload[0]?.payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-3.5 shadow-2xl text-xs space-y-2 max-w-sm">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <span className="font-bold text-white flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                                {formatExpDateDetail(row?.expiration || "")}
                              </span>
                              <span className="font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded font-semibold">
                                {row?.dte} Days to Exp
                              </span>
                            </div>

                            <div className="space-y-1.5 pt-1">
                              {activeRangeStrikes.map((key) => {
                                const strikeItem = expAnalysis.range_strikes?.find((s) => s.key === key);
                                const strikeIdx = expAnalysis.range_strikes?.findIndex((s) => s.key === key) ?? 0;
                                const color = STRIKE_RANGE_COLORS[strikeIdx % STRIKE_RANGE_COLORS.length];
                                const strikeData = row?.strikes?.[key];
                                if (!strikeData) return null;

                                let valStr = "";
                                if (rangePlotMetric === "premium") valStr = `$${strikeData.premium.toFixed(2)}`;
                                else if (rangePlotMetric === "cash_return") valStr = `${strikeData.annualized_return_cash_secured.toFixed(1)}%`;
                                else if (rangePlotMetric === "iv") valStr = `${strikeData.implied_volatility.toFixed(1)}% IV`;
                                else if (rangePlotMetric === "cushion") valStr = `${strikeData.cushion_to_strike_pct.toFixed(1)}% Cushion`;
                                else valStr = `${strikeData.annualized_return_margin.toFixed(1)}%`;

                                return (
                                  <div
                                    key={key}
                                    className="flex items-center justify-between gap-3 text-[11px] py-0.5 border-b border-slate-800/50 last:border-0"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                                      <span className="font-mono text-slate-300 font-semibold">{key}</span>
                                      <span className="text-slate-500">(${strikeData.snapped_strike})</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-bold text-white">{valStr}</span>
                                      {rangePlotMetric !== "cash_return" && (
                                        <span className="text-emerald-400 font-mono text-[10px]">
                                          ({strikeData.annualized_return_cash_secured.toFixed(1)}% cash)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="text-[10px] text-slate-500 pt-1 text-center">
                              Click any dot on the chart to inspect full contract Greeks
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "0.75rem" }} />

                    {activeRangeStrikes.map((key) => {
                      const strikeItem = expAnalysis.range_strikes?.find((s) => s.key === key);
                      const strikeIdx = expAnalysis.range_strikes?.findIndex((s) => s.key === key) ?? 0;
                      const color = STRIKE_RANGE_COLORS[strikeIdx % STRIKE_RANGE_COLORS.length];
                      const dataKey = `${key}_${rangePlotMetric}`;

                      return (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={dataKey}
                          name={`${key} ($${strikeItem?.snapped_strike || strikeItem?.target_strike})`}
                          stroke={color}
                          strokeWidth={2}
                          dot={((props: any): any => {
                            const { cx, cy, payload, key: rechartsKey, index } = props;
                            const fallbackKey = rechartsKey || `range-${key}-${payload?.expiration || index}`;
                            if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) {
                              return <g key={`empty-${fallbackKey}`} />;
                            }
                            const strikePoint = payload?.strikes?.[key];
                            if (!strikePoint) return <g key={`empty-${fallbackKey}`} />;

                            const pointId = `range-${key}-${payload.expiration}`;
                            const isSelected = selectedPointId === pointId;

                            return (
                              <g
                                key={fallbackKey}
                                className="cursor-pointer group"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPointId(pointId);
                                  setInspectedCurvePoint({
                                    ...strikePoint,
                                    ticker: expAnalysis.ticker,
                                    spot: expAnalysis.current_price,
                                    moneyness: strikePoint.moneyness_pct,
                                    returnCashSecured: strikePoint.annualized_return_cash_secured,
                                    returnMargin: strikePoint.annualized_return_margin,
                                    returnPct: strikePoint.annualized_return_cash_secured,
                                    rsi_14: expAnalysis.rsi_14,
                                    bollinger: expAnalysis.bollinger,
                                    fibonacci: expAnalysis.fibonacci,
                                    fiftyTwoWeekHigh: expAnalysis.fifty_two_week_high,
                                    fiftyTwoWeekLow: expAnalysis.fifty_two_week_low,
                                    themeColor: color,
                                  });
                                }}
                              >
                                <circle cx={cx} cy={cy} r={14} fill="transparent" />
                                {isSelected && (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={9}
                                    fill="none"
                                    stroke={color}
                                    strokeWidth={2.5}
                                    className="animate-pulse"
                                  />
                                )}
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={isSelected ? 6 : 3.5}
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
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Range Strike Matrix Table */}
              {expAnalysis.range_strikes && expAnalysis.range_strikes.length > 0 && (
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      Strike Range Comparison & Sweet-Spot Knee Analysis
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Ranked across all active expirations
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs select-none">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                          <th
                            onClick={() => handleStrikeSort("key")}
                            className={`pb-2 font-medium cursor-pointer hover:text-white transition-colors ${strikeSortField === "key" ? "text-cyan-400" : ""}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span>Strike (% Spot)</span>
                              {strikeSortField === "key" ? (
                                strikeSortDir === "asc" ? <ArrowUp className="w-3 h-3 text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-400" />
                              ) : (
                                <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-60" />
                              )}
                            </div>
                          </th>
                          <th
                            onClick={() => handleStrikeSort("snapped_strike")}
                            className={`pb-2 font-medium cursor-pointer hover:text-white transition-colors ${strikeSortField === "snapped_strike" ? "text-cyan-400" : ""}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span>Listed Strike</span>
                              {strikeSortField === "snapped_strike" ? (
                                strikeSortDir === "asc" ? <ArrowUp className="w-3 h-3 text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-400" />
                              ) : (
                                <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-60" />
                              )}
                            </div>
                          </th>
                          <th
                            onClick={() => handleStrikeSort("cushion_to_strike_pct")}
                            className={`pb-2 font-medium cursor-pointer hover:text-white transition-colors ${strikeSortField === "cushion_to_strike_pct" ? "text-cyan-400" : ""}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span>Downside Cushion</span>
                              {strikeSortField === "cushion_to_strike_pct" ? (
                                strikeSortDir === "asc" ? <ArrowUp className="w-3 h-3 text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-400" />
                              ) : (
                                <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-60" />
                              )}
                            </div>
                          </th>
                          <th
                            onClick={() => handleStrikeSort("avg_premium")}
                            className={`pb-2 font-medium cursor-pointer hover:text-white transition-colors ${strikeSortField === "avg_premium" ? "text-cyan-400" : ""}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span>Avg Premium</span>
                              {strikeSortField === "avg_premium" ? (
                                strikeSortDir === "asc" ? <ArrowUp className="w-3 h-3 text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-400" />
                              ) : (
                                <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-60" />
                              )}
                            </div>
                          </th>
                          <th
                            onClick={() => handleStrikeSort("avg_cash_return")}
                            className={`pb-2 font-medium cursor-pointer hover:text-white transition-colors ${strikeSortField === "avg_cash_return" ? "text-emerald-300" : "text-emerald-400"}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span>Avg Cash Return</span>
                              {strikeSortField === "avg_cash_return" ? (
                                strikeSortDir === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-400" /> : <ArrowDown className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-60" />
                              )}
                            </div>
                          </th>
                          <th
                            onClick={() => handleStrikeSort("avg_margin_return")}
                            className={`pb-2 font-medium cursor-pointer hover:text-white transition-colors ${strikeSortField === "avg_margin_return" ? "text-blue-300" : "text-blue-400"}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span>Avg Margin Return</span>
                              {strikeSortField === "avg_margin_return" ? (
                                strikeSortDir === "asc" ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />
                              ) : (
                                <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-60" />
                              )}
                            </div>
                          </th>
                          <th
                            onClick={() => handleStrikeSort("avg_iv")}
                            className={`pb-2 font-medium cursor-pointer hover:text-white transition-colors ${strikeSortField === "avg_iv" ? "text-purple-300" : "text-slate-400"}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span>Avg IV</span>
                              {strikeSortField === "avg_iv" ? (
                                strikeSortDir === "asc" ? <ArrowUp className="w-3 h-3 text-purple-400" /> : <ArrowDown className="w-3 h-3 text-purple-400" />
                              ) : (
                                <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-60" />
                              )}
                            </div>
                          </th>
                          <th
                            onClick={() => handleStrikeSort("knee_point")}
                            className={`pb-2 font-medium cursor-pointer hover:text-white transition-colors ${strikeSortField === "knee_point" ? "text-amber-300" : "text-amber-400"}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span>Sweet-Spot Knee</span>
                              {strikeSortField === "knee_point" ? (
                                strikeSortDir === "asc" ? <ArrowUp className="w-3 h-3 text-amber-400" /> : <ArrowDown className="w-3 h-3 text-amber-400" />
                              ) : (
                                <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-60" />
                              )}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {sortedRangeStrikes.map((s, idx) => {
                          const color = STRIKE_RANGE_COLORS[idx % STRIKE_RANGE_COLORS.length];
                          const isVisible = activeRangeStrikes.includes(s.key);
                          return (
                            <tr
                              key={s.key}
                              className={`hover:bg-slate-800/40 transition ${!isVisible ? "opacity-40" : ""}`}
                            >
                              <td className="py-2.5 font-bold flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                <span className="text-white">{s.key}</span>
                                <span className="text-slate-400 text-[10px] font-normal">(${s.target_strike})</span>
                              </td>
                              <td className="py-2.5 text-slate-300 font-semibold">${s.snapped_strike}</td>
                              <td className="py-2.5 text-slate-300">{s.cushion_to_strike_pct}% OTM</td>
                              <td className="py-2.5 text-slate-200 font-semibold">${s.avg_premium.toFixed(2)}</td>
                              <td className="py-2.5 text-emerald-400 font-bold">{s.avg_cash_return.toFixed(1)}% /yr</td>
                              <td className="py-2.5 text-blue-400 font-medium">{s.avg_margin_return.toFixed(1)}% /yr</td>
                              <td className="py-2.5 text-purple-300">{s.avg_iv.toFixed(1)}%</td>
                              <td className="py-2.5 text-amber-300 font-semibold">
                                {s.knee_point ? (
                                  <span className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-[11px] w-fit">
                                    <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                                    {s.knee_point.expiration} ({s.knee_point.dte}d) @ ${s.knee_point.premium.toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-slate-500 text-[10px]">N/A</span>
                                )}
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
          ) : (
            /* SINGLE TARGET STRIKE CHART */
            <div className="h-80 sm:h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={formattedExpPoints}
                  margin={{ top: 15, right: 30, left: 10, bottom: 25 }}
                >
                  <defs>
                    <linearGradient id="expPremiumFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="shortLabel"
                    stroke="#64748b"
                    fontSize={11}
                    angle={-20}
                    textAnchor="end"
                    height={45}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#06b6d4"
                    fontSize={11}
                    unit="$"
                    domain={[0, "auto"]}
                    label={{ value: "Option Premium ($)", angle: -90, position: "insideLeft", fill: "#06b6d4", fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#10b981"
                    fontSize={11}
                    unit="%"
                    domain={[0, "auto"]}
                    label={{ value: "Cash Return (Ann %)", angle: 90, position: "insideRight", fill: "#10b981", fontSize: 11 }}
                  />
                  <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "0.75rem" }} />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="premium"
                    name="Option Premium ($)"
                    stroke="#06b6d4"
                    strokeWidth={2.5}
                    fill="url(#expPremiumFill)"
                    dot={((props: any): any => {
                      const { cx, cy, payload, key: rechartsKey, index } = props;
                      const fallbackKey = rechartsKey || `exp-prem-${payload?.expiration || index}`;
                      if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) {
                        return <g key={`empty-${fallbackKey}`} />;
                      }
                      const pointId = `exp-prem-${payload.expiration}`;
                      const isSelected = selectedPointId === pointId;
                      return (
                        <g
                          key={fallbackKey}
                          className="cursor-pointer group"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPointId(pointId);
                            setInspectedCurvePoint({
                              ...payload,
                              themeColor: "#06b6d4",
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
                            fill={isSelected ? "#ffffff" : "#06b6d4"}
                            stroke={isSelected ? "#06b6d4" : "#0f172a"}
                            strokeWidth={isSelected ? 2.5 : 1.5}
                            className="transition-all duration-150 group-hover:scale-150 group-hover:stroke-white group-hover:stroke-[2px]"
                          />
                        </g>
                      );
                    }) as any}
                    activeDot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="annualized_return_cash_secured"
                    name="Cash-Secured Return (Ann %)"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={((props: any): any => {
                      const { cx, cy, payload, key: rechartsKey, index } = props;
                      const fallbackKey = rechartsKey || `exp-ret-${payload?.expiration || index}`;
                      if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) {
                        return <g key={`empty-${fallbackKey}`} />;
                      }
                      const pointId = `exp-ret-${payload.expiration}`;
                      const isSelected = selectedPointId === pointId;
                      return (
                        <g
                          key={fallbackKey}
                          className="cursor-pointer group"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPointId(pointId);
                            setInspectedCurvePoint({
                              ...payload,
                              themeColor: "#10b981",
                            });
                          }}
                        >
                          <circle cx={cx} cy={cy} r={14} fill="transparent" />
                          {isSelected && (
                            <circle cx={cx} cy={cy} r={9} fill="none" stroke="#34d399" strokeWidth={2.5} className="animate-pulse" />
                          )}
                          <circle
                            cx={cx}
                            cy={cy}
                            r={isSelected ? 6 : 4}
                            fill={isSelected ? "#ffffff" : "#10b981"}
                            stroke={isSelected ? "#10b981" : "#0f172a"}
                            strokeWidth={isSelected ? 2.5 : 1.5}
                            className="transition-all duration-150 group-hover:scale-150 group-hover:stroke-white group-hover:stroke-[2px]"
                          />
                        </g>
                      );
                    }) as any}
                    activeDot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Point Inspector */}
          {inspectedCurvePoint && (
            <ChartPointInspector
              point={inspectedCurvePoint}
              onClose={() => setInspectedCurvePoint(null)}
              themeColor="#06b6d4"
            />
          )}
        </div>
      )}

      {/* VIEW MODE 2: MULTI-EXPIRATION STRIKE OVERLAY */}
      {viewMode === "multi_exp_strike" && analysis && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
                <span>{analysis.ticker} {optionType.toUpperCase()} Premium vs Strike</span>
                {analysis.current_price && (
                  <span className="text-xs px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono font-bold">
                    Spot: ${analysis.current_price.toFixed(2)}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Comparing {expirations.length} expiration horizons ({priceType.toUpperCase()} values)
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="flex items-center gap-1.5 text-blue-400">
              <Sparkles className="w-3.5 h-3.5" />
              Click any specific dot on any expiration curve to inspect its contract specifications, yield & technical indicators
            </span>
          </div>

          <div className="h-80 sm:h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="strike"
                  stroke="#64748b"
                  fontSize={11}
                  label={{ value: "Strike Price ($)", position: "insideBottom", offset: -10, fill: "#94a3b8" }}
                />
                <YAxis
                  scale={useLogScale ? "log" : "linear"}
                  domain={useLogScale ? ["auto", "auto"] : [0, "auto"]}
                  stroke="#64748b"
                  fontSize={11}
                  label={{ value: "Option Premium ($)", angle: -90, position: "insideLeft", fill: "#94a3b8" }}
                />
                <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "0.75rem" }} />

                {/* Vertical Put Strategy Highlighting (When Spread is Selected) */}
                {selectedVerticalPutSpread && (
                  <>
                    <ReferenceArea
                      x1={selectedVerticalPutSpread.buyStrike}
                      x2={selectedVerticalPutSpread.sellStrike}
                      fill="#10b981"
                      fillOpacity={0.12}
                      stroke="#10b981"
                      strokeOpacity={0.4}
                      strokeDasharray="3 3"
                    />
                    <ReferenceLine
                      x={selectedVerticalPutSpread.sellStrike}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      label={{
                        value: `SELL $${selectedVerticalPutSpread.sellStrike}`,
                        fill: "#34d399",
                        fontSize: 10,
                        position: "top",
                      }}
                    />
                    <ReferenceLine
                      x={selectedVerticalPutSpread.buyStrike}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      label={{
                        value: `BUY $${selectedVerticalPutSpread.buyStrike}`,
                        fill: "#fbbf24",
                        fontSize: 10,
                        position: "top",
                      }}
                    />
                  </>
                )}

                {expirations.map((exp, idx) => {
                  const color = EXPIRATION_COLORS[idx % EXPIRATION_COLORS.length];
                  const isActiveExp = exp === (optimizerExp || expirations[0]);
                  return (
                    <Line
                      key={exp}
                      type="monotone"
                      dataKey={exp}
                      name={exp}
                      stroke={color}
                      strokeWidth={isActiveExp && selectedVerticalPutSpread ? 3 : 2}
                      dot={((props: any): any => {
                        const { cx, cy, payload, key: rechartsKey, index } = props;
                        const fallbackKey = rechartsKey || `strike-${exp}-${payload?.strike ?? index}`;
                        if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) {
                          return <g key={`empty-${fallbackKey}`} />;
                        }
                        const rec = payload?.detailsByExp?.[exp];
                        if (!rec) return <g key={`empty-${fallbackKey}`} />;
                        const pointId = `strike-${exp}-${payload.strike}`;
                        const isSelected = selectedPointId === pointId;
                        const isSellLeg = isActiveExp && selectedVerticalPutSpread && selectedVerticalPutSpread.sellStrike === payload.strike;
                        const isBuyLeg = isActiveExp && selectedVerticalPutSpread && selectedVerticalPutSpread.buyStrike === payload.strike;

                        return (
                          <g
                            key={fallbackKey}
                            className="cursor-pointer group"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPointId(pointId);
                              setInspectedCurvePoint({
                                ...rec,
                                ticker: analysis.ticker,
                                spot: analysis.current_price,
                                moneyness: analysis.current_price ? (rec.strike / analysis.current_price) * 100 : 100,
                                returnCashSecured: rec.annualized_return_cash_secured || rec.annualized_return_margin || 0,
                                returnMargin: rec.annualized_return_margin || 0,
                                returnPct: rec.annualized_return_cash_secured || rec.annualized_return_margin || 0,
                                rsi_14: analysis.rsi_14,
                                bollinger: analysis.bollinger,
                                fibonacci: analysis.fibonacci,
                                fiftyTwoWeekHigh: analysis.fifty_two_week_high,
                                fiftyTwoWeekLow: analysis.fifty_two_week_low,
                                themeColor: color,
                              });
                            }}
                          >
                            <circle cx={cx} cy={cy} r={14} fill="transparent" />
                            {isSellLeg && (
                              <circle cx={cx} cy={cy} r={10} fill="none" stroke="#10b981" strokeWidth={2.5} className="animate-pulse" />
                            )}
                            {isBuyLeg && (
                              <circle cx={cx} cy={cy} r={10} fill="none" stroke="#f59e0b" strokeWidth={2.5} className="animate-pulse" />
                            )}
                            {isSelected && !isSellLeg && !isBuyLeg && (
                              <circle cx={cx} cy={cy} r={9} fill="none" stroke="#38bdf8" strokeWidth={2.5} className="animate-pulse" />
                            )}
                            <circle
                              cx={cx}
                              cy={cy}
                              r={isSelected || isSellLeg || isBuyLeg ? 6 : 4}
                              fill={isSellLeg ? "#10b981" : isBuyLeg ? "#f59e0b" : isSelected ? "#ffffff" : color}
                              stroke={isSellLeg ? "#ffffff" : isBuyLeg ? "#ffffff" : isSelected ? color : "#0f172a"}
                              strokeWidth={isSelected || isSellLeg || isBuyLeg ? 2.5 : 1.5}
                              className="transition-all duration-150 group-hover:scale-150 group-hover:stroke-white group-hover:stroke-[2px]"
                            />
                          </g>
                        );
                      }) as any}
                      activeDot={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Point Inspector */}
          {inspectedCurvePoint && (
            <ChartPointInspector
              point={inspectedCurvePoint}
              onClose={() => setInspectedCurvePoint(null)}
              themeColor="#3b82f6"
            />
          )}

          {/* Vertical Put Strategy Optimizer for Strike Curve */}
          {optionType === "put" && (
            <div className="mt-5">
              <VerticalPutOptimizerPanel
                ticker={analysis.ticker}
                expiration={optimizerExp || expirations[0] || ""}
                spotPrice={analysis.current_price || 0}
                dte={getDteFromExp(optimizerExp || expirations[0] || "")}
                data={(analysis.records || [])
                  .filter((r) => r.expiration === (optimizerExp || expirations[0]))
                  .map((r) => ({
                    strike: r.strike,
                    bid: r.bid > 0 ? r.bid : (r.lastPrice > 0 ? (r.ask > 0 ? Math.min(r.lastPrice, r.ask) : r.lastPrice) : 0),
                    ask: r.ask > 0 ? r.ask : (r.lastPrice > 0 ? (r.bid > 0 ? Math.max(r.lastPrice, r.bid) : r.lastPrice) : 0),
                    premium: r.bid > 0 ? r.bid : (r.lastPrice > 0 ? (r.ask > 0 ? Math.min(r.lastPrice, r.ask) : r.lastPrice) : 0),
                    days_to_expiration: getDteFromExp(r.expiration),
                    current_price: analysis.current_price || 0,
                  }))}
                selectedSpread={selectedVerticalPutSpread}
                onSelectSpread={setSelectedVerticalPutSpread}
                availableExpirations={expirations}
                selectedExpiration={optimizerExp || expirations[0] || ""}
                onSelectExpiration={(newExp) => setOptimizerExp(newExp)}
              />
            </div>
          )}
        </div>
      )}

      {/* Analytical Callouts Matrix */}
      {viewMode === "multi_exp_strike" && analysis && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-[11px] text-blue-400 font-bold uppercase tracking-wider block mb-1">
              Highest Premium / Strike Ratio
            </span>
            {analysis.highest_ratio_point ? (
              <div>
                <span className="text-xl font-bold text-white font-mono">
                  ${analysis.highest_ratio_point.strike.toFixed(2)} Strike
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  Expiration: <span className="text-slate-200">{analysis.highest_ratio_point.expiration}</span>
                </p>
                <p className="text-xs text-emerald-400 font-mono font-semibold mt-0.5">
                  Premium: ${analysis.highest_ratio_point.premium.toFixed(2)} (Ratio: {analysis.highest_ratio_point.premium_to_strike})
                </p>
              </div>
            ) : (
              <span className="text-xs text-slate-500">N/A</span>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider block mb-1">
              Steepest Adjacent Strike Slope
            </span>
            {analysis.steepest_slopes && analysis.steepest_slopes.length > 0 ? (
              <div>
                <span className="text-xl font-bold text-white font-mono">
                  Δ ${analysis.steepest_slopes[0].slope.toFixed(2)} / $1 Strike
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  Between ${analysis.steepest_slopes[0].strike_a} and ${analysis.steepest_slopes[0].strike_b} ({analysis.steepest_slopes[0].expiration})
                </p>
              </div>
            ) : (
              <span className="text-xs text-slate-500">N/A</span>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-[11px] text-amber-400 font-bold uppercase tracking-wider block mb-1">
              Widest Inter-Expiration Spread Gap
            </span>
            {analysis.gap_markers && analysis.gap_markers.length > 0 ? (
              <div>
                <span className="text-xl font-bold text-white font-mono">
                  ${analysis.gap_markers[0].gap.toFixed(2)} Gap
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  At ${analysis.gap_markers[0].strike} Strike ({analysis.gap_markers[0].exp_a} vs {analysis.gap_markers[0].exp_b})
                </p>
              </div>
            ) : (
              <span className="text-xs text-slate-500">N/A</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

