import React from "react";
import { Calendar, RotateCcw, Clock, Sparkles } from "lucide-react";

export interface ExpirationDaysRangeSliderProps {
  minDays: number;
  maxDays: number;
  onChange: (range: [number, number]) => void;
  dataMinDays?: number;
  dataMaxDays?: number;
  label?: string;
  sublabel?: string;
  compact?: boolean;
  showPresets?: boolean;
  badgeCount?: { filtered: number; total: number };
  className?: string;
}

export interface DtePreset {
  label: string;
  shortLabel?: string;
  range: [number, number];
  tip: string;
}

export const ExpirationDaysRangeSlider: React.FC<ExpirationDaysRangeSliderProps> = ({
  minDays,
  maxDays,
  onChange,
  dataMinDays = 0,
  dataMaxDays = 365,
  label = "Expiration Days (DTE) Range",
  sublabel,
  compact = false,
  showPresets = true,
  badgeCount,
  className = "",
}) => {
  const isFiltered = minDays > dataMinDays || maxDays < dataMaxDays;

  // Generate dynamic presets tailored to available max days
  const presets: DtePreset[] = [
    {
      label: "All Expirations",
      shortLabel: "All",
      range: [dataMinDays, dataMaxDays],
      tip: `Include all available expiration cycles (${dataMinDays} to ${dataMaxDays} DTE)`,
    },
    {
      label: "0–7 Days (Weeklies)",
      shortLabel: "0–7d",
      range: [0, Math.min(7, dataMaxDays)],
      tip: "Ultra short-term weekly contracts with rapid gamma and high pin risk",
    },
    {
      label: "7–30 Days (Front Month)",
      shortLabel: "7–30d",
      range: [Math.max(dataMinDays, 7), Math.min(30, dataMaxDays)],
      tip: "Front-month cycles with accelerated extrinsic premium decay",
    },
    {
      label: "30–60 Days (Theta Sweet Spot)",
      shortLabel: "30–60d",
      range: [Math.max(dataMinDays, 30), Math.min(60, dataMaxDays)],
      tip: "Standard 30–60 DTE institutional options selling target with optimal risk/reward",
    },
    {
      label: "60–120 Days (Quarterly)",
      shortLabel: "60–120d",
      range: [Math.max(dataMinDays, 60), Math.min(120, dataMaxDays)],
      tip: "Medium-term quarterly cycles with lower delta sensitivity and smooth decay",
    },
    {
      label: "120+ Days (LEAPS / Long-Term)",
      shortLabel: "120d+",
      range: [Math.max(dataMinDays, 120), dataMaxDays],
      tip: "Long-term equity anticipation securities (LEAPS) and multi-month contracts",
    },
  ];

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val)) return;
    const clamped = Math.min(Math.max(val, dataMinDays), maxDays);
    onChange([clamped, maxDays]);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val)) return;
    const clamped = Math.max(Math.min(val, dataMaxDays), minDays);
    onChange([minDays, clamped]);
  };

  const handleReset = () => {
    onChange([dataMinDays, dataMaxDays]);
  };

  // Calculate track percent positions
  const totalSpan = Math.max(1, dataMaxDays - dataMinDays);
  const leftPct = Math.max(0, Math.min(100, ((minDays - dataMinDays) / totalSpan) * 100));
  const widthPct = Math.max(0, Math.min(100, ((maxDays - minDays) / totalSpan) * 100));

  return (
    <div
      className={`bg-slate-950/70 border border-slate-800/90 rounded-xl ${
        compact ? "p-3 space-y-2" : "p-3.5 space-y-2.5"
      } ${className}`}
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">{label}</span>
          <span className="text-xs font-mono font-semibold text-amber-300 bg-amber-950/50 border border-amber-800/60 px-2 py-0.5 rounded-md flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400" />
            {minDays} – {maxDays} Days
          </span>
          {badgeCount && (
            <span className="text-[11px] text-slate-400 font-mono">
              ({badgeCount.filtered} of {badgeCount.total} expirations)
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400 hidden md:inline text-[11px]">
            Target Horizon:{" "}
            <strong className="text-amber-300 font-mono">
              {maxDays <= 7
                ? "Weekly Expiries (<1 wk)"
                : maxDays <= 30
                ? "Near-Term Expiries (1–4 wks)"
                : minDays >= 30 && maxDays <= 60
                ? "Theta Sweet Spot (30–60d)"
                : minDays >= 60 && maxDays <= 120
                ? "Quarterly Cycles"
                : minDays >= 120
                ? "LEAPS / Long-Term"
                : `${minDays} to ${maxDays} Days to Expiration`}
            </strong>
          </span>

          {isFiltered && (
            <button
              onClick={handleReset}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold cursor-pointer transition ml-1"
              title={`Reset to all expiration days (${dataMinDays} – ${dataMaxDays} DTE)`}
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
            className="absolute top-0 bottom-0 bg-gradient-to-r from-amber-500 via-orange-400 to-rose-500 rounded-full transition-all duration-150"
            style={{
              left: `${leftPct}%`,
              width: `${widthPct}%`,
            }}
          />
        </div>
      </div>

      {/* Dual Sliders and Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
        {/* Min DTE Slider */}
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-semibold text-slate-400 w-20 shrink-0">
            Min Days:
          </span>
          <input
            type="range"
            min={dataMinDays}
            max={dataMaxDays}
            step={1}
            value={minDays}
            onChange={handleMinChange}
            aria-label="Minimum Expiration Days"
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400 focus:outline-none"
          />
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="number"
              min={dataMinDays}
              max={maxDays}
              step={1}
              value={minDays}
              onChange={handleMinChange}
              aria-label="Minimum Expiration Days Input"
              className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-right font-mono text-xs text-amber-300 focus:border-amber-500 outline-none"
            />
            <span className="text-[10px] text-slate-500 font-mono">d</span>
          </div>
        </div>

        {/* Max DTE Slider */}
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-semibold text-slate-400 w-20 shrink-0">
            Max Days:
          </span>
          <input
            type="range"
            min={dataMinDays}
            max={dataMaxDays}
            step={1}
            value={maxDays}
            onChange={handleMaxChange}
            aria-label="Maximum Expiration Days"
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400 focus:outline-none"
          />
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="number"
              min={minDays}
              max={dataMaxDays}
              step={1}
              value={maxDays}
              onChange={handleMaxChange}
              aria-label="Maximum Expiration Days Input"
              className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-right font-mono text-xs text-amber-300 focus:border-amber-500 outline-none"
            />
            <span className="text-[10px] text-slate-500 font-mono">d</span>
          </div>
        </div>
      </div>

      {/* Quick Presets */}
      {showPresets && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mr-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Quick DTE:
          </span>
          {presets.map((preset) => {
            const isActive =
              minDays === preset.range[0] &&
              (preset.range[1] >= dataMaxDays
                ? maxDays >= dataMaxDays
                : maxDays === preset.range[1]);

            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => onChange(preset.range)}
                title={preset.tip}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                  isActive
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold shadow-sm"
                    : "bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
