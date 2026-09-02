import React from "react";
import { ShieldCheck, Activity, Layers, Sparkles } from "lucide-react";
import { findClosestFibonacci, FibonacciLevels } from "../utils/fibonacci";

export interface BollingerData {
  sma?: number;
  upper_band?: number;
  lower_band?: number;
  percent_b?: number;
  zone?: string;
}

export interface StrikeBollingerPosition {
  zone?: string;
  zone_label?: string;
  is_below_lower?: boolean;
  diff_from_lower?: number;
  pct_from_lower?: number;
  lower_band?: number;
  sma?: number;
  upper_band?: number;
}

interface BollingerRsiTooltipBadgeProps {
  strike?: number | null;
  spot?: number | null;
  rsi?: number | null;
  bollinger?: BollingerData | null;
  strikeBollingerPosition?: StrikeBollingerPosition | null;
  strikePosition?: StrikeBollingerPosition | null;
  fibonacci?: FibonacciLevels | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  compact?: boolean;
}

export const BollingerRsiTooltipBadge: React.FC<BollingerRsiTooltipBadgeProps> = ({
  strike,
  spot,
  rsi,
  bollinger,
  strikeBollingerPosition,
  strikePosition,
  fibonacci,
  fiftyTwoWeekHigh,
  fiftyTwoWeekLow,
  compact = false,
}) => {
  const activePosition = strikeBollingerPosition || strikePosition;
  // Derive position if not directly passed in activePosition
  const lowerBand = activePosition?.lower_band ?? bollinger?.lower_band ?? null;
  const sma = activePosition?.sma ?? bollinger?.sma ?? null;
  const upperBand = activePosition?.upper_band ?? bollinger?.upper_band ?? null;

  let isBelowLower = activePosition?.is_below_lower ?? false;
  let diffFromLower = activePosition?.diff_from_lower ?? 0;
  let pctFromLower = activePosition?.pct_from_lower ?? 0;
  let zoneLabel = activePosition?.zone_label || "";

  if (strike != null && lowerBand !== null) {
    isBelowLower = strike < lowerBand;
    diffFromLower = Number((strike - lowerBand).toFixed(2));
    pctFromLower = Number(((strike - lowerBand) / lowerBand * 100).toFixed(1));

    if (!zoneLabel) {
      if (strike < lowerBand) {
        zoneLabel = "Below Lower Band";
      } else if (sma !== null && strike < sma) {
        zoneLabel = "Between Lower & Mid Band";
      } else if (upperBand !== null && strike < upperBand) {
        zoneLabel = "Between Mid & Upper Band";
      } else {
        zoneLabel = "Above Upper Band";
      }
    }
  }

  // RSI categorization
  const rsiVal = rsi !== null && rsi !== undefined ? Number(rsi.toFixed(1)) : null;
  let rsiLabel = "Neutral";
  let rsiBadgeColor = "bg-blue-500/20 text-blue-300 border-blue-500/30";

  if (rsiVal !== null) {
    if (rsiVal < 30) {
      rsiLabel = "Oversold (<30)";
      rsiBadgeColor = "bg-emerald-500/25 text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-500/30";
    } else if (rsiVal > 70) {
      rsiLabel = "Overbought (>70)";
      rsiBadgeColor = "bg-amber-500/25 text-amber-300 border-amber-500/40 ring-1 ring-amber-500/30";
    } else {
      rsiLabel = "Neutral (30-70)";
      rsiBadgeColor = "bg-sky-500/20 text-sky-300 border-sky-500/30";
    }
  }

  // Fibonacci Retracement Calculation relative to Strike Price (or Spot Price)
  const targetPrice = strike != null && strike > 0 ? strike : spot != null ? spot : undefined;
  const closestFib = findClosestFibonacci(targetPrice, fibonacci, fiftyTwoWeekHigh, fiftyTwoWeekLow);

  const hasAnyData = rsiVal !== null || lowerBand !== null || closestFib !== null;
  if (!hasAnyData) return null;

  return (
    <div className="mt-2 pt-2 border-t border-slate-800/90 space-y-1.5 font-sans">
      {/* RSI OF UNDERLYING STOCK */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-400 flex items-center gap-1">
          <Activity className="w-3 h-3 text-cyan-400" />
          <span>Underlying RSI(14):</span>
        </span>
        {rsiVal !== null ? (
          <div className="flex items-center gap-1.5 font-mono">
            <span className="font-bold text-white text-xs">{rsiVal}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-sans font-bold uppercase border ${rsiBadgeColor}`}>
              {rsiLabel}
            </span>
          </div>
        ) : (
          <span className="text-slate-500 text-[10px]">N/A</span>
        )}
      </div>

      {/* BOLLINGER BAND POSITION OF STRIKE PRICE */}
      {lowerBand !== null && strike != null && (
        <div className="space-y-1">
          {/* If strike is below lower band: Special prominent Green Badge */}
          {isBelowLower ? (
            <div className="bg-gradient-to-r from-emerald-950/90 via-teal-950/80 to-slate-950/90 border border-emerald-500/50 rounded-lg p-2 text-emerald-200 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Below Lower Bollinger Band</span>
                </div>
                <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-400/40">
                  {pctFromLower}% Cushion
                </span>
              </div>
              <div className="text-[10px] text-emerald-300/90 font-mono mt-1 flex items-center justify-between">
                <span>Strike ${strike.toFixed(2)} &lt; Lower BB ${lowerBand.toFixed(2)}</span>
                <span>-${Math.abs(diffFromLower).toFixed(2)} below band</span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2 text-[10px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Strike vs Bollinger:</span>
                <span className="font-semibold text-slate-200 font-mono">
                  {zoneLabel}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400 font-mono mt-0.5">
                <span>Dist to Lower Band:</span>
                <span className="text-slate-300">
                  {diffFromLower >= 0 ? `+$${diffFromLower.toFixed(2)} (+${pctFromLower}%)` : `-$${Math.abs(diffFromLower).toFixed(2)} (${pctFromLower}%)`}
                </span>
              </div>
            </div>
          )}

          {/* Mini Bollinger Band Reference Levels */}
          {!compact && (
            <div className="grid grid-cols-3 gap-1 text-[9px] font-mono text-center pt-0.5">
              <div className="bg-slate-950/50 p-1 rounded border border-slate-800/60">
                <span className="text-slate-500 block text-[8px] uppercase">Lower BB</span>
                <span className="text-cyan-300 font-semibold">${lowerBand.toFixed(2)}</span>
              </div>
              {sma !== null && (
                <div className="bg-slate-950/50 p-1 rounded border border-slate-800/60">
                  <span className="text-slate-500 block text-[8px] uppercase">20d SMA</span>
                  <span className="text-slate-300 font-semibold">${sma.toFixed(2)}</span>
                </div>
              )}
              {upperBand !== null && (
                <div className="bg-slate-950/50 p-1 rounded border border-slate-800/60">
                  <span className="text-slate-500 block text-[8px] uppercase">Upper BB</span>
                  <span className="text-slate-400 font-semibold">${upperBand.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CLOSEST FIBONACCI RETRACEMENT LEVEL */}
      {closestFib && (
        <div className="space-y-1">
          <div className="bg-gradient-to-r from-amber-950/80 via-slate-950/90 to-amber-950/80 border border-amber-500/40 rounded-lg p-2 text-amber-200 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-amber-300">
                <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Closest Fib: {closestFib.closest.shortName}</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-400/40">
                ${closestFib.closest.value.toFixed(2)}
              </span>
            </div>

            <div className="text-[10px] font-mono mt-1 flex items-center justify-between text-amber-300/90">
              <span className="text-slate-400">Strike vs Fib Level:</span>
              <span className={closestFib.closest.isExact ? "text-emerald-300 font-bold" : closestFib.closest.isBelow ? "text-cyan-300 font-medium" : "text-amber-300 font-medium"}>
                {closestFib.closest.isExact
                  ? "🎯 Exact at Fib Level"
                  : closestFib.closest.diff > 0
                  ? `+$${closestFib.closest.diff.toFixed(2)} (+${closestFib.closest.diffPct}%) above`
                  : `-$${Math.abs(closestFib.closest.diff).toFixed(2)} (${closestFib.closest.diffPct}%) below`}
              </span>
            </div>
          </div>

          {/* Mini Fibonacci Ladder */}
          {!compact && (
            <div className="grid grid-cols-6 gap-0.5 text-[8px] font-mono text-center pt-0.5">
              {closestFib.allLevels.map((lvl) => (
                <div
                  key={lvl.ratioKey}
                  className={`p-1 rounded border transition-colors ${
                    lvl.isClosest
                      ? "bg-amber-500/30 border-amber-400 text-amber-200 font-bold ring-1 ring-amber-400/40"
                      : "bg-slate-950/60 border-slate-800/60 text-slate-400"
                  }`}
                  title={`${lvl.name}: $${lvl.value.toFixed(2)} (Diff: ${lvl.diff >= 0 ? "+" : ""}$${lvl.diff.toFixed(2)})`}
                >
                  <span className="block text-[7px] text-slate-500 uppercase">{lvl.pctStr}</span>
                  <span className="truncate block font-semibold">${lvl.value.toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

