import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Landmark,
  Calendar,
  Clock,
  ChevronDown,
  EyeOff,
  ArrowRight,
  X,
  ExternalLink,
  ShieldAlert,
  Layers,
  Sparkles,
} from "lucide-react";
import { getFomcSchedule } from "../utils/fomcSchedule";
import { getRebalanceSchedule } from "../utils/rebalanceSchedule";
import { ActiveTab } from "./Header";

interface MarketCatalystsBoxProps {
  onNavigateTab?: (tab: ActiveTab) => void;
  className?: string;
}

export const MarketCatalystsBox: React.FC<MarketCatalystsBoxProps> = ({
  onNavigateTab,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const fomcSchedule = useMemo(() => getFomcSchedule(), []);
  const rebalanceSchedule = useMemo(() => getRebalanceSchedule(), []);

  const { nextMeeting, subsequentMeeting } = fomcSchedule;
  const { nextRebalance } = rebalanceSchedule;

  // Format short readable dates: e.g. "Oct 27–28" & "Dec 18" with non-breaking spaces
  const fomcShortDate = useMemo(() => {
    try {
      const startParts = nextMeeting.startDate.split("-");
      const endParts = nextMeeting.endDate.split("-");
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthStr = monthNames[parseInt(startParts[1], 10) - 1];
      const startDay = parseInt(startParts[2], 10);
      const endDay = parseInt(endParts[2], 10);
      return `${monthStr}\u00A0${startDay}\u2013${endDay}`;
    } catch {
      return (nextMeeting.dateFormatted.split(",")[0] || "Oct 27–28").replace(/\s+/g, "\u00A0");
    }
  }, [nextMeeting]);

  const rebalanceShortDate = useMemo(() => {
    try {
      const parts = nextRebalance.executionDate.split("-");
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthStr = monthNames[parseInt(parts[1], 10) - 1];
      const day = parseInt(parts[2], 10);
      return `${monthStr}\u00A0${day}`;
    } catch {
      return (nextRebalance.executionFormatted.split(",")[0] || "Dec 18").replace(/\s+/g, "\u00A0");
    }
  }, [nextRebalance]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={boxRef} className={`relative inline-block ${className}`}>
      {/* Box Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900/90 hover:bg-slate-800/95 hover:border-slate-600 transition shadow-sm cursor-pointer select-none group focus:outline-none focus:ring-1 focus:ring-blue-500/50 whitespace-nowrap shrink-0"
        title="Click to view Federal Reserve FOMC & Next QQQ and SPY Rebalance schedule details"
        aria-label="View FOMC and Next QQQ and SPY Rebalance Schedule"
        aria-expanded={isOpen}
      >
        {/* FOMC Section */}
        <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
          </span>
          <span className="text-slate-300 font-semibold text-[11px] sm:text-xs whitespace-nowrap">FOMC:</span>
          <span className="text-rose-300 font-mono font-medium text-[11px] sm:text-xs whitespace-nowrap">
            {fomcShortDate}
          </span>
          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 hidden 2xl:inline-flex whitespace-nowrap shrink-0">
            {nextMeeting.daysRemaining}d
          </span>
        </div>

        {/* Divider */}
        <div className="h-3.5 w-px bg-slate-700/80 shrink-0" />

        {/* Next Rebalance Section */}
        <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
          <span className="text-slate-300 font-semibold text-[11px] sm:text-xs whitespace-nowrap">
            <span className="hidden sm:inline">Next </span>QQQ & SPY Rebalance:
          </span>
          <span className="text-indigo-300 font-mono font-medium text-[11px] sm:text-xs whitespace-nowrap">
            {rebalanceShortDate}
          </span>
          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hidden 2xl:inline-flex whitespace-nowrap shrink-0">
            {nextRebalance.daysUntilExecution}d
          </span>
        </div>

        {/* Chevron */}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition-transform duration-200 shrink-0 ml-0.5 ${
            isOpen ? "rotate-180 text-blue-400" : ""
          }`}
        />
      </button>

      {/* Popover Dropdown Card */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-slate-900/98 backdrop-blur-md border border-slate-700/90 rounded-xl shadow-2xl p-4 z-50 text-left ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-150"
          role="dialog"
          aria-label="Upcoming Macro Catalysts Details"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Key Market Catalysts
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Close popup"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="py-3 space-y-3.5">
            {/* FOMC Detail Box */}
            <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Landmark className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="text-xs font-bold text-rose-300 uppercase tracking-wide font-mono">
                    Federal Reserve FOMC
                  </span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {nextMeeting.daysRemaining} Days Countdown
                </span>
              </div>

              <div className="text-xs text-white font-medium">
                Next Rate Decision:{" "}
                <span className="text-rose-300 font-mono font-bold whitespace-nowrap">
                  {nextMeeting.dateFormatted}
                </span>
              </div>

              <div className="text-[11px] text-slate-300 space-y-1">
                <div className="flex items-center gap-1 text-slate-300">
                  <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="whitespace-nowrap">Statement at <strong>2:00 PM ET</strong>; Press Conf at <strong>2:30 PM ET</strong></span>
                </div>
                <div className="text-slate-400 text-[10px]">
                  Quiet Period (Blackout): <span className="font-mono text-slate-300 whitespace-nowrap">{nextMeeting.blackoutFormatted}</span>
                </div>
                <div className="text-slate-400 text-[10px]">
                  Following: <span className="text-slate-300 whitespace-nowrap">{subsequentMeeting.dateFormatted}</span> (Year-End SEP Dot Plot)
                </div>
              </div>

              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => {
                    onNavigateTab("macro-markets");
                    setIsOpen(false);
                  }}
                  className="w-full mt-1.5 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-semibold transition cursor-pointer"
                >
                  <span>Open Fed Calendar in Macro Markets</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Rebalance Detail Box */}
            <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-500/30 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-wide font-mono whitespace-nowrap">
                    Next QQQ & SPY Rebalance
                  </span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 whitespace-nowrap shrink-0">
                  {nextRebalance.daysUntilExecution} Days Countdown
                </span>
              </div>

              <div className="text-xs text-white font-medium">
                Next QQQ & SPY Rebalance:{" "}
                <span className="text-indigo-300 font-mono font-bold whitespace-nowrap">
                  {nextRebalance.executionFormatted}
                </span>{" "}
                <span className="text-slate-400 text-[10px] whitespace-nowrap">({nextRebalance.quarter})</span>
              </div>

              <div className="text-[11px] text-slate-300 space-y-1">
                <div>
                  Effective: <span className="font-mono text-slate-200">Monday, {nextRebalance.effectiveFormatted}</span> (Market Open)
                </div>
                <div className="text-slate-400 text-[10px]">
                  Announcement: <span className="font-mono text-slate-300">{nextRebalance.announcementFormatted}</span>
                </div>
                <div className="text-slate-400 text-[10px]">
                  Applies to: <span className="text-slate-200 font-mono">QQQ, SPY, Nasdaq-100 (NDX), S&P 100</span>
                </div>
              </div>

              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => {
                    onNavigateTab("nasdaq-simulator");
                    setIsOpen(false);
                  }}
                  className="w-full mt-1.5 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold transition cursor-pointer"
                >
                  <span>Open Nasdaq-100 Simulator</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 text-center font-mono">
            Options IV typically rises pre-FOMC & during index rebalance settlement
          </div>
        </div>
      )}
    </div>
  );
};
