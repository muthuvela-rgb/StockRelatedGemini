import React, { useState } from "react";
import {
  BookmarkCheck,
  Plus,
  Trash2,
  CheckCircle,
  Sparkles,
  Layers,
  RefreshCw,
  Cloud,
  CloudUpload,
  CloudDownload,
  Bookmark,
  LogIn,
  ShieldCheck,
  Check,
  AlertCircle
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface WatchlistManagerProps {
  watchlist: string[];
  onUpdateWatchlist: (newWatchlist: string[]) => void;
  onOpenSavedTrades?: () => void;
}

const PRESETS = [
  {
    name: "Default Core Watchlist",
    tickers: ["NVDA", "QQQ", "ALAB", "MU", "NBIS", "SNDK", "SKHY", "SPCX", "TSLA", "META", "CRWV", "SNOW", "TQQQ", "RKLB", "CRDO"],
  },
  {
    name: "Tech & Options Leaders",
    tickers: ["NVDA", "AAPL", "MSFT", "MU", "AMZN", "META", "TSLA", "AMD", "PLTR", "QQQ"],
  },
  {
    name: "Semiconductor Powerhouses",
    tickers: ["NVDA", "AMD", "AVGO", "MU", "TSM", "ARM", "AMAT", "LRCX", "QCOM", "INTC"],
  },
  {
    name: "Big Tech Leaders",
    tickers: ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "NFLX"],
  },
  {
    name: "High Options Volatility",
    tickers: ["TSLA", "NVDA", "PLTR", "ARM", "AMD", "COIN", "MSTR", "SMCI", "MARA"],
  },
];

