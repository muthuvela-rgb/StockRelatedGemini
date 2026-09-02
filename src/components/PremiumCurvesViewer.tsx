import React, { useState, useEffect } from "react";
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
  ChevronRight
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
  ComposedChart
} from "recharts";
import { PremiumCurveAnalysis, PremiumVsExpirationAnalysis } from "../types";
import { formatCurrency, formatPct } from "../lib/utils";
import { BollingerRsiTooltipBadge } from "./BollingerRsiTooltipBadge";
import { ChartPointInspector } from "./ChartPointInspector";

const EXPIRATION_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // purple
  "#06b6d4", // cyan
];

export const PremiumCurvesViewer: React.FC = () => {
  const [viewMode, setViewMode] = useState<"multi_exp_strike" | "single_strike_exp">("single_strike_exp");
  const [ticker, setTicker] = useState("QQQ");
  const [optionType, setOptionType] = useState<"put" | "call">("put");
  const [priceType, setPriceType] = useState<"bid" | "ask">("bid");
  const [numExpirations, setNumExpirations] = useState(4);
  const [strikeRange, setStrikeRange] = useState("30-110");
  const [useLogScale, setUseLogScale] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Multi-exp data
  const [analysis, setAnalysis] = useState<PremiumCurveAnalysis | null>(null);

  // Single target strike vs expiration data
  const [singleStrikeType, setSingleStrikeType] = useState<"dollar" | "pct">("pct");
  const [targetStrike, setTargetStrike] = useState<number | string>("");
  const [targetStrikePct, setTargetStrikePct] = useState<number>(85);
  const [expAnalysis, setExpAnalysis] = useState<PremiumVsExpirationAnalysis | null>(null);
  const [showSecondaryReturnLine, setShowSecondaryReturnLine] = useState(true);
  const [inspectedCurvePoint, setInspectedCurvePoint] = useState<any | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  const fetchCurves = async () => {
    setLoading(true);
    setError(null);
    try {
      if (viewMode === "multi_exp_strike") {
        const q = new URLSearchParams({
          ticker,
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
          ticker,
          optionType,
          priceType,
        });
        if (singleStrikeType === "dollar" && targetStrike) {
          q.set("targetStrike", String(targetStrike));
        } else {
          q.set("targetStrikePct", String(targetStrikePct));
        }

        const res = await fetch(`/api/premium-vs-expiration?${q.toString()}`);
        if (!res.ok) throw new Error(`Server returned ${res.status}: ${res.statusText}`);
        const data: PremiumVsExpirationAnalysis = await res.json();
        setExpAnalysis(data);
      }
    } catch (e: any) {
      setError(e.message || "Failed to analyze premium curves");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurves();
  }, [viewMode, optionType, priceType, numExpirations]);

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
                Premium vs Strike Curves
              </button>
            </div>

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
          </div>
        </div>

        {/* Options Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Option Type</label>
            <select
              value={optionType}
              onChange={(e) => setOptionType(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 outline-none"
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
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 outline-none"
            >
              <option value="bid">Bid Price</option>
              <option value="ask">Ask Price</option>
            </select>
          </div>

          {viewMode === "single_strike_exp" ? (
            <div className="col-span-2 flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">Target Strike Mode</label>
                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      onClick={() => setSingleStrikeType("pct")}
                      className={`cursor-pointer ${singleStrikeType === "pct" ? "text-cyan-400 font-bold underline" : "text-slate-400"}`}
                    >
                      % Spot
                    </button>
                    <span>|</span>
                    <button
                      onClick={() => setSingleStrikeType("dollar")}
                      className={`cursor-pointer ${singleStrikeType === "dollar" ? "text-cyan-400 font-bold underline" : "text-slate-400"}`}
                    >
                      Dollar ($)
                    </button>
                  </div>
                </div>

                {singleStrikeType === "pct" ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={targetStrikePct}
                      onChange={(e) => setTargetStrikePct(parseFloat(e.target.value) || 85)}
                      className="w-20 bg-slate-800 border border-slate-700 text-white font-mono rounded px-2.5 py-1.5 text-xs outline-none"
                    />
                    <span className="text-slate-400 text-xs">% of Spot</span>
                    <div className="hidden sm:flex items-center gap-1 ml-auto">
                      {[75, 80, 85, 90, 95, 100].map((p) => (
                        <button
                          key={p}
                          onClick={() => setTargetStrikePct(p)}
                          className={`px-1.5 py-0.5 rounded text-[10px] ${targetStrikePct === p ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400"}`}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-xs">$</span>
                    <input
                      type="number"
                      step="0.5"
                      value={targetStrike}
                      onChange={(e) => setTargetStrike(e.target.value)}
                      placeholder="e.g. 580"
                      className="w-28 bg-slate-800 border border-slate-700 text-white font-mono rounded px-2.5 py-1.5 text-xs outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Expirations to Overlay</label>
                <select
                  value={numExpirations}
                  onChange={(e) => setNumExpirations(parseInt(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 outline-none"
                >
                  <option value="2">2 Expirations</option>
                  <option value="3">3 Expirations</option>
                  <option value="4">4 Expirations</option>
                  <option value="5">5 Expirations</option>
                  <option value="6">6 Expirations</option>
                </select>
              </div>

              <div className="flex items-end pb-1">
                <button
                  onClick={() => setUseLogScale(!useLogScale)}
                  className={`w-full py-1.5 px-3 rounded-lg border text-xs font-semibold transition ${
                    useLogScale
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                  }`}
                >
                  {useLogScale ? "Log Scale (Y-axis)" : "Linear Scale (Y-axis)"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* VIEW MODE 1: SINGLE TARGET STRIKE (PREMIUM $ VS EXPIRATION DATE) */}
      {viewMode === "single_strike_exp" && expAnalysis && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span>{expAnalysis.ticker} {optionType.toUpperCase()} • Premium ($) vs Expiration Date</span>
                <span className="text-xs px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono font-bold">
                  Spot: ${expAnalysis.current_price.toFixed(2)}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-mono font-bold">
                  Target Strike: ${expAnalysis.target_strike.toFixed(2)} ({expAnalysis.target_strike_pct.toFixed(1)}%)
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Visualizes premium progression across {formattedExpPoints.length} expiration dates snapped to closest listed strikes
              </p>
            </div>

            {kneePoint && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Knee Point: <strong>{kneePoint.expiration} ({kneePoint.dte}d)</strong> @ ${kneePoint.premium.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <Sparkles className="w-3.5 h-3.5" />
              Click any individual dot on the curves to inspect full contract specifications & technical indicators
            </span>
          </div>

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
                  label={{ value: "Annualized Return (%)", angle: 90, position: "insideRight", fill: "#10b981", fontSize: 11 }}
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
                    const { cx, cy, payload } = props;
                    if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) return <g key="empty" />;
                    const pointId = `exp-prem-${payload.expiration}`;
                    const isSelected = selectedPointId === pointId;
                    return (
                      <g
                        key={pointId}
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
                  dataKey="annualized_return_margin"
                  name="Annualized Return Margin %"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={((props: any): any => {
                    const { cx, cy, payload } = props;
                    if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) return <g key="empty" />;
                    const pointId = `exp-ret-${payload.expiration}`;
                    const isSelected = selectedPointId === pointId;
                    return (
                      <g
                        key={pointId}
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
                {expirations.map((exp, idx) => {
                  const color = EXPIRATION_COLORS[idx % EXPIRATION_COLORS.length];
                  return (
                    <Line
                      key={exp}
                      type="monotone"
                      dataKey={exp}
                      name={exp}
                      stroke={color}
                      strokeWidth={2}
                      dot={((props: any): any => {
                        const { cx, cy, payload } = props;
                        if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) return <g key="empty" />;
                        const rec = payload?.detailsByExp?.[exp];
                        if (!rec) return <g key="empty" />;
                        const pointId = `strike-${exp}-${payload.strike}`;
                        const isSelected = selectedPointId === pointId;

                        return (
                          <g
                            key={pointId}
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

