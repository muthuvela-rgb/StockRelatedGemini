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

  const resolvedHorizon =
    maxDays <= 7
      ? "Weekly Expiries (<1 wk)"
      : maxDays <= 30
      ? "Near-Term (1–4 wks)"
      : minDays >= 30 && maxDays <= 60
      ? "Theta Sweet Spot (30–60d)"
      : minDays >= 60 && maxDays <= 120
      ? "Quarterly Cycles"
      : minDays >= 120
      ? "LEAPS / Long-Term"
      : `${minDays} to ${maxDays} Days to Expiration`;

  return (
    <div
      className={`bg-slate-950/70 border border-slate-800/90 rounded-xl flex flex-col justify-between ${
        compact ? "p-3 space-y-2" : "p-3.5 space-y-2.5"
      } ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
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
              {minDays} – {maxDays}d
            </span>
            {isFiltered && (
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] text-slate-400 hover:text-amber-300 cursor-pointer transition p-0.5"
                title="Reset DTE to all days"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
          {sublabel || (
            <>
              Target Horizon:{" "}
              <strong className="text-amber-300 font-mono">{resolvedHorizon}</strong>
            </>
          )}
        </p>
      </div>

      {/* Visual Range Track */}
      <div className="relative pt-1 pb-1">
        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden relative">
          <div
            className="absolute top-0 bottom-0 bg-gradient-to-r from-amber-500 via-orange-400 to-rose-500 rounded-full transition-all duration-100"
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
            min={dataMinDays}
            max={dataMaxDays}
            step={1}
            value={minDays}
            onChange={handleMinChange}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            aria-label="Minimum Expiration Days"
          />
          <span className="text-xs font-mono font-bold text-amber-300 w-10 text-right shrink-0">
            {minDays}d
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">Max:</span>
          <input
            type="range"
            min={dataMinDays}
            max={dataMaxDays}
            step={1}
            value={maxDays}
            onChange={handleMaxChange}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            aria-label="Maximum Expiration Days"
          />
          <span className="text-xs font-mono font-bold text-amber-300 w-10 text-right shrink-0">
            {maxDays}d
          </span>
        </div>
      </div>

      {/* Quick Presets */}
      {showPresets && (
        <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-800/60">
          <span className="text-[10px] text-slate-500 mr-1 flex items-center gap-0.5 shrink-0">
            <Sparkles className="w-2.5 h-2.5 text-amber-400" />
            Presets:
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
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
                  isActive
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold"
                    : "bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                {preset.shortLabel || preset.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
