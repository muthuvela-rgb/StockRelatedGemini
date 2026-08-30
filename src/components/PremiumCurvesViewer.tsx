import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Search,
  RefreshCw,
  Sliders,
  Maximize2,
  AlertCircle,
  HelpCircle,
  BarChart2
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { PremiumCurveAnalysis } from "../types";
import { formatCurrency, formatPct } from "../lib/utils";

const EXPIRATION_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // purple
  "#06b6d4", // cyan
];

export const PremiumCurvesViewer: React.FC = () => {
  const [ticker, setTicker] = useState("QQQ");
  const [optionType, setOptionType] = useState<"put" | "call">("put");
  const [priceType, setPriceType] = useState<"bid" | "ask">("bid");
  const [numExpirations, setNumExpirations] = useState(4);
  const [strikeRange, setStrikeRange] = useState("30-110");
  const [useLogScale, setUseLogScale] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<PremiumCurveAnalysis | null>(null);

  const fetchCurves = async () => {
    setLoading(true);
    setError(null);
    try {
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
    } catch (e: any) {
      setError(e.message || "Failed to analyze premium curves");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurves();
  }, [optionType, priceType, numExpirations]);

  // Pivot records for multi-line chart (each strike row has exp1, exp2, etc.)
  const expirations = analysis?.expirations || [];
  const chartDataMap: Record<number, any> = {};

  if (analysis?.records) {
    for (const r of analysis.records) {
      if (!chartDataMap[r.strike]) {
        chartDataMap[r.strike] = { strike: r.strike };
      }
      chartDataMap[r.strike][r.expiration] = r.premium;
    }
  }

  const chartData = Object.values(chartDataMap).sort((a, b) => a.strike - b.strike);

  return (
    <div className="space-y-6">
      {/* Search and Options */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white font-display flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              Premium vs Strike & Expiration Curve Visualizer
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Visualizes options decay curves across multiple expirations, identifies steepest adjacent slope steps, widest 5% price bins, and curve vertical gaps.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && fetchCurves()}
              placeholder="Ticker"
              className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-bold w-28 uppercase outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={fetchCurves}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Plot Curves
            </button>
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
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Chart Canvas */}
      {analysis && (
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
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "0.5rem" }}
                  itemStyle={{ fontSize: "0.75rem", fontFamily: "monospace" }}
                  labelStyle={{ color: "#93c5fd", fontWeight: "bold", fontSize: "0.8rem" }}
                  formatter={(val: any) => [`$${Number(val).toFixed(2)}`, "Premium"]}
                  labelFormatter={(label) => `Strike: $${Number(label).toFixed(2)}`}
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
      {analysis && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Highest Ratio */}
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

          {/* Steepest Slope */}
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

          {/* Widest Gap */}
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
