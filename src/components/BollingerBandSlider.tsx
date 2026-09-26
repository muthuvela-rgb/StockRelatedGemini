import React from "react";
import { Layers, RotateCcw, Sparkles } from "lucide-react";
import { useBollingerFilter } from "../context/BollingerFilterContext";

export interface BollingerBandSliderProps {
  range?: [number, number]; // [minPctB, maxPctB], e.g. [-20, 120] (%B percentage)
  onChange?: (range: [number, number]) => void;
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

export const BOLLINGER_PRESETS: { label: string; range: [number, number]; tip: string }[] = [
  {
    label: "All (%B -20%–120%)",
    range: [-20, 120],
    tip: "Full Bollinger Bands range without %B filtering",
  },
  {
    label: "Below Lower Band (≤ 0%)",
    range: [-20, 0],
    tip: "Extreme oversold dip pierced below 20d lower band — maximum margin of safety for put selling",
  },
  {
    label: "Near Lower Band (0%–25%)",
    range: [0, 25],
    tip: "Hugging lower Bollinger support band — high probability bounce zone",
  },
  {
    label: "Lower Half / Dip (0%–50%)",
    range: [0, 50],
    tip: "Below 20-day SMA middle band — favorable dip-buying entry",
  },
  {
    label: "Neutral / Mean Reversion (40%–60%)",
    range: [40, 60],
    tip: "Consolidating near 20-day SMA mean reversion baseline",
  },
  {
    label: "Upper Half (50%–100%)",
    range: [50, 100],
    tip: "Above 20-day SMA towards upper resistance envelope",
  },
  {
    label: "Above Upper Band (≥ 100%)",
    range: [100, 120],
    tip: "Overbought / momentum breakout riding above upper band",
  },
];

export const BollingerBandSlider: React.FC<BollingerBandSliderProps> = ({
  range: propRange,
  onChange: propOnChange,
  min = -20,
  max = 120,
  step = 1,
  label = "Bollinger Bands (%B) Range",
  sublabel = "Stock position within 20-day 2σ envelope. 0% = Lower Band, 50% = 20 SMA Middle, 100% = Upper Band. (< 0% = Pierced Lower Band / Oversold).",
  showPresets = true,
  compact = false,
  badgeCount,
  className = "",
}) => {
  const context = useBollingerFilter();
  const effectiveRange = propRange !== undefined ? propRange : context.bollingerRange;
  const effectiveOnChange = propOnChange !== undefined ? propOnChange : context.setBollingerRange;

  const currentMin = effectiveRange ? effectiveRange[0] : min;
  const currentMax = effectiveRange ? effectiveRange[1] : max;

  const isFiltered = currentMin > min || currentMax < max;

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val)) return;
    const clamped = Math.min(Math.max(val, min), max);
    if (clamped > currentMax) {
      effectiveOnChange([clamped, clamped]);
    } else {
      effectiveOnChange([clamped, currentMax]);
    }
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val)) return;
    const clamped = Math.max(Math.min(val, max), min);
    if (clamped < currentMin) {
      effectiveOnChange([clamped, clamped]);
    } else {
      effectiveOnChange([currentMin, clamped]);
    }
  };

  const handleReset = () => {
    if (propRange === undefined && propOnChange === undefined) {
      context.resetBollingerRange();
    } else {
      effectiveOnChange([min, max]);
    }
  };

  // Determine current active zone tag
  let zoneTag = "";
  let zoneColor = "text-cyan-400";
  if (currentMax <= 0) {
    zoneTag = "(Below Lower Band / Oversold)";
    zoneColor = "text-emerald-400 font-bold";
  } else if (currentMax <= 25) {
    zoneTag = "(Near Lower Band Support)";
    zoneColor = "text-teal-300 font-semibold";
  } else if (currentMax <= 50 && currentMin >= 0) {
    zoneTag = "(Lower Half / Dip)";
    zoneColor = "text-cyan-300";
  } else if (currentMin >= 40 && currentMax <= 60) {
    zoneTag = "(Near 20 SMA)";
    zoneColor = "text-sky-300";
  } else if (currentMin >= 50 && currentMax <= 100) {
    zoneTag = "(Upper Half)";
    zoneColor = "text-blue-300";
  } else if (currentMin >= 100) {
    zoneTag = "(Above Upper Band / Overbought)";
    zoneColor = "text-rose-400 font-semibold";
  }

  const minPctOnTrack = Math.max(0, Math.min(100, ((currentMin - min) / (max - min)) * 100));
  const maxPctOnTrack = Math.max(0, Math.min(100, ((currentMax - min) / (max - min)) * 100));
  const widthPctOnTrack = Math.max(0, maxPctOnTrack - minPctOnTrack);

  return (
    <div
      className={`bg-slate-950/70 border border-slate-800/90 rounded-xl flex flex-col justify-between ${
        compact ? "p-3.5 space-y-2.5" : "p-4 sm:p-4.5 space-y-3"
      } ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1 rounded bg-teal-500/15 text-teal-400">
              <Layers className="w-4 h-4 shrink-0" />
            </span>
            <span className="text-xs font-bold text-white uppercase tracking-wider truncate">
              {label}
            </span>
            {badgeCount && (
              <span className="text-[10px] text-slate-400 font-mono shrink-0">
                ({badgeCount.filtered}/{badgeCount.total})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-xs font-mono font-bold px-2.5 py-1 rounded-md border whitespace-nowrap ${
                isFiltered
                  ? "text-teal-300 bg-teal-950/60 border-teal-700/60"
                  : "text-slate-300 bg-slate-800/60 border-slate-700/60"
              }`}
            >
              %B {currentMin}% – {currentMax}%
              {zoneTag && (
                <span className={`text-[11px] font-sans ml-2 ${zoneColor}`}>
                  {zoneTag}
                </span>
              )}
            </span>
            {isFiltered && (
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-slate-400 hover:text-teal-300 cursor-pointer transition px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center gap-1 font-semibold"
                title="Reset Bollinger Bands filter to default (-20% to 120%)"
              >
                <RotateCcw className="w-3 h-3 text-teal-400" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
        {sublabel && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{sublabel}</p>}
      </div>

      {/* Visual Range Track with Bollinger Zone Indicators */}
      <div className="relative pt-1 pb-1">
        <div className="h-2.5 w-full bg-slate-800/90 rounded-full overflow-hidden relative shadow-inner">
          <div
            className="absolute top-0 bottom-0 bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400 rounded-full transition-all duration-100 shadow-sm"
            style={{
              left: `${minPctOnTrack}%`,
              width: `${widthPctOnTrack}%`,
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1.5 select-none px-0.5">
          <span className="text-emerald-400/90">&lt; 0% (Below Lower Band)</span>
          <span className="text-teal-300/90 hidden sm:inline">0% (Lower Band)</span>
          <span className="text-sky-300/90">50% (20 SMA)</span>
          <span className="text-blue-300/90 hidden sm:inline">100% (Upper Band)</span>
          <span className="text-rose-400/90">&gt; 100% (Above Upper)</span>
        </div>
      </div>

      {/* Dual Sliders with Full Drag Track & Number Inputs (Spacious Layout) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-center">
        {/* Min %B Slider */}
        <div className="flex items-center gap-3 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/90">
          <span className="text-xs font-semibold text-slate-300 w-16 shrink-0 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-sm shadow-emerald-400/50" />
            Min %B:
          </span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={currentMin}
            onChange={handleMinChange}
            className="flex-1 min-w-[100px] h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400 focus:outline-none"
            aria-label="Minimum Bollinger %B"
          />
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={currentMin}
              onChange={handleMinChange}
              aria-label="Minimum Bollinger %B Input"
              className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center font-mono text-xs font-bold text-teal-300 focus:border-teal-400 outline-none"
            />
            <span className="text-[11px] font-mono text-slate-400 font-medium whitespace-nowrap">
              %
            </span>
          </div>
        </div>

        {/* Max %B Slider */}
        <div className="flex items-center gap-3 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/90">
          <span className="text-xs font-semibold text-slate-300 w-16 shrink-0 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400 inline-block shadow-sm shadow-sky-400/50" />
            Max %B:
          </span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={currentMax}
            onChange={handleMaxChange}
            className="flex-1 min-w-[100px] h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400 focus:outline-none"
            aria-label="Maximum Bollinger %B"
          />
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={currentMax}
              onChange={handleMaxChange}
              aria-label="Maximum Bollinger %B Input"
              className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center font-mono text-xs font-bold text-teal-300 focus:border-teal-400 outline-none"
            />
            <span className="text-[11px] font-mono text-slate-400 font-medium whitespace-nowrap">
              %
            </span>
          </div>
        </div>
      </div>

      {/* Presets */}
      {showPresets && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/70">
          <span className="text-xs text-slate-400 font-semibold mr-1 flex items-center gap-1 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            Bollinger Presets:
          </span>
          {BOLLINGER_PRESETS.map((p, idx) => {
            const isActive = currentMin === p.range[0] && currentMax === p.range[1];
            return (
              <button
                type="button"
                key={idx}
                onClick={() => effectiveOnChange(p.range)}
                title={p.tip}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border ${
                  isActive
                    ? "bg-teal-500/25 text-teal-200 border-teal-500/60 font-bold shadow-sm shadow-teal-500/20"
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

export default BollingerBandSlider;
