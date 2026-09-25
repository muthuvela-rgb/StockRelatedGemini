import React from "react";
import { TrendingUp, Sparkles, RotateCcw } from "lucide-react";

export interface CashReturnRangeSliderProps {
  range: [number, number]; // [minCashReturn, maxCashReturn], e.g. [0, 100]
  onChange: (range: [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  sublabel?: string;
  showPresets?: boolean;
  compact?: boolean;
  badgeCount?: { filtered: number; total: number };
  className?: string;
}

export const CASH_RETURN_PRESETS: { label: string; range: [number, number]; tip: string }[] = [
  { label: "All (≥ 0%)", range: [0, 100], tip: "No yield restriction" },
  { label: "≥ 10% / yr", range: [10, 100], tip: "Base market-beating cash return (≥ 10% annualized)" },
  { label: "≥ 15% / yr", range: [15, 100], tip: "Target growth yield (≥ 15% annualized)" },
  { label: "≥ 20% / yr", range: [20, 100], tip: "High yield income (≥ 20% annualized)" },
  { label: "≥ 30% / yr", range: [30, 100], tip: "Aggressive cash yield (≥ 30% annualized)" },
  { label: "≥ 50% High Yield", range: [50, 100], tip: "Ultra-high yield puts on elevated volatility equities" },
];

export const CashReturnRangeSlider: React.FC<CashReturnRangeSliderProps> = ({
  range,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label = "Annualized Cash Return",
  sublabel = "Cash-secured yield = (Bid / Strike) × (365 / DTE).",
  showPresets = true,
  compact = false,
  badgeCount,
  className = "",
}) => {
  const isFiltered = range[0] > min || range[1] < max;

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const clamped = Math.min(Math.max(val, min), range[1]);
    onChange([clamped, range[1]]);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const clamped = Math.max(Math.min(val, max), range[0]);
    onChange([range[0], clamped]);
  };

  const handleReset = () => {
    onChange([min, max]);
  };

  return (
    <div
      className={`bg-slate-950/70 border border-slate-800/90 rounded-xl flex flex-col justify-between ${
        compact ? "p-3 space-y-2" : "p-3.5 space-y-2.5"
      } ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-bold text-white uppercase tracking-wider truncate">{label}</span>
            {badgeCount && (
              <span className="text-[10px] text-slate-400 font-mono shrink-0">
                ({badgeCount.filtered}/{badgeCount.total})
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${
                isFiltered
                  ? "text-emerald-300 bg-emerald-950/60 border-emerald-700/60"
                  : "text-slate-300 bg-slate-800/60 border-slate-700/60"
              }`}
            >
              {range[0]}% – {range[1] >= max ? "100%+" : `${range[1]}%`} / yr
            </span>
            {isFiltered && (
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] text-slate-400 hover:text-emerald-300 cursor-pointer transition p-0.5"
                title="Reset Cash Return to default"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        {sublabel && <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{sublabel}</p>}
      </div>

      {/* Visual Range Track */}
      <div className="relative pt-1 pb-1">
        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden relative">
          <div
            className="absolute top-0 bottom-0 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 rounded-full transition-all duration-100"
            style={{
              left: `${Math.max(0, Math.min(100, ((range[0] - min) / (max - min)) * 100))}%`,
              width: `${Math.max(0, Math.min(100, ((range[1] - range[0]) / (max - min)) * 100))}%`,
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
            min={min}
            max={max}
            step={step}
            value={range[0]}
            onChange={handleMinChange}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            aria-label="Minimum Annualized Cash Return"
          />
          <span className="text-xs font-mono font-bold text-emerald-400 w-9 text-right shrink-0">
            {range[0]}%
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">Max:</span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={range[1]}
            onChange={handleMaxChange}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            aria-label="Maximum Annualized Cash Return"
          />
          <span className="text-xs font-mono font-bold text-emerald-400 w-11 text-right shrink-0">
            {range[1] >= max ? "100%+" : `${range[1]}%`}
          </span>
        </div>
      </div>

      {/* Presets */}
      {showPresets && (
        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          <span className="text-[10px] text-slate-500 mr-1 flex items-center gap-0.5 shrink-0">
            <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
            Presets:
          </span>
          {CASH_RETURN_PRESETS.map((p, idx) => {
            const isActive = range[0] === p.range[0] && range[1] === p.range[1];
            return (
              <button
                type="button"
                key={idx}
                onClick={() => onChange(p.range)}
                title={p.tip}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition cursor-pointer border ${
                  isActive
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold shadow-sm shadow-emerald-500/10"
                    : "bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800 hover:text-slate-200"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
