import React from "react";
import { useAuth } from "../context/AuthContext";
import {
  Bookmark,
  Trash2,
  X,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  Percent,
  Calendar,
  AlertCircle
} from "lucide-react";

interface SavedTradesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTicker?: (ticker: string) => void;
}

export const SavedTradesModal: React.FC<SavedTradesModalProps> = ({
  isOpen,
  onClose,
  onSelectTicker,
}) => {
  const { user, savedTrades, removeTrade } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-display">
                Saved Puts & Recommendations
              </h3>
              <p className="text-xs text-slate-400">
                Synced in real time to your Google Account via Cloud Firestore
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!user ? (
            <div className="text-center py-10 px-4">
              <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-white">Sign-in Required</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Sign in with Google using the button in the top navigation bar to persist and manage bookmarked trades in Cloud Firestore.
              </p>
            </div>
          ) : savedTrades.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-2xl">
              <Bookmark className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">No Saved Trades Yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Click the bookmark icon on any trade recommendation in the "Put Recommendations" tab to save high-confidence setups to your Firestore database.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {savedTrades.map((trade) => {
                const tradeKey = trade.id || `${trade.ticker}_${trade.expiration}_${trade.strike}P`;
                return (
                  <div
                    key={tradeKey}
                    className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition relative group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-white font-mono">
                            {trade.ticker}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/20 font-mono font-semibold">
                            ${trade.strike} Put
                          </span>
                          {trade.tier && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase font-mono">
                              {trade.tier.replace("_", " ")}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => removeTrade(tradeKey)}
                          className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                          title="Remove from Firestore"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-800/60 my-2 text-center text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-slate-500 block font-sans">Exp (DTE)</span>
                          <span className="text-slate-300 font-semibold">{trade.expiration}</span>
                          {trade.dte !== undefined && (
                            <span className="text-[10px] text-slate-500 block">({trade.dte}d)</span>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block font-sans">Cash Yield</span>
                          <span className="text-emerald-400 font-bold">
                            {trade.annualizedReturn ? `${trade.annualizedReturn.toFixed(1)}%` : "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block font-sans">Buffer</span>
                          <span className="text-cyan-300 font-bold">
                            {trade.downsideBuffer ? `${trade.downsideBuffer.toFixed(1)}%` : "N/A"}
                          </span>
                        </div>
                      </div>

                      {trade.rationale && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mt-1">
                          {trade.rationale}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/40 text-[10px] text-slate-500">
                      <span>Saved: {trade.savedAt ? new Date(trade.savedAt).toLocaleDateString() : "Recently"}</span>
                      {onSelectTicker && (
                        <button
                          onClick={() => {
                            onSelectTicker(trade.ticker);
                            onClose();
                          }}
                          className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium cursor-pointer"
                        >
                          <span>Analyze Ticker</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>
            {savedTrades.length} item{savedTrades.length === 1 ? "" : "s"} stored in Firestore
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
