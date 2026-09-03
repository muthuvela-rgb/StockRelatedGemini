import React, { useState, useEffect } from "react";
import { Header, ActiveTab } from "./components/Header";
import { PutRecommendationsViewer } from "./components/PutRecommendationsViewer";
import { PutScanner } from "./components/PutScanner";
import { FallDetector } from "./components/FallDetector";
import { TechnicalsScreener } from "./components/TechnicalsScreener";
import { ShortDatedScreener } from "./components/ShortDatedScreener";
import { OptionChainViewer } from "./components/OptionChainViewer";
import { PremiumCurvesViewer } from "./components/PremiumCurvesViewer";
import { SecEarningsViewer } from "./components/SecEarningsViewer";
import { WatchlistManager } from "./components/WatchlistManager";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("options-scanner");
  const [watchlist, setWatchlist] = useState<string[]>([
    "NVDA", "QQQ", "ALAB", "MU", "NBIS", "SNDK", "SKHY", "SPCX", "TSLA", "META", "CRWV", "SNOW", "TQQQ"
  ]);

  useEffect(() => {
    fetch("/api/watchlist")
      .then((res) => res.json())
      .then((data) => {
        if (data.tickers && Array.isArray(data.tickers) && data.tickers.length > 0) {
          setWatchlist(data.tickers);
        }
      })
      .catch((err) => console.error("Error fetching watchlist:", err));
  }, []);

  const handleUpdateWatchlist = async (newWatchlist: string[]) => {
    setWatchlist(newWatchlist);
    try {
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: newWatchlist }),
      });
    } catch (e) {
      console.error("Error saving watchlist:", e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        watchlistCount={watchlist.length}
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
        {activeTab === "watchlist" && (
          <WatchlistManager
            watchlist={watchlist}
            onUpdateWatchlist={handleUpdateWatchlist}
          />
        )}
      </main>

      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>StockRelated • Quantitative Options & Technical Analysis Suite</span>
          <span className="text-[11px] text-slate-500">
            OCC TIMS stress test • Wilder's RSI(14) • 20d Bollinger • SEC EDGAR XBRL
          </span>
        </div>
      </footer>
    </div>
  );
};

export default App;

