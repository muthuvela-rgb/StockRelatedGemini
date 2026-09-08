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
import { LoginPortal } from "./components/LoginPortal";
import { AccessAuditViewer } from "./components/AccessAuditViewer";
import { JuniorInvestorAcademy } from "./components/JuniorInvestorAcademy";
import { LineChart } from "lucide-react";

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("options-scanner");
  const [watchlist, setWatchlist] = useState<string[]>([
    "NVDA", "QQQ", "ALAB", "MU", "NBIS", "SNDK", "SKHY", "SPCX", "TSLA", "META", "CRWV", "SNOW", "TQQQ", "RKLB", "CRDO"
  ]);
  const [isSavedTradesOpen, setIsSavedTradesOpen] = useState<boolean>(false);

  const { user, loading, syncCloudWatchlist, loadCloudWatchlist } = useAuth();

  // Initial load synchronization:
  // 1. First check user's Firestore cloud watchlist
  // 2. If present, load it and sync to backend server /api/watchlist
  // 3. If no cloud watchlist exists yet, fetch server /api/watchlist and seed cloud
  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    async function initializeWatchlist() {
      try {
        const cloudList = await loadCloudWatchlist();
        if (!isMounted) return;

        if (cloudList && Array.isArray(cloudList) && cloudList.length > 0) {
          setWatchlist(cloudList);
          // Sync cloud list to backend server so all server calculations match
          fetch("/api/watchlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tickers: cloudList }),
          }).catch((err) => console.error("Error syncing cloud watchlist to server:", err));
        } else {
          // If no personal cloud list exists yet, load server watchlist and seed cloud
          const res = await fetch("/api/watchlist");
          const data = await res.json();
          if (!isMounted) return;
          const initialList = (data.tickers && Array.isArray(data.tickers) && data.tickers.length > 0)
            ? data.tickers
            : watchlist;
          setWatchlist(initialList);
          // Seed cloud document with this initial watchlist
          syncCloudWatchlist(initialList).catch((err) => console.error("Error seeding cloud watchlist:", err));
        }
      } catch (err) {
        console.error("Error initializing watchlist:", err);
      }
    }

    initializeWatchlist();

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  const handleUpdateWatchlist = async (newWatchlist: string[]) => {
    const cleanList = Array.from(
      new Set(newWatchlist.map((t) => String(t).trim().toUpperCase()))
    ).filter(Boolean);

    setWatchlist(cleanList);

    // 1. Central server persistence
    const serverPromise = fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers: cleanList }),
    }).catch((e) => {
      console.error("Error saving watchlist to server:", e);
    });

    // 2. Firestore Cloud database persistence if authenticated
    const cloudPromise = user
      ? syncCloudWatchlist(cleanList).catch((cloudErr) => {
          console.error("Error saving watchlist to Cloud Firestore:", cloudErr);
        })
      : Promise.resolve();

    await Promise.allSettled([serverPromise, cloudPromise]);
  };

  const handleSelectTickerFromModal = (ticker: string) => {
    setActiveTab("put-recommendations");
  };

  // Auth Gate: Checking session state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-xl shadow-blue-500/25 ring-1 ring-white/20 animate-pulse">
            <LineChart className="w-7 h-7 text-white" />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            <span>Verifying Google session...</span>
          </div>
        </div>
      </div>
    );
  }

  // Auth Gate: Require Google Authentication
  if (!user) {
    return <LoginPortal />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        watchlistCount={watchlist.length}
        onOpenSavedTrades={() => setIsSavedTradesOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "put-recommendations" && (
          <PutRecommendationsViewer watchlist={watchlist} />
        )}
        {activeTab === "options-scanner" && (
          <PutScanner watchlist={watchlist} />
        )}
        {activeTab === "fall-detector" && (
          <FallDetector watchlist={watchlist} />
        )}
        {activeTab === "technicals" && (
          <TechnicalsScreener watchlist={watchlist} />
        )}
        {activeTab === "short-puts" && (
          <ShortDatedScreener watchlist={watchlist} />
        )}
        {activeTab === "option-chain" && (
          <OptionChainViewer watchlist={watchlist} />
        )}
        {activeTab === "premium-curves" && (
          <PremiumCurvesViewer />
        )}
        {activeTab === "sec-earnings" && (
          <SecEarningsViewer watchlist={watchlist} />
        )}
        {activeTab === "earnings-transcripts" && (
          <EarningsTranscriptsViewer watchlist={watchlist} />
        )}
        {activeTab === "watchlist" && (
          <WatchlistManager
            watchlist={watchlist}
            onUpdateWatchlist={handleUpdateWatchlist}
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

      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>StockRelated • Quantitative Options & Technical Analysis Suite</span>
          <span className="text-[11px] text-slate-500">
            Firebase Auth & Firestore Persistent Storage • OCC TIMS • SEC EDGAR XBRL
          </span>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;

