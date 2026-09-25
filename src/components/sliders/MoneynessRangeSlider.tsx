import React from "react";
import { Target, Sparkles, RotateCcw } from "lucide-react";

export interface MoneynessRangeSliderProps {
  range: [number, number]; // [minMoneyness, maxMoneyness], e.g. [20, 120]
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

export const MONEYNESS_PRESETS: { label: string; range: [number, number]; tip: string }[] = [
  { label: "All (20–120%)", range: [20, 120], tip: "All strikes from deep out-of-the-money to in-the-money" },
  { label: "Deep OTM (40–75%)", range: [40, 75], tip: "Ultra-conservative strikes with high margin of safety (25–60% buffer)" },
  { label: "Safe OTM (70–90%)", range: [70, 90], tip: "Institutional sweet spot for put selling (10–30% downside buffer)" },
  { label: "Near ATM (85–98%)", range: [85, 98], tip: "Moderate risk with elevated extrinsic theta yield (2–15% buffer)" },
  { label: "At/ITM (98–110%)", range: [98, 110], tip: "At-the-money or slightly in-the-money options for aggressive cash yield" },
];

export const MoneynessRangeSlider: React.FC<MoneynessRangeSliderProps> = ({
  range,
  onChange,
  min = 20,
  max = 120,
  step = 1,
  label = "Moneyness Band",
  sublabel = "Strike as % of spot price. Under 100% = Out-of-the-money (OTM).",
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
            <Target className="w-4 h-4 text-cyan-400 shrink-0" />
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
                  ? "text-cyan-300 bg-cyan-950/60 border-cyan-700/60"
                  : "text-slate-300 bg-slate-800/60 border-slate-700/60"
              }`}
            >
              {range[0]}% – {range[1]}%
            </span>
            {isFiltered && (
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] text-slate-400 hover:text-cyan-300 cursor-pointer transition p-0.5"
                title="Reset Moneyness to default"
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
            className="absolute top-0 bottom-0 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 rounded-full transition-all duration-100"
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
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            aria-label="Minimum Moneyness Percent"
          />
          <span className="text-xs font-mono font-bold text-cyan-300 w-9 text-right shrink-0">
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
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            aria-label="Maximum Moneyness Percent"
          />
          <span className="text-xs font-mono font-bold text-cyan-300 w-9 text-right shrink-0">
            {range[1]}%
          </span>
        </div>
      </div>

      {/* Presets */}
      {showPresets && (
        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          <span className="text-[10px] text-slate-500 mr-1 flex items-center gap-0.5 shrink-0">
            <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
            Presets:
          </span>
          {MONEYNESS_PRESETS.map((p, idx) => {
            const isActive = range[0] === p.range[0] && range[1] === p.range[1];
            return (
              <button
                type="button"
                key={idx}
                onClick={() => onChange(p.range)}
                title={p.tip}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition cursor-pointer border ${
                  isActive
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold shadow-sm shadow-cyan-500/10"
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
