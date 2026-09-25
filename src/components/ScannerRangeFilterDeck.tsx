import React from "react";
import {
  RotateCcw,
  Target,
  TrendingUp,
  DollarSign,
  Activity,
  Search,
  Sparkles,
  Filter,
} from "lucide-react";

export interface ScannerFilterDeckProps {
  // Moneyness Band Slider
  moneynessRange: [number, number]; // e.g. [30, 110]
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

  // Ticker search
  searchTicker: string;
  onSearchTickerChange: (ticker: string) => void;

  // Reset
  onResetAll: () => void;

  // Stats
  totalScannedCount: number;
  filteredCount: number;
  avgCashYield?: number;
  maxCashYield?: number;
}

export const MONEYNESS_PRESETS: { label: string; range: [number, number]; tip: string }[] = [
  { label: "All (20–120%)", range: [20, 120], tip: "All strikes from deep out-of-the-money to in-the-money" },
  { label: "Deep OTM (40–75%)", range: [40, 75], tip: "Ultra-conservative strikes with high margin of safety (25–60% cushion)" },
  { label: "Safe OTM (70–90%)", range: [70, 90], tip: "Institutional sweet spot for put selling (10–30% downside buffer)" },
  { label: "Near ATM (85–98%)", range: [85, 98], tip: "Moderate risk with elevated extrinsic theta yield (2–15% cushion)" },
  { label: "At/ITM (98–110%)", range: [98, 110], tip: "At-the-money or slightly in-the-money puts for aggressive cash yield" },
];

export const CASH_RETURN_PRESETS: { label: string; range: [number, number]; tip: string }[] = [
  { label: "All (≥ 0%)", range: [0, 100], tip: "No yield restriction" },
  { label: "≥ 10% / yr", range: [10, 100], tip: "Base market-beating cash return (≥ 10% annualized)" },
  { label: "≥ 15% / yr", range: [15, 100], tip: "Target growth yield (≥ 15% annualized)" },
  { label: "≥ 20% / yr", range: [20, 100], tip: "High yield income (≥ 20% annualized)" },
  { label: "≥ 30% / yr", range: [30, 100], tip: "Aggressive cash yield (≥ 30% annualized)" },
  { label: "≥ 50% High Yield", range: [50, 100], tip: "Ultra-high yield puts on elevated volatility equities" },
];

export const PREMIUM_PRESETS: { label: string; range: [number, number]; tip: string }[] = [
  { label: "All ($0+)", range: [0, 50], tip: "All contracts regardless of bid price" },
  { label: "≥ $0.50", range: [0.5, 50], tip: "Filter out sub-50-cent low premium contracts" },
  { label: "≥ $1.00", range: [1.0, 50], tip: "Standard retail options ticket (at least $100 per contract)" },
  { label: "≥ $2.50", range: [2.5, 50], tip: "Solid cash inflow (at least $250 per contract)" },
  { label: "≥ $5.00", range: [5.0, 50], tip: "Substantial premium income (at least $500 per contract)" },
  { label: "≥ $10.00", range: [10.0, 50], tip: "Heavyweight premium strikes (at least $1,000 per contract)" },
];

