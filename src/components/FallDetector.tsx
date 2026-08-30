import React, { useState, useEffect } from "react";
import {
  TrendingDown,
  AlertTriangle,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Activity,
  Calendar,
  Building,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  HelpCircle
} from "lucide-react";
import { FallenStock } from "../types";
import { formatCurrency, formatPct, formatLargeNumber } from "../lib/utils";
import { StatCard } from "./StatCard";

interface FallDetectorProps {
  watchlist: string[];
}

export const FallDetector: React.FC<FallDetectorProps> = ({ watchlist }) => {
  const [lookbackDays, setLookbackDays] = useState(7);
  const [fallThresholdPct, setFallThresholdPct] = useState(8.0);
  const [minMarketCapB, setMinMarketCapB] = useState(5.0); // $5B
  const [universe, setUniverse] = useState<"qqq" | "watchlist" | "custom">("qqq");
  const [customTickers, setCustomTickers] = useState("NVDA, AMD, INTC, MU, TSLA, AAPL, AMZN, MSFT, META, GOOGL, NFLX, PLTR, ARM");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<FallenStock[]>([]);
  const [scannedCount, setScannedCount] = useState<number>(0);

  const runDetector = async () => {
    setLoading(true);
    setError(null);

    let tickersToPass = "";
    if (universe === "watchlist") tickersToPass = watchlist.join(",");
    else if (universe === "custom") tickersToPass = customTickers;

    try {
      const queryParams = new URLSearchParams({
        days: String(lookbackDays),
        fallPct: String(fallThresholdPct),
        minMarketCap: String(minMarketCapB * 1e9),
      });
      if (tickersToPass) queryParams.set("tickers", tickersToPass);

      const res = await fetch(`/api/fall-detector?${queryParams.toString()}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}: ${res.statusText}`);

      const data = await res.json();
      setResults(data.results || []);
      setScannedCount(data.scanned_count || 0);
    } catch (err: any) {
      setError(err.message || "Failed to run fall detector");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDetector();
  }, [universe]);

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white font-display flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-rose-400" />
              Stock Fall Detector & Deep Context Analyzer
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Scans universe for steep drop-offs, correlates with 14d RSI & Bollinger technicals, and pulls news, Wall Street consensus, and StockTwits sentiment.
            </p>
          </div>

          <button
            id="run-fall-detector-btn"
            onClick={runDetector}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>{loading ? "Scanning Universe..." : "Detect Fallen Stocks"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
          {/* Universe selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Universe</label>
            <select
              value={universe}
              onChange={(e) => setUniverse(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-rose-500 outline-none"
            >
              <option value="qqq">QQQ / Nasdaq-100 Universe</option>
              <option value="watchlist">My Watchlist ({watchlist.length} tickers)</option>
              <option value="custom">Custom Ticker List</option>
            </select>
          </div>

          {/* Lookback Days */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Lookback Window (Days)</label>
            <select
              value={lookbackDays}
              onChange={(e) => setLookbackDays(parseInt(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-rose-500 outline-none"
            >
              <option value="3">Last 3 Days</option>
              <option value="7">Last 7 Days (1 Week)</option>
              <option value="14">Last 14 Days (2 Weeks)</option>
              <option value="30">Last 30 Days (1 Month)</option>
              <option value="60">Last 60 Days (2 Months)</option>
            </select>
          </div>

          {/* Fall Threshold % */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Fall Threshold (% Drop)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="90"
                step="0.5"
                value={fallThresholdPct}
                onChange={(e) => setFallThresholdPct(parseFloat(e.target.value) || 8.0)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs outline-none"
              />
              <span className="text-slate-400 text-xs font-semibold">%</span>
            </div>
          </div>

          {/* Min Market Cap */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Min Market Cap</label>
            <select
              value={minMarketCapB}
              onChange={(e) => setMinMarketCapB(parseFloat(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-rose-500 outline-none"
            >
              <option value="1">$1 Billion+</option>
              <option value="5">$5 Billion+</option>
              <option value="10">$10 Billion+ (Large Cap)</option>
              <option value="50">$50 Billion+ (Mega Cap)</option>
            </select>
          </div>
        </div>

        {universe === "custom" && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <label className="block text-xs font-semibold text-slate-300 mb-1">Custom Tickers</label>
            <input
              type="text"
              value={customTickers}
              onChange={(e) => setCustomTickers(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs outline-none"
            />
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Tickers Scanned"
          value={scannedCount}
          subValue="Equities"
          trend="neutral"
          icon={<Filter className="w-4 h-4" />}
        />
        <StatCard
          label="Fallen Stocks Detected"
          value={results.length}
          subValue={`≥ ${fallThresholdPct}% drop`}
          trend={results.length > 0 ? "down" : "neutral"}
          icon={<TrendingDown className="w-4 h-4 text-rose-400" />}
        />
        <StatCard
          label="Lookback Duration"
          value={`${lookbackDays} Days`}
          trend="neutral"
          icon={<Calendar className="w-4 h-4 text-blue-400" />}
        />
        <StatCard
          label="Market Cap Filter"
          value={`≥ $${minMarketCapB}B`}
          trend="neutral"
          icon={<Building className="w-4 h-4 text-cyan-400" />}
        />
      </div>

      {/* Results List */}
      <div className="space-y-4">
        {loading && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-rose-500" />
            <p className="font-semibold text-white">Scanning prices, technicals, news & sentiment...</p>
            <p className="text-xs text-slate-500 mt-1">Analyzing price series over lookback window</p>
          </div>
        )}

        {!loading && results.length === 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3 opacity-80" />
            <h3 className="text-base font-bold text-white">No Fallen Stocks Detected</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              No equities in the selected universe fell more than {fallThresholdPct}% over the last {lookbackDays} days with market cap ≥ ${minMarketCapB}B.
            </p>
          </div>
        )}

        {!loading &&
          results.map((stock) => {
            const tech = stock.technicals;
            const ctx = stock.context;
            const rsi = tech?.rsi_14;

            return (
              <div
                key={stock.ticker}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700/90 rounded-2xl p-6 shadow-xl transition-all"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center font-display font-bold text-lg text-rose-400">
                      {stock.ticker}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-white font-display">{stock.ticker}</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 font-bold text-xs">
                          {formatPct(stock.pct_change, 2, true)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Pre-Drop: <span className="text-slate-200 font-mono font-medium">${stock.start_price.toFixed(2)}</span> ({stock.start_date}) → Current:{" "}
                        <span className="text-rose-400 font-mono font-bold">${stock.end_price.toFixed(2)}</span> ({stock.end_date})
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Pre-Fall Market Cap</span>
                    <span className="text-sm font-bold text-white font-mono">
                      {formatLargeNumber(stock.market_cap_before)}
                    </span>
                  </div>
                </div>

                {/* Technical Indicators Row */}
                {tech && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 border-b border-slate-800/80">
                    {/* RSI */}
                    <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
                      <span className="text-[11px] text-slate-400 block">14-Day RSI</span>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-base font-bold font-mono ${
                          (rsi ?? 50) <= 30 ? "text-emerald-400" : (rsi ?? 50) >= 70 ? "text-rose-400" : "text-blue-400"
                        }`}>
                          {rsi !== null ? rsi : "N/A"}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                          (rsi ?? 50) <= 30 ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-400"
                        }`}>
                          {(rsi ?? 50) <= 30 ? "Oversold" : (rsi ?? 50) >= 70 ? "Overbought" : "Neutral"}
                        </span>
                      </div>
                    </div>

                    {/* Bollinger Zone */}
                    <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
                      <span className="text-[11px] text-slate-400 block">Bollinger %B (Zone)</span>
                      <div className="mt-1">
                        <span className="text-sm font-bold text-white font-mono">
                          {tech.bollinger?.percent_b !== undefined ? `${(tech.bollinger.percent_b * 100).toFixed(1)}%` : "N/A"}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {tech.bollinger?.zone || "-"}
                        </span>
                      </div>
                    </div>

                    {/* Implied Volatility */}
                    <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
                      <span className="text-[11px] text-slate-400 block">Implied Volatility (ATM)</span>
                      <div className="mt-1">
                        <span className="text-sm font-bold text-amber-400 font-mono">
                          {tech.implied_volatility_pct ? `${tech.implied_volatility_pct}%` : "N/A"}
                        </span>
                        <span className="text-[10px] text-slate-500 block">~30d ATM Options</span>
                      </div>
                    </div>

                    {/* Distance from 52w / ATH */}
                    <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
                      <span className="text-[11px] text-slate-400 block">Distance to Highs</span>
                      <div className="mt-1">
                        <span className="text-xs text-rose-400 font-mono font-semibold block">
                          52W: {formatPct(tech.distance_to_52w_high_pct, 1, true)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          ATH: {formatPct(tech.distance_to_ath_pct, 1, true)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Deep Context: News, Wall Street Consensus, Sentiment */}
                {ctx && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-4">
                    {/* Analyst Consensus */}
                    <div className="bg-slate-950/40 rounded-xl p-4 border border-slate-800/60">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-blue-400" />
                        Analyst Consensus & Target
                      </h4>
                      {ctx.analyst?.mean_target_price ? (
                        <div>
                          <div className="flex items-baseline justify-between">
                            <span className="text-xs text-slate-400">Mean Price Target</span>
                            <span className="text-base font-bold text-emerald-400 font-mono">
                              ${ctx.analyst.mean_target_price.toFixed(2)}
                            </span>
                          </div>
                          {ctx.analyst.upside_pct !== null && (
                            <div className="flex items-center justify-between text-xs mt-1">
                              <span className="text-slate-400">Implied Upside</span>
                              <span className="text-emerald-400 font-bold font-mono">
                                +{ctx.analyst.upside_pct}%
                              </span>
                            </div>
                          )}
                          <div className="mt-2 text-[11px] text-slate-400">
                            Rating: <span className="text-white font-semibold capitalize">{ctx.analyst.recommendation || "Hold"}</span> ({ctx.analyst.num_analysts || 0} analysts)
                          </div>

                          {/* Recent actions */}
                          {ctx.analyst.recent_actions && ctx.analyst.recent_actions.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-slate-800 space-y-1">
                              <span className="text-[10px] text-slate-500 uppercase font-semibold">Recent Actions:</span>
                              {ctx.analyst.recent_actions.map((act, idx) => (
                                <div key={idx} className="text-[11px] text-slate-300 flex items-center justify-between truncate">
                                  <span className="truncate">{act.firm}: <span className="text-blue-400">{act.action}</span> ({act.to_grade})</span>
                                  {act.price_target && <span className="font-mono text-slate-400">${act.price_target}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">No analyst targets available for this ticker.</p>
                      )}
                    </div>

                    {/* StockTwits Sentiment */}
                    <div className="bg-slate-950/40 rounded-xl p-4 border border-slate-800/60">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-cyan-400" />
                        StockTwits Social Sentiment
                      </h4>
                      {ctx.social ? (
                        <div>
                          <div className="flex items-center justify-between text-xs mb-2">
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <ThumbsUp className="w-3 h-3" /> {ctx.social.bullish_pct}% Bullish
                            </span>
                            <span className="text-rose-400 font-semibold flex items-center gap-1">
                              <ThumbsDown className="w-3 h-3" /> {ctx.social.bearish_pct}% Bearish
                            </span>
                          </div>
                          {/* Visual progress bar */}
                          <div className="w-full h-2.5 bg-rose-500/40 rounded-full overflow-hidden flex">
                            <div
                              style={{ width: `${ctx.social.bullish_pct}%` }}
                              className="h-full bg-emerald-500"
                            />
                            <div
                              style={{ width: `${ctx.social.bearish_pct}%` }}
                              className="h-full bg-rose-500"
                            />
                          </div>
                          <span className="text-[10px] text-slate-500 block mt-2">
                            Sampled from {ctx.social.sample_size} tagged messages
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">No active sentiment tags detected on StockTwits stream.</p>
                      )}
                    </div>

                    {/* News Headlines */}
                    <div className="bg-slate-950/40 rounded-xl p-4 border border-slate-800/60">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-400" />
                        Recent News Headlines
                      </h4>
                      {ctx.headlines && ctx.headlines.length > 0 ? (
                        <div className="space-y-2">
                          {ctx.headlines.slice(0, 3).map((item, idx) => (
                            <a
                              key={idx}
                              href={item.link || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block group text-xs text-slate-300 hover:text-blue-400 transition truncate"
                            >
                              <div className="flex items-center gap-1 truncate">
                                <span className="font-medium truncate group-hover:underline">{item.title}</span>
                                <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                              </div>
                              <span className="text-[10px] text-slate-500">
                                {item.publisher} {item.published_at && `• ${item.published_at}`}
                              </span>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">No recent articles found for this ticker.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
};
