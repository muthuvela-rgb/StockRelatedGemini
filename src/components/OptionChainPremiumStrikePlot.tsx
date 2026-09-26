import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  Brush,
} from "recharts";
import { OptionGreeks, ExpirationChainData, FibonacciLevels } from "../types";
import { formatCurrency, formatPct } from "../lib/utils";
import { OptionPointDetailInspector } from "./OptionPointDetailInspector";
import { DeltaRangeSlider } from "./DeltaRangeSlider";
import { ExpirationDaysRangeSlider } from "./ExpirationDaysRangeSlider";
import { StrikeRangeSlider } from "./sliders/StrikeRangeSlider";
import { RsiRangeSlider } from "./sliders/RsiRangeSlider";
import { BollingerBandSlider } from "./BollingerBandSlider";
import { useBollingerFilter } from "../context/BollingerFilterContext";
import {
  Sliders,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  TrendingUp,
  Activity,
  Layers,
  Info,
  Calendar,
  DollarSign,
  ChevronDown,
  RotateCcw,
  Eye,
  EyeOff,
  Crosshair,
  Percent,
  Sparkles,
} from "lucide-react";

interface OptionChainPremiumStrikePlotProps {
  ticker: string;
  currentPrice: number;
  selectedExp: string; // "ALL" or specific date string
  allExpirations: string[];
  tab: "puts" | "calls" | "both";
  onTabChange?: (tab: "puts" | "calls" | "both") => void;
  contracts: OptionGreeks[];
  callsContracts?: OptionGreeks[];
  putsContracts?: OptionGreeks[];
  allChainsMap?: Record<string, ExpirationChainData>;
  bollinger?: {
    sma: number;
    upper_band: number;
    lower_band: number;
    percent_b?: number;
    zone?: string;
  } | null;
  rsi_14?: number | null;
  fibonacci?: FibonacciLevels | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  nextEarningsDate?: string | null;
  nextEarningsTimestamp?: number | null;
  excludeSpansEarnings?: boolean;
  onExcludeSpansEarningsChange?: (val: boolean) => void;
  strikeRange: [number, number];
  onStrikeRangeChange: (newRange: [number, number]) => void;
  dataMinStrike: number;
  dataMaxStrike: number;
  deltaRange?: [number, number];
  onDeltaRangeChange?: (newRange: [number, number]) => void;
  dteRange?: [number, number];
  onDteRangeChange?: (newRange: [number, number]) => void;
  dataMinDte?: number;
  dataMaxDte?: number;
  rsiRange?: [number, number];
  onRsiRangeChange?: (newRange: [number, number]) => void;
  bollingerRange?: [number, number];
  onBollingerRangeChange?: (newRange: [number, number]) => void;
  onSelectContract?: (contract: OptionGreeks | null) => void;
  selectedContract?: OptionGreeks | null;
  selectedContractSymbol?: string | null;
  onScrollToTable?: () => void;
}

// Palette of 24 distinct, high-contrast colors for multi-expiration overlay
const EXP_PALETTE = [
  "#38bdf8", // Sky blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#a855f7", // Purple
  "#f43f5e", // Rose
  "#06b6d4", // Cyan
  "#6366f1", // Indigo
  "#84cc16", // Lime
  "#ec4899", // Pink
  "#14b8a6", // Teal
  "#eab308", // Yellow
  "#8b5cf6", // Violet
  "#f97316", // Orange
  "#22d3ee", // Light cyan
  "#4ade80", // Light green
  "#f87171", // Light red
  "#c084fc", // Light purple
  "#fb923c", // Light orange
  "#34d399", // Mint
  "#818cf8", // Periwinkle
  "#fbbf24", // Gold
  "#2dd4bf", // Aqua
  "#e879f9", // Fuchsia
  "#94a3b8", // Slate
];