export const RSI_PRESETS: { label: string; range: [number, number]; tip: string }[] = [
  { label: "All (0–100)", range: [0, 100], tip: "Full RSI range, no momentum restrictions" },
  { label: "Oversold ≤ 30", range: [0, 30], tip: "Deep oversold territory — ideal for dip buyers & high-margin put selling" },
  { label: "Pullback ≤ 40", range: [0, 40], tip: "Soft pullbacks to oversold dips (RSI ≤ 40)" },
  { label: "Rebound (30–50)", range: [30, 50], tip: "Recovering from oversold, high reward-to-risk bounce window" },
  { label: "Neutral (40–60)", range: [40, 60], tip: "Balanced trend momentum without extreme RSI readings" },
  { label: "Overbought ≥ 70", range: [70, 100], tip: "Stretched / extended momentum (RSI ≥ 70)" },
];

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
  searchTicker,
  onSearchTickerChange,
  onResetAll,
  totalScannedCount,
  filteredCount,
}) => {
  const isMoneynessFiltered = moneynessRange[0] > 20 || moneynessRange[1] < 120;
  const isCashReturnFiltered = cashReturnRange[0] > 0 || cashReturnRange[1] < 100;
  const isPremiumFiltered = premiumRange[0] > 0 || premiumRange[1] < 50;
  const isRsiFiltered = rsiRange[0] > 0 || rsiRange[1] < 100;
  const isDeltaFiltered = deltaRange[0] > 0.001 || deltaRange[1] < 0.999;
  const isSearchFiltered = searchTicker.trim().length > 0;

  const hasAnyActiveFilter =
    isMoneynessFiltered ||
    isCashReturnFiltered ||
    isPremiumFiltered ||
    isRsiFiltered ||
    isDeltaFiltered ||
    isSearchFiltered;

  // Handlers for Moneyness
  const handleMinMoneyness = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const clamped = Math.min(Math.max(val, 10), moneynessRange[1]);
    onMoneynessRangeChange([clamped, moneynessRange[1]]);
  };

  const handleMaxMoneyness = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const clamped = Math.max(Math.min(val, 130), moneynessRange[0]);
    onMoneynessRangeChange([moneynessRange[0], clamped]);
  };

  // Handlers for Cash Return
  const handleMinCashReturn = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const clamped = Math.min(Math.max(val, 0), cashReturnRange[1]);
    onCashReturnRangeChange([clamped, cashReturnRange[1]]);
  };

  const handleMaxCashReturn = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const clamped = Math.max(Math.min(val, 100), cashReturnRange[0]);
    onCashReturnRangeChange([cashReturnRange[0], clamped]);
  };

  // Handlers for Premium
  const handleMinPremium = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const clamped = Math.min(Math.max(val, 0), premiumRange[1]);
    onPremiumRangeChange([clamped, premiumRange[1]]);
  };

  const handleMaxPremium = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const clamped = Math.max(Math.min(val, 50), premiumRange[0]);
    onPremiumRangeChange([premiumRange[0], clamped]);
  };

  // Handlers for RSI
  const handleMinRsi = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    const clamped = Math.min(Math.max(val, 0), rsiRange[1]);
    onRsiRangeChange([clamped, rsiRange[1]]);
  };

  const handleMaxRsi = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    const clamped = Math.max(Math.min(val, 100), rsiRange[0]);
    onRsiRangeChange([rsiRange[0], clamped]);
  };

  // Handlers for Delta
  const handleMinDelta = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const clamped = Math.min(Math.max(val, 0), deltaRange[1]);
    onDeltaRangeChange([Math.round(clamped * 100) / 100, deltaRange[1]]);
  };

  const handleMaxDelta = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const clamped = Math.max(Math.min(val, 1), deltaRange[0]);
    onDeltaRangeChange([deltaRange[0], Math.round(clamped * 100) / 100]);
  };

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

      {/* Grid of Sliders: Moneyness Band, Cash Return, Option Premium, and RSI (14) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* SLIDER 1: MONEYNESS BAND SLIDER */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3.5 flex flex-col justify-between space-y-2.5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Target className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Moneyness Band</span>
              </div>
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border ${
                  isMoneynessFiltered
                    ? "text-cyan-300 bg-cyan-950/60 border-cyan-700/60"
                    : "text-slate-300 bg-slate-800/60 border-slate-700/60"
                }`}
              >
                {moneynessRange[0]}% – {moneynessRange[1]}%
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Strike as % of spot price. Under 100% = Out-of-the-money (OTM).
            </p>
          </div>

          {/* Visual Track */}
          <div className="relative pt-1 pb-1">
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden relative">
              <div
                className="absolute top-0 bottom-0 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 rounded-full transition-all duration-100"
                style={{
                  left: `${Math.max(0, Math.min(100, ((moneynessRange[0] - 20) / (120 - 20)) * 100))}%`,
                  width: `${Math.max(
                    0,
                    Math.min(100, ((moneynessRange[1] - moneynessRange[0]) / (120 - 20)) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* Dual Sliders */}
          <div className="grid grid-cols-2 gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400 shrink-0">Min:</span>
              <input
                type="range"
                min={20}
                max={120}
                step={1}
                value={moneynessRange[0]}
                onChange={handleMinMoneyness}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                aria-label="Minimum Moneyness Percent"
              />
              <span className="text-xs font-mono font-bold text-cyan-300 w-9 text-right">
                {moneynessRange[0]}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400 shrink-0">Max:</span>
              <input
                type="range"
                min={20}
                max={120}
                step={1}
                value={moneynessRange[1]}
                onChange={handleMaxMoneyness}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                aria-label="Maximum Moneyness Percent"
              />
              <span className="text-xs font-mono font-bold text-cyan-300 w-9 text-right">
                {moneynessRange[1]}%
              </span>
            </div>
          </div>

          {/* Presets */}
          <div className="flex flex-wrap items-center gap-1 pt-1">
            <span className="text-[10px] text-slate-500 mr-1 flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
              Presets:
            </span>
            {MONEYNESS_PRESETS.map((p, idx) => {
              const isActive =
                moneynessRange[0] === p.range[0] && moneynessRange[1] === p.range[1];
              return (
                <button
                  key={idx}
                  onClick={() => onMoneynessRangeChange(p.range)}
                  title={p.tip}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition cursor-pointer border ${
                    isActive
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold"
                      : "bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800 hover:text-slate-200"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* SLIDER 2: ANNUALIZED CASH RETURN SLIDER */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3.5 flex flex-col justify-between space-y-2.5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Annualized Cash Return
                </span>
              </div>
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border ${
                  isCashReturnFiltered
                    ? "text-emerald-300 bg-emerald-950/60 border-emerald-700/60"
                    : "text-slate-300 bg-slate-800/60 border-slate-700/60"
                }`}
              >
                {cashReturnRange[0]}% – {cashReturnRange[1] >= 100 ? "100%+" : `${cashReturnRange[1]}%`} / yr
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Cash-secured yield = (Bid / Strike) × (365 / DTE).
            </p>
          </div>

          {/* Visual Track */}
          <div className="relative pt-1 pb-1">
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden relative">
              <div
                className="absolute top-0 bottom-0 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 rounded-full transition-all duration-100"
                style={{
                  left: `${Math.max(0, Math.min(100, (cashReturnRange[0] / 100) * 100))}%`,
                  width: `${Math.max(
                    0,
                    Math.min(100, ((cashReturnRange[1] - cashReturnRange[0]) / 100) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* Dual Sliders */}
          <div className="grid grid-cols-2 gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400 shrink-0">Min:</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={cashReturnRange[0]}
                onChange={handleMinCashReturn}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                aria-label="Minimum Annualized Cash Return"
              />
              <span className="text-xs font-mono font-bold text-emerald-400 w-9 text-right">
                {cashReturnRange[0]}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400 shrink-0">Max:</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={cashReturnRange[1]}
                onChange={handleMaxCashReturn}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                aria-label="Maximum Annualized Cash Return"
              />
              <span className="text-xs font-mono font-bold text-emerald-400 w-11 text-right">
                {cashReturnRange[1] >= 100 ? "100%+" : `${cashReturnRange[1]}%`}
              </span>
            </div>
          </div>

          {/* Presets */}
          <div className="flex flex-wrap items-center gap-1 pt-1">
            <span className="text-[10px] text-slate-500 mr-1 flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
              Presets:
            </span>
            {CASH_RETURN_PRESETS.map((p, idx) => {
              const isActive =
                cashReturnRange[0] === p.range[0] && cashReturnRange[1] === p.range[1];
              return (
                <button
                  key={idx}
                  onClick={() => onCashReturnRangeChange(p.range)}
                  title={p.tip}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition cursor-pointer border ${
                    isActive
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold"
                      : "bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800 hover:text-slate-200"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* SLIDER 3: PREMIUM SLIDER */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3.5 flex flex-col justify-between space-y-2.5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Option Premium ($)</span>
              </div>
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border ${
                  isPremiumFiltered
                    ? "text-amber-300 bg-amber-950/60 border-amber-700/60"
                    : "text-slate-300 bg-slate-800/60 border-slate-700/60"
                }`}
              >
                ${premiumRange[0].toFixed(2)} – {premiumRange[1] >= 50 ? "$50.00+" : `$${premiumRange[1].toFixed(2)}`}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Option bid price / contract premium per share ($100 per 1.00).
            </p>
          </div>

          {/* Visual Track */}
          <div className="relative pt-1 pb-1">
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden relative">
              <div
                className="absolute top-0 bottom-0 bg-gradient-to-r from-amber-500 via-orange-400 to-rose-400 rounded-full transition-all duration-100"
                style={{
                  left: `${Math.max(0, Math.min(100, (premiumRange[0] / 50) * 100))}%`,
                  width: `${Math.max(0, Math.min(100, ((premiumRange[1] - premiumRange[0]) / 50) * 100))}%`,
                }}
              />
            </div>
          </div>

          {/* Dual Sliders */}
          <div className="grid grid-cols-2 gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400 shrink-0">Min:</span>
              <input
                type="range"
                min={0}
                max={50}
                step={0.25}
                value={premiumRange[0]}
                onChange={handleMinPremium}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                aria-label="Minimum Option Premium"
              />
              <span className="text-xs font-mono font-bold text-amber-300 w-12 text-right">
                ${premiumRange[0].toFixed(2)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400 shrink-0">Max:</span>
              <input
                type="range"
                min={0}
                max={50}
                step={0.5}
                value={premiumRange[1]}
                onChange={handleMaxPremium}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                aria-label="Maximum Option Premium"
              />
              <span className="text-xs font-mono font-bold text-amber-300 w-14 text-right">
                {premiumRange[1] >= 50 ? "$50.00+" : `$${premiumRange[1].toFixed(2)}`}
              </span>
            </div>
          </div>

          {/* Presets */}
          <div className="flex flex-wrap items-center gap-1 pt-1">
            <span className="text-[10px] text-slate-500 mr-1 flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5 text-amber-400" />
              Presets:
            </span>
            {PREMIUM_PRESETS.map((p, idx) => {
              const isActive =
                Math.abs(premiumRange[0] - p.range[0]) < 0.01 &&
                Math.abs(premiumRange[1] - p.range[1]) < 0.01;
              return (
                <button
                  key={idx}
                  onClick={() => onPremiumRangeChange(p.range)}
                  title={p.tip}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition cursor-pointer border ${
                    isActive
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold"
                      : "bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800 hover:text-slate-200"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* SLIDER 4: RSI (14) MOMENTUM SLIDER */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3.5 flex flex-col justify-between space-y-2.5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-violet-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">RSI (14) Momentum</span>
              </div>
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border ${
                  isRsiFiltered
                    ? "text-violet-300 bg-violet-950/60 border-violet-700/60"
                    : "text-slate-300 bg-slate-800/60 border-slate-700/60"
                }`}
              >
                {rsiRange[0]} – {rsiRange[1]}
                {rsiRange[1] <= 30 && <span className="text-[10px] text-emerald-400 font-sans ml-1">(Oversold)</span>}
                {rsiRange[0] >= 70 && <span className="text-[10px] text-rose-400 font-sans ml-1">(Overbought)</span>}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              14-day technical RSI momentum oscillator (0–100 range).
            </p>
          </div>

          {/* Visual Track */}
          <div className="relative pt-1 pb-1">
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden relative">
              <div
                className="absolute top-0 bottom-0 bg-gradient-to-r from-violet-500 via-purple-400 to-fuchsia-400 rounded-full transition-all duration-100"
                style={{
                  left: `${Math.max(0, Math.min(100, (rsiRange[0] / 100) * 100))}%`,
                  width: `${Math.max(0, Math.min(100, ((rsiRange[1] - rsiRange[0]) / 100) * 100))}%`,
                }}
              />
            </div>
          </div>

          {/* Dual Sliders */}
          <div className="grid grid-cols-2 gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400 shrink-0">Min:</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={rsiRange[0]}
                onChange={handleMinRsi}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-400"
                aria-label="Minimum RSI(14)"
              />
              <span className="text-xs font-mono font-bold text-violet-300 w-8 text-right">
                {rsiRange[0]}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400 shrink-0">Max:</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={rsiRange[1]}
                onChange={handleMaxRsi}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-400"
                aria-label="Maximum RSI(14)"
              />
              <span className="text-xs font-mono font-bold text-violet-300 w-8 text-right">
                {rsiRange[1]}
              </span>
            </div>
          </div>

          {/* Presets */}
          <div className="flex flex-wrap items-center gap-1 pt-1">
            <span className="text-[10px] text-slate-500 mr-1 flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5 text-violet-400" />
              Presets:
            </span>
            {RSI_PRESETS.map((p, idx) => {
              const isActive =
                rsiRange[0] === p.range[0] && rsiRange[1] === p.range[1];
              return (
                <button
                  key={idx}
                  onClick={() => onRsiRangeChange(p.range)}
                  title={p.tip}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition cursor-pointer border ${
                    isActive
                      ? "bg-violet-500/20 text-violet-300 border-violet-500/40 font-bold"
                      : "bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800 hover:text-slate-200"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Delta Greek Sub-bar */}
      <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Delta Greek (|Δ|) Filter:</span>
          <span
            className={`font-mono px-2 py-0.5 rounded border text-[11px] ${
              isDeltaFiltered
                ? "text-purple-300 bg-purple-950/60 border-purple-800/60 font-bold"
                : "text-slate-400 bg-slate-900 border-slate-800"
            }`}
          >
            |Δ| {deltaRange[0].toFixed(2)} – {deltaRange[1].toFixed(2)}
          </span>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            (~{Math.round((1 - deltaRange[1]) * 100)}% – {Math.round((1 - deltaRange[0]) * 100)}% POP)
          </span>
        </div>

        <div className="flex items-center gap-3 flex-1 max-w-lg">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[10px] text-slate-500">0.0</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={deltaRange[0]}
              onChange={handleMinDelta}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
              aria-label="Min Delta Greek"
            />
            <span className="text-purple-300 font-mono text-[11px] w-8">{deltaRange[0].toFixed(2)}</span>
          </div>

          <div className="flex items-center gap-2 flex-1">
            <span className="text-[10px] text-slate-500">Max</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={deltaRange[1]}
              onChange={handleMaxDelta}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
              aria-label="Max Delta Greek"
            />
            <span className="text-purple-300 font-mono text-[11px] w-8">{deltaRange[1].toFixed(2)}</span>
          </div>

          {isDeltaFiltered && (
            <button
              onClick={() => onDeltaRangeChange([0.0, 1.0])}
              className="text-[10px] text-purple-400 hover:text-purple-300 cursor-pointer underline shrink-0"
            >
              Reset Δ
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
