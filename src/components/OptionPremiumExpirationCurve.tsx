import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  Activity,
  Layers,
  HelpCircle,
  X,
  AlertCircle,
  RefreshCw,
  Compass,
  ArrowRight,
  Info,
} from "lucide-react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface OptionPremiumExpirationCurveProps {
  ticker: string;
  pinnedBar: {
    date: string;
    close: number;
    [key: string]: any;
  };
  onClose?: () => void;
}

interface OptionContract {
  strike: number;
  contractSymbol: string;
  bid: number;
  ask: number;
  lastPrice: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  expiration: string;
  days_to_expiration: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
}

interface OptionChainResponse {
  primaryTicker: string;
  allPuts?: OptionContract[];
  allCalls?: OptionContract[];
  expirations?: string[];
}

export const OptionPremiumExpirationCurve: React.FC<OptionPremiumExpirationCurveProps> = ({
  ticker,
  pinnedBar,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [puts, setPuts] = useState<OptionContract[]>([]);

  // Strike & Delta states
  const [strikeInput, setStrikeInput] = useState<string>("");
  const [selectedStrike, setSelectedStrike] = useState<number>(0);
  const [deltaMin, setDeltaMin] = useState<number>(0.10);
  const [deltaMax, setDeltaMax] = useState<number>(0.45);

  // Initialize strike price when a point is pinned or clicked
  useEffect(() => {
    if (pinnedBar && (pinnedBar.clickedPrice !== undefined || pinnedBar.close)) {
      // Prefer clickedPrice (the vertical mouse position) over simple closing price
      const targetPrice = pinnedBar.clickedPrice !== undefined ? pinnedBar.clickedPrice : pinnedBar.close;
      
      // Highly precise strike matching:
      // - Under $15: Round to nearest $0.50 (common for low priced stock option listings)
      // - Above $15: Round to the nearest $1.00 (captures $1 intervals exactly)
      let initialStrike = Math.round(targetPrice);
      if (targetPrice < 15) {
        initialStrike = Math.round(targetPrice * 2) / 2;
      }
      
      if (initialStrike <= 0) initialStrike = Math.round(targetPrice);

      setSelectedStrike(initialStrike);
      setStrikeInput(initialStrike.toString());
    }
  }, [pinnedBar]);

  // Fetch full options matrix across maturities
  useEffect(() => {
    if (!ticker) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/option-chain?ticker=${encodeURIComponent(ticker)}&all=true`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server returned ${res.status}: ${res.statusText}`);
        return res.json() as Promise<OptionChainResponse>;
      })
      .then((data: any) => {
        if (!isMounted) return;
        const putsList = data.all_puts || data.allPuts || data.puts;
        if (putsList && Array.isArray(putsList) && putsList.length > 0) {
          setPuts(putsList);
        } else {
          setPuts([]);
          setError("No put options found for this ticker across maturities.");
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading options chain for curve:", err);
        if (isMounted) {
          setError(err.message || "Failed to fetch live option chains.");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [ticker]);

  // Handle strike submission
  const handleStrikeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(strikeInput);
    if (!isNaN(parsed) && parsed > 0) {
      setSelectedStrike(parsed);
    } else {
      setStrikeInput(selectedStrike.toString());
    }
  };

  // Compile premium curves vs. expiration dates
  const curveData = useMemo(() => {
    if (puts.length === 0 || selectedStrike <= 0) return [];

    // Group puts by expiration
    const expGroups: Record<string, OptionContract[]> = {};
    puts.forEach((p) => {
      if (!expGroups[p.expiration]) {
        expGroups[p.expiration] = [];
      }
      expGroups[p.expiration].push(p);
    });

    const dataset: any[] = [];

    Object.keys(expGroups).forEach((exp) => {
      const contracts = expGroups[exp];
      
      // Find contract closest to selectedStrike
      let bestContract = contracts[0];
      let bestDiff = Math.abs(bestContract.strike - selectedStrike);

      contracts.forEach((c) => {
        const diff = Math.abs(c.strike - selectedStrike);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestContract = c;
        }
      });

      // We only map if the strike is reasonably close (within 10% to prevent giant jumps at far expirations)
      const strikeTolerance = selectedStrike * 0.15;
      if (bestDiff > strikeTolerance) return;

      const dte = bestContract.days_to_expiration;
      if (dte > 1000 || dte <= 1) return; // Keep up to 1000 days

      // Calculate absolute Put Delta
      const delta = bestContract.delta !== undefined ? bestContract.delta : -0.30;
      const absDelta = Math.abs(delta);

      // Delta Slider filter limit
      if (absDelta < deltaMin || absDelta > deltaMax) return;

      // Calculate Option Premium (mid price fallback to bid)
      let premium = bestContract.bid;
      if (bestContract.bid > 0 && bestContract.ask > 0) {
        premium = (bestContract.bid + bestContract.ask) / 2;
      } else if (bestContract.bid <= 0 && bestContract.ask > 0) {
        premium = bestContract.ask * 0.85; // proxy
      } else if (premium <= 0 && bestContract.lastPrice > 0) {
        premium = bestContract.lastPrice;
      }

      if (premium <= 0) return;

      // Annualized CSP yield formula
      const annualizedReturn = (premium / selectedStrike) * (365 / dte) * 100;

      dataset.push({
        expiration: exp,
        dte,
        label: `${exp.slice(5)} (${dte}d)`,
        strike: bestContract.strike,
        premium: Number(premium.toFixed(2)),
        annualizedReturn: Number(annualizedReturn.toFixed(2)),
        delta: Number(delta.toFixed(3)),
        iv: bestContract.impliedVolatility,
        bid: bestContract.bid,
        ask: bestContract.ask,
        symbol: bestContract.contractSymbol,
      });
    });

    // Sort chronologically by DTE
    return dataset.sort((a, b) => a.dte - b.dte);
  }, [puts, selectedStrike, deltaMin, deltaMax]);

  // Statistics summaries for the target filtered set
  const stats = useMemo(() => {
    if (curveData.length === 0) return null;
    let maxPremium = 0;
    let maxYield = 0;
    let bestExpPremium = "";
    let bestExpYield = "";

    curveData.forEach((d) => {
      if (d.premium > maxPremium) {
        maxPremium = d.premium;
        bestExpPremium = d.label;
      }
      if (d.annualizedReturn > maxYield) {
        maxYield = d.annualizedReturn;
        bestExpYield = d.label;
      }
    });

    return {
      count: curveData.length,
      maxPremium,
      bestExpPremium,
      maxYield,
      bestExpYield,
    };
  }, [curveData]);

  return (
    <div className="bg-slate-900 border-2 border-cyan-400/50 rounded-2xl p-4 md:p-5 shadow-xl space-y-4">
      {/* Panel Title & Close Button */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Layers className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
              Options Premium vs. Expiration Curve Analyzer
            </h3>
            <p className="text-[11px] text-slate-400">
              Live curve up to 1000 days mapped to your pinned stock point (${pinnedBar.close?.toFixed(2)} on {pinnedBar.date})
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Close Options Analyzer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Control Panel: Strike Input & Delta Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
        {/* Left: Strike Input */}
        <div className="md:col-span-4 flex flex-col justify-center space-y-1.5 border-r border-slate-800/60 pr-4">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span>🎯 Strike Price Selection</span>
          </label>
          <form onSubmit={handleStrikeSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">$</span>
              <input
                type="number"
                step="0.5"
                value={strikeInput}
                onChange={(e) => setStrikeInput(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-6 pr-2 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-cyan-500 transition"
                placeholder="Strike"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg text-xs transition cursor-pointer active:scale-95 shadow-md shadow-cyan-600/10 shrink-0"
            >
              Set Strike
            </button>
          </form>
          <div className="text-[10px] text-slate-500 flex flex-col gap-0.5">
            <div className="flex justify-between">
              <span>Close: ${pinnedBar.close?.toFixed(2)}</span>
              <button
                type="button"
                onClick={() => {
                  const rounded = Math.round(pinnedBar.close);
                  setSelectedStrike(rounded);
                  setStrikeInput(rounded.toString());
                }}
                className="text-cyan-400 hover:underline cursor-pointer"
              >
                Reset to Close
              </button>
            </div>
            {pinnedBar.clickedPrice !== undefined && (
              <div className="flex justify-between">
                <span>Click Spot: ${pinnedBar.clickedPrice?.toFixed(2)}</span>
                <button
                  type="button"
                  onClick={() => {
                    const rounded = Math.round(pinnedBar.clickedPrice);
                    setSelectedStrike(rounded);
                    setStrikeInput(rounded.toString());
                  }}
                  className="text-cyan-400 hover:underline cursor-pointer"
                >
                  Reset to Click Spot
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Center/Right: Delta Range Filters */}
        <div className="md:col-span-8 flex flex-col justify-center space-y-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>🛡️ Delta Range Risk Filter</span>
            <span className="text-cyan-300 font-mono font-bold bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md">
              Filter: Put Δ {deltaMin.toFixed(2)} to {deltaMax.toFixed(2)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Min Delta Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>Minimum Absolute Put Delta</span>
                <span className="text-slate-300 font-bold">{deltaMin.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.45"
                step="0.01"
                value={deltaMin}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setDeltaMin(val);
                  if (val > deltaMax) setDeltaMax(val);
                }}
                className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Max Delta Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>Maximum Absolute Put Delta</span>
                <span className="text-slate-300 font-bold">{deltaMax.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.65"
                step="0.01"
                value={deltaMax}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setDeltaMax(val);
                  if (val < deltaMin) setDeltaMin(val);
                }}
                className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Analysis Chart Area */}
      {loading ? (
        <div className="h-64 bg-slate-950/60 rounded-xl border border-slate-800/80 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
          <span className="text-xs text-slate-400 font-mono animate-pulse">
            Fetching live options chain for {ticker} across maturities (next 1000 days)...
          </span>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      ) : curveData.length === 0 ? (
        <div className="h-64 bg-slate-950/60 rounded-xl border border-slate-800/80 flex flex-col items-center justify-center p-6 text-center space-y-2">
          <Info className="w-8 h-8 text-amber-500" />
          <p className="text-xs text-slate-300 font-semibold">
            No option contracts match your active Put Delta filter for the ${selectedStrike} strike.
          </p>
          <p className="text-[11px] text-slate-500 max-w-md">
            The options at this strike might have Deltas outside the current range of {deltaMin.toFixed(2)} to {deltaMax.toFixed(2)}. Try widening the Delta filter or adjusting your Strike Price up or down.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Quick Metrics Bar */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-500">Maturities</span>
                <span className="text-base font-bold font-mono text-cyan-300">{stats.count} dates</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-500">Target Strike</span>
                <span className="text-base font-bold font-mono text-white">${selectedStrike}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-500">Peak Premium ($)</span>
                <span className="text-base font-bold font-mono text-emerald-400">
                  ${stats.maxPremium.toFixed(2)}{" "}
                  <span className="text-[10px] text-slate-500 font-normal">({stats.bestExpPremium.split(" ")[0]})</span>
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-500">Peak CSP Yield (Ann)</span>
                <span className="text-base font-bold font-mono text-amber-400">
                  {stats.maxYield.toFixed(1)}%{" "}
                  <span className="text-[10px] text-slate-500 font-normal">({stats.bestExpYield.split(" ")[0]})</span>
                </span>
              </div>
            </div>
          )}

          {/* Recharts Canvas */}
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={curveData} margin={{ top: 10, right: 10, bottom: 5, left: -15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#475569" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                
                {/* Left Y Axis: Put Premium ($) */}
                <YAxis
                  yAxisId="premium"
                  stroke="#06b6d4"
                  tickFormatter={(val) => `$${val}`}
                  tick={{ fill: "#06b6d4", fontSize: 10 }}
                  label={{ value: "Put Option Premium ($)", angle: -90, position: "insideLeft", fill: "#06b6d4", fontSize: 10, offset: 5 }}
                />

                {/* Right Y Axis: Annualized CSP Return (%) */}
                <YAxis
                  yAxisId="yield"
                  orientation="right"
                  stroke="#f59e0b"
                  tickFormatter={(val) => `${val}%`}
                  tick={{ fill: "#f59e0b", fontSize: 10 }}
                  label={{ value: "Annualized Yield (%)", angle: 90, position: "insideRight", fill: "#f59e0b", fontSize: 10 }}
                />

                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-slate-950/95 border-2 border-cyan-500/40 rounded-xl p-3 shadow-2xl text-xs font-mono backdrop-blur-md min-w-[210px] space-y-1.5 text-slate-200">
                        <div className="font-bold border-b border-slate-800 pb-1 flex justify-between items-center text-slate-300">
                          <span className="text-white">{d.expiration}</span>
                          <span className="text-slate-400 text-[10px]">{d.dte} days</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Strike Choice:</span>
                          <span className="text-white font-bold">${d.strike}</span>
                        </div>
                        <div className="flex justify-between text-cyan-400">
                          <span>Put Premium:</span>
                          <span className="font-bold">${d.premium.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-amber-400">
                          <span>Annualized CSP:</span>
                          <span className="font-bold">{d.annualizedReturn.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-800/60">
                          <span>Contract Delta:</span>
                          <span className="font-bold text-white">{d.delta.toFixed(3)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400 text-[11px]">
                          <span>Implied Vol (IV):</span>
                          <span className="text-white">{d.iv.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />

                {/* Put Option Premium represented as an area */}
                <Line
                  yAxisId="premium"
                  type="monotone"
                  dataKey="premium"
                  name="Put Premium ($) [Left Axis]"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={{ fill: "#0891b2", stroke: "#06b6d4", strokeWidth: 1.5, r: 4 }}
                  activeDot={{ r: 6, stroke: "#22d3ee", strokeWidth: 2 }}
                />

                {/* Annualized CSP Return represented as bar columns */}
                <Bar
                  yAxisId="yield"
                  dataKey="annualizedReturn"
                  name="Annualized CSP Yield (%) [Right Axis]"
                  fill="#f59e0b"
                  fillOpacity={0.15}
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  radius={[3, 3, 0, 0]}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
