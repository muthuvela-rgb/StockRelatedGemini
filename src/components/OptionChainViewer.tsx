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
import {
  SortCriterion,
  ColumnDefinition,
  SortPreset,
  applyHierarchicalSort,
  handleHeaderClick,
} from "../utils/hierarchicalSort";
import {
  HierarchicalSortControl,
  TableSortHeader,
} from "./HierarchicalSortControl";

type OptionChainSortKey =
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

const OPTION_CHAIN_PRESETS: SortPreset<OptionChainSortKey>[] = [
  {
    label: "User Multi-Tier: Moneyness ➔ Strike ➔ Ann. Return",
    description: "Groups by buffer/moneyness %, breaks ties with strike, then ranks return",
    criteria: [
      { field: "cushion", direction: "desc" },
      { field: "strike", direction: "asc" },
      { field: "annReturn", direction: "desc" },
    ],
  },
  {
    label: "Yield Maximizer: Ann. Return ➔ Strike ➔ IV",
    description: "Highest annualized cash-secured yield first",
    criteria: [
      { field: "annReturn", direction: "desc" },
      { field: "strike", direction: "asc" },
      { field: "impliedVolatility", direction: "desc" },
    ],
  },
  {
    label: "Ladder View: Expiration ➔ Strike",
    description: "Chronological expiration order, ascending strike ladder",
    criteria: [
      { field: "expiration", direction: "asc" },
      { field: "strike", direction: "asc" },
    ],
  },
  {
    label: "High Liquidity: Volume ➔ Open Int ➔ Bid",
    description: "Most actively traded contracts sorted by volume and open interest",
    criteria: [
      { field: "volume", direction: "desc" },
      { field: "openInterest", direction: "desc" },
      { field: "bid", direction: "desc" },
    ],
  },
];

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
  const [deltaRange, setDeltaRange] = useState<[number, number]>([0.0, 1.0]);
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

  const [sortCriteria, setSortCriteria] = useState<SortCriterion<OptionChainSortKey>[]>([
    { id: "1", field: "strike", direction: "asc" },
  ]);

  const handleSort = (field: OptionChainSortKey, isShift: boolean = false) => {
    const defaultDir = field === "strike" || field === "expiration" || field === "delta" ? "asc" : "desc";
    setSortCriteria((prev) => handleHeaderClick(field, isShift, prev, defaultDir));
  };

  // Filter rows by strike range, delta range, and table expiration filter
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchStrike = r.strike >= strikeRange[0] && r.strike <= strikeRange[1];
      const matchExp =
        selectedExp !== "ALL" || tableExpFilter === "ALL" || !r.expiration || r.expiration === tableExpFilter;
      const absDelta = r.delta !== null && r.delta !== undefined ? Math.abs(r.delta) : 0;
      const matchDelta = absDelta >= deltaRange[0] && absDelta <= deltaRange[1];
      return matchStrike && matchExp && matchDelta;
    });
  }, [rows, strikeRange, deltaRange, selectedExp, tableExpFilter]);

  const optionChainColumns: ColumnDefinition<OptionChainSortKey>[] = useMemo(() => {
    const spot = chainData?.current_price || 0;
    const isPut = tab === "puts";
    return [
      {
        key: "strike",
        label: "Strike Price",
        defaultDirection: "asc",
        numeric: true,
        extractor: (r: OptionGreeks) => r.strike,
      },
      {
        key: "cushion",
        label: "Cushion / Moneyness %",
        defaultDirection: "desc",
        numeric: true,
        extractor: (r: OptionGreeks) => {
          const s = spot > 0 ? spot : 1;
          return isPut ? ((s - r.strike) / s) * 100 : ((r.strike - s) / s) * 100;
        },
      },
      {
        key: "annReturn",
        label: "% Ann. Return",
        defaultDirection: "desc",
        numeric: true,
        extractor: (r: OptionGreeks) => getAnnualizedCashReturn(r, spot, isPut, selectedExp),
      },
      {
        key: "expiration",
        label: "Expiration (DTE)",
        defaultDirection: "asc",
        extractor: (r: OptionGreeks) => r.days_to_expiration ?? (r.expiration || ""),
      },
      {
        key: "bid",
        label: "Bid / Ask",
        defaultDirection: "desc",
        numeric: true,
        extractor: (r: OptionGreeks) => (r.bid > 0 ? r.bid : r.lastPrice > 0 ? (r.ask > 0 ? Math.min(r.lastPrice, r.ask) : r.lastPrice) : 0),
      },
      {
        key: "lastPrice",
        label: "Last Price",
        defaultDirection: "desc",
        numeric: true,
        extractor: (r: OptionGreeks) => r.lastPrice ?? 0,
      },
      {
        key: "impliedVolatility",
        label: "IV %",
        defaultDirection: "desc",
        numeric: true,
        extractor: (r: OptionGreeks) => r.impliedVolatility ?? 0,
      },
      {
        key: "delta",
        label: "Delta (Δ)",
        defaultDirection: "asc",
        numeric: true,
        extractor: (r: OptionGreeks) => (r.delta !== null && r.delta !== undefined ? Math.abs(r.delta) : 0),
      },
      {
        key: "gamma",
        label: "Gamma (Γ)",
        defaultDirection: "desc",
        numeric: true,
        extractor: (r: OptionGreeks) => r.gamma ?? 0,
      },
      {
        key: "theta",
        label: "Theta (θ)",
        defaultDirection: "desc",
        numeric: true,
        extractor: (r: OptionGreeks) => r.theta ?? 0,
      },
      {
        key: "vega",
        label: "Vega (ν)",
        defaultDirection: "desc",
        numeric: true,
        extractor: (r: OptionGreeks) => r.vega ?? 0,
      },
      {
        key: "volume",
        label: "Volume",
        defaultDirection: "desc",
        numeric: true,
        extractor: (r: OptionGreeks) => r.volume ?? 0,
      },
      {
        key: "openInterest",
        label: "Open Interest",
        defaultDirection: "desc",
        numeric: true,
        extractor: (r: OptionGreeks) => r.openInterest ?? 0,
      },
    ];
  }, [chainData?.current_price, tab, selectedExp]);

  // Hierarchically sorted rows
  const sortedRows = useMemo(() => {
    return applyHierarchicalSort(filteredRows, sortCriteria, optionChainColumns);
  }, [filteredRows, sortCriteria, optionChainColumns]);

  const totalPages = Math.ceil(sortedRows.length / pageSize) || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [tab, selectedExp, tableExpFilter, strikeRange, ticker, sortCriteria]);

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
          deltaRange={deltaRange}
          onDeltaRangeChange={setDeltaRange}
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
          <div className="flex flex-wrap items-center gap-3">
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
            {(deltaRange[0] > 0.001 || deltaRange[1] < 0.999) && (
              <span className="text-[11px] text-purple-400 font-mono bg-purple-950/40 px-2 py-0.5 rounded border border-purple-800/40">
                Δ {deltaRange[0].toFixed(2)} – {deltaRange[1].toFixed(2)}
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

        {/* Hierarchical Multi-Level Sort Controls */}
        <div className="p-3 border-b border-slate-800/80 bg-slate-950/40">
          <HierarchicalSortControl
            criteria={sortCriteria}
            onChangeCriteria={setSortCriteria}
            availableColumns={optionChainColumns}
            presets={OPTION_CHAIN_PRESETS}
          />
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/90 text-slate-400 font-semibold border-b border-slate-700/80 select-none">
              <tr>
                {selectedExp === "ALL" && (
                  <TableSortHeader
                    field="expiration"
                    label="Expiration (DTE)"
                    criteria={sortCriteria}
                    onSortClick={handleSort}
                    className="px-3 py-3"
                  />
                )}
                <TableSortHeader
                  field="strike"
                  label="Strike"
                  criteria={sortCriteria}
                  onSortClick={handleSort}
                  className="px-4 py-3"
                />
                <TableSortHeader
                  field="cushion"
                  label="Cushion / Moneyness"
                  criteria={sortCriteria}
                  onSortClick={handleSort}
                  className="px-3 py-3"
                  title={tab === "puts" ? "Downside safety cushion % from spot (and Moneyness %)" : "Upside cushion % from spot (and Moneyness %)"}
                />
                <TableSortHeader
                  field="annReturn"
                  label="% Ann. Return"
                  criteria={sortCriteria}
                  onSortClick={handleSort}
                  className="px-3 py-3"
                  title={
                    tab === "puts"
                      ? "Annualized Return on Cash-Secured Put = (Bid / Strike) * (365 / DTE)"
                      : "Annualized Return on Covered Call = (Bid / Spot) * (365 / DTE)"
                  }
                />
                <TableSortHeader
                  field="bid"
                  label="Bid / Ask"
                  criteria={sortCriteria}
                  onSortClick={handleSort}
                  className="px-3 py-3"
                />
                <TableSortHeader
                  field="lastPrice"
                  label="Last"
                  criteria={sortCriteria}
                  onSortClick={handleSort}
                  className="px-3 py-3"
                />
                <TableSortHeader
                  field="impliedVolatility"
                  label="IV %"
                  criteria={sortCriteria}
                  onSortClick={handleSort}
                  className="px-3 py-3"
                />
                <TableSortHeader
                  field="delta"
                  label="Delta (Δ)"
                  criteria={sortCriteria}
                  onSortClick={handleSort}
                  className="px-3 py-3"
                />
                <TableSortHeader
                  field="gamma"
                  label="Gamma (Γ)"
                  criteria={sortCriteria}
                  onSortClick={handleSort}
                  className="px-3 py-3"
                />
                <TableSortHeader
                  field="theta"
                  label="Theta (Θ/day)"
                  criteria={sortCriteria}
                  onSortClick={handleSort}
                  className="px-3 py-3"
                />
                <TableSortHeader
                  field="vega"
                  label="Vega (ν/1%)"
                  criteria={sortCriteria}
                  onSortClick={handleSort}
                  className="px-3 py-3"
                />
                <TableSortHeader
                  field="volume"
                  label="Volume"
                  criteria={sortCriteria}
                  onSortClick={handleSort}
                  className="px-3 py-3"
                />
                <TableSortHeader
                  field="openInterest"
                  label="Open Int"
                  criteria={sortCriteria}
                  onSortClick={handleSort}
                  className="px-4 py-3 text-right"
                  align="right"
                />
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
