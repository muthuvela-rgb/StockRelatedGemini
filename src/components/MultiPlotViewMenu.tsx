import React, { useState, useRef, useEffect } from "react";
import {
  Layers,
  ChevronDown,
  Check,
  CheckSquare,
  Square,
  Sparkles,
  Search,
  X,
  TrendingUp,
  BarChart2,
  Grid,
  Target,
  Sliders
} from "lucide-react";
import { PutOptionRecord } from "../types";

export const STOCK_COLORS = [
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // purple
  "#3b82f6", // blue
  "#f97316", // orange
  "#14b8a6", // teal
  "#e11d48", // rose
  "#84cc16", // lime
];

interface MultiPlotViewMenuProps {
  uniqueTickers: string[];
  selectedTickers: string[];
  onSelectTickers: (tickers: string[]) => void;
  plotLayout: "overlaid" | "grid";
  onSelectPlotLayout: (layout: "overlaid" | "grid") => void;
  records: PutOptionRecord[];
  isSingleStrike: boolean;
}

export const MultiPlotViewMenu: React.FC<MultiPlotViewMenuProps> = ({
  uniqueTickers,
  selectedTickers,
  onSelectTickers,
  plotLayout,
  onSelectPlotLayout,
  records,
  isSingleStrike,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const isAllSelected =
    selectedTickers.includes("ALL") ||
    (selectedTickers.length === uniqueTickers.length && uniqueTickers.length > 0);

  const filteredTickers = uniqueTickers.filter((t) =>
    t.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleTicker = (ticker: string) => {
    if (selectedTickers.includes("ALL")) {
      // Switch from ALL to all individual tickers except the toggled one (or just the selected one if user meant to isolate)
      const newSelection = uniqueTickers.filter((t) => t !== ticker);
      onSelectTickers(newSelection.length > 0 ? newSelection : [ticker]);
    } else {
      if (selectedTickers.includes(ticker)) {
        const next = selectedTickers.filter((t) => t !== ticker);
        if (next.length === 0) {
          onSelectTickers(["ALL"]);
        } else {
          onSelectTickers(next);
        }
      } else {
        const next = [...selectedTickers, ticker];
        if (next.length === uniqueTickers.length) {
          onSelectTickers(["ALL"]);
        } else {
          onSelectTickers(next);
        }
      }
    }
  };

  const handleSelectOnly = (ticker: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectTickers([ticker]);
  };

  const handleSelectAll = () => {
    onSelectTickers(["ALL"]);
  };

  const handleClearAll = () => {
    if (uniqueTickers.length > 0) {
      onSelectTickers([uniqueTickers[0]]);
    }
  };

  // Label for trigger button
  const getButtonLabel = () => {
    if (isAllSelected) {
      return `All Stocks (${uniqueTickers.length} plots)`;
    }
    if (selectedTickers.length === 1) {
      return `${selectedTickers[0]} (Single Plot)`;
    }
    return `${selectedTickers.length} Plots (${selectedTickers.slice(0, 3).join(", ")}${
      selectedTickers.length > 3 ? ` +${selectedTickers.length - 3}` : ""
    })`;
  };

  // Spot prices map for quick badge
  const tickerSpotMap: Record<string, { spot: number; count: number }> = {};
  records.forEach((r) => {
    if (!tickerSpotMap[r.ticker]) {
      tickerSpotMap[r.ticker] = { spot: r.current_price, count: 0 };
    }
    tickerSpotMap[r.ticker].count++;
  });

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <div className="flex items-center gap-1.5">
        <button
          id="view-plots-dropdown-btn"
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs font-semibold text-white shadow-sm transition cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400 font-normal">View:</span>
          <span className="text-cyan-300 font-bold max-w-[200px] truncate">{getButtonLabel()}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {/* Multi-plot Layout Toggle (Overlaid vs Grid) when 2+ tickers or ALL selected */}
        {(selectedTickers.length > 1 || isAllSelected) && uniqueTickers.length > 1 && (
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[11px]">
            <button
              onClick={() => onSelectPlotLayout("overlaid")}
              title="Overlay multiple plots on a single comparative chart"
              className={`px-2.5 py-1 rounded font-semibold transition cursor-pointer flex items-center gap-1 ${
                plotLayout === "overlaid"
                  ? "bg-cyan-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              <span>Overlaid</span>
            </button>
            <button
              onClick={() => onSelectPlotLayout("grid")}
              title="Display multiple plots side-by-side in a responsive grid"
              className={`px-2.5 py-1 rounded font-semibold transition cursor-pointer flex items-center gap-1 ${
                plotLayout === "grid"
                  ? "bg-cyan-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Grid className="w-3 h-3" />
              <span>Grid Cards</span>
            </button>
          </div>
        )}
      </div>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-slate-900/98 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl z-50 p-3 space-y-3 text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Select Plots to Display</span>
            </div>
            <span className="text-[11px] text-cyan-400 font-mono font-semibold">
              {isAllSelected ? uniqueTickers.length : selectedTickers.length} of {uniqueTickers.length} selected
            </span>
          </div>

          {/* Quick Preset Buttons */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => {
                handleSelectAll();
                onSelectPlotLayout("overlaid");
              }}
              className={`px-2.5 py-1.5 rounded-lg border text-left flex items-center gap-1.5 transition cursor-pointer ${
                isAllSelected && plotLayout === "overlaid"
                  ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold"
                  : "bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-750"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              <span className="truncate">All (Overlaid)</span>
            </button>

            <button
              onClick={() => {
                handleSelectAll();
                onSelectPlotLayout("grid");
              }}
              className={`px-2.5 py-1.5 rounded-lg border text-left flex items-center gap-1.5 transition cursor-pointer ${
                isAllSelected && plotLayout === "grid"
                  ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold"
                  : "bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-750"
              }`}
            >
              <Grid className="w-3.5 h-3.5 text-emerald-400" />
              <span className="truncate">All (Grid View)</span>
            </button>
          </div>

          {/* Search Bar if multiple tickers */}
          {uniqueTickers.length > 5 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search tickers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Multi-Select Ticker List */}
          <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {filteredTickers.map((t, idx) => {
              const isChecked = isAllSelected || selectedTickers.includes(t);
              const color = STOCK_COLORS[idx % STOCK_COLORS.length];
              const info = tickerSpotMap[t] || { spot: 0, count: 0 };

              return (
                <div
                  key={t}
                  onClick={() => handleToggleTicker(t)}
                  className={`flex items-center justify-between p-2 rounded-xl border transition cursor-pointer group ${
                    isChecked
                      ? "bg-slate-800/90 border-slate-700 text-white"
                      : "bg-slate-950/40 border-slate-800/60 text-slate-400 hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                        isChecked
                          ? "bg-cyan-500 border-cyan-500 text-slate-950"
                          : "border-slate-600 bg-slate-900 group-hover:border-slate-500"
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-bold text-xs tracking-wider">{t}</span>
                    </div>

                    <span className="text-[11px] text-slate-400 font-mono">
                      ${info.spot.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 font-mono">
                      {info.count} puts
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleSelectOnly(t, e)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 hover:bg-cyan-600 hover:text-white text-slate-300 transition opacity-0 group-hover:opacity-100"
                      title={`Isolate ${t} as single plot`}
                    >
                      Only
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-cyan-400 hover:underline cursor-pointer"
              >
                Select All
              </button>
              <span className="text-slate-600">•</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-slate-400 hover:underline cursor-pointer"
              >
                Isolate First
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
