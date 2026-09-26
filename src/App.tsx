import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Header, ActiveTab } from "./components/Header";
import { PutRecommendationsViewer } from "./components/PutRecommendationsViewer";
import { PutScanner } from "./components/PutScanner";
import { FallDetector } from "./components/FallDetector";
import { TechnicalsScreener } from "./components/TechnicalsScreener";
import { ShortDatedScreener } from "./components/ShortDatedScreener";
import { OptionChainViewer } from "./components/OptionChainViewer";
import { PremiumCurvesViewer } from "./components/PremiumCurvesViewer";
import { SecEarningsViewer } from "./components/SecEarningsViewer";
import { EarningsTranscriptsViewer } from "./components/EarningsTranscriptsViewer";
import { WatchlistManager } from "./components/WatchlistManager";
import { SavedTradesModal } from "./components/SavedTradesModal";
import { UserGuideModal } from "./components/UserGuideModal";
import { LoginPortal } from "./components/LoginPortal";
import { AccessAuditViewer } from "./components/AccessAuditViewer";
import { JuniorInvestorAcademy } from "./components/JuniorInvestorAcademy";
import { MarketSentiment } from "./components/MarketSentiment";
import { NasdaqSimulator } from "./components/NasdaqSimulator";
import { MacroDashboard } from "./components/macro/MacroDashboard";
import { StockChartsViewer } from "./components/StockChartsViewer";
import { TickerHudProvider } from "./context/TickerHudContext";
import { BollingerFilterProvider } from "./context/BollingerFilterContext";
import { LineChart, BookOpen } from "lucide-react";