export const OptionChainPremiumStrikePlot: React.FC<OptionChainPremiumStrikePlotProps> = ({
  ticker,
  currentPrice,
  selectedExp,
  allExpirations,
  tab,
  onTabChange,
  contracts,
  callsContracts = [],
  putsContracts = [],
  allChainsMap = {},
  bollinger,
  rsi_14,
  fibonacci,
  fiftyTwoWeekHigh,
  fiftyTwoWeekLow,
  nextEarningsDate,
  nextEarningsTimestamp,
  excludeSpansEarnings = false,
  onExcludeSpansEarningsChange,
  strikeRange,
  onStrikeRangeChange,
  dataMinStrike,
  dataMaxStrike,
  deltaRange,
  onDeltaRangeChange,
  dteRange,
  onDteRangeChange,
  dataMinDte = 0,
  dataMaxDte = 365,
  rsiRange,
  onRsiRangeChange,
  bollingerRange,
  onBollingerRangeChange,
  onSelectContract,
  selectedContract,
  selectedContractSymbol,
  onScrollToTable,
}) => {
  const isAllExp = selectedExp === "ALL";
  const [metric, setMetric] = useState<"bid" | "ask" | "mid" | "last" | "iv" | "delta" | "return">("bid");
  const [showCashReturnCurve, setShowCashReturnCurve] = useState(true);
  const [highlightedExp, setHighlightedExp] = useState<string | null>(null);
  const [visibleExps, setVisibleExps] = useState<Set<string>>(() => new Set(allExpirations.slice(0, 12)));
  const [showAllExpsInPlot, setShowAllExpsInPlot] = useState(true);
  const [internalDeltaRange, setInternalDeltaRange] = useState<[number, number]>([0.0, 1.0]);
  const [internalDteRange, setInternalDteRange] = useState<[number, number]>([dataMinDte, dataMaxDte]);
  const [internalRsiRange, setInternalRsiRange] = useState<[number, number]>([0, 100]);
  const bollingerContext = useBollingerFilter();
  const [internalBollingerRange, setInternalBollingerRange] = useState<[number, number]>([-20, 120]);

  const activeDeltaRange = deltaRange || internalDeltaRange;
  const handleDeltaChange = (newRange: [number, number]) => {
    if (onDeltaRangeChange) {
      onDeltaRangeChange(newRange);
    }
    setInternalDeltaRange(newRange);
  };

  const activeDteRange = dteRange || internalDteRange;
  const handleDteChange = (newRange: [number, number]) => {
    if (onDteRangeChange) {
      onDteRangeChange(newRange);
    }
    setInternalDteRange(newRange);
  };

  const activeRsiRange = rsiRange || internalRsiRange;
  const handleRsiChange = (newRange: [number, number]) => {
    if (onRsiRangeChange) {
      onRsiRangeChange(newRange);
    }
    setInternalRsiRange(newRange);
  };

  const activeBollingerRange = bollingerRange || (bollingerContext ? bollingerContext.bollingerRange : internalBollingerRange);
  const handleBollingerChange = (newRange: [number, number]) => {
    if (onBollingerRangeChange) {
      onBollingerRangeChange(newRange);
    }
    if (bollingerContext?.setBollingerRange) {
      bollingerContext.setBollingerRange(newRange);
    }
    setInternalBollingerRange(newRange);
  };

  const handleResetAllSliders = () => {
    onStrikeRangeChange([dataMinStrike, dataMaxStrike]);
    handleDeltaChange([0.0, 1.0]);
    handleDteChange([dataMinDte, dataMaxDte]);
    handleRsiChange([0, 100]);
    handleBollingerChange([-20, 120]);
    bollingerContext?.resetBollingerRange();
    onExcludeSpansEarningsChange?.(false);
  };

  const hasAnyActiveSlider =
    strikeRange[0] > dataMinStrike ||
    strikeRange[1] < dataMaxStrike ||
    activeDeltaRange[0] > 0.001 ||
    activeDeltaRange[1] < 0.999 ||
    activeDteRange[0] > dataMinDte ||
    activeDteRange[1] < dataMaxDte ||
    activeRsiRange[0] > 0 ||
    activeRsiRange[1] < 100 ||
    activeBollingerRange[0] > -20 ||
    activeBollingerRange[1] < 120 ||
    excludeSpansEarnings;

  const getExpDte = (exp: string): number => {
    const chain = allChainsMap[exp];
    if (chain && chain.days_to_expiration !== undefined && chain.days_to_expiration !== null) {
      return chain.days_to_expiration;
    }
    const msDiff = new Date(exp).getTime() - new Date().setHours(0, 0, 0, 0);
    return Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));
  };

  const matchingExpirations = useMemo(() => {
    return allExpirations.filter((exp) => {
      if (excludeSpansEarnings && nextEarningsDate && exp >= nextEarningsDate) {
        return false;
      }
      const d = getExpDte(exp);
      return d >= activeDteRange[0] && d <= activeDteRange[1];
    });
  }, [allExpirations, allChainsMap, activeDteRange, excludeSpansEarnings, nextEarningsDate]);

  // Sync visible expirations when allExpirations changes
  React.useEffect(() => {
    if (allExpirations.length > 0) {
      // Default to showing all expirations or top 10
      setVisibleExps(new Set(allExpirations));
    }
  }, [allExpirations]);

  const [minSlider, maxSlider] = strikeRange;

  // Presets helper
  const applyPreset = (type: "10pct" | "20pct" | "30pct" | "50pct" | "otm" | "itm" | "full") => {
    if (!currentPrice || currentPrice <= 0) return;

    if (type === "full") {
      onStrikeRangeChange([dataMinStrike, dataMaxStrike]);
      return;
    }

    if (type === "10pct") {
      const low = Math.max(dataMinStrike, Math.round(currentPrice * 0.9 * 10) / 10);
      const high = Math.min(dataMaxStrike, Math.round(currentPrice * 1.1 * 10) / 10);
      onStrikeRangeChange([low, high]);
      return;
    }

    if (type === "20pct") {
      const low = Math.max(dataMinStrike, Math.round(currentPrice * 0.8 * 10) / 10);
      const high = Math.min(dataMaxStrike, Math.round(currentPrice * 1.2 * 10) / 10);
      onStrikeRangeChange([low, high]);
      return;
    }

    if (type === "30pct") {
      const low = Math.max(dataMinStrike, Math.round(currentPrice * 0.7 * 10) / 10);
      const high = Math.min(dataMaxStrike, Math.round(currentPrice * 1.3 * 10) / 10);
      onStrikeRangeChange([low, high]);
      return;
    }

    if (type === "50pct") {
      const low = Math.max(dataMinStrike, Math.round(currentPrice * 0.5 * 10) / 10);
      const high = Math.min(dataMaxStrike, Math.round(currentPrice * 1.5 * 10) / 10);
      onStrikeRangeChange([low, high]);
      return;
    }

    if (type === "otm") {
      // For puts: strike < currentPrice. For calls: strike > currentPrice
      if (tab === "puts") {
        onStrikeRangeChange([dataMinStrike, Math.round(currentPrice * 10) / 10]);
      } else {
        onStrikeRangeChange([Math.round(currentPrice * 10) / 10, dataMaxStrike]);
      }
      return;
    }

    if (type === "itm") {
      if (tab === "puts") {
        onStrikeRangeChange([Math.round(currentPrice * 10) / 10, dataMaxStrike]);
      } else {
        onStrikeRangeChange([dataMinStrike, Math.round(currentPrice * 10) / 10]);
      }
      return;
    }
  };

  // Helper to compute annualized return on cash-secured basis
  const computeCashSecuredReturn = (
    c: OptionGreeks,
    spot: number,
    isPut: boolean,
    fallbackExp?: string
  ): number => {
    // For sell put options, use last price ONLY IF bid is zero
    const premium = c.bid > 0
      ? c.bid
      : (c.lastPrice > 0 ? (c.ask > 0 ? Math.min(c.lastPrice, c.ask) : c.lastPrice) : 0);
    if (!premium || premium <= 0) return 0;
    let dte = c.days_to_expiration;
    if (!dte || dte <= 0) {
      const expStr = c.expiration || (fallbackExp !== "ALL" ? fallbackExp : "");
      if (expStr) {
        const msDiff = new Date(expStr).getTime() - new Date().setHours(0, 0, 0, 0);
        dte = Math.max(Math.ceil(msDiff / (1000 * 60 * 60 * 24)), 1);
      } else {
        dte = 30;
      }
    }
    const capitalBasis = isPut ? c.strike : spot > 0 ? spot : c.strike;
    if (!capitalBasis || capitalBasis <= 0) return 0;
    return Number(((premium / capitalBasis) * (365.0 / dte) * 100).toFixed(2));
  };

  // Helper to extract value based on metric
  const getMetricValue = (c: OptionGreeks, m: typeof metric): number => {
    switch (m) {
      case "bid":
        // Use last price ONLY IF bid is zero
        return c.bid > 0
          ? c.bid
          : (c.lastPrice > 0 ? (c.ask > 0 ? Math.min(c.lastPrice, c.ask) : c.lastPrice) : 0);
      case "ask":
        return c.ask > 0
          ? c.ask
          : (c.lastPrice > 0 ? (c.bid > 0 ? Math.max(c.lastPrice, c.bid) : c.lastPrice) : 0);
      case "mid":
        if (c.bid > 0 && c.ask > 0) {
          return Number(((c.bid + c.ask) / 2).toFixed(2));
        }
        if (c.bid <= 0 && c.lastPrice > 0) {
          return c.ask > 0 ? Number(((Math.min(c.lastPrice, c.ask) + c.ask) / 2).toFixed(2)) : c.lastPrice;
        }
        return c.bid > 0 ? c.bid : (c.ask > 0 ? c.ask : (c.lastPrice || 0));
      case "last":
        return c.lastPrice || 0;
      case "iv":
        return c.impliedVolatility || 0;
      case "delta":
        return c.delta !== null ? Math.abs(c.delta) : 0;
      case "return":
        return computeCashSecuredReturn(c, currentPrice, tab === "puts", selectedExp);
      default:
        return c.bid > 0 ? c.bid : (c.lastPrice > 0 ? c.lastPrice : 0);
    }
  };

  // 1. DATA PREPARATION FOR SINGLE EXPIRATION MODE
  const singleExpChartData = useMemo(() => {
    if (isAllExp) return [];

    // Filter by RSI if ticker RSI is known
    const matchRsi =
      rsi_14 === null ||
      rsi_14 === undefined ||
      (rsi_14 >= activeRsiRange[0] && rsi_14 <= activeRsiRange[1]);
    if (!matchRsi) return [];

    // Filter by Bollinger %B if ticker Bollinger data is known
    const matchBollinger = bollingerContext
      ? bollingerContext.matchesBollinger(bollinger?.percent_b)
      : (bollinger?.percent_b == null || (bollinger.percent_b * 100 >= activeBollingerRange[0] && bollinger.percent_b * 100 <= activeBollingerRange[1]));
    if (!matchBollinger) return [];

    const [dMin, dMax] = activeDeltaRange;
    const [minDte, maxDte] = activeDteRange;
    // Map unique strikes in strike, delta, and DTE range
    const filteredContracts = contracts.filter((c) => {
      const matchStrike = c.strike >= minSlider && c.strike <= maxSlider;
      const absDelta = c.delta !== null && c.delta !== undefined ? Math.abs(c.delta) : 0;
      const matchDelta = absDelta >= dMin && absDelta <= dMax;
      const cDte = c.days_to_expiration ?? (c.expiration ? getExpDte(c.expiration) : (selectedExp !== "ALL" ? getExpDte(selectedExp) : 0));
      const matchDte = cDte >= minDte && cDte <= maxDte;
      let matchEarnings = true;
      if (excludeSpansEarnings && nextEarningsDate) {
        const exp = c.expiration || selectedExp;
        if (exp && exp !== "ALL" && exp >= nextEarningsDate) {
          matchEarnings = false;
        }
      }
      return matchStrike && matchDelta && matchDte && matchEarnings;
    });

    const strikeMap = new Map<number, any>();

    filteredContracts.forEach((c) => {
      const existing = strikeMap.get(c.strike) || { strike: c.strike };
      const mid = c.bid > 0 && c.ask > 0
        ? (c.bid + c.ask) / 2
        : (c.bid > 0 ? c.bid : (c.lastPrice > 0 ? (c.ask > 0 ? Math.min(c.lastPrice, c.ask) : c.lastPrice) : (c.ask || 0)));
      const annReturn = computeCashSecuredReturn(c, currentPrice, tab === "puts", selectedExp);
      strikeMap.set(c.strike, {
        ...existing,
        strike: c.strike,
        bid: c.bid,
        ask: c.ask,
        mid: Number(mid.toFixed(2)),
        lastPrice: c.lastPrice,
        annualizedReturn: annReturn,
        iv: c.impliedVolatility,
        delta: c.delta,
        gamma: c.gamma,
        theta: c.theta,
        vega: c.vega,
        volume: c.volume,
        openInterest: c.openInterest,
        inTheMoney: c.inTheMoney,
        contractSymbol: c.contractSymbol,
        contract: c,
        isFallback: Boolean(c.used_fallback || c.bid_used_fallback || (c as any).isFallback || (c as any).usedFallback),
      });
    });

    return Array.from(strikeMap.values()).sort((a, b) => a.strike - b.strike);
  }, [isAllExp, contracts, minSlider, maxSlider, activeDeltaRange, activeDteRange, activeRsiRange, rsi_14, activeBollingerRange, bollinger, currentPrice, tab, selectedExp, excludeSpansEarnings, nextEarningsDate]);

  // 2. DATA PREPARATION FOR ALL EXPIRATIONS MODE
  const allExpChartData = useMemo(() => {
    if (!isAllExp) return [];

    // Filter by RSI if ticker RSI is known
    const matchRsi =
      rsi_14 === null ||
      rsi_14 === undefined ||
      (rsi_14 >= activeRsiRange[0] && rsi_14 <= activeRsiRange[1]);
    if (!matchRsi) return [];

    // Filter by Bollinger %B if ticker Bollinger data is known
    const matchBollinger = bollingerContext
      ? bollingerContext.matchesBollinger(bollinger?.percent_b)
      : (bollinger?.percent_b == null || (bollinger.percent_b * 100 >= activeBollingerRange[0] && bollinger.percent_b * 100 <= activeBollingerRange[1]));
    if (!matchBollinger) return [];

    const [dMin, dMax] = activeDeltaRange;
    const [minDte, maxDte] = activeDteRange;
    // Collect all strikes across all chains within [minSlider, maxSlider], [dMin, dMax], and [minDte, maxDte]
    const strikeSet = new Set<number>();

    allExpirations.forEach((exp) => {
      if (excludeSpansEarnings && nextEarningsDate && exp >= nextEarningsDate) return;
      const expDte = getExpDte(exp);
      if (expDte < minDte || expDte > maxDte) return;

      const chain = allChainsMap[exp];
      if (!chain) return;
      const list = tab === "puts" ? chain.puts : chain.calls;
      list.forEach((c) => {
        const absDelta = c.delta !== null && c.delta !== undefined ? Math.abs(c.delta) : 0;
        if (c.strike >= minSlider && c.strike <= maxSlider && absDelta >= dMin && absDelta <= dMax) {
          strikeSet.add(c.strike);
        }
      });
    });

    // Also include contracts from direct list if allChainsMap isn't populated yet
    contracts.forEach((c) => {
      if (excludeSpansEarnings && nextEarningsDate && c.expiration && c.expiration >= nextEarningsDate) return;
      const cDte = c.days_to_expiration ?? (c.expiration ? getExpDte(c.expiration) : 0);
      if (cDte < minDte || cDte > maxDte) return;

      const absDelta = c.delta !== null && c.delta !== undefined ? Math.abs(c.delta) : 0;
      if (c.strike >= minSlider && c.strike <= maxSlider && absDelta >= dMin && absDelta <= dMax) {
        strikeSet.add(c.strike);
      }
    });

    const sortedStrikes = Array.from(strikeSet).sort((a, b) => a - b);

    // Build data points
    return sortedStrikes.map((strike) => {
      const pt: any = { strike };
      allExpirations.forEach((exp) => {
        if (excludeSpansEarnings && nextEarningsDate && exp >= nextEarningsDate) return;
        const expDte = getExpDte(exp);
        if (expDte < minDte || expDte > maxDte) return;

        const chain = allChainsMap[exp];
        let c: OptionGreeks | undefined;
        if (chain) {
          const list = tab === "puts" ? chain.puts : chain.calls;
          c = list.find((item) => item.strike === strike);
        } else {
          c = contracts.find((item) => item.strike === strike && item.expiration === exp);
        }

        if (c) {
          const absDelta = c.delta !== null && c.delta !== undefined ? Math.abs(c.delta) : 0;
          if (absDelta >= dMin && absDelta <= dMax) {
            pt[exp] = getMetricValue(c, metric);
            pt[`${exp}_contract`] = c;
          }
        }
      });
      return pt;
    });
  }, [isAllExp, allExpirations, allChainsMap, contracts, tab, minSlider, maxSlider, activeDeltaRange, activeDteRange, activeRsiRange, rsi_14, activeBollingerRange, bollinger, metric, currentPrice, selectedExp, excludeSpansEarnings, nextEarningsDate]);

  // Handle strike slider adjustments
  const handleMinSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (val <= maxSlider - 1) {
      onStrikeRangeChange([val, maxSlider]);
    }
  };

  const handleMaxSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (val >= minSlider + 1) {
      onStrikeRangeChange([minSlider, val]);
    }
  };

  const pctFromSpotMin = currentPrice ? (((minSlider - currentPrice) / currentPrice) * 100).toFixed(1) : "0";
  const pctFromSpotMax = currentPrice ? (((maxSlider - currentPrice) / currentPrice) * 100).toFixed(1) : "0";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Header & Metric Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white font-display">
                Premium vs. Strike Curve
              </h3>
              {isAllExp ? (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30 flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  All Expiration Option Chains ({allExpirations.length})
                </span>
              ) : (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-medium border border-slate-700">
                  {selectedExp}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isAllExp
                ? `Overlay of all ${allExpirations.length} expiration cycles across strikes. Spot: $${currentPrice.toFixed(2)}`
                : `Option premium plotted against strike prices for ${ticker} ${selectedExp}. Spot: $${currentPrice.toFixed(2)}`}
            </p>
          </div>
        </div>

        {/* Options & Metric Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Option Type Pills */}
          {onTabChange && (
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => onTabChange("puts")}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  tab === "puts"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Puts
              </button>
              <button
                type="button"
                onClick={() => onTabChange("calls")}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  tab === "calls"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Calls
              </button>
            </div>
          )}

          {/* Metric Selector Dropdown */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-300 gap-1.5">
            <span className="text-slate-400 font-medium">Metric:</span>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as any)}
              className="bg-transparent text-white font-semibold outline-none cursor-pointer"
            >
              <option value="bid" className="bg-slate-900 text-white">Bid Premium ($)</option>
              <option value="ask" className="bg-slate-900 text-white">Ask Premium ($)</option>
              <option value="mid" className="bg-slate-900 text-white">Mid Price ($)</option>
              <option value="last" className="bg-slate-900 text-white">Last Trade ($)</option>
              <option value="return" className="bg-slate-900 text-white">% Ann. Cash Return (%/yr)</option>
              <option value="iv" className="bg-slate-900 text-white">Implied Volatility (%)</option>
              <option value="delta" className="bg-slate-900 text-white">Delta (|Δ|)</option>
            </select>
          </div>

          {!isAllExp && (
            <button
              type="button"
              onClick={() => setShowCashReturnCurve(!showCashReturnCurve)}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer border ${
                showCashReturnCurve
                  ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-sm"
                  : "bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
              title="Toggle % Annualized Cash-Secured Return curve on right Y-Axis"
            >
              <span className={`w-2 h-2 rounded-full ${showCashReturnCurve ? "bg-emerald-400" : "bg-slate-500"}`} />
              <span>Right Axis: Ann. Return ({showCashReturnCurve ? "ON" : "OFF"})</span>
            </button>
          )}
        </div>
      </div>

      {/* 4-Slider Range & Filter Deck (Exact same look and feel as Put Option Scanner) */}
      <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              Option Chain Range & Filter Deck
            </span>
            {hasAnyActiveSlider && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-blue-500/20 text-blue-300 border border-blue-500/40">
                Filters Active
              </span>
            )}
          </div>

          {hasAnyActiveSlider && (
            <button
              type="button"
              onClick={handleResetAllSliders}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold cursor-pointer transition self-start sm:self-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filter Sliders</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* 1. Strike Price Range Slider */}
          <StrikeRangeSlider
            range={strikeRange}
            onChange={onStrikeRangeChange}
            dataMinStrike={dataMinStrike}
            dataMaxStrike={dataMaxStrike}
            currentPrice={currentPrice}
            tab={tab}
          />

          {/* 2. Expiration Days (DTE) Range Slider */}
          <ExpirationDaysRangeSlider
            minDays={activeDteRange[0]}
            maxDays={activeDteRange[1]}
            onChange={handleDteChange}
            dataMinDays={dataMinDte}
            dataMaxDays={dataMaxDte}
            badgeCount={{
              filtered: matchingExpirations.length,
              total: allExpirations.length || 1,
            }}
          />

          {/* 3. RSI (14) Momentum Range Slider */}
          <RsiRangeSlider
            range={activeRsiRange}
            onChange={handleRsiChange}
            sublabel={
              rsi_14 !== null && rsi_14 !== undefined
                ? `14-Day Wilder's RSI. Current ${ticker} RSI: ${rsi_14}`
                : "14-Day Relative Strength Index Momentum Filter"
            }
          />
        </div>

        {/* 4. Delta Greek (|Δ|) Range Slider - Moved to next line and made bigger so wide windows never squash it */}
        <div className="mt-3.5 w-full">
          <DeltaRangeSlider
            minDelta={activeDeltaRange[0]}
            maxDelta={activeDeltaRange[1]}
            onChange={handleDeltaChange}
            showPresets={true}
          />
        </div>

        {/* 5. Bollinger Bands (%B) Range Slider - Placed on a separate line below Delta slider */}
        <div className="mt-3.5 w-full">
          <BollingerBandSlider
            range={activeBollingerRange}
            onChange={handleBollingerChange}
            sublabel={
              bollinger?.percent_b !== undefined && bollinger?.percent_b !== null
                ? `20d 2σ Bollinger envelope. Current ${ticker} %B: ${(bollinger.percent_b * 100).toFixed(0)}% (${bollinger.zone || "in envelope"}) • Lower: $${bollinger.lower_band?.toFixed(2)} • SMA: $${bollinger.sma?.toFixed(2)} • Upper: $${bollinger.upper_band?.toFixed(2)}`
                : "Position relative to 20-period 2σ Bollinger Bands envelope (0% = Lower Band, 50% = 20 SMA, 100% = Upper Band)."
            }
          />
        </div>

        {/* Corporate Earnings Date Filter */}
        {onExcludeSpansEarningsChange && (
          <div className="pt-3 border-t border-slate-800/60 mt-3.5 flex items-center justify-between">
            <div className="flex flex-col pr-4">
              <span className="text-xs font-bold text-slate-200">Avoid Binary Earnings Surprises</span>
              <span className="text-[10px] text-slate-400">Exclude option curves and expirations whose expiration date spans or is after the next corporate earnings report</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
              <input
                type="checkbox"
                checked={excludeSpansEarnings}
                onChange={(e) => onExcludeSpansEarningsChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-500 after:border-slate-400 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white"></div>
            </label>
          </div>
        )}
      </div>

      {/* Multi-Expiration Legend / Pills (Only in ALL Expirations Mode) */}
      {isAllExp && allExpirations.length > 0 && (
        <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              All Expiration Date Option Chains (
              <strong className="text-amber-300 font-mono">{matchingExpirations.length}</strong> of {allExpirations.length} Active Curves within DTE):
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setVisibleExps(new Set(matchingExpirations.length > 0 ? matchingExpirations : allExpirations))}
                className="text-[11px] text-blue-400 hover:text-blue-300 transition cursor-pointer font-medium"
              >
                Show Matching
              </button>
              <span className="text-slate-600 text-xs">|</span>
              <button
                onClick={() => setVisibleExps(new Set(allExpirations))}
                className="text-[11px] text-slate-400 hover:text-slate-300 transition cursor-pointer font-medium"
              >
                Show All
              </button>
              <span className="text-slate-600 text-xs">|</span>
              <button
                onClick={() => setVisibleExps(new Set((matchingExpirations.length > 0 ? matchingExpirations : allExpirations).slice(0, 5)))}
                className="text-[11px] text-slate-400 hover:text-slate-300 transition cursor-pointer font-medium"
              >
                Top 5
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {allExpirations.map((exp, idx) => {
              const color = EXP_PALETTE[idx % EXP_PALETTE.length];
              const isVisible = visibleExps.has(exp);
              const isHovered = highlightedExp === exp;
              const dte = allChainsMap[exp]?.days_to_expiration ?? getExpDte(exp);
              const isWithinDte = dte >= activeDteRange[0] && dte <= activeDteRange[1];

              return (
                <button
                  key={exp}
                  onClick={() => {
                    const next = new Set(visibleExps);
                    if (next.has(exp)) {
                      if (next.size > 1) next.delete(exp);
                    } else {
                      next.add(exp);
                    }
                    setVisibleExps(next);
                  }}
                  onMouseEnter={() => setHighlightedExp(exp)}
                  onMouseLeave={() => setHighlightedExp(null)}
                  title={!isWithinDte ? `Filtered by Expiration Days (${dte}d outside ${activeDteRange[0]}–${activeDteRange[1]}d window)` : `${exp} (${dte}d)`}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold flex items-center gap-1.5 transition border cursor-pointer ${
                    !isWithinDte
                      ? "bg-slate-950/40 text-slate-600 border-slate-900 line-through opacity-40 hover:opacity-75"
                      : isVisible
                      ? isHovered
                        ? "bg-slate-800 text-white border-white scale-105"
                        : "bg-slate-900/80 text-slate-200 border-slate-700"
                      : "bg-slate-950/60 text-slate-500 border-slate-900 line-through opacity-50"
                  }`}
                  style={{
                    borderColor: isVisible && isWithinDte ? color : undefined,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: isWithinDte ? color : "#64748b" }}
                  />
                  <span>{exp}</span>
                  {dte !== undefined && (
                    <span className="text-[9px] text-slate-400 font-sans font-normal">
                      ({dte}d)
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Visual Subheader with Fallback Indicator Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-2 pb-1 text-xs">
        <span className="text-slate-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Click curve points to inspect Greeks, execution pricing & risk tiering</span>
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-medium shadow-sm">
          <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_6px_#f59e0b]"></span>
          Amber Dot = Fallback / Last Price
        </span>
      </div>

      {/* Main Plot Area */}
      <div className="h-80 sm:h-96 w-full pt-1">
        {isAllExp ? (
          /* ================= ALL EXPIRATIONS MULTI-LINE OVERLAY ================= */
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={allExpChartData}
              margin={{ top: 15, right: 30, left: 10, bottom: 25 }}
              onClick={(e: any) => {
                if (!e || !e.activePayload || !e.activePayload.length) return;
                let targetContract: OptionGreeks | null = null;
                // If user has highlighted an expiration, select that contract first
                if (highlightedExp) {
                  targetContract = e.activePayload[0]?.payload?.[`${highlightedExp}_contract`];
                }
                if (!targetContract) {
                  for (const p of e.activePayload) {
                    const c = p?.payload?.[`${p.dataKey}_contract`];
                    if (c) {
                      targetContract = c;
                      break;
                    }
                  }
                }
                if (targetContract && onSelectContract) {
                  onSelectContract(targetContract);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="strike"
                stroke="#64748b"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                domain={[minSlider, maxSlider]}
                type="number"
                tickFormatter={(val) => `$${val}`}
                label={{
                  value: "Strike Price ($)",
                  position: "insideBottom",
                  offset: -15,
                  fill: "#94a3b8",
                  fontSize: 12,
                }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickFormatter={(val) => (metric === "iv" || metric === "return" ? `${val}%` : `$${val}`)}
                label={{
                  value:
                    metric === "iv"
                      ? "Implied Volatility (%)"
                      : metric === "return"
                      ? "% Ann. Cash Secured Return"
                      : metric === "delta"
                      ? "Delta (|Δ|)"
                      : `${metric.toUpperCase()} Premium ($)`,
                  angle: -90,
                  position: "insideLeft",
                  fill: "#94a3b8",
                  fontSize: 12,
                }}
              />
              <Tooltip
                position={{ x: 65, y: 15 }}
                isAnimationActive={false}
                cursor={false}
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  return (
                    <div className="bg-slate-950/95 border border-slate-700 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs space-y-2 max-w-xs z-50">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <span className="font-bold text-white text-sm">Strike: ${label}</span>
                        <span className="text-slate-400 font-mono">
                          {currentPrice
                            ? `${(((Number(label) - currentPrice) / currentPrice) * 100).toFixed(1)}% of Spot`
                            : ""}
                        </span>
                      </div>
                      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                        {payload
                          .filter((p: any) => p.value !== undefined && p.value !== null)
                          .map((p: any) => {
                            const expKey = p.name;
                            const contract = p.payload?.[`${expKey}_contract`];
                            return (
                              <div
                                key={expKey}
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  if (contract && onSelectContract) {
                                    onSelectContract(contract);
                                  }
                                }}
                                className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-slate-800/80 cursor-pointer text-[11px] transition-colors group"
                                title="Click to inspect this contract's premium details & technicals"
                              >
                                <span className="flex items-center gap-1.5 font-mono">
                                  <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: p.color }}
                                  />
                                  <span className="text-slate-300 font-semibold group-hover:text-cyan-300 transition-colors">{expKey}:</span>
                                </span>
                                <span className="font-mono font-bold text-white flex items-center gap-1">
                                  <span>
                                    {metric === "iv" || metric === "return"
                                      ? `${Number(p.value).toFixed(1)}%`
                                      : `$${Number(p.value).toFixed(2)}`}
                                  </span>
                                  {contract?.delta !== null && (
                                    <span className="text-[10px] text-slate-400 ml-1 font-normal">
                                      (Δ {contract?.delta})
                                    </span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                      <div className="text-[10px] text-cyan-400 font-sans pt-1 border-t border-slate-800 text-center flex items-center justify-center gap-1">
                        <Crosshair className="w-3 h-3" /> Click point to inspect technicals & earnings
                      </div>
                    </div>
                  );
                }}
              />

              {/* Expiration Curves for all chains */}
              {allExpirations.map((exp, idx) => {
                if (!visibleExps.has(exp)) return null;
                const expDte = getExpDte(exp);
                if (expDte < activeDteRange[0] || expDte > activeDteRange[1]) return null;
                const color = EXP_PALETTE[idx % EXP_PALETTE.length];
                const isHighlighted = highlightedExp === exp;

                return (
                  <Line
                    key={exp}
                    type="monotone"
                    dataKey={exp}
                    name={exp}
                    stroke={color}
                    strokeWidth={isHighlighted ? 3.5 : 1.75}
                    strokeOpacity={highlightedExp && !isHighlighted ? 0.3 : 0.9}
                    dot={((props: any): any => {
                      const { cx, cy, payload } = props;
                      if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) return null;
                      const contract = payload?.[`${exp}_contract`];
                      if (!contract) return null;
                      const isFallback = Boolean(
                        contract.isFallback ??
                        contract.bid_used_fallback ??
                        contract.used_fallback ??
                        (contract as any).usedFallback
                      );
                      if (isFallback) {
                        return (
                          <g key={`fb-dot-${exp}-${payload.strike}`} className="cursor-pointer" onClick={() => onSelectContract && onSelectContract(contract)}>
                            <circle cx={cx} cy={cy} r={7.5} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="2 2" />
                            <circle cx={cx} cy={cy} r={4.5} fill="#f59e0b" stroke="#ffffff" strokeWidth={1.5} />
                          </g>
                        );
                      }
                      return null;
                    }) as any}
                    activeDot={{
                      r: 6,
                      fill: color,
                      stroke: "#ffffff",
                      strokeWidth: 2,
                      cursor: "pointer",
                      onClick: (_, event: any) => {
                        const payload = event?.payload;
                        const contract = payload?.[`${exp}_contract`];
                        if (contract && onSelectContract) {
                          onSelectContract(contract);
                        }
                      },
                    }}
                    connectNulls
                  />
                );
              })}
              {allExpChartData.length > 5 && (
                <Brush
                  dataKey="strike"
                  height={22}
                  stroke="#38bdf8"
                  fill="#090d16"
                  travellerWidth={8}
                  tickFormatter={(val) => `$${val}`}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          /* ================= SINGLE EXPIRATION AREA & CURVE ================= */
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={singleExpChartData}
              margin={{ top: 15, right: 45, left: 10, bottom: 25 }}
              onClick={(e: any) => {
                const contract = e?.activePayload?.[0]?.payload?.contract;
                if (contract && onSelectContract) {
                  onSelectContract(contract);
                }
              }}
            >
              <defs>
                <linearGradient id="premiumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={tab === "puts" ? "#f43f5e" : "#10b981"}
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="95%"
                    stopColor={tab === "puts" ? "#f43f5e" : "#10b981"}
                    stopOpacity={0.0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="strike"
                stroke="#64748b"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                domain={[minSlider, maxSlider]}
                type="number"
                tickFormatter={(val) => `$${val}`}
                label={{
                  value: "Strike Price ($)",
                  position: "insideBottom",
                  offset: -15,
                  fill: "#94a3b8",
                  fontSize: 12,
                }}
              />
              {/* Left Y-Axis: Option Premium ($) */}
              <YAxis
                yAxisId="left"
                stroke="#64748b"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickFormatter={(val) => `$${val}`}
                label={{
                  value: "Option Premium ($)",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#94a3b8",
                  fontSize: 12,
                }}
              />
              {/* Right Y-Axis: % Annualized Cash Secured Return */}
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#10b981"
                tick={{ fill: "#34d399", fontSize: 11 }}
                tickFormatter={(val) => `${val}%`}
                label={{
                  value: "% Ann. Cash Return",
                  angle: 90,
                  position: "insideRight",
                  offset: 0,
                  fill: "#34d399",
                  fontSize: 12,
                }}
              />
              <Tooltip
                position={{ x: 65, y: 15 }}
                isAnimationActive={false}
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div
                      onClick={() => {
                        if (d.contract && onSelectContract) {
                          onSelectContract(d.contract);
                        }
                      }}
                      className="bg-slate-950/95 border border-slate-700 rounded-xl p-3.5 shadow-2xl backdrop-blur-md text-xs space-y-2 min-w-56 z-50 cursor-pointer hover:border-cyan-500/60 transition-colors"
                      title="Click to inspect this contract's premium details & technicals"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <span className="font-bold text-white text-sm">Strike: ${d.strike}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            d.inTheMoney
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-emerald-500/20 text-emerald-300"
                          }`}
                        >
                          {d.inTheMoney ? "ITM" : "OTM"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-300">
                        <div>
                          Bid: <strong className="text-emerald-400 font-mono">${d.bid}</strong>
                        </div>
                        <div>
                          Ask: <strong className="text-rose-400 font-mono">${d.ask}</strong>
                        </div>
                        <div>
                          Mid: <strong className="text-white font-mono">${d.mid}</strong>
                        </div>
                        <div>
                          Last: <strong className="text-slate-200 font-mono">${d.lastPrice}</strong>
                        </div>
                        <div>
                          IV: <strong className="text-amber-400 font-mono">{d.iv}%</strong>
                        </div>
                        <div>
                          Delta: <strong className="text-white font-mono">{d.delta ?? "-"}</strong>
                        </div>
                        <div>
                          Theta: <strong className="text-rose-400 font-mono">{d.theta ?? "-"}</strong>
                        </div>
                        <div>
                          Vega: <strong className="text-cyan-400 font-mono">{d.vega ?? "-"}</strong>
                        </div>
                      </div>

                      {/* Prominent Annualized Cash Secured Return Row */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between bg-emerald-950/40 px-2.5 py-1.5 rounded-lg border border-emerald-800/40">
                        <span className="text-emerald-400 font-semibold flex items-center gap-1 text-[11px]">
                          <Percent className="w-3 h-3 text-emerald-400" />
                          Ann. Cash Return (Right Axis):
                        </span>
                        <span className="text-emerald-300 font-mono font-bold text-xs">
                          {d.annualizedReturn > 0 ? `+${d.annualizedReturn}% / yr` : "—"}
                        </span>
                      </div>

                      <div className="text-[10px] text-cyan-400 font-sans pt-1 border-t border-slate-800 text-center flex items-center justify-center gap-1">
                        <Crosshair className="w-3 h-3" /> Click point to inspect technicals & earnings
                      </div>
                    </div>
                  );
                }}
              />

              {/* Shaded Area for Mid/Bid (Left Axis) */}
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="bid"
                name="Bid Premium ($)"
                stroke={tab === "puts" ? "#f43f5e" : "#10b981"}
                strokeWidth={2.5}
                fill="url(#premiumGrad)"
                dot={((props: any): any => {
                  const { cx, cy, payload } = props;
                  if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) return null;
                  const isFallback = Boolean(
                    payload?.isFallback ??
                    payload?.contract?.isFallback ??
                    payload?.contract?.bid_used_fallback ??
                    payload?.contract?.used_fallback ??
                    (payload?.contract as any)?.usedFallback
                  );
                  if (isFallback) {
                    return (
                      <g key={`fb-bid-${payload.strike}`} className="cursor-pointer" onClick={() => payload?.contract && onSelectContract && onSelectContract(payload.contract)}>
                        <circle cx={cx} cy={cy} r={7.5} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="2 2" className="animate-pulse" />
                        <circle cx={cx} cy={cy} r={4.5} fill="#f59e0b" stroke="#ffffff" strokeWidth={1.5} />
                      </g>
                    );
                  }
                  return (
                    <circle key={`norm-bid-${payload.strike}`} cx={cx} cy={cy} r={2.5} fill={tab === "puts" ? "#f43f5e" : "#10b981"} opacity={0.6} />
                  );
                }) as any}
                activeDot={{
                  r: 6,
                  fill: "#ffffff",
                  stroke: tab === "puts" ? "#f43f5e" : "#10b981",
                  strokeWidth: 2,
                  cursor: "pointer",
                  onClick: (_, event: any) => {
                    const payload = event?.payload;
                    if (payload?.contract && onSelectContract) {
                      onSelectContract(payload.contract);
                    }
                  },
                }}
              />

              {/* Ask Curve (Left Axis) */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="ask"
                name="Ask Premium ($)"
                stroke={tab === "puts" ? "#fb7171" : "#34d399"}
                strokeDasharray="2 2"
                strokeWidth={1.5}
                dot={false}
              />

              {/* Annualized Cash Secured Return Curve (Right Axis) */}
              {showCashReturnCurve && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="annualizedReturn"
                  name="% Ann. Cash Secured Return"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={((props: any): any => {
                    const { cx, cy, payload } = props;
                    if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) return null;
                    const isFallback = Boolean(payload?.isFallback || (payload?.bid <= 0 && payload?.lastPrice > 0));
                    if (isFallback) {
                      return (
                        <g key={`fb-ann-${payload.strike}`} className="cursor-pointer" onClick={() => payload?.contract && onSelectContract && onSelectContract(payload.contract)}>
                          <circle cx={cx} cy={cy} r={7.5} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="2 2" />
                          <circle cx={cx} cy={cy} r={4.5} fill="#f59e0b" stroke="#ffffff" strokeWidth={1.5} />
                        </g>
                      );
                    }
                    return null;
                  }) as any}
                  activeDot={{
                    r: 6,
                    fill: "#10b981",
                    stroke: "#064e3b",
                    strokeWidth: 2,
                    cursor: "pointer",
                    onClick: (_, event: any) => {
                      const payload = event?.payload;
                      if (payload?.contract && onSelectContract) {
                        onSelectContract(payload.contract);
                      }
                    },
                  }}
                />
              )}
              {singleExpChartData.length > 5 && (
                <Brush
                  dataKey="strike"
                  height={22}
                  stroke={tab === "puts" ? "#f43f5e" : "#10b981"}
                  fill="#090d16"
                  travellerWidth={8}
                  tickFormatter={(val) => `$${val}`}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Analytical Callout Summary */}
      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            Spot: <strong className="text-white font-mono">${currentPrice.toFixed(2)}</strong>
          </span>
          {isAllExp ? (
            <span className="text-slate-300">
              Viewing all <strong className="text-blue-400">{allExpirations.length}</strong> option chains simultaneously
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-slate-300">
                {tab === "puts" ? "Put Option Chain" : "Call Option Chain"} for{" "}
                <strong className="text-white font-mono">{selectedExp}</strong>
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                <span className="w-2.5 h-0.5 bg-emerald-400 inline-block rounded-full" />
                Right Y-Axis: % Ann. Cash Return
              </span>
            </div>
          )}
        </div>

        <div className="text-[11px] text-slate-400">
          Showing strikes within range:{" "}
          <strong className="text-cyan-400 font-mono">${minSlider.toFixed(0)}</strong> –{" "}
          <strong className="text-cyan-400 font-mono">${maxSlider.toFixed(0)}</strong>
        </div>
      </div>

      {/* Option Point Inspector (Renders upon clicking any point on the plot) */}
      {selectedContract && (
        <OptionPointDetailInspector
          contract={selectedContract}
          currentPrice={currentPrice}
          ticker={ticker}
          tab={tab}
          bollinger={bollinger}
          rsi_14={rsi_14}
          fibonacci={fibonacci}
          fiftyTwoWeekHigh={fiftyTwoWeekHigh}
          fiftyTwoWeekLow={fiftyTwoWeekLow}
          nextEarningsDate={nextEarningsDate}
          nextEarningsTimestamp={nextEarningsTimestamp}
          onClose={() => onSelectContract && onSelectContract(null)}
          onScrollToTable={onScrollToTable}
        />
      )}
    </div>
  );
};
