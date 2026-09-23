import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  Legend,
  Brush,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar,
  Layers,
  Search,
  RefreshCw,
  Download,
  Table as TableIcon,
  Maximize2,
  Minimize2,
  Sliders,
  ChevronDown,
  Info,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  BarChart2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Plus,
  Minus,
  ChevronLeft,
  ChevronRight,
  MoveHorizontal,
  X,
} from "lucide-react";
import {
  HistoricalBar,
  ChartTechnicalSummary,
  HistoricalChartResponse,
  MultiTickerComparisonItem,
  CompanyProfile,
} from "../types/stockChart";
import { CompanyProfileCard } from "./CompanyProfileCard";
import { RebalancingAlertBanner } from "./RebalancingAlertBanner";
import { TableTopScrollbar } from "./TableTopScrollbar";

interface StockChartsViewerProps {
  watchlist?: string[];
}

const POPULAR_TICKERS = [
  "NVDA",
  "AAPL",
  "MSFT",
  "AMZN",
  "GOOGL",
  "META",
  "TSLA",
  "SPY",
  "QQQ",
  "IBM", // Classic 50-year history ticker
];

const DURATION_PRESETS = [
  { id: "1m", label: "1M", desc: "1 Month" },
  { id: "3m", label: "3M", desc: "3 Months" },
  { id: "6m", label: "6M", desc: "6 Months" },
  { id: "1y", label: "1Y", desc: "1 Year" },
  { id: "2y", label: "2Y", desc: "2 Years" },
  { id: "5y", label: "5Y", desc: "5 Years" },
  { id: "10y", label: "10Y", desc: "10 Years" },
  { id: "20y", label: "20Y", desc: "20 Years" },
  { id: "30y", label: "30Y", desc: "30 Years" },
  { id: "50y", label: "50Y", desc: "50 Years" },
  { id: "max", label: "MAX", desc: "All-Time" },
  { id: "custom", label: "Custom", desc: "Date Range" },
];

const INTERVAL_OPTIONS = [
  { id: "1d", label: "Daily (1D)" },
  { id: "1wk", label: "Weekly (1W)" },
  { id: "1mo", label: "Monthly (1M)" },
];

