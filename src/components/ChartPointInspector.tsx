import React, { useState } from "react";
import { X, Check, Copy, Crosshair, TrendingUp, DollarSign, Calendar, Percent, Shield, Activity } from "lucide-react";
import { BollingerRsiTooltipBadge } from "./BollingerRsiTooltipBadge";
import { FibonacciLevels } from "../types";

export interface InspectedPointData {
  ticker?: string;
  option_type?: string;
  strike?: number;
  snapped_strike?: number;
  target_strike?: number;
  spot?: number;
  current_price?: number;
  expiration?: string;
  dte?: number;
  days_to_expiration?: number;
  premium?: number;
  bid?: number;
  ask?: number;
  mid?: number;
  returnCashSecured?: number;
  annualized_return_pct_cash_secured?: number;
  annualized_return_cash_secured?: number;
  returnMargin?: number;
  annualized_return_pct?: number;
  annualized_return_margin?: number;
  moneyness?: number;
  iv?: number;
  implied_volatility?: number;
  volume?: number;
  open_interest?: number;
  rsi_14?: number | null;
  bollinger?: {
    sma: number;
    upper_band: number;
    lower_band: number;
    percent_b?: number;
    zone?: string;
  } | null;
  fibonacci?: FibonacciLevels | null;
  fifty_two_week_high?: number | null;
  fifty_two_week_low?: number | null;
  strike_bollinger_position?: {
    zone: string;
    zone_label: string;
    diff_from_lower: number;
    pct_from_lower: number;
    is_below_lower: boolean;
  } | null;
  [key: string]: any;
}

interface ChartPointInspectorProps {
  point: InspectedPointData | null;
  onClose: () => void;
  themeColor?: string;
  title?: string;
}

