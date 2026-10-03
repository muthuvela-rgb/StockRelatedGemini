import React, { useState } from "react";
import { TrendingUp, TrendingDown, Minus, DollarSign, Globe, Coins, Shield, Flame, Scale, Landmark, Home, HelpCircle, X } from "lucide-react";
import { MacroQuote } from "../../types";

interface LiveAssetCardsProps {
  quotes: MacroQuote[];
  usdinrRate: number;
}

export const LiveAssetCards: React.FC<LiveAssetCardsProps> = ({ quotes, usdinrRate }) => {
  const [showSofrModal, setShowSofrModal] = useState(false);

  const getCategoryIcon = (category: string, id: string) => {
    switch (id) {
      case "gold":
        return <Coins className="w-4 h-4 text-amber-400" />;
      case "silver":
        return <Scale className="w-4 h-4 text-slate-300" />;
      case "bitcoin":
        return <Coins className="w-4 h-4 text-orange-400" />;
      case "crude-oil":
        return <Flame className="w-4 h-4 text-rose-400" />;
      case "usdinr":
        return <Globe className="w-4 h-4 text-emerald-400" />;
      case "us10y":
        return <Landmark className="w-4 h-4 text-sky-400" />;
      case "sofr":
        return <Landmark className="w-4 h-4 text-teal-400" />;
      default:
        return <Shield className="w-4 h-4 text-blue-400" />;
    }
  };

  const getAccentBorder = (id: string) => {
    switch (id) {
      case "gold":
        return "border-amber-500/30 hover:border-amber-500/60 bg-gradient-to-br from-amber-500/5 via-slate-900/60 to-slate-950";
      case "silver":
        return "border-slate-500/30 hover:border-slate-400/60 bg-gradient-to-br from-slate-500/5 via-slate-900/60 to-slate-950";
      case "bitcoin":
        return "border-orange-500/30 hover:border-orange-500/60 bg-gradient-to-br from-orange-500/5 via-slate-900/60 to-slate-950";
      case "crude-oil":
        return "border-rose-500/30 hover:border-rose-500/60 bg-gradient-to-br from-rose-500/5 via-slate-900/60 to-slate-950";
      case "usdinr":
        return "border-emerald-500/30 hover:border-emerald-500/60 bg-gradient-to-br from-emerald-500/5 via-slate-900/60 to-slate-950";
      case "us10y":
        return "border-sky-500/40 hover:border-sky-500/70 bg-gradient-to-br from-sky-500/10 via-slate-900/70 to-slate-950 ring-1 ring-sky-500/20";
      case "sofr":
        return "border-teal-500/40 hover:border-teal-500/70 bg-gradient-to-br from-teal-500/10 via-slate-900/70 to-slate-950 ring-1 ring-teal-500/20";
      default:
        return "border-blue-500/30 hover:border-blue-500/60 bg-gradient-to-br from-blue-500/5 via-slate-900/60 to-slate-950";
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {quotes.map((q) => {
          const isPos = q.changePct > 0;
          const isNeg = q.changePct < 0;

          return (
            <div
              key={q.id}
              className={`p-4 rounded-xl border transition-all duration-200 shadow-sm flex flex-col justify-between ${getAccentBorder(
                q.id
              )}`}
            >
              <div>
                {/* Header: Title, Category & Symbol */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
                      {getCategoryIcon(q.category, q.id)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-semibold text-slate-200 leading-snug">{q.name}</h4>
                        {q.id === "sofr" && (
                          <button
                            type="button"
                            onClick={() => setShowSofrModal(true)}
                            className="px-1.5 py-0.5 rounded-full bg-teal-500/20 hover:bg-teal-500/35 border border-teal-500/40 text-teal-300 text-[10px] font-bold flex items-center gap-0.5 transition-all hover:scale-105 shadow-sm cursor-pointer"
                            title="What is SOFR? Click to learn how it is determined"
                          >
                            <HelpCircle className="w-3 h-3 text-teal-300" />
                            <span>?</span>
                          </button>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">{q.symbol}</span>
                    </div>
                  </div>

                  {/* 24h Change Pill */}
                  <div
                    className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium ${
                      isPos
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : isNeg
                        ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                        : "bg-slate-800 text-slate-400 border border-slate-700"
                    }`}
                  >
                    {isPos && <TrendingUp className="w-3 h-3" />}
                    {isNeg && <TrendingDown className="w-3 h-3" />}
                    {!isPos && !isNeg && <Minus className="w-3 h-3" />}
                    <span>{q.changePct > 0 ? `+${q.changePct.toFixed(2)}%` : `${q.changePct.toFixed(2)}%`}</span>
                  </div>
                </div>

                {/* Main USD / Native Display */}
                <div className="mt-3">
                  <div className="text-2xl font-bold font-mono text-white tracking-tight">
                    {q.usdValueFormatted}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{q.unit}</div>
                </div>

                {/* Mortgage Benchmark Highlight (10Y Treasury -> 30Y Fixed & SOFR -> ARM) */}
                {q.mortgageBenchmark && (
                  <div
                    className={`mt-3 p-2.5 rounded-lg border text-xs flex flex-col gap-1.5 ${
                      q.mortgageType === "fixed"
                        ? "bg-sky-500/10 border-sky-500/30 text-sky-200"
                        : "bg-teal-500/10 border-teal-500/30 text-teal-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold">
                        <Home
                          className={`w-3.5 h-3.5 shrink-0 ${
                            q.mortgageType === "fixed" ? "text-sky-400" : "text-teal-400"
                          }`}
                        />
                        <span>{q.mortgageBenchmark}</span>
                      </span>
                      {q.mortgageEstRate && (
                        <span className="font-mono font-bold text-white px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700/80 text-[11px]">
                          Est: {q.mortgageEstRate}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-300 flex items-center justify-between pt-1 border-t border-slate-700/40">
                      <span className="text-slate-400">Spread / Margin:</span>
                      <span className="font-mono font-semibold text-amber-300">
                        {q.mortgageSpread}
                      </span>
                    </div>
                  </div>
                )}

                {/* Dual Rupee (INR) Value Conversion Display */}
                {q.inrValueFormatted && (
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                        <span>Rupee Value:</span>
                      </span>
                      <span className="font-mono font-semibold text-amber-300/90 text-sm">
                        {q.inrValueFormatted}
                      </span>
                    </div>

                    {q.inrPerGramFormatted && (
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
                        <span>Rate breakdown:</span>
                        <span className="font-mono text-slate-300 font-medium">{q.inrPerGramFormatted}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sparkline mini-bar representation or explanatory note */}
              <div className="mt-3 pt-2 border-t border-slate-800/40 text-[10px] text-slate-400 line-clamp-1">
                {q.notes}
              </div>
            </div>
          );
        })}
      </div>

      {/* SOFR Explanation Modal */}
      {showSofrModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowSofrModal(false)}
        >
          <div
            className="bg-slate-900 border border-teal-500/40 rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-300">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    What is SOFR?
                  </h3>
                  <span className="text-xs text-teal-400 font-medium">
                    Secured Overnight Financing Rate • Federal Reserve Bank of New York
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowSofrModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/25 text-teal-200 font-medium">
                The Federal Reserve Bank of New York publishes it — but nobody "sets" it the way the Fed sets its policy rate.
              </div>

              <p>
                <strong className="text-white">SOFR is a market-measured rate:</strong> each business morning, the New York Fed takes the previous day's actual overnight Treasury repo transactions (banks lending cash against Treasury collateral — data from BNY Mellon and FICC), computes the volume-weighted median, and publishes it around 8am ET.
              </p>

              <p>
                So it's determined by real borrowing activity in the repo market, with the NY Fed acting as the calculator and publisher. The group that chose SOFR as LIBOR's replacement was the <strong className="text-white">ARRC (Alternative Reference Rates Committee)</strong>, but they picked the benchmark — they don't move the number day to day.
              </p>

              <div className="mt-3 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-amber-400" />
                  <span>How it Determines ARM Mortgage Rates:</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  SOFR is the primary reference index used across the U.S. for Adjustable-Rate Mortgages (5/1, 7/1, and 10/1 ARMs). When the initial fixed-rate period ends, the borrower's adjustable interest rate resets based on the formula:
                </p>
                <div className="font-mono text-xs text-emerald-400 font-bold bg-slate-900 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                  <span>ARM Mortgage Rate</span>
                  <span>= SOFR + ~2.75% Margin</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowSofrModal(false)}
                className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
