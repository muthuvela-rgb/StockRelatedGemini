import React from "react";
import { Sliders, RotateCcw, Sparkles } from "lucide-react";

export interface DeltaRangeSliderProps {
  minDelta?: number; // 0.00 to 1.00
  maxDelta?: number; // 0.00 to 1.00
  range?: [number, number]; // [minDelta, maxDelta]
  onChange: (range: [number, number]) => void;
  label?: string;
  sublabel?: string;
  step?: number;
  showPresets?: boolean;
  compact?: boolean;
  badgeCount?: { filtered: number; total: number };
  className?: string;
}

export const DELTA_PRESETS: { label: string; range: [number, number]; tip: string }[] = [
  { label: "All (|Δ| 0.00–1.00)", range: [0.0, 1.0], tip: "Full option chain without delta filtering" },
  { label: "Ultra-Safe (< 0.10)", range: [0.01, 0.10], tip: "Far OTM, minimum assignment risk (>90% POP)" },
  { label: "Conservative (0.05–0.15)", range: [0.05, 0.15], tip: "Deep OTM, high probability of profit (~85–95% POP)" },
  { label: "Sweet Spot (0.15–0.30)", range: [0.15, 0.3], tip: "Standard institutional put selling target (~70–85% POP)" },
  { label: "Moderate (0.30–0.50)", range: [0.3, 0.5], tip: "Higher premium yield with moderate assignment risk (~50–70% POP)" },
  { label: "Near ATM (0.45–0.55)", range: [0.45, 0.55], tip: "At-the-money options with maximum extrinsic theta decay" },
];

