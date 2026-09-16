import React from "react";
import { MacroResearchInsight } from "../../types";
import { BookOpen, TrendingUp, TrendingDown, ArrowRight, Gauge, Landmark, DollarSign, Activity } from "lucide-react";

interface MacroResearchPanelProps {
  insights: MacroResearchInsight[];
}

export const MacroResearchPanel: React.FC<MacroResearchPanelProps> = ({ insights }) => {
  const getBiasBadge = (bias: MacroResearchInsight["bias"]) => {
    switch (bias) {
      case "bullish":
        return {
          label: "Bullish Outlook",
          className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
        };
      case "bearish":
        return {
          label: "Bearish (Rising Yields / Inversion)",
          className: "bg-rose-500/15 text-rose-300 border-rose-500/30",
        };
      case "volatile":
        return {
          label: "High Volatility",
          className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
        };
      default:
        return {
          label: "Consolidation / Neutral",
          className: "bg-blue-500/15 text-blue-300 border-blue-500/30",
        };
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            Deep Research: Price Trends, Sentiment & Fed Policy Synthesis
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Qualitative and quantitative macro assessment across interest rate projections, social sentiment indices, and FOMC meeting dynamics.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {insights.map((ins, idx) => {
          const badge = getBiasBadge(ins.bias);

          return (
            <div
              key={idx}
              className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between space-y-3"
            >
              <div>
                {/* Topic Header & Bias Badge */}
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-xs font-semibold text-white leading-snug">{ins.topic}</h4>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>

                {/* Key Catalysts Checklist */}
                <div className="mt-2.5 space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Core Drivers & Structural Catalysts:
                  </span>
                  <ul className="space-y-1 text-xs text-slate-300">
                    {ins.keyCatalysts.map((cat, cIdx) => (
                      <li key={cIdx} className="flex items-start gap-1.5 text-[11px]">
                        <span className="text-emerald-400 font-bold mt-0.5">•</span>
                        <span>{cat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Fed Policy Impact */}
                <div className="mt-3 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300">
                  <div className="font-semibold text-slate-400 flex items-center gap-1 mb-1">
                    <Landmark className="w-3 h-3 text-blue-400" />
                    <span>Fed Interest Rate & Meeting Notes Impact:</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{ins.fedPolicyImpact}</p>
                </div>
              </div>

              {/* Bottom Footer: Forecast Range & Social Sentiment */}
              <div className="pt-2.5 border-t border-slate-800/80 flex flex-col gap-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Target Range / Corridor:</span>
                  <span className="font-mono font-semibold text-amber-300">{ins.forecastRange}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-purple-400" />
                    <span>Social Sentiment:</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-300 font-medium">{ins.socialSentiment.label}</span>
                    <span className="bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded font-mono font-bold text-[10px]">
                      {ins.socialSentiment.score}/100
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 italic mt-0.5">
                  Flow: {ins.socialSentiment.institutionalFlow}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
