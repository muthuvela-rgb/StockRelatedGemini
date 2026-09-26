import React from "react";
import {
  RotateCcw,
  Search,
  Filter,
} from "lucide-react";
import { MoneynessRangeSlider } from "./sliders/MoneynessRangeSlider";
import { CashReturnRangeSlider } from "./sliders/CashReturnRangeSlider";
import { OptionPremiumRangeSlider } from "./sliders/OptionPremiumRangeSlider";
import { RsiRangeSlider } from "./sliders/RsiRangeSlider";
import { DeltaRangeSlider } from "./DeltaRangeSlider";
import { BollingerBandSlider } from "./BollingerBandSlider";

export { MONEYNESS_PRESETS } from "./sliders/MoneynessRangeSlider";
export { CASH_RETURN_PRESETS } from "./sliders/CashReturnRangeSlider";
export { PREMIUM_PRESETS } from "./sliders/OptionPremiumRangeSlider";
export { RSI_PRESETS } from "./sliders/RsiRangeSlider";
export { DELTA_PRESETS } from "./DeltaRangeSlider";
export { BOLLINGER_PRESETS } from "./BollingerBandSlider";

export interface ScannerFilterDeckProps {
  // Moneyness Band Slider
  moneynessRange: [number, number]; // e.g. [20, 120]
  onMoneynessRangeChange: (range: [number, number]) => void;

  // Annualized Cash Return Slider
  cashReturnRange: [number, number]; // e.g. [0, 100]
  onCashReturnRangeChange: (range: [number, number]) => void;

  // Premium Slider
  premiumRange: [number, number]; // e.g. [0, 50]
  onPremiumRangeChange: (range: [number, number]) => void;

  // RSI (14) Momentum Slider
  rsiRange: [number, number]; // e.g. [0, 100]
  onRsiRangeChange: (range: [number, number]) => void;

  // Delta Greek Range
  deltaRange: [number, number]; // [0.0, 1.0]
  onDeltaRangeChange: (range: [number, number]) => void;

  // Bollinger Bands (%B) Range
  bollingerRange?: [number, number]; // [-20, 120]
  onBollingerRangeChange?: (range: [number, number]) => void;

  // Ticker search
  searchTicker: string;
  onSearchTickerChange: (ticker: string) => void;

  // Earnings filter
  excludeSpansEarnings?: boolean;
  onExcludeSpansEarningsChange?: (val: boolean) => void;

  // Reset
  onResetAll: () => void;

  // Stats
  totalScannedCount: number;
  filteredCount: number;
  avgCashYield?: number;
  maxCashYield?: number;
}

