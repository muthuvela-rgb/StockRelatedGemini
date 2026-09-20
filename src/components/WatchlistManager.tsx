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
  AlertCircle,
  Edit2,
  Copy,
  FolderOpen,
  ArrowRight,
  ListFilter,
  Info
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { UserWatchlist } from "../types";

interface WatchlistManagerProps {
  watchlist?: string[];
  onUpdateWatchlist?: (newWatchlist: string[]) => void;
  onOpenSavedTrades?: () => void;
  watchlists?: UserWatchlist[];
  activeWatchlistIndex?: number;
  onSelectWatchlistIndex?: (index: number) => void;
  onUpdateWatchlistAtIndex?: (index: number, newTickers: string[], newName?: string) => Promise<void>;
  onRenameWatchlistAtIndex?: (index: number, newName: string) => Promise<void>;
  onSyncCloudWatchlists?: (watchlists: UserWatchlist[], activeIndex?: number) => Promise<void>;
}

const PRESETS = [
  {
    name: "Default Core Watchlist",
    description: "Core semiconductors, mega-cap tech leaders, and liquid growth equities",
    tickers: ["NVDA", "QQQ", "ALAB", "MU", "NBIS", "SNDK", "SKHY", "SPCX", "TSLA", "META", "CRWV", "SNOW", "TQQQ", "RKLB", "CRDO"],
  },
  {
    name: "Tech & Options Leaders",
    description: "Highest option chain liquidity, tight bid-ask spreads, and active retail & institutional volume",
    tickers: ["NVDA", "AAPL", "MSFT", "MU", "AMZN", "META", "TSLA", "AMD", "PLTR", "QQQ"],
  },
  {
    name: "Semiconductor Powerhouses",
    description: "Key semiconductor fabrication, equipment, memory, and fabless AI silicon designers",
    tickers: ["NVDA", "AMD", "AVGO", "MU", "TSM", "ARM", "AMAT", "LRCX", "QCOM", "INTC"],
  },
  {
    name: "Big Tech Leaders",
    description: "Mega-cap balance sheet fortresses with consistent free cash flows",
    tickers: ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "NFLX"],
  },
  {
    name: "High Options Volatility",
    description: "Elevated implied volatility offering rich options premiums and rapid theta decay",
    tickers: ["TSLA", "NVDA", "PLTR", "ARM", "AMD", "COIN", "MSTR", "SMCI", "MARA"],
  },
];

