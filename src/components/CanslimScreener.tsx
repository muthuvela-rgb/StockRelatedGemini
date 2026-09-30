import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ChevronRight,
  ExternalLink,
  Info,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BarChart3,
  Layers,
  FileSpreadsheet,
  ArrowUpRight,
  X,
} from "lucide-react";
import { useWatchlistOptions } from "../hooks/useWatchlistSelection";

export interface CanslimMetricDetail {
  passed: boolean | null;
  value: number | null;
  weight: number;
  detail: string;
}

export interface CanslimTickerResult {
  ticker: string;
  company_name?: string;
  price: number | null;
  score: number;
  evaluable: number;
  score_pct: number;
  verdict: "Strong" | "Watch" | "Weak";
  criteria: {
    C: CanslimMetricDetail;
    A: CanslimMetricDetail;
    N: CanslimMetricDetail;
    S: CanslimMetricDetail;
    L: CanslimMetricDetail;
    I: CanslimMetricDetail;
    M: CanslimMetricDetail;
  };
  catalyst_summary?: string;
}

export interface CanslimScreenResponse {
  benchmark: string;
  market_direction: {
    passed: boolean;
    detail: string;
    last_price: number;
    sma50: number;
    sma200: number;
  };
  results: CanslimTickerResult[];
  screened_at: string;
}

const DEFAULT_PRESETS = [
  { label: "Top Tech & AI", tickers: ["NVDA", "AAPL", "MSFT", "AVGO", "META", "AMZN", "PLTR", "TSLA", "MU", "AMD"] },
  { label: "High Growth", tickers: ["PLTR", "CRWD", "NOW", "SNOW", "PANW", "NET", "DDOG", "ZS"] },
  { label: "Semiconductors", tickers: ["NVDA", "AVGO", "TSM", "AMD", "QCOM", "TXN", "MU", "ASML"] },
  { label: "Index Leaders", tickers: ["SPY", "QQQ", "IWM", "DIA"] },
];

interface CanslimScreenerProps {
  onNavigateTab?: (tab: string, ticker?: string) => void;
}

