import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  ShieldAlert,
  DollarSign,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Award,
  ArrowRight,
  Info,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  VerticalPutSpread,
  VerticalPutOptimizerOptions,
  OptionStrikeData,
  findVerticalPutSpreads,
} from "../utils/verticalPutOptimizer";
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

type VerticalSpreadSortKey =
  | "rank"
  | "sellStrike"
  | "buyStrike"
  | "netCredit"
  | "totalCredit100"
  | "maxRisk100"
  | "returnOnRisk"
  | "downsideCushionPct";

const VERTICAL_SPREAD_COLUMNS: ColumnDefinition<VerticalSpreadSortKey>[] = [
  { key: "rank", label: "Rank", defaultDirection: "asc", numeric: true, extractor: (s: any) => s.originalRank },
  { key: "netCredit", label: "Net Credit ($)", defaultDirection: "desc", numeric: true },
  { key: "totalCredit100", label: "Total Credit ($100x)", defaultDirection: "desc", numeric: true },
  { key: "sellStrike", label: "Sell Strike", defaultDirection: "asc", numeric: true },
  { key: "buyStrike", label: "Buy Strike", defaultDirection: "asc", numeric: true },
  { key: "returnOnRisk", label: "Return on Risk (RoR %)", defaultDirection: "desc", numeric: true },
  { key: "downsideCushionPct", label: "Moneyness %", defaultDirection: "desc", numeric: true },
  { key: "maxRisk100", label: "Max Risk ($)", defaultDirection: "asc", numeric: true },
];

const VERTICAL_SPREAD_PRESETS: SortPreset<VerticalSpreadSortKey>[] = [
  {
    label: "Optimizer Default: Rank ➔ Net Credit",
    description: "Ordered by best optimizer scoring and credit received",
    criteria: [
      { field: "rank", direction: "asc" },
      { field: "netCredit", direction: "desc" },
    ],
  },
  {
    label: "Maximum Yield: RoR ➔ Net Credit ➔ Moneyness",
    description: "Highest return-on-risk ratio first with healthy downside buffer",
    criteria: [
      { field: "returnOnRisk", direction: "desc" },
      { field: "netCredit", direction: "desc" },
      { field: "downsideCushionPct", direction: "desc" },
    ],
  },
  {
    label: "Defensive Moneyness: Moneyness ➔ Net Credit ➔ Max Risk",
    description: "Widest safety buffer from spot price with lowest maximum risk",
    criteria: [
      { field: "downsideCushionPct", direction: "desc" },
      { field: "netCredit", direction: "desc" },
      { field: "maxRisk100", direction: "asc" },
    ],
  },
];

interface VerticalPutOptimizerPanelProps {
  ticker: string;
  expiration: string;
  spotPrice: number;
  dte: number;
  data: OptionStrikeData[];
  selectedSpread: VerticalPutSpread | null;
  onSelectSpread: (spread: VerticalPutSpread | null) => void;
  availableExpirations?: string[];
  selectedExpiration?: string;
  onSelectExpiration?: (exp: string) => void;
  compact?: boolean;
}

