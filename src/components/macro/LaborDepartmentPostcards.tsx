import React from "react";
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  Calendar,
  ExternalLink,
  Info,
  ShieldCheck,
  Target,
  Sparkles,
  Flame,
  Layers,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { LaborDepartmentStats } from "../../types";

interface LaborDepartmentPostcardsProps {
  stats: LaborDepartmentStats | null;
  loading: boolean;
}

export const LaborDepartmentPostcards: React.FC<LaborDepartmentPostcardsProps> = ({
  stats,
  loading,
}) => {
  if (loading && !stats) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 h-80 animate-pulse flex flex-col justify-between">
          <div className="h-6 bg-slate-800 rounded w-1/3" />
          <div className="h-16 bg-slate-800 rounded w-1/2" />
          <div className="h-32 bg-slate-800 rounded w-full" />
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 h-80 animate-pulse flex flex-col justify-between">
          <div className="h-6 bg-slate-800 rounded w-1/3" />
          <div className="h-16 bg-slate-800 rounded w-1/2" />
          <div className="h-32 bg-slate-800 rounded w-full" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const { unemployment, inflation } = stats;
  const historyData = unemployment.history || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* ========================================================================= */}
      {/* POSTCARD 1: U.S. GOVERNMENT UNEMPLOYMENT RATE (WITH 2-YEAR HISTORY GRAPH) */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden flex flex-col justify-between transition-all duration-200">
        {/* Top subtle highlight glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 opacity-80" />

        <div>
          {/* Header & Department of Labor Badge */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 shadow-inner">
                <Briefcase className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-base font-bold text-white tracking-tight">
                    U.S. Unemployment Rate
                  </h2>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/30">
                    <ShieldCheck className="w-3 h-3 text-blue-400" />
                    BLS Official
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  U.S. Department of Labor • Current Population Survey (CPS)
                </p>
              </div>
            </div>

            <a
              href="https://www.bls.gov/cps/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition p-1 hover:bg-slate-800 rounded-lg shrink-0"
              title="View directly on U.S. Bureau of Labor Statistics (bls.gov)"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Current Headline Rate & Month */}
          <div className="flex flex-wrap items-baseline justify-between gap-3 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 mb-4">
            <div>
              <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                Latest Published Rate ({unemployment.latestPeriod})
              </div>
              <div className="flex items-baseline gap-3 mt-0.5">
                <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white">
                  {unemployment.latestRate.toFixed(1)}%
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md font-mono ${
                    unemployment.momChange > 0
                      ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                      : unemployment.momChange < 0
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                      : "bg-slate-800 text-slate-300 border border-slate-700"
                  }`}
                >
                  {unemployment.momChange > 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : unemployment.momChange < 0 ? (
                    <TrendingDown className="w-3.5 h-3.5" />
                  ) : null}
                  {unemployment.momChange > 0 ? `+${unemployment.momChange.toFixed(1)}%` : `${unemployment.momChange.toFixed(1)}%`} MoM
                </span>
              </div>
            </div>

            {/* Quick 2-Yr Statistics */}
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <div className="bg-slate-900/90 px-2 py-1 rounded border border-slate-800 text-slate-300">
                <span className="text-slate-500">2Y Low:</span>{" "}
                <strong className="text-emerald-400">{unemployment.twoYearLow.toFixed(1)}%</strong>
              </div>
              <div className="bg-slate-900/90 px-2 py-1 rounded border border-slate-800 text-slate-300">
                <span className="text-slate-500">2Y High:</span>{" "}
                <strong className="text-rose-400">{unemployment.twoYearHigh.toFixed(1)}%</strong>
              </div>
              <div className="bg-slate-900/90 px-2 py-1 rounded border border-slate-800 text-slate-300">
                <span className="text-slate-500">Avg:</span>{" "}
                <strong className="text-cyan-400">{unemployment.twoYearAvg.toFixed(1)}%</strong>
              </div>
            </div>
          </div>

          {/* Next Release Date Banner */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-blue-950/30 border border-blue-800/40 text-xs mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-slate-300 truncate">
                <strong className="text-white font-semibold">Next Release:</strong>{" "}
                {unemployment.nextReleaseDate} at {unemployment.nextReleaseTime}
              </span>
            </div>
            <span className="text-[10px] text-cyan-400/90 font-mono bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/50 shrink-0">
              8:30 AM ET
            </span>
          </div>

          {/* 2-Year History Graph Header */}
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <span>2-Year Historical Trend (Monthly Rate)</span>
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Y: Unemployment % • X: 2-Year Duration
            </span>
          </div>

          {/* 2-Year History Area Graph */}
          <div className="h-44 sm:h-48 w-full bg-slate-950/60 rounded-xl p-2 border border-slate-800/70">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={historyData}
                margin={{ top: 10, right: 12, left: -22, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="unempGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <XAxis
                  dataKey="label"
                  stroke="#475569"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  interval={3}
                  tickLine={false}
                />
                <YAxis
                  stroke="#475569"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  domain={["auto", "auto"]}
                  tickFormatter={(val) => `${val}%`}
                  tickLine={false}
                />
                <Tooltip
                  isAnimationActive={false}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-slate-950/95 border border-slate-700 rounded-lg p-2 text-xs shadow-xl font-mono">
                        <div className="text-slate-400 text-[10px]">{d.fullPeriod}</div>
                        <div className="text-cyan-300 font-bold text-sm mt-0.5">
                          {d.rate.toFixed(1)}% Unemployment
                        </div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  y={4.0}
                  stroke="#10b981"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  label={{
                    value: "4.0% Natural Full Emp",
                    fill: "#34d399",
                    fontSize: 9,
                    position: "insideTopRight",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  name="Unemployment Rate"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  fill="url(#unempGradient)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card Footer with Direct BLS Link */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <span className="truncate">
            Series: <code className="text-slate-400">{unemployment.seriesId}</code> (Seasonally Adjusted)
          </span>
          <a
            href="https://www.bls.gov/cps/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium transition"
          >
            <span>U.S. Dept of Labor (bls.gov)</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* POSTCARD 2: U.S. GOVERNMENT INFLATION NUMBER (HEADLINE CPI & CORE CPI)    */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden flex flex-col justify-between transition-all duration-200">
        {/* Top subtle highlight glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-rose-400 to-purple-500 opacity-80" />

        <div>
          {/* Header & Department of Labor Badge */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-inner">
                <Flame className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-base font-bold text-white tracking-tight">
                    U.S. Inflation Numbers (CPI)
                  </h2>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                    <ShieldCheck className="w-3 h-3 text-amber-400" />
                    BLS Official
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  U.S. Bureau of Labor Statistics • Consumer Price Index (CPI-U)
                </p>
              </div>
            </div>

            <a
              href="https://www.bls.gov/cpi/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition p-1 hover:bg-slate-800 rounded-lg shrink-0"
              title="View directly on U.S. Bureau of Labor Statistics (bls.gov)"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Dual Inflation Rates Showcase: Headline vs. Core */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* 1. Headline CPI */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                    Headline CPI (All Items)
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mb-1">
                  {inflation.headline.latestPeriod}
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                  {inflation.headline.yoyRate.toFixed(1)}%
                  <span className="text-xs text-slate-400 font-sans font-normal ml-1">YoY</span>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">MoM:</span>
                <span
                  className={
                    inflation.headline.momRate > 0
                      ? "text-rose-400 font-bold"
                      : "text-emerald-400 font-bold"
                  }
                >
                  {inflation.headline.momRate > 0
                    ? `+${inflation.headline.momRate.toFixed(2)}%`
                    : `${inflation.headline.momRate.toFixed(2)}%`}
                </span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-400">Index:</span>
                <span className="text-slate-200 font-bold">{inflation.headline.indexValue.toFixed(2)}</span>
              </div>
            </div>

            {/* 2. Core CPI */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">
                    Core CPI (Ex-Food & Energy)
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mb-1">
                  {inflation.core.latestPeriod}
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                  {inflation.core.yoyRate.toFixed(1)}%
                  <span className="text-xs text-slate-400 font-sans font-normal ml-1">YoY</span>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">MoM:</span>
                <span
                  className={
                    inflation.core.momRate > 0
                      ? "text-rose-400 font-bold"
                      : "text-emerald-400 font-bold"
                  }
                >
                  {inflation.core.momRate > 0
                    ? `+${inflation.core.momRate.toFixed(2)}%`
                    : `${inflation.core.momRate.toFixed(2)}%`}
                </span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-400">Index:</span>
                <span className="text-slate-200 font-bold">{inflation.core.indexValue.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Next Release Date Banner */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-950/30 border border-amber-800/40 text-xs mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-slate-300 truncate">
                <strong className="text-white font-semibold">Next Release:</strong>{" "}
                {inflation.nextReleaseDate} at {inflation.nextReleaseTime}
              </span>
            </div>
            <span className="text-[10px] text-amber-400/90 font-mono bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/50 shrink-0">
              8:30 AM ET
            </span>
          </div>

          {/* Brief Educational Explanation: What this inflation data covers */}
          <div className="space-y-2 mb-2">
            <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-400" />
              <span>What this government inflation data covers:</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/70 text-xs space-y-2.5">
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                <div>
                  <strong className="text-amber-300 font-medium">Headline CPI (All Items):</strong>{" "}
                  <span className="text-slate-300 leading-relaxed">
                    Captures total cost-of-living changes experienced by urban households, including volatile food (groceries, dining) and energy commodities (gasoline, electricity, heating oil).
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0 mt-1.5" />
                <div>
                  <strong className="text-purple-300 font-medium">Core CPI (Less Food & Energy):</strong>{" "}
                  <span className="text-slate-300 leading-relaxed">
                    Strips out volatile grocery and fuel price swings to isolate persistent, sticky pricing pressures in shelter/rents, healthcare, transportation, and services. Closely targeted by the Federal Reserve to guide interest rate decisions.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Fed Target Reference Indicator */}
          <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-800/40 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Target className="w-4 h-4 text-emerald-400" />
              <span>
                Federal Reserve Inflation Target: <strong className="text-white">2.0% annual</strong>
              </span>
            </div>
            <span className="font-mono text-emerald-400 font-bold text-[11px]">
              Core is +{(inflation.core.yoyRate - inflation.fedTarget).toFixed(1)}% spread
            </span>
          </div>
        </div>

        {/* Card Footer with Direct BLS Link */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <span className="truncate">
            Series: <code className="text-slate-400">{inflation.headline.seriesId}</code> &{" "}
            <code className="text-slate-400">{inflation.core.seriesId}</code>
          </span>
          <a
            href="https://www.bls.gov/cpi/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium transition"
          >
            <span>U.S. Dept of Labor (bls.gov)</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