export const StockChartsViewer: React.FC<StockChartsViewerProps> = ({ watchlist = [] }) => {
  // Search & Ticker state
  const [tickerInput, setTickerInput] = useState("NVDA");
  const [activeTicker, setActiveTicker] = useState("NVDA");
  const [tickerList, setTickerList] = useState<string[]>(["NVDA"]);

  // Duration & Interval
  const [selectedRange, setSelectedRange] = useState("1y");
  const [selectedInterval, setSelectedInterval] = useState<string>("1d");
  const [customFrom, setCustomFrom] = useState("1976-01-01");
  const [customTo, setCustomTo] = useState(new Date().toISOString().split("T")[0]);

  // Overlays & Toggles
  const [showSma20, setShowSma20] = useState(true);
  const [showBollinger, setShowBollinger] = useState(true);
  const [showRsiOverlay, setShowRsiOverlay] = useState(false);
  const [showRsiVolumePane, setShowRsiVolumePane] = useState(true);
  const [rsiVolumeMode, setRsiVolumeMode] = useState<"combined" | "rsi" | "volume">("combined");
  const [showVolume, setShowVolume] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [isLogScale, setIsLogScale] = useState(false);
  const [showDataTable, setShowDataTable] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);

  // Data fetching state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<HistoricalChartResponse | null>(null);
  // Pinned/inspected chart point state (anchored to top-left corner)
  const [pinnedBar, setPinnedBar] = useState<(HistoricalBar & Record<string, any>) | null>(null);

  // Active stock company profile state (Description, IPO Year, Total Market Cap, etc.)
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Fetch company profile whenever activeTicker changes
  const fetchProfile = useCallback(async (ticker: string) => {
    const sym = ticker.trim().toUpperCase();
    if (!sym) return;
    setProfileLoading(true);

    try {
      const res = await fetch(`/api/company-profile?ticker=${encodeURIComponent(sym)}`);
      if (res.ok) {
        const data: CompanyProfile = await res.json();
        setCompanyProfile(data);
      } else {
        setCompanyProfile(null);
      }
    } catch (err) {
      console.error("Error fetching company profile:", err);
      setCompanyProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile(activeTicker);
  }, [activeTicker, fetchProfile]);

  // Volume format helper
  const formatVolumeNumber = (vol: number | undefined | null): string => {
    if (!vol || isNaN(vol)) return "0";
    if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)}B`;
    if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
    if (vol >= 1_000) return `${(vol / 1_000).toFixed(0)}K`;
    return vol.toLocaleString();
  };

  // Intelligent interval default when range changes
  const handleRangeChange = (rangeId: string) => {
    setSelectedRange(rangeId);
    if (rangeId === "50y" || rangeId === "max" || rangeId === "30y") {
      // For multi-decade ranges, default to weekly or monthly for buttery smooth rendering
      setSelectedInterval("1mo");
    } else if (rangeId === "10y" || rangeId === "20y" || rangeId === "5y") {
      setSelectedInterval("1wk");
    } else {
      setSelectedInterval("1d");
    }
  };

  // Fetch chart data from API
  const fetchChart = useCallback(async () => {
    if (!activeTicker) return;
    setLoading(true);
    setError(null);

    try {
      const tickersParam = tickerList.join(",");
      let url = `/api/historical-chart?ticker=${encodeURIComponent(tickersParam)}&range=${selectedRange}`;
      if (selectedInterval) {
        url += `&interval=${selectedInterval}`;
      }
      if (selectedRange === "custom") {
        url += `&from=${customFrom}&to=${customTo}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with ${res.status}`);
      }

      const data: HistoricalChartResponse = await res.json();
      setChartData(data);
    } catch (err: any) {
      console.error("Error fetching historical chart:", err);
      setError(err.message || "Failed to load historical chart data");
    } finally {
      setLoading(false);
    }
  }, [activeTicker, tickerList, selectedRange, selectedInterval, selectedRange, customFrom, customTo]);

  useEffect(() => {
    fetchChart();
  }, [fetchChart]);

  // Handle ticker submission
  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = tickerInput.trim();
    if (!raw) return;

    const parsed = raw
      .split(/[,;\s]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);

    if (parsed.length > 0) {
      setTickerList(parsed);
      setActiveTicker(parsed[0]);
    }
  };

  const handleSelectTicker = (ticker: string) => {
    const sym = ticker.trim().toUpperCase();
    setActiveTicker(sym);
    setTickerInput(sym);
    setTickerList([sym]);
  };

  // Format date ticks according to selected range
  const formatXAxisTick = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const parts = dateStr.split("-");
      if (parts.length < 3) return dateStr;
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];

      if (selectedRange === "50y" || selectedRange === "30y" || selectedRange === "20y" || selectedRange === "max") {
        return year;
      }
      if (selectedRange === "5y" || selectedRange === "10y") {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const mIdx = parseInt(month, 10) - 1;
        return `${monthNames[mIdx] || month} '${year.slice(2)}`;
      }
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const mIdx = parseInt(month, 10) - 1;
      return `${monthNames[mIdx] || month} ${day}`;
    } catch {
      return dateStr;
    }
  };

  // Enrich bars with 20-day Volume SMA and day direction
  const enrichedBars = useMemo(() => {
    if (!chartData || !chartData.bars) return [];
    const rawBars = chartData.bars;

    return rawBars.map((b, i) => {
      let volSum = 0;
      let count = 0;
      const startIdx = Math.max(0, i - 19);
      for (let k = startIdx; k <= i; k++) {
        if (rawBars[k].volume > 0) {
          volSum += rawBars[k].volume;
          count++;
        }
      }
      const volumeSma20 = count > 0 ? Math.round(volSum / count) : b.volume;
      const isUpDay = b.close >= (b.open ?? b.close);

      return {
        ...b,
        volumeSma20,
        isUpDay,
      };
    });
  }, [chartData]);

  // Merge comparison tickers if in comparison mode
  const mergedChartData = useMemo(() => {
    if (!enrichedBars || enrichedBars.length === 0) return [];
    if (!comparisonMode || !chartData?.comparisons || chartData.comparisons.length === 0) {
      return enrichedBars;
    }

    const baseBars = enrichedBars;
    const firstClose = baseBars[0]?.close || 1;

    // Create a map by date for comparison series
    const compMap = new Map<string, Record<string, number>>();
    for (const comp of chartData.comparisons) {
      for (const pt of comp.data) {
        if (!compMap.has(pt.date)) compMap.set(pt.date, {});
        compMap.get(pt.date)![comp.ticker] = pt.pctReturn;
      }
    }

    return baseBars.map((bar) => {
      const primaryPctReturn = firstClose > 0 ? Number((((bar.close - firstClose) / firstClose) * 100).toFixed(2)) : 0;
      const comps = compMap.get(bar.date) || {};
      return {
        ...bar,
        primaryPctReturn,
        ...comps,
      };
    });
  }, [enrichedBars, comparisonMode, chartData]);

  // Zooming & Panning State (Synchronized across Main Chart and Sub-Pane)
  const [zoomRange, setZoomRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const [showBrush, setShowBrush] = useState<boolean>(true);

  // Reset zoom whenever ticker, range, or interval changes
  useEffect(() => {
    setZoomRange(null);
    setRefAreaLeft(null);
    setRefAreaRight(null);
    setPinnedBar(null);
  }, [activeTicker, selectedRange, selectedInterval]);

  // Synchronized visible slices for Main Chart and Sub-Pane
  const visibleChartData = useMemo(() => {
    if (!zoomRange) return mergedChartData;
    return mergedChartData.slice(zoomRange.startIndex, zoomRange.endIndex + 1);
  }, [mergedChartData, zoomRange]);

  const visibleEnrichedBars = useMemo(() => {
    if (!zoomRange) return enrichedBars;
    return enrichedBars.slice(zoomRange.startIndex, zoomRange.endIndex + 1);
  }, [enrichedBars, zoomRange]);

  // Calculate Y-axis domain with padding for price, adapting to zoom level
  const yDomain = useMemo(() => {
    const dataToUse = visibleChartData.length > 0 ? visibleChartData : (chartData?.bars || []);
    if (dataToUse.length === 0) return ["auto", "auto"];

    let min = Infinity;
    let max = -Infinity;

    for (const b of dataToUse) {
      if (b.close > max) max = b.close;
      if (b.close < min) min = b.close;
      if (showBollinger && b.bollingerUpper !== null && b.bollingerUpper > max) max = b.bollingerUpper;
      if (showBollinger && b.bollingerLower !== null && b.bollingerLower < min && b.bollingerLower > 0)
        min = b.bollingerLower;
      if (showSma20 && b.sma20 !== null) {
        if (b.sma20 > max) max = b.sma20;
        if (b.sma20 < min && b.sma20 > 0) min = b.sma20;
      }
    }

    if (min === Infinity || max === -Infinity) return ["auto", "auto"];
    const padding = (max - min) * 0.06;
    const lowerBound = Math.max(0.01, Number((min - padding).toFixed(2)));
    const upperBound = Number((max + padding).toFixed(2));
    return [lowerBound, upperBound];
  }, [visibleChartData, chartData, showBollinger, showSma20]);

  // Zoom handlers
  const handleZoomIn = () => {
    if (!mergedChartData || mergedChartData.length < 5) return;
    const start = zoomRange ? zoomRange.startIndex : 0;
    const end = zoomRange ? zoomRange.endIndex : mergedChartData.length - 1;
    const span = end - start;
    if (span <= 4) return;
    const delta = Math.max(1, Math.floor(span * 0.2));
    setZoomRange({
      startIndex: start + delta,
      endIndex: end - delta,
    });
  };

  const handleZoomOut = () => {
    if (!mergedChartData || mergedChartData.length < 5) return;
    const start = zoomRange ? zoomRange.startIndex : 0;
    const end = zoomRange ? zoomRange.endIndex : mergedChartData.length - 1;
    const span = end - start;
    const delta = Math.max(1, Math.floor(span * 0.25));
    const newStart = Math.max(0, start - delta);
    const newEnd = Math.min(mergedChartData.length - 1, end + delta);
    if (newStart === 0 && newEnd === mergedChartData.length - 1) {
      setZoomRange(null);
    } else {
      setZoomRange({ startIndex: newStart, endIndex: newEnd });
    }
  };

  const handlePanLeft = () => {
    if (!zoomRange || !mergedChartData) return;
    const { startIndex, endIndex } = zoomRange;
    const span = endIndex - startIndex;
    const shift = Math.max(1, Math.floor(span * 0.2));
    const newStart = Math.max(0, startIndex - shift);
    const newEnd = newStart + span;
    setZoomRange({ startIndex: newStart, endIndex: newEnd });
  };

  const handlePanRight = () => {
    if (!zoomRange || !mergedChartData) return;
    const { startIndex, endIndex } = zoomRange;
    const span = endIndex - startIndex;
    const shift = Math.max(1, Math.floor(span * 0.2));
    const newEnd = Math.min(mergedChartData.length - 1, endIndex + shift);
    const newStart = Math.max(0, newEnd - span);
    setZoomRange({ startIndex: newStart, endIndex: newEnd });
  };

  const handleResetZoom = () => {
    setZoomRange(null);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const handleChartMouseDown = (e: any) => {
    if (e && e.activeLabel) {
      setRefAreaLeft(e.activeLabel);
    }
  };

  const handleChartMouseMove = (e: any) => {
    if (refAreaLeft && e && e.activeLabel) {
      setRefAreaRight(e.activeLabel);
    }
  };

  const handleChartMouseUp = () => {
    if (refAreaLeft && refAreaRight && refAreaLeft !== refAreaRight && mergedChartData.length > 0) {
      const idx1 = mergedChartData.findIndex((d) => d.date === refAreaLeft);
      const idx2 = mergedChartData.findIndex((d) => d.date === refAreaRight);
      if (idx1 !== -1 && idx2 !== -1) {
        const start = Math.min(idx1, idx2);
        const end = Math.max(idx1, idx2);
        if (end - start >= 2) {
          setZoomRange({ startIndex: start, endIndex: end });
        }
      }
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!chartData || !chartData.bars || chartData.bars.length === 0) return;

    const headers = [
      "Date",
      "Open",
      "High",
      "Low",
      "Close",
      "Volume",
      "SMA20",
      "BollingerUpper",
      "BollingerLower",
      "BollingerBandwidthPct",
      "RSI14",
    ];

    const rows = chartData.bars.map((b) => [
      b.date,
      b.open,
      b.high,
      b.low,
      b.close,
      b.volume,
      b.sma20 ?? "",
      b.bollingerUpper ?? "",
      b.bollingerLower ?? "",
      b.bollingerBandwidth ?? "",
      b.rsi14 ?? "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${chartData.primaryTicker}_${selectedRange}_technical_chart.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = chartData?.summary;
  const isPositiveReturn = summary ? summary.periodChange >= 0 : true;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6 font-sans">
      {/* Prominent Index & ETF Rebalance Radar at top of Stock Chart */}
      <RebalancingAlertBanner variant="chart-header" />

      {/* Top Banner & Control Center */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Activity className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight font-display flex items-center gap-2">
                Technical Charting Suite
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                  Up to 50Y History • RSI • Bollinger • 20 SMA
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              High-resolution institutional historical charts with overlaid 20-day Simple Moving Average (SMA), 2σ
              Bollinger Bands envelope, and Wilder's RSI(14) oscillator. Multi-decade coverage up to 50 years.
            </p>
          </div>

          {/* Search Input for Ticker(s) */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                placeholder="Ticker(s) e.g. NVDA, AAPL, SPY"
                className="pl-9 pr-3 py-2 bg-slate-800/90 border border-slate-700 text-white rounded-xl text-xs font-mono font-medium placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-56 sm:w-64"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Load</span>
            </button>
          </form>
        </div>

        {/* Quick Ticker Chips & Multi-ticker Tabs */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-400 mr-1">Quick Select:</span>
            {POPULAR_TICKERS.map((t) => (
              <button
                key={t}
                onClick={() => handleSelectTicker(t)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                  activeTicker === t && tickerList.length === 1
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30 border border-blue-500"
                    : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700/60 hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}

            {watchlist.length > 0 && (
              <>
                <span className="text-slate-600 mx-1">|</span>
                <span className="text-[11px] font-semibold text-slate-400">Watchlist:</span>
                {watchlist.slice(0, 6).map((w) => (
                  <button
                    key={w}
                    onClick={() => handleSelectTicker(w)}
                    className={`px-2 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                      activeTicker === w
                        ? "bg-indigo-600 text-white border border-indigo-500"
                        : "bg-slate-800/60 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-800"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Active Tickers Multi-Switch (if multiple tickers entered) */}
          {tickerList.length > 1 && (
            <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 px-2">Active:</span>
              {tickerList.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTicker(t)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    activeTicker === t
                      ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {t}
                </button>
              ))}
              <button
                onClick={() => setComparisonMode(!comparisonMode)}
                className={`ml-2 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                  comparisonMode
                    ? "bg-purple-600/20 text-purple-300 border-purple-500/40"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                }`}
              >
                {comparisonMode ? "Compare: ON" : "Compare: OFF"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Active Stock Company Overview Card (Description, IPO Year, Total Market Cap, Leadership, etc.) */}
      <CompanyProfileCard
        profile={companyProfile}
        loading={profileLoading}
        activeTicker={activeTicker}
      />

      {/* Duration & Interval Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Duration presets */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <span className="text-xs font-semibold text-slate-400 mr-2 flex items-center gap-1 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            Duration:
          </span>
          {DURATION_PRESETS.map((p) => {
            const is50Y = p.id === "50y";
            const isSelected = selectedRange === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handleRangeChange(p.id)}
                title={p.desc}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? is50Y
                      ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-md shadow-amber-500/30 border border-amber-400"
                      : "bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-500"
                    : is50Y
                    ? "bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30"
                    : "bg-slate-800/90 text-slate-300 hover:bg-slate-750 hover:text-white border border-slate-700/60"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Interval & Scale Controls */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {/* Interval */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            {INTERVAL_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSelectedInterval(opt.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedInterval === opt.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Logarithmic Scale Toggle */}
          <button
            onClick={() => setIsLogScale(!isLogScale)}
            title="Logarithmic scale is recommended when viewing 10Y to 50Y charts with multi-hundred percent expansion"
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
              isLogScale
                ? "bg-purple-600/20 text-purple-300 border-purple-500/40"
                : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
            }`}
          >
            <span>Log Scale</span>
            {isLogScale && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
          </button>

          {/* Refresh */}
          <button
            onClick={fetchChart}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Refresh Chart"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Custom Date Pickers (visible if custom range selected) */}
      {selectedRange === "custom" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300">From:</span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs outline-none font-mono"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300">To:</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs outline-none font-mono"
            />
          </div>
          <button
            onClick={fetchChart}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm"
          >
            Apply Range
          </button>
        </div>
      )}

      {/* Technical Overlays Filter Strip */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-md flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            Main Chart Overlays:
          </span>

          {/* 20-Day SMA */}
          <button
            onClick={() => setShowSma20(!showSma20)}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 cursor-pointer ${
              showSma20
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm"
                : "bg-slate-800/80 text-slate-500 border-slate-700 hover:text-slate-300"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            <span>20-Day SMA</span>
          </button>

          {/* Bollinger Bands */}
          <button
            onClick={() => setShowBollinger(!showBollinger)}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 cursor-pointer ${
              showBollinger
                ? "bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm"
                : "bg-slate-800/80 text-slate-500 border-slate-700 hover:text-slate-300"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
            <span>Bollinger Bands (20, 2σ)</span>
          </button>

          {/* Main Chart Volume Overlay */}
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 cursor-pointer ${
              showVolume
                ? "bg-slate-700 text-slate-200 border-slate-600 shadow-sm"
                : "bg-slate-800/80 text-slate-500 border-slate-700 hover:text-slate-300"
            }`}
            title="Overlay volume bars on main chart (pricing remains intact)"
          >
            <BarChart2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Main Chart Volume</span>
          </button>

          {/* RSI Overlay */}
          <button
            onClick={() => setShowRsiOverlay(!showRsiOverlay)}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 cursor-pointer ${
              showRsiOverlay
                ? "bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm"
                : "bg-slate-800/80 text-slate-500 border-slate-700 hover:text-slate-300"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
            <span>RSI Overlay</span>
          </button>

          {/* Annotations */}
          <button
            onClick={() => setShowAnnotations(!showAnnotations)}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 cursor-pointer ${
              showAnnotations
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm"
                : "bg-slate-800/80 text-slate-500 border-slate-700 hover:text-slate-300"
            }`}
          >
            <Flame className="w-3 h-3 text-rose-400" />
            <span>Key Annotations</span>
          </button>
        </div>

        {/* Right side utility buttons */}
        <div className="flex items-center gap-2">
          {/* Dedicated RSI & Volume Sub-Pane Toggle */}
          <button
            onClick={() => setShowRsiVolumePane(!showRsiVolumePane)}
            className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
              showRsiVolumePane
                ? "bg-purple-600/30 text-purple-200 border-purple-500/60 shadow-sm"
                : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-purple-400" />
            <span>RSI / Volume Pane</span>
          </button>

          {/* Data Table */}
          <button
            onClick={() => setShowDataTable(!showDataTable)}
            className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1 ${
              showDataTable
                ? "bg-blue-600/30 text-blue-300 border-blue-500/50"
                : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            title="Download CSV of Historical Prices & Indicators"
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Technicals Stat Cards Strip */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 1. Price & Period Return */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {summary.ticker} Price
            </span>
            <div className="text-xl font-black text-white font-mono mt-0.5">
              ${summary.currentPrice.toFixed(2)}
            </div>
            <div className="flex items-center gap-1 text-xs font-bold mt-1 font-mono">
              {isPositiveReturn ? (
                <>
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">
                    +{summary.periodChange.toFixed(2)} (+{summary.periodChangePct.toFixed(1)}%)
                  </span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-rose-400">
                    {summary.periodChange.toFixed(2)} ({summary.periodChangePct.toFixed(1)}%)
                  </span>
                </>
              )}
              <span className="text-[10px] text-slate-500 font-sans">({selectedRange.toUpperCase()})</span>
            </div>
          </div>

          {/* 2. 20-Day SMA */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              20-Day SMA
            </span>
            <div className="text-xl font-black text-white font-mono mt-0.5">
              {summary.sma20 ? `$${summary.sma20.toFixed(2)}` : "—"}
            </div>
            <div className="text-xs font-medium text-slate-400 mt-1">
              {summary.priceVsSma20Pct !== null ? (
                <span
                  className={
                    summary.priceVsSma20Pct >= 0
                      ? "text-emerald-400 font-bold font-mono"
                      : "text-rose-400 font-bold font-mono"
                  }
                >
                  {summary.priceVsSma20Pct >= 0 ? `+${summary.priceVsSma20Pct}%` : `${summary.priceVsSma20Pct}%`}{" "}
                  vs SMA
                </span>
              ) : (
                "Building 20-bar baseline"
              )}
            </div>
          </div>

          {/* 3. Bollinger Bands */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
            <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              Bollinger Bands (2σ)
            </span>
            <div className="text-xs font-mono text-slate-200 mt-1.5 space-y-0.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Upper:</span>
                <span className="font-bold text-sky-300">
                  {summary.bollingerUpper ? `$${summary.bollingerUpper.toFixed(2)}` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Lower:</span>
                <span className="font-bold text-sky-300">
                  {summary.bollingerLower ? `$${summary.bollingerLower.toFixed(2)}` : "—"}
                </span>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 flex justify-between font-mono">
              <span>Width: {summary.bollingerBandwidth ? `${summary.bollingerBandwidth}%` : "—"}</span>
              <span className="text-sky-400 font-medium">{summary.bollingerSignal.split(" ")[0]}</span>
            </div>
          </div>

          {/* 4. RSI (14) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
            <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              Wilder's RSI (14)
            </span>
            <div className="text-xl font-black font-mono mt-0.5 flex items-baseline gap-2">
              <span
                className={
                  summary.rsi14 === null
                    ? "text-slate-400"
                    : summary.rsi14 >= 70
                    ? "text-rose-400"
                    : summary.rsi14 <= 30
                    ? "text-emerald-400"
                    : "text-purple-300"
                }
              >
                {summary.rsi14 !== null ? summary.rsi14.toFixed(1) : "—"}
              </span>
              <span className="text-xs text-slate-500">/ 100</span>
            </div>
            <div className="mt-1">
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                  summary.rsi14 && summary.rsi14 >= 70
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    : summary.rsi14 && summary.rsi14 <= 30
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-purple-500/10 text-purple-300 border-purple-500/30"
                }`}
              >
                {summary.rsi14 && summary.rsi14 >= 70
                  ? "Overbought"
                  : summary.rsi14 && summary.rsi14 <= 30
                  ? "Oversold"
                  : "Neutral Zone"}
              </span>
            </div>
          </div>

          {/* 5. Period Range & Points */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md col-span-2 sm:col-span-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Period Extremes
            </span>
            <div className="text-xs font-mono text-slate-300 mt-1.5 space-y-0.5">
              <div className="flex justify-between">
                <span className="text-slate-400">High:</span>
                <span className="font-bold text-emerald-400">${summary.periodHigh.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Low:</span>
                <span className="font-bold text-rose-400">${summary.periodLow.toFixed(2)}</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-mono">
              {summary.dataPointsCount} bars ({summary.firstDate} to {summary.lastDate})
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Key Technical Insights Banner */}
      {summary && summary.technicalInsight && (
        <div className="bg-slate-900/70 border border-blue-500/30 rounded-2xl p-4 shadow-lg flex items-start gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wider font-display">
              Key Technical Assessment • {summary.ticker} ({selectedRange.toUpperCase()})
            </h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">{summary.technicalInsight}</p>
          </div>
        </div>
      )}

      {/* Main Interactive Chart Canvas */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white font-display">
              {chartData?.primaryTicker}
              {comparisonMode && chartData?.comparisons && chartData.comparisons.length > 0 && (
                <span className="text-slate-400 font-normal">
                  {" "}
                  vs {chartData.comparisons.map((c) => c.ticker).join(", ")}
                </span>
              )}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ({selectedInterval.toUpperCase()} Bars • {selectedRange.toUpperCase()})
            </span>
          </div>

          {/* Chart Legend Summary & Interactive Zoom Controls */}
          <div className="flex items-center gap-3 text-xs font-mono flex-wrap">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-950/90 px-2 py-1 rounded-xl border border-slate-800 text-xs shadow-inner">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mr-1">
                <ZoomIn className="w-3.5 h-3.5 text-blue-400" />
                <span>Zoom</span>
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
                title="Zoom In (+20%)"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
                title="Zoom Out (-20%)"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handlePanLeft}
                disabled={!zoomRange}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30 transition cursor-pointer"
                title="Pan Left (Earlier)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handlePanRight}
                disabled={!zoomRange}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white disabled:opacity-30 transition cursor-pointer"
                title="Pan Right (Later)"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                disabled={!zoomRange}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                  zoomRange
                    ? "bg-blue-600/30 text-blue-300 border border-blue-500/40 hover:bg-blue-600/50"
                    : "text-slate-500 opacity-50 cursor-not-allowed"
                }`}
                title="Reset Zoom to 100%"
              >
                <RotateCcw className="w-3 h-3" />
                <span>
                  {zoomRange
                    ? `${Math.round(((zoomRange.endIndex - zoomRange.startIndex + 1) / (mergedChartData.length || 1)) * 100)}%`
                    : "100%"}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-3 h-0.5 bg-emerald-400 inline-block" />
              <span>{comparisonMode ? `${chartData?.primaryTicker} %` : "Price ($)"}</span>
            </div>

            {showSma20 && !comparisonMode && (
              <div className="flex items-center gap-1.5 text-amber-400">
                <span className="w-3 h-0.5 bg-amber-400 inline-block" />
                <span>20 SMA</span>
              </div>
            )}

            {showBollinger && !comparisonMode && (
              <div className="flex items-center gap-1.5 text-sky-400">
                <span className="w-3 h-0.5 bg-sky-400 border-b border-dashed border-sky-400 inline-block" />
                <span>Bollinger (2σ)</span>
              </div>
            )}

            {showRsiOverlay && !comparisonMode && (
              <div className="flex items-center gap-1.5 text-purple-400">
                <span className="w-3 h-0.5 bg-purple-400 inline-block" />
                <span>RSI(14) [Right Axis]</span>
              </div>
            )}
          </div>
        </div>

        {/* Zoom Drag Hint */}
        {mergedChartData.length > 5 && (
          <div className="flex items-center justify-between text-[11px] text-slate-400 pb-2 px-1 font-mono">
            <span className="flex items-center gap-1.5 text-slate-400">
              <MoveHorizontal className="w-3.5 h-3.5 text-indigo-400" />
              <span>Click & drag across chart to zoom in, or use slider below</span>
            </span>
            {zoomRange && (
              <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30">
                Viewing {zoomRange.endIndex - zoomRange.startIndex + 1} of {mergedChartData.length} bars
              </span>
            )}
          </div>
        )}

        {/* Loading Spinner overlay */}
        {loading && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center rounded-2xl z-20">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
              <span className="text-xs font-semibold text-slate-300 font-mono">
                Fetching {selectedRange.toUpperCase()} historical bars for {activeTicker}...
              </span>
            </div>
          </div>
        )}

        {/* Recharts Main Canvas */}
        <div className="relative h-[490px] w-full">
          {/* Pinned Point Details HUD - Anchored to Top-Left Corner to never obstruct the plot */}
          {pinnedBar && (
            <div className="absolute top-2 left-16 z-30 bg-slate-950/95 border-2 border-cyan-400 ring-2 ring-cyan-500/20 rounded-xl p-3 shadow-2xl text-xs font-mono backdrop-blur-md min-w-[230px] max-w-[290px] animate-in fade-in duration-100">
              <div className="text-slate-300 font-bold border-b border-slate-800 pb-1.5 mb-2 font-sans flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                    📌 Pinned
                  </span>
                  <span className="text-white font-mono">{pinnedBar.date}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-bold">{chartData?.primaryTicker}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPinnedBar(null);
                    }}
                    className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 transition-colors"
                    title="Unpin point"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-emerald-400 font-semibold">Close:</span>
                  <span className="text-white font-bold">${pinnedBar.close?.toFixed(2)}</span>
                </div>
                {pinnedBar.open && (
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Open:</span>
                    <span>${pinnedBar.open.toFixed(2)}</span>
                  </div>
                )}
                {pinnedBar.high && pinnedBar.low && (
                  <div className="flex justify-between items-center text-slate-400">
                    <span>High / Low:</span>
                    <span>
                      ${pinnedBar.high.toFixed(2)} / ${pinnedBar.low.toFixed(2)}
                    </span>
                  </div>
                )}
                {showSma20 && pinnedBar.sma20 !== null && (
                  <div className="flex justify-between items-center pt-1 border-t border-slate-800/60">
                    <span className="text-amber-400">20 SMA:</span>
                    <span className="text-amber-300 font-semibold">${pinnedBar.sma20.toFixed(2)}</span>
                  </div>
                )}
                {showBollinger && pinnedBar.bollingerUpper !== null && (
                  <div className="flex justify-between items-center text-[11px] text-sky-400">
                    <span>BB Upper / Lower:</span>
                    <span>
                      ${pinnedBar.bollingerUpper.toFixed(2)} / ${pinnedBar.bollingerLower?.toFixed(2)}
                    </span>
                  </div>
                )}
                {pinnedBar.rsi14 !== null && (
                  <div className="flex justify-between items-center pt-1 border-t border-slate-800/60">
                    <span className="text-purple-400">RSI (14):</span>
                    <span
                      className={`font-bold ${
                        pinnedBar.rsi14 >= 70
                          ? "text-rose-400"
                          : pinnedBar.rsi14 <= 30
                          ? "text-emerald-400"
                          : "text-purple-300"
                      }`}
                    >
                      {pinnedBar.rsi14.toFixed(1)}{" "}
                      {pinnedBar.rsi14 >= 70 ? "(Overbought)" : pinnedBar.rsi14 <= 30 ? "(Oversold)" : ""}
                    </span>
                  </div>
                )}
                {pinnedBar.volume > 0 && (
                  <div className="flex justify-between items-center text-slate-400 pt-1 text-[11px]">
                    <span>Volume:</span>
                    <span className={pinnedBar.close >= (pinnedBar.open ?? pinnedBar.close) ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                      {pinnedBar.volume.toLocaleString()}{" "}
                      <span className="text-[10px]">({pinnedBar.close >= (pinnedBar.open ?? pinnedBar.close) ? "Up Vol" : "Down Vol"})</span>
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-2 pt-1 border-t border-slate-800/80 text-[10px] text-slate-400 flex justify-between items-center">
                <span>Click chart or [✕] to unpin</span>
              </div>
            </div>
          )}

          {mergedChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={mergedChartData}
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                onMouseDown={handleChartMouseDown}
                onMouseMove={handleChartMouseMove}
                onMouseUp={handleChartMouseUp}
                onClick={(e: any) => {
                  if (refAreaLeft && refAreaRight && refAreaLeft !== refAreaRight) return;
                  if (e && e.activePayload && e.activePayload.length > 0) {
                    const clicked = e.activePayload[0].payload as HistoricalBar & Record<string, any>;
                    if (clicked && clicked.date) {
                      setPinnedBar((prev) => (prev?.date === clicked.date ? null : clicked));
                    }
                  }
                }}
              >
                <defs>
                  {/* Price Area Gradient */}
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  {/* Bollinger Ribbon Gradient */}
                  <linearGradient id="bollingerGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.08} />
                  </linearGradient>
                  {/* RSI Gradient */}
                  <linearGradient id="rsiGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <XAxis
                  dataKey="date"
                  tickFormatter={formatXAxisTick}
                  stroke="#475569"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  dy={6}
                  minTickGap={35}
                />

                {/* Left Y Axis: Price ($) or Return % */}
                <YAxis
                  yAxisId="price"
                  domain={comparisonMode ? ["auto", "auto"] : isLogScale ? ["auto", "auto"] : yDomain}
                  scale={isLogScale ? "log" : "linear"}
                  stroke="#475569"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickFormatter={(val: number) => (comparisonMode ? `${val.toFixed(0)}%` : `$${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(val < 10 ? 2 : 1)}`)}
                  dx={-4}
                />

                {/* Hidden Right Y Axis: Volume (Scaled to bottom 20% so it NEVER squashes the price graph!) */}
                {showVolume && !comparisonMode && (
                  <YAxis
                    yAxisId="volume"
                    orientation="right"
                    hide={true}
                    domain={[0, (dataMax: number) => (dataMax ? dataMax * 4.5 : 100)]}
                  />
                )}

                {/* Right Y Axis: RSI(14) (0 to 100) */}
                {showRsiOverlay && !comparisonMode && (
                  <YAxis
                    yAxisId="rsi"
                    orientation="right"
                    domain={[0, 100]}
                    stroke="#a855f7"
                    tick={{ fill: "#c084fc", fontSize: 10 }}
                    ticks={[30, 50, 70]}
                    dx={4}
                  />
                )}

                {/* RSI Reference Lines: 70 Overbought, 30 Oversold */}
                {showRsiOverlay && !comparisonMode && (
                  <>
                    <ReferenceLine
                      yAxisId="rsi"
                      y={70}
                      stroke="#f43f5e"
                      strokeDasharray="3 3"
                      strokeWidth={1}
                      label={{
                        value: "RSI 70 (Overbought)",
                        fill: "#fb7185",
                        fontSize: 10,
                        position: "insideTopRight",
                      }}
                    />
                    <ReferenceLine
                      yAxisId="rsi"
                      y={30}
                      stroke="#10b981"
                      strokeDasharray="3 3"
                      strokeWidth={1}
                      label={{
                        value: "RSI 30 (Oversold)",
                        fill: "#34d399",
                        fontSize: 10,
                        position: "insideBottomRight",
                      }}
                    />
                  </>
                )}

                {/* Optional Volume Bars at bottom - isolated on yAxisId="volume" so price ($) is NEVER hidden or squashed */}
                {showVolume && !comparisonMode && (
                  <Bar
                    yAxisId="volume"
                    dataKey="volume"
                    barSize={Math.max(2, Math.min(8, Math.floor(600 / (mergedChartData.length || 1))))}
                    isAnimationActive={false}
                    name="Volume"
                  >
                    {mergedChartData.map((entry: any, index: number) => (
                      <Cell
                        key={`cell-vol-${index}`}
                        fill={entry.close >= (entry.open ?? entry.close) ? "#10b981" : "#f43f5e"}
                        opacity={0.3}
                      />
                    ))}
                  </Bar>
                )}

                {/* Bollinger Upper & Lower Bands with Shaded Channel */}
                {showBollinger && !comparisonMode && (
                  <>
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="bollingerUpper"
                      stroke="#38bdf8"
                      strokeWidth={1.2}
                      strokeDasharray="4 4"
                      dot={false}
                      isAnimationActive={false}
                      name="Bollinger Upper (2σ)"
                    />
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="bollingerLower"
                      stroke="#38bdf8"
                      strokeWidth={1.2}
                      strokeDasharray="4 4"
                      dot={false}
                      isAnimationActive={false}
                      name="Bollinger Lower (2σ)"
                    />
                  </>
                )}

                {/* 20-Day Simple Moving Average (SMA 20) */}
                {showSma20 && !comparisonMode && (
                  <Line
                    yAxisId="price"
                    type="monotone"
                    dataKey="sma20"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    name="20-Day SMA"
                  />
                )}

                {/* Primary Closing Price (Line & Gradient Area) */}
                {!comparisonMode && (
                  <Area
                    yAxisId="price"
                    type="monotone"
                    dataKey="close"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#priceGradient)"
                    isAnimationActive={false}
                    name={`${chartData?.primaryTicker} Price`}
                  />
                )}

                {/* Overlaid RSI Line */}
                {showRsiOverlay && !comparisonMode && (
                  <Line
                    yAxisId="rsi"
                    type="monotone"
                    dataKey="rsi14"
                    stroke="#c084fc"
                    strokeWidth={1.6}
                    dot={false}
                    isAnimationActive={false}
                    name="RSI (14)"
                  />
                )}

                {/* Comparison Mode Multi-Ticker Lines */}
                {comparisonMode && (
                  <>
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="primaryPctReturn"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={false}
                      name={`${chartData?.primaryTicker} %`}
                    />
                    {chartData?.comparisons?.map((comp, idx) => {
                      const colors = ["#38bdf8", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"];
                      const color = colors[idx % colors.length];
                      return (
                        <Line
                          key={comp.ticker}
                          yAxisId="price"
                          type="monotone"
                          dataKey={comp.ticker}
                          stroke={color}
                          strokeWidth={2}
                          dot={false}
                          name={`${comp.ticker} %`}
                        />
                      );
                    })}
                  </>
                )}

                {/* Custom Interactive Tooltip - Anchored to Top-Left Corner to never obstruct the plot */}
                <Tooltip
                  position={{ x: 65, y: 12 }}
                  isAnimationActive={false}
                  content={({ active, payload, label }) => {
                    // Suppress hover tooltip if a point is already pinned to avoid visual collision
                    if (pinnedBar) return null;
                    if (!active || !payload || payload.length === 0) return null;
                    const data = payload[0].payload as HistoricalBar & Record<string, any>;

                    return (
                      <div className="bg-slate-950/95 border border-slate-700/80 rounded-xl p-3 shadow-2xl text-xs font-mono backdrop-blur-md min-w-[220px] max-w-[280px]">
                        <div className="text-slate-400 font-bold border-b border-slate-800 pb-1 mb-2 font-sans flex items-center justify-between">
                          <span className="text-white">{data.date}</span>
                          <span className="text-[10px] text-slate-400 font-bold">{chartData?.primaryTicker}</span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-emerald-400 font-semibold">Close:</span>
                            <span className="text-white font-bold">${data.close?.toFixed(2)}</span>
                          </div>
                          {data.open && (
                            <div className="flex justify-between items-center text-slate-400">
                              <span>Open:</span>
                              <span>${data.open.toFixed(2)}</span>
                            </div>
                          )}
                          {data.high && data.low && (
                            <div className="flex justify-between items-center text-slate-400">
                              <span>High / Low:</span>
                              <span>
                                ${data.high.toFixed(2)} / ${data.low.toFixed(2)}
                              </span>
                            </div>
                          )}

                          {showSma20 && data.sma20 !== null && (
                            <div className="flex justify-between items-center pt-1 border-t border-slate-800/60">
                              <span className="text-amber-400">20 SMA:</span>
                              <span className="text-amber-300 font-semibold">${data.sma20.toFixed(2)}</span>
                            </div>
                          )}

                          {showBollinger && data.bollingerUpper !== null && (
                            <div className="flex justify-between items-center text-[11px] text-sky-400">
                              <span>BB Upper / Lower:</span>
                              <span>
                                ${data.bollingerUpper.toFixed(2)} / ${data.bollingerLower?.toFixed(2)}
                              </span>
                            </div>
                          )}

                          {data.rsi14 !== null && (
                            <div className="flex justify-between items-center pt-1 border-t border-slate-800/60">
                              <span className="text-purple-400">RSI (14):</span>
                              <span
                                className={`font-bold ${
                                  data.rsi14 >= 70
                                    ? "text-rose-400"
                                    : data.rsi14 <= 30
                                    ? "text-emerald-400"
                                    : "text-purple-300"
                                }`}
                              >
                                {data.rsi14.toFixed(1)}{" "}
                                {data.rsi14 >= 70 ? "(Overbought)" : data.rsi14 <= 30 ? "(Oversold)" : ""}
                              </span>
                            </div>
                          )}

                          {data.volume > 0 && (
                            <div className="flex justify-between items-center text-slate-400 pt-1 text-[11px]">
                              <span>Volume:</span>
                              <span className={data.close >= (data.open ?? data.close) ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                                {data.volume.toLocaleString()}{" "}
                                <span className="text-[10px]">({data.close >= (data.open ?? data.close) ? "Up Vol" : "Down Vol"})</span>
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 pt-1 border-t border-slate-800/80 text-[10px] text-slate-500 text-center">
                          Click chart to pin point
                        </div>
                      </div>
                    );
                  }}
                />

                {/* Visual drag box for drag-to-zoom */}
                {refAreaLeft && refAreaRight && (
                  <ReferenceArea
                    yAxisId="price"
                    x1={refAreaLeft}
                    x2={refAreaRight}
                    stroke="#818cf8"
                    strokeOpacity={0.6}
                    fill="#6366f1"
                    fillOpacity={0.25}
                  />
                )}

                {/* Interactive Zoom/Pan Brush Timeline */}
                {showBrush && mergedChartData.length > 5 && (
                  <Brush
                    dataKey="date"
                    height={26}
                    stroke="#6366f1"
                    fill="#0b0f19"
                    travellerWidth={10}
                    startIndex={zoomRange ? zoomRange.startIndex : 0}
                    endIndex={zoomRange ? zoomRange.endIndex : mergedChartData.length - 1}
                    onChange={(range) => {
                      if (range && typeof range.startIndex === "number" && typeof range.endIndex === "number") {
                        if (range.startIndex === 0 && range.endIndex === mergedChartData.length - 1) {
                          setZoomRange(null);
                        } else {
                          setZoomRange({ startIndex: range.startIndex, endIndex: range.endIndex });
                        }
                      }
                    }}
                    tickFormatter={formatXAxisTick}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-xs">
              No historical price data available for the selected duration.
            </div>
          )}
        </div>
      </div>

      {/* Dedicated Synchronized RSI & Volume Sub-Pane */}
      {showRsiVolumePane && chartData && chartData.bars && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 mb-3 gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider font-display flex items-center gap-1.5 text-purple-400">
                <Activity className="w-4 h-4" />
                RSI & Volume Analytics Pane
              </span>

              {/* Mode Toggles */}
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
                <button
                  onClick={() => setRsiVolumeMode("combined")}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    rsiVolumeMode === "combined"
                      ? "bg-purple-600/30 text-purple-300 border border-purple-500/40 shadow-xs"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Combined (RSI + Volume)
                </button>
                <button
                  onClick={() => setRsiVolumeMode("rsi")}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    rsiVolumeMode === "rsi"
                      ? "bg-purple-600/30 text-purple-300 border border-purple-500/40 shadow-xs"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Wilder's RSI (14)
                </button>
                <button
                  onClick={() => setRsiVolumeMode("volume")}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    rsiVolumeMode === "volume"
                      ? "bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-xs"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Trading Volume
                </button>
              </div>
            </div>

            {/* Indicator Stats Chips */}
            <div className="flex items-center gap-4 text-xs font-mono flex-wrap">
              {summary && summary.rsi14 !== null && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">RSI (14):</span>
                  <span
                    className={`font-bold ${
                      summary.rsi14 >= 70
                        ? "text-rose-400"
                        : summary.rsi14 <= 30
                        ? "text-emerald-400"
                        : "text-purple-300"
                    }`}
                  >
                    {summary.rsi14.toFixed(1)}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-sans font-semibold ${
                      summary.rsi14 >= 70
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : summary.rsi14 <= 30
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {summary.rsi14 >= 70 ? "Overbought" : summary.rsi14 <= 30 ? "Oversold" : "Neutral"}
                  </span>
                </div>
              )}

              {enrichedBars.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Latest Vol:</span>
                    <span className="text-white font-bold">
                      {formatVolumeNumber(enrichedBars[enrichedBars.length - 1]?.volume)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-400">
                    <span className="text-slate-400">20d Avg:</span>
                    <span>
                      {formatVolumeNumber(enrichedBars[enrichedBars.length - 1]?.volumeSma20)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sub-Plot Visualizer */}
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {rsiVolumeMode === "combined" ? (
                <ComposedChart data={visibleEnrichedBars} margin={{ top: 8, right: 30, left: 10, bottom: 5 }}>
                  <XAxis dataKey="date" hide />
                  {/* Left Y-Axis: RSI (0-100) */}
                  <YAxis
                    yAxisId="rsi"
                    domain={[0, 100]}
                    stroke="#a855f7"
                    tick={{ fill: "#c084fc", fontSize: 10 }}
                    ticks={[30, 50, 70]}
                    dx={-4}
                  />
                  {/* Right Y-Axis: Volume */}
                  <YAxis
                    yAxisId="vol"
                    orientation="right"
                    stroke="#64748b"
                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                    tickFormatter={formatVolumeNumber}
                    dx={4}
                  />
                  {/* RSI Reference Lines & Zones */}
                  <ReferenceLine yAxisId="rsi" y={70} stroke="#f43f5e" strokeDasharray="3 3" strokeWidth={1} />
                  <ReferenceLine yAxisId="rsi" y={50} stroke="#64748b" strokeDasharray="2 2" strokeWidth={0.8} />
                  <ReferenceLine yAxisId="rsi" y={30} stroke="#10b981" strokeDasharray="3 3" strokeWidth={1} />
                  <ReferenceArea yAxisId="rsi" y1={70} y2={100} fill="#f43f5e" fillOpacity={0.07} />
                  <ReferenceArea yAxisId="rsi" y1={0} y2={30} fill="#10b981" fillOpacity={0.07} />

                  {/* Volume Bars */}
                  <Bar
                    yAxisId="vol"
                    dataKey="volume"
                    barSize={Math.max(2, Math.min(8, Math.floor(600 / (visibleEnrichedBars.length || 1))))}
                    isAnimationActive={false}
                    name="Volume"
                  >
                    {visibleEnrichedBars.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isUpDay ? "#10b981" : "#f43f5e"}
                        opacity={0.35}
                      />
                    ))}
                  </Bar>

                  {/* RSI Oscillator Line */}
                  <Line
                    yAxisId="rsi"
                    type="monotone"
                    dataKey="rsi14"
                    stroke="#c084fc"
                    strokeWidth={1.8}
                    dot={false}
                    isAnimationActive={false}
                    name="RSI (14)"
                  />

                  <Tooltip
                    position={{ x: 65, y: 8 }}
                    isAnimationActive={false}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-950/95 border border-slate-700 rounded-xl p-2.5 shadow-xl text-xs font-mono">
                          <div className="text-slate-400 font-semibold border-b border-slate-800 pb-1 mb-1.5 flex justify-between gap-3">
                            <span>{d.date}</span>
                            <span className={d.isUpDay ? "text-emerald-400" : "text-rose-400"}>
                              {d.isUpDay ? "Bullish Day" : "Bearish Day"}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between gap-4">
                              <span className="text-purple-400 font-medium">RSI (14):</span>
                              <span className="text-white font-bold">{d.rsi14 ? d.rsi14.toFixed(1) : "—"}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-300 font-medium">Volume:</span>
                              <span className="text-white font-bold">{d.volume?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-amber-400 font-medium">20d Avg Vol:</span>
                              <span className="text-slate-200">{d.volumeSma20?.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                </ComposedChart>
              ) : rsiVolumeMode === "rsi" ? (
                <ComposedChart data={visibleEnrichedBars} margin={{ top: 8, right: 30, left: 10, bottom: 5 }}>
                  <XAxis dataKey="date" hide />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#a855f7"
                    tick={{ fill: "#c084fc", fontSize: 10 }}
                    ticks={[30, 50, 70]}
                    dx={-4}
                  />
                  <ReferenceLine y={70} stroke="#f43f5e" strokeDasharray="3 3" strokeWidth={1} label={{ value: "Overbought 70", fill: "#fb7185", fontSize: 10 }} />
                  <ReferenceLine y={50} stroke="#64748b" strokeDasharray="2 2" strokeWidth={0.8} />
                  <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" strokeWidth={1} label={{ value: "Oversold 30", fill: "#34d399", fontSize: 10 }} />
                  <ReferenceArea y1={70} y2={100} fill="#f43f5e" fillOpacity={0.08} />
                  <ReferenceArea y1={0} y2={30} fill="#10b981" fillOpacity={0.08} />
                  <Line
                    type="monotone"
                    dataKey="rsi14"
                    stroke="#c084fc"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    name="Wilder's RSI (14)"
                  />
                  <Tooltip
                    position={{ x: 65, y: 8 }}
                    isAnimationActive={false}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-950/95 border border-purple-500/40 rounded-xl p-2.5 shadow-xl text-xs font-mono">
                          <div className="text-slate-400 font-semibold border-b border-slate-800 pb-1 mb-1.5 flex justify-between gap-3">
                            <span>{d.date}</span>
                            <span className="text-purple-300 font-bold">{d.rsi14 ? `${d.rsi14.toFixed(1)} / 100` : "—"}</span>
                          </div>
                          <div className="text-[11px] text-slate-300">
                            Status:{" "}
                            <strong className={d.rsi14 >= 70 ? "text-rose-400" : d.rsi14 <= 30 ? "text-emerald-400" : "text-purple-300"}>
                              {d.rsi14 >= 70 ? "Overbought" : d.rsi14 <= 30 ? "Oversold" : "Neutral Zone"}
                            </strong>
                          </div>
                        </div>
                      );
                    }}
                  />
                </ComposedChart>
              ) : (
                <ComposedChart data={visibleEnrichedBars} margin={{ top: 8, right: 30, left: 10, bottom: 5 }}>
                  <XAxis dataKey="date" hide />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                    tickFormatter={formatVolumeNumber}
                    dx={-4}
                  />
                  <Bar
                    dataKey="volume"
                    barSize={Math.max(2, Math.min(8, Math.floor(600 / (visibleEnrichedBars.length || 1))))}
                    isAnimationActive={false}
                    name="Volume"
                  >
                    {visibleEnrichedBars.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isUpDay ? "#10b981" : "#f43f5e"}
                        opacity={0.4}
                      />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="volumeSma20"
                    stroke="#f59e0b"
                    strokeWidth={1.8}
                    dot={false}
                    isAnimationActive={false}
                    name="20-Day Volume SMA"
                  />
                  <Tooltip
                    position={{ x: 65, y: 8 }}
                    isAnimationActive={false}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-950/95 border border-slate-700 rounded-xl p-2.5 shadow-xl text-xs font-mono">
                          <div className="text-slate-400 font-semibold border-b border-slate-800 pb-1 mb-1.5 flex justify-between gap-3">
                            <span>{d.date}</span>
                            <span className={d.isUpDay ? "text-emerald-400" : "text-rose-400"}>
                              {d.isUpDay ? "Accumulation (Up Close)" : "Distribution (Down Close)"}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-300 font-medium">Daily Volume:</span>
                              <span className="text-white font-bold">{d.volume?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-amber-400 font-medium">20d Volume Avg:</span>
                              <span className="text-slate-200">{d.volumeSma20?.toLocaleString()}</span>
                            </div>
                            {d.volume && d.volumeSma20 && (
                              <div className="flex justify-between gap-4 pt-1 border-t border-slate-800/80">
                                <span className="text-slate-400">Relative Vol (RVOL):</span>
                                <span className="text-indigo-300 font-bold">
                                  {(d.volume / d.volumeSma20).toFixed(2)}x
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Optional Raw Data Table */}
      {showDataTable && chartData && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-display">
              Historical Bars & Indicators ({chartData.bars.length} Records)
            </h3>
            <button
              onClick={handleExportCSV}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg text-xs font-mono flex items-center gap-1.5 border border-slate-700"
            >
              <Download className="w-3 h-3" />
              <span>Export CSV</span>
            </button>
          </div>

          <TableTopScrollbar tableContainerClassName="overflow-x-auto max-h-96" label="Scroll Historical Data Horizontally">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700/80 sticky top-0 backdrop-blur-xs">
                <tr>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Open</th>
                  <th className="px-3 py-2.5">High</th>
                  <th className="px-3 py-2.5">Low</th>
                  <th className="px-3 py-2.5">Close</th>
                  <th className="px-3 py-2.5">Volume</th>
                  <th className="px-3 py-2.5 text-amber-400">20 SMA</th>
                  <th className="px-3 py-2.5 text-sky-400">BB Upper</th>
                  <th className="px-3 py-2.5 text-sky-400">BB Lower</th>
                  <th className="px-3 py-2.5 text-purple-400">RSI (14)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {chartData.bars
                  .slice()
                  .reverse()
                  .map((b, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/50">
                      <td className="px-4 py-2 text-white font-semibold">{b.date}</td>
                      <td className="px-3 py-2">${b.open.toFixed(2)}</td>
                      <td className="px-3 py-2 text-emerald-400">${b.high.toFixed(2)}</td>
                      <td className="px-3 py-2 text-rose-400">${b.low.toFixed(2)}</td>
                      <td className="px-3 py-2 font-bold text-white">${b.close.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-400">{b.volume.toLocaleString()}</td>
                      <td className="px-3 py-2 text-amber-400">{b.sma20 ? `$${b.sma20.toFixed(2)}` : "—"}</td>
                      <td className="px-3 py-2 text-sky-400">
                        {b.bollingerUpper ? `$${b.bollingerUpper.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-sky-400">
                        {b.bollingerLower ? `$${b.bollingerLower.toFixed(2)}` : "—"}
                      </td>
                      <td
                        className={`px-3 py-2 font-bold ${
                          b.rsi14 && b.rsi14 >= 70
                            ? "text-rose-400"
                            : b.rsi14 && b.rsi14 <= 30
                            ? "text-emerald-400"
                            : "text-purple-300"
                        }`}
                      >
                        {b.rsi14 !== null ? b.rsi14.toFixed(1) : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </TableTopScrollbar>
        </div>
      )}
    </div>
  );
};