export const WatchlistManager: React.FC<WatchlistManagerProps> = ({
  watchlist: propWatchlist,
  onUpdateWatchlist: propOnUpdateWatchlist,
  onOpenSavedTrades,
}) => {
  const {
    user,
    signIn,
    watchlists,
    activeWatchlistIndex,
    setActiveWatchlistIndex,
    updateWatchlistAtIndex,
    renameWatchlistAtIndex,
    syncCloudWatchlists,
    loadCloudWatchlists,
    savedTrades,
  } = useAuth();

  const activeWatchlist = watchlists[activeWatchlistIndex] || watchlists[0] || {
    id: "wl-1",
    name: "Watchlist 1",
    tickers: propWatchlist || [],
  };

  const [newTicker, setNewTicker] = useState("");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [cloudSyncing, setCloudSyncing] = useState(false);

  // Rename modal / inline state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(activeWatchlist.name);

  const handleSelectTab = (idx: number) => {
    setActiveWatchlistIndex(idx);
    setIsRenaming(false);
    setRenameValue(watchlists[idx]?.name || `Watchlist ${idx + 1}`);

    // Sync newly selected watchlist to backend server so options scanners immediately scan it
    const selectedList = watchlists[idx]?.tickers || [];
    fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers: selectedList }),
    }).catch((err) => console.error("Error syncing active watchlist tab to server:", err));
  };

  const handleStartRename = () => {
    setRenameValue(activeWatchlist.name);
    setIsRenaming(true);
  };

  const handleSaveRename = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = renameValue.trim();
    if (!cleanName) return;

    try {
      await renameWatchlistAtIndex(activeWatchlistIndex, cleanName);
      setIsRenaming(false);
      setSaveStatus(`Renamed to "${cleanName}" (synced to Cloud)`);
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      setSaveStatus(`Rename error: ${err?.message || "Failed"}`);
      setTimeout(() => setSaveStatus(null), 4000);
    }
  };

  const handleManualCloudPush = async () => {
    if (!user) {
      await signIn();
      return;
    }
    setCloudSyncing(true);
    try {
      // 1. Sync all 3 watchlists to Firestore user document
      await syncCloudWatchlists(watchlists, activeWatchlistIndex);

      // 2. Also persist active watchlist to central backend server
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: activeWatchlist.tickers }),
      });

      setSaveStatus(`Pushed all 3 watchlists to Cloud Firestore & Server`);
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
      const cloudData = await loadCloudWatchlists();
      if (cloudData && cloudData.watchlists && cloudData.watchlists.length > 0) {
        setSaveStatus(`Restored 3 watchlists from Cloud Firestore`);
      } else {
        setSaveStatus("No saved cloud watchlists found in Firestore");
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

  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newTicker.trim().toUpperCase();
    if (!clean) return;

    const currentTickers = activeWatchlist.tickers || [];
    if (!currentTickers.includes(clean)) {
      const updated = [...currentTickers, clean];
      await updateWatchlistAtIndex(activeWatchlistIndex, updated);
      if (propOnUpdateWatchlist) propOnUpdateWatchlist(updated);

      // Also persist to server
      fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: updated }),
      }).catch((err) => console.error("Error updating server watchlist:", err));

      setSaveStatus(`Added ${clean} to ${activeWatchlist.name} (synced)`);
      setTimeout(() => setSaveStatus(null), 2500);
    } else {
      setSaveStatus(`${clean} is already in ${activeWatchlist.name}`);
      setTimeout(() => setSaveStatus(null), 2500);
    }
    setNewTicker("");
  };

  const handleRemove = async (tickerToRemove: string) => {
    const currentTickers = activeWatchlist.tickers || [];
    const updated = currentTickers.filter((t) => t !== tickerToRemove);
    await updateWatchlistAtIndex(activeWatchlistIndex, updated);
    if (propOnUpdateWatchlist) propOnUpdateWatchlist(updated);

    fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers: updated }),
    }).catch((err) => console.error("Error updating server watchlist:", err));

    setSaveStatus(`Removed ${tickerToRemove} from ${activeWatchlist.name}`);
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const handleClearActive = async () => {
    if (!window.confirm(`Are you sure you want to clear all tickers from "${activeWatchlist.name}"?`)) {
      return;
    }
    await updateWatchlistAtIndex(activeWatchlistIndex, []);
    if (propOnUpdateWatchlist) propOnUpdateWatchlist([]);
    fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers: [] }),
    }).catch((err) => console.error("Error clearing server watchlist:", err));
    setSaveStatus(`Cleared all tickers from ${activeWatchlist.name}`);
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const handleCopyFromAnotherWatchlist = async (sourceIndex: number) => {
    const source = watchlists[sourceIndex];
    if (!source || !source.tickers || source.tickers.length === 0) {
      setSaveStatus(`"${source?.name || "Source"}" has no tickers to copy`);
      setTimeout(() => setSaveStatus(null), 2500);
      return;
    }

    const currentTickers = activeWatchlist.tickers || [];
    const combined = Array.from(new Set([...currentTickers, ...source.tickers]));
    await updateWatchlistAtIndex(activeWatchlistIndex, combined);
    if (propOnUpdateWatchlist) propOnUpdateWatchlist(combined);

    fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers: combined }),
    }).catch((err) => console.error("Error updating server watchlist:", err));

    setSaveStatus(`Copied tickers from ${source.name} into ${activeWatchlist.name}`);
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const handleApplyPreset = async (tickers: string[]) => {
    const currentTickers = activeWatchlist.tickers || [];
    const combined = Array.from(new Set([...currentTickers, ...tickers.map((t) => t.trim().toUpperCase())]));
    await updateWatchlistAtIndex(activeWatchlistIndex, combined);
    if (propOnUpdateWatchlist) propOnUpdateWatchlist(combined);

    fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers: combined }),
    }).catch((err) => console.error("Error updating server watchlist:", err));

    setSaveStatus(`Preset added (${combined.length} tickers in ${activeWatchlist.name})`);
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const handleReplaceWithPreset = async (tickers: string[]) => {
    const clean = Array.from(new Set(tickers.map((t) => t.trim().toUpperCase())));
    await updateWatchlistAtIndex(activeWatchlistIndex, clean);
    if (propOnUpdateWatchlist) propOnUpdateWatchlist(clean);

    fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers: clean }),
    }).catch((err) => console.error("Error updating server watchlist:", err));

    setSaveStatus(`Replaced ${activeWatchlist.name} with preset (${clean.length} tickers)`);
    setTimeout(() => setSaveStatus(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top 3-Watchlist Selector & Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <BookmarkCheck className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white font-display">
                Multi-Watchlist Manager
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono font-bold">
                3 Watchlists per User
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Switch between 3 distinct watchlists. The active list powers Put Recommendations, Options Scanner, Technicals, and Fall Detector.
            </p>
          </div>

          {saveStatus && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold animate-fade-in ${
              saveStatus.toLowerCase().includes("fail") || saveStatus.toLowerCase().includes("error")
                ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            }`}>
              {saveStatus.toLowerCase().includes("fail") || saveStatus.toLowerCase().includes("error") ? (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              ) : (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              )}
              <span>{saveStatus}</span>
            </div>
          )}
        </div>

        {/* 3 Watchlist Tabs Switcher */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>Select Active Watchlist Slot</span>
            </span>
            <span className="text-[11px] text-slate-400">
              Active slot: <span className="text-emerald-400 font-bold">{activeWatchlist.name}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {watchlists.map((wl, idx) => {
              const isActive = activeWatchlistIndex === idx;
              return (
                <div
                  key={wl.id}
                  onClick={() => handleSelectTab(idx)}
                  className={`relative p-4 rounded-xl border transition-all cursor-pointer select-none text-left ${
                    isActive
                      ? "bg-blue-950/40 border-blue-500/80 shadow-lg shadow-blue-950/50 ring-1 ring-blue-500/50"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`p-1.5 rounded-lg ${isActive ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"}`}>
                        <Bookmark className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white">
                            {wl.name}
                          </span>
                          {isActive && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                              Active
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Slot {idx + 1} of 3
                        </span>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <span className={`text-base font-bold ${isActive ? "text-blue-300" : "text-slate-300"}`}>
                        {wl.tickers.length}
                      </span>
                      <span className="text-[10px] text-slate-500 block">tickers</span>
                    </div>
                  </div>

                  {/* Tickers preview */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="truncate max-w-[200px] font-mono text-[10px]">
                      {wl.tickers.length > 0 ? wl.tickers.slice(0, 5).join(", ") + (wl.tickers.length > 5 ? "..." : "") : "(empty list)"}
                    </span>
                    <span className={`text-[10px] font-semibold ${isActive ? "text-blue-400" : "text-slate-500"}`}>
                      {isActive ? "Selected" : "Click to load"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Watchlist Controls & Inline Rename */}
        <div className="pt-2">
          {isRenaming ? (
            <form onSubmit={handleSaveRename} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 bg-slate-950/80 border border-blue-500/40 rounded-xl">
              <span className="text-xs text-slate-300 font-medium">Rename Slot {activeWatchlistIndex + 1}:</span>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                maxLength={30}
                placeholder="e.g. Core Tech, High IV, Dividend Aristocrats..."
                className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold outline-none focus:border-blue-500"
                autoFocus
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm"
                >
                  Save Name
                </button>
                <button
                  type="button"
                  onClick={() => setIsRenaming(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/50 border border-slate-800 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Managing:</span>
                <span className="text-xs font-bold text-white font-mono bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                  {activeWatchlist.name}
                </span>
                <button
                  onClick={handleStartRename}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer font-medium hover:underline ml-1"
                  title="Rename this watchlist"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Rename Watchlist</span>
                </button>
              </div>

              {/* Copy between lists dropdown/action */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 hidden sm:inline">Copy from:</span>
                {watchlists.map((wl, idx) => {
                  if (idx === activeWatchlistIndex) return null;
                  return (
                    <button
                      key={wl.id}
                      onClick={() => handleCopyFromAnotherWatchlist(idx)}
                      className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
                      title={`Copy tickers from ${wl.name} into ${activeWatchlist.name}`}
                    >
                      <Copy className="w-3 h-3 text-slate-400" />
                      <span>{wl.name} ({wl.tickers.length})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Add Ticker Form */}
        <form onSubmit={handleAdd} className="flex gap-2 pt-1">
          <input
            type="text"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
            placeholder={`Add ticker symbol to ${activeWatchlist.name} (e.g. NVDA, PLTR, ARM)...`}
            className="flex-1 bg-slate-800/90 border border-slate-700 text-white rounded-lg px-3.5 py-2.5 text-xs uppercase font-bold outline-none focus:ring-2 focus:ring-blue-500 placeholder:normal-case placeholder:font-normal"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Ticker</span>
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
                  ? "All 3 of your watchlists and bookmarked options trades are continuously backed up to your Google account via Cloud Firestore."
                  : "Sign in with Google to enable real-time cloud sync, saving your 3 custom watchlists and bookmarked trades securely to Firestore across all devices."}
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
                  title="Push current 3 watchlists state to Cloud Firestore"
                >
                  <CloudUpload className="w-3.5 h-3.5 text-blue-400" />
                  <span>Push 3 Lists to Cloud</span>
                </button>
                <button
                  onClick={handleManualCloudPull}
                  disabled={cloudSyncing}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  title="Restore 3 watchlists stored in Cloud Firestore"
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white font-display">
                {activeWatchlist.name}
              </h3>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {activeWatchlist.tickers.length} Tickers
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              This list is actively scanned in Put Recommendations, Put Scanner, and Technical Screeners.
            </p>
          </div>

          {activeWatchlist.tickers.length > 0 && (
            <button
              onClick={handleClearActive}
              className="text-xs text-slate-400 hover:text-rose-400 transition flex items-center gap-1 cursor-pointer self-start sm:self-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear List</span>
            </button>
          )}
        </div>

        {activeWatchlist.tickers.length === 0 ? (
          <div className="py-10 text-center space-y-3 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <Bookmark className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-200">No tickers in "{activeWatchlist.name}" yet</h4>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Add tickers using the input above or choose one of the curated presets below to populate this watchlist.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {activeWatchlist.tickers.map((ticker) => (
              <div
                key={ticker}
                className="flex items-center justify-between px-3.5 py-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl transition group"
              >
                <span className="font-bold text-sm text-white font-mono">{ticker}</span>
                <button
                  onClick={() => handleRemove(ticker)}
                  className="text-slate-500 hover:text-rose-400 transition p-1 opacity-60 group-hover:opacity-100 cursor-pointer"
                  title={`Remove ${ticker} from ${activeWatchlist.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preset Universe Packs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white font-display flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Curated Universe Presets</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Easily append or populate the active watchlist ({activeWatchlist.name}) with battle-tested options universe selections.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PRESETS.map((p) => (
            <div
              key={p.name}
              className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3 flex flex-col justify-between"
            >
              <div>
                <h4 className="text-xs font-bold text-white flex items-center justify-between">
                  <span>{p.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">{p.tickers.length} tickers</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  {p.description}
                </p>
                <div className="mt-2 text-[11px] text-cyan-400 font-mono bg-slate-900/60 px-2.5 py-1.5 rounded border border-slate-800/80 overflow-hidden text-ellipsis whitespace-nowrap">
                  {p.tickers.join(", ")}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                <button
                  onClick={() => handleApplyPreset(p.tickers)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs border border-slate-700 transition cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Append to {activeWatchlist.name}</span>
                </button>
                <button
                  onClick={() => handleReplaceWithPreset(p.tickers)}
                  className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-lg text-xs border border-blue-500/30 transition cursor-pointer"
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