// Fallback default tickers, used only until AuthContext's watchlists have hydrated.
const DEFAULT_WATCHLIST_TICKERS = [
  "NVDA", "QQQ", "ALAB", "MU", "NBIS", "SNDK", "SKHY", "SPCX", "TSLA", "META", "CRWV", "SNOW", "TQQQ", "RKLB", "CRDO"
];

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("options-scanner");
  const [isSavedTradesOpen, setIsSavedTradesOpen] = useState<boolean>(false);
  const [isUserGuideOpen, setIsUserGuideOpen] = useState<boolean>(false);
  const [customTickerForRecs, setCustomTickerForRecs] = useState<string | undefined>(undefined);

  const {
    user,
    loading,
    watchlists,
    activeWatchlistIndex,
    setActiveWatchlistIndex,
    createWatchlist,
    deleteWatchlistAtIndex,
    updateWatchlistAtIndex,
    renameWatchlistAtIndex,
    syncCloudWatchlists,
    loadCloudWatchlists,
  } = useAuth();

  const activeWatchlist = watchlists[activeWatchlistIndex] || watchlists[0] || {
    id: "wl-1",
    name: "Watchlist 1",
    tickers: DEFAULT_WATCHLIST_TICKERS,
  };

  const currentWatchlist = activeWatchlist.tickers && activeWatchlist.tickers.length > 0
    ? activeWatchlist.tickers
    : DEFAULT_WATCHLIST_TICKERS;

  // Sync active watchlist tickers to backend server whenever active list or selection changes
  useEffect(() => {
    if (currentWatchlist && currentWatchlist.length > 0) {
      fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: currentWatchlist }),
      }).catch((err) => console.error("Error syncing active watchlist to server:", err));
    }
  }, [activeWatchlistIndex, currentWatchlist]);

  const handleSelectTickerFromModal = (ticker: string) => {
    setCustomTickerForRecs(ticker);
    setActiveTab("put-recommendations");
  };

  const handleNavigateTabWithTicker = (tab: ActiveTab, ticker?: string) => {
    if (ticker) {
      if (tab === "put-recommendations") {
        setCustomTickerForRecs(ticker);
      }
    }
    setActiveTab(tab);
  };

  // Session state indicator while initializing
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-xl shadow-blue-500/25 ring-1 ring-white/20 animate-pulse">
            <LineChart className="w-7 h-7 text-white" />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            <span>Loading StockRelated Analytics...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TickerHudProvider onNavigateTab={handleNavigateTabWithTicker}>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        watchlistCount={currentWatchlist.length}
        activeWatchlistName={activeWatchlist.name}
        onOpenSavedTrades={() => setIsSavedTradesOpen(true)}
        onOpenUserGuide={() => setIsUserGuideOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "put-recommendations" && (
          <PutRecommendationsViewer
            watchlist={currentWatchlist}
            initialCustomTicker={customTickerForRecs}
            onNavigateTab={setActiveTab}
          />
        )}
        {activeTab === "nasdaq-simulator" && (
          <NasdaqSimulator />
        )}
        {activeTab === "macro-markets" && (
          <MacroDashboard />
        )}
        {activeTab === "options-scanner" && (
          <PutScanner watchlist={currentWatchlist} />
        )}
        {activeTab === "market-sentiment" && (
          <MarketSentiment onNavigateTab={setActiveTab} />
        )}
        {activeTab === "fall-detector" && (
          <FallDetector watchlist={currentWatchlist} />
        )}
        {activeTab === "stock-charts" && (
          <StockChartsViewer watchlist={currentWatchlist} />
        )}
        {activeTab === "technicals" && (
          <TechnicalsScreener watchlist={currentWatchlist} />
        )}
        {activeTab === "short-puts" && (
          <ShortDatedScreener watchlist={currentWatchlist} />
        )}
        {activeTab === "option-chain" && (
          <OptionChainViewer watchlist={currentWatchlist} />
        )}
        {activeTab === "premium-curves" && (
          <PremiumCurvesViewer />
        )}
        {activeTab === "sec-earnings" && (
          <SecEarningsViewer watchlist={currentWatchlist} />
        )}
        {activeTab === "earnings-transcripts" && (
          <EarningsTranscriptsViewer watchlist={currentWatchlist} />
        )}
        {activeTab === "watchlist" && (
          <WatchlistManager
            watchlist={currentWatchlist}
            watchlists={watchlists}
            activeWatchlistIndex={activeWatchlistIndex}
            onSelectWatchlistIndex={setActiveWatchlistIndex}
            onCreateWatchlist={createWatchlist}
            onDeleteWatchlistAtIndex={deleteWatchlistAtIndex}
            onUpdateWatchlistAtIndex={updateWatchlistAtIndex}
            onRenameWatchlistAtIndex={renameWatchlistAtIndex}
            onSyncCloudWatchlists={syncCloudWatchlists}
            onOpenSavedTrades={() => setIsSavedTradesOpen(true)}
          />
        )}
        {activeTab === "access-audit" && (
          <AccessAuditViewer />
        )}
        {activeTab === "junior-academy" && (
          <JuniorInvestorAcademy />
        )}
      </main>

      {/* Cloud Firestore Saved Trades Modal */}
      <SavedTradesModal
        isOpen={isSavedTradesOpen}
        onClose={() => setIsSavedTradesOpen(false)}
        onSelectTicker={handleSelectTickerFromModal}
      />

      {/* Comprehensive User Guide & Tab Documentation Modal */}
      <UserGuideModal
        isOpen={isUserGuideOpen}
        onClose={() => setIsUserGuideOpen(false)}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          setIsUserGuideOpen(false);
        }}
      />

      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span>StockRelated • Quantitative Options & Technical Analysis Suite</span>
            <button
              onClick={() => setIsUserGuideOpen(true)}
              className="text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer flex items-center gap-1"
            >
              <BookOpen className="w-3 h-3" />
              <span>User Guide & Reference</span>
            </button>
          </div>
          <span className="text-[11px] text-slate-500">
            Firebase Auth & Firestore Persistent Storage • OCC TIMS • SEC EDGAR XBRL
          </span>
        </div>
      </footer>
    </div>
    </TickerHudProvider>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BollingerFilterProvider>
        <AppContent />
      </BollingerFilterProvider>
    </AuthProvider>
  );
};

export default App;

