import React from "react";
import {
  TrendingDown,
  LineChart,
  Layers,
  Activity,
  FileSpreadsheet,
  Clock,
  BookmarkCheck,
  Search,
  Sparkles,
  ShieldCheck
} from "lucide-react";

export type ActiveTab =
  | "put-recommendations"
  | "options-scanner"
  | "fall-detector"
  | "technicals"
  | "short-puts"
  | "option-chain"
  | "premium-curves"
  | "sec-earnings"
  | "watchlist";

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  watchlistCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  watchlistCount,
}) => {
  const tabs = [
    { id: "options-scanner" as ActiveTab, label: "Put Scanner", icon: LineChart, badge: "OCC TIMS" },
    { id: "fall-detector" as ActiveTab, label: "Fall Detector", icon: TrendingDown, badge: "Context" },
    { id: "technicals" as ActiveTab, label: "Technicals", icon: Activity },
    { id: "short-puts" as ActiveTab, label: "Short-Dated", icon: Clock },
    { id: "option-chain" as ActiveTab, label: "Option Chain & Greeks", icon: Layers },
    { id: "premium-curves" as ActiveTab, label: "Premium Curves", icon: Search },
    { id: "sec-earnings" as ActiveTab, label: "SEC Earnings", icon: FileSpreadsheet },
    { id: "watchlist" as ActiveTab, label: "Watchlist", icon: BookmarkCheck, count: watchlistCount },
    { id: "put-recommendations" as ActiveTab, label: "Put Recommendations", icon: ShieldCheck, badge: "3 Risk Tiers" },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/20">
              <LineChart className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white font-display tracking-tight">StockRelated</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                  Analytics & Tooling
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Options yield, fall detection, technicals & Black-Scholes Greeks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Yahoo & SEC Data
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/60">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/70"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    isActive ? "bg-blue-700/80 text-blue-100" : "bg-slate-800 text-slate-400 border border-slate-700"
                  }`}>
                    {tab.badge}
                  </span>
                )}
                {tab.count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isActive ? "bg-white text-blue-700" : "bg-slate-800 text-slate-300 border border-slate-700"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