export const ChartPointInspector: React.FC<ChartPointInspectorProps> = ({
  point,
  onClose,
  themeColor = "#06b6d4",
  title = "Inspected Point Details",
}) => {
  const [copied, setCopied] = useState(false);

  if (!point) return null;

  const ticker = point.ticker || "Option";
  const optionType = (point.option_type || "PUT").toUpperCase();
  const strike = point.strike ?? point.snapped_strike ?? point.target_strike ?? 0;
  const spot = point.spot ?? point.current_price ?? 0;
  const expiration = point.expiration || "";
  const dte = point.dte ?? point.days_to_expiration ?? 0;

  const bid = point.premium ?? point.bid ?? 0;
  const ask = point.ask ?? 0;
  const mid = point.mid ?? (bid > 0 && ask > 0 ? (bid + ask) / 2 : bid);

  const cashYield =
    point.returnCashSecured ??
    point.annualized_return_pct_cash_secured ??
    point.annualized_return_cash_secured ??
    0;
  const marginYield =
    point.returnMargin ??
    point.annualized_return_pct ??
    point.annualized_return_margin ??
    0;

  const moneyness =
    point.moneyness ??
    (spot > 0 && strike > 0 ? (strike / spot) * 100 : 0);

  const iv = point.iv ?? point.implied_volatility ?? 0;

  const isPut = optionType.toLowerCase() === "put";
  const distFromSpot = spot > 0 ? strike - spot : 0;
  const pctFromSpot = spot > 0 ? ((strike - spot) / spot) * 100 : 0;
  const isOTM = spot > 0 ? (isPut ? strike < spot : strike > spot) : false;
  const isITM = spot > 0 ? (isPut ? strike > spot : strike < spot) : false;
  const downsideBufferPct = spot > 0 ? Math.max(0, ((spot - strike) / spot) * 100) : 0;

  const copySummary = () => {
    const text = `${ticker} $${strike.toFixed(2)} ${optionType} (${expiration}, ${dte}d) | Spot: $${spot.toFixed(2)} | Bid: $${bid.toFixed(2)} | Cash Yield: ${cashYield.toFixed(1)}% | IV: ${iv.toFixed(1)}% | RSI(14): ${point.rsi_14?.toFixed(1) || "N/A"}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-3 bg-slate-900/98 backdrop-blur-md border-2 border-cyan-500/40 rounded-xl p-3.5 sm:p-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
          </span>
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-white font-display flex items-center gap-2">
              <span>{ticker} ${strike.toFixed(2)} {optionType}</span>
              <span
                className="text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider"
                style={{ backgroundColor: `${themeColor}22`, color: themeColor, borderColor: `${themeColor}44`, borderWidth: 1 }}
              >
                Selected Point
              </span>
            </h4>
          </div>
          {expiration && (
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono font-medium">
              📅 {expiration} ({dte}d DTE)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copySummary}
            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
            title="Copy contract summary to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close / Unpin"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: Metrics & Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs mb-3 font-mono">
        {/* Spot & Moneyness */}
        <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-sans flex items-center justify-between">
            <span>Spot & Strike</span>
            <DollarSign className="w-3 h-3 text-cyan-400" />
          </div>
          <div className="text-white font-bold text-sm">
            ${strike.toFixed(2)} <span className="text-xs text-slate-400 font-normal">/ ${spot.toFixed(2)}</span>
          </div>
          <div className="text-[11px] flex items-center gap-1">
            <span className={isOTM ? "text-cyan-400 font-semibold" : isITM ? "text-rose-400 font-semibold" : "text-amber-400 font-semibold"}>
              {moneyness > 0 ? `${moneyness.toFixed(1)}% Moneyness` : ""}
            </span>
            {isOTM && downsideBufferPct > 0 && (
              <span className="text-[10px] text-emerald-400">({downsideBufferPct.toFixed(1)}% buffer)</span>
            )}
          </div>
        </div>

        {/* Option Premium Pricing */}
        <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-sans flex items-center justify-between">
            <span>Option Premium</span>
            <TrendingUp className="w-3 h-3 text-cyan-400" />
          </div>
          <div className="font-bold text-sm" style={{ color: themeColor }}>
            Bid: ${bid.toFixed(2)}
            {ask > 0 && <span className="text-xs text-slate-400 font-normal ml-1">| Ask: ${ask.toFixed(2)}</span>}
          </div>
          <div className="text-[10px] text-slate-400">
            Per Contract (100 shares): <span className="text-slate-200 font-bold">${(bid * 100).toFixed(0)}</span>
          </div>
        </div>

        {/* Yield Returns */}
        <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-sans flex items-center justify-between">
            <span>Annualized Yield</span>
            <Percent className="w-3 h-3 text-emerald-400" />
          </div>
          <div className="text-emerald-400 font-bold text-sm">
            {cashYield > 0 ? `${cashYield.toFixed(1)}% Cash` : "—"}
          </div>
          <div className="text-[10px] text-slate-400">
            {marginYield > 0 ? `Margin Return: ${marginYield.toFixed(1)}%` : `DTE: ${dte} days`}
          </div>
        </div>

        {/* Volatility & Liquidity */}
        <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-sans flex items-center justify-between">
            <span>Volatility & Volume</span>
            <Activity className="w-3 h-3 text-amber-400" />
          </div>
          <div className="text-amber-400 font-bold text-sm">
            {iv > 0 ? `IV: ${iv.toFixed(1)}%` : "IV: Normal"}
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            {point.volume !== undefined || point.open_interest !== undefined ? (
              <span>Vol: {point.volume ?? 0} | OI: {point.open_interest ?? 0}</span>
            ) : (
              <span>52W: ${point.fifty_two_week_low ?? "—"} - ${point.fifty_two_week_high ?? "—"}</span>
            )}
          </div>
        </div>
      </div>

      {/* Technicals Section: RSI, Bollinger Bands & Fibonacci Retracements */}
      <div className="pt-2 border-t border-slate-800/90">
        <BollingerRsiTooltipBadge
          strike={strike}
          spot={spot}
          rsi={point.rsi_14}
          bollinger={point.bollinger}
          fibonacci={point.fibonacci}
          fiftyTwoWeekHigh={point.fifty_two_week_high}
          fiftyTwoWeekLow={point.fifty_two_week_low}
          strikePosition={point.strike_bollinger_position}
        />
      </div>
    </div>
  );
};
