import React, { useState, useEffect } from "react";
import {
  Globe,
  RefreshCw,
  Download,
  Code,
  Check,
  Coins,
  Scale,
  DollarSign,
  TrendingUp,
  AlertCircle,
  FileText,
  Shield,
  Layers,
  Sparkles,
} from "lucide-react";
import { LiveAssetCards } from "./LiveAssetCards";
import { HistoricalMacroChart } from "./HistoricalMacroChart";
import { FedCalendarTable } from "./FedCalendarTable";
import { MacroResearchPanel } from "./MacroResearchPanel";
import { MacroIntelligenceResponse, MacroHistoricalPoint } from "../../types";

export const MacroDashboard: React.FC = () => {
  const [data, setData] = useState<MacroIntelligenceResponse | null>(null);
  const [historicalData, setHistoricalData] = useState<MacroHistoricalPoint[]>([]);
  const [duration, setDuration] = useState<string>("1y");
  const [loading, setLoading] = useState<boolean>(true);
  const [historicalLoading, setHistoricalLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Fetch live macro data
  const fetchMacroIntelligence = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/macro/intelligence");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: MacroIntelligenceResponse = await res.json();
      setData(json);
    } catch (err: any) {
      console.error("Error loading macro intelligence:", err);
      setError(err?.message || "Failed to load live macro market data");
    } finally {
      setLoading(false);
    }
  };

  // Fetch historical series for charts
  const fetchHistoricalSeries = async (dur: string) => {
    try {
      setHistoricalLoading(true);
      const res = await fetch(`/api/macro/historical?duration=${encodeURIComponent(dur)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.points) {
        setHistoricalData(json.points);
      }
    } catch (err) {
      console.error("Error loading historical macro series:", err);
    } finally {
      setHistoricalLoading(false);
    }
  };

  useEffect(() => {
    fetchMacroIntelligence();
    fetchHistoricalSeries(duration);
  }, []);

  const handleSelectDuration = (newDur: string) => {
    setDuration(newDur);
    fetchHistoricalSeries(newDur);
  };

  const handleCopyScript = () => {
    if (!data?.pythonScript) return;
    navigator.clipboard.writeText(data.pythonScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadScript = () => {
    window.open("/api/macro/script?download=true", "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Globe className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold text-white tracking-tight">Macro Markets & Commodities</h1>
              <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                Live USD & INR
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Real-time commodities (Gold, Silver, WTI Crude), Bitcoin spot with USD-to-INR conversion, US Treasury yield curve benchmarks, and FOMC policy horizon.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 self-stretch md:self-auto">
            <button
              onClick={() => setShowScriptModal(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700/60 rounded-xl px-3.5 py-2 text-xs font-semibold transition"
            >
              <Code className="w-3.5 h-3.5 text-cyan-400" />
              <span>View Python Script</span>
            </button>

            <button
              onClick={handleDownloadScript}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-xl px-3.5 py-2 text-xs font-semibold transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .py</span>
            </button>

            <button
              onClick={() => {
                fetchMacroIntelligence();
                fetchHistoricalSeries(duration);
              }}
              disabled={loading || historicalLoading}
              title="Refresh live data"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-400" : ""}`} />
            </button>
          </div>
        </div>

        {/* Status Bar */}
        {data && (
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
            <div className="flex items-center gap-3">
              <span>
                USD/INR Exchange Rate: <strong className="text-emerald-400 font-mono">₹{data.usdinrRate.toFixed(3)}</strong>
              </span>
              <span>•</span>
              <span>
                Gold per Gram (24K equiv):{" "}
                <strong className="text-amber-400 font-mono">
                  ₹{Math.round((4373.1 * data.usdinrRate) / 31.1034768).toLocaleString("en-IN")}
                </strong>
              </span>
            </div>
            <div className="text-slate-500 font-mono">
              Last updated: {new Date(data.timestamp).toLocaleTimeString()}
            </div>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center gap-3 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Live Asset Cards Grid */}
      {data && (
        <LiveAssetCards quotes={data.quotes} usdinrRate={data.usdinrRate} />
      )}

      {/* 2. Interactive Historical Trajectory Chart */}
      <HistoricalMacroChart
        data={historicalData}
        loading={historicalLoading}
        duration={duration}
        onSelectDuration={handleSelectDuration}
        onRefresh={() => fetchHistoricalSeries(duration)}
      />

      {/* 3. Deep Research & Analysis Panel */}
      {data && (
        <MacroResearchPanel insights={data.insights} />
      )}

      {/* 4. Federal Reserve Calendar & Governor Speeches */}
      {data && (
        <FedCalendarTable events={data.fedEvents} />
      )}

      {/* Python Script Modal */}
      {showScriptModal && data && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Standalone Macro Monitor Python Script</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyScript}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied!" : "Copy Code"}</span>
                </button>
                <button
                  onClick={handleDownloadScript}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .py</span>
                </button>
                <button
                  onClick={() => setShowScriptModal(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-slate-950">
              <pre className="text-[11px] font-mono text-slate-300 leading-relaxed whitespace-pre">
                {data.pythonScript}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
