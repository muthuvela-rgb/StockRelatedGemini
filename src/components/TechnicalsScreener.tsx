import React, { useState, useEffect } from "react";
import {
  Activity,
  Search,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Layers,
  BarChart,
  HelpCircle,
  Eye
} from "lucide-react";
import { TechnicalsData } from "../types";
import { formatCurrency, formatPct, formatLargeNumber } from "../lib/utils";
import { StatCard } from "./StatCard";

interface TechnicalsScreenerProps {
  watchlist: string[];
}

export const TechnicalsScreener: React.FC<TechnicalsScreenerProps> = ({ watchlist }) => {
  const [universe, setUniverse] = useState<"watchlist" | "qqq" | "custom">("watchlist");
  const [customInput, setCustomInput] = useState("SPCX, MU, SNDK, ALAB, NVDA, SKHY, META, TSLA, QQQ, AAPL, AMZN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TechnicalsData[]>([]);
  const [selectedStock, setSelectedStock] = useState<TechnicalsData | null>(null);
  const [sortBy, setSortBy] = useState<keyof TechnicalsData>("rsi_14");
  const [sortAsc, setSortAsc] = useState(true);

  const fetchTechnicals = async () => {
    setLoading(true);
    setError(null);

    let tickers = "";
    if (universe === "watchlist") tickers = watchlist.join(",");
    else if (universe === "qqq") tickers = "NVDA,AAPL,MSFT,MU,AMZN,AMD,GOOGL,TSLA,AVGO,META,CSCO,COST,PLTR,AMAT,LRCX,NFLX";
    else tickers = customInput;

    try {
      const res = await fetch(`/api/technicals?tickers=${encodeURIComponent(tickers)}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      const data = await res.json();
      setResults(data.results || []);
      if (data.results && data.results.length > 0 && !selectedStock) {
        setSelectedStock(data.results[0]);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load technical indicators");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTechnicals();
  }, [universe]);

  const handleSort = (field: keyof TechnicalsData) => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(true);
    }
  };

  const sortedResults = [...results].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    if (typeof aVal === "string") {
      return sortAsc ? (aVal as string).localeCompare(bVal as string) : (bVal as string).localeCompare(aVal as string);
    }
    return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white font-display flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              Comprehensive Technicals & Volatility Screener
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Computes 14d Wilder's RSI, 20d 2-std Bollinger Bands (%B & zone), ATM Implied Volatility, 252d Realized Volatility ($/yr move), and 52w Fibonacci retracements.
            </p>
          </div>

          <button
            onClick={fetchTechnicals}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>{loading ? "Computing Technicals..." : "Refresh Indicators"}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300">Preset:</span>
            <button
              onClick={() => setUniverse("watchlist")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                universe === "watchlist"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              My Watchlist
            </button>
            <button
              onClick={() => setUniverse("qqq")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                universe === "qqq"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              QQQ Leaders
            </button>
            <button
              onClick={() => setUniverse("custom")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                universe === "custom"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              Custom
            </button>
          </div>

          {universe === "custom" && (
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Tickers separated by comma..."
              className="flex-1 min-w-[240px] bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs outline-none"
            />
          )}
        </div>
      </div>

      {/* Main Grid: Table & Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Table Column */}
        <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-display">
              Technical Matrix ({results.length} Stocks)
            </h3>
            <span className="text-[11px] text-slate-400">Click a row to inspect full Fibonacci & Volatility</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700/80">
                <tr>
                  <th className="px-3 py-3 cursor-pointer hover:text-white" onClick={() => handleSort("ticker")}>
                    Ticker {sortBy === "ticker" && (sortAsc ? "↑" : "↓")}
                  </th>
                  <th className="px-3 py-3 cursor-pointer hover:text-white" onClick={() => handleSort("current_price")}>
                    Price {sortBy === "current_price" && (sortAsc ? "↑" : "↓")}
                  </th>
                  <th className="px-3 py-3 cursor-pointer hover:text-white" onClick={() => handleSort("rsi_14")}>
                    RSI (14d) {sortBy === "rsi_14" && (sortAsc ? "↑" : "↓")}
                  </th>
                  <th className="px-3 py-3">
                    Bollinger (%B & Zone)
                  </th>
                  <th className="px-3 py-3 cursor-pointer hover:text-white" onClick={() => handleSort("implied_volatility_pct")}>
                    IV (ATM) {sortBy === "implied_volatility_pct" && (sortAsc ? "↑" : "↓")}
                  </th>
                  <th className="px-3 py-3 cursor-pointer hover:text-white" onClick={() => handleSort("historical_volatility_pct")}>
                    Realized Vol {sortBy === "historical_volatility_pct" && (sortAsc ? "↑" : "↓")}
                  </th>
                  <th className="px-3 py-3 cursor-pointer hover:text-white" onClick={() => handleSort("analyst_upside_pct")}>
                    Analyst Upside {sortBy === "analyst_upside_pct" && (sortAsc ? "↑" : "↓")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sortedResults.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      {loading ? "Calculating indicators..." : "No technical data found."}
                    </td>
                  </tr>
                ) : (
                  sortedResults.map((item) => {
                    const isSelected = selectedStock?.ticker === item.ticker;
                    const rsi = item.rsi_14;
                    return (
                      <tr
                        key={item.ticker}
                        onClick={() => setSelectedStock(item)}
                        className={`hover:bg-slate-800/60 transition-colors cursor-pointer font-mono ${
                          isSelected ? "bg-blue-600/10 border-l-2 border-blue-500" : ""
                        }`}
                      >
                        <td className="px-3 py-3 font-sans font-bold text-white flex items-center gap-1.5">
                          <span>{item.ticker}</span>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>}
                        </td>
                        <td className="px-3 py-3 text-slate-200">
                          {formatCurrency(item.current_price)}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              (rsi ?? 50) <= 30
                                ? "bg-emerald-500/20 text-emerald-400"
                                : (rsi ?? 50) >= 70
                                ? "bg-rose-500/20 text-rose-400"
                                : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {rsi !== null ? rsi : "-"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-300 font-sans text-[11px]">
                          {item.bollinger ? (
                            <div>
                              <span className="font-mono font-semibold">
                                {(item.bollinger.percent_b * 100).toFixed(0)}%
                              </span>{" "}
                              <span className="text-slate-400 text-[10px]">
                                ({item.bollinger.zone})
                              </span>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-3 py-3 text-amber-400">
                          {item.implied_volatility_pct ? `${item.implied_volatility_pct}%` : "-"}
                        </td>
                        <td className="px-3 py-3 text-slate-300">
                          {item.historical_volatility_pct ? `${item.historical_volatility_pct}%` : "-"}
                        </td>
                        <td className="px-3 py-3">
                          {item.analyst_upside_pct !== null ? (
                            <span className={item.analyst_upside_pct > 0 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                              {formatPct(item.analyst_upside_pct, 1, true)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Deep Inspector Drawer */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
          {selectedStock ? (
            <>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <span className="text-xs text-blue-400 font-semibold uppercase tracking-wider">Asset Deep Dive</span>
                  <h3 className="text-2xl font-bold text-white font-display flex items-center gap-2">
                    {selectedStock.ticker}
                    <span className="text-sm font-normal text-slate-400">
                      {formatCurrency(selectedStock.current_price)}
                    </span>
                  </h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Cap: {formatLargeNumber(selectedStock.market_cap)}
                </span>
              </div>

              {/* Fibonacci Levels */}
              {selectedStock.fibonacci && (
                <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    52-Week Fibonacci Retracements
                  </h4>
                  <div className="space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>100.0% (52W High)</span>
                      <span className="text-white font-bold">${selectedStock.fibonacci.level_1000}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>61.8% (Golden Pocket)</span>
                      <span className="text-emerald-400 font-semibold">${selectedStock.fibonacci.level_618}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>50.0% Midpoint</span>
                      <span className="text-blue-400 font-semibold">${selectedStock.fibonacci.level_500}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>38.2% Retracement</span>
                      <span className="text-slate-300">${selectedStock.fibonacci.level_382}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>23.6% Retracement</span>
                      <span className="text-slate-300">${selectedStock.fibonacci.level_236}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>0.0% (52W Low)</span>
                      <span className="text-rose-400 font-bold">${selectedStock.fibonacci.level_0}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Volatility & Moves */}
              <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 space-y-2.5 text-xs">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart className="w-3.5 h-3.5 text-amber-400" />
                  Volatility & Implied Moves
                </h4>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">ATM Implied Vol (30d):</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {selectedStock.implied_volatility_pct ? `${selectedStock.implied_volatility_pct}%` : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Realized Vol (252d StdDev):</span>
                  <span className="font-mono text-slate-200 font-bold">
                    {selectedStock.historical_volatility_pct ? `${selectedStock.historical_volatility_pct}%` : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Expected Annual Move ($/yr):</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {selectedStock.historical_volatility_dollar_yr ? `±$${selectedStock.historical_volatility_dollar_yr}` : "N/A"}
                  </span>
                </div>
              </div>

              {/* Bollinger Detailed */}
              {selectedStock.bollinger && (
                <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 space-y-2 text-xs font-mono">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-sans mb-2">
                    Bollinger Bands (20, 2σ)
                  </h4>
                  <div className="flex justify-between text-slate-400">
                    <span>Upper Band (2σ):</span>
                    <span className="text-rose-400 font-bold">${selectedStock.bollinger.upper_band}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>20-day SMA Center:</span>
                    <span className="text-slate-200">${selectedStock.bollinger.sma}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Lower Band (2σ):</span>
                    <span className="text-emerald-400 font-bold">${selectedStock.bollinger.lower_band}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-slate-500 text-xs">
              Select a stock from the table to view detailed technicals
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