export const DeltaRangeSlider: React.FC<DeltaRangeSliderProps> = ({
  minDelta,
  maxDelta,
  range,
  onChange,
  label = "Delta Greek (|Δ|) Range",
  sublabel = "Option absolute delta. Approximation of assignment probability (POP ≈ 1 - |Δ|).",
  step = 0.01,
  showPresets = true,
  compact = false,
  badgeCount,
  className = "",
}) => {
  const currentMin = range ? range[0] : (minDelta ?? 0.0);
  const currentMax = range ? range[1] : (maxDelta ?? 1.0);

  const isFiltered = currentMin > 0.001 || currentMax < 0.999;

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (isNaN(val)) return;
    const rounded = Math.round(Math.max(0, Math.min(1, val)) * 100) / 100;
    if (rounded > currentMax) {
      onChange([rounded, Math.min(1.0, rounded)]);
    } else {
      onChange([rounded, currentMax]);
    }
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (isNaN(val)) return;
    const rounded = Math.round(Math.max(0, Math.min(1, val)) * 100) / 100;
    if (rounded < currentMin) {
      onChange([Math.max(0, rounded), rounded]);
    } else {
      onChange([currentMin, rounded]);
    }
  };

  const handleReset = () => {
    onChange([0.0, 1.0]);
  };

  // Approximate POP based on Delta (for OTM options: POP ≈ 1 - |Δ|)
  const popMin = Math.round((1 - currentMax) * 100);
  const popMax = Math.round((1 - currentMin) * 100);

  return (
    <div
      className={`bg-slate-950/70 border border-slate-800/90 rounded-xl flex flex-col justify-between ${
        compact ? "p-3.5 space-y-2.5" : "p-4 sm:p-4.5 space-y-3"
      } ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1 rounded bg-purple-500/15 text-purple-400">
              <Sliders className="w-4 h-4 shrink-0" />
            </span>
            <span className="text-xs font-bold text-white uppercase tracking-wider truncate">{label}</span>
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
                  ? "text-purple-300 bg-purple-950/60 border-purple-700/60"
                  : "text-slate-300 bg-slate-800/60 border-slate-700/60"
              }`}
            >
              |Δ| {currentMin.toFixed(2)} – {currentMax.toFixed(2)}
              <span className="text-[11px] text-emerald-400 font-sans ml-2 font-semibold">
                (~{popMin}%–{popMax}% POP)
              </span>
            </span>
            {isFiltered && (
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-slate-400 hover:text-purple-300 cursor-pointer transition px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center gap-1 font-semibold"
                title="Reset Delta to default (|Δ| 0.00–1.00)"
              >
                <RotateCcw className="w-3 h-3 text-purple-400" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
        {sublabel && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{sublabel}</p>}
      </div>

      {/* Visual Range Track with Zone Indicators */}
      <div className="relative pt-1 pb-1">
        <div className="h-2.5 w-full bg-slate-800/90 rounded-full overflow-hidden relative shadow-inner">
          <div
            className="absolute top-0 bottom-0 bg-gradient-to-r from-purple-500 via-fuchsia-400 to-rose-400 rounded-full transition-all duration-100 shadow-sm"
            style={{
              left: `${Math.max(0, Math.min(100, currentMin * 100))}%`,
              width: `${Math.max(0, Math.min(100, (currentMax - currentMin) * 100))}%`,
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1.5 select-none px-0.5">
          <span className="text-emerald-400/90">0.00 (Far OTM, &gt;90% POP)</span>
          <span className="text-purple-300/90 hidden sm:inline">0.15 (Sweet Spot)</span>
          <span className="text-slate-400 hidden md:inline">0.30</span>
          <span className="text-amber-300/90">0.50 (ATM)</span>
          <span className="text-slate-400 hidden md:inline">0.70</span>
          <span className="text-rose-400/90">1.00 (Deep ITM)</span>
        </div>
      </div>

      {/* Dual Sliders with Full Drag Track & Number Inputs (Spacious Layout) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-center">
        {/* Min Delta Slider */}
        <div className="flex items-center gap-3 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/90">
          <span className="text-xs font-semibold text-slate-300 w-16 shrink-0 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400 inline-block shadow-sm shadow-purple-400/50" />
            Min |Δ|:
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={step}
            value={currentMin}
            onChange={handleMinChange}
            className="flex-1 min-w-[100px] h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400 focus:outline-none"
            aria-label="Minimum Delta Greek"
          />
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="number"
              min={0}
              max={1}
              step={step}
              value={currentMin}
              onChange={handleMinChange}
              aria-label="Minimum Delta Greek Input"
              className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center font-mono text-xs font-bold text-purple-300 focus:border-purple-400 outline-none"
            />
            <span className="text-[11px] font-mono text-emerald-400 font-medium whitespace-nowrap hidden sm:inline">
              ~{Math.round((1 - currentMin) * 100)}% POP
            </span>
          </div>
        </div>

        {/* Max Delta Slider */}
        <div className="flex items-center gap-3 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/90">
          <span className="text-xs font-semibold text-slate-300 w-16 shrink-0 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-fuchsia-400 inline-block shadow-sm shadow-fuchsia-400/50" />
            Max |Δ|:
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={step}
            value={currentMax}
            onChange={handleMaxChange}
            className="flex-1 min-w-[100px] h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400 focus:outline-none"
            aria-label="Maximum Delta Greek"
          />
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="number"
              min={0}
              max={1}
              step={step}
              value={currentMax}
              onChange={handleMaxChange}
              aria-label="Maximum Delta Greek Input"
              className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center font-mono text-xs font-bold text-purple-300 focus:border-purple-400 outline-none"
            />
            <span className="text-[11px] font-mono text-emerald-400 font-medium whitespace-nowrap hidden sm:inline">
              ~{Math.round((1 - currentMax) * 100)}% POP
            </span>
          </div>
        </div>
      </div>

      {/* Presets */}
      {showPresets && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/70">
          <span className="text-xs text-slate-400 font-semibold mr-1 flex items-center gap-1 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            Delta Presets:
          </span>
          {DELTA_PRESETS.map((p, idx) => {
            const isActive =
              Math.abs(currentMin - p.range[0]) < 0.005 &&
              Math.abs(currentMax - p.range[1]) < 0.005;
            return (
              <button
                type="button"
                key={idx}
                onClick={() => onChange(p.range)}
                title={p.tip}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border ${
                  isActive
                    ? "bg-purple-500/25 text-purple-200 border-purple-500/60 font-bold shadow-sm shadow-purple-500/20"
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
export default DeltaRangeSlider;
