import React, { useState, useEffect } from "react";
import {
  Layers,
  Search,
  RefreshCw,
  TrendingUp,
  Sliders,
  DollarSign,
  AlertCircle,
  Activity,
  ShieldCheck
} from "lucide-react";
import { OptionChainResponse, OptionGreeks } from "../types";
import { formatCurrency, formatPct } from "../lib/utils";
import { BollingerRsiTooltipBadge } from "./BollingerRsiTooltipBadge";

interface OptionChainViewerProps {
  watchlist: string[];
}

export const OptionChainViewer: React.FC<OptionChainViewerProps> = ({ watchlist }) => {
  const [ticker, setTicker] = useState("QQQ");
  const [selectedExp, setSelectedExp] = useState<string>("");
  const [tab, setTab] = useState<"puts" | "calls">("puts");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chainData, setChainData] = useState<OptionChainResponse | null>(null);

  const fetchChain = async (tickerSymbol: string, expiration?: string) => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/option-chain?ticker=${encodeURIComponent(tickerSymbol)}`;
      if (expiration) url += `&expiration=${encodeURIComponent(expiration)}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      const data: OptionChainResponse = await res.json();
      setChainData(data);
      if (!expiration && data.expirations.length > 0) {
        setSelectedExp(data.selected_expiration || data.expirations[0]);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load option chain");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChain(ticker);
  }, []);

  const handleTickerChange = (newTicker: string) => {
    setTicker(newTicker);
    setSelectedExp("");
    fetchChain(newTicker);
  };

  const handleExpChange = (newExp: string) => {
    setSelectedExp(newExp);
    fetchChain(ticker, newExp);
  };

  const rows = tab === "puts" ? chainData?.puts || [] : chainData?.calls || [];

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white font-display flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" />
              Real-Time Option Chain & Black-Scholes Greeks
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Live quotes with computed Delta, Gamma, Theta (daily decay), Vega (1% IV shock), and Rho (1% interest rate shock).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleTickerChange(ticker)}
              placeholder="Ticker..."
              className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-bold w-28 uppercase outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => handleTickerChange(ticker)}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Fetch
            </button>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-300">Expiration Date:</span>
            <select
              value={selectedExp}
              onChange={(e) => handleExpChange(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            >
              {(chainData?.expirations || []).map((exp) => (
                <option key={exp} value={exp}>
                  {exp}
                </option>
              ))}
            </select>
            {chainData && (
              <span className="text-xs text-slate-400 font-mono">
                ({chainData.days_to_expiration} DTE)
              </span>
            )}
          </div>

          {/* Call / Put Toggle */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setTab("puts")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                tab === "puts"
                  ? "bg-rose-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Puts ({chainData?.puts.length || 0})
            </button>
            <button
              onClick={() => setTab("calls")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                tab === "calls"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Calls ({chainData?.calls.length || 0})
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Spot Price & Technicals Banner */}
      {chainData && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-4">
              <span className="font-bold text-white text-sm">{chainData.ticker} Spot Price:</span>
              <span className="text-lg font-mono font-bold text-blue-400">${chainData.current_price.toFixed(2)}</span>
            </div>
            <div className="text-slate-400 font-mono">
              Selected: <span className="text-slate-200 font-semibold">{chainData.selected_expiration}</span> ({chainData.days_to_expiration} days to exp)
            </div>
          </div>

          {(chainData.rsi_14 !== undefined || chainData.bollinger || chainData.fibonacci) && (
            <div className="pt-2 border-t border-slate-800/80">
              <BollingerRsiTooltipBadge
                spot={chainData.current_price}
                rsi={chainData.rsi_14}
                bollinger={chainData.bollinger}
                fibonacci={chainData.fibonacci}
                fiftyTwoWeekHigh={chainData.fifty_two_week_high}
                fiftyTwoWeekLow={chainData.fifty_two_week_low}
              />
            </div>
          )}
        </div>
      )}

      {/* Chain Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700/80">
              <tr>
                <th className="px-4 py-3">Strike</th>
                <th className="px-3 py-3">Bid / Ask</th>
                <th className="px-3 py-3">Last</th>
                <th className="px-3 py-3">IV %</th>
                <th className="px-3 py-3">Delta (Δ)</th>
                <th className="px-3 py-3">Gamma (Γ)</th>
                <th className="px-3 py-3">Theta (Θ/day)</th>
                <th className="px-3 py-3">Vega (ν/1%)</th>
                <th className="px-3 py-3">Volume</th>
                <th className="px-4 py-3 text-right">Open Int</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-500 font-sans">
                    {loading ? "Fetching option chain..." : "No option contracts found for this expiration."}
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => {
                  const isAtm =
                    chainData?.current_price &&
                    Math.abs(r.strike - chainData.current_price) < (chainData.current_price * 0.01);

                  const isBelowLowerBand =
                    chainData?.bollinger && r.strike < chainData.bollinger.lower_band;

                  return (
                    <tr
                      key={i}
                      className={`hover:bg-slate-800/50 transition-colors ${
                        isBelowLowerBand
                          ? "bg-emerald-950/20"
                          : r.inTheMoney
                          ? "bg-blue-950/20"
                          : ""
                      } ${isAtm ? "border-y-2 border-amber-500/60" : ""}`}
                    >
                      <td className="px-4 py-2.5 font-bold text-white flex items-center gap-2">
                        <span>${r.strike.toFixed(2)}</span>
                        {isBelowLowerBand && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-sans font-bold border border-emerald-500/40" title={`Below 20-Day 2.0σ Lower Bollinger Band ($${chainData.bollinger?.lower_band.toFixed(2)})`}>
                            &lt;BB Lower
                          </span>
                        )}
                        {r.inTheMoney && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 font-sans">
                            ITM
                          </span>
                        )}
                        {isAtm && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-sans font-bold">
                            ATM
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">
                        <span className="text-emerald-400 font-semibold">${r.bid.toFixed(2)}</span> / ${r.ask.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-200">${r.lastPrice.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-amber-400 font-medium">{r.impliedVolatility}%</td>
                      <td className="px-3 py-2.5 text-slate-200 font-semibold">
                        {r.delta !== null ? r.delta : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400">{r.gamma !== null ? r.gamma : "-"}</td>
                      <td className="px-3 py-2.5 text-rose-400 font-semibold">{r.theta !== null ? r.theta : "-"}</td>
                      <td className="px-3 py-2.5 text-cyan-400">{r.vega !== null ? r.vega : "-"}</td>
                      <td className="px-3 py-2.5 text-slate-400">{r.volume.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-slate-300">{r.openInterest.toLocaleString()}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
