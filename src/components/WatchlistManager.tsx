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
  Info,
  X,
  Zap,
  Activity,
  Loader2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { UserWatchlist } from "../types";
import { QQQ_COMPONENTS, SP500_COMPONENTS, SMH_COMPONENTS } from "../data/universePresets";

interface WatchlistManagerProps {
  watchlist?: string[];
  onOpenSavedTrades?: () => void;
  watchlists?: UserWatchlist[];
  activeWatchlistIndex?: number;
  onSelectWatchlistIndex?: (index: number) => void;
  onCreateWatchlist?: (name: string, tickers: string[]) => Promise<void>;
  onDeleteWatchlistAtIndex?: (index: number) => Promise<void>;
  onUpdateWatchlistAtIndex?: (index: number, newTickers: string[], newName?: string) => Promise<void>;
  onRenameWatchlistAtIndex?: (index: number, newName: string) => Promise<void>;
  onSyncCloudWatchlists?: (watchlists: UserWatchlist[], activeIndex?: number) => Promise<void>;
}

const PRESETS = [
  {
    name: "All Components of QQQ (Nasdaq-100)",
    description: "Full 110-stock universe of the Invesco QQQ Trust / Nasdaq-100 index (NVDA, AAPL, MSFT, AMZN, META, GOOGL, TSLA, AVGO, PLTR, AMD, etc.)",
    tickers: QQQ_COMPONENTS,
    badge: "110 Stocks • Nasdaq-100",
    highlight: true,
  },
  {
    name: "Default Core Watchlist",
    description: "Core semiconductors, mega-cap tech leaders, and liquid growth equities",
    tickers: ["NVDA", "QQQ", "ALAB", "MU", "NBIS", "SNDK", "SKHY", "SPCX", "TSLA", "META", "CRWV", "SNOW", "TQQQ", "RKLB", "CRDO"],
    badge: "15 Stocks • Core",
    highlight: false,
  },
  {
    name: "Tech & Options Leaders",
    description: "Highest option chain liquidity, tight bid-ask spreads, and active retail & institutional volume",
    tickers: ["NVDA", "AAPL", "MSFT", "MU", "AMZN", "META", "TSLA", "AMD", "PLTR", "QQQ"],
    badge: "10 Stocks • High Volume",
    highlight: false,
  },
  {
    name: "Semiconductor Leaders (SMH)",
    description: "Key semiconductor fabrication, equipment, memory, and fabless AI silicon designers",
    tickers: SMH_COMPONENTS,
    badge: "28 Stocks • High IV",
    highlight: false,
  },
  {
    name: "S&P 500 Large-Cap Equities",
    description: "Broadest exposure to US large-cap equities with deep options liquidity",
    tickers: SP500_COMPONENTS,
    badge: "503 Stocks • Large Cap",
    highlight: false,
  },
  {
    name: "Big Tech Leaders",
    description: "Mega-cap balance sheet fortresses with consistent free cash flows",
    tickers: ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "NFLX"],
    badge: "8 Stocks • Mega-Caps",
    highlight: false,
  },
  {
    name: "High Options Volatility",
    description: "Elevated implied volatility offering rich options premiums and rapid theta decay",
    tickers: ["TSLA", "NVDA", "PLTR", "ARM", "AMD", "COIN", "MSTR", "SMCI", "MARA"],
    badge: "9 Stocks • Rich Theta",
    highlight: false,
  },
];

