import React, { useState } from "react";
import { FedEvent } from "../../types";
import { Calendar, AlertCircle, Clock, MapPin, Mic, FileText, Users, EyeOff } from "lucide-react";

interface FedCalendarTableProps {
  events: FedEvent[];
}

export const FedCalendarTable: React.FC<FedCalendarTableProps> = ({ events }) => {
  const [filter, setFilter] = useState<string>("all");

  const filteredEvents = events.filter((e) => {
    if (filter === "meetings") return e.type === "meeting";
    if (filter === "speeches") return e.type === "speech" || e.type === "conference";
    if (filter === "minutes") return e.type === "minutes";
    return true;
  });

  const getTypeBadge = (type: FedEvent["type"]) => {
    switch (type) {
      case "meeting":
        return {
          label: "FOMC Rate Decision",
          icon: Users,
          className: "bg-rose-500/20 text-rose-300 border-rose-500/40",
        };
      case "minutes":
        return {
          label: "Meeting Minutes",
          icon: FileText,
          className: "bg-blue-500/20 text-blue-300 border-blue-500/40",
        };
      case "speech":
      case "conference":
        return {
          label: "Speech / Keynote",
          icon: Mic,
          className: "bg-purple-500/20 text-purple-300 border-purple-500/40",
        };
      case "blackout":
        return {
          label: "Media Blackout",
          icon: EyeOff,
          className: "bg-amber-500/20 text-amber-300 border-amber-500/40",
        };
      default:
        return {
          label: "Event",
          icon: Clock,
          className: "bg-slate-800 text-slate-300 border-slate-700",
        };
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-rose-400" />
            Federal Reserve Schedule & Governor Appearances (Next 2–3 Months)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Confirmed FOMC interest rate decisions, minutes publication, Governor speaking engagements, and quiet periods.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setFilter("all")}
            className={`px-2.5 py-1 rounded-md font-medium transition ${
              filter === "all" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All Events
          </button>
          <button
            onClick={() => setFilter("meetings")}
            className={`px-2.5 py-1 rounded-md font-medium transition ${
              filter === "meetings" ? "bg-rose-500/20 text-rose-300 border border-rose-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            FOMC Meetings
          </button>
          <button
            onClick={() => setFilter("speeches")}
            className={`px-2.5 py-1 rounded-md font-medium transition ${
              filter === "speeches" ? "bg-purple-500/20 text-purple-300 border border-purple-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Speeches
          </button>
          <button
            onClick={() => setFilter("minutes")}
            className={`px-2.5 py-1 rounded-md font-medium transition ${
              filter === "minutes" ? "bg-blue-500/20 text-blue-300 border border-blue-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Minutes
          </button>
        </div>
      </div>

      {/* Events Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3 px-4">Date / Window</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Event Title & Agenda</th>
              <th className="py-3 px-4">Official / Speaker</th>
              <th className="py-3 px-4">Market Impact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
            {filteredEvents.map((evt) => {
              const badge = getTypeBadge(evt.type);
              const BadgeIcon = badge.icon;

              return (
                <tr key={evt.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-200 font-medium">
                    {evt.date}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.className}`}
                    >
                      <BadgeIcon className="w-3 h-3" />
                      <span>{badge.label}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{evt.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                      {evt.description}
                    </div>
                    {evt.topics && evt.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {evt.topics.map((t, idx) => (
                          <span
                            key={idx}
                            className="bg-slate-950 text-slate-400 text-[10px] px-1.5 py-0.2 rounded border border-slate-800 font-mono"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="font-medium text-slate-200">{evt.official}</div>
                    {evt.location && (
                      <div className="text-[10px] text-slate-500 flex items-center gap-0.5 mt-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        <span>{evt.location}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        evt.impactLevel === "high"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : evt.impactLevel === "medium"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {evt.impactLevel} Impact
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
