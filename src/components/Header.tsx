import React, { useRef, useState, useEffect } from "react";
import {
  TrendingDown,
  LineChart,
  Layers,
  Activity,
  FileSpreadsheet,
  MessageSquareQuote,
  Clock,
  BookmarkCheck,
  Search,
  Sparkles,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  GraduationCap
} from "lucide-react";

import { UserAuthButton } from "./UserAuthButton";
import { useAuth } from "../context/AuthContext";
import { SUPERADMIN_EMAIL } from "../lib/firebase";

export type ActiveTab =
  | "put-recommendations"
  | "options-scanner"
  | "fall-detector"
  | "technicals"
  | "short-puts"
  | "option-chain"
  | "premium-curves"
  | "sec-earnings"
  | "earnings-transcripts"
  | "watchlist"
  | "junior-academy"
  | "access-audit";

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  watchlistCount: number;
  onOpenSavedTrades?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  watchlistCount,
  onOpenSavedTrades,
}) => {
  const { user } = useAuth();
  const navRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const isSuperAdmin = Boolean(
    user?.email && user.email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()
  );

  const baseTabs = [
    { id: "options-scanner" as ActiveTab, label: "Put Scanner", icon: LineChart, badge: "OCC TIMS" },
    { id: "put-recommendations" as ActiveTab, label: "Put Recommendations", icon: ShieldCheck, badge: "3 Risk Tiers" },
    { id: "fall-detector" as ActiveTab, label: "Fall Detector", icon: TrendingDown, badge: "Context" },
    { id: "technicals" as ActiveTab, label: "Technicals", icon: Activity },
    { id: "short-puts" as ActiveTab, label: "Short-Dated", icon: Clock },
    { id: "option-chain" as ActiveTab, label: "Option Chain & Greeks", icon: Layers },
    { id: "premium-curves" as ActiveTab, label: "Premium Curves", icon: Search },
    { id: "sec-earnings" as ActiveTab, label: "SEC Earnings", icon: FileSpreadsheet },
    { id: "earnings-transcripts" as ActiveTab, label: "Earnings Transcripts", icon: MessageSquareQuote, badge: "Alpha Vantage" },
    { id: "watchlist" as ActiveTab, label: "Watchlist", icon: BookmarkCheck, count: watchlistCount },
    { id: "junior-academy" as ActiveTab, label: "Junior Academy", icon: GraduationCap, badge: "Age 11+" },
  ];

  // The Access Audit tab is ONLY visible to muthu.vela@gmail.com
  const tabs = isSuperAdmin
    ? [
        ...baseTabs,
        {
          id: "access-audit" as ActiveTab,
          label: "Access Audit",
          icon: ShieldCheck,
          badge: "Admin",
        },
      ]
    : baseTabs;

  const checkScroll = () => {
    if (!navRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = navRef.current;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, []);

  useEffect(() => {
    // Scroll active tab into view
    const activeEl = document.getElementById(`tab-${activeTab}`);
    if (activeEl && navRef.current) {
      activeEl.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
      setTimeout(checkScroll, 300);
    }
  }, [activeTab]);

  const scrollBy = (offset: number) => {
    if (navRef.current) {
      navRef.current.scrollBy({ left: offset, behavior: "smooth" });
      setTimeout(checkScroll, 200);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (navRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      navRef.current.scrollLeft += e.deltaY;
      checkScroll();
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur-md sticky top-0 z-40 shadow-lg">
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

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Yahoo & SEC Data
            </span>
            <UserAuthButton
              watchlistCount={watchlistCount}
              onOpenSavedTrades={onOpenSavedTrades}
            />
          </div>
        </div>

        {/* Navigation Tabs with Desktop & Mobile Scroll Controls */}
        <div className="relative border-t border-slate-800/60 py-1.5 flex items-center">
          {/* Scroll Left Button */}
          {canScrollLeft && (
            <button
              onClick={() => scrollBy(-200)}
              title="Scroll left"
              className="absolute left-0 z-10 p-1.5 rounded-lg bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80 shadow-md backdrop-blur-sm transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          <div
            ref={navRef}
            onScroll={checkScroll}
            onWheel={handleWheel}
            className="flex items-center space-x-1.5 overflow-x-auto scroll-smooth py-1 w-full px-1 scrollbar-thin scrollbar-thumb-slate-700 hover:scrollbar-thumb-slate-600 scrollbar-track-transparent"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer select-none ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400/40"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/80"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
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

          {/* Scroll Right Button */}
          {canScrollRight && (
            <button
              onClick={() => scrollBy(200)}
              title="Scroll right"
              className="absolute right-0 z-10 p-1.5 rounded-lg bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80 shadow-md backdrop-blur-sm transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