export const WatchlistManager: React.FC<WatchlistManagerProps> = ({
  watchlist: propWatchlist,
  onOpenSavedTrades,
  onCreateWatchlist: propOnCreateWatchlist,
  onDeleteWatchlistAtIndex: propOnDeleteWatchlistAtIndex,
}) => {
  const {
    user,
    signIn,
    watchlists,
    activeWatchlistIndex,
    setActiveWatchlistIndex,
    createWatchlist,
    deleteWatchlistAtIndex,
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

  // Dynamic QQQ Bollinger Band watchlist scan state
  const [bollingerMode, setBollingerMode] = useState<"extremes" | "oversold" | "overbought" | "squeeze">("extremes");
  const [bollingerLoading, setBollingerLoading] = useState(false);
  const [bollingerError, setBollingerError] = useState<string | null>(null);
  const [bollingerResult, setBollingerResult] = useState<{
    symbols: string[];
    matches: Array<{ symbol: string; price: number; bollinger: { percentB: number; bandwidthPct: number } }>;
    qqqRegime: { symbol: string; price: number; bollinger: { percentB: number; upperBand: number; lowerBand: number } } | null;
    constituentSource: string;
    generatedAt: string;
  } | null>(null);

  // Rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(activeWatchlist.name);

  // Create Watchlist Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState("QQQ Components (Nasdaq-100)");
  const [selectedPresetType, setSelectedPresetType] = useState<string>("qqq");
  const [customTickersInput, setCustomTickersInput] = useState("");

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

  const handleCreateNewWatchlist = async (name: string, tickers: string[]) => {
    try {
      const cleanList = Array.from(new Set(tickers.map((t) => t.trim().toUpperCase()))).filter(Boolean);
      const cleanName = name.trim() || `Watchlist ${watchlists.length + 1}`;
      if (propOnCreateWatchlist) {
        await propOnCreateWatchlist(cleanName, cleanList);
      } else {
        await createWatchlist(cleanName, cleanList, true);
      }

      // Sync to backend server
      fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: cleanList }),
      }).catch((err) => console.error("Error updating server watchlist:", err));

      setSaveStatus(`Created new watchlist "${cleanName}" (${cleanList.length} tickers)`);
      setIsCreateModalOpen(false);
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err: any) {
      setSaveStatus(`Create failed: ${err?.message || "Error"}`);
      setTimeout(() => setSaveStatus(null), 4000);
    }
  };

  const handleCreateOrSelectQqqWatchlist = async () => {
    const qqqIndex = watchlists.findIndex(
      (w) => w.id === "wl-qqq" || w.name.toLowerCase().includes("qqq")
    );
    if (qqqIndex !== -1) {
      handleSelectTab(qqqIndex);
      setSaveStatus(`Switched to "${watchlists[qqqIndex].name}" (${watchlists[qqqIndex].tickers.length} tickers)`);
      setTimeout(() => setSaveStatus(null), 3000);
    } else {
      await handleCreateNewWatchlist("QQQ Components (Nasdaq-100)", QQQ_COMPONENTS);
    }
  };

  const handleGenerateBollingerScan = async () => {
    setBollingerLoading(true);
    setBollingerError(null);
    try {
      const res = await fetch(`/api/watchlist/qqq-bollinger?mode=${bollingerMode}&limit=25`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `Scan failed: ${res.status}`);
      }
      const data = await res.json();
      setBollingerResult(data);
    } catch (err: any) {
      setBollingerError(err?.message || "Failed to run QQQ Bollinger scan");
    } finally {
      setBollingerLoading(false);
    }
  };

  const handleDeleteWatchlist = async (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (watchlists.length <= 1) {
      setSaveStatus("Cannot delete the only watchlist");
      setTimeout(() => setSaveStatus(null), 3000);
      return;
    }
    const target = watchlists[idx];
    if (!window.confirm(`Are you sure you want to delete watchlist "${target.name}" (${target.tickers.length} tickers)?`)) {
      return;
    }
    try {
      if (propOnDeleteWatchlistAtIndex) {
        await propOnDeleteWatchlistAtIndex(idx);
      } else {
        await deleteWatchlistAtIndex(idx);
      }
      setSaveStatus(`Deleted "${target.name}"`);
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      setSaveStatus(`Delete failed: ${err?.message || "Error"}`);
      setTimeout(() => setSaveStatus(null), 3000);
    }
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
      // 1. Sync all watchlists to Firestore user document
      await syncCloudWatchlists(watchlists, activeWatchlistIndex);

      // 2. Also persist active watchlist to central backend server
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: activeWatchlist.tickers }),
      });

      setSaveStatus(`Pushed all ${watchlists.length} watchlists to Cloud Firestore & Server`);
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
        setSaveStatus(`Restored ${cloudData.watchlists.length} watchlists from Cloud Firestore`);
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
      {/* Top Multi-Watchlist Selector & Header */}
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
                {watchlists.length} Watchlist{watchlists.length > 1 ? "s" : ""} Available
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Switch between persistent watchlists or create dedicated universe lists like QQQ. The active list powers Put Recommendations, Options Scanner, Technicals, and Fall Detector.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setNewWatchlistName("QQQ Components (Nasdaq-100)");
                setSelectedPresetType("qqq");
                setIsCreateModalOpen(true);
              }}
              className="px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-900/30 cursor-pointer transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>New Watchlist</span>
            </button>

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
        </div>

        {/* Dedicated QQQ 1-Click Action Banner */}
        <div className="bg-gradient-to-r from-slate-950 via-blue-950/40 to-slate-950 border border-cyan-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-white font-display">
                  QQQ Constituents Watchlist (Nasdaq-100)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold border border-cyan-500/30">
                  {QQQ_COMPONENTS.length} Constituents
                </span>
                {watchlists.some((w) => w.name.toLowerCase().includes("qqq") || w.id === "wl-qqq") && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-semibold border border-emerald-500/30 flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" />
                    Available in Slots
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Full 110-stock Nasdaq-100 / QQQ universe (NVDA, AAPL, MSFT, AMZN, META, GOOGL, TSLA, AVGO, PLTR, AMD...). Perfect for comprehensive systematic options scanning.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCreateOrSelectQqqWatchlist}
              className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-cyan-900/30 cursor-pointer transition active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>
                {watchlists.some((w) => w.name.toLowerCase().includes("qqq") || w.id === "wl-qqq")
                  ? "Load QQQ Watchlist"
                  : "Create QQQ Watchlist"}
              </span>
            </button>
          </div>
        </div>

        {/* Dynamic QQQ Bollinger Band Watchlist */}
        <div className="bg-gradient-to-r from-slate-950 via-purple-950/30 to-slate-950 border border-purple-500/30 rounded-xl p-4 space-y-3.5 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-white font-display">
                    QQQ Bollinger Band Dynamic Watchlist
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono font-bold border border-purple-500/30">
                    Live Scan
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed max-w-xl">
                  Fetches QQQ's current constituents live and scans each for 20-day Bollinger %B position. Re-run any time — the universe and results are computed fresh each call.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-950/60 border border-slate-800 rounded-lg p-1">
              {(["extremes", "oversold", "overbought", "squeeze"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setBollingerMode(m)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize transition cursor-pointer ${
                    bollingerMode === m
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/80"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleGenerateBollingerScan}
              disabled={bollingerLoading}
              className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition active:scale-95 disabled:opacity-60"
            >
              {bollingerLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>{bollingerLoading ? "Scanning..." : "Generate Scan"}</span>
            </button>
          </div>

          {bollingerError && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{bollingerError}</span>
            </div>
          )}

          {bollingerResult && (
            <div className="space-y-2.5 pt-1">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span>
                  <span className="text-white font-bold">{bollingerResult.symbols.length}</span> symbols matched
                </span>
                {bollingerResult.qqqRegime && (
                  <span className="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 font-mono">
                    QQQ %B: <span className="text-purple-300 font-bold">{bollingerResult.qqqRegime.bollinger.percentB}</span>
                  </span>
                )}
                <span className="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 font-mono text-slate-500">
                  source: {bollingerResult.constituentSource}
                </span>
              </div>

              <div className="text-[11px] text-purple-300 font-mono bg-slate-950/60 px-2.5 py-1.5 rounded border border-slate-800/80 overflow-hidden text-ellipsis whitespace-nowrap">
                {bollingerResult.symbols.join(", ")}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleApplyPreset(bollingerResult.symbols)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs border border-slate-700 transition cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Append to Active</span>
                </button>
                <button
                  onClick={() => handleReplaceWithPreset(bollingerResult.symbols)}
                  className="px-2.5 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded-lg text-xs border border-purple-500/30 transition cursor-pointer"
                >
                  Replace Active
                </button>
                <button
                  onClick={() =>
                    handleCreateNewWatchlist(
                      `QQQ Bollinger ${bollingerMode[0].toUpperCase()}${bollingerMode.slice(1)}`,
                      bollingerResult.symbols
                    )
                  }
                  className="px-2.5 py-1.5 bg-fuchsia-600/20 hover:bg-fuchsia-600/30 text-fuchsia-300 rounded-lg text-xs border border-fuchsia-500/30 transition cursor-pointer flex items-center gap-1 ml-auto"
                >
                  <Plus className="w-3 h-3" />
                  <span>New Watchlist ({bollingerResult.symbols.length})</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Watchlist Tabs Switcher */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>Watchlist Slots ({watchlists.length})</span>
            </span>
            <span className="text-[11px] text-slate-400">
              Active slot: <span className="text-emerald-400 font-bold">{activeWatchlist.name}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {watchlists.map((wl, idx) => {
              const isActive = activeWatchlistIndex === idx;
              const isQqq = wl.id === "wl-qqq" || wl.name.toLowerCase().includes("qqq");
              return (
                <div
                  key={wl.id || idx}
                  onClick={() => handleSelectTab(idx)}
                  className={`relative p-3.5 rounded-xl border transition-all cursor-pointer select-none text-left flex flex-col justify-between group ${
                    isActive
                      ? "bg-blue-950/40 border-blue-500/80 shadow-lg shadow-blue-950/50 ring-1 ring-blue-500/50"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`p-1.5 rounded-lg ${isActive ? "bg-blue-600 text-white" : isQqq ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "bg-slate-800 text-slate-400"}`}>
                          {isQqq ? <Sparkles className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white truncate max-w-[130px]">
                              {wl.name}
                            </span>
                            {isActive && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 shrink-0">
                                Active
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Slot {idx + 1} of {watchlists.length}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right font-mono">
                          <span className={`text-base font-bold ${isActive ? "text-blue-300" : "text-slate-300"}`}>
                            {wl.tickers.length}
                          </span>
                          <span className="text-[9px] text-slate-500 block leading-tight">tickers</span>
                        </div>

                        {watchlists.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteWatchlist(idx, e)}
                            className="opacity-60 hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition cursor-pointer"
                            title={`Delete "${wl.name}"`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tickers preview */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="truncate max-w-[160px] font-mono text-[10px] text-slate-400">
                      {wl.tickers.length > 0 ? wl.tickers.slice(0, 4).join(", ") + (wl.tickers.length > 4 ? ` +${wl.tickers.length - 4}` : "") : "(empty list)"}
                    </span>
                    <span className={`text-[10px] font-semibold shrink-0 ${isActive ? "text-blue-400" : "text-slate-500"}`}>
                      {isActive ? "Selected" : "Click to load"}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Quick Add New Watchlist Card */}
            <div
              onClick={() => {
                setNewWatchlistName(`Watchlist ${watchlists.length + 1}`);
                setSelectedPresetType("qqq");
                setIsCreateModalOpen(true);
              }}
              className="p-3.5 rounded-xl border border-dashed border-slate-800 hover:border-blue-500/70 bg-slate-950/30 hover:bg-blue-950/20 text-slate-400 hover:text-blue-300 transition-all cursor-pointer select-none flex flex-col justify-center items-center gap-2 group min-h-[90px]"
            >
              <div className="p-2 rounded-xl bg-slate-800/80 group-hover:bg-blue-600 group-hover:text-white transition">
                <Plus className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-center">New Watchlist</span>
              <span className="text-[10px] text-slate-500 text-center font-mono">Create with QQQ or custom</span>
            </div>
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
                  ? `All ${watchlists.length} of your watchlists and bookmarked options trades are continuously backed up to your Google account via Cloud Firestore.`
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
                  title="Push current watchlists state to Cloud Firestore"
                >
                  <CloudUpload className="w-3.5 h-3.5 text-blue-400" />
                  <span>Push {watchlists.length} List{watchlists.length !== 1 ? "s" : ""} to Cloud</span>
                </button>
                <button
                  onClick={handleManualCloudPull}
                  disabled={cloudSyncing}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  title="Restore watchlists stored in Cloud Firestore"
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
              className={`border rounded-xl p-4 space-y-3 flex flex-col justify-between ${
                p.highlight
                  ? "bg-gradient-to-b from-blue-950/40 via-slate-950/70 to-slate-950/90 border-cyan-500/40 shadow-lg shadow-cyan-950/30"
                  : "bg-slate-950/60 border-slate-800"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    {p.highlight && <Sparkles className="w-3.5 h-3.5 text-cyan-400" />}
                    <span>{p.name}</span>
                  </h4>
                  <div className="flex items-center gap-1.5">
                    {p.badge && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/25 font-mono font-bold">
                        {p.badge}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {p.description}
                </p>
                <div className="mt-2 text-[11px] text-cyan-400 font-mono bg-slate-900/60 px-2.5 py-1.5 rounded border border-slate-800/80 overflow-hidden text-ellipsis whitespace-nowrap">
                  {p.tickers.join(", ")}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60">
                <button
                  onClick={() => handleApplyPreset(p.tickers)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs border border-slate-700 transition cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Append</span>
                </button>
                <button
                  onClick={() => handleReplaceWithPreset(p.tickers)}
                  className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-lg text-xs border border-blue-500/30 transition cursor-pointer"
                >
                  Replace Active
                </button>
                <button
                  onClick={() => handleCreateNewWatchlist(p.name, p.tickers)}
                  className="px-2.5 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 rounded-lg text-xs border border-cyan-500/30 transition cursor-pointer flex items-center gap-1 ml-auto"
                  title={`Create brand new watchlist with all ${p.tickers.length} tickers`}
                >
                  <Plus className="w-3 h-3" />
                  <span>New Watchlist ({p.tickers.length})</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create New Watchlist Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
                  <Bookmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-display">
                    Create New Watchlist
                  </h3>
                  <p className="text-xs text-slate-400">
                    Set up a new persistent watchlist slot synced to Cloud & Server.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Watchlist Name
                </label>
                <input
                  type="text"
                  value={newWatchlistName}
                  onChange={(e) => setNewWatchlistName(e.target.value)}
                  placeholder="e.g. QQQ Components (Nasdaq-100), AI Hardware, High Yield..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Choose Initial Universe / Preset
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div
                    onClick={() => {
                      setSelectedPresetType("qqq");
                      setNewWatchlistName("QQQ Components (Nasdaq-100)");
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition select-none ${
                      selectedPresetType === "qqq"
                        ? "bg-cyan-950/40 border-cyan-500 ring-1 ring-cyan-500/50"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span>QQQ Components</span>
                      </span>
                      <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/20 px-1.5 py-0.2 rounded font-bold">
                        {QQQ_COMPONENTS.length} stocks
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      All 110 Nasdaq-100 constituents (NVDA, AAPL, MSFT, AMZN, META, TSLA...)
                    </p>
                  </div>

                  <div
                    onClick={() => {
                      setSelectedPresetType("sp500");
                      setNewWatchlistName("S&P 500 Large-Caps");
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition select-none ${
                      selectedPresetType === "sp500"
                        ? "bg-blue-950/40 border-blue-500 ring-1 ring-blue-500/50"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">S&P 500 Large-Cap</span>
                      <span className="text-[10px] font-mono text-blue-300 bg-blue-500/20 px-1.5 py-0.2 rounded font-bold">
                        503 stocks
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Broad US large-cap equities with deep options liquidity
                    </p>
                  </div>

                  <div
                    onClick={() => {
                      setSelectedPresetType("smh");
                      setNewWatchlistName("Semiconductor Leaders (SMH)");
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition select-none ${
                      selectedPresetType === "smh"
                        ? "bg-purple-950/40 border-purple-500 ring-1 ring-purple-500/50"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">SMH Semiconductors</span>
                      <span className="text-[10px] font-mono text-purple-300 bg-purple-500/20 px-1.5 py-0.2 rounded font-bold">
                        28 stocks
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Top chipmakers, foundries, & equipment designers
                    </p>
                  </div>

                  <div
                    onClick={() => {
                      setSelectedPresetType("custom");
                      setNewWatchlistName(`Watchlist ${watchlists.length + 1}`);
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition select-none ${
                      selectedPresetType === "custom"
                        ? "bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/50"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Custom / Blank</span>
                      <span className="text-[10px] font-mono text-slate-400">Manual</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Start fresh and enter your own custom symbols
                    </p>
                  </div>
                </div>
              </div>

              {selectedPresetType === "custom" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Initial Tickers (comma or space separated)
                  </label>
                  <textarea
                    rows={3}
                    value={customTickersInput}
                    onChange={(e) => setCustomTickersInput(e.target.value.toUpperCase())}
                    placeholder="e.g. AAPL, NVDA, TSLA, AMZN, MSFT"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono uppercase outline-none focus:border-blue-500 placeholder:normal-case placeholder:font-sans"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  let tickers: string[] = [];
                  if (selectedPresetType === "qqq") {
                    tickers = QQQ_COMPONENTS;
                  } else if (selectedPresetType === "sp500") {
                    tickers = SP500_COMPONENTS;
                  } else if (selectedPresetType === "smh") {
                    tickers = SMH_COMPONENTS;
                  } else {
                    tickers = customTickersInput
                      .split(/[\s,]+/)
                      .map((t) => t.trim().toUpperCase())
                      .filter(Boolean);
                  }
                  handleCreateNewWatchlist(newWatchlistName, tickers);
                }}
                className="px-5 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-lg active:scale-95 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Create Watchlist</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
