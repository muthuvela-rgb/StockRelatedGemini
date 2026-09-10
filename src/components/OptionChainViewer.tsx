import React, { useState, useEffect, useMemo } from "react";
import {
  Layers,
  Search,
  RefreshCw,
  TrendingUp,
  Sliders,
  DollarSign,
  AlertCircle,
  Activity,
  ShieldCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { OptionChainResponse, OptionGreeks } from "../types";
import { formatCurrency, formatPct } from "../lib/utils";
import { BollingerRsiTooltipBadge } from "./BollingerRsiTooltipBadge";
import { OptionChainPremiumStrikePlot } from "./OptionChainPremiumStrikePlot";

interface OptionChainViewerProps {
  watchlist: string[];
}

export const OptionChainViewer: React.FC<OptionChainViewerProps> = ({ watchlist }) => {
  const [ticker, setTicker] = useState("QQQ");
  const [selectedExp, setSelectedExp] = useState<string>("ALL");
  const [tab, setTab] = useState<"puts" | "calls">("puts");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chainData, setChainData] = useState<OptionChainResponse | null>(null);
  const [selectedContract, setSelectedContract] = useState<OptionGreeks | null>(null);
  const [tableExpFilter, setTableExpFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const fetchChain = async (tickerSymbol: string, expiration?: string) => {
    setLoading(true);
    setError(null);
    try {
      const expParam = expiration !== undefined ? expiration : selectedExp;
      let url = `/api/option-chain?ticker=${encodeURIComponent(tickerSymbol)}&all=true`;
      if (expParam) {
        url += `&expiration=${encodeURIComponent(expParam)}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      const data: OptionChainResponse = await res.json();
      setChainData(data);
      if (expParam) {
        setSelectedExp(expParam);
      } else if (data.selected_expiration) {
        setSelectedExp(data.selected_expiration);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load option chain");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChain(ticker, "ALL");
  }, []);

  const handleTickerChange = (newTicker: string) => {
    setTicker(newTicker);
    setSelectedExp("ALL");
    setTableExpFilter("ALL");
    fetchChain(newTicker, "ALL");
  };

  const handleExpChange = (newExp: string) => {
    setSelectedExp(newExp);
    setTableExpFilter(newExp);
    fetchChain(ticker, newExp);
  };

  const rows = tab === "puts" ? chainData?.puts || [] : chainData?.calls || [];

  // Compute all available strikes across puts & calls
  const allStrikes = useMemo(() => {
    if (!chainData) return [0, 1000];
    const putsStrikes = (chainData.puts || []).map((p) => p.strike);
    const callsStrikes = (chainData.calls || []).map((c) => c.strike);
    const combined = [...putsStrikes, ...callsStrikes];
    if (combined.length === 0) return [0, 1000];
    return [Math.floor(Math.min(...combined)), Math.ceil(Math.max(...combined))];
  }, [chainData]);

  const dataMinStrike = allStrikes[0];
  const dataMaxStrike = allStrikes[1];

  const [strikeRange, setStrikeRange] = useState<[number, number]>([0, 1000]);

  // Sync strike range when ticker or chain data changes
  useEffect(() => {
    if (chainData && dataMinStrike < dataMaxStrike) {
      setStrikeRange([dataMinStrike, dataMaxStrike]);
    }
  }, [chainData?.ticker, dataMinStrike, dataMaxStrike]);

  // Helper to calculate annualized return on cash-secured basis
  const getAnnualizedCashReturn = (
    contract: OptionGreeks,
    spot: number,
    isPut: boolean,
    fallbackExp?: string
  ): number => {
    // For sell put options, use last price ONLY IF bid is zero
    const premium = contract.bid > 0
      ? contract.bid
      : (contract.lastPrice > 0 ? (contract.ask > 0 ? Math.min(contract.lastPrice, contract.ask) : contract.lastPrice) : 0);
    if (!premium || premium <= 0) return 0;

    let dte = contract.days_to_expiration;
    if (!dte || dte <= 0) {
      const expStr = contract.expiration || (fallbackExp !== "ALL" ? fallbackExp : "");
      if (expStr) {
        const msDiff = new Date(expStr).getTime() - new Date().setHours(0, 0, 0, 0);
        dte = Math.max(Math.ceil(msDiff / (1000 * 60 * 60 * 24)), 1);
      } else {
        dte = 30;
      }
    }

    const capitalBasis = isPut ? contract.strike : spot > 0 ? spot : contract.strike;
    if (!capitalBasis || capitalBasis <= 0) return 0;

    return (premium / capitalBasis) * (365.0 / dte) * 100;
  };

  // Sorting state for table columns
  type SortKey =
    | "expiration"
    | "strike"
    | "cushion"
    | "annReturn"
    | "bid"
    | "lastPrice"
    | "impliedVolatility"
    | "delta"
    | "gamma"
    | "theta"
    | "vega"
    | "volume"
    | "openInterest";

  const [sortField, setSortField] = useState<SortKey>("strike");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (field: SortKey) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      if (field === "strike" || field === "expiration") {
        setSortDir("asc");
      } else {
        setSortDir("desc");
      }
    }
  };

  // Filter rows by strike range and table expiration filter
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchStrike = r.strike >= strikeRange[0] && r.strike <= strikeRange[1];
      const matchExp =
        selectedExp !== "ALL" || tableExpFilter === "ALL" || !r.expiration || r.expiration === tableExpFilter;
      return matchStrike && matchExp;
    });
  }, [rows, strikeRange, selectedExp, tableExpFilter]);

  // Sort filtered rows by active column
  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    return list.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      switch (sortField) {
        case "expiration":
          valA = a.days_to_expiration ?? (a.expiration || "");
          valB = b.days_to_expiration ?? (b.expiration || "");
          if (valA === valB) {
            return (a.strike - b.strike) * (sortDir === "asc" ? 1 : -1);
          }
          break;
        case "strike":
          valA = a.strike;
          valB = b.strike;
          break;
        case "cushion": {
          const spot = chainData?.current_price || 1;
          const isPut = tab === "puts";
          valA = isPut ? ((spot - a.strike) / spot) * 100 : ((a.strike - spot) / spot) * 100;
          valB = isPut ? ((spot - b.strike) / spot) * 100 : ((b.strike - spot) / spot) * 100;
          break;
        }
        case "annReturn": {
          const spot = chainData?.current_price || 0;
          const isPut = tab === "puts";
          valA = getAnnualizedCashReturn(a, spot, isPut, selectedExp);
          valB = getAnnualizedCashReturn(b, spot, isPut, selectedExp);
          break;
        }
        case "bid":
          valA = a.bid > 0 ? a.bid : (a.lastPrice > 0 ? (a.ask > 0 ? Math.min(a.lastPrice, a.ask) : a.lastPrice) : 0);
          valB = b.bid > 0 ? b.bid : (b.lastPrice > 0 ? (b.ask > 0 ? Math.min(b.lastPrice, b.ask) : b.lastPrice) : 0);
          break;
        case "lastPrice":
          valA = a.lastPrice ?? 0;
          valB = b.lastPrice ?? 0;
          break;
        case "impliedVolatility":
          valA = a.impliedVolatility ?? 0;
          valB = b.impliedVolatility ?? 0;
          break;
        case "delta":
          valA = a.delta !== null && a.delta !== undefined ? Math.abs(a.delta) : -999;
          valB = b.delta !== null && b.delta !== undefined ? Math.abs(b.delta) : -999;
          break;
        case "gamma":
          valA = a.gamma ?? 0;
          valB = b.gamma ?? 0;
          break;
        case "theta":
          valA = a.theta ?? 0;
          valB = b.theta ?? 0;
          break;
        case "vega":
          valA = a.vega ?? 0;
          valB = b.vega ?? 0;
          break;
        case "volume":
          valA = a.volume ?? 0;
          valB = b.volume ?? 0;
          break;
        case "openInterest":
          valA = a.openInterest ?? 0;
          valB = b.openInterest ?? 0;
          break;
      }

      if (typeof valA === "string" && typeof valB === "string") {
        return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortField, sortDir, chainData?.current_price, tab]);

  const totalPages = Math.ceil(sortedRows.length / pageSize) || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [tab, selectedExp, tableExpFilter, strikeRange, ticker, sortField, sortDir]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      {/* Search & Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white font-display flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" />
              Real-Time Option Chain & Black-Scholes Greeks
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Live options data, multi-expiration curve visualization, and computed Black-Scholes Greeks across all expiration cycles.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleTickerChange(ticker)}
              placeholder="Ticker..."
              className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-bold w-28 uppercase outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => handleTickerChange(ticker)}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Fetch
            </button>
          </div>
        </div>

        {/* Expiration Selection & Call/Put Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
          {/* Expiration Dropdown with ALL Option Chains */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              Expiration Date:
            </span>

            <select
              value={selectedExp}
              onChange={(e) => handleExpChange(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 font-mono font-medium cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-blue-300 font-bold">
                🌟 ALL Expiration Dates (All {chainData?.expirations.length || 26} Option Chains)
              </option>
              {(chainData?.expirations || []).map((exp) => (
                <option key={exp} value={exp} className="bg-slate-900 text-white">
                  {exp} {chainData?.all_chains?.[exp]?.days_to_expiration !== undefined ? `(${chainData.all_chains[exp].days_to_expiration} DTE)` : ""}
                </option>
              ))}
            </select>

            {/* Quick Toggle between ALL Option Chains and Single Expiration */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
              <button
                type="button"
                onClick={() => handleExpChange("ALL")}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  selectedExp === "ALL"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                All Option Chains ({chainData?.expirations.length || 0})
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedExp === "ALL" && chainData?.expirations?.length) {
                    handleExpChange(chainData.expirations[0]);
                  }
                }}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  selectedExp !== "ALL"
                    ? "bg-slate-800 text-slate-100 shadow-sm border border-slate-700"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Single Date
              </button>
            </div>

            {selectedExp !== "ALL" && chainData && (
              <span className="text-xs text-slate-400 font-mono">
                ({chainData.days_to_expiration} DTE)
              </span>
            )}
          </div>

          {/* Call / Put Toggle */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setTab("puts")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                tab === "puts"
                  ? "bg-rose-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Puts ({chainData?.puts.length || 0})
            </button>
            <button
              onClick={() => setTab("calls")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                tab === "calls"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Calls ({chainData?.calls.length || 0})
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

      {/* Spot Price & Technicals Banner */}
      {chainData && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-4">
              <span className="font-bold text-white text-sm">{chainData.ticker} Spot Price:</span>
              <span className="text-lg font-mono font-bold text-blue-400">${chainData.current_price.toFixed(2)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-slate-400 font-mono">
              {chainData.next_earnings_date && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/90 text-slate-300 border border-slate-700/80 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  <span>Next Earnings: <strong className="text-white">{chainData.next_earnings_date}</strong></span>
                </span>
              )}
              {selectedExp === "ALL" ? (
                <span className="text-blue-300 font-semibold">
                  All {chainData.expirations.length} Expiration Option Chains Loaded
                </span>
              ) : (
                <span>
                  Selected Expiration: <span className="text-slate-200 font-semibold">{chainData.selected_expiration}</span> ({chainData.days_to_expiration} DTE)
                </span>
              )}
            </div>
          </div>

          {(chainData.rsi_14 !== undefined || chainData.bollinger || chainData.fibonacci) && (
            <div className="pt-2 border-t border-slate-800/80">
              <BollingerRsiTooltipBadge
                spot={chainData.current_price}
                rsi={chainData.rsi_14}
                bollinger={chainData.bollinger}
                fibonacci={chainData.fibonacci}
                fiftyTwoWeekHigh={chainData.fifty_two_week_high}
                fiftyTwoWeekLow={chainData.fifty_two_week_low}
              />
            </div>
          )}
        </div>
      )}

      {/* PREMIUM VS STRIKE PLOT WITH STRIKE RANGE SLIDER & ALL OPTION CHAINS */}
      {chainData && (
        <OptionChainPremiumStrikePlot
          ticker={ticker}
          currentPrice={chainData.current_price}
          selectedExp={selectedExp}
          allExpirations={chainData.expirations || []}
          tab={tab}
          onTabChange={(newTab) => {
            if (newTab === "puts" || newTab === "calls") setTab(newTab);
          }}
          contracts={rows}
          callsContracts={chainData.calls}
          putsContracts={chainData.puts}
          allChainsMap={chainData.all_chains}
          bollinger={chainData.bollinger}
          rsi_14={chainData.rsi_14}
          fibonacci={chainData.fibonacci}
          fiftyTwoWeekHigh={chainData.fifty_two_week_high}
          fiftyTwoWeekLow={chainData.fifty_two_week_low}
          nextEarningsDate={chainData.next_earnings_date}
          nextEarningsTimestamp={chainData.next_earnings_timestamp}
          strikeRange={strikeRange}
          onStrikeRangeChange={setStrikeRange}
          dataMinStrike={dataMinStrike}
          dataMaxStrike={dataMaxStrike}
          selectedContract={selectedContract}
          selectedContractSymbol={selectedContract?.contractSymbol}
          onSelectContract={(c) => setSelectedContract(c)}
          onScrollToTable={() => {
            const el = document.getElementById("option-chain-table-container");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
        />
      )}

      {/* OPTION CHAIN TABLE */}
      <div id="option-chain-table-container" className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-0">
        {/* Table Header Controls */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-white">
              {tab === "puts" ? "Put Contracts" : "Call Contracts"} Table
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              Showing {filteredRows.length} of {rows.length} contracts
            </span>
            {(strikeRange[0] > dataMinStrike || strikeRange[1] < dataMaxStrike) && (
              <span className="text-[11px] text-cyan-400 font-mono">
                (Strikes: ${strikeRange[0].toFixed(1)} – ${strikeRange[1].toFixed(1)})
              </span>
            )}
          </div>

          {/* If ALL Expirations is active, table expiration filter pills */}
          {selectedExp === "ALL" && (
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
              <span className="text-[11px] text-slate-400 shrink-0 font-medium">Table Exp Filter:</span>
              <button
                onClick={() => setTableExpFilter("ALL")}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                  tableExpFilter === "ALL"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                All
              </button>
              {(chainData?.expirations || []).slice(0, 8).map((exp) => (
                <button
                  key={exp}
                  onClick={() => setTableExpFilter(exp)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition cursor-pointer ${
                    tableExpFilter === exp
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {exp}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/90 text-slate-400 font-semibold border-b border-slate-700/80 select-none">
              <tr>
                {selectedExp === "ALL" && (
                  <th
                    onClick={() => handleSort("expiration")}
                    className={`px-3 py-3 cursor-pointer transition-colors hover:text-white hover:bg-slate-750 ${
                      sortField === "expiration" ? "text-blue-300 bg-slate-800/90" : ""
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Expiration (DTE)</span>
                      {sortField === "expiration" ? (
                        sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 opacity-60 hover:opacity-100 shrink-0" />
                      )}
                    </div>
                  </th>
                )}
                <th
                  onClick={() => handleSort("strike")}
                  className={`px-4 py-3 cursor-pointer transition-colors hover:text-white hover:bg-slate-750 ${
                    sortField === "strike" ? "text-blue-300 bg-slate-800/90" : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Strike</span>
                    {sortField === "strike" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 opacity-60 hover:opacity-100 shrink-0" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("cushion")}
                  className={`px-3 py-3 cursor-pointer transition-colors hover:text-white hover:bg-slate-750 ${
                    sortField === "cushion" ? "text-blue-300 bg-slate-800/90" : ""
                  }`}
                  title={tab === "puts" ? "Downside safety cushion % from spot (and Moneyness %)" : "Upside cushion % from spot (and Moneyness %)"}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Cushion / Moneyness</span>
                    {sortField === "cushion" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 opacity-60 hover:opacity-100 shrink-0" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("annReturn")}
                  className={`px-3 py-3 cursor-pointer transition-colors hover:text-white hover:bg-slate-750 ${
                    sortField === "annReturn" ? "text-emerald-300 bg-slate-800/90" : ""
                  }`}
                  title={
                    tab === "puts"
                      ? "Annualized Return on Cash-Secured Put = (Bid / Strike) * (365 / DTE)"
                      : "Annualized Return on Covered Call = (Bid / Spot) * (365 / DTE)"
                  }
                >
                  <div className="flex items-center gap-1.5">
                    <span>% Ann. Return</span>
                    {sortField === "annReturn" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 opacity-60 hover:opacity-100 shrink-0" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("bid")}
                  className={`px-3 py-3 cursor-pointer transition-colors hover:text-white hover:bg-slate-750 ${
                    sortField === "bid" ? "text-blue-300 bg-slate-800/90" : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Bid / Ask</span>
                    {sortField === "bid" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 opacity-60 hover:opacity-100 shrink-0" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("lastPrice")}
                  className={`px-3 py-3 cursor-pointer transition-colors hover:text-white hover:bg-slate-750 ${
                    sortField === "lastPrice" ? "text-blue-300 bg-slate-800/90" : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Last</span>
                    {sortField === "lastPrice" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 opacity-60 hover:opacity-100 shrink-0" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("impliedVolatility")}
                  className={`px-3 py-3 cursor-pointer transition-colors hover:text-white hover:bg-slate-750 ${
                    sortField === "impliedVolatility" ? "text-blue-300 bg-slate-800/90" : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>IV %</span>
                    {sortField === "impliedVolatility" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 opacity-60 hover:opacity-100 shrink-0" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("delta")}
                  className={`px-3 py-3 cursor-pointer transition-colors hover:text-white hover:bg-slate-750 ${
                    sortField === "delta" ? "text-blue-300 bg-slate-800/90" : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Delta (Δ)</span>
                    {sortField === "delta" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 opacity-60 hover:opacity-100 shrink-0" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("gamma")}
                  className={`px-3 py-3 cursor-pointer transition-colors hover:text-white hover:bg-slate-750 ${
                    sortField === "gamma" ? "text-blue-300 bg-slate-800/90" : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Gamma (Γ)</span>
                    {sortField === "gamma" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 opacity-60 hover:opacity-100 shrink-0" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("theta")}
                  className={`px-3 py-3 cursor-pointer transition-colors hover:text-white hover:bg-slate-750 ${
                    sortField === "theta" ? "text-blue-300 bg-slate-800/90" : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Theta (Θ/day)</span>
                    {sortField === "theta" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 opacity-60 hover:opacity-100 shrink-0" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("vega")}
                  className={`px-3 py-3 cursor-pointer transition-colors hover:text-white hover:bg-slate-750 ${
                    sortField === "vega" ? "text-blue-300 bg-slate-800/90" : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Vega (ν/1%)</span>
                    {sortField === "vega" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 opacity-60 hover:opacity-100 shrink-0" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("volume")}
                  className={`px-3 py-3 cursor-pointer transition-colors hover:text-white hover:bg-slate-750 ${
                    sortField === "volume" ? "text-blue-300 bg-slate-800/90" : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Volume</span>
                    {sortField === "volume" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 opacity-60 hover:opacity-100 shrink-0" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("openInterest")}
                  className={`px-4 py-3 text-right cursor-pointer transition-colors hover:text-white hover:bg-slate-750 ${
                    sortField === "openInterest" ? "text-blue-300 bg-slate-800/90" : ""
                  }`}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Open Int</span>
                    {sortField === "openInterest" ? (
                      sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 opacity-60 hover:opacity-100 shrink-0" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={selectedExp === "ALL" ? 13 : 12}
                    className="px-6 py-12 text-center text-slate-500 font-sans"
                  >
                    {loading ? "Fetching option contracts..." : "No option contracts found matching the strike range."}
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r, i) => {
                  const isAtm =
                    chainData?.current_price &&
                    Math.abs(r.strike - chainData.current_price) < (chainData.current_price * 0.01);

                  const isBelowLowerBand =
                    chainData?.bollinger && r.strike < chainData.bollinger.lower_band;

                  const isSelected = selectedContract?.contractSymbol === r.contractSymbol;

                  const spot = chainData?.current_price || 0;
                  const isPut = tab === "puts";
                  const cushionPct = spot > 0 ? (isPut ? ((spot - r.strike) / spot) * 100 : ((r.strike - spot) / spot) * 100) : 0;
                  const moneynessPct = spot > 0 ? (r.strike / spot) * 100 : 100;
                  const isAtmCushion = Math.abs(cushionPct) <= 0.8;
                  const isOtm = cushionPct > 0.05;

                  return (
                    <tr
                      key={r.contractSymbol || i}
                      onClick={() => setSelectedContract(r)}
                      className={`hover:bg-slate-800/60 transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-blue-950/40 ring-1 ring-blue-500"
                          : isBelowLowerBand
                          ? "bg-emerald-950/20"
                          : r.inTheMoney
                          ? "bg-blue-950/20"
                          : ""
                      } ${isAtm ? "border-y-2 border-amber-500/60" : ""}`}
                    >
                      {selectedExp === "ALL" && (
                        <td className="px-3 py-2.5 font-sans font-medium text-slate-300">
                          <span className="font-mono text-slate-200">{r.expiration}</span>{" "}
                          <span className="text-[10px] text-slate-400">({r.days_to_expiration}d)</span>
                        </td>
                      )}
                      <td className="px-4 py-2.5 font-bold text-white flex items-center gap-2">
                        <span>${r.strike.toFixed(2)}</span>
                        {isBelowLowerBand && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-sans font-bold border border-emerald-500/40"
                            title={`Below 20-Day 2.0σ Lower Bollinger Band ($${chainData.bollinger?.lower_band.toFixed(2)})`}
                          >
                            &lt;BB Lower
                          </span>
                        )}
                        {r.inTheMoney && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 font-sans">
                            ITM
                          </span>
                        )}
                        {isAtm && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-sans font-bold">
                            ATM
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              isAtmCushion
                                ? "text-amber-400"
                                : isOtm
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }`}
                            title={`${cushionPct >= 0 ? "+" : ""}${cushionPct.toFixed(2)}% ${isPut ? "downside safety cushion" : "upside cushion"}`}
                          >
                            {cushionPct >= 0 ? `+${cushionPct.toFixed(1)}%` : `${cushionPct.toFixed(1)}%`}
                          </span>
                          <span
                            className="text-[10px] text-slate-500 font-sans"
                            title={`Moneyness: ${moneynessPct.toFixed(2)}% of spot ($${spot.toFixed(2)})`}
                          >
                            ({moneynessPct.toFixed(1)}%)
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        {(() => {
                          const annReturn = getAnnualizedCashReturn(r, spot, isPut, selectedExp);
                          return (
                            <div className="flex flex-col">
                              <span
                                className={`font-bold ${
                                  annReturn >= 25
                                    ? "text-emerald-400 font-extrabold"
                                    : annReturn >= 15
                                    ? "text-teal-300"
                                    : annReturn >= 8
                                    ? "text-emerald-200"
                                    : annReturn > 0
                                    ? "text-slate-300"
                                    : "text-slate-500"
                                }`}
                                title={`Annualized Return: ${annReturn.toFixed(2)}%/yr (Premium $${(r.bid > 0 ? r.bid : (r.lastPrice > 0 ? (r.ask > 0 ? Math.min(r.lastPrice, r.ask) : r.lastPrice) : 0)).toFixed(2)} on $${r.strike.toFixed(2)} collateral)`}
                              >
                                {annReturn > 0 ? `${annReturn.toFixed(1)}%` : "—"}
                              </span>
                              {annReturn > 0 && (
                                <span className="text-[10px] text-slate-500 font-sans">
                                  CS: ${(r.strike * 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">
                        <span className="text-emerald-400 font-semibold">${r.bid.toFixed(2)}</span> / ${r.ask.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-200">${r.lastPrice.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-amber-400 font-medium">{r.impliedVolatility}%</td>
                      <td className="px-3 py-2.5 text-slate-200 font-semibold">
                        {r.delta !== null ? r.delta : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400">{r.gamma !== null ? r.gamma : "-"}</td>
                      <td className="px-3 py-2.5 text-rose-400 font-semibold">{r.theta !== null ? r.theta : "-"}</td>
                      <td className="px-3 py-2.5 text-cyan-400">{r.vega !== null ? r.vega : "-"}</td>
                      <td className="px-3 py-2.5 text-slate-400">{r.volume.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-slate-300">{r.openInterest.toLocaleString()}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-3.5 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-400">
              Showing page <strong className="text-white">{currentPage}</strong> of{" "}
              <strong className="text-white">{totalPages}</strong> ({filteredRows.length} contracts)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold flex items-center gap-1 disabled:opacity-40 cursor-pointer transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold flex items-center gap-1 disabled:opacity-40 cursor-pointer transition"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