export const VerticalPutOptimizerPanel: React.FC<VerticalPutOptimizerPanelProps> = ({
  ticker,
  expiration,
  spotPrice,
  dte,
  data,
  selectedSpread,
  onSelectSpread,
  availableExpirations,
  selectedExpiration,
  onSelectExpiration,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [widthFilter, setWidthFilter] = useState<"ALL" | number>("ALL");
  const [cushionFilter, setCushionFilter] = useState<"ALL" | "OTM_ONLY" | "BUFFER_5">("ALL");
  const [showTable, setShowTable] = useState<boolean>(false);

  const [tableSortCriteria, setTableSortCriteria] = useState<SortCriterion<VerticalSpreadSortKey>[]>([
    { id: "1", field: "rank", direction: "asc" },
  ]);

  const handleTableSort = (field: VerticalSpreadSortKey, isShift: boolean = false) => {
    const defaultDir = field === "rank" || field === "sellStrike" || field === "buyStrike" || field === "maxRisk100" ? "asc" : "desc";
    setTableSortCriteria((prev) => handleHeaderClick(field, isShift, prev, defaultDir));
  };

  // Compute all available spreads sorted by net premium collected descending
  const allSpreads = useMemo(() => {
    return findVerticalPutSpreads(data, ticker, expiration, spotPrice, dte, {
      widthFilter,
      cushionFilter,
    });
  }, [data, ticker, expiration, spotPrice, dte, widthFilter, cushionFilter]);

  const sortedSpreads = useMemo(() => {
    const listWithRank = allSpreads.map((s, idx) => ({ ...s, originalRank: idx + 1 }));
    return applyHierarchicalSort(listWithRank, tableSortCriteria, VERTICAL_SPREAD_COLUMNS);
  }, [allSpreads, tableSortCriteria]);

  // Determine available spread widths in data
  const availableWidths = useMemo(() => {
    const rawSpreads = findVerticalPutSpreads(data, ticker, expiration, spotPrice, dte);
    const widths = Array.from(new Set(rawSpreads.map((s) => s.spreadWidth))).sort((a, b) => a - b);
    return widths.slice(0, 8); // Top common widths
  }, [data, ticker, expiration, spotPrice, dte]);

  // Top recommended spread that maximizes total premium collected
  const topSpread = allSpreads.length > 0 ? allSpreads[0] : null;

  // Auto-select the top spread if none currently selected, or keep selection if still in list
  React.useEffect(() => {
    if (!selectedSpread && topSpread) {
      onSelectSpread(topSpread);
    } else if (selectedSpread && !allSpreads.some((s) => s.id === selectedSpread.id)) {
      onSelectSpread(topSpread);
    }
  }, [allSpreads, topSpread]);

  const activeSpread = selectedSpread || topSpread;

  if (data.length < 2) {
    return null;
  }

  return (
    <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-3.5 shadow-xl text-xs space-y-3">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Award className="w-4 h-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm font-display">
                Vertical Put Optimizer
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Max Premium Collected
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Sell higher strike put + Buy lower strike put for expiration <strong className="text-cyan-300 font-mono">{expiration}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Expiration Switcher if available */}
          {availableExpirations && availableExpirations.length > 1 && onSelectExpiration && (
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
              <span className="text-slate-400 text-[10px]">Exp:</span>
              <select
                value={selectedExpiration || expiration}
                onChange={(e) => onSelectExpiration(e.target.value)}
                className="bg-transparent text-cyan-300 font-mono font-semibold outline-none cursor-pointer text-xs"
              >
                {availableExpirations.map((exp) => (
                  <option key={exp} value={exp} className="bg-slate-900 text-white">
                    {exp}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Minimize / Toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
            title={isOpen ? "Collapse optimizer" : "Expand optimizer"}
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="space-y-3">
          {/* Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] bg-slate-900/90 p-2 rounded-lg border border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1 font-medium">
              <SlidersHorizontal className="w-3 h-3 text-slate-400" />
              Width:
            </span>
            <div className="flex flex-wrap items-center gap-1">
              <button
                onClick={() => setWidthFilter("ALL")}
                className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                  widthFilter === "ALL"
                    ? "bg-emerald-600 text-white font-bold"
                    : "bg-slate-800 text-slate-300 hover:text-white"
                }`}
              >
                Max Net (Any)
              </button>
              {availableWidths.map((w) => (
                <button
                  key={w}
                  onClick={() => setWidthFilter(w)}
                  className={`px-2 py-0.5 rounded font-medium transition cursor-pointer font-mono ${
                    widthFilter === w
                      ? "bg-emerald-600 text-white font-bold"
                      : "bg-slate-800 text-slate-300 hover:text-white"
                  }`}
                >
                  ${w.toFixed(w % 1 === 0 ? 0 : 2)}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-slate-700 mx-1 hidden sm:block" />

            <span className="text-slate-400 font-medium">Filter:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCushionFilter("ALL")}
                className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                  cushionFilter === "ALL"
                    ? "bg-slate-700 text-white"
                    : "bg-slate-800/60 text-slate-400 hover:text-white"
                }`}
              >
                All Strikes
              </button>
              <button
                onClick={() => setCushionFilter("OTM_ONLY")}
                className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                  cushionFilter === "OTM_ONLY"
                    ? "bg-cyan-600 text-white font-bold"
                    : "bg-slate-800/60 text-slate-400 hover:text-white"
                }`}
              >
                OTM Only (Sell ≤ Spot)
              </button>
              <button
                onClick={() => setCushionFilter("BUFFER_5")}
                className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                  cushionFilter === "BUFFER_5"
                    ? "bg-cyan-600 text-white font-bold"
                    : "bg-slate-800/60 text-slate-400 hover:text-white"
                }`}
              >
                ≥5% Moneyness
              </button>
            </div>
          </div>

          {/* Active / Top Strategy Card */}
          {activeSpread ? (
            <div className="bg-slate-900 border-2 border-emerald-500/40 rounded-xl p-3.5 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-white">
                    <span className="text-emerald-400 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded">
                      SELL ${activeSpread.sellStrike} Put
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-amber-400 px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded">
                      BUY ${activeSpread.buyStrike} Put
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    (${activeSpread.spreadWidth.toFixed(2)} width)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Plot Highlight Active
                  </span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 font-mono text-xs">
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-emerald-400 block font-sans font-semibold">
                    Net Premium Collected
                  </span>
                  <span className="text-base font-bold text-emerald-300">
                    ${activeSpread.netCredit.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    ${activeSpread.totalCredit100.toFixed(0)} / contract
                  </span>
                </div>

                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-rose-400 block font-sans font-semibold">
                    Max Risk / Collateral
                  </span>
                  <span className="text-base font-bold text-slate-200">
                    ${activeSpread.maxRisk.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    ${activeSpread.maxRisk100.toFixed(0)} / contract
                  </span>
                </div>

                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-cyan-400 block font-sans font-semibold">
                    Return on Risk (RoR)
                  </span>
                  <span className="text-base font-bold text-cyan-300">
                    {activeSpread.returnOnRisk.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {activeSpread.annualizedReturnOnRisk.toFixed(0)}% /yr ann.
                  </span>
                </div>

                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-amber-400 block font-sans font-semibold">
                    Breakeven Price
                  </span>
                  <span className="text-base font-bold text-white">
                    ${activeSpread.breakeven.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    ${(activeSpread.sellStrike - activeSpread.breakeven).toFixed(2)} buffer
                  </span>
                </div>

                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-400 block font-sans font-semibold">
                    Moneyness
                  </span>
                  <span
                    className={`text-base font-bold ${
                      activeSpread.downsideCushionPct >= 5
                        ? "text-emerald-400"
                        : activeSpread.downsideCushionPct >= 0
                        ? "text-amber-400"
                        : "text-rose-400"
                    }`}
                  >
                    {activeSpread.downsideCushionPct.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {activeSpread.isOTM ? "Out-of-the-Money" : "In-the-Money"}
                  </span>
                </div>
              </div>

              {/* Legs details */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1 text-slate-400 border-t border-slate-800/80">
                <div className="flex items-center gap-3">
                  <span>
                    Short Leg: <strong className="text-emerald-400 font-mono">${activeSpread.sellStrike}</strong> (Bid: ${activeSpread.sellPremium.toFixed(2)})
                  </span>
                  <span>•</span>
                  <span>
                    Long Leg: <strong className="text-amber-400 font-mono">${activeSpread.buyStrike}</strong> (Ask: ${activeSpread.buyPremium.toFixed(2)})
                  </span>
                </div>

                <button
                  onClick={() => setShowTable(!showTable)}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer transition"
                >
                  {showTable ? "Hide Other Spreads" : `Compare Top ${Math.min(10, allSpreads.length)} Spreads`}
                  {showTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-slate-400 bg-slate-900 rounded-xl border border-slate-800">
              No vertical put spreads match the selected width and moneyness criteria. Try selecting "Max Net (Any)" or "All Strikes".
            </div>
          )}

          {/* Expandable Candidates Table */}
          {showTable && allSpreads.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden space-y-2">
              <div className="p-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300 font-semibold">
                <span>Top Vertical Put Spreads Ranked by Premium Collected</span>
                <span className="text-[10px] text-slate-500">Click any row to display on chart</span>
              </div>

              <div className="px-2.5 pt-1">
                <HierarchicalSortControl
                  criteria={tableSortCriteria}
                  onChangeCriteria={setTableSortCriteria}
                  availableColumns={VERTICAL_SPREAD_COLUMNS}
                  presets={VERTICAL_SPREAD_PRESETS}
                />
              </div>

              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-left font-mono text-[11px] select-none">
                  <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800 sticky top-0">
                    <tr>
                      <TableSortHeader
                        field="rank"
                        label="Rank"
                        criteria={tableSortCriteria}
                        onSortClick={handleTableSort}
                        className="p-2"
                      />
                      <TableSortHeader
                        field="sellStrike"
                        label="Sell Strike"
                        criteria={tableSortCriteria}
                        onSortClick={handleTableSort}
                        className="p-2"
                      />
                      <TableSortHeader
                        field="buyStrike"
                        label="Buy Strike"
                        criteria={tableSortCriteria}
                        onSortClick={handleTableSort}
                        className="p-2"
                      />
                      <TableSortHeader
                        field="netCredit"
                        label="Net Credit ($)"
                        criteria={tableSortCriteria}
                        onSortClick={handleTableSort}
                        align="right"
                        className="p-2"
                      />
                      <TableSortHeader
                        field="totalCredit100"
                        label="Total ($100x)"
                        criteria={tableSortCriteria}
                        onSortClick={handleTableSort}
                        align="right"
                        className="p-2"
                      />
                      <TableSortHeader
                        field="maxRisk100"
                        label="Max Risk"
                        criteria={tableSortCriteria}
                        onSortClick={handleTableSort}
                        align="right"
                        className="p-2"
                      />
                      <TableSortHeader
                        field="returnOnRisk"
                        label="RoR (%)"
                        criteria={tableSortCriteria}
                        onSortClick={handleTableSort}
                        align="right"
                        className="p-2 text-cyan-300"
                      />
                      <TableSortHeader
                        field="downsideCushionPct"
                        label="Moneyness"
                        criteria={tableSortCriteria}
                        onSortClick={handleTableSort}
                        align="right"
                        className="p-2"
                      />
                      <th className="p-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {sortedSpreads.slice(0, 15).map((spread) => {
                      const isSelected = activeSpread?.id === spread.id;
                      return (
                        <tr
                          key={spread.id}
                          onClick={() => onSelectSpread(spread)}
                          className={`cursor-pointer transition hover:bg-slate-800/80 ${
                            isSelected ? "bg-emerald-950/40 border-l-2 border-emerald-500" : ""
                          }`}
                        >
                          <td className="p-2 font-bold text-slate-400">
                            {spread.originalRank === 1 ? "★ #1" : `#${spread.originalRank}`}
                          </td>
                          <td className="p-2 text-emerald-400 font-bold">
                            ${spread.sellStrike} (${spread.sellPremium.toFixed(2)})
                          </td>
                          <td className="p-2 text-amber-400 font-bold">
                            ${spread.buyStrike} (${spread.buyPremium.toFixed(2)})
                          </td>
                          <td className="p-2 text-right text-emerald-300 font-bold">
                            ${spread.netCredit.toFixed(2)}
                          </td>
                          <td className="p-2 text-right text-white">
                            ${spread.totalCredit100.toFixed(0)}
                          </td>
                          <td className="p-2 text-right text-slate-300">
                            ${spread.maxRisk100.toFixed(0)}
                          </td>
                          <td className="p-2 text-right text-cyan-300">
                            {spread.returnOnRisk.toFixed(1)}%
                          </td>
                          <td className="p-2 text-right">
                            <span
                              className={
                                spread.downsideCushionPct >= 5
                                  ? "text-emerald-400"
                                  : spread.downsideCushionPct >= 0
                                  ? "text-amber-400"
                                  : "text-rose-400"
                              }
                            >
                              {spread.downsideCushionPct.toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            {isSelected ? (
                              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                                Active
                              </span>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectSpread(spread);
                                }}
                                className="text-[10px] text-slate-400 hover:text-white bg-slate-800 px-1.5 py-0.5 rounded transition"
                              >
                                View
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
