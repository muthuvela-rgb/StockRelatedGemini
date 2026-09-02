import React, { useState, useEffect } from "react";
import {
  Play,
  Download,
  Filter,
  Sliders,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  BarChart2,
  RefreshCw,
  Info,
  DollarSign,
  Target,
  Percent,
  Calendar,
  Layers,
  Sparkles
} from "lucide-react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ZAxis,
  BarChart,
  Bar,
  Cell,
  Legend,
  AreaChart,
  Area,
  Line,
  ComposedChart
} from "recharts";
import { PutOptionRecord } from "../types";
import { formatCurrency, formatPct, formatLargeNumber } from "../lib/utils";
import { StatCard } from "./StatCard";
import { BollingerRsiTooltipBadge } from "./BollingerRsiTooltipBadge";
import { ChartPointInspector } from "./ChartPointInspector";
import { MultiPlotViewMenu, STOCK_COLORS } from "./MultiPlotViewMenu";
import { MultiStockOverlaidChart } from "./MultiStockOverlaidChart";
import { SingleStockPlotCard } from "./SingleStockPlotCard";

interface PutScannerProps {
  watchlist: string[];
}

export const PutScanner: React.FC<PutScannerProps> = ({ watchlist }) => {
  const [universe, setUniverse] = useState<"watchlist" | "qqq" | "spy" | "custom">("watchlist");
  const [customTickers, setCustomTickers] = useState("NVDA, MSFT, AAPL, AMZN, META");
  const [minDays, setMinDays] = useState(0);
  const [maxDays, setMaxDays] = useState(90);
  
  // Strike selection state
  const [strikeMode, setStrikeMode] = useState<"band" | "single" | "bollinger">("band");
  const [singleStrikeType, setSingleStrikeType] = useState<"dollar" | "pct">("dollar");
  const [singleStrike, setSingleStrike] = useState<number | string>(150);
  const [singleStrikePct, setSingleStrikePct] = useState<number>(85);
  const [pctLow, setPctLow] = useState(70);
  const [pctHigh, setPctHigh] = useState(95);
  const [bollingerPeriod, setBollingerPeriod] = useState(20);
  const [bollingerStd, setBollingerStd] = useState(2.0);

  const [capitalBasisType, setCapitalBasisType] = useState<"portfolio_margin" | "cash_secured">("cash_secured");
  const [shockPct, setShockPct] = useState(15.0);
  const [noFallback, setNoFallback] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sorting and filtering
  const [sortBy, setSortBy] = useState<keyof PutOptionRecord>("annualized_return_pct");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterMoneynessMax, setFilterMoneynessMax] = useState<number>(100);
  const [filterMinBid, setFilterMinBid] = useState<number>(0);
  const [filterSearch, setFilterSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<PutOptionRecord[]>([]);
  const [scannedSummary, setScannedSummary] = useState<any[]>([]);
  const [inspectedChartPoint, setInspectedChartPoint] = useState<any | null>(null);

  const handleScan = async () => {
    setLoading(true);
    setError(null);

    let tickersToScan: string[] = [];
    if (universe === "watchlist") tickersToScan = watchlist;
    else if (universe === "qqq") tickersToScan = ["NVDA", "AAPL", "MSFT", "MU", "AMZN", "AMD", "GOOGL", "TSLA", "AVGO", "META", "CSCO", "COST", "PLTR", "AMAT", "LRCX", "NFLX"];
    else if (universe === "spy") tickersToScan = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "BRK-B", "UNH", "JPM", "XOM", "V", "PG", "MA"];
    else tickersToScan = customTickers.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);

    if (tickersToScan.length === 0) {
      setError("Please specify at least one ticker to scan.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/options-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickers: tickersToScan,
          minDays,
          maxDays,
          strikeMode,
          singleStrikeType,
          singleStrike: strikeMode === "single" && singleStrikeType === "dollar" ? (parseFloat(String(singleStrike)) || null) : null,
          singleStrikePct: strikeMode === "single" && singleStrikeType === "pct" ? (parseFloat(String(singleStrikePct)) || null) : null,
          pctLow,
          pctHigh,
          bollingerPeriod,
          bollingerStd,
          noMargin: capitalBasisType === "cash_secured",
          marginShockPct: shockPct,
          noFallback,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setRecords(data.records || []);
      setScannedSummary(data.summary || []);
    } catch (err: any) {
      setError(err.message || "Failed to execute options scan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleScan();
  }, [universe]);

  // Filter & Sort
  const filteredRecords = records
    .filter((r) => {
      if (filterSearch && !r.ticker.toLowerCase().includes(filterSearch.toLowerCase())) return false;
      if (r.moneyness_pct > filterMoneynessMax) return false;
      if (r.bid < filterMinBid) return false;
      return true;
    })
    .sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      if (typeof aVal === "string") {
        return sortAsc ? (aVal as string).localeCompare(bVal as string) : (bVal as string).localeCompare(aVal as string);
      }
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

  const exportCsv = () => {
    if (filteredRecords.length === 0) return;
    const headers = [
      "Ticker",
      "Expiration",
      "DTE",
      "Strike",
      "CurrentPrice",
      "Moneyness%",
      "Bid",
      "Ask",
      "LastPrice",
      "Volume",
      "OpenInterest",
      "IV%",
      "CapitalBasis",
      "AnnualizedReturn%",
      "AnnualizedReturnCashSecured%",
    ];
    const rows = filteredRecords.map((r) => [
      r.ticker,
      r.expiration,
      r.days_to_expiration,
      r.strike,
      r.current_price,
      r.moneyness_pct,
      r.bid,
      r.ask,
      r.last_price,
      r.volume,
      r.open_interest,
      r.implied_volatility,
      r.capital_basis,
      r.annualized_return_pct,
      r.annualized_return_pct_cash_secured,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `options_scan_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Top metrics
  const maxReturn = filteredRecords.length > 0 ? Math.max(...filteredRecords.map((r) => r.annualized_return_pct)) : 0;
  const avgReturn =
    filteredRecords.length > 0
      ? filteredRecords.reduce((a, b) => a + b.annualized_return_pct, 0) / filteredRecords.length
      : 0;

  // Single Stock vs Multi-Stock Analysis & Multi-Plot State
  const uniqueTickers = Array.from(new Set(filteredRecords.map((r) => r.ticker)));
  const isSingleStock = uniqueTickers.length === 1;

  // Multi-Plot Selection from View Menu: array of selected tickers, e.g. ["ALL"], or ["NVDA", "AAPL"]
  const [selectedTickersForPlot, setSelectedTickersForPlot] = useState<string[]>(["ALL"]);
  const [plotLayout, setPlotLayout] = useState<"overlaid" | "grid">("overlaid");
  
  // Single Stock specific filters
  const [singleStockStrikeFilter, setSingleStockStrikeFilter] = useState<string>("ALL");
  const [singleStockExpFilter, setSingleStockExpFilter] = useState<string>("ALL");
  const [showSecondaryReturnLine, setShowSecondaryReturnLine] = useState(true);

  // Active view determination
  const isAllTickersSelected = selectedTickersForPlot.includes("ALL");
  const activeSelectedTickers = isAllTickersSelected ? uniqueTickers : selectedTickersForPlot;
  const isViewingSingleStock = !isAllTickersSelected && selectedTickersForPlot.length === 1;
  const targetSingleTicker = isViewingSingleStock ? selectedTickersForPlot[0] : (uniqueTickers[0] || "");

  // Check if a single strike price is selected (globally via strikeMode === 'single' or in single stock filter)
  const isGlobalSingleStrike = strikeMode === "single";
  const isSingleStrikeSelected = isGlobalSingleStrike || singleStockStrikeFilter !== "ALL";

  // Filter single stock records for target ticker
  const singleStockRecordsAll = filteredRecords.filter((r) => r.ticker === targetSingleTicker);
  const singleStockExpirations = Array.from(new Set(singleStockRecordsAll.map((r) => r.expiration))).sort();
  const singleStockStrikes = Array.from(new Set(singleStockRecordsAll.map((r) => r.strike))).sort((a, b) => a - b);

  // Single stock records filtered by strike & expiration
  let singleStockFilteredRecords = singleStockRecordsAll;
  if (singleStockStrikeFilter !== "ALL") {
    singleStockFilteredRecords = singleStockFilteredRecords.filter((r) => r.strike === Number(singleStockStrikeFilter));
  }
  if (singleStockExpFilter !== "ALL" && !isSingleStrikeSelected) {
    singleStockFilteredRecords = singleStockFilteredRecords.filter((r) => r.expiration === singleStockExpFilter);
  }

  // Single stock dataset when X-Axis is Expiration Date (Single Strike Selected)
  const singleStockExpData = [...singleStockFilteredRecords]
    .sort((a, b) => a.days_to_expiration - b.days_to_expiration)
    .map((r) => ({
      ticker: r.ticker,
      expiration: r.expiration,
      label: `${r.expiration} (${r.days_to_expiration}d)`,
      shortLabel: `${r.expiration.slice(5)} (${r.days_to_expiration}d)`,
      dte: r.days_to_expiration,
      strike: r.strike,
      premium: r.bid,
      ask: r.ask,
      lastPrice: r.last_price,
      spot: r.current_price,
      moneyness: r.moneyness_pct,
      returnPct: r.annualized_return_pct,
      returnCashSecured: r.annualized_return_pct_cash_secured,
      capitalBasis: r.capital_basis,
      iv: r.implied_volatility,
      rsi_14: r.rsi_14,
      bollinger: r.bollinger,
      fibonacci: r.fibonacci,
      fifty_two_week_high: r.fifty_two_week_high,
      fifty_two_week_low: r.fifty_two_week_low,
      strike_bollinger_position: r.strike_bollinger_position,
    }));

  // Single stock dataset when X-Axis is Strike Price $ (Band Mode with All Strikes)
  const singleStockStrikeData = [...singleStockFilteredRecords]
    .sort((a, b) => a.strike - b.strike)
    .map((r) => ({
      ticker: r.ticker,
      strike: r.strike,
      premium: r.bid,
      ask: r.ask,
      lastPrice: r.last_price,
      spot: r.current_price,
      moneyness: r.moneyness_pct,
      dte: r.days_to_expiration,
      expiration: r.expiration,
      returnPct: r.annualized_return_pct,
      returnCashSecured: r.annualized_return_pct_cash_secured,
      capitalBasis: r.capital_basis,
      iv: r.implied_volatility,
      usedFallback: r.bid_used_fallback,
      rsi_14: r.rsi_14,
      bollinger: r.bollinger,
      fibonacci: r.fibonacci,
      fifty_two_week_high: r.fifty_two_week_high,
      fifty_two_week_low: r.fifty_two_week_low,
      strike_bollinger_position: r.strike_bollinger_position,
    }));

  // Multi-stock dataset (X-Axis: % Moneyness, Y1: Premium $, Y2: Cash Secured Return %)
  const multiStockMoneynessData = filteredRecords.map((r) => ({
    ticker: r.ticker,
    moneyness: Number(r.moneyness_pct.toFixed(2)),
    premium: r.bid,
    ask: r.ask,
    returnCashSecured: Number(r.annualized_return_pct_cash_secured.toFixed(1)),
    returnMargin: Number(r.annualized_return_pct.toFixed(1)),
    strike: r.strike,
    spot: r.current_price,
    dte: r.days_to_expiration,
    expiration: r.expiration,
    iv: r.implied_volatility,
    rsi_14: r.rsi_14,
    bollinger: r.bollinger,
    fibonacci: r.fibonacci,
    fifty_two_week_high: r.fifty_two_week_high,
    fifty_two_week_low: r.fifty_two_week_low,
    strike_bollinger_position: r.strike_bollinger_position,
  }));

  const handleSort = (field: keyof PutOptionRecord) => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white font-display flex items-center gap-2">
              <Sliders className="w-5 h-5 text-blue-400" />
              Put Options Annualized Return Scanner
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Computes annualized return over OCC TIMS portfolio margin stress test (downside shock floor) or full cash-secured collateral.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="run-options-scan"
              onClick={handleScan}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
              <span>{loading ? "Scanning Chains..." : "Run Options Scan"}</span>
            </button>

            {filteredRecords.length > 0 && (
              <button
                id="export-csv-btn"
                onClick={exportCsv}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition cursor-pointer"
                title="Export results to CSV"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
          {/* Universe selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Universe</label>
            <select
              value={universe}
              onChange={(e) => setUniverse(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="watchlist">My Watchlist ({watchlist.length} tickers)</option>
              <option value="qqq">QQQ / Nasdaq-100 Leaders</option>
              <option value="spy">SPY / S&P 500 Leaders</option>
              <option value="custom">Custom Tickers</option>
            </select>
          </div>

          {/* DTE Range */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Expiration (DTE Range)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={minDays}
                onChange={(e) => setMinDays(parseInt(e.target.value) || 0)}
                placeholder="Min DTE"
                className="w-1/2 bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-2 text-xs outline-none"
              />
              <span className="text-slate-500 text-xs">to</span>
              <input
                type="number"
                min="1"
                value={maxDays}
                onChange={(e) => setMaxDays(parseInt(e.target.value) || 90)}
                placeholder="Max DTE"
                className="w-1/2 bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-2 text-xs outline-none"
              />
            </div>
          </div>

          {/* Strike Mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Strike Selection Mode</label>
            <select
              id="strike-mode-select"
              value={strikeMode}
              onChange={(e) => setStrikeMode(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-blue-300"
            >
              <option value="band">Band Mode (% of Price: {pctLow}% - {pctHigh}%)</option>
              <option value="single">Single Target Strike ($ or %)</option>
              <option value="bollinger">Bollinger Lower Band Strike</option>
            </select>
          </div>

          {/* Capital Basis */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Capital Basis Collateral</label>
            <select
              value={capitalBasisType}
              onChange={(e) => setCapitalBasisType(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="portfolio_margin">Portfolio Margin (OCC TIMS Stress)</option>
              <option value="cash_secured">Cash Secured (100% Strike Price)</option>
            </select>
          </div>
        </div>

        {/* Custom tickers input if active */}
        {universe === "custom" && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <label className="block text-xs font-semibold text-slate-300 mb-1">Custom Tickers (comma separated)</label>
            <input
              type="text"
              value={customTickers}
              onChange={(e) => setCustomTickers(e.target.value)}
              placeholder="e.g. NVDA, TSLA, AAPL, MSFT, AMD, GOOGL"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        )}

        {/* DEDICATED STRIKE SELECTION CONFIGURATION PANEL */}
        <div className="mt-4 p-4 bg-slate-950/80 rounded-xl border border-slate-800/80">
          {strikeMode === "single" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                    <Target className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Single Target Strike Configuration</h3>
                    <p className="text-[11px] text-slate-400">
                      Snaps to the closest listed strike price for each expiration date across all scanned tickers.
                    </p>
                  </div>
                </div>

                {/* Toggle Dollar Strike vs Percent of Price */}
                <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5">
                  <button
                    id="strike-type-dollar-btn"
                    onClick={() => setSingleStrikeType("dollar")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer flex items-center gap-1 ${
                      singleStrikeType === "dollar"
                        ? "bg-blue-600 text-white shadow"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <DollarSign className="w-3 h-3" />
                    Fixed Dollar Strike ($)
                  </button>
                  <button
                    id="strike-type-pct-btn"
                    onClick={() => setSingleStrikeType("pct")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer flex items-center gap-1 ${
                      singleStrikeType === "pct"
                        ? "bg-blue-600 text-white shadow"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Percent className="w-3 h-3" />
                    % of Stock Price
                  </button>
                </div>
              </div>

              {singleStrikeType === "dollar" ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
                  <div className="flex items-center gap-2 w-full sm:w-72">
                    <label className="text-xs font-semibold text-slate-300 shrink-0">Target Strike ($):</label>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2 text-slate-400 text-xs">$</span>
                      <input
                        id="single-strike-dollar-input"
                        type="number"
                        step="0.5"
                        min="1"
                        value={singleStrike}
                        onChange={(e) => setSingleStrike(e.target.value)}
                        placeholder="e.g. 580"
                        className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 text-white font-mono font-bold rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 mr-1">Quick Presets:</span>
                    {[50, 100, 150, 200, 300, 500, 580].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setSingleStrike(preset)}
                        className={`px-2.5 py-1 text-[11px] font-mono rounded border transition cursor-pointer ${
                          Number(singleStrike) === preset
                            ? "bg-blue-600/30 border-blue-500 text-blue-300 font-bold"
                            : "bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-white"
                        }`}
                      >
                        ${preset}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
                  <div className="flex items-center gap-2 w-full sm:w-72">
                    <label className="text-xs font-semibold text-slate-300 shrink-0">Target % of Spot:</label>
                    <div className="relative flex-1">
                      <input
                        id="single-strike-pct-input"
                        type="number"
                        min="10"
                        max="150"
                        step="1"
                        value={singleStrikePct}
                        onChange={(e) => setSingleStrikePct(parseFloat(e.target.value) || 85)}
                        placeholder="e.g. 85"
                        className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 text-white font-mono font-bold rounded-lg px-3 py-1.5 text-xs outline-none"
                      />
                      <span className="absolute right-3 top-2 text-slate-400 text-xs">%</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 mr-1">OTM Levels:</span>
                    {[
                      { pct: 75, label: "-25% OTM (75%)" },
                      { pct: 80, label: "-20% OTM (80%)" },
                      { pct: 85, label: "-15% OTM (85%)" },
                      { pct: 90, label: "-10% OTM (90%)" },
                      { pct: 95, label: "-5% OTM (95%)" },
                      { pct: 100, label: "ATM (100%)" },
                    ].map((item) => (
                      <button
                        key={item.pct}
                        onClick={() => setSingleStrikePct(item.pct)}
                        className={`px-2.5 py-1 text-[11px] rounded border transition cursor-pointer ${
                          singleStrikePct === item.pct
                            ? "bg-blue-600/30 border-blue-500 text-blue-300 font-bold"
                            : "bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-white"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {strikeMode === "band" && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-blue-400" />
                  Moneyness Band Range (% of Spot Price)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Scans all strikes within {pctLow}% to {pctHigh}% of each stock's market price.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="10"
                    max="150"
                    value={pctLow}
                    onChange={(e) => setPctLow(parseFloat(e.target.value) || 30)}
                    className="w-16 bg-slate-800 border border-slate-700 text-white font-mono text-center rounded px-2 py-1 text-xs"
                  />
                  <span className="text-slate-400 text-xs">% to</span>
                  <input
                    type="number"
                    min="10"
                    max="150"
                    value={pctHigh}
                    onChange={(e) => setPctHigh(parseFloat(e.target.value) || 95)}
                    className="w-16 bg-slate-800 border border-slate-700 text-white font-mono text-center rounded px-2 py-1 text-xs"
                  />
                  <span className="text-slate-400 text-xs">%</span>
                </div>

                <div className="hidden md:flex items-center gap-1.5">
                  {[
                    { low: 70, high: 95, label: "70-95% (Safe OTM)" },
                    { low: 80, high: 95, label: "80-95% (Near OTM)" },
                    { low: 30, high: 100, label: "30-100% (Full)" },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        setPctLow(preset.low);
                        setPctHigh(preset.high);
                      }}
                      className="px-2 py-1 text-[10px] rounded bg-slate-800 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {strikeMode === "bollinger" && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                  Bollinger Lower Band Strike Snapping
                </h3>
                <p className="text-[11px] text-slate-400">
                  Target strike dynamically set to each ticker's lower Bollinger Band (SMA - {bollingerStd}σ) and snapped to the closest listed strike.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400">Period:</span>
                  <input
                    type="number"
                    value={bollingerPeriod}
                    onChange={(e) => setBollingerPeriod(parseInt(e.target.value) || 20)}
                    className="w-14 bg-slate-800 border border-slate-700 text-white font-mono text-center rounded px-2 py-1 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400">Std Dev:</span>
                  <input
                    type="number"
                    step="0.1"
                    value={bollingerStd}
                    onChange={(e) => setBollingerStd(parseFloat(e.target.value) || 2.0)}
                    className="w-14 bg-slate-800 border border-slate-700 text-white font-mono text-center rounded px-2 py-1 text-xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Advanced Accordion */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
            {showAdvanced ? "Hide OCC TIMS & Fallback Parameters" : "Show OCC TIMS & Fallback Parameters"}
          </button>
          <span className="text-[11px] text-slate-500 font-mono">
            {records.length} contracts loaded
          </span>
        </div>

        {showAdvanced && (
          <div className="mt-3 p-4 bg-slate-950/60 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Downside Shock % (Default 15%)</label>
              <input
                type="number"
                value={shockPct}
                onChange={(e) => setShockPct(parseFloat(e.target.value) || 15.0)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded px-2.5 py-1.5"
              />
            </div>
            <div className="flex items-center gap-2 pt-4">
              <input
                type="checkbox"
                id="no-fallback-check"
                checked={noFallback}
                onChange={(e) => setNoFallback(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
              />
              <label htmlFor="no-fallback-check" className="text-slate-300">
                Strict: Disable LastPrice fallback if Bid/Ask = 0
              </label>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      {records.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total Puts Analyzed"
            value={records.length}
            subValue={`${filteredRecords.length} shown`}
            trend="neutral"
            icon={<Filter className="w-4 h-4" />}
          />
          <StatCard
            label="Top Annualized Return"
            value={formatPct(maxReturn, 1)}
            subValue={capitalBasisType === "portfolio_margin" ? "Port Margin" : "Cash Secured"}
            trend="up"
            icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
          />
          <StatCard
            label="Average Annualized Yield"
            value={formatPct(avgReturn, 1)}
            trend="neutral"
            icon={<DollarSign className="w-4 h-4 text-blue-400" />}
          />
          <StatCard
            label="Tickers Covered"
            value={Array.from(new Set(records.map((r) => r.ticker))).length}
            subValue="active equities"
            trend="neutral"
            icon={<BarChart2 className="w-4 h-4 text-cyan-400" />}
          />
        </div>
      )}

      {/* Visual Charts */}
      {filteredRecords.length > 0 && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            {/* Chart Toolbar Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800/80">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
                    {isViewingSingleStock ? (
                      <>
                        <TrendingUp className="w-4 h-4 text-cyan-400" />
                        <span>
                          {targetSingleTicker} • {isSingleStrikeSelected ? "Option Premium ($) vs Expiration Date" : "Option Premium ($) vs Strike Price ($)"}
                        </span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono font-bold">
                          {isSingleStrikeSelected ? "Single Strike • Expiration Term" : "Single Stock Mode"}
                        </span>
                      </>
                    ) : plotLayout === "grid" ? (
                      <>
                        <Layers className="w-4 h-4 text-cyan-400" />
                        <span>Multi-Plot Grid • Option Premium ($) ({activeSelectedTickers.length} Stocks)</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono font-bold">
                          Grid Layout
                        </span>
                      </>
                    ) : (isAllTickersSelected && !isGlobalSingleStrike) ? (
                      <>
                        <Target className="w-4 h-4 text-emerald-400" />
                        <span>Universe • Option Premium ($) & Annualized Cash Return (%) vs % Moneyness</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-bold">
                          Multi-Stock Universe ({uniqueTickers.length} Tickers)
                        </span>
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-4 h-4 text-cyan-400" />
                        <span>Multi-Stock Comparison • Option Premium ($) vs Expiration Date</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono font-bold">
                          {activeSelectedTickers.length} Stocks Overlaid
                        </span>
                      </>
                    )}
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {isViewingSingleStock
                    ? isSingleStrikeSelected
                      ? `Plotting Option Premium ($) (Y-Axis) across Expiration Dates (X-Axis) for ${targetSingleTicker} ${
                          singleStockStrikeFilter !== "ALL" ? `$${singleStockStrikeFilter} strike` : "selected strike"
                        }`
                      : `Plotting Option Premium ($) against Strike Price ($) across available option contracts for ${targetSingleTicker}`
                    : plotLayout === "grid"
                    ? `Showing separate dedicated plot cards for ${activeSelectedTickers.length} selected stocks`
                    : (isAllTickersSelected && !isGlobalSingleStrike)
                    ? "Plotting % Moneyness (X-Axis) vs Option Premium ($) (Left Y-Axis) and Cash-Secured Annualized Return % (Right Y-Axis)"
                    : `Plotting Option Premium ($) across Expiration Dates for all ${activeSelectedTickers.length} selected stocks`}
                </p>
              </div>

              {/* Toolbar Controls: MultiPlotViewMenu + Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* View Pull Down Menu with Multi-Select and Plot Layout */}
                {uniqueTickers.length > 0 && (
                  <MultiPlotViewMenu
                    uniqueTickers={uniqueTickers}
                    selectedTickers={selectedTickersForPlot}
                    onSelectTickers={(tickers) => {
                      setSelectedTickersForPlot(tickers);
                      setSingleStockExpFilter("ALL");
                    }}
                    plotLayout={plotLayout}
                    onSelectPlotLayout={setPlotLayout}
                    records={filteredRecords}
                    isSingleStrike={isSingleStrikeSelected}
                  />
                )}

                {/* Strike Filter for Single Stock View (if multiple strikes exist and not global single strike) */}
                {isViewingSingleStock && singleStockStrikes.length > 1 && !isGlobalSingleStrike && (
                  <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs">
                    <span className="text-slate-400">Strike:</span>
                    <select
                      value={singleStockStrikeFilter}
                      onChange={(e) => setSingleStockStrikeFilter(e.target.value)}
                      className="bg-transparent text-white font-semibold outline-none cursor-pointer"
                    >
                      <option value="ALL" className="bg-slate-900 text-white">
                        All Strikes ({singleStockStrikes.length})
                      </option>
                      {singleStockStrikes.map((s) => (
                        <option key={s} value={s} className="bg-slate-900 text-white">
                          ${s.toFixed(2)} (Plots Expiration Date)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Expiration Filter for Single Stock (when viewing strike curve) */}
                {isViewingSingleStock && !isSingleStrikeSelected && singleStockExpirations.length > 1 && (
                  <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs">
                    <span className="text-slate-400">Expiration:</span>
                    <select
                      value={singleStockExpFilter}
                      onChange={(e) => setSingleStockExpFilter(e.target.value)}
                      className="bg-transparent text-white font-semibold outline-none cursor-pointer"
                    >
                      <option value="ALL" className="bg-slate-900 text-white">
                        All Expirations ({singleStockRecordsAll.length} puts)
                      </option>
                      {singleStockExpirations.map((exp) => (
                        <option key={exp} value={exp} className="bg-slate-900 text-white">
                          {exp}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Return Overlay Checkbox */}
                <label className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSecondaryReturnLine}
                    onChange={(e) => setShowSecondaryReturnLine(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
                  />
                  <span>Show Cash Yield % Axis</span>
                </label>
              </div>
            </div>

            {/* CHART RENDERERS */}
            {/* VIEW MODE 1: MULTI-PLOT GRID CARDS (When 2+ or ALL tickers selected and layout is grid) */}
            {(selectedTickersForPlot.length > 1 || isAllTickersSelected) && plotLayout === "grid" ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {activeSelectedTickers.map((t, idx) => (
                  <SingleStockPlotCard
                    key={t}
                    ticker={t}
                    records={filteredRecords}
                    isSingleStrikeGlobal={isGlobalSingleStrike}
                    showSecondaryReturnLine={showSecondaryReturnLine}
                    colorIndex={idx}
                  />
                ))}
              </div>
            ) : (selectedTickersForPlot.length > 1 || (isAllTickersSelected && isGlobalSingleStrike)) && plotLayout === "overlaid" ? (
              /* VIEW MODE 2: MULTI-STOCK OVERLAID COMPARISON PLOT (X-Axis: Expiration Date, Y-Axis: Option Premium $) */
              <MultiStockOverlaidChart
                records={filteredRecords}
                selectedTickers={selectedTickersForPlot}
                uniqueTickers={uniqueTickers}
                isSingleStrike={isSingleStrikeSelected}
                showSecondaryReturnLine={showSecondaryReturnLine}
              />
            ) : isViewingSingleStock ? (
              /* VIEW MODE 3: SINGLE STOCK PLOT */
              /* When a single strike is selected, X-Axis is Expiration Date and Y-Axis is Option Premium ($) */
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="flex items-center gap-1.5 text-cyan-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    Click any specific dot on the curve to inspect its contract specifications, yield & technical indicators
                  </span>
                </div>

                <div className="h-72 sm:h-84 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={isSingleStrikeSelected ? singleStockExpData : singleStockStrikeData}
                      margin={{ top: 15, right: 30, bottom: 25, left: 10 }}
                    >
                      <defs>
                        <linearGradient id="singleStockPremiumFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      
                      {/* Dynamic X-Axis: Expiration Date (when single strike selected) OR Strike Price ($) */}
                      {isSingleStrikeSelected ? (
                        <XAxis
                          dataKey="expiration"
                          stroke="#64748b"
                          fontSize={11}
                          tickFormatter={(v) => v}
                          label={{
                            value: "Expiration Date (Chronological Term Structure)",
                            position: "insideBottom",
                            offset: -15,
                            fill: "#94a3b8",
                            fontSize: 11,
                          }}
                        />
                      ) : (
                        <XAxis
                          dataKey="strike"
                          stroke="#64748b"
                          fontSize={11}
                          tickFormatter={(v) => `$${v}`}
                          label={{
                            value: "Strike Price ($)",
                            position: "insideBottom",
                            offset: -15,
                            fill: "#94a3b8",
                            fontSize: 11,
                          }}
                        />
                      )}
                      
                      {/* Left Y-Axis: Option Premium ($) */}
                      <YAxis
                        yAxisId="left"
                        stroke="#06b6d4"
                        fontSize={11}
                        unit="$"
                        domain={[0, "auto"]}
                        label={{ value: "Option Premium ($)", angle: -90, position: "insideLeft", fill: "#06b6d4", fontSize: 11 }}
                      />

                      {/* Right Y-Axis: Cash-Secured Annualized Return (%) */}
                      {showSecondaryReturnLine && (
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#10b981"
                          fontSize={11}
                          unit="%"
                          domain={[0, "auto"]}
                          label={{ value: "Cash-Secured Return (%)", angle: 90, position: "insideRight", fill: "#10b981", fontSize: 11 }}
                        />
                      )}

                      <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "0.75rem" }} />
                      
                      {/* Premium Area / Line */}
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="premium"
                        name="Bid Premium ($)"
                        stroke="#06b6d4"
                        strokeWidth={2.5}
                        fill="url(#singleStockPremiumFill)"
                        dot={((props: any): any => {
                          const { cx, cy, payload } = props;
                          if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) return <g key="empty" />;
                          const isSelected = inspectedChartPoint && (
                            inspectedChartPoint.strike === payload.strike && inspectedChartPoint.expiration === payload.expiration
                          );
                          return (
                            <g
                              key={`ps-prem-${payload.strike}-${payload.expiration}`}
                              className="cursor-pointer group"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectedChartPoint({
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
                        yAxisId="left"
                        type="monotone"
                        dataKey="ask"
                        name="Ask Premium ($)"
                        stroke="#64748b"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={false}
                        activeDot={false}
                      />

                      {/* Cash-Secured Annualized Return % Line */}
                      {showSecondaryReturnLine && (
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="returnCashSecured"
                          name="Cash-Secured Annualized Return (%)"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={((props: any): any => {
                            const { cx, cy, payload } = props;
                            if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) return <g key="empty" />;
                            const isSelected = inspectedChartPoint && (
                              inspectedChartPoint.strike === payload.strike && inspectedChartPoint.expiration === payload.expiration
                            );
                            return (
                              <g
                                key={`ps-yield-${payload.strike}-${payload.expiration}`}
                                className="cursor-pointer group"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInspectedChartPoint({
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
                                  r={isSelected ? 6 : 3.5}
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
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Point Inspector */}
                {inspectedChartPoint && (
                  <ChartPointInspector
                    point={inspectedChartPoint}
                    onClose={() => setInspectedChartPoint(null)}
                    themeColor="#06b6d4"
                  />
                )}

                {/* Analytical Footnote Callouts for Single Stock */}
                {singleStockFilteredRecords.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 uppercase block">Underlying Spot</span>
                      <span className="font-bold text-white font-mono">
                        {targetSingleTicker} ${singleStockFilteredRecords[0]?.current_price.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {isSingleStrikeSelected ? `$${singleStockFilteredRecords[0]?.strike} Strike Selected` : `${singleStockStrikes.length} Strikes`}
                      </span>
                    </div>

                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 uppercase block">
                        {isSingleStrikeSelected ? "Expiration Range" : "Strike Range"}
                      </span>
                      <span className="font-bold text-cyan-400 font-mono">
                        {isSingleStrikeSelected
                          ? `${singleStockExpData[0]?.expiration} – ${singleStockExpData[singleStockExpData.length - 1]?.expiration}`
                          : `$${Math.min(...singleStockStrikeData.map(d => d.strike)).toFixed(2)} – $${Math.max(...singleStockStrikeData.map(d => d.strike)).toFixed(2)}`}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {isSingleStrikeSelected ? "X-Axis: Expiration Date" : "X-Axis: Strike Price ($)"}
                      </span>
                    </div>

                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 uppercase block">Max Cash Secured Yield</span>
                      <span className="font-bold text-emerald-400 font-mono">
                        {Math.max(...singleStockFilteredRecords.map(d => d.annualized_return_pct_cash_secured)).toFixed(1)}%
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Annualized Cash Return
                      </span>
                    </div>

                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 uppercase block">Contracts Plotted</span>
                      <span className="font-bold text-slate-200 font-mono">
                        {singleStockFilteredRecords.length} contracts
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {singleStockExpirations.length} total expirations
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* VIEW MODE 4: MULTI-STOCK UNIVERSE PLOT (X-AXIS = % MONEYNESS, LEFT Y-AXIS = OPTION PREMIUM ($), RIGHT Y-AXIS = CASH-SECURED RETURN (%)) */
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    Click any specific dot in the universe plot to inspect its contract specifications, yield & technical indicators
                  </span>
                </div>

                <div className="h-72 sm:h-84 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={multiStockMoneynessData}
                      margin={{ top: 15, right: 30, bottom: 25, left: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      
                      {/* X-Axis: % Moneyness */}
                      <XAxis
                        dataKey="moneyness"
                        type="number"
                        stroke="#64748b"
                        fontSize={11}
                        domain={["auto", "auto"]}
                        unit="%"
                        label={{ value: "% Moneyness (Strike / Spot Price × 100)", position: "insideBottom", offset: -15, fill: "#94a3b8", fontSize: 11 }}
                      />
                      
                      {/* Left Y-Axis: Option Premium ($) */}
                      <YAxis
                        yAxisId="left"
                        stroke="#06b6d4"
                        fontSize={11}
                        unit="$"
                        domain={[0, "auto"]}
                        label={{ value: "Option Premium ($)", angle: -90, position: "insideLeft", fill: "#06b6d4", fontSize: 11 }}
                      />

                      {/* Right Y-Axis: Annualized Return % (Cash-Secured Put Options) */}
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="#10b981"
                        fontSize={11}
                        unit="%"
                        domain={[0, "auto"]}
                        label={{ value: "Cash-Secured Return (%)", angle: 90, position: "insideRight", fill: "#10b981", fontSize: 11 }}
                      />

                      <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "0.75rem" }} />

                      {/* Scatter points for Option Premium ($) on Left Y-Axis with interactive dots */}
                      <Scatter
                        yAxisId="left"
                        dataKey="premium"
                        name="Option Premium ($)"
                        fill="#06b6d4"
                        shape={((props: any): any => {
                          const { cx, cy, payload } = props;
                          if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) return <g key="empty" />;
                          const isSelected = inspectedChartPoint && (
                            inspectedChartPoint.ticker === payload.ticker &&
                            inspectedChartPoint.strike === payload.strike &&
                            inspectedChartPoint.expiration === payload.expiration
                          );
                          return (
                            <g
                              key={`uni-prem-${payload.ticker}-${payload.strike}-${payload.expiration}`}
                              className="cursor-pointer group"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectedChartPoint({
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
                      />

                      {/* Scatter points for Cash-Secured Annualized Return (%) on Right Y-Axis */}
                      {showSecondaryReturnLine && (
                        <Scatter
                          yAxisId="right"
                          dataKey="returnCashSecured"
                          name="Cash-Secured Annualized Return (%)"
                          fill="#10b981"
                          shape={((props: any): any => {
                            const { cx, cy, payload } = props;
                            if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) return <g key="empty" />;
                            const isSelected = inspectedChartPoint && (
                              inspectedChartPoint.ticker === payload.ticker &&
                              inspectedChartPoint.strike === payload.strike &&
                              inspectedChartPoint.expiration === payload.expiration
                            );
                            return (
                              <g
                                key={`uni-yield-${payload.ticker}-${payload.strike}-${payload.expiration}`}
                                className="cursor-pointer group"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInspectedChartPoint({
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
                                  r={isSelected ? 6 : 3.5}
                                  fill={isSelected ? "#ffffff" : "#10b981"}
                                  stroke={isSelected ? "#10b981" : "#0f172a"}
                                  strokeWidth={isSelected ? 2.5 : 1.5}
                                  className="transition-all duration-150 group-hover:scale-150 group-hover:stroke-white group-hover:stroke-[2px]"
                                />
                              </g>
                            );
                          }) as any}
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Point Inspector */}
                {inspectedChartPoint && (
                  <ChartPointInspector
                    point={inspectedChartPoint}
                    onClose={() => setInspectedChartPoint(null)}
                    themeColor="#10b981"
                  />
                )}

                {/* Analytical Footnote Callouts for Multi-Stock */}
                {multiStockMoneynessData.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 uppercase block">Scanned Universe</span>
                      <span className="font-bold text-white font-mono">
                        {uniqueTickers.length} Tickers
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {multiStockMoneynessData.length} Total Contracts
                      </span>
                    </div>

                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 uppercase block">Moneyness Range</span>
                      <span className="font-bold text-cyan-400 font-mono">
                        {Math.min(...multiStockMoneynessData.map(d => d.moneyness)).toFixed(1)}% – {Math.max(...multiStockMoneynessData.map(d => d.moneyness)).toFixed(1)}%
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        X-Axis % of Spot Price
                      </span>
                    </div>

                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 uppercase block">Top Cash-Secured Yield</span>
                      <span className="font-bold text-emerald-400 font-mono">
                        {Math.max(...multiStockMoneynessData.map(d => d.returnCashSecured)).toFixed(1)}%
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Right Y-Axis Yield %
                      </span>
                    </div>

                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 uppercase block">Premium Range</span>
                      <span className="font-bold text-slate-200 font-mono">
                        ${Math.min(...multiStockMoneynessData.map(d => d.premium)).toFixed(2)} – ${Math.max(...multiStockMoneynessData.map(d => d.premium)).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Left Y-Axis Premium ($)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Filter by ticker symbol..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs w-full max-w-xs outline-none"
          />
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Max Moneyness:</span>
            <select
              value={filterMoneynessMax}
              onChange={(e) => setFilterMoneynessMax(parseFloat(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 outline-none text-xs"
            >
              <option value="105">All (≤ 105%)</option>
              <option value="100">At/OTM (≤ 100%)</option>
              <option value="95">Conservative (≤ 95%)</option>
              <option value="90">Deep OTM (≤ 90%)</option>
              <option value="80">Ultra Deep (≤ 80%)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Min Bid:</span>
            <select
              value={filterMinBid}
              onChange={(e) => setFilterMinBid(parseFloat(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 outline-none text-xs"
            >
              <option value="0">$0.00+</option>
              <option value="0.5">$0.50+</option>
              <option value="1.0">$1.00+</option>
              <option value="2.0">$2.00+</option>
              <option value="5.0">$5.00+</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700/80">
              <tr>
                <th
                  className="px-4 py-3 cursor-pointer hover:text-white"
                  onClick={() => handleSort("ticker")}
                >
                  Ticker {sortBy === "ticker" && (sortAsc ? "↑" : "↓")}
                </th>
                <th
                  className="px-3 py-3 cursor-pointer hover:text-white"
                  onClick={() => handleSort("expiration")}
                >
                  Expiration (DTE) {sortBy === "expiration" && (sortAsc ? "↑" : "↓")}
                </th>
                <th
                  className="px-3 py-3 cursor-pointer hover:text-white"
                  onClick={() => handleSort("strike")}
                >
                  Strike {sortBy === "strike" && (sortAsc ? "↑" : "↓")}
                </th>
                <th
                  className="px-3 py-3 cursor-pointer hover:text-white"
                  onClick={() => handleSort("current_price")}
                >
                  Spot {sortBy === "current_price" && (sortAsc ? "↑" : "↓")}
                </th>
                <th
                  className="px-3 py-3 cursor-pointer hover:text-white"
                  onClick={() => handleSort("moneyness_pct")}
                >
                  Moneyness % {sortBy === "moneyness_pct" && (sortAsc ? "↑" : "↓")}
                </th>
                <th
                  className="px-3 py-3 cursor-pointer hover:text-white"
                  onClick={() => handleSort("bid")}
                >
                  Bid / Ask {sortBy === "bid" && (sortAsc ? "↑" : "↓")}
                </th>
                <th
                  className="px-3 py-3 cursor-pointer hover:text-white"
                  onClick={() => handleSort("implied_volatility")}
                >
                  IV % {sortBy === "implied_volatility" && (sortAsc ? "↑" : "↓")}
                </th>
                <th
                  className="px-3 py-3 cursor-pointer hover:text-white"
                  onClick={() => handleSort("capital_basis")}
                >
                  Capital Basis {sortBy === "capital_basis" && (sortAsc ? "↑" : "↓")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:text-white text-right"
                  onClick={() => handleSort("annualized_return_pct")}
                >
                  Annualized Return % {sortBy === "annualized_return_pct" && (sortAsc ? "↑" : "↓")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                    {loading ? (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                        <span>Fetching option chains & computing margins...</span>
                      </div>
                    ) : (
                      "No options matched the current filter parameters."
                    )}
                  </td>
                </tr>
              ) : (
                filteredRecords.slice(0, 100).map((r, i) => {
                  const isHighReturn = r.annualized_return_pct >= 30;
                  return (
                    <tr
                      key={`${r.ticker}-${r.expiration}-${r.strike}-${i}`}
                      className="hover:bg-slate-800/50 transition-colors font-mono"
                    >
                      <td className="px-4 py-3 font-sans font-bold text-white flex items-center gap-2">
                        <span>{r.ticker}</span>
                        {r.bid_used_fallback && (
                          <span
                            className="text-[10px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-sans"
                            title="Bid was 0, last traded price used as fallback"
                          >
                            fallback
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-300">
                        {r.expiration}{" "}
                        <span className="text-slate-500 text-[11px]">({r.days_to_expiration}d)</span>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-200">
                        ${r.strike.toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-slate-400">
                        ${r.current_price.toFixed(2)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            r.moneyness_pct <= 85
                              ? "bg-emerald-500/10 text-emerald-400"
                              : r.moneyness_pct <= 95
                              ? "bg-blue-500/10 text-blue-400"
                              : "bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {r.moneyness_pct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-300">
                        <span className="text-emerald-400 font-semibold">${r.bid.toFixed(2)}</span>
                        <span className="text-slate-500"> / </span>
                        <span className="text-slate-400">${r.ask.toFixed(2)}</span>
                      </td>
                      <td className="px-3 py-3 text-slate-400">
                        {r.implied_volatility ? `${r.implied_volatility.toFixed(1)}%` : "-"}
                      </td>
                      <td className="px-3 py-3 text-slate-300">
                        ${r.capital_basis.toFixed(2)}
                        {capitalBasisType === "portfolio_margin" && (
                          <span className="text-[10px] text-slate-500 block">
                            (CS: ${r.capital_basis_cash_secured.toFixed(0)})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`text-sm font-bold ${
                            isHighReturn ? "text-emerald-400" : "text-blue-400"
                          }`}
                        >
                          {formatPct(r.annualized_return_pct, 2)}
                        </span>
                        {capitalBasisType === "portfolio_margin" && (
                          <span className="text-[10px] text-slate-500 block">
                            CS: {formatPct(r.annualized_return_pct_cash_secured, 1)}
                          </span>
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
    </div>
  );
};