export const WatchlistManager: React.FC<WatchlistManagerProps> = ({
  watchlist,
  onUpdateWatchlist,
  onOpenSavedTrades,
}) => {
  const { user, signIn, syncCloudWatchlist, loadCloudWatchlist, savedTrades } = useAuth();
  const [newTicker, setNewTicker] = useState("");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [cloudSyncing, setCloudSyncing] = useState(false);

  const handleManualCloudPush = async () => {
    if (!user) {
      await signIn();
      return;
    }
    setCloudSyncing(true);
    try {
      const cleanList = Array.from(
        new Set(watchlist.map((t) => String(t).trim().toUpperCase()))
      ).filter(Boolean);

      // 1. Sync directly to Cloud Firestore user document
      await syncCloudWatchlist(cleanList);

      // 2. Also persist to central backend server
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: cleanList }),
      });

      setSaveStatus(`Pushed ${cleanList.length} tickers to Cloud Firestore & Server`);
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (e: any) {
      console.error("Failed to push watchlist to cloud:", e);
      setSaveStatus(e?.message ? `Push failed: ${e.message}` : "Failed to push to cloud");
      setTimeout(() => setSaveStatus(null), 4500);
    } finally {
      setCloudSyncing(false);
    }
  };

  const handleManualCloudPull = async () => {
    if (!user) return;
    setCloudSyncing(true);
    try {
      const cloudList = await loadCloudWatchlist();
      if (cloudList && cloudList.length > 0) {
        onUpdateWatchlist(cloudList);
        setSaveStatus(`Restored ${cloudList.length} tickers from Cloud Firestore`);
      } else {
        setSaveStatus("No saved cloud watchlist found in Firestore");
      }
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (e: any) {
      console.error("Failed to pull watchlist from cloud:", e);
      setSaveStatus(e?.message ? `Pull failed: ${e.message}` : "Error pulling from cloud");
      setTimeout(() => setSaveStatus(null), 4500);
    } finally {
      setCloudSyncing(false);
    }
  };

  const handleAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newTicker.trim().toUpperCase();
    if (!clean) return;

    if (!watchlist.includes(clean)) {
      const updated = [...watchlist, clean];
      onUpdateWatchlist(updated);
      setSaveStatus(`Added ${clean} (synced to Cloud & Server)`);
      setTimeout(() => setSaveStatus(null), 2500);
    } else {
      setSaveStatus(`${clean} is already in watchlist`);
      setTimeout(() => setSaveStatus(null), 2500);
    }
    setNewTicker("");
  };

  const handleRemove = (tickerToRemove: string) => {
    const updated = watchlist.filter((t) => t !== tickerToRemove);
    onUpdateWatchlist(updated);
    setSaveStatus(`Removed ${tickerToRemove} (synced to Cloud & Server)`);
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const handleApplyPreset = (tickers: string[]) => {
    const combined = Array.from(new Set([...watchlist, ...tickers.map((t) => t.trim().toUpperCase())]));
    onUpdateWatchlist(combined);
    setSaveStatus(`Preset added (${combined.length} tickers synced to Cloud)`);
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const handleReplaceWithPreset = (tickers: string[]) => {
    const clean = Array.from(new Set(tickers.map((t) => t.trim().toUpperCase())));
    onUpdateWatchlist(clean);
    setSaveStatus(`Replaced with preset (${clean.length} tickers synced to Cloud)`);
    setTimeout(() => setSaveStatus(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white font-display flex items-center gap-2">
              <BookmarkCheck className="w-5 h-5 text-blue-400" />
              Watchlist & Universe Manager
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Manage custom equities tracked across Put Scanner, Fall Detector, and Technicals Screener.
            </p>
          </div>

          {saveStatus && (
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold ${
              saveStatus.toLowerCase().includes("fail") || saveStatus.toLowerCase().includes("error")
                ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            }`}>
              {saveStatus.toLowerCase().includes("fail") || saveStatus.toLowerCase().includes("error") ? (
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{saveStatus}</span>
            </div>
          )}
        </div>

        {/* Add Ticker Form */}
        <form onSubmit={handleAdd} className="flex gap-2 pt-4">
          <input
            type="text"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
            placeholder="Add ticker symbol (e.g. NVDA, PLTR, ARM)..."
            className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs uppercase font-bold outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            Add Ticker
          </button>
        </form>
      </div>

      {/* Cloud Firestore Persistence & Account Sync Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl border shrink-0 ${
              user ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
            }`}>
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white font-display">
                  Firebase Cloud Firestore Persistence
                </h3>
                {user ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono font-semibold flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" />
                    Connected as {user.email?.split("@")[0]}
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono font-semibold">
                    Guest Mode (Local Only)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                {user
                  ? "Your watchlists and bookmarked options recommendations are continuously backed up to your Google account via Cloud Firestore."
                  : "Sign in with Google to enable real-time cloud sync, saving your custom watchlists and bookmarked trades securely to Firestore across all devices."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {user ? (
              <>
                <button
                  onClick={handleManualCloudPush}
                  disabled={cloudSyncing}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  title="Push current watchlist state to Cloud Firestore"
                >
                  <CloudUpload className="w-3.5 h-3.5 text-blue-400" />
                  <span>Push to Cloud</span>
                </button>
                <button
                  onClick={handleManualCloudPull}
                  disabled={cloudSyncing}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  title="Restore watchlist stored in Cloud Firestore"
                >
                  <CloudDownload className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Restore from Cloud</span>
                </button>
                {onOpenSavedTrades && (
                  <button
                    onClick={onOpenSavedTrades}
                    className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Saved Puts ({savedTrades.length})</span>
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={signIn}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-md cursor-pointer transition"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign in with Google</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Active Watchlist Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white font-display">
            Active Watchlist ({watchlist.length} Tickers)
          </h3>
          <span className="text-xs text-slate-400">Used as primary default in scanners</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {watchlist.map((ticker) => (
            <div
              key={ticker}
              className="flex items-center justify-between px-3.5 py-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl transition group"
            >
              <span className="font-bold text-sm text-white font-mono">{ticker}</span>
              <button
                onClick={() => handleRemove(ticker)}
                className="text-slate-500 hover:text-rose-400 transition p-1 opacity-60 group-hover:opacity-100 cursor-pointer"
                title="Remove from watchlist"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Preset Packs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h3 className="text-sm font-bold text-white font-display mb-3 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-400" />
          Curated Universe Presets
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PRESETS.map((p) => (
            <div
              key={p.name}
              className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3"
            >
              <div>
                <h4 className="text-xs font-bold text-white">{p.name}</h4>
                <p className="text-[11px] text-slate-400 font-mono mt-1">
                  {p.tickers.join(", ")}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleApplyPreset(p.tickers)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs border border-slate-700 transition cursor-pointer"
                >
                  Append to List
                </button>
                <button
                  onClick={() => handleReplaceWithPreset(p.tickers)}
                  className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded text-xs border border-blue-500/30 transition cursor-pointer"
                >
                  Replace All
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
