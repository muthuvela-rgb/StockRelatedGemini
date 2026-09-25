import React from "react";
import { Sliders, RotateCcw, Sparkles } from "lucide-react";

export interface StrikeRangeSliderProps {
  range: [number, number]; // [minStrike, maxStrike]
  onChange: (range: [number, number]) => void;
  dataMinStrike: number;
  dataMaxStrike: number;
  currentPrice: number;
  tab?: "puts" | "calls" | "both";
  step?: number;
  label?: string;
  sublabel?: string;
  showPresets?: boolean;
  compact?: boolean;
  badgeCount?: { filtered: number; total: number };
  className?: string;
}

export const StrikeRangeSlider: React.FC<StrikeRangeSliderProps> = ({
  range,
  onChange,
  dataMinStrike,
  dataMaxStrike,
  currentPrice,
  tab = "puts",
  step,
  label = "Strike Price Range ($)",
  sublabel,
  showPresets = true,
  compact = false,
  badgeCount,
  className = "",
}) => {
  const minStrike = range[0];
  const maxStrike = range[1];
  const isFiltered = minStrike > dataMinStrike || maxStrike < dataMaxStrike;

  // Auto calculate step if not provided
  const dynamicStep = step ?? (dataMaxStrike - dataMinStrike > 250 ? 2.5 : dataMaxStrike - dataMinStrike > 100 ? 1 : 0.5);

  const pctFromSpotMin = currentPrice > 0 ? (((minStrike - currentPrice) / currentPrice) * 100).toFixed(1) : "0.0";
  const pctFromSpotMax = currentPrice > 0 ? (((maxStrike - currentPrice) / currentPrice) * 100).toFixed(1) : "0.0";

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (isNaN(val)) return;
    const clamped = Math.min(Math.max(val, dataMinStrike), maxStrike);
    onChange([Math.round(clamped * 10) / 10, maxStrike]);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (isNaN(val)) return;
    const clamped = Math.max(Math.min(val, dataMaxStrike), minStrike);
    onChange([minStrike, Math.round(clamped * 10) / 10]);
  };

  const handleReset = () => {
    onChange([dataMinStrike, dataMaxStrike]);
  };

  const applyPreset = (type: "10pct" | "20pct" | "30pct" | "50pct" | "otm" | "itm" | "full") => {
    if (type === "full") {
      onChange([dataMinStrike, dataMaxStrike]);
      return;
    }
    if (type === "10pct") {
      const min = Math.max(dataMinStrike, Math.round(currentPrice * 0.9 * 10) / 10);
      const max = Math.min(dataMaxStrike, Math.round(currentPrice * 1.1 * 10) / 10);
      onChange([min, max]);
      return;
    }
    if (type === "20pct") {
      const min = Math.max(dataMinStrike, Math.round(currentPrice * 0.8 * 10) / 10);
      const max = Math.min(dataMaxStrike, Math.round(currentPrice * 1.2 * 10) / 10);
      onChange([min, max]);
      return;
    }
    if (type === "30pct") {
      const min = Math.max(dataMinStrike, Math.round(currentPrice * 0.7 * 10) / 10);
      const max = Math.min(dataMaxStrike, Math.round(currentPrice * 1.3 * 10) / 10);
      onChange([min, max]);
      return;
    }
    if (type === "50pct") {
      const min = Math.max(dataMinStrike, Math.round(currentPrice * 0.5 * 10) / 10);
      const max = Math.min(dataMaxStrike, Math.round(currentPrice * 1.5 * 10) / 10);
      onChange([min, max]);
      return;
    }
    if (type === "otm") {
      if (tab === "puts") {
        onChange([dataMinStrike, Math.round(currentPrice * 10) / 10]);
      } else {
        onChange([Math.round(currentPrice * 10) / 10, dataMaxStrike]);
      }
      return;
    }
    if (type === "itm") {
      if (tab === "puts") {
        onChange([Math.round(currentPrice * 10) / 10, dataMaxStrike]);
      } else {
        onChange([dataMinStrike, Math.round(currentPrice * 10) / 10]);
      }
      return;
    }
  };

  const totalSpan = Math.max(1, dataMaxStrike - dataMinStrike);
  const leftPct = Math.max(0, Math.min(100, ((minStrike - dataMinStrike) / totalSpan) * 100));
  const widthPct = Math.max(0, Math.min(100, ((maxStrike - minStrike) / totalSpan) * 100));

  const resolvedSublabel =
    sublabel ?? `Contract strike price. Spot: $${currentPrice.toFixed(2)}.`;

  return (
    <div
      className={`bg-slate-950/70 border border-slate-800/90 rounded-xl flex flex-col justify-between ${
        compact ? "p-3 space-y-2" : "p-3.5 space-y-2.5"
      } ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sliders className="w-4 h-4 text-sky-400 shrink-0" />
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
                  ? "text-sky-300 bg-sky-950/60 border-sky-700/60"
                  : "text-slate-300 bg-slate-800/60 border-slate-700/60"
              }`}
            >
              ${minStrike.toFixed(1)} – ${maxStrike.toFixed(1)}
              <span className="text-[10px] text-slate-400 font-sans ml-1 hidden sm:inline">
                ({Number(pctFromSpotMin) > 0 ? `+${pctFromSpotMin}` : pctFromSpotMin}% to {Number(pctFromSpotMax) > 0 ? `+${pctFromSpotMax}` : pctFromSpotMax}%)
              </span>
            </span>
            {isFiltered && (
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] text-slate-400 hover:text-sky-300 cursor-pointer transition p-0.5"
                title="Reset Strike Range to full"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        {resolvedSublabel && <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{resolvedSublabel}</p>}
      </div>

      {/* Visual Range Track */}
      <div className="relative pt-1 pb-1">
        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden relative">
          <div
            className="absolute top-0 bottom-0 bg-gradient-to-r from-sky-500 via-cyan-400 to-blue-600 rounded-full transition-all duration-100"
            style={{
              left: `${leftPct}%`,
              width: `${widthPct}%`,
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
            min={dataMinStrike}
            max={dataMaxStrike}
            step={dynamicStep}
            value={minStrike}
            onChange={handleMinChange}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
            aria-label="Minimum Strike Price"
          />
          <span className="text-xs font-mono font-bold text-sky-300 w-12 text-right shrink-0">
            ${minStrike.toFixed(0)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">Max:</span>
          <input
            type="range"
            min={dataMinStrike}
            max={dataMaxStrike}
            step={dynamicStep}
            value={maxStrike}
            onChange={handleMaxChange}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
            aria-label="Maximum Strike Price"
          />
          <span className="text-xs font-mono font-bold text-sky-300 w-12 text-right shrink-0">
            ${maxStrike.toFixed(0)}
          </span>
        </div>
      </div>

      {/* Quick Presets */}
      {showPresets && (
        <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-800/60">
          <span className="text-[10px] text-slate-500 mr-1 flex items-center gap-0.5 shrink-0">
            <Sparkles className="w-2.5 h-2.5 text-sky-400" />
            Presets:
          </span>
          <button
            type="button"
            onClick={() => applyPreset("full")}
            className="px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
          >
            Full
          </button>
          <button
            type="button"
            onClick={() => applyPreset("10pct")}
            className="px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
          >
            ±10%
          </button>
          <button
            type="button"
            onClick={() => applyPreset("20pct")}
            className="px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
          >
            ±20%
          </button>
          <button
            type="button"
            onClick={() => applyPreset("30pct")}
            className="px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
          >
            ±30%
          </button>
          <button
            type="button"
            onClick={() => applyPreset("50pct")}
            className="px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
          >
            ±50%
          </button>
          <button
            type="button"
            onClick={() => applyPreset("otm")}
            className="px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 hover:bg-emerald-900/40"
          >
            OTM Only
          </button>
          <button
            type="button"
            onClick={() => applyPreset("itm")}
            className="px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer bg-rose-950/40 border border-rose-800/40 text-rose-300 hover:bg-rose-900/40"
          >
            ITM Only
          </button>
        </div>
      )}
    </div>
  );
};
