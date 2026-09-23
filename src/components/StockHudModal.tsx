import React, { useEffect, useState } from "react";
import {
  X,
  Activity,
  TrendingUp,
  TrendingDown,
  Layers,
  BarChart2,
  Calendar,
  DollarSign,
  ShieldAlert,
  ArrowUpRight,
  ExternalLink,
  Copy,
  Check,
  Compass,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { TechnicalsData } from "../types";
import { ActiveTab } from "./Header";

interface StockHudData {
  ticker: string;
  technicals: TechnicalsData | null;
  profile: {
    ticker?: string;
    companyName?: string;
    sector?: string;
    industry?: string;
    description?: string;
    ceo?: string;
    headquarters?: string;
    ipoYear?: string;
  } | null;
  sparkline: Array<{ date: string; close: number }>;
}

interface StockHudModalProps {
  isOpen: boolean;
  ticker: string | null;
  onClose: () => void;
  onNavigateTab?: (tab: ActiveTab, ticker?: string) => void;
}

export const StockHudModal: React.FC<StockHudModalProps> = ({
  isOpen,
  ticker,
  onClose,
  onNavigateTab,
}) => {
  const [data, setData] = useState<StockHudData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !ticker) {
      setData(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/stock-hud?ticker=${encodeURIComponent(ticker)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load technical HUD data (${res.status})`);
        }
        return res.json();
      })
      .then((json: StockHudData) => {
        if (isMounted) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err.message || "Unable to retrieve technical breakdown");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, ticker]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !ticker) return null;

  const t = data?.technicals;
  const p = data?.profile;
  const currentPrice = t?.current_price ?? 0;
  const ath = t?.all_time_high ?? null;
  const high52 = t?.fifty_two_week_high ?? null;
  const low52 = t?.fifty_two_week_low ?? null;
  const distAth = t?.distance_to_ath_pct ?? (currentPrice && ath ? ((currentPrice - ath) / ath) * 100 : null);
  const dist52w = t?.distance_to_52w_high_pct ?? (currentPrice && high52 ? ((currentPrice - high52) / high52) * 100 : null);

  // 52-week range percentage
  const range52wPct =
    high52 && low52 && high52 > low52 && currentPrice
      ? Math.max(0, Math.min(100, ((currentPrice - low52) / (high52 - low52)) * 100))
      : 50;

  // RSI status
  const rsi = t?.rsi_14 ?? null;
  const isRsiOverbought = rsi !== null && rsi >= 70;
  const isRsiOversold = rsi !== null && rsi <= 30;

  // IV vs HV
  const iv = t?.implied_volatility_pct ?? null;
  const hv = t?.historical_volatility_pct ?? null;
  const ivSpread = iv !== null && hv !== null ? iv - hv : null;

  const handleCopyTicker = () => {
    if (!ticker) return;
    navigator.clipboard.writeText(ticker);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const formatLargeNum = (num: number | null | undefined) => {
    if (!num) return "—";
    if (Math.abs(num) >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toLocaleString()}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-950 border border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-950/40 text-slate-100 overflow-hidden ring-1 ring-cyan-500/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HUD Top Bar Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/25 ring-1 ring-cyan-400/40">
              <Compass className="w-4 h-4 text-white animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono tracking-widest uppercase font-bold text-cyan-400 bg-cyan-950/80 border border-cyan-700/60 px-2 py-0.5 rounded">
                  HUD // TECHNICAL BREAKDOWN
                </span>
                <span className="text-xl font-extrabold text-white font-mono tracking-tight">
                  {ticker}
                </span>
                <button
                  type="button"
                  onClick={handleCopyTicker}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                  title="Copy Ticker"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span className="font-medium text-slate-300">
                  {p?.companyName || "Equities / Security"}
                </span>
                {p?.sector && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-[11px] text-cyan-300/80">{p.sector}</span>
                  </>
                )}
                {p?.industry && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-[11px] text-slate-400">{p.industry}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentPrice > 0 && (
              <div className="text-right">
                <div className="text-xs text-slate-400 font-mono">Current Spot</div>
                <div className="text-lg font-bold text-emerald-400 font-mono">
                  ${currentPrice.toFixed(2)}
                </div>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors ml-2"
              title="Close HUD (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body with Scroll */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 font-sans text-xs">
          {loading && !data ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <div className="text-sm font-mono text-cyan-300 animate-pulse">
                Scanning multi-year technicals & indicators for {ticker}...
              </div>
            </div>
          ) : error ? (
            <div className="p-6 bg-rose-950/20 border border-rose-800/50 rounded-xl text-rose-300 flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <div>
                <div className="font-bold">Failed to load technical HUD</div>
                <div className="text-xs text-rose-400 mt-0.5">{error}</div>
              </div>
            </div>
          ) : (
            <>
              {/* Top Row: ATH, 52W High, RSI, IV vs HV */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. All-Time High (ATH) */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2 hover:border-cyan-500/40 transition-colors">
                  <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                    <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-cyan-300">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      All-Time High (ATH)
                    </span>
                    <span className="text-[10px] text-slate-500">Multi-Year</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold font-mono text-white">
                      {ath ? `$${ath.toFixed(2)}` : "—"}
                    </span>
                    {distAth !== null && (
                      <span
                        className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                          distAth >= -5
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : distAth >= -15
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {distAth >= 0 ? `+${distAth.toFixed(1)}%` : `${distAth.toFixed(1)}%`}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {distAth !== null && distAth >= -5 ? (
                      <span className="text-emerald-400 font-medium">Near Peak / ATH Test Zone</span>
                    ) : distAth !== null && distAth >= -15 ? (
                      <span className="text-amber-300">Mild Pullback from ATH</span>
                    ) : (
                      <span className="text-rose-400 font-medium">
                        {distAth ? `${Math.abs(distAth).toFixed(0)}% Drawdown from Record High` : "Historical High"}
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. 52-Week High & Range */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2 hover:border-cyan-500/40 transition-colors">
                  <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                    <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-amber-300">
                      <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                      52-Week High / Range
                    </span>
                    <span className="text-[10px] text-slate-500">1-Year</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold font-mono text-white">
                      {high52 ? `$${high52.toFixed(2)}` : "—"}
                    </span>
                    {dist52w !== null && (
                      <span
                        className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                          dist52w >= -5
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {dist52w >= 0 ? `+${dist52w.toFixed(1)}%` : `${dist52w.toFixed(1)}%`}
                      </span>
                    )}
                  </div>
                  {/* Range visual bar */}
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                      <div
                        className="bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-400 rounded-full"
                        style={{ width: `${range52wPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-slate-500">
                      <span>Low: ${low52 ? low52.toFixed(2) : "—"}</span>
                      <span className="text-cyan-400 font-bold">{range52wPct.toFixed(0)}% Range</span>
                      <span>High: ${high52 ? high52.toFixed(2) : "—"}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Wilder's RSI (14) */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2 hover:border-purple-500/40 transition-colors">
                  <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                    <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-purple-300">
                      <Activity className="w-3.5 h-3.5 text-purple-400" />
                      14-Day RSI Oscillator
                    </span>
                    <span className="text-[10px] text-slate-500">Momentum</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold font-mono text-white">
                      {rsi !== null ? rsi.toFixed(1) : "—"}
                    </span>
                    <span
                      className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                        isRsiOverbought
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          : isRsiOversold
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                      }`}
                    >
                      {isRsiOverbought ? "Overbought" : isRsiOversold ? "Oversold" : "Neutral"}
                    </span>
                  </div>
                  {/* RSI Scale Visual */}
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex relative">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isRsiOverbought ? "bg-rose-500" : isRsiOversold ? "bg-emerald-400" : "bg-purple-400"
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, rsi ?? 50))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-slate-500">
                      <span>30 (OS)</span>
                      <span>50 (Mid)</span>
                      <span>70 (OB)</span>
                    </div>
                  </div>
                </div>

                {/* 4. Implied Volatility & HV Spread */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2 hover:border-blue-500/40 transition-colors">
                  <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                    <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-blue-300">
                      <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
                      Volatility Spectrum
                    </span>
                    <span className="text-[10px] text-slate-500">IV vs HV</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-xl font-bold font-mono text-white">
                        {iv !== null ? `${iv.toFixed(1)}%` : "—"}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-1 font-mono">IV</span>
                    </div>
                    {hv !== null && (
                      <div className="text-right">
                        <span className="text-sm font-bold font-mono text-slate-300">
                          {hv.toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-slate-500 ml-1 font-mono">Realized</span>
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>IV Spread:</span>
                    <span
                      className={`font-mono font-bold ${
                        ivSpread !== null && ivSpread > 0 ? "text-emerald-400" : "text-slate-300"
                      }`}
                    >
                      {ivSpread !== null
                        ? `${ivSpread > 0 ? "+" : ""}${ivSpread.toFixed(1)}% (${
                            ivSpread > 0 ? "IV Rich / High Edge" : "IV Cheap"
                          })`
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Middle Section: Technical Structure & Bollinger Bands & Fibonacci */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Bollinger Bands Breakdown */}
                <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2 font-bold font-mono text-sky-400 text-xs uppercase tracking-wider">
                      <Layers className="w-4 h-4" />
                      Bollinger Bands (20d, 2.0σ)
                    </div>
                    {t?.bollinger?.zone && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/10 text-sky-300 border border-sky-500/20">
                        {t.bollinger.zone}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 font-mono text-center">
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                      <div className="text-[10px] text-slate-500 uppercase">Upper Band</div>
                      <div className="text-sm font-bold text-sky-300 mt-0.5">
                        {t?.bollinger?.upper_band ? `$${t.bollinger.upper_band.toFixed(2)}` : "—"}
                      </div>
                    </div>
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                      <div className="text-[10px] text-slate-500 uppercase">20 SMA Midline</div>
                      <div className="text-sm font-bold text-amber-300 mt-0.5">
                        {t?.bollinger?.sma ? `$${t.bollinger.sma.toFixed(2)}` : "—"}
                      </div>
                    </div>
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                      <div className="text-[10px] text-slate-500 uppercase">Lower Band</div>
                      <div className="text-sm font-bold text-sky-300 mt-0.5">
                        {t?.bollinger?.lower_band ? `$${t.bollinger.lower_band.toFixed(2)}` : "—"}
                      </div>
                    </div>
                  </div>

                  {t?.bollinger?.percent_b !== undefined && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-slate-400">Position in Band (%B):</span>
                        <span className="text-white font-bold">
                          {(t.bollinger.percent_b * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                        <div
                          className="bg-sky-400 rounded-full transition-all"
                          style={{
                            width: `${Math.max(0, Math.min(100, t.bollinger.percent_b * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {t?.historical_volatility_dollar_yr && (
                    <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
                      <span>Annual Dollar Volatility:</span>
                      <span className="text-slate-200 font-bold">
                        ±${t.historical_volatility_dollar_yr.toFixed(2)} / yr
                      </span>
                    </div>
                  )}
                </div>

                {/* Fibonacci Retracement Levels */}
                <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2 font-bold font-mono text-indigo-400 text-xs uppercase tracking-wider">
                      <Compass className="w-4 h-4" />
                      Fibonacci Retracement Grid (52W)
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Key Inflection Levels</span>
                  </div>

                  {t?.fibonacci ? (
                    <div className="space-y-1.5 font-mono text-[11px]">
                      <div className="flex justify-between items-center p-1.5 rounded bg-slate-950/40 border border-slate-800/40">
                        <span className="text-rose-400 font-semibold">100.0% (52W High)</span>
                        <span className="text-white font-bold">${t.fibonacci.level_1000.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center p-1.5 rounded bg-slate-950/40 border border-slate-800/40">
                        <span className="text-amber-400 font-semibold">61.8% Golden Ratio</span>
                        <span className="text-white font-bold">${t.fibonacci.level_618.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center p-1.5 rounded bg-slate-950/40 border border-slate-800/40">
                        <span className="text-indigo-300 font-semibold">50.0% Equilibrium</span>
                        <span className="text-white font-bold">${t.fibonacci.level_500.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center p-1.5 rounded bg-slate-950/40 border border-slate-800/40">
                        <span className="text-cyan-400 font-semibold">38.2% Key Support</span>
                        <span className="text-white font-bold">${t.fibonacci.level_382.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center p-1.5 rounded bg-slate-950/40 border border-slate-800/40">
                        <span className="text-emerald-400 font-semibold">0.0% (52W Low)</span>
                        <span className="text-white font-bold">${t.fibonacci.level_0.toFixed(2)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-500 font-mono text-xs">
                      52-week range data insufficient for Fibonacci calculation.
                    </div>
                  )}
                </div>
              </div>

              {/* Analyst Consensus & Upcoming Catalysts Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Analyst Target */}
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-mono">Analyst Consensus</div>
                    <div className="text-base font-bold text-white font-mono mt-0.5">
                      {t?.analyst_target_mean ? `$${t.analyst_target_mean.toFixed(2)}` : "—"}
                    </div>
                  </div>
                  {t?.analyst_upside_pct !== null && t?.analyst_upside_pct !== undefined && (
                    <div className="text-right font-mono">
                      <span
                        className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          t.analyst_upside_pct >= 0
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {t.analyst_upside_pct >= 0
                          ? `+${t.analyst_upside_pct.toFixed(1)}%`
                          : `${t.analyst_upside_pct.toFixed(1)}%`}
                      </span>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {t.analyst_count ? `${t.analyst_count} analysts` : "Wall St"}
                      </div>
                    </div>
                  )}
                </div>

                {/* Market Cap & IPO */}
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-mono">Market Cap</div>
                    <div className="text-base font-bold text-cyan-300 font-mono mt-0.5">
                      {formatLargeNum(t?.market_cap)}
                    </div>
                  </div>
                  {p?.ipoYear && (
                    <div className="text-right text-[10px] font-mono text-slate-400">
                      <div>IPO Year</div>
                      <div className="text-white font-bold">{p.ipoYear}</div>
                    </div>
                  )}
                </div>

                {/* Earnings Date */}
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-mono flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-400" />
                      Next Earnings
                    </div>
                    <div className="text-sm font-bold text-amber-300 font-mono mt-0.5">
                      {t?.next_earnings_date || "TBD"}
                    </div>
                  </div>
                  {t?.next_earnings_date && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono font-bold">
                      Upcoming
                    </span>
                  )}
                </div>
              </div>

              {/* Mini Sparkline Chart */}
              {data?.sparkline && data.sparkline.length > 5 && (
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono">
                    <span className="flex items-center gap-1.5 text-cyan-400 font-bold uppercase tracking-wider">
                      <Activity className="w-3.5 h-3.5" />
                      60-Day Price Trend
                    </span>
                    <span className="text-[10px] text-slate-500">Daily Closes</span>
                  </div>
                  <div className="h-24 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.sparkline} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                        <defs>
                          <linearGradient id="hudSparklineGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" hide />
                        <YAxis domain={["auto", "auto"]} hide />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null;
                            const d = payload[0].payload;
                            return (
                              <div className="bg-slate-950 border border-cyan-500/50 rounded-lg p-2 text-[11px] font-mono shadow-xl">
                                <div className="text-slate-400">{d.date}</div>
                                <div className="text-white font-bold">${d.close?.toFixed(2)}</div>
                              </div>
                            );
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="close"
                          stroke="#06b6d4"
                          strokeWidth={2}
                          fill="url(#hudSparklineGrad)"
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer with Direct Navigation Links */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/80 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-mono">Quick Inspect:</span>
            {onNavigateTab && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateTab("stock-charts", ticker);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  Stock Charts
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateTab("option-chain", ticker);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Option Chain
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateTab("put-recommendations", ticker);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-white rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Put Recommendations
                </button>
              </>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-md transition-colors"
          >
            Close HUD
          </button>
        </div>
      </div>
    </div>
  );
};
