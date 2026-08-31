import React, { useState, useEffect } from "react";
import {
  Clock,
  Zap,
  Filter,
  RefreshCw,
  Download,
  AlertCircle,
  TrendingUp
} from "lucide-react";
import { PutOptionRecord } from "../types";
import { formatCurrency, formatPct, formatLargeNumber } from "../lib/utils";
import { StatCard } from "./StatCard";

interface ShortDatedScreenerProps {
  watchlist: string[];
}

export const ShortDatedScreener: React.FC<ShortDatedScreenerProps> = ({ watchlist }) => {
  const [maxDte, setMaxDte] = useState(15);
  const [minBid, setMinBid] = useState(2.0);
  const [maxMoneyness, setMaxMoneyness] = useState(90.0);
  const [minMarketCapB, setMinMarketCapB] = useState(5.0);
  const [universe, setUniverse] = useState<"qqq" | "watchlist">("qqq");
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<PutOptionRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runShortScan = async () => {
    setLoading(true);
    setError(null);

    const tickers =
      universe === "watchlist"
        ? watchlist
        : ["NVDA", "AAPL", "MSFT", "MU", "AMZN", "AMD", "GOOGL", "TSLA", "AVGO", "META", "CSCO", "COST", "PLTR", "AMAT", "LRCX", "NFLX"];

    try {
      const res = await fetch("/api/options-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickers,
          minDays: 1,
          maxDays: maxDte,
          strikeMode: "band",
          pctLow: 40,
          pctHigh: maxMoneyness,
          noMargin: true,
          marginShockPct: 15.0,
        }),
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();

      const filtered = (data.records || []).filter((r: PutOptionRecord) => {
        if (r.bid < minBid) return false;
        if (r.moneyness_pct > maxMoneyness) return false;
        if (r.market_cap && r.market_cap < minMarketCapB * 1e9) return false;
        return true;
      });

      setRecords(filtered);
    } catch (e: any) {
      setError(e.message || "Failed to scan short-dated puts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runShortScan();
  }, [universe]);

  return (
    <div className="space-y-6">
      {/* Control Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white font-display flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Short-Dated Put Screener (Weekly / High Theta)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Filters for premium-rich short DTE (≤ {maxDte} days) options with strong safety cushion (moneyness ≤ {maxMoneyness}%) and liquid bid prices (≥ ${minBid}).
            </p>
          </div>

          <button
            onClick={runShortScan}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
            <span>{loading ? "Scanning Chains..." : "Run Short-Dated Screen"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Universe</label>
            <select
              value={universe}
              onChange={(e) => setUniverse(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs outline-none"
            >
              <option value="qqq">QQQ / Nasdaq-100 Leaders</option>
              <option value="watchlist">My Watchlist ({watchlist.length})</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Max DTE (Days to Exp)</label>
            <select
              value={maxDte}
              onChange={(e) => setMaxDte(parseInt(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs outline-none"
            >
              <option value="7">≤ 7 Days (Ultra Short / Weekly)</option>
              <option value="15">≤ 15 Days (2 Weeks)</option>
              <option value="30">≤ 30 Days (1 Month)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Min Bid Premium ($)</label>
            <input
              type="number"
              step="0.25"
              value={minBid}
              onChange={(e) => setMinBid(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Max Moneyness % (Safety)</label>
            <input
              type="number"
              step="1"
              value={maxMoneyness}
              onChange={(e) => setMaxMoneyness(parseFloat(e.target.value) || 90)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs outline-none"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white font-display">
            High-Yield Short-Dated Candidates ({records.length} Contracts)
          </h3>
          <span className="text-xs text-slate-400 font-mono">Sorted by Portfolio Margin Yield</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700/80">
              <tr>
                <th className="px-4 py-3">Ticker</th>
                <th className="px-3 py-3">Expiration (DTE)</th>
                <th className="px-3 py-3">Strike</th>
                <th className="px-3 py-3">Spot</th>
                <th className="px-3 py-3">Moneyness %</th>
                <th className="px-3 py-3">Bid / Ask</th>
                <th className="px-3 py-3">IV %</th>
                <th className="px-3 py-3">OCC Margin Basis</th>
                <th className="px-4 py-3 text-right">Annualized Yield</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500 font-sans">
                    {loading ? "Scanning short-dated options..." : "No contracts met the short-dated screener criteria."}
                  </td>
                </tr>
              ) : (
                records.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-sans font-bold text-white">
                      {r.ticker}
                    </td>
                    <td className="px-3 py-3 text-slate-300">
                      {r.expiration} <span className="text-amber-400 font-bold">({r.days_to_expiration}d)</span>
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-200">${r.strike.toFixed(2)}</td>
                    <td className="px-3 py-3 text-slate-400">${r.current_price.toFixed(2)}</td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold">
                        {r.moneyness_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-300">
                      <span className="text-emerald-400 font-bold">${r.bid.toFixed(2)}</span> / ${r.ask.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-slate-400">{r.implied_volatility}%</td>
                    <td className="px-3 py-3 text-slate-300">${r.capital_basis.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-bold text-emerald-400">
                        {formatPct(r.annualized_return_pct, 2)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
