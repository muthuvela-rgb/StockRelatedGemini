import React from "react";
import { TrendingUp, TrendingDown, Minus, DollarSign, Globe, Coins, Shield, Flame, Scale } from "lucide-react";
import { MacroQuote } from "../../types";

interface LiveAssetCardsProps {
  quotes: MacroQuote[];
  usdinrRate: number;
}

export const LiveAssetCards: React.FC<LiveAssetCardsProps> = ({ quotes, usdinrRate }) => {
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
      default:
        return "border-blue-500/30 hover:border-blue-500/60 bg-gradient-to-br from-blue-500/5 via-slate-900/60 to-slate-950";
    }
  };

  return (
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
                    <h4 className="text-xs font-semibold text-slate-200 leading-snug">{q.name}</h4>
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
  );
};
