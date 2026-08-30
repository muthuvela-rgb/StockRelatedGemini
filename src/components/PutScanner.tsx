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
  DollarSign
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
  Cell
} from "recharts";
import { PutOptionRecord } from "../types";
import { formatCurrency, formatPct, formatLargeNumber } from "../lib/utils";
import { StatCard } from "./StatCard";

interface PutScannerProps {
  watchlist: string[];
}

export const PutScanner: React.FC<PutScannerProps> = ({ watchlist }) => {
  const [universe, setUniverse] = useState<"watchlist" | "qqq" | "spy" | "custom">("watchlist");
  const [customTickers, setCustomTickers] = useState("NVDA, MSFT, AAPL, AMZN, META");
  const [minDays, setMinDays] = useState(0);
  const [maxDays, setMaxDays] = useState(90);
  const [strikeMode, setStrikeMode] = useState<"band" | "single" | "bollinger">("band");
  const [singleStrike, setSingleStrike] = useState<number>(100);
  const [pctLow, setPctLow] = useState(70);
  const [pctHigh, setPctHigh] = useState(95);
  const [capitalBasisType, setCapitalBasisType] = useState<"portfolio_margin" | "cash_secured">("portfolio_margin");
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
          singleStrike: strikeMode === "single" ? singleStrike : null,
          pctLow,
          pctHigh,
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

  // Chart data
  const scatterData = filteredRecords.slice(0, 150).map((r) => ({
    ticker: r.ticker,
    moneyness: r.moneyness_pct,
    returnPct: r.annualized_return_pct,
    strike: r.strike,
    dte: r.days_to_expiration,
    bid: r.bid,
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
              value={strikeMode}
              onChange={(e) => setStrikeMode(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="band">Band Mode (% of Price: {pctLow}% - {pctHigh}%)</option>
              <option value="single">Single Target Strike</option>
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
          <div className="mt-3 p-4 bg-slate-950/60 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Downside Shock % (Default 15%)</label>
              <input
                type="number"
                value={shockPct}
                onChange={(e) => setShockPct(parseFloat(e.target.value) || 15.0)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Band % Range (Low % - High %)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={pctLow}
                  onChange={(e) => setPctLow(parseFloat(e.target.value) || 30)}
                  className="w-1/2 bg-slate-800 border border-slate-700 text-white rounded px-2 py-1.5"
                  placeholder="Low %"
                />
                <input
                  type="number"
                  value={pctHigh}
                  onChange={(e) => setPctHigh(parseFloat(e.target.value) || 100)}
                  className="w-1/2 bg-slate-800 border border-slate-700 text-white rounded px-2 py-1.5"
                  placeholder="High %"
                />
              </div>
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white font-display">
                Moneyness (%) vs Annualized Return (%) Scatter Plot
              </h3>
              <p className="text-xs text-slate-400">
                Identify sweet spots where OTM safety margin intersects with optimal yield
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 bg-slate-800 text-slate-300 rounded-md border border-slate-700 font-mono">
              X: Moneyness % (Strike / Spot) | Y: Ann. Return %
            </span>
          </div>

          <div className="h-64 sm:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  type="number"
                  dataKey="moneyness"
                  name="Moneyness"
                  unit="%"
                  stroke="#64748b"
                  fontSize={11}
                  domain={["auto", "auto"]}
                />
                <YAxis
                  type="number"
                  dataKey="returnPct"
                  name="Annual Return"
                  unit="%"
                  stroke="#64748b"
                  fontSize={11}
                />
                <ZAxis range={[50, 200]} />
                <RechartsTooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs text-slate-200">
                          <p className="font-bold text-blue-400 text-sm">
                            {d.ticker} ${d.strike} Put
                          </p>
                          <p className="mt-1">Moneyness: <span className="text-white font-mono">{d.moneyness}%</span></p>
                          <p>Annualized Return: <span className="text-emerald-400 font-mono font-bold">{d.returnPct}%</span></p>
                          <p>Bid Premium: <span className="text-white font-mono">${d.bid}</span></p>
                          <p>DTE: <span className="text-white font-mono">{d.dte} days</span></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter name="Puts" data={scatterData} fill="#3b82f6" />
              </ScatterChart>
            </ResponsiveContainer>
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
