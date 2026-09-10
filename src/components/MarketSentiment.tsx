import React, { useState, useEffect, useMemo } from "react";
import {
  Gauge,
  Activity,
  TrendingDown,
  TrendingUp,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  Sliders,
  Zap,
  Clock,
  Layers,
  HelpCircle,
  BarChart3,
  Calendar,
  Compass,
  DollarSign,
  Info
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from "recharts";
import { MarketSentimentData, StrategyGuideline } from "../types";
import { ActiveTab } from "./Header";

interface MarketSentimentProps {
  onNavigateTab?: (tab: ActiveTab) => void;
}

export const MarketSentiment: React.FC<MarketSentimentProps> = ({ onNavigateTab }) => {
  const [data, setData] = useState<MarketSentimentData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [activeChartTab, setActiveChartTab] = useState<"fear_greed" | "vix" | "combined">("fear_greed");

  const fetchSentiment = async (isManual = false) => {
    if (isManual) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/market-sentiment");
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json: MarketSentimentData = await res.json();
      setData(json);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message || "Failed to load market sentiment data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSentiment();
    const timer = setInterval(() => fetchSentiment(false), 60000); // 60s auto refresh
    return () => clearInterval(timer);
  }, []);

  const fg = data?.fear_and_greed;
  const vix = data?.vix;
  const optionsCtx = data?.options_implications;

  // Rating color helper
  const getRatingTheme = (rating: string) => {
    const r = (rating || "").toLowerCase();
    if (r.includes("extreme fear")) return { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30", fill: "#f43f5e", label: "Extreme Fear" };
    if (r.includes("fear")) return { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", fill: "#f59e0b", label: "Fear" };
    if (r.includes("neutral")) return { text: "text-slate-300", bg: "bg-slate-700/30", border: "border-slate-600/40", fill: "#94a3b8", label: "Neutral" };
    if (r.includes("extreme greed")) return { text: "text-emerald-300", bg: "bg-emerald-500/20", border: "border-emerald-500/40", fill: "#10b981", label: "Extreme Greed" };
    if (r.includes("greed")) return { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", fill: "#34d399", label: "Greed" };
    return { text: "text-slate-300", bg: "bg-slate-800", border: "border-slate-700", fill: "#64748b", label: "Neutral" };
  };

  const getVixTheme = (tier: string) => {
    switch (tier) {
      case "LOW":
        return { text: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/30", badge: "Low Volatility (Complacent)" };
      case "NORMAL":
        return { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", badge: "Normal Volatility (Healthy)" };
      case "ELEVATED":
        return { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", badge: "Elevated Risk (High Premiums)" };
      case "HIGH":
        return { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", badge: "High Volatility (Fear Spike)" };
      case "PANIC":
        return { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30", badge: "Extreme Panic (Crisis)" };
      default:
        return { text: "text-slate-300", bg: "bg-slate-800", border: "border-slate-700", badge: "Normal" };
    }
  };

  const fgTheme = getRatingTheme(fg?.rating || "neutral");
  const vixTheme = getVixTheme(vix?.regime_tier || "NORMAL");

  // Format historical chart data
  const chartData = useMemo(() => {
    if (!fg?.historical || fg.historical.length === 0) return [];
    return fg.historical.map((pt) => ({
      date: pt.date.slice(5), // "MM-DD"
      fullDate: pt.date,
      fearGreed: pt.score,
      rating: pt.rating,
    }));
  }, [fg?.historical]);

  const vixChartData = useMemo(() => {
    if (!vix?.historical_30d || vix.historical_30d.length === 0) return [];
    return vix.historical_30d.map((pt) => ({
      date: pt.date.slice(5),
      fullDate: pt.date,
      vixClose: pt.close,
      vixHigh: pt.high,
      vixLow: pt.low,
    }));
  }, [vix?.historical_30d]);

  // Combined alignment by date
  const combinedChartData = useMemo(() => {
    if (!chartData.length || !vixChartData.length) return [];
    const vixMap = new Map(vixChartData.map((v) => [v.fullDate, v.vixClose]));
    return chartData.map((fgPt) => ({
      date: fgPt.date,
      fullDate: fgPt.fullDate,
      fearGreed: fgPt.fearGreed,
      vixClose: vixMap.get(fgPt.fullDate) || null,
    })).filter((pt) => pt.vixClose !== null);
  }, [chartData, vixChartData]);

  // SVG Gauge calculations (semi-circle needle)
  const renderGaugeSvg = (score: number) => {
    // Score 0 -> 180 deg (left), Score 100 -> 0 deg (right)
    const angle = 180 - (Math.max(0, Math.min(100, score)) / 100) * 180;
    const rad = (angle * Math.PI) / 180;
    const cx = 130;
    const cy = 115;
    const r = 85;
    const needleLength = 70;
    const nx = cx + needleLength * Math.cos(rad);
    const ny = cy - needleLength * Math.sin(rad);

    return (
      <svg viewBox="0 0 260 145" className="w-full max-w-[280px] mx-auto select-none overflow-visible">
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="25%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#94a3b8" />
            <stop offset="75%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>

        {/* Outer Track Arc */}
        <path
          d="M 30 120 A 100 100 0 0 1 230 120"
          fill="none"
          stroke="#1e293b"
          strokeWidth="16"
          strokeLinecap="round"
        />

        {/* Color Gradient Arc */}
        <path
          d="M 30 120 A 100 100 0 0 1 230 120"
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray="314"
          strokeDashoffset="0"
          className="opacity-90"
        />

        {/* Ticks & Segment Markers */}
        <line x1="80" y1="52" x2="84" y2="60" stroke="#475569" strokeWidth="2" />
        <line x1="130" y1="20" x2="130" y2="28" stroke="#475569" strokeWidth="2" />
        <line x1="180" y1="52" x2="176" y2="60" stroke="#475569" strokeWidth="2" />

        {/* Needle Line */}
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke="#f8fafc"
          strokeWidth="3.5"
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
        {/* Needle Pivot Cap */}
        <circle cx={cx} cy={cy} r="7" fill="#38bdf8" stroke="#0f172a" strokeWidth="2" />
        <circle cx={cx} cy={cy} r="3" fill="#ffffff" />

        {/* Labels at Extremes */}
        <text x="24" y="138" fill="#f87171" fontSize="10" fontWeight="600" textAnchor="middle">0</text>
        <text x="24" y="148" fill="#94a3b8" fontSize="8" textAnchor="middle">FEAR</text>
        <text x="130" y="15" fill="#94a3b8" fontSize="9" fontWeight="600" textAnchor="middle">50</text>
        <text x="236" y="138" fill="#34d399" fontSize="10" fontWeight="600" textAnchor="middle">100</text>
        <text x="236" y="148" fill="#94a3b8" fontSize="8" textAnchor="middle">GREED</text>
      </svg>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800/80 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Gauge className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-white tracking-tight">Market Sentiment & Volatility Cockpit</h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                    REAL-TIME
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Macro sentiment (CNN Fear & Greed) and volatility regime (CBOE VIX) correlated to guide optimal cash-secured put, covered call, and options hedging decisions.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start lg:self-center">
            <div className="text-right hidden sm:block">
              <div className="text-[11px] text-slate-400 flex items-center gap-1 justify-end">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>Updated: {lastRefreshed.toLocaleTimeString()}</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {data?.source || "Tradier Brokerage & Market Feed"}
              </div>
            </div>

            <button
              onClick={() => fetchSentiment(true)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 text-xs font-semibold transition cursor-pointer shadow-sm disabled:opacity-50"
              title="Refresh sentiment indicators"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : "text-slate-400"}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Global Strategy Verdict Banner */}
        {optionsCtx && (
          <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-950/40 p-3 rounded-xl border">
            <div className="flex items-start md:items-center gap-2.5">
              <div className={`p-1.5 rounded-lg shrink-0 ${
                optionsCtx.put_selling_environment === "HIGH_YIELD_OPPORTUNITY"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : optionsCtx.put_selling_environment === "FAVORABLE"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
              }`}>
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Options Regime:</span>
                  <span className={optionsCtx.put_selling_environment === "HIGH_YIELD_OPPORTUNITY" ? "text-amber-400" : "text-emerald-400"}>
                    {optionsCtx.environment_title}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 line-clamp-1 md:line-clamp-none">
                  {optionsCtx.volatility_skew_bias}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
              <span className="text-[11px] text-slate-400 font-mono">Recommended Delta:</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 text-xs font-mono font-bold border border-slate-700">
                {optionsCtx.recommended_delta.split(" ")[0]}
              </span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Error loading market sentiment: {error}. Using algorithmic fallback estimates.</span>
        </div>
      )}

      {/* 4 Primary Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Fear & Greed Gauge Summary */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800/80 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fear & Greed Index</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${fgTheme.bg} ${fgTheme.text} ${fgTheme.border}`}>
              {fg?.rating || "Neutral"}
            </span>
          </div>

          <div className="my-3 flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-extrabold tracking-tight ${fgTheme.text}`}>
                {fg?.score ?? "--"}
              </span>
              <span className="text-xs font-mono text-slate-500">/ 100</span>
            </div>
            <div className="text-right text-xs">
              <div className="text-slate-400 font-medium">Previous Close</div>
              <div className="font-mono text-slate-200">{fg?.previous_close ?? "--"}</div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/60 grid grid-cols-3 gap-1 text-center text-[10px] text-slate-400 font-mono">
            <div className="bg-slate-950/50 p-1.5 rounded">
              <span className="block text-slate-500">1W Ago</span>
              <span className="font-semibold text-slate-300">{fg?.previous_1_week ?? "--"}</span>
            </div>
            <div className="bg-slate-950/50 p-1.5 rounded">
              <span className="block text-slate-500">1M Ago</span>
              <span className="font-semibold text-slate-300">{fg?.previous_1_month ?? "--"}</span>
            </div>
            <div className="bg-slate-950/50 p-1.5 rounded">
              <span className="block text-slate-500">1Y Ago</span>
              <span className="font-semibold text-slate-300">{fg?.previous_1_year ?? "--"}</span>
            </div>
          </div>
        </div>

        {/* Card 2: VIX Real-Time Level */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800/80 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">CBOE Volatility (VIX)</span>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${vixTheme.bg} ${vixTheme.text} ${vixTheme.border}`}>
              {vix?.regime_tier || "NORMAL"}
            </span>
          </div>

          <div className="my-3 flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-white tracking-tight font-mono">
                {vix?.current ? vix.current.toFixed(2) : "--"}
              </span>
              <span className={`text-xs font-semibold flex items-center font-mono ${
                (vix?.change || 0) >= 0 ? "text-rose-400" : "text-emerald-400"
              }`}>
                {(vix?.change || 0) >= 0 ? "+" : ""}{vix?.change ? vix.change.toFixed(2) : "0.00"}
                <span className="ml-1 text-[11px]">
                  ({(vix?.change_pct || 0) >= 0 ? "+" : ""}{vix?.change_pct ? vix.change_pct.toFixed(2) : "0.00"}%)
                </span>
              </span>
            </div>
          </div>

          {/* 52W Range Bar */}
          <div className="space-y-1 text-[10px]">
            <div className="flex justify-between text-slate-400 font-mono">
              <span>52W L: {vix?.week_52_low ? vix.week_52_low.toFixed(1) : "12.0"}</span>
              <span className="text-cyan-400 font-bold">{vix?.percentile_52w ?? 0}%ile</span>
              <span>52W H: {vix?.week_52_high ? vix.week_52_high.toFixed(1) : "35.0"}</span>
            </div>
            <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-amber-400 to-rose-500 transition-all duration-500"
                style={{ width: `${Math.max(5, Math.min(100, vix?.percentile_52w || 15))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Volatility Skew & Put Demand */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800/80 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Hedging & Put Demand</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              ORATS / CBOE
            </span>
          </div>

          <div className="my-3 space-y-1">
            <div className="text-xs text-slate-300 font-medium">Put Pricing Edge:</div>
            <div className="text-sm font-bold text-emerald-400">
              {vix && vix.current > 20
                ? "Substantial Put Premium Expansion"
                : vix && vix.current < 14
                ? "Subdued Put Premium (Complacent)"
                : "Healthy Theta Decay Sweet-Spot"}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
              Downside puts command elevated implied volatility relative to at-the-money calls, inflating cash-secured put yields.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-300">
            <span className="text-slate-400">Target DTE Window:</span>
            <span className="font-mono text-cyan-400 font-semibold">{optionsCtx?.recommended_dte.split(" ")[0] || "30-45"} Days</span>
          </div>
        </div>

        {/* Card 4: Safety Strike & Margin Buffer */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800/80 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Risk Buffer Guidelines</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              OCC TIMS
            </span>
          </div>

          <div className="my-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Strike Distance:</span>
              <span className="font-bold text-white font-mono">{optionsCtx?.recommended_strike_discount.split(" ")[0] || "12%-18%"} OTM</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Cash Reserve:</span>
              <span className="font-bold text-amber-300 font-mono">{optionsCtx?.cash_buffer_guideline.split(" ")[1] || "20%-25%"}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Win Probability:</span>
              <span className="font-bold text-emerald-400 font-mono">~80% - 88%</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Assignment Stance:</span>
            <span className="font-semibold text-slate-200">High-Conviction Only</span>
          </div>
        </div>
      </div>

      {/* Center Section: Gauge Visualizer + Historical Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Semicircle Gauge & VIX Spectrum (4 cols) */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" />
                Sentiment Speedometer
              </h3>
              <span className={`text-xs font-mono font-bold ${fgTheme.text}`}>
                {fgTheme.label}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Real-time CNN sentiment composite meter tracking institutional positioning and market momentum.
            </p>

            {/* Gauge SVG */}
            <div className="py-2">
              {renderGaugeSvg(fg?.score ?? 50)}
            </div>

            <div className="mt-2 text-center">
              <div className={`text-2xl font-extrabold font-mono ${fgTheme.text}`}>
                {fg?.score ?? "--"}{" "}
                <span className="text-sm font-normal text-slate-400">({fgTheme.label})</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                {fg?.score && fg.score < 30
                  ? "Pessimism dominates headlines. Historically favorable entry territory for disciplined cash-secured put sellers."
                  : fg?.score && fg.score > 70
                  ? "Elevated optimism. Premiums are compressed; insist on steep strike discounts to withstand inevitable pullbacks."
                  : "Balanced sentiment. Favorable conditions for standard delta-neutral theta harvesting."}
              </p>
            </div>
          </div>

          {/* VIX Volatility Regime Spectrum */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-semibold">CBOE VIX Volatility Spectrum</span>
              <span className={`font-mono font-bold ${vixTheme.text}`}>
                {vix?.current ? vix.current.toFixed(2) : "16.5"} ({vix?.regime_tier || "NORMAL"})
              </span>
            </div>

            {/* 5-zone spectrum bar */}
            <div className="grid grid-cols-5 gap-1 h-3 rounded-md overflow-hidden bg-slate-950 p-0.5 border border-slate-800">
              <div
                className={`h-full rounded-sm transition ${
                  vix?.regime_tier === "LOW" ? "bg-sky-400 shadow-sm shadow-sky-400/50 ring-1 ring-white" : "bg-sky-500/20"
                }`}
                title="Low Volatility (< 14)"
              />
              <div
                className={`h-full rounded-sm transition ${
                  vix?.regime_tier === "NORMAL" ? "bg-emerald-400 shadow-sm shadow-emerald-400/50 ring-1 ring-white" : "bg-emerald-500/20"
                }`}
                title="Normal Volatility (14 - 20)"
              />
              <div
                className={`h-full rounded-sm transition ${
                  vix?.regime_tier === "ELEVATED" ? "bg-amber-400 shadow-sm shadow-amber-400/50 ring-1 ring-white" : "bg-amber-500/20"
                }`}
                title="Elevated Volatility (20 - 28)"
              />
              <div
                className={`h-full rounded-sm transition ${
                  vix?.regime_tier === "HIGH" ? "bg-orange-400 shadow-sm shadow-orange-400/50 ring-1 ring-white" : "bg-orange-500/20"
                }`}
                title="High Volatility / Fear (28 - 38)"
              />
              <div
                className={`h-full rounded-sm transition ${
                  vix?.regime_tier === "PANIC" ? "bg-rose-500 shadow-sm shadow-rose-500/50 ring-1 ring-white" : "bg-rose-500/20"
                }`}
                title="Extreme Panic (>= 38)"
              />
            </div>

            <div className="flex justify-between text-[9px] text-slate-500 font-mono">
              <span>&lt;14 Low</span>
              <span>14-20 Normal</span>
              <span>20-28 Elevated</span>
              <span>28-38 High</span>
              <span>&gt;38 Panic</span>
            </div>
          </div>
        </div>

        {/* Right Column: Historical Trends Chart (7 cols) */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                Historical Trajectory & Volatility Alignment
              </h3>
              <p className="text-xs text-slate-400">
                Observe how macro sentiment swings precede options implied volatility expansions and contractions.
              </p>
            </div>

            {/* Chart Switcher Tabs */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-medium">
              <button
                onClick={() => setActiveChartTab("fear_greed")}
                className={`px-2.5 py-1 rounded-md transition ${
                  activeChartTab === "fear_greed"
                    ? "bg-slate-800 text-cyan-300 font-bold shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Fear & Greed
              </button>
              <button
                onClick={() => setActiveChartTab("vix")}
                className={`px-2.5 py-1 rounded-md transition ${
                  activeChartTab === "vix"
                    ? "bg-slate-800 text-cyan-300 font-bold shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                VIX Trend
              </button>
              <button
                onClick={() => setActiveChartTab("combined")}
                className={`px-2.5 py-1 rounded-md transition ${
                  activeChartTab === "combined"
                    ? "bg-slate-800 text-cyan-300 font-bold shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Dual Axis
              </button>
            </div>
          </div>

          {/* Recharts Component */}
          <div className="h-72 w-full pt-2">
            {activeChartTab === "fear_greed" && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorFg" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                    labelStyle={{ color: "#94a3b8" }}
                    formatter={(val: any, name: string, props: any) => [
                      `${val}/100 (${props.payload.rating || "neutral"})`,
                      "Fear & Greed",
                    ]}
                  />
                  <ReferenceLine y={50} stroke="#475569" strokeDasharray="3 3" label={{ value: "Neutral (50)", fill: "#64748b", fontSize: 10, position: "insideBottomRight" }} />
                  <ReferenceLine y={25} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: "Extreme Fear (25)", fill: "#f43f5e", fontSize: 9, position: "insideBottomRight" }} />
                  <ReferenceLine y={75} stroke="#10b981" strokeDasharray="3 3" label={{ value: "Extreme Greed (75)", fill: "#10b981", fontSize: 9, position: "insideTopRight" }} />
                  <Area type="monotone" dataKey="fearGreed" stroke="#38bdf8" strokeWidth={2.5} fillOpacity={1} fill="url(#colorFg)" />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {activeChartTab === "vix" && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={vixChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVix" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis domain={["dataMin - 2", "dataMax + 2"]} stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                    labelStyle={{ color: "#94a3b8" }}
                    formatter={(val: any) => [`${Number(val).toFixed(2)}`, "VIX Close"]}
                  />
                  <ReferenceLine y={20} stroke="#10b981" strokeDasharray="3 3" label={{ value: "Normal Threshold (20)", fill: "#10b981", fontSize: 9, position: "insideBottomRight" }} />
                  <ReferenceLine y={28} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "Elevated (28)", fill: "#f59e0b", fontSize: 9, position: "insideBottomRight" }} />
                  <Area type="monotone" dataKey="vixClose" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#colorVix)" />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {activeChartTab === "combined" && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={combinedChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis yAxisId="left" domain={[0, 100]} stroke="#38bdf8" fontSize={10} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" domain={["auto", "auto"]} stroke="#f59e0b" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                    labelStyle={{ color: "#94a3b8" }}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="fearGreed" name="Fear & Greed (0-100)" stroke="#38bdf8" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="vixClose" name="VIX Level" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60 font-mono">
            <span>Range: Past 30 - 60 Trading Days</span>
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                <span>Fear & Greed</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>VIX Index</span>
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* The 7 Core Sub-Indicators of Fear & Greed */}
      {fg?.sub_indicators && fg.sub_indicators.length > 0 && (
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                The 7 Sub-Indicators of Market Sentiment
              </h3>
              <p className="text-xs text-slate-400">
                Detailed breakdown of the underlying institutional components composing the Fear & Greed index.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 hidden sm:inline">
              7 Component Factors
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 pt-1">
            {fg.sub_indicators.map((sub) => {
              const subTheme = getRatingTheme(sub.rating);
              return (
                <div
                  key={sub.id}
                  className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/70 hover:border-slate-700/80 transition flex flex-col justify-between space-y-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-white leading-snug">{sub.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 border ${subTheme.bg} ${subTheme.text} ${subTheme.border}`}>
                      {sub.rating}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {sub.description}
                  </p>

                  <div className="space-y-1 pt-1 border-t border-slate-800/60">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">Component Score:</span>
                      <span className={`font-bold ${subTheme.text}`}>{sub.score}/100</span>
                    </div>
                    {/* Visual Progress Meter */}
                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(4, Math.min(100, sub.score))}%`,
                          backgroundColor: subTheme.fill,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actionable Options Trading Implications & Strategy Matrix */}
      {optionsCtx && (
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">
                  Options Strategy Playbook for Current Regime
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Strategic rules of engagement based on VIX at {vix?.current ? vix.current.toFixed(2) : "16.5"} and Sentiment at {fg?.score ?? 50}/100.
              </p>
            </div>

            {/* Direct Quick Launch Buttons */}
            {onNavigateTab && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => onNavigateTab("put-recommendations")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition cursor-pointer shadow-sm active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Run Put Recommendations</span>
                </button>
                <button
                  onClick={() => onNavigateTab("options-scanner")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer shadow-sm active:scale-95"
                >
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Open Put Scanner</span>
                </button>
                <button
                  onClick={() => onNavigateTab("fall-detector")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer shadow-sm active:scale-95"
                >
                  <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                  <span>Fall Detector</span>
                </button>
              </div>
            )}
          </div>

          {/* Key Regime Action Takeaways (Bullet List) */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
            <div className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Key Execution Directives</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {optionsCtx.key_action_bullets.map((bullet, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-1.5" />
                  <span className="leading-relaxed">{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Strategy Matrix Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {optionsCtx.strategy_guidelines.map((strat, idx) => {
              const recColor =
                strat.recommendation === "PREFERRED"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : strat.recommendation === "FAVORABLE"
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                  : strat.recommendation === "DEFENSIVE"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-slate-800 text-slate-300 border-slate-700";

              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700/80 transition space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{strat.strategy}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border font-mono ${recColor}`}>
                      {strat.recommendation}
                    </span>
                  </div>

                  <div className="text-xs text-slate-200 font-medium leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                    {strat.action_text}
                  </div>

                  <div className="space-y-1 text-[11px] text-slate-400">
                    <div>
                      <span className="text-slate-300 font-semibold">Rationale: </span>
                      {strat.rationale}
                    </div>
                    <div className="text-amber-400/90 flex items-start gap-1 pt-0.5">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>{strat.risk_note}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
