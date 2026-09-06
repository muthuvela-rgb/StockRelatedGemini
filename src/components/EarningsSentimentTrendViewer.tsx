import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  BarChart2,
  Calendar,
  Layers,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  Quote,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  FileText,
  DollarSign,
  Activity,
  Award,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { EarningsCallSentimentPoint, TickerSentimentHistory } from "../types";

interface EarningsSentimentTrendViewerProps {
  watchlist: string[];
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
  onSelectQuarterForTranscript?: (ticker: string, quarter: string) => void;
}

const TICKER_COLORS: Record<string, string> = {
  NVDA: "#06b6d4", // cyan
  AAPL: "#3b82f6", // blue
  MSFT: "#8b5cf6", // purple
  TSLA: "#ec4899", // pink
  META: "#10b981", // emerald
  MU: "#f59e0b",   // amber
  ALAB: "#6366f1", // indigo
  CRWV: "#14b8a6", // teal
  SNOW: "#38bdf8", // light blue
  QQQ: "#a855f7",  // violet
  TQQQ: "#f43f5e", // rose
  NBIS: "#84cc16", // lime
  SNDK: "#eab308", // yellow
  SKHY: "#0ea5e9", // sky
  SPCX: "#d946ef", // fuchsia
};

function getColorForTicker(ticker: string, index: number): string {
  if (TICKER_COLORS[ticker]) return TICKER_COLORS[ticker];
  const palette = [
    "#06b6d4", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899",
    "#3b82f6", "#14b8a6", "#f43f5e", "#84cc16", "#a855f7",
  ];
  return palette[index % palette.length];
}

