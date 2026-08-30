import React, { useState } from "react";
import {
  BookmarkCheck,
  Plus,
  Trash2,
  CheckCircle,
  Sparkles,
  Layers,
  RefreshCw
} from "lucide-react";

interface WatchlistManagerProps {
  watchlist: string[];
  onUpdateWatchlist: (newWatchlist: string[]) => void;
}

const PRESETS = [
  {
    name: "Original StockRelated Set",
    tickers: ["SPCX", "MU", "SNDK", "ALAB", "NVDA", "SKHY", "META", "TSLA", "QQQ"],
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
}) => {
  const [newTicker, setNewTicker] = useState("");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const handleAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newTicker.trim().toUpperCase();
    if (!clean) return;

    if (!watchlist.includes(clean)) {
      const updated = [...watchlist, clean];
      onUpdateWatchlist(updated);
      setSaveStatus(`Added ${clean}`);
      setTimeout(() => setSaveStatus(null), 2500);
    }
    setNewTicker("");
  };

  const handleRemove = (tickerToRemove: string) => {
    const updated = watchlist.filter((t) => t !== tickerToRemove);
    onUpdateWatchlist(updated);
    setSaveStatus(`Removed ${tickerToRemove}`);
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const handleApplyPreset = (tickers: string[]) => {
    const combined = Array.from(new Set([...watchlist, ...tickers]));
    onUpdateWatchlist(combined);
    setSaveStatus("Preset tickers added to watchlist");
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const handleReplaceWithPreset = (tickers: string[]) => {
    onUpdateWatchlist(tickers);
    setSaveStatus("Watchlist replaced with preset");
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
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
              <CheckCircle className="w-3.5 h-3.5" />
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
