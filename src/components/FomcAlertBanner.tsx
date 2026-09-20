import React, { useState } from "react";
import {
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Landmark,
  EyeOff,
  FileText,
  Users,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { getFomcSchedule } from "../utils/fomcSchedule";

interface FomcAlertBannerProps {
  variant?: "banner" | "compact";
  className?: string;
  onNavigateTab?: (tab: any) => void;
}

export const FomcAlertBanner: React.FC<FomcAlertBannerProps> = ({
  variant = "banner",
  className = "",
  onNavigateTab,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const schedule = getFomcSchedule();
  const { nextMeeting, subsequentMeeting, upcomingMeetings, recentPastMeeting } = schedule;

  return (
    <div
      id="fomc-alert-banner"
      className={`rounded-2xl border transition-all bg-gradient-to-r from-slate-900 via-rose-950/30 to-slate-900 border-rose-500/30 shadow-xl shadow-rose-950/20 ${className}`}
    >
      {/* Primary Bar */}
      <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 border border-rose-500/30 text-rose-400 shrink-0 shadow-inner">
            <Landmark className="w-5 h-5 text-rose-400" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400 font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                Federal Reserve Monetary Policy Horizon
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {nextMeeting.title.includes("SEP") ? "FOMC + SEP Dot Plot" : "FOMC Rate Decision"}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {nextMeeting.daysRemaining} Days Countdown
              </span>
              {nextMeeting.isInBlackout && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold font-mono bg-red-500/30 text-red-200 border border-red-500/50 flex items-center gap-1">
                  <EyeOff className="w-3 h-3" />
                  Media Blackout Active
                </span>
              )}
            </div>

            <div className="text-sm sm:text-base font-bold text-white mt-1 leading-snug">
              Next FOMC Meeting:{" "}
              <span className="text-rose-300 font-mono underline decoration-rose-500/40 underline-offset-4">
                {nextMeeting.dateFormatted}
              </span>{" "}
              <span className="text-slate-400 text-xs font-normal">
                (Policy statement at <strong className="text-slate-200">2:00 PM ET</strong>; {nextMeeting.chairperson} Press Conf at <strong className="text-slate-200">2:30 PM ET</strong>)
              </span>
            </div>

            {/* Sub-line catalysts */}
            <div className="text-xs text-slate-300 mt-1.5 flex items-center gap-2 flex-wrap font-mono">
              <span className="text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" /> Milestones:
              </span>
              <span className="bg-slate-800/90 text-blue-300 px-2 py-0.5 rounded border border-slate-700 text-[11px]">
                Minutes: {nextMeeting.minutesReleaseDate ? "Oct 7, 2026" : "3 wks post"}
              </span>
              <span className="bg-slate-800/90 text-amber-300 px-2 py-0.5 rounded border border-slate-700 text-[11px]">
                Quiet Period: {nextMeeting.blackoutFormatted}
              </span>
              <span className="bg-slate-800/90 text-emerald-300 px-2 py-0.5 rounded border border-slate-700 text-[11px]">
                Following: {subsequentMeeting.dateFormatted} (Year-End SEP)
              </span>
            </div>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2.5 self-end md:self-center shrink-0">
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab("macro-markets")}
              className="px-3 py-1.5 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/40 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Fed Calendar & Yields</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
            title={isExpanded ? "Collapse FOMC Schedule Details" : "Expand FOMC Schedule Details"}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expandable Schedule & Policy Details */}
      {isExpanded && (
        <div className="border-t border-rose-900/40 p-4 sm:p-5 bg-slate-950/70 rounded-b-2xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Next Meeting Card */}
            <div className="bg-slate-900/80 border border-rose-500/30 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-400 font-mono uppercase">Next Rate Decision</span>
                <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded font-mono font-bold">
                  {nextMeeting.daysRemaining} days left
                </span>
              </div>
              <div className="text-sm font-semibold text-white">{nextMeeting.dateFormatted}</div>
              <p className="text-xs text-slate-400 leading-relaxed">{nextMeeting.description}</p>
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300 space-y-1 font-mono">
                <div>• Rate Announcement: 2:00 PM Eastern</div>
                <div>• Powell Press Conference: 2:30 PM Eastern</div>
                <div>• Location: Federal Reserve Board, Washington D.C.</div>
              </div>
            </div>

            {/* Media Blackout Window */}
            <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 font-mono uppercase flex items-center gap-1">
                  <EyeOff className="w-3.5 h-3.5" /> Media Blackout Window
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono font-bold">
                  {nextMeeting.daysUntilBlackout} days until quiet
                </span>
              </div>
              <div className="text-sm font-semibold text-white">{nextMeeting.blackoutFormatted}</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Mandatory quiet period in which Fed Governors and Regional Reserve Presidents refrain from public speeches or policy interviews.
              </p>
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300 space-y-1 font-mono">
                <div>• Quiet Starts: Saturday, Oct 17, 2026</div>
                <div>• Quiet Ends: Thursday, Oct 29, 2026</div>
                <div>• Options Impact: Lower headline official commentary volatility</div>
              </div>
            </div>

            {/* Subsequent Meeting & Dot Plot */}
            <div className="bg-slate-900/80 border border-indigo-500/30 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400 font-mono uppercase">Subsequent Meeting</span>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-mono font-bold">
                  Year-End Dot Plot
                </span>
              </div>
              <div className="text-sm font-semibold text-white">{subsequentMeeting.dateFormatted}</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Comprehensive annual closing policy meeting with full updated Summary of Economic Projections (SEP) Dot Plot for 2027–2028.
              </p>
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300 space-y-1 font-mono">
                <div>• Releases Updated Dot Plot Rate Path</div>
                <div>• Updated Real GDP & PCE Inflation Estimates</div>
                <div>• Terminal Rate Recalibration Guidance</div>
              </div>
            </div>
          </div>

          {/* Quick Schedule Row */}
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-slate-300">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Options Strategy Note:</strong> Implied Volatility (IV) on index ETFs (SPY, QQQ) typically rises going into FOMC decision days and crushes post-statement.
              </span>
            </div>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab("macro-markets")}
                className="text-rose-400 hover:text-rose-300 font-medium underline flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <span>View Full Fed Calendar</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
