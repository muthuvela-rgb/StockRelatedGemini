import React, { useState } from "react";
import {
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ExternalLink,
  Layers,
  Sparkles,
  Info,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { getRebalanceSchedule } from "../utils/rebalanceSchedule";

interface RebalancingAlertBannerProps {
  variant?: "banner" | "chart-header" | "compact";
  className?: string;
  onNavigateTab?: (tab: any) => void;
}

export const RebalancingAlertBanner: React.FC<RebalancingAlertBannerProps> = ({
  variant = "banner",
  className = "",
  onNavigateTab,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const schedule = getRebalanceSchedule();

  const { nextRebalance, qqq, spy, nasdaq100, sp100, upcomingQuarters } = schedule;

  return (
    <div
      id="rebalancing-alert-banner"
      className={`rounded-2xl border transition-all ${
        variant === "chart-header"
          ? "bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-indigo-500/40 shadow-lg shadow-indigo-950/20"
          : "bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900 border-blue-500/40 shadow-xl shadow-blue-950/30"
      } ${className}`}
    >
      {/* Primary Prominent Header Bar */}
      <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-indigo-500/30 text-indigo-400 shrink-0 shadow-inner">
            <Calendar className="w-5 h-5 text-indigo-400" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                Next QQQ & SPY Rebalance Radar
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 whitespace-nowrap">
                {nextRebalance.quarter}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                {nextRebalance.daysUntilExecution} Days Countdown
              </span>
            </div>

            <div className="text-sm sm:text-base font-bold text-white mt-1 leading-snug">
              Next QQQ & SPY Rebalance Date:{" "}
              <span className="text-indigo-300 font-mono whitespace-nowrap">{nextRebalance.executionFormatted}</span>{" "}
              <span className="text-slate-400 text-xs font-normal">
                (Effective Monday, <strong className="text-slate-200">{nextRebalance.effectiveFormatted}</strong> at open)
              </span>
            </div>

            {/* Quick summary line of instruments */}
            <div className="text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap font-mono">
              <span className="text-slate-400">Applies to:</span>
              <span className="bg-slate-800/90 text-blue-300 px-2 py-0.5 rounded border border-slate-700">
                QQQ ETF
              </span>
              <span className="bg-slate-800/90 text-amber-300 px-2 py-0.5 rounded border border-slate-700">
                SPY ETF
              </span>
              <span className="bg-slate-800/90 text-emerald-300 px-2 py-0.5 rounded border border-slate-700">
                Nasdaq-100 (NDX) Index
              </span>
              <span className="bg-slate-800/90 text-purple-300 px-2 py-0.5 rounded border border-slate-700">
                S&P 100 (OEX) Index
              </span>
            </div>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2.5 self-end md:self-center shrink-0">
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab("stock-charts")}
              className="px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>View Stock Charts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <span>{isExpanded ? "Hide Rebalance Details" : "Inspect Next Dates & Capping Rules"}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Comprehensive Breakdown */}
      {isExpanded && (
        <div className="border-t border-slate-800/80 bg-slate-950/60 p-4 sm:p-6 space-y-6">
          {/* 4 Dedicated Cards: QQQ ETF, SPY ETF, Nasdaq-100, S&P 100 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. QQQ ETF */}
            <div className="bg-slate-900/90 border border-blue-500/30 rounded-xl p-4 shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                    {qqq.symbol} ETF
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">{qqq.daysRemaining} days away</span>
                </div>
                <h4 className="text-sm font-bold text-white mt-2">{qqq.name}</h4>
                <div className="text-[11px] text-slate-400 mt-0.5">Tracks: {qqq.tracks}</div>

                <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Rebalance Date:</span>
                    <span className="text-white font-bold">{qqq.nextRebalanceDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Effective Open:</span>
                    <span className="text-blue-300 font-bold">{qqq.effectiveDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Rebalance Type:</span>
                    <span className="text-slate-200 text-[11px] font-sans">{qqq.type}</span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-800/60 leading-relaxed font-sans">
                {qqq.description}
              </p>
            </div>

            {/* 2. SPY ETF */}
            <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-4 shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {spy.symbol} ETF
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">{spy.daysRemaining} days away</span>
                </div>
                <h4 className="text-sm font-bold text-white mt-2">{spy.name}</h4>
                <div className="text-[11px] text-slate-400 mt-0.5">Tracks: {spy.tracks}</div>

                <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Rebalance Date:</span>
                    <span className="text-white font-bold">{spy.nextRebalanceDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Effective Open:</span>
                    <span className="text-amber-300 font-bold">{spy.effectiveDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Rebalance Type:</span>
                    <span className="text-slate-200 text-[11px] font-sans">{spy.type}</span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-800/60 leading-relaxed font-sans">
                {spy.description}
              </p>
            </div>

            {/* 3. Nasdaq-100 Index (NDX) */}
            <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-4 shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {nasdaq100.symbol} Index
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">
                    {nextRebalance.isAnnualReconstitution ? "Annual Reconstitution" : "Quarterly"}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white mt-2">{nasdaq100.indexName}</h4>
                <div className="text-[11px] text-slate-400 mt-0.5">Underlying Index Benchmark</div>

                <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Announcement:</span>
                    <span className="text-amber-300 font-bold">{nasdaq100.announcementDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Execution Close:</span>
                    <span className="text-white font-bold">{nasdaq100.nextRebalanceDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Effective Open:</span>
                    <span className="text-emerald-300 font-bold">{nasdaq100.effectiveDate}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800/60 space-y-1">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Capping Rules</div>
                <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  {nasdaq100.cappingRules}
                </p>
              </div>
            </div>

            {/* 4. S&P 100 Index (OEX) */}
            <div className="bg-slate-900/90 border border-purple-500/30 rounded-xl p-4 shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                    {sp100.symbol} Index
                  </span>
                  <span className="text-[10px] text-purple-400 font-mono font-bold">Quarterly Rebalance</span>
                </div>
                <h4 className="text-sm font-bold text-white mt-2">{sp100.indexName}</h4>
                <div className="text-[11px] text-slate-400 mt-0.5">S&P Mega-Cap 100 Index</div>

                <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Announcement:</span>
                    <span className="text-amber-300 font-bold">{sp100.announcementDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Execution Close:</span>
                    <span className="text-white font-bold">{sp100.nextRebalanceDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Effective Open:</span>
                    <span className="text-purple-300 font-bold">{sp100.effectiveDate}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800/60 space-y-1">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Capping Rules</div>
                <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  {sp100.cappingRules}
                </p>
              </div>
            </div>
          </div>

          {/* Upcoming 4-Quarter Calendar Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Upcoming Rebalancing Calendar (2026 – 2027)
              </h5>
              <span className="text-[11px] text-slate-400 font-mono">Quarterly on 3rd Friday of Mar, Jun, Sep, Dec</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-slate-800 text-slate-400 font-semibold">
                  <tr>
                    <th className="py-2 px-3">Quarter</th>
                    <th className="py-2 px-3">Announcement Date</th>
                    <th className="py-2 px-3">Execution Date (3rd Friday)</th>
                    <th className="py-2 px-3">Effective Date (Monday)</th>
                    <th className="py-2 px-3">Scope</th>
                    <th className="py-2 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {upcomingQuarters.map((ev, i) => (
                    <tr
                      key={ev.quarter}
                      className={i === 0 ? "bg-indigo-950/20 text-white font-semibold" : "text-slate-300 hover:bg-slate-800/40"}
                    >
                      <td className="py-2.5 px-3 flex items-center gap-2">
                        {i === 0 && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
                        <span>{ev.quarter}</span>
                      </td>
                      <td className="py-2.5 px-3 text-amber-300/90">{ev.announcementFormatted}</td>
                      <td className="py-2.5 px-3 font-bold text-white">{ev.executionFormatted}</td>
                      <td className="py-2.5 px-3 text-indigo-300">{ev.effectiveFormatted}</td>
                      <td className="py-2.5 px-3 font-sans text-xs">
                        {ev.isAnnualReconstitution ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-mono">
                            Annual Reconstitution + Quarterly
                          </span>
                        ) : (
                          <span className="text-slate-400">Quarterly Rebalance</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {i === 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 text-[11px]">
                            Next Up ({ev.daysUntilExecution}d)
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">{ev.daysUntilExecution}d</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