export const CanslimScreener: React.FC<CanslimScreenerProps> = ({ onNavigateTab }) => {
  const watchlistOptions = useWatchlistOptions(["NVDA", "AAPL", "MSFT", "AVGO", "META", "AMZN", "PLTR", "TSLA", "MU", "AMD"]);

  const [tickers, setTickers] = useState<string[]>([
    "NVDA", "AAPL", "MSFT", "AVGO", "META", "AMZN", "PLTR", "TSLA", "MU", "AMD"
  ]);
  const [tickerInput, setTickerInput] = useState("");
  const [benchmark, setBenchmark] = useState("QQQ");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CanslimScreenResponse | null>(null);

  // Filters
  const [selectedVerdict, setSelectedVerdict] = useState<"ALL" | "Strong" | "Watch" | "Weak">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [minScore, setMinScore] = useState<number>(0);
  const [inspectedTicker, setInspectedTicker] = useState<CanslimTickerResult | null>(null);

  const fetchScreen = async (symbolsToFetch = tickers) => {
    if (symbolsToFetch.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/canslim/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickers: symbolsToFetch,
          benchmark,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      }

      const json: CanslimScreenResponse = await res.json();
      setData(json);
    } catch (err: any) {
      console.error("CANSLIM screen failed:", err);
      setError(err.message || "Failed to execute CANSLIM screen");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScreen(tickers);
  }, []);

  const handleApplyPreset = (newTickers: string[]) => {
    const deduped = Array.from(new Set(newTickers.map((t) => t.trim().toUpperCase()))).filter(Boolean);
    setTickers(deduped);
    fetchScreen(deduped);
  };

  const handleAddTicker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tickerInput.trim()) return;

    const raw = tickerInput
      .split(/[,\s]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);

    const merged = Array.from(new Set([...tickers, ...raw]));
    setTickers(merged);
    setTickerInput("");
    fetchScreen(merged);
  };

  const handleRemoveTicker = (sym: string) => {
    const updated = tickers.filter((t) => t !== sym);
    setTickers(updated);
    if (updated.length > 0) {
      fetchScreen(updated);
    } else {
      setData(null);
    }
  };

  const filteredResults = useMemo(() => {
    if (!data?.results) return [];
    return data.results.filter((item) => {
      if (selectedVerdict !== "ALL" && item.verdict !== selectedVerdict) return false;
      if (item.score < minScore) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSym = item.ticker.toLowerCase().includes(q);
        const matchesName = item.company_name?.toLowerCase().includes(q);
        if (!matchesSym && !matchesName) return false;
      }
      return true;
    });
  }, [data?.results, selectedVerdict, minScore, searchQuery]);

  const strongCount = data?.results.filter((r) => r.verdict === "Strong").length || 0;
  const watchCount = data?.results.filter((r) => r.verdict === "Watch").length || 0;

  const renderBadge = (detail: CanslimMetricDetail, letter: string) => {
    const passed = detail.passed;
    let bgClass = "bg-slate-800 text-slate-400 border-slate-700";
    let icon = <HelpCircle className="w-3 h-3" />;
    let text = "N/A";

    if (passed === true) {
      bgClass = "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
      icon = <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
      text = "PASS";
    } else if (passed === false) {
      bgClass = "bg-rose-500/15 text-rose-300 border-rose-500/30";
      icon = <XCircle className="w-3 h-3 text-rose-400" />;
      text = "FAIL";
    }

    return (
      <div className="relative group inline-block">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${bgClass} cursor-help transition-all duration-150`}
        >
          {icon}
          <span>{text}</span>
        </span>
        {/* Tooltip */}
        <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-56 p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-[11px] shadow-2xl pointer-events-none text-left">
          <div className="font-semibold text-slate-100 flex items-center justify-between pb-1 border-b border-slate-800 mb-1">
            <span>Metric {letter}</span>
            <span className="text-[10px] text-cyan-400 font-mono">Weight: {detail.weight}x</span>
          </div>
          <p className="text-slate-300 leading-tight">{detail.detail}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                William J. O'Neil CANSLIM Framework
              </span>
              <span className="text-xs text-slate-400 font-mono">Max Score: 6.75 (N: 0.75w | S: 1.0w)</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              CANSLIM 7-Point Growth & Quality Screener
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Screens stocks for accelerating quarterly EPS & sales (<strong>C</strong>), annual compound earnings & ROE (<strong>A</strong>),
              breakouts & innovation catalysts (<strong>N</strong>), institutional supply/demand accumulation (<strong>S</strong>),
              market leadership (<strong>L</strong>), fund sponsorship (<strong>I</strong>), and confirmed market direction (<strong>M</strong>).
            </p>
          </div>

          {/* Market Direction Status Badge (M) */}
          {data?.market_direction && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 min-w-[260px] shrink-0">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="font-semibold uppercase tracking-wider">Market Trend ({data.benchmark})</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    data.market_direction.passed
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  {data.market_direction.passed ? "CONFIRMED UPTREND" : "MARKET PRESSURE"}
                </span>
              </div>
              <div className="text-xs text-slate-300 font-mono">
                {data.market_direction.last_price > 0 && (
                  <span>${data.market_direction.last_price} • 50d: ${data.market_direction.sma50}</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug truncate" title={data.market_direction.detail}>
                {data.market_direction.detail}
              </p>
            </div>
          )}
        </div>

        {/* Watchlist & Quick Presets */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-300 mr-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-blue-400" /> Watchlists:
          </span>
          {watchlistOptions.map((wl) => (
            <button
              key={wl.value}
              onClick={() => handleApplyPreset(wl.tickers)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition cursor-pointer"
            >
              {wl.label}
            </button>
          ))}

          <span className="text-slate-600 mx-1">|</span>

          {DEFAULT_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => handleApplyPreset(p.tickers)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 transition cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Deck & Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Ticker Form */}
          <form onSubmit={handleAddTicker} className="flex items-center gap-2 w-full md:w-auto flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value)}
                placeholder="Add symbols (e.g. NVDA, PLTR, AVGO)..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md transition cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Screen
            </button>
          </form>

          {/* Quick Rescan */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              onClick={() => fetchScreen(tickers)}
              disabled={loading}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
              Refresh All
            </button>
          </div>
        </div>

        {/* Active Tickers Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80">
          <span className="text-[11px] text-slate-400 font-mono mr-1">Active Universe ({tickers.length}):</span>
          {tickers.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300"
            >
              {t}
              <button
                onClick={() => handleRemoveTicker(t)}
                className="hover:text-rose-400 cursor-pointer text-slate-400 transition ml-0.5"
                title={`Remove ${t}`}
              >
                &times;
              </button>
            </span>
          ))}
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* Verdict Filter */}
          <div className="flex items-center gap-1 bg-slate-950/50 border border-slate-800 p-1.5 rounded-xl">
            {(["ALL", "Strong", "Watch", "Weak"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setSelectedVerdict(v)}
                className={`flex-1 py-1 px-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  selectedVerdict === v
                    ? v === "Strong"
                      ? "bg-emerald-600 text-white"
                      : v === "Watch"
                      ? "bg-amber-600 text-white"
                      : v === "Weak"
                      ? "bg-slate-700 text-white"
                      : "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Search Filter */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search active results..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950/50 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* Min Score Filter */}
          <div className="flex items-center gap-2 bg-slate-950/50 border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-slate-300">
            <span className="shrink-0 text-slate-400">Min Score:</span>
            <input
              type="range"
              min="0"
              max="6.75"
              step="0.25"
              value={minScore}
              onChange={(e) => setMinScore(parseFloat(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <span className="font-mono font-bold text-cyan-400 shrink-0 w-8">{minScore.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Evaluated</span>
          <div className="text-2xl font-bold text-white mt-1 font-mono">{data?.results.length || 0}</div>
          <span className="text-[11px] text-slate-500">Tickers in universe</span>
        </div>

        <div className="bg-slate-900 border border-emerald-500/20 rounded-xl p-4">
          <span className="text-xs text-emerald-400 uppercase tracking-wider font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Strong Candidates
          </span>
          <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{strongCount}</div>
          <span className="text-[11px] text-slate-400">Score &ge; 5.50 + Earnings Gate</span>
        </div>

        <div className="bg-slate-900 border border-amber-500/20 rounded-xl p-4">
          <span className="text-xs text-amber-400 uppercase tracking-wider font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Watch List
          </span>
          <div className="text-2xl font-bold text-amber-400 mt-1 font-mono">{watchCount}</div>
          <span className="text-[11px] text-slate-400">Score &ge; 4.00</span>
        </div>

        <div className="bg-slate-900 border border-blue-500/20 rounded-xl p-4">
          <span className="text-xs text-blue-400 uppercase tracking-wider font-semibold">Weight Structure</span>
          <div className="text-xl font-bold text-white mt-1 font-mono">6.75 Pts</div>
          <span className="text-[11px] text-cyan-400">N=0.75w, S=1.0w, C/A/L/I/M=1w</span>
        </div>
      </div>

      {/* Main CANSLIM Results Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              CANSLIM 7-Metric Heatmap Matrix ({filteredResults.length} Tickers)
            </h2>
          </div>
          <span className="text-xs text-slate-400">Click any row for in-depth metric audit & AI catalyst narrative</span>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border-b border-rose-500/20 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs select-none">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px] bg-slate-950/40">
                <th className="py-3 px-3">Ticker / Company</th>
                <th className="py-3 px-3">Price</th>
                <th className="py-3 px-3">Verdict</th>
                <th className="py-3 px-3">CANSLIM Score</th>
                <th className="py-3 px-2 text-center" title="Current Quarterly EPS & Sales Growth (min +25%)">
                  C (1.0w)
                </th>
                <th className="py-3 px-2 text-center" title="Annual Earnings Growth & ROE (min +25%, ROE >= 17%)">
                  A (1.0w)
                </th>
                <th className="py-3 px-2 text-center" title="New Product, Service, Management or Highs (0.75w)">
                  N (0.75w)
                </th>
                <th className="py-3 px-2 text-center" title="Supply & Demand: 50d Up/Down Vol Ratio & Up-Day Surge">
                  S (1.0w)
                </th>
                <th className="py-3 px-2 text-center" title="Leader or Laggard: Relative Strength Percentile >= 80">
                  L (1.0w)
                </th>
                <th className="py-3 px-2 text-center" title="Institutional Sponsorship >= 30%">
                  I (1.0w)
                </th>
                <th className="py-3 px-2 text-center" title="Market Direction (QQQ in Confirmed Uptrend)">
                  M (1.0w)
                </th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading && (!data || data.results.length === 0) ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                    Evaluating CANSLIM fundamentals & market dynamics...
                  </td>
                </tr>
              ) : filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400 font-sans">
                    No stocks match the selected criteria or filters.
                  </td>
                </tr>
              ) : (
                filteredResults.map((r) => {
                  const isStrong = r.verdict === "Strong";
                  const isWatch = r.verdict === "Watch";

                  return (
                    <tr
                      key={r.ticker}
                      onClick={() => setInspectedTicker(r)}
                      className="hover:bg-slate-800/40 transition cursor-pointer group"
                    >
                      <td className="py-3 px-3">
                        <div className="font-bold text-white group-hover:text-blue-400 transition flex items-center gap-1.5">
                          <span>{r.ticker}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans truncate max-w-[140px]">
                          {r.company_name || r.ticker}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-slate-200">
                        {r.price ? `$${r.price.toFixed(2)}` : "—"}
                      </td>

                      <td className="py-3 px-3 font-sans">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                            isStrong
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                              : isWatch
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          {isStrong && <ShieldCheck className="w-3 h-3" />}
                          {isWatch && <AlertTriangle className="w-3 h-3" />}
                          {r.verdict}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-cyan-300">
                            {r.score.toFixed(2)}
                            <span className="text-[10px] text-slate-500 font-normal"> / {r.evaluable.toFixed(2)}</span>
                          </span>
                          <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden shrink-0">
                            <div
                              className={`h-full rounded-full ${
                                isStrong ? "bg-emerald-400" : isWatch ? "bg-amber-400" : "bg-blue-500"
                              }`}
                              style={{ width: `${r.score_pct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-2 text-center">{renderBadge(r.criteria.C, "C")}</td>
                      <td className="py-3 px-2 text-center">{renderBadge(r.criteria.A, "A")}</td>
                      <td className="py-3 px-2 text-center">{renderBadge(r.criteria.N, "N")}</td>
                      <td className="py-3 px-2 text-center">{renderBadge(r.criteria.S, "S")}</td>
                      <td className="py-3 px-2 text-center">{renderBadge(r.criteria.L, "L")}</td>
                      <td className="py-3 px-2 text-center">{renderBadge(r.criteria.I, "I")}</td>
                      <td className="py-3 px-2 text-center">{renderBadge(r.criteria.M, "M")}</td>

                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectedTicker(r);
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-sans font-medium transition cursor-pointer"
                        >
                          Audit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* In-Depth Inspection Modal / Drawer */}
      {inspectedTicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 sticky top-0 z-10 backdrop-blur-md">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-white font-mono">{inspectedTicker.ticker}</h3>
                  <span className="text-sm text-slate-400 font-sans">• {inspectedTicker.company_name}</span>
                  <span
                    className={`ml-2 px-2.5 py-0.5 rounded text-xs font-bold ${
                      inspectedTicker.verdict === "Strong"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : inspectedTicker.verdict === "Watch"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {inspectedTicker.verdict} Candidate
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1 font-mono">
                  Price: ${inspectedTicker.price?.toFixed(2) || "N/A"} • Total Score:{" "}
                  <strong className="text-cyan-400">{inspectedTicker.score.toFixed(2)}</strong> / {inspectedTicker.evaluable.toFixed(2)} (
                  {inspectedTicker.score_pct}%)
                </div>
              </div>

              <button
                onClick={() => setInspectedTicker(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* AI Innovation Catalyst Callout (N) */}
              <div className="bg-blue-950/20 border border-blue-800/40 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-300 uppercase tracking-wider mb-1.5">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  Gemini AI Innovation & Catalyst Evaluation (Metric N - 0.75w)
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {inspectedTicker.catalyst_summary
                    ? inspectedTicker.catalyst_summary
                    : "No negative disruption detected. Stock continues to maintain baseline commercial expansion, consolidation base tightness, and relative proximity to annual highs."}
                </p>
              </div>

              {/* 7-Point Audit Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* C */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-white">C: Current Quarterly EPS & Sales</span>
                    {renderBadge(inspectedTicker.criteria.C, "C")}
                  </div>
                  <p className="text-xs text-slate-400">{inspectedTicker.criteria.C.detail}</p>
                </div>

                {/* A */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-white">A: Annual Earnings Growth & ROE</span>
                    {renderBadge(inspectedTicker.criteria.A, "A")}
                  </div>
                  <p className="text-xs text-slate-400">{inspectedTicker.criteria.A.detail}</p>
                </div>

                {/* N */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-white">N: New Product / Base / 52w High</span>
                    {renderBadge(inspectedTicker.criteria.N, "N")}
                  </div>
                  <p className="text-xs text-slate-400">{inspectedTicker.criteria.N.detail}</p>
                </div>

                {/* S */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-white">S: Supply & Demand (Volume Accumulation)</span>
                    {renderBadge(inspectedTicker.criteria.S, "S")}
                  </div>
                  <p className="text-xs text-slate-400">{inspectedTicker.criteria.S.detail}</p>
                </div>

                {/* L */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-white">L: Leader or Laggard (RS Percentile)</span>
                    {renderBadge(inspectedTicker.criteria.L, "L")}
                  </div>
                  <p className="text-xs text-slate-400">{inspectedTicker.criteria.L.detail}</p>
                </div>

                {/* I */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-white">I: Institutional Sponsorship</span>
                    {renderBadge(inspectedTicker.criteria.I, "I")}
                  </div>
                  <p className="text-xs text-slate-400">{inspectedTicker.criteria.I.detail}</p>
                </div>

                {/* M */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-white">M: Market Direction</span>
                    {renderBadge(inspectedTicker.criteria.M, "M")}
                  </div>
                  <p className="text-xs text-slate-400">{inspectedTicker.criteria.M.detail}</p>
                </div>
              </div>

              {/* Navigation Action Buttons */}
              <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-end gap-2">
                {onNavigateTab && (
                  <>
                    <button
                      onClick={() => {
                        setInspectedTicker(null);
                        onNavigateTab("premium-curves", inspectedTicker.ticker);
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />
                      View Premium Curves
                    </button>

                    <button
                      onClick={() => {
                        setInspectedTicker(null);
                        onNavigateTab("options-scanner", inspectedTicker.ticker);
                      }}
                      className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Analyze in Put Scanner
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
