import React, { useState } from "react";
import {
  Crosshair,
  Calendar,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  X,
  ArrowDownRight,
  Percent,
  Layers,
  ArrowRight,
  Sparkles,
  Info,
} from "lucide-react";
import { OptionGreeks, FibonacciLevels } from "../types";
import { formatCurrency, formatPct } from "../lib/utils";
import { findClosestFibonacci } from "../utils/fibonacci";

interface OptionPointDetailInspectorProps {
  contract: OptionGreeks | null;
  currentPrice: number;
  ticker: string;
  tab: "puts" | "calls" | "both";
  bollinger?: {
    sma: number;
    upper_band: number;
    lower_band: number;
    percent_b?: number;
    zone?: string;
  } | null;
  rsi_14?: number | null;
  fibonacci?: FibonacciLevels | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  nextEarningsDate?: string | null;
  nextEarningsTimestamp?: number | null;
  onClose: () => void;
  onScrollToTable?: () => void;
}

export const OptionPointDetailInspector: React.FC<OptionPointDetailInspectorProps> = ({
  contract,
  currentPrice,
  ticker,
  tab,
  bollinger,
  rsi_14,
  fibonacci,
  fiftyTwoWeekHigh,
  fiftyTwoWeekLow,
  nextEarningsDate,
  nextEarningsTimestamp,
  onClose,
  onScrollToTable,
}) => {
  const [copied, setCopied] = useState(false);

  if (!contract) return null;

  const isPut = contract.contractSymbol
    ? (contract.contractSymbol.match(/[0-9]{6}([CP])[0-9]{8}/)?.[1] === "P" || contract.contractSymbol.includes("P"))
    : tab === "puts";
  const strike = contract.strike;
  const spot = currentPrice;
  const dte = contract.days_to_expiration || 1;
  const expiration = contract.expiration || "";

  const bid = contract.bid || contract.lastPrice || 0;
  const ask = contract.ask || contract.lastPrice || 0;
  const mid = contract.bid && contract.ask ? Number(((contract.bid + contract.ask) / 2).toFixed(2)) : contract.lastPrice || bid;
  const last = contract.lastPrice || 0;
  const iv = contract.impliedVolatility || 0;

  // Annualized Yield Calculations
  const cashSecuredYield = strike > 0 && dte > 0 ? (bid / strike) * (365 / dte) * 100 : 0;
  const marginYield = spot > 0 && dte > 0 ? (bid / (0.2 * spot)) * (365 / dte) * 100 : 0;
  const coveredCallYield = spot > 0 && dte > 0 ? (bid / spot) * (365 / dte) * 100 : 0;

  // Moneyness & Buffer
  const moneynessPct = spot > 0 ? (strike / spot) * 100 : 100;
  const isOtm = isPut ? strike < spot : strike > spot;
  const isItm = isPut ? strike > spot : strike < spot;
  const isAtm = spot > 0 && Math.abs(strike - spot) <= spot * 0.008;

  const downsideBufferPct = spot > 0 ? Math.max(0, ((spot - strike) / spot) * 100) : 0;
  const upsideBufferPct = spot > 0 ? Math.max(0, ((strike - spot) / spot) * 100) : 0;
  const bufferDisplay = isPut ? downsideBufferPct : upsideBufferPct;

  // 1. EARNINGS DATE ANALYSIS
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const earningsAnalysis = (() => {
    // Check if ETF or index
    const isEtf = ["QQQ", "SPY", "IWM", "DIA", "SMH", "XLF", "XLK", "XLE", "VTI", "VOO"].includes(
      ticker.toUpperCase()
    );

    if (!nextEarningsDate) {
      if (isEtf) {
        return {
          type: "etf",
          badge: "🛡️ Broad ETF / Index",
          badgeClass: "bg-sky-500/20 text-sky-300 border-sky-500/30",
          headline: "Diversified ETF Basket (Zero Single-Stock Earnings Risk)",
          detail: `${ticker} is an index ETF comprised of multiple corporate holdings with staggered report cycles. There is no single binary earnings event risk.`,
        };
      }
      return {
        type: "unknown",
        badge: "📅 Earnings TBA",
        badgeClass: "bg-slate-800 text-slate-400 border-slate-700",
        headline: "Next Earnings Date Pending Announcement",
        detail: "No confirmed earnings report date is officially scheduled in company SEC filings.",
      };
    }

    let earningsTime = nextEarningsTimestamp;
    if (!earningsTime) {
      earningsTime = new Date(nextEarningsDate).getTime();
    }

    const diffDays = Math.round((earningsTime - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays > 0 && diffDays <= dte) {
      return {
        type: "spans",
        badge: "⚠️ Spans Earnings Announcement",
        badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40 ring-1 ring-amber-500/30",
        headline: `Option Spans Earnings on ${nextEarningsDate} (${diffDays}d away)`,
        detail: `This option expires ${dte - diffDays} days AFTER earnings. Option sellers face binary event gap risk; implied volatility (IV) will likely remain elevated until the report.`,
      };
    }

    if (diffDays > dte) {
      const marginDays = diffDays - dte;
      return {
        type: "pre",
        badge: "🛡️ Expires Cleanly Before Earnings",
        badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-500/30",
        headline: `Expires ${marginDays}d Before Earnings on ${nextEarningsDate}`,
        detail: `Zero binary earnings risk! The contract expires cleanly prior to the earnings announcement on ${nextEarningsDate} (${diffDays}d away).`,
      };
    }

    if (diffDays <= 0 && diffDays >= -30) {
      return {
        type: "post",
        badge: "📅 Post-Earnings Runway",
        badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/30",
        headline: `Earnings Passed ${Math.abs(diffDays)}d Ago (${nextEarningsDate})`,
        detail: `The stock recently cleared its binary earnings catalyst. Volatility crush has taken effect, providing a clean post-earnings runway.`,
      };
    }

    return {
      type: "scheduled",
      badge: `📅 Next Earnings: ${nextEarningsDate}`,
      badgeClass: "bg-slate-800 text-slate-300 border-slate-700",
      headline: `Next Earnings Announcement: ${nextEarningsDate} (${diffDays}d away)`,
      detail: `Earnings is scheduled for ${nextEarningsDate}. Contract DTE is ${dte} days.`,
    };
  })();

  // 2. BOLLINGER BAND POSITION ANALYSIS
  const bollingerAnalysis = (() => {
    if (!bollinger || !bollinger.lower_band || !bollinger.upper_band) {
      return null;
    }

    const { sma, lower_band, upper_band, percent_b } = bollinger;
    const isBelowLower = strike < lower_band;
    const isAboveUpper = strike > upper_band;
    const diffFromLower = strike - lower_band;
    const pctFromLower = ((diffFromLower) / lower_band) * 100;

    let positionTitle = "";
    let positionDetail = "";
    let badgeClass = "";
    let isOptimalPutSafety = false;

    if (isBelowLower) {
      isOptimalPutSafety = true;
      positionTitle = "Below -2.0σ Lower Bollinger Band";
      positionDetail = `Strike ($${strike.toFixed(2)}) is $${Math.abs(diffFromLower).toFixed(2)} (${Math.abs(pctFromLower).toFixed(1)}%) below the statistical lower band ($${lower_band.toFixed(2)}). Statistically oversold margin of safety!`;
      badgeClass = "bg-emerald-500/25 text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-500/30";
    } else if (strike < sma) {
      positionTitle = "Lower Half (Between Lower Band & 20-Day SMA)";
      positionDetail = `Strike is above the lower band ($${lower_band.toFixed(2)}) but below the 20-day mean ($${sma.toFixed(2)}).`;
      badgeClass = "bg-blue-500/20 text-blue-300 border-blue-500/30";
    } else if (strike <= upper_band) {
      positionTitle = "Upper Half (Between 20-Day SMA & Upper Band)";
      positionDetail = `Strike is above the 20-day mean ($${sma.toFixed(2)}) and approaching the upper band ($${upper_band.toFixed(2)}).`;
      badgeClass = "bg-sky-500/20 text-sky-300 border-sky-500/30";
    } else {
      positionTitle = "Above +2.0σ Upper Bollinger Band";
      positionDetail = `Strike ($${strike.toFixed(2)}) is above the +2.0σ upper band ($${upper_band.toFixed(2)}). Overbought statistical boundary.`;
      badgeClass = "bg-rose-500/20 text-rose-300 border-rose-500/30";
    }

    // Spot position relative to band
    const spotPercentB = percent_b !== undefined ? percent_b : (spot - lower_band) / (upper_band - lower_band);

    return {
      sma,
      lower_band,
      upper_band,
      isBelowLower,
      isAboveUpper,
      diffFromLower,
      pctFromLower,
      positionTitle,
      positionDetail,
      badgeClass,
      isOptimalPutSafety,
      spotPercentB,
    };
  })();

  // 3. RSI 14-DAY ANALYSIS
  const rsiAnalysis = (() => {
    if (rsi_14 === null || rsi_14 === undefined) return null;
    const rsiVal = Number(rsi_14.toFixed(1));

    if (rsiVal < 30) {
      return {
        value: rsiVal,
        label: "Oversold (< 30)",
        colorClass: "text-emerald-400 font-bold",
        badgeClass: "bg-emerald-500/25 text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-500/30",
        advice: "Deeply oversold momentum. Historical tendency for mean-reversion bounces supports put selling.",
      };
    }
    if (rsiVal > 70) {
      return {
        value: rsiVal,
        label: "Overbought (> 70)",
        colorClass: "text-rose-400 font-bold",
        badgeClass: "bg-rose-500/25 text-rose-300 border-rose-500/40 ring-1 ring-rose-500/30",
        advice: "Extended bullish momentum. Watch for consolidation resistance; favorable for covered calls.",
      };
    }
    return {
      value: rsiVal,
      label: "Neutral (30–70)",
      colorClass: "text-blue-300 font-bold",
      badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      advice: "Stable momentum oscillation inside standard market parameters.",
    };
  })();

  // 4. FIBONACCI RETRACEMENT
  const closestFib = findClosestFibonacci(strike, fibonacci, fiftyTwoWeekHigh, fiftyTwoWeekLow);

  const copySummary = () => {
    const text = [
      `${ticker} $${strike.toFixed(2)} ${isPut ? "PUT" : "CALL"} (${expiration}, ${dte}d DTE)`,
      `Spot: $${spot.toFixed(2)} | Bid: $${bid.toFixed(2)} | Ask: $${ask.toFixed(2)} | Mid: $${mid.toFixed(2)}`,
      `Cash Yield: ${cashSecuredYield.toFixed(1)}% | IV: ${iv.toFixed(1)}% | Delta: ${contract.delta ?? "N/A"}`,
      `Earnings: ${earningsAnalysis.headline}`,
      bollingerAnalysis ? `Bollinger: ${bollingerAnalysis.positionTitle} (Lower $${bollingerAnalysis.lower_band.toFixed(2)})` : "",
      rsiAnalysis ? `RSI(14): ${rsiAnalysis.value} (${rsiAnalysis.label})` : "",
    ].filter(Boolean).join(" | ");

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id="option-point-inspector"
      className="mt-4 bg-slate-900/98 backdrop-blur-xl border-2 border-cyan-500/50 rounded-2xl p-4 sm:p-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
    >
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 pb-3.5 mb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
          </span>

          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-cyan-400" />
            <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
              <span>{ticker} ${strike.toFixed(2)} {isPut ? "Put" : "Call"}</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border ${
                  isPut
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                }`}
              >
                {isPut ? "Put Option" : "Call Option"}
              </span>
            </h3>
          </div>

          <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 font-mono font-medium border border-slate-700/80 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span>{expiration}</span>
            <span className="text-cyan-400 font-bold">({dte}d DTE)</span>
          </span>

          <span
            className={`text-xs px-2.5 py-1 rounded-md font-sans font-bold border ${
              isAtm
                ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                : isOtm
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                : "bg-blue-500/20 text-blue-300 border-blue-500/30"
            }`}
          >
            {isAtm ? "At-the-Money (ATM)" : isOtm ? `OTM (${bufferDisplay.toFixed(1)}% Cushion)` : "In-the-Money (ITM)"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onScrollToTable && (
            <button
              onClick={onScrollToTable}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700 font-semibold cursor-pointer"
              title="Highlight & scroll to this contract in the chain table"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>View in Table</span>
            </button>
          )}

          <button
            onClick={copySummary}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700 font-semibold cursor-pointer"
            title="Copy contract specs and technicals summary"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Dismiss Inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: 4 Core Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs mb-4 font-mono">
        {/* Module 1: Spot, Strike & Moneyness */}
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/90 space-y-1.5">
          <div className="text-[10px] text-slate-400 uppercase font-sans flex items-center justify-between">
            <span className="font-semibold text-slate-300">Spot & Moneyness</span>
            <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-white font-bold text-base flex items-baseline gap-1.5">
            <span>${strike.toFixed(2)}</span>
            <span className="text-xs text-slate-400 font-normal">/ Spot ${spot.toFixed(2)}</span>
          </div>
          <div className="text-[11px] flex flex-wrap items-center gap-1.5">
            <span className={isOtm ? "text-emerald-400 font-semibold" : isItm ? "text-rose-400 font-semibold" : "text-amber-400 font-semibold"}>
              {moneynessPct.toFixed(1)}% Moneyness
            </span>
            {bufferDisplay > 0 && (
              <span className="text-[10px] text-cyan-400 font-sans">
                ({bufferDisplay.toFixed(1)}% {isPut ? "downside margin" : "upside buffer"})
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-400 font-sans pt-1 border-t border-slate-800/80">
            {isPut ? (
              <span>Break-even at Expiration: <strong className="text-white font-mono">${(strike - bid).toFixed(2)}</strong></span>
            ) : (
              <span>Break-even at Expiration: <strong className="text-white font-mono">${(strike + bid).toFixed(2)}</strong></span>
            )}
          </div>
        </div>

        {/* Module 2: Premium Pricing & Contract Value */}
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/90 space-y-1.5">
          <div className="text-[10px] text-slate-400 uppercase font-sans flex items-center justify-between">
            <span className="font-semibold text-slate-300">Option Premium</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="font-bold text-base text-emerald-400">
            Bid: ${bid.toFixed(2)}
            <span className="text-xs text-slate-400 font-normal ml-1.5 font-mono">
              Ask: ${ask.toFixed(2)}
            </span>
          </div>
          <div className="text-[11px] text-slate-300 flex items-center justify-between">
            <span>Mid: <strong className="text-white">${mid.toFixed(2)}</strong></span>
            <span>Last: <strong className="text-slate-200">${last.toFixed(2)}</strong></span>
          </div>
          <div className="text-[10px] text-slate-400 font-sans pt-1 border-t border-slate-800/80 flex items-center justify-between">
            <span>1 Contract (100 sh):</span>
            <span className="text-emerald-400 font-bold font-mono">${(bid * 100).toFixed(0)} credit</span>
          </div>
        </div>

        {/* Module 3: Annualized Yields & Return Profile */}
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/90 space-y-1.5">
          <div className="text-[10px] text-slate-400 uppercase font-sans flex items-center justify-between">
            <span className="font-semibold text-slate-300">Annualized Yield</span>
            <Percent className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-emerald-400 font-bold text-base flex items-baseline gap-1">
            <span>{cashSecuredYield > 0 ? `${cashSecuredYield.toFixed(1)}%` : "—"}</span>
            <span className="text-xs text-slate-400 font-normal font-sans">Cash-Secured</span>
          </div>
          <div className="text-[11px] text-slate-300">
            Margin Return: <strong className="text-cyan-400 font-mono">{marginYield > 0 ? `${marginYield.toFixed(1)}%` : "—"}</strong>
          </div>
          <div className="text-[10px] text-slate-400 font-sans pt-1 border-t border-slate-800/80">
            {isPut ? (
              <span>Collateral Req: <strong className="text-white font-mono">${(strike * 100).toLocaleString()}</strong></span>
            ) : (
              <span>Covered Yield: <strong className="text-white font-mono">{coveredCallYield.toFixed(1)}%</strong></span>
            )}
          </div>
        </div>

        {/* Module 4: Greeks & Volatility */}
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/90 space-y-1.5">
          <div className="text-[10px] text-slate-400 uppercase font-sans flex items-center justify-between">
            <span className="font-semibold text-slate-300">Greeks & Liquidity</span>
            <Activity className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-amber-400 font-bold">IV: {iv > 0 ? `${iv.toFixed(1)}%` : "Normal"}</span>
            <span className="text-slate-300">Δ: <strong className="text-white">{contract.delta !== null ? contract.delta : "—"}</strong></span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-400">
            <div>Θ: <strong className="text-rose-400">{contract.theta !== null ? contract.theta : "—"}</strong></div>
            <div>Γ: <strong className="text-slate-300">{contract.gamma !== null ? contract.gamma : "—"}</strong></div>
            <div>ν: <strong className="text-cyan-400">{contract.vega !== null ? contract.vega : "—"}</strong></div>
          </div>
          <div className="text-[10px] text-slate-400 font-sans pt-1 border-t border-slate-800/80 truncate">
            Vol: <span className="text-slate-200 font-mono font-bold">{contract.volume.toLocaleString()}</span> | OI: <span className="text-slate-200 font-mono font-bold">{contract.openInterest.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* TECHNICALS & EARNINGS CARD SECTION */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-3.5 text-xs">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h4 className="font-bold text-white font-sans text-xs uppercase tracking-wider">
            Technicals & Catalysts for Strike ${strike.toFixed(2)}
          </h4>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
          {/* 1. EARNINGS DATE & EVENT TIMING */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 font-sans">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                Earnings Date & Timing
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold border font-sans ${earningsAnalysis.badgeClass}`}>
                {earningsAnalysis.badge}
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-white">
                {earningsAnalysis.headline}
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                {earningsAnalysis.detail}
              </p>
            </div>

            {nextEarningsDate && (
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Announce Date: <strong className="text-slate-200">{nextEarningsDate}</strong></span>
                <span>Option Expiration: <strong className="text-cyan-400">{expiration}</strong></span>
              </div>
            )}
          </div>

          {/* 2. POSITION IN BOLLINGER BAND */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 font-sans">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Bollinger Band Position (20d, 2.0σ)
              </span>
              {bollingerAnalysis && (
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold border font-sans ${bollingerAnalysis.badgeClass}`}>
                  {bollingerAnalysis.isBelowLower ? "< Lower Band" : bollingerAnalysis.isAboveUpper ? "> Upper Band" : "Inside Bands"}
                </span>
              )}
            </div>

            {bollingerAnalysis ? (
              <>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-white">
                    {bollingerAnalysis.positionTitle}
                  </p>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                    {bollingerAnalysis.positionDetail}
                  </p>
                </div>

                {/* Visual Band Positioning Track */}
                <div className="pt-1.5 space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>Lower: ${bollingerAnalysis.lower_band.toFixed(1)}</span>
                    <span>SMA: ${bollingerAnalysis.sma.toFixed(1)}</span>
                    <span>Upper: ${bollingerAnalysis.upper_band.toFixed(1)}</span>
                  </div>
                  <div className="relative w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
                    <div className="absolute left-[20%] right-[20%] top-0 bottom-0 bg-blue-500/20" />
                    {/* Spot Marker */}
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-cyan-400 z-10"
                      style={{
                        left: `${Math.min(
                          95,
                          Math.max(
                            5,
                            ((spot - (bollingerAnalysis.lower_band * 0.95)) /
                              ((bollingerAnalysis.upper_band * 1.05) - (bollingerAnalysis.lower_band * 0.95))) *
                              100
                          )
                        )}%`,
                      }}
                      title={`Spot: $${spot.toFixed(2)}`}
                    />
                    {/* Strike Marker */}
                    <div
                      className={`absolute top-0 bottom-0 w-1.5 z-20 ${
                        bollingerAnalysis.isBelowLower ? "bg-emerald-400" : "bg-amber-400"
                      }`}
                      style={{
                        left: `${Math.min(
                          95,
                          Math.max(
                            5,
                            ((strike - (bollingerAnalysis.lower_band * 0.95)) /
                              ((bollingerAnalysis.upper_band * 1.05) - (bollingerAnalysis.lower_band * 0.95))) *
                              100
                          )
                        )}%`,
                      }}
                      title={`Strike: $${strike.toFixed(2)}`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-sans">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Strike: ${strike.toFixed(1)}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Spot: ${spot.toFixed(1)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-slate-400 text-xs py-2 font-sans">Bollinger Band data loading or unavailable.</p>
            )}
          </div>

          {/* 3. RSI & FIBONACCI RETRACEMENT */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 font-sans">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                RSI (14) & Fibonacci Support
              </span>
              {rsiAnalysis && (
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold border font-sans ${rsiAnalysis.badgeClass}`}>
                  RSI: {rsiAnalysis.value}
                </span>
              )}
            </div>

            {rsiAnalysis && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-white flex items-center justify-between">
                  <span>Relative Strength Index:</span>
                  <span className={rsiAnalysis.colorClass}>{rsiAnalysis.label}</span>
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  {rsiAnalysis.advice}
                </p>
              </div>
            )}

            {/* Closest Fibonacci Level */}
            {closestFib ? (
              <div className="pt-2 border-t border-slate-800 space-y-1 text-[11px]">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-400 font-sans">Nearest Fib Level:</span>
                  <span className="text-cyan-300 font-bold">
                    {closestFib.closest.name} (${closestFib.closest.value.toFixed(2)})
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-sans flex items-center justify-between">
                  <span>Strike Distance:</span>
                  <span className="font-mono text-slate-200">
                    {strike >= closestFib.closest.value ? `+$${(strike - closestFib.closest.value).toFixed(2)}` : `-$${(closestFib.closest.value - strike).toFixed(2)}`} (
                    {closestFib.closest.diffPct.toFixed(1)}%)
                  </span>
                </div>
              </div>
            ) : fiftyTwoWeekHigh && fiftyTwoWeekLow ? (
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>52W Range:</span>
                <span className="text-slate-200">${fiftyTwoWeekLow.toFixed(1)} – ${fiftyTwoWeekHigh.toFixed(1)}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
