import React, { useState } from "react";
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
  GraduationCap,
  Gauge,
  BarChart3,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  ChevronRight,
  Star,
  X,
  ShieldAlert,
  Landmark,
} from "lucide-react";
import { ActiveTab } from "./Header";
import { useAuth } from "../context/AuthContext";
import { SUPERADMIN_EMAIL } from "../lib/firebase";

interface SidebarNavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  watchlistCount: number;
  activeWatchlistName?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: ActiveTab;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
}

interface NavSection {
  id: string;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

export const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
  activeTab,
  setActiveTab,
  watchlistCount,
  activeWatchlistName,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}) => {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(
    user?.email && user.email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()
  );

  // Collapsible section state for sidebar
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const navSections: NavSection[] = [
    {
      id: "options",
      title: "Options Engine",
      icon: LineChart,
      items: [
        { id: "options-scanner", label: "Put Scanner", icon: LineChart, badge: "OCC TIMS", badgeColor: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
        { id: "put-recommendations", label: "Put Recommendations", icon: ShieldCheck, badge: "3 Tiers", badgeColor: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
        { id: "short-puts", label: "Short-Dated Puts", icon: Clock },
        { id: "premium-curves", label: "Premium Curves", icon: Search },
        { id: "option-chain", label: "Option Chain & Greeks", icon: Layers },
      ],
    },
    {
      id: "screeners",
      title: "Stock Screeners",
      icon: Activity,
      items: [
        { id: "stock-charts", label: "Stock Charts", icon: LineChart, badge: "50Y + 50 DMA", badgeColor: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
        { id: "canslim-screener", label: "CANSLIM Screener", icon: Sparkles, badge: "7-Pt O'Neil", badgeColor: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
        { id: "fall-detector", label: "Fall Detector", icon: TrendingDown, badge: "Context", badgeColor: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
        { id: "technicals", label: "Technicals Screener", icon: Activity },
      ],
    },
    {
      id: "macro",
      title: "Macro & Markets",
      icon: Globe,
      items: [
        { id: "macro-markets", label: "Macro Markets", icon: Landmark, badge: "BLS & SOFR", badgeColor: "bg-teal-500/15 text-teal-300 border-teal-500/30" },
        { id: "market-sentiment", label: "Market Sentiment", icon: Gauge, badge: "VIX & Fear/Greed", badgeColor: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
        { id: "nasdaq-simulator", label: "Nasdaq Simulator", icon: BarChart3, badge: "Backtest", badgeColor: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
      ],
    },
    {
      id: "research",
      title: "Earnings & Research",
      icon: FileSpreadsheet,
      items: [
        { id: "sec-earnings", label: "SEC Earnings (10-K/Q)", icon: FileSpreadsheet, badge: "EDGAR", badgeColor: "bg-slate-500/20 text-slate-300 border-slate-600/40" },
        { id: "earnings-transcripts", label: "Earnings Transcripts", icon: MessageSquareQuote, badge: "Alpha Vantage", badgeColor: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
        { id: "watchlist", label: "Watchlists", icon: BookmarkCheck, badge: activeWatchlistName || `${watchlistCount} Stocks`, badgeColor: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
        { id: "junior-academy", label: "Junior Academy", icon: GraduationCap, badge: "Age 11+", badgeColor: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
        ...(isSuperAdmin
          ? [
              {
                id: "access-audit" as ActiveTab,
                label: "Access Audit",
                icon: ShieldAlert,
                badge: "Admin",
                badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/40",
              },
            ]
          : []),
      ],
    },
  ];

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (isMobileOpen) {
      onCloseMobile();
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-200 select-none">
      {/* Top Header / Collapse toggle */}
      <div className="p-3 border-b border-slate-800/80 flex items-center justify-between gap-2 min-h-14">
        {!isCollapsed ? (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Navigation</span>
          </div>
        ) : null}

        <button
          onClick={onToggleCollapse}
          className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ${
            isCollapsed ? "mx-auto" : ""
          }`}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-4 h-4 text-cyan-400" />
          ) : (
            <PanelLeftClose className="w-4 h-4 text-slate-400" />
          )}
        </button>
      </div>

      {/* Quick Favorites Shelf */}
      {!isCollapsed && (
        <div className="px-3 pt-3 pb-2 border-b border-slate-800/50">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 mb-1.5 flex items-center gap-1.5">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span>Frequent Tools</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => handleSelectTab("options-scanner")}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition flex flex-col items-center justify-center gap-1 text-center cursor-pointer border ${
                activeTab === "options-scanner"
                  ? "bg-blue-600/30 text-blue-300 border-blue-500/50 shadow-sm"
                  : "bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-slate-700/50"
              }`}
              title="Put Scanner"
            >
              <LineChart className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="truncate w-full text-[10px]">Scanner</span>
            </button>

            <button
              onClick={() => handleSelectTab("stock-charts")}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition flex flex-col items-center justify-center gap-1 text-center cursor-pointer border ${
                activeTab === "stock-charts"
                  ? "bg-rose-600/30 text-rose-300 border-rose-500/50 shadow-sm"
                  : "bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-slate-700/50"
              }`}
              title="Stock Charts (50Y + 50 DMA)"
            >
              <Activity className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="truncate w-full text-[10px]">Charts</span>
            </button>

            <button
              onClick={() => handleSelectTab("macro-markets")}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition flex flex-col items-center justify-center gap-1 text-center cursor-pointer border ${
                activeTab === "macro-markets"
                  ? "bg-teal-600/30 text-teal-300 border-teal-500/50 shadow-sm"
                  : "bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-slate-700/50"
              }`}
              title="Macro Markets (BLS, SOFR)"
            >
              <Landmark className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span className="truncate w-full text-[10px]">Macro</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Navigation Scroll Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-4 custom-scrollbar">
        {navSections.map((section) => {
          const isSectionCollapsed = Boolean(collapsedSections[section.id]);
          const hasActiveItem = section.items.some((i) => i.id === activeTab);

          return (
            <div key={section.id} className="space-y-1">
              {/* Section Header */}
              {!isCollapsed ? (
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition cursor-pointer group"
                >
                  <span className="flex items-center gap-1.5">
                    {section.icon && (
                      <section.icon
                        className={`w-3.5 h-3.5 ${
                          hasActiveItem ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-300"
                        }`}
                      />
                    )}
                    <span>{section.title}</span>
                  </span>
                  {isSectionCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </button>
              ) : (
                <div className="h-px bg-slate-800 my-2 mx-1" />
              )}

              {/* Items List */}
              {(!isSectionCollapsed || isCollapsed) && (
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = activeTab === item.id;
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectTab(item.id)}
                        className={`w-full flex items-center rounded-xl text-xs font-medium transition-all cursor-pointer relative group ${
                          isCollapsed ? "justify-center p-2.5" : "px-3 py-2 justify-between"
                        } ${
                          isActive
                            ? "bg-gradient-to-r from-blue-600/30 to-cyan-500/20 text-white font-semibold border border-blue-500/40 shadow-sm shadow-blue-500/10"
                            : "text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent"
                        }`}
                        title={isCollapsed ? `${item.label}${item.badge ? ` (${item.badge})` : ""}` : undefined}
                      >
                        {/* Active glow indicator */}
                        {isActive && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-cyan-400 rounded-r-full shadow-sm shadow-cyan-400" />
                        )}

                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-transform ${
                              isActive
                                ? "text-cyan-400 scale-105"
                                : "text-slate-400 group-hover:text-slate-200"
                            }`}
                          />
                          {!isCollapsed && (
                            <span className="truncate text-left">{item.label}</span>
                          )}
                        </div>

                        {!isCollapsed && item.badge && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full border font-mono shrink-0 ml-1.5 ${
                              item.badgeColor || "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Footer Details */}
      {!isCollapsed && (
        <div className="p-3 border-t border-slate-800/80 text-[10px] text-slate-500 font-mono flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span>Terminal Layout</span>
            <span className="text-cyan-400">v2.4 Live</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden md:block transition-all duration-300 ease-in-out shrink-0 sticky top-16 h-[calc(100vh-4rem)] z-30 ${
          isCollapsed ? "w-16" : "w-64"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />

          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-slideRight">
            <button
              onClick={onCloseMobile}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white border border-slate-700 z-20"
              title="Close Navigation"
            >
              <X className="w-4 h-4" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
