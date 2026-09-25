import React from "react";
import { DollarSign, Sparkles, RotateCcw } from "lucide-react";

export interface OptionPremiumRangeSliderProps {
  range: [number, number]; // [minPremium, maxPremium], e.g. [0, 50]
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

export const PREMIUM_PRESETS: { label: string; range: [number, number]; tip: string }[] = [
  { label: "All ($0+)", range: [0, 50], tip: "All contracts regardless of bid price" },
  { label: "≥ $0.50", range: [0.5, 50], tip: "Filter out sub-50-cent low premium contracts" },
  { label: "≥ $1.00", range: [1.0, 50], tip: "Standard retail options ticket (at least $100 per contract)" },
  { label: "≥ $2.50", range: [2.5, 50], tip: "Solid cash inflow (at least $250 per contract)" },
  { label: "≥ $5.00", range: [5.0, 50], tip: "Substantial premium income (at least $500 per contract)" },
  { label: "≥ $10.00", range: [10.0, 50], tip: "Heavyweight premium strikes (at least $1,000 per contract)" },
];

export const OptionPremiumRangeSlider: React.FC<OptionPremiumRangeSliderProps> = ({
  range,
  onChange,
  min = 0,
  max = 50,
  step = 0.25,
  label = "Option Premium ($)",
  sublabel = "Option bid price / contract premium per share ($100 per 1.00).",
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
            <DollarSign className="w-4 h-4 text-amber-400 shrink-0" />
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
                  ? "text-amber-300 bg-amber-950/60 border-amber-700/60"
                  : "text-slate-300 bg-slate-800/60 border-slate-700/60"
              }`}
            >
              ${range[0].toFixed(2)} – {range[1] >= max ? "$50.00+" : `$${range[1].toFixed(2)}`}
            </span>
            {isFiltered && (
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] text-slate-400 hover:text-amber-300 cursor-pointer transition p-0.5"
                title="Reset Option Premium to default"
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
            className="absolute top-0 bottom-0 bg-gradient-to-r from-amber-500 via-orange-400 to-rose-400 rounded-full transition-all duration-100"
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
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            aria-label="Minimum Option Premium"
          />
          <span className="text-xs font-mono font-bold text-amber-300 w-12 text-right shrink-0">
            ${range[0].toFixed(2)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">Max:</span>
          <input
            type="range"
            min={min}
            max={max}
            step={max - min > 30 ? 0.5 : step}
            value={range[1]}
            onChange={handleMaxChange}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            aria-label="Maximum Option Premium"
          />
          <span className="text-xs font-mono font-bold text-amber-300 w-14 text-right shrink-0">
            {range[1] >= max ? "$50.00+" : `$${range[1].toFixed(2)}`}
          </span>
        </div>
      </div>

      {/* Presets */}
      {showPresets && (
        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          <span className="text-[10px] text-slate-500 mr-1 flex items-center gap-0.5 shrink-0">
            <Sparkles className="w-2.5 h-2.5 text-amber-400" />
            Presets:
          </span>
          {PREMIUM_PRESETS.map((p, idx) => {
            const isActive =
              Math.abs(range[0] - p.range[0]) < 0.01 && Math.abs(range[1] - p.range[1]) < 0.01;
            return (
              <button
                type="button"
                key={idx}
                onClick={() => onChange(p.range)}
                title={p.tip}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition cursor-pointer border ${
                  isActive
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold shadow-sm shadow-amber-500/10"
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
