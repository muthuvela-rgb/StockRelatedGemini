import React from "react";
import { Sliders, RotateCcw, Activity, ShieldCheck, Zap, Sparkles } from "lucide-react";

export interface DeltaRangeSliderProps {
  minDelta: number; // 0.00 to 1.00
  maxDelta: number; // 0.00 to 1.00
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
  { label: "Conservative (0.05–0.15)", range: [0.05, 0.15], tip: "Deep OTM, high probability of profit (~85–95% POP)" },
  { label: "Sweet Spot (0.15–0.30)", range: [0.15, 0.3], tip: "Standard institutional put selling target (~70–85% POP)" },
  { label: "Moderate (0.30–0.50)", range: [0.3, 0.5], tip: "Higher premium yield with moderate assignment risk (~50–70% POP)" },
  { label: "Near ATM (0.45–0.55)", range: [0.45, 0.55], tip: "At-the-money options with maximum extrinsic theta decay" },
];

export const DeltaRangeSlider: React.FC<DeltaRangeSliderProps> = ({
  minDelta,
  maxDelta,
  onChange,
  label = "Delta Greek (|Δ|) Range",
  sublabel,
  step = 0.01,
  showPresets = true,
  compact = false,
  badgeCount,
  className = "",
}) => {
  const isFiltered = minDelta > 0.001 || maxDelta < 0.999;

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const clamped = Math.min(Math.max(val, 0), maxDelta);
    onChange([Math.round(clamped * 100) / 100, maxDelta]);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const clamped = Math.max(Math.min(val, 1), minDelta);
    onChange([minDelta, Math.round(clamped * 100) / 100]);
  };

  const handleReset = () => {
    onChange([0.0, 1.0]);
  };

  // Approximate POP based on Delta (for OTM options: POP ≈ 1 - |Δ|)
  const popMin = Math.round((1 - maxDelta) * 100);
  const popMax = Math.round((1 - minDelta) * 100);

  return (
    <div
      className={`bg-slate-950/70 border border-slate-800/90 rounded-xl ${
        compact ? "p-3 space-y-2" : "p-3.5 space-y-2.5"
      } ${className}`}
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">{label}</span>
          <span className="text-xs font-mono font-semibold text-cyan-300 bg-cyan-950/50 border border-cyan-800/60 px-2 py-0.5 rounded-md">
            |Δ| {minDelta.toFixed(2)} – {maxDelta.toFixed(2)}
          </span>
          {badgeCount && (
            <span className="text-[11px] text-slate-400 font-mono">
              ({badgeCount.filtered} of {badgeCount.total} matches)
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400 hidden sm:inline">
            Estimated Win Rate:{" "}
            <strong className="text-emerald-400 font-mono">
              ~{popMin}% – {popMax}% POP
            </strong>
          </span>

          {isFiltered && (
            <button
              onClick={handleReset}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold cursor-pointer transition ml-1"
              title="Reset to all deltas (0.00 – 1.00)"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {sublabel && <p className="text-[11px] text-slate-400">{sublabel}</p>}

      {/* Visual active band track representation */}
      <div className="relative pt-1 pb-1">
        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden relative">
          <div
            className="absolute top-0 bottom-0 bg-gradient-to-r from-blue-500 via-cyan-400 to-rose-500 rounded-full transition-all duration-150"
            style={{
              left: `${Math.max(0, Math.min(100, minDelta * 100))}%`,
              width: `${Math.max(0, Math.min(100, (maxDelta - minDelta) * 100))}%`,
            }}
          />
        </div>
      </div>

      {/* Dual Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
        {/* Min Delta Slider */}
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-semibold text-slate-400 w-18 shrink-0">
            Min |Δ|:
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={step}
            value={minDelta}
            onChange={handleMinChange}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            aria-label="Minimum Delta Greek"
          />
          <span className="text-xs font-mono font-bold text-cyan-300 w-12 text-right">
            {minDelta.toFixed(2)}
          </span>
        </div>

        {/* Max Delta Slider */}
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-semibold text-slate-400 w-18 shrink-0">
            Max |Δ|:
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={step}
            value={maxDelta}
            onChange={handleMaxChange}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-400"
            aria-label="Maximum Delta Greek"
          />
          <span className="text-xs font-mono font-bold text-rose-300 w-12 text-right">
            {maxDelta.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Quick Presets */}
      {showPresets && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
          <span className="text-[11px] text-slate-500 font-medium mr-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Presets:</span>
          </span>
          {DELTA_PRESETS.map((p, idx) => {
            const isActive =
              Math.abs(minDelta - p.range[0]) < 0.01 && Math.abs(maxDelta - p.range[1]) < 0.01;
            return (
              <button
                key={idx}
                onClick={() => onChange(p.range)}
                title={p.tip}
                className={`px-2 py-0.5 rounded-md font-medium text-[11px] transition cursor-pointer border ${
                  isActive
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm"
                    : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60"
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