export const EarningsSentimentTrendViewer: React.FC<EarningsSentimentTrendViewerProps> = ({
  watchlist,
  selectedTicker,
  onSelectTicker,
  onSelectQuarterForTranscript,
}) => {
  const [sentimentHistories, setSentimentHistories] = useState<Record<string, TickerSentimentHistory>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"individual" | "comparative">("individual");
  const [activeQuarterIndex, setActiveQuarterIndex] = useState<number>(4); // Default to latest (index 4)
  const [visibleTickers, setVisibleTickers] = useState<Set<string>>(new Set());

  // Fetch sentiment history for watchlist
  const fetchSentimentData = async () => {
    setLoading(true);
    setError(null);
    try {
      const tickersParam = watchlist.join(",");
      const res = await fetch(`/api/earnings-transcripts/watchlist-sentiment?tickers=${encodeURIComponent(tickersParam)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setSentimentHistories(json.data);
        // Initially show selectedTicker plus top 3 from watchlist in comparative chart
        const initialSet = new Set<string>();
        initialSet.add(selectedTicker);
        watchlist.slice(0, 4).forEach((t) => initialSet.add(t));
        setVisibleTickers(initialSet);
      } else {
        throw new Error(json.error || "Failed to load sentiment trend data");
      }
    } catch (err: any) {
      console.error("Error fetching sentiment trend:", err);
      setError(err.message || "Failed to fetch sentiment trend data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (watchlist && watchlist.length > 0) {
      fetchSentimentData();
    }
  }, [watchlist.join(",")]);

  // Ensure selected ticker is in visibleTickers when selectedTicker changes
  useEffect(() => {
    if (selectedTicker) {
      setVisibleTickers((prev) => {
        const next = new Set(prev);
        next.add(selectedTicker);
        return next;
      });
    }
  }, [selectedTicker]);

  const toggleTickerVisibility = (ticker: string) => {
    setVisibleTickers((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) {
        if (next.size > 1) {
          next.delete(ticker);
        }
      } else {
        next.add(ticker);
      }
      return next;
    });
  };

  const currentHistory: TickerSentimentHistory | undefined = sentimentHistories[selectedTicker];
  const activeCall = currentHistory?.calls?.[activeQuarterIndex] || currentHistory?.calls?.[currentHistory.calls.length - 1];

  // Prepare Comparative Chart Data
  // Format: [{ quarter: "Q2 '25", NVDA: 8.4, AAPL: 7.0, MSFT: 7.9, ... }]
  const comparativeChartData = React.useMemo(() => {
    const quarters = ["Q2 '25", "Q3 '25", "Q4 '25", "Q1 '26", "Q2 '26"];
    return quarters.map((qLabel, idx) => {
      const point: Record<string, any> = { quarter: qLabel };
      Object.keys(sentimentHistories).forEach((ticker) => {
        const history = sentimentHistories[ticker];
        if (history && history.calls && history.calls[idx]) {
          point[ticker] = history.calls[idx].sentiment_score;
        }
      });
      return point;
    });
  }, [sentimentHistories]);

  // Prepare Single Ticker Chart Data
  const singleTickerChartData = React.useMemo(() => {
    if (!currentHistory || !currentHistory.calls) return [];
    return currentHistory.calls.map((call, idx) => ({
      quarter: call.label_quarter,
      sentiment_score: call.sentiment_score,
      label: call.sentiment_label,
      date: call.date,
      revenue: call.reported_revenue,
      eps: call.reported_eps,
      callIndex: idx,
    }));
  }, [currentHistory]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              5-Quarter Earnings Sentiment Trend
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-800/60">
                Alpha Vantage Summaries
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Quantitative sentiment scoring across the last 5 earnings calls synthesized from Alpha Vantage executive summaries, management guidance commentary, and analyst dialogue.
          </p>
        </div>

        {/* Action Controls & Tab Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab("individual")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "individual"
                  ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Single Ticker Deep Dive</span>
            </button>
            <button
              onClick={() => setActiveTab("comparative")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "comparative"
                  ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Watchlist Comparison</span>
            </button>
          </div>

          <button
            onClick={fetchSentimentData}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer disabled:opacity-50"
            title="Refresh Sentiment Trend Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Watchlist Quick Ticker Selector Pill Bar */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-400 font-medium mr-1 flex items-center gap-1">
          <BarChart2 className="w-3.5 h-3.5 text-slate-400" /> Watchlist:
        </span>
        {watchlist.map((t) => {
          const isSelected = selectedTicker === t;
          const hist = sentimentHistories[t];
          const trend = hist?.sentiment_trend;
          return (
            <button
              key={t}
              onClick={() => {
                onSelectTicker(t);
                setActiveQuarterIndex(4); // Reset to latest quarter
              }}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 scale-105"
                  : "bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60"
              }`}
            >
              <span>{t}</span>
              {hist && (
                <span
                  className={`text-[10px] px-1 py-0.2 rounded font-bold ${
                    isSelected
                      ? "bg-slate-950/40 text-slate-900"
                      : trend === "improving"
                      ? "text-emerald-400"
                      : trend === "deteriorating"
                      ? "text-rose-400"
                      : "text-slate-400"
                  }`}
                >
                  {hist.latest_score.toFixed(1)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-10 text-center space-y-3">
          <RefreshCw className="w-7 h-7 text-cyan-400 animate-spin mx-auto" />
          <p className="text-xs font-medium text-slate-300">
            Synthesizing 5-quarter sentiment trajectories from Alpha Vantage earnings call transcripts...
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-rose-950/30 border border-rose-800/60 rounded-xl p-4 text-xs text-rose-300 text-center">
          {error}
        </div>
      )}

      {/* Main Content Area */}
      {!loading && currentHistory && (
        <>
          {/* TAB 1: INDIVIDUAL TICKER DEEP DIVE */}
          {activeTab === "individual" && (
            <div className="space-y-6">
              {/* Summary KPIs for Current Ticker */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Latest Sentiment (Q2 '26)
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-mono font-bold text-white">
                      {currentHistory.latest_score.toFixed(1)}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">/ 10</span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-400 block mt-0.5">
                    {currentHistory.calls[currentHistory.calls.length - 1]?.sentiment_label}
                  </span>
                </div>

                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    5-Quarter Average
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-mono font-bold text-cyan-300">
                      {currentHistory.average_score.toFixed(1)}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">/ 10</span>
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Across 5 consecutive calls
                  </span>
                </div>

                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    5-Quarter Net Shift
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span
                      className={`text-2xl font-mono font-bold ${
                        currentHistory.trend_delta > 0
                          ? "text-emerald-400"
                          : currentHistory.trend_delta < 0
                          ? "text-rose-400"
                          : "text-slate-300"
                      }`}
                    >
                      {currentHistory.trend_delta > 0 ? `+${currentHistory.trend_delta.toFixed(1)}` : currentHistory.trend_delta.toFixed(1)}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">pts</span>
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    From Q2 '25 to Q2 '26
                  </span>
                </div>

                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Overall Trajectory
                  </span>
                  <div className="mt-1.5 flex items-center gap-2">
                    {currentHistory.sentiment_trend === "improving" ? (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" /> Improving
                      </span>
                    ) : currentHistory.sentiment_trend === "deteriorating" ? (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-1">
                        <TrendingDown className="w-3.5 h-3.5" /> Deteriorating
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center gap-1">
                        <Minus className="w-3.5 h-3.5" /> Stable
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-1 truncate" title={currentHistory.summary_overview}>
                    {currentHistory.ticker} institutional posture
                  </span>
                </div>
              </div>

              {/* Area Chart of 5 Quarters Sentiment */}
              <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    {selectedTicker} Sentiment Arc (Scale: 1.0 - 10.0)
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Click any point or quarter pill to inspect Alpha Vantage call summary
                  </span>
                </div>

                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={singleTickerChartData}
                      margin={{ top: 10, right: 20, left: -20, bottom: 0 }}
                      onClick={(state) => {
                        if (state && state.activePayload && state.activePayload.length > 0) {
                          const idx = state.activePayload[0].payload.callIndex;
                          if (typeof idx === "number") {
                            setActiveQuarterIndex(idx);
                          }
                        }
                      }}
                    >
                      <defs>
                        <linearGradient id={`gradient-${selectedTicker}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis
                        dataKey="quarter"
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: "#334155" }}
                      />
                      <YAxis
                        domain={[4.0, 10.0]}
                        ticks={[4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]}
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: "#334155" }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-3 shadow-xl text-xs space-y-1 font-mono">
                                <div className="font-bold text-white flex items-center justify-between gap-4">
                                  <span>{selectedTicker} {data.quarter}</span>
                                  <span className="text-cyan-400 font-bold">{data.sentiment_score} / 10</span>
                                </div>
                                <div className="text-slate-400 text-[11px]">Call Date: {data.date}</div>
                                <div className="text-emerald-400 text-[11px]">Reported Rev: {data.revenue}</div>
                                <div className="text-slate-300 text-[11px] font-sans pt-1">
                                  Rating: <strong className="text-white">{data.label}</strong>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <ReferenceLine y={7.0} stroke="#334155" strokeDasharray="3 3" label={{ value: "Bullish (7.0)", fill: "#64748b", fontSize: 10, position: "insideBottomRight" }} />
                      <Area
                        type="monotone"
                        dataKey="sentiment_score"
                        stroke="#06b6d4"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill={`url(#gradient-${selectedTicker})`}
                        dot={{ r: 5, fill: "#06b6d4", stroke: "#0f172a", strokeWidth: 2 }}
                        activeDot={{ r: 7, fill: "#22d3ee", stroke: "#fff", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Call Selector Buttons (Quarters 1 to 5) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    Select Quarter to View Alpha Vantage Summarized Transcript:
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    Showing Call {activeQuarterIndex + 1} of 5
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {currentHistory.calls.map((call, idx) => {
                    const isActive = idx === activeQuarterIndex;
                    return (
                      <button
                        key={call.quarter}
                        onClick={() => setActiveQuarterIndex(idx)}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer space-y-1 ${
                          isActive
                            ? "bg-cyan-950/40 border-cyan-500/80 shadow-md shadow-cyan-500/10 scale-[1.02]"
                            : "bg-slate-950/80 hover:bg-slate-800/80 border-slate-800 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold ${isActive ? "text-cyan-300" : "text-white"}`}>
                            {call.label_quarter}
                          </span>
                          <span
                            className={`text-xs font-mono font-bold ${
                              call.sentiment_score >= 8.0
                                ? "text-emerald-400"
                                : call.sentiment_score >= 7.0
                                ? "text-cyan-400"
                                : "text-amber-400"
                            }`}
                          >
                            {call.sentiment_score.toFixed(1)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span>{call.reported_revenue}</span>
                          {call.sentiment_delta !== undefined && call.sentiment_delta !== 0 && (
                            <span
                              className={call.sentiment_delta > 0 ? "text-emerald-400" : "text-rose-400"}
                            >
                              {call.sentiment_delta > 0 ? `+${call.sentiment_delta}` : call.sentiment_delta}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Selected Quarter: Alpha Vantage Summarized Call Briefing Card */}
              {activeCall && (
                <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-cyan-500/30 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5">
                  {/* Call Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold">
                        {selectedTicker} {activeCall.quarter}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Date: {activeCall.date}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                        Source: Alpha Vantage Summarized
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-lg font-bold border ${
                          activeCall.sentiment_label === "Bullish"
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                            : activeCall.sentiment_label === "Moderately Bullish"
                            ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                            : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                        }`}
                      >
                        Sentiment: {activeCall.sentiment_score.toFixed(1)} / 10 ({activeCall.sentiment_label})
                      </span>

                      {onSelectQuarterForTranscript && (
                        <button
                          onClick={() => onSelectQuarterForTranscript(selectedTicker, activeCall.quarter)}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition cursor-pointer shadow-sm"
                          title="Open verbatim call transcript in reader above"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Full Call</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Alpha Vantage Summarized Text Box */}
                  <div className="space-y-2">
                    <span className="text-[11px] uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1.5">
                      <Quote className="w-3.5 h-3.5" /> Alpha Vantage Executive Transcript Summary:
                    </span>
                    <p className="text-sm text-slate-200 leading-relaxed bg-slate-900/90 border border-slate-800 rounded-xl p-4 font-normal">
                      {activeCall.executive_summary}
                    </p>
                  </div>

                  {/* Financial Metrics & Guidance Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                        Reported Financials
                      </span>
                      <div className="flex items-baseline justify-between pt-0.5">
                        <span className="text-xs text-slate-300">Revenue:</span>
                        <strong className="text-sm font-mono text-white">{activeCall.reported_revenue}</strong>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-slate-300">Rev YoY:</span>
                        <span className="text-xs font-mono text-emerald-400">{activeCall.revenue_growth_yoy}</span>
                      </div>
                      <div className="flex items-baseline justify-between pt-1 border-t border-slate-900">
                        <span className="text-xs text-slate-300">Reported EPS:</span>
                        <strong className="text-sm font-mono text-white">{activeCall.reported_eps}</strong>
                      </div>
                    </div>

                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                        Forward Guidance
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed pt-0.5">
                        {activeCall.guidance_highlight}
                      </p>
                      <div className="pt-2">
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                          Analyst Tone:
                        </span>
                        <span className="text-xs font-semibold text-cyan-300 capitalize">
                          {activeCall.analyst_tone || "Constructive"}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                        Executive Key Quote
                      </span>
                      {activeCall.executive_quote ? (
                        <>
                          <blockquote className="text-xs italic text-slate-300 leading-relaxed pt-0.5">
                            &ldquo;{activeCall.executive_quote}&rdquo;
                          </blockquote>
                          {activeCall.executive_speaker && (
                            <span className="text-[10px] text-cyan-400 font-medium block pt-1">
                              &mdash; {activeCall.executive_speaker}
                            </span>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-slate-400 italic pt-0.5">
                          Executive commentary reflects sustained confidence in enterprise pipelines.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: COMPARATIVE WATCHLIST VIEW */}
          {activeTab === "comparative" && (
            <div className="space-y-6">
              {/* Ticker Visibility Toggles */}
              <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    Toggle Watchlist Tickers on Trend Line Chart:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setVisibleTickers(new Set(watchlist))}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 cursor-pointer font-medium"
                    >
                      Show All
                    </button>
                    <span className="text-slate-600">&bull;</span>
                    <button
                      onClick={() => setVisibleTickers(new Set([selectedTicker]))}
                      className="text-[11px] text-slate-400 hover:text-slate-300 cursor-pointer font-medium"
                    >
                      Focus Selected Only
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {watchlist.map((ticker, idx) => {
                    const isVisible = visibleTickers.has(ticker);
                    const color = getColorForTicker(ticker, idx);
                    return (
                      <button
                        key={ticker}
                        onClick={() => toggleTickerVisibility(ticker)}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-2 border ${
                          isVisible
                            ? "bg-slate-900 text-white border-slate-700 shadow-sm"
                            : "bg-slate-950 text-slate-500 border-slate-900 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span>{ticker}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Line Comparison Chart */}
              <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                    Comparative Sentiment Evolution Across 5 Calls
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Score: 1.0 (Bearish) to 10.0 (Bullish)
                  </span>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={comparativeChartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis
                        dataKey="quarter"
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: "#334155" }}
                      />
                      <YAxis
                        domain={[4.0, 10.0]}
                        ticks={[4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]}
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: "#334155" }}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-3.5 shadow-2xl text-xs space-y-2 font-mono">
                                <div className="font-bold text-white border-b border-slate-800 pb-1 flex items-center justify-between gap-4">
                                  <span>Quarter: {label}</span>
                                  <span className="text-cyan-400 font-normal text-[11px]">Alpha Vantage</span>
                                </div>
                                <div className="space-y-1">
                                  {payload.map((item: any) => (
                                    <div key={item.name} className="flex items-center justify-between gap-4">
                                      <span className="flex items-center gap-1.5 font-bold" style={{ color: item.color }}>
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                        {item.name}:
                                      </span>
                                      <span className="text-white font-bold">{item.value?.toFixed(1)} / 10</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: 12, fontSize: 11, fontFamily: "monospace" }}
                      />
                      <ReferenceLine y={7.0} stroke="#334155" strokeDasharray="3 3" label={{ value: "Bullish Threshold (7.0)", fill: "#64748b", fontSize: 10, position: "insideBottomRight" }} />

                      {watchlist.map((ticker, idx) => {
                        if (!visibleTickers.has(ticker)) return null;
                        const color = getColorForTicker(ticker, idx);
                        const isSelected = ticker === selectedTicker;
                        return (
                          <Line
                            key={ticker}
                            type="monotone"
                            dataKey={ticker}
                            stroke={color}
                            strokeWidth={isSelected ? 3.5 : 2}
                            dot={{ r: isSelected ? 5 : 3.5, fill: color }}
                            activeDot={{ r: 7 }}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Comparative Ticker Summary Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {watchlist.map((ticker) => {
                  const history = sentimentHistories[ticker];
                  if (!history) return null;
                  const isSelected = ticker === selectedTicker;
                  return (
                    <div
                      key={ticker}
                      onClick={() => {
                        onSelectTicker(ticker);
                        setActiveTab("individual");
                      }}
                      className={`bg-slate-950/80 border rounded-xl p-4 space-y-2.5 transition cursor-pointer hover:border-cyan-500/60 ${
                        isSelected
                          ? "border-cyan-500/80 ring-1 ring-cyan-500/40"
                          : "border-slate-800/80"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-white">{ticker}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              history.sentiment_trend === "improving"
                                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                : history.sentiment_trend === "deteriorating"
                                ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                                : "bg-blue-500/10 text-blue-300 border border-blue-500/20"
                            }`}
                          >
                            {history.sentiment_trend}
                          </span>
                        </div>

                        <span className="text-sm font-mono font-bold text-cyan-300">
                          {history.latest_score.toFixed(1)} <span className="text-[10px] text-slate-400">/ 10</span>
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                        {history.summary_overview}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono border-t border-slate-900 pt-2">
                        <span>5-Call Avg: <strong className="text-slate-200">{history.average_score.toFixed(1)}</strong></span>
                        <span className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300">
                          <span>Inspect</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