export const ScannerRangeFilterDeck: React.FC<ScannerFilterDeckProps> = ({
  moneynessRange,
  onMoneynessRangeChange,
  cashReturnRange,
  onCashReturnRangeChange,
  premiumRange,
  onPremiumRangeChange,
  rsiRange,
  onRsiRangeChange,
  deltaRange,
  onDeltaRangeChange,
  bollingerRange = [-20, 120],
  onBollingerRangeChange,
  searchTicker,
  onSearchTickerChange,
  excludeSpansEarnings = false,
  onExcludeSpansEarningsChange,
  onResetAll,
  totalScannedCount,
  filteredCount,
}) => {
  const isMoneynessFiltered = moneynessRange[0] > 20 || moneynessRange[1] < 120;
  const isCashReturnFiltered = cashReturnRange[0] > 0 || cashReturnRange[1] < 100;
  const isPremiumFiltered = premiumRange[0] > 0 || premiumRange[1] < 50;
  const isRsiFiltered = rsiRange[0] > 0 || rsiRange[1] < 100;
  const isDeltaFiltered = deltaRange[0] > 0.001 || deltaRange[1] < 0.999;
  const isBollingerFiltered = bollingerRange[0] > -20 || bollingerRange[1] < 120;
  const isSearchFiltered = searchTicker.trim().length > 0;

  const hasAnyActiveFilter =
    isMoneynessFiltered ||
    isCashReturnFiltered ||
    isPremiumFiltered ||
    isRsiFiltered ||
    isDeltaFiltered ||
    isBollingerFiltered ||
    isSearchFiltered ||
    excludeSpansEarnings;

  return (
    <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* Top Header & Ticker Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Interactive Scanned Data Filter Deck</span>
              {hasAnyActiveFilter ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  Filters Active
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-slate-800 text-slate-400">
                  Full Scan
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-400">
              Adjust sliders to dynamically filter scanned option contracts across all chart views and table results.
            </p>
          </div>
        </div>

        {/* Action & Stats Header */}
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          {/* Ticker Search Box */}
          <div className="relative min-w-[170px] sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search ticker..."
              value={searchTicker}
              onChange={(e) => onSearchTickerChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none uppercase font-mono"
            />
            {searchTicker && (
              <button
                type="button"
                onClick={() => onSearchTickerChange("")}
                className="absolute right-2 top-2 text-slate-500 hover:text-white text-xs cursor-pointer"
              >
                ×
              </button>
            )}
          </div>

          {/* Matches Counter Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">Showing:</span>
            <span
              className={`font-bold ${
                filteredCount === 0
                  ? "text-rose-400"
                  : filteredCount < totalScannedCount
                  ? "text-cyan-300"
                  : "text-emerald-400"
              }`}
            >
              {filteredCount}
            </span>
            <span className="text-slate-500">/ {totalScannedCount}</span>
            {totalScannedCount > 0 && (
              <span className="text-[10px] text-slate-500 ml-1">
                ({Math.round((filteredCount / totalScannedCount) * 100)}%)
              </span>
            )}
          </div>

          {/* Reset Button */}
          {hasAnyActiveFilter && (
            <button
              type="button"
              onClick={onResetAll}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition cursor-pointer shrink-0"
              title="Reset all filter sliders"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
              <span>Reset All</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid of 3 Sliders: Cash Return, Option Premium, and RSI (14) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {/* 1. Annualized Cash Return Slider */}
        <CashReturnRangeSlider
          range={cashReturnRange}
          onChange={onCashReturnRangeChange}
        />

        {/* 2. Option Premium Slider */}
        <OptionPremiumRangeSlider
          range={premiumRange}
          onChange={onPremiumRangeChange}
        />

        {/* 3. RSI (14) Momentum Slider */}
        <RsiRangeSlider
          range={rsiRange}
          onChange={onRsiRangeChange}
        />
      </div>

      {/* 4. Moneyness Band Slider (placed full-width above Delta slider) */}
      <div className="mt-3.5 w-full">
        <MoneynessRangeSlider
          range={moneynessRange}
          onChange={onMoneynessRangeChange}
        />
      </div>

      {/* 5. Delta Greek Range Slider - Moved to next line and made bigger so wide windows never squash it */}
      <div className="mt-3.5 w-full">
        <DeltaRangeSlider
          range={deltaRange}
          onChange={onDeltaRangeChange}
        />
      </div>

      {/* 6. Bollinger Bands (%B) Range Slider - On a separate line below delta slider */}
      <div className="mt-3.5 w-full">
        <BollingerBandSlider
          range={bollingerRange}
          onChange={onBollingerRangeChange}
        />
      </div>

      {/* 7. Corporate Earnings Date Filter */}
      {onExcludeSpansEarningsChange && (
        <div className="pt-3 border-t border-slate-800/60 mt-3.5 flex items-center justify-between">
          <div className="flex flex-col pr-4">
            <span className="text-xs font-bold text-slate-200">Avoid Binary Earnings Surprises</span>
            <span className="text-[10px] text-slate-400">Exclude option contracts whose expiration date spans or is after the next corporate earnings report</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
            <input
              type="checkbox"
              checked={excludeSpansEarnings}
              onChange={(e) => onExcludeSpansEarningsChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-500 after:border-slate-400 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white"></div>
          </label>
        </div>
      )}
    </div>
  );
};
