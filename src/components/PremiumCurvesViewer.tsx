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

          <div className="h-80 sm:h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={formattedExpPoints} margin={{ top: 15, right: 30, left: 10, bottom: 25 }}>
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
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d: any = payload[0].payload;
                      const spot = expAnalysis?.current_price || null;
                      const isPut = optionType === "put";
                      const strikeDiff = d.strike_diff !== undefined ? d.strike_diff : Math.abs(d.snapped_strike - d.target_strike);
                      const isOTM = spot ? (isPut ? d.snapped_strike < spot : d.snapped_strike > spot) : false;
                      const isITM = spot ? (isPut ? d.snapped_strike > spot : d.snapped_strike < spot) : false;
                      const otmPct = spot ? Math.abs((1 - d.snapped_strike / spot) * 100) : 0;
                      const formattedDate = formatExpDateDetail(d.expiration);
                      const spread = (d.ask || 0) - (d.bid || 0);
                      const spreadPct = d.bid > 0 ? (spread / d.bid) * 100 : 0;

                      return (
                        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl text-xs text-slate-200 min-w-[310px] max-w-[380px] pointer-events-none z-50">
                          {/* Header: Strike & Expiration */}
                          <div className="border-b border-slate-800 pb-2.5 mb-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white font-mono">
                                  ${d.snapped_strike.toFixed(2)} Strike
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                  {expAnalysis.ticker} {optionType.toUpperCase()}
                                </span>
                              </div>
                              <span className="text-cyan-400 font-mono font-bold text-xs">
                                {d.expiration}
                              </span>
                            </div>

                            <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400 font-sans">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-500" /> {formattedDate}
                              </span>
                              <span className="font-mono font-bold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                                {d.dte} DTE
                              </span>
                            </div>

                            {strikeDiff > 0.01 && (
                              <div className="text-[10px] text-slate-400 mt-1 font-mono">
                                Target: ${d.target_strike.toFixed(2)} → Snapped to listed ${d.snapped_strike.toFixed(2)} (Δ ${strikeDiff.toFixed(2)})
                              </div>
                            )}
                          </div>

                          {/* Pricing & Quotes */}
                          <div className="space-y-1.5 font-mono text-[11px]">
                            <div className="bg-slate-950/70 rounded-lg p-2.5 border border-slate-800/80 space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-slate-400">Bid Premium (Selected):</span>
                                <span className="text-cyan-300 font-bold text-sm">${d.bid.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Ask Premium:</span>
                                <span className="text-slate-300">${d.ask.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Bid-Ask Spread:</span>
                                <span className="text-slate-300">${spread.toFixed(2)} ({spreadPct.toFixed(1)}%)</span>
                              </div>
                              {d.last_price > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Last Traded Price:</span>
                                  <span className="text-slate-300">${d.last_price.toFixed(2)}</span>
                                </div>
                              )}
                            </div>

                            {/* Moneyness & Distance */}
                            <div className="bg-slate-950/70 rounded-lg p-2.5 border border-slate-800/80 space-y-1 text-[10px]">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Spot Moneyness:</span>
                                <span className="text-slate-200 font-semibold">{d.moneyness_pct.toFixed(1)}% of spot</span>
                              </div>
                              {spot && (
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Moneyness Status:</span>
                                  <span className={isOTM ? "text-cyan-400 font-semibold" : isITM ? "text-rose-400 font-semibold" : "text-amber-400 font-semibold"}>
                                    {isOTM ? `${otmPct.toFixed(1)}% OTM (Buffer: $${Math.abs(spot - d.snapped_strike).toFixed(2)})` : isITM ? `${otmPct.toFixed(1)}% ITM` : "At The Money"}
                                  </span>
                                </div>
                              )}
                              {d.implied_volatility > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Implied Volatility (IV):</span>
                                  <span className="text-purple-300 font-semibold">{(d.implied_volatility * 100).toFixed(1)}%</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-slate-400">Volume / Open Int:</span>
                                <span className="text-slate-300">{(d.volume || 0).toLocaleString()} / {(d.open_interest || 0).toLocaleString()}</span>
                              </div>
                            </div>

                            {/* Annualized Returns & Collateral */}
                            <div className="bg-slate-950/70 rounded-lg p-2.5 border border-slate-800/80 space-y-1 text-[10px]">
                              <div className="flex justify-between items-center">
                                <span className="text-slate-400">Portfolio Margin Return:</span>
                                <span className="text-emerald-400 font-bold text-xs">{d.annualized_return_margin.toFixed(1)}% / yr</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Cash-Secured Return:</span>
                                <span className="text-emerald-300/80">{d.annualized_return_cash_secured.toFixed(1)}% / yr</span>
                              </div>
                              {d.capital_basis_margin > 0 && (
                                <div className="flex justify-between text-[10px] text-slate-500 pt-0.5 border-t border-slate-800/50">
                                  <span>Est. Margin Collateral:</span>
                                  <span>{formatCurrency(d.capital_basis_margin)} / contract</span>
                                </div>
                              )}
                            </div>

                            {d.isKnee && (
                              <div className="mt-2 text-center bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg p-1.5 font-bold font-sans text-[11px] flex items-center justify-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span>Optimal Knee of the Curve / Decay Sweet Spot</span>
                              </div>
                            )}

                            {/* Bollinger Bands, RSI & Fibonacci Retracement Technical Indicators */}
                            <BollingerRsiTooltipBadge
                              strike={d.snapped_strike || d.target_strike}
                              spot={spot}
                              rsi={d.rsi_14 || expAnalysis?.rsi_14}
                              bollinger={d.bollinger || expAnalysis?.bollinger}
                              fibonacci={d.fibonacci || expAnalysis?.fibonacci}
                              fiftyTwoWeekHigh={expAnalysis?.fifty_two_week_high}
                              fiftyTwoWeekLow={expAnalysis?.fifty_two_week_low}
                              strikePosition={d.strike_bollinger_position}
                            />
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
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
                  dot={{ r: 3.5, fill: "#06b6d4" }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="annualized_return_margin"
                  name="Annualized Return Margin %"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: "#10b981" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
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

          <div className="h-80 sm:h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
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
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const strike = Number(label);
                    const spot = analysis?.current_price || null;
                    const strikeData = chartDataMap[strike];
                    const detailsByExp = strikeData?.detailsByExp || {};

                    const isPut = optionType === "put";
                    const distFromSpot = spot ? strike - spot : 0;
                    const isOTM = spot ? (isPut ? strike < spot : strike > spot) : false;
                    const isITM = spot ? (isPut ? strike > spot : strike < spot) : false;
                    const otmDistPct = spot ? Math.abs((1 - strike / spot) * 100) : 0;

                    return (
                      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl text-xs text-slate-200 min-w-[310px] max-w-[390px] pointer-events-none z-50">
                        {/* Header: Strike & Spot Relationship */}
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-2.5">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm font-mono">
                                ${strike.toFixed(2)} Strike
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                                isPut ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              }`}>
                                {ticker} {optionType.toUpperCase()}
                              </span>
                            </div>
                            {spot && (
                              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 font-mono">
                                <span>Spot: ${spot.toFixed(2)}</span>
                                <span>•</span>
                                <span className={isOTM ? "text-cyan-400 font-semibold" : isITM ? "text-rose-400 font-semibold" : "text-amber-400 font-semibold"}>
                                  {isOTM ? `${otmDistPct.toFixed(1)}% OTM` : isITM ? `${otmDistPct.toFixed(1)}% ITM` : "ATM"}
                                </span>
                                <span>({distFromSpot >= 0 ? `+$${distFromSpot.toFixed(2)}` : `-$${Math.abs(distFromSpot).toFixed(2)}`})</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Expiration Details List */}
                        <div className="space-y-2">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                            <span>Expiration & Quotes</span>
                            <span>{priceType.toUpperCase()} Premium</span>
                          </div>

                          {payload.map((entry: any, i: number) => {
                            const exp = entry.dataKey as string;
                            const prem = Number(entry.value);
                            const rec: any = detailsByExp[exp];
                            const dte = getDteFromExp(exp);
                            const formattedDate = formatExpDateDetail(exp);

                            return (
                              <div
                                key={i}
                                className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 space-y-1 font-mono text-[11px]"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow"
                                      style={{ backgroundColor: entry.color || EXPIRATION_COLORS[i % EXPIRATION_COLORS.length] }}
                                    />
                                    <span className="font-bold text-slate-100 text-xs">{exp}</span>
                                    <span className="text-[10px] text-slate-400 font-sans">({dte} DTE)</span>
                                  </div>
                                  <span className="text-sm font-black text-cyan-300">
                                    ${prem.toFixed(2)}
                                  </span>
                                </div>

                                <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-slate-500" />
                                  <span>{formattedDate}</span>
                                </div>

                                {rec && (
                                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1.5 mt-1 border-t border-slate-800/80 text-[10px]">
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Bid / Ask:</span>
                                      <span className="text-slate-300 font-semibold">${rec.bid?.toFixed(2)} / ${rec.ask?.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Spread:</span>
                                      <span className="text-slate-300 font-semibold">${(rec.ask - rec.bid)?.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Yield/Strike:</span>
                                      <span className="text-emerald-400 font-semibold">{((rec.premium / strike) * 100).toFixed(2)}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Vol / OI:</span>
                                      <span className="text-slate-300">{(rec.volume || 0).toLocaleString()} / {(rec.openInterest || 0).toLocaleString()}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Inter-Expiration Spread Delta (if 2+ curves) */}
                        {payload.length >= 2 && (
                          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>Inter-Exp Spread (Time Value Gap):</span>
                            <span className="text-cyan-400 font-bold">
                              +${(Number(payload[payload.length - 1].value) - Number(payload[0].value)).toFixed(2)}
                            </span>
                          </div>
                        )}

                        {/* Bollinger Bands, RSI & Fibonacci Retracement Technical Indicators */}
                        {analysis && (
                          <BollingerRsiTooltipBadge
                            strike={strike}
                            spot={analysis.current_price}
                            rsi={analysis.rsi_14}
                            bollinger={analysis.bollinger}
                            fibonacci={analysis.fibonacci}
                            fiftyTwoWeekHigh={analysis.fifty_two_week_high}
                            fiftyTwoWeekLow={analysis.fifty_two_week_low}
                            strikePosition={
                              (payload[0]?.dataKey ? detailsByExp[String(payload[0].dataKey)]?.strike_bollinger_position : undefined) ||
                              (analysis.bollinger
                                ? {
                                    zone: strike < analysis.bollinger.lower_band ? "below_lower" : strike >= analysis.bollinger.upper_band ? "above_upper" : "within_bands",
                                    zone_label: strike < analysis.bollinger.lower_band ? "Below Lower Band" : strike >= analysis.bollinger.upper_band ? "Above Upper Band" : "Within Bands",
                                    is_below_lower: strike < analysis.bollinger.lower_band,
                                    diff_from_lower: Number((strike - analysis.bollinger.lower_band).toFixed(2)),
                                    pct_from_lower: Number(((strike - analysis.bollinger.lower_band) / analysis.bollinger.lower_band * 100).toFixed(1)),
                                    lower_band: analysis.bollinger.lower_band,
                                    sma: analysis.bollinger.sma,
                                    upper_band: analysis.bollinger.upper_band,
                                  }
                                : undefined)
                            }
                          />
                        )}
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "0.75rem" }} />
                {expirations.map((exp, idx) => (
                  <Line
                    key={exp}
                    type="monotone"
                    dataKey={exp}
                    name={exp}
                    stroke={EXPIRATION_COLORS[idx % EXPIRATION_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
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

