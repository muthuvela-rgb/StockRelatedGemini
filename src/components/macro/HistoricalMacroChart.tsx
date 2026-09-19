import React, { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Brush,
} from "recharts";
import { MacroHistoricalPoint } from "../../types";
import { Activity, Layers, Maximize2, RefreshCw } from "lucide-react";

interface HistoricalMacroChartProps {
  data: MacroHistoricalPoint[];
  loading: boolean;
  duration: string;
  onSelectDuration: (dur: string) => void;
  onRefresh: () => void;
}

export const HistoricalMacroChart: React.FC<HistoricalMacroChartProps> = ({
  data,
  loading,
  duration,
  onSelectDuration,
  onRefresh,
}) => {
  const [chartMode, setChartMode] = useState<"normalized" | "gold" | "silver" | "oil" | "bitcoin" | "yields">("normalized");

  const durations = [
    { label: "1M", value: "1m" },
    { label: "3M", value: "3m" },
    { label: "6M", value: "6m" },
    { label: "1Y", value: "1y" },
    { label: "2Y", value: "2y" },
    { label: "3Y", value: "3y" },
    { label: "5Y", value: "5y" },
  ];

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            Macro Commodities & Asset Historical Trajectory
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {chartMode === "normalized"
              ? "Base-100 normalized comparison (Tracking cumulative relative percentage performance)"
              : `Raw price & yield trajectory for ${chartMode.toUpperCase()}`}
          </p>
        </div>

        {/* View Mode & Duration Pickers */}
        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
          {/* Chart Mode Selector */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setChartMode("normalized")}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                chartMode === "normalized"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Normalized (Base 100)
            </button>
            <button
              onClick={() => setChartMode("gold")}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                chartMode === "gold"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Gold
            </button>
            <button
              onClick={() => setChartMode("bitcoin")}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                chartMode === "bitcoin"
                  ? "bg-orange-500/20 text-orange-300 border border-orange-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              BTC
            </button>
            <button
              onClick={() => setChartMode("oil")}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                chartMode === "oil"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Oil
            </button>
            <button
              onClick={() => setChartMode("yields")}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                chartMode === "yields"
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Treasuries
            </button>
          </div>

          {/* Duration Selector */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            {durations.map((d) => (
              <button
                key={d.value}
                onClick={() => onSelectDuration(d.value)}
                className={`px-2 py-1 rounded-md font-mono transition ${
                  duration === d.value
                    ? "bg-blue-600 text-white font-bold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            title="Refresh chart series"
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-[360px] w-full pt-2">
        {loading && data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-xs gap-2 font-mono">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
            <span>Retrieving historical quotes from Yahoo Finance...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono">
            No historical points returned for {duration.toUpperCase()}.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                tick={{ fontSize: 11 }}
                tickFormatter={(val) => {
                  try {
                    const parts = val.split("-");
                    return `${parts[1]}/${parts[2]}`;
                  } catch {
                    return val;
                  }
                }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 11 }}
                domain={["auto", "auto"]}
                tickFormatter={(v) => {
                  if (chartMode === "normalized") return `${v.toFixed(0)}`;
                  if (chartMode === "yields") return `${v.toFixed(2)}%`;
                  if (chartMode === "bitcoin") return `$${(v / 1000).toFixed(0)}k`;
                  return `$${v}`;
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#334155",
                  borderRadius: "0.75rem",
                  fontSize: "12px",
                  color: "#f8fafc",
                }}
                formatter={(val: any, name: any) => {
                  const num = Number(val);
                  if (chartMode === "normalized") return [`${num.toFixed(1)} (Index)`, name];
                  if (name.includes("Yield")) return [`${num.toFixed(3)}%`, name];
                  if (name.includes("Bitcoin")) return [`$${num.toLocaleString()}`, name];
                  return [`$${num.toFixed(2)}`, name];
                }}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
              />

              {/* Dynamic Lines based on Chart Mode */}
              {chartMode === "normalized" && (
                <>
                  <Line type="monotone" dataKey="normGold" name="Gold (Norm)" stroke="#eab308" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="normSilver" name="Silver (Norm)" stroke="#94a3b8" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="normOil" name="Crude Oil (Norm)" stroke="#f97316" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="normBitcoin" name="Bitcoin (Norm)" stroke="#38bdf8" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="normUs10y" name="US 10Y Yield (Norm)" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                  <Line type="monotone" dataKey="normUsdInr" name="USD/INR Forex (Norm)" stroke="#10b981" strokeWidth={1.5} dot={false} />
                </>
              )}

              {chartMode === "gold" && (
                <>
                  <Line type="monotone" dataKey="gold" name="Gold ($/oz)" stroke="#eab308" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="silver" name="Silver ($/oz)" stroke="#94a3b8" strokeWidth={1.5} dot={false} />
                </>
              )}

              {chartMode === "bitcoin" && (
                <>
                  <Line type="monotone" dataKey="bitcoin" name="Bitcoin (USD)" stroke="#38bdf8" strokeWidth={2.5} dot={false} />
                </>
              )}

              {chartMode === "oil" && (
                <>
                  <Line type="monotone" dataKey="oil" name="WTI Crude Oil ($/bbl)" stroke="#f97316" strokeWidth={2.5} dot={false} />
                </>
              )}

              {chartMode === "yields" && (
                <>
                  <Line type="monotone" dataKey="us10y" name="US 10Y Treasury Yield (%)" stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="us30y" name="US 30Y Treasury Yield (%)" stroke="#a855f7" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="us3m" name="US 3M T-Bill Yield (%)" stroke="#10b981" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                </>
              )}

              {data.length > 5 && (
                <Brush
                  dataKey="date"
                  height={22}
                  stroke="#06b6d4"
                  fill="#090d16"
                  travellerWidth={8}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
