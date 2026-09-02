import React, { useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend
} from "recharts";
import { TrendingUp, Target, Calendar, DollarSign, MousePointerClick } from "lucide-react";
import { PutOptionRecord } from "../types";
import { BollingerRsiTooltipBadge } from "./BollingerRsiTooltipBadge";
import { ChartPointInspector } from "./ChartPointInspector";
import { STOCK_COLORS } from "./MultiPlotViewMenu";

interface SingleStockPlotCardProps {
  ticker: string;
  records: PutOptionRecord[];
  isSingleStrikeGlobal: boolean;
  showSecondaryReturnLine?: boolean;
  allowFilters?: boolean;
  colorIndex?: number;
}

export const SingleStockPlotCard: React.FC<SingleStockPlotCardProps> = ({
  ticker,
  records,
  isSingleStrikeGlobal,
  showSecondaryReturnLine = true,
  allowFilters = true,
  colorIndex = 0,
}) => {
  const [strikeFilter, setStrikeFilter] = useState<string>("ALL");
  const [expFilter, setExpFilter] = useState<string>("ALL");
  const [xAxisOverride, setXAxisOverride] = useState<"auto" | "expiration" | "strike">("auto");
  const [selectedPoint, setSelectedPoint] = useState<any | null>(null);

  const stockRecords = records.filter((r) => r.ticker === ticker);
  const spotPrice = stockRecords[0]?.current_price || 0;
  const uniqueStrikes = Array.from(new Set(stockRecords.map((r) => r.strike))).sort((a, b) => a - b);
  const uniqueExpirations = Array.from(new Set(stockRecords.map((r) => r.expiration))).sort();

  // Determine if a single strike is actively selected
  const isSingleStrikeActive =
    isSingleStrikeGlobal ||
    strikeFilter !== "ALL" ||
    uniqueStrikes.length === 1;

  // Filter records based on active filters
  let filtered = stockRecords;
  if (strikeFilter !== "ALL") {
    filtered = filtered.filter((r) => r.strike === Number(strikeFilter));
  }
  if (expFilter !== "ALL" && !isSingleStrikeActive) {
    filtered = filtered.filter((r) => r.expiration === expFilter);
  }

  // Determine actual X-Axis mode
  const isXAxisExpiration =
    xAxisOverride === "expiration" ||
    (xAxisOverride === "auto" && isSingleStrikeActive);

  // Prepare Dataset based on X-Axis mode
  let chartData: any[] = [];
  if (isXAxisExpiration) {
    // Chronologically sorted by DTE / expiration date
    chartData = [...filtered]
      .sort((a, b) => a.days_to_expiration - b.days_to_expiration)
      .map((r) => ({
        ticker: r.ticker,
        expiration: r.expiration,
        label: `${r.expiration} (${r.days_to_expiration}d)`,
        dte: r.days_to_expiration,
        strike: r.strike,
        premium: r.bid,
        ask: r.ask,
        lastPrice: r.last_price,
        spot: r.current_price,
        moneyness: r.moneyness_pct,
        returnPct: r.annualized_return_pct,
        returnCashSecured: r.annualized_return_pct_cash_secured,
        capitalBasis: r.capital_basis,
        iv: r.implied_volatility,
        rsi_14: r.rsi_14,
        bollinger: r.bollinger,
        fibonacci: r.fibonacci,
        fifty_two_week_high: r.fifty_two_week_high,
        fifty_two_week_low: r.fifty_two_week_low,
        strike_bollinger_position: r.strike_bollinger_position,
      }));
  } else {
    // Sorted by Strike Price ($)
    chartData = [...filtered]
      .sort((a, b) => a.strike - b.strike)
      .map((r) => ({
        ticker: r.ticker,
        strike: r.strike,
        expiration: r.expiration,
        label: `$${r.strike}`,
        dte: r.days_to_expiration,
        premium: r.bid,
        ask: r.ask,
        lastPrice: r.last_price,
        spot: r.current_price,
        moneyness: r.moneyness_pct,
        returnPct: r.annualized_return_pct,
        returnCashSecured: r.annualized_return_pct_cash_secured,
        capitalBasis: r.capital_basis,
        iv: r.implied_volatility,
        rsi_14: r.rsi_14,
        bollinger: r.bollinger,
        fibonacci: r.fibonacci,
        fifty_two_week_high: r.fifty_two_week_high,
        fifty_two_week_low: r.fifty_two_week_low,
        strike_bollinger_position: r.strike_bollinger_position,
      }));
  }

  const themeColor = STOCK_COLORS[colorIndex % STOCK_COLORS.length];
  const gradientId = `grad_${ticker}_${colorIndex}`;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3.5">
      {/* Header with Title & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: themeColor }} />
            <h4 className="text-base font-bold text-white font-display">
              {ticker} • ${spotPrice.toFixed(2)}
            </h4>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-cyan-400 font-mono border border-slate-700">
              {isXAxisExpiration ? "Expiration Term Plot" : "Strike Curve Plot"}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {isXAxisExpiration
              ? `Plotting Option Premium ($) across Expiration Dates ${
                  isSingleStrikeActive ? `for $${chartData[0]?.strike || ""} strike` : ""
                }`
              : `Plotting Option Premium ($) across Strike Prices ($) for ${ticker}`}
          </p>
        </div>

        {/* Filters if allowed */}
        {allowFilters && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Strike Filter */}
            {uniqueStrikes.length > 1 && !isSingleStrikeGlobal && (
              <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1">
                <span className="text-slate-400 text-[11px]">Strike:</span>
                <select
                  value={strikeFilter}
                  onChange={(e) => setStrikeFilter(e.target.value)}
                  className="bg-transparent text-white font-semibold outline-none cursor-pointer text-xs"
                >
                  <option value="ALL" className="bg-slate-900 text-white">
                    All Strikes ({uniqueStrikes.length})
                  </option>
                  {uniqueStrikes.map((s) => (
                    <option key={s} value={s} className="bg-slate-900 text-white">
                      ${s.toFixed(2)} Strike
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Expiration Filter (if viewing strike curve) */}
            {!isXAxisExpiration && uniqueExpirations.length > 1 && (
              <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1">
                <span className="text-slate-400 text-[11px]">Exp:</span>
                <select
                  value={expFilter}
                  onChange={(e) => setExpFilter(e.target.value)}
                  className="bg-transparent text-white font-semibold outline-none cursor-pointer text-xs"
                >
                  <option value="ALL" className="bg-slate-900 text-white">
                    All Expirations
                  </option>
                  {uniqueExpirations.map((exp) => (
                    <option key={exp} value={exp} className="bg-slate-900 text-white">
                      {exp}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chart Canvas */}
      <div className="h-64 sm:h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 25, bottom: 20, left: 5 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={themeColor} stopOpacity={0.35} />
                <stop offset="95%" stopColor={themeColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />

            {/* Dynamic X-Axis: Expiration Date vs Strike Price */}
            {isXAxisExpiration ? (
              <XAxis
                dataKey="expiration"
                stroke="#64748b"
                fontSize={10}
                tickFormatter={(v) => v}
                label={{
                  value: "Expiration Date",
                  position: "insideBottom",
                  offset: -12,
                  fill: "#94a3b8",
                  fontSize: 10,
                }}
              />
            ) : (
              <XAxis
                dataKey="strike"
                stroke="#64748b"
                fontSize={10}
                tickFormatter={(v) => `$${v}`}
                label={{
                  value: "Strike Price ($)",
                  position: "insideBottom",
                  offset: -12,
                  fill: "#94a3b8",
                  fontSize: 10,
                }}
              />
            )}

            {/* Left Y-Axis: Option Premium ($) */}
            <YAxis
              yAxisId="left"
              stroke={themeColor}
              fontSize={10}
              unit="$"
              domain={[0, "auto"]}
              label={{
                value: "Option Premium ($)",
                angle: -90,
                position: "insideLeft",
                fill: themeColor,
                fontSize: 10,
              }}
            />

            {/* Right Y-Axis: Cash-Secured Annualized Return (%) */}
            {showSecondaryReturnLine && (
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#10b981"
                fontSize={10}
                unit="%"
                domain={[0, "auto"]}
                label={{
                  value: "Cash Yield (%)",
                  angle: 90,
                  position: "insideRight",
                  fill: "#10b981",
                  fontSize: 10,
                }}
              />
            )}

            <Legend wrapperStyle={{ paddingTop: "8px", fontSize: "0.7rem" }} />

            {/* Option Premium Area / Line */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="premium"
              name={`${ticker} Bid ($)`}
              stroke={themeColor}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={((props: any): any => {
                const { cx, cy, payload } = props;
                if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) return <g key="empty" />;
                const isSelected = selectedPoint && (
                  selectedPoint.strike === payload.strike && selectedPoint.expiration === payload.expiration
                );
                return (
                  <g
                    key={`dot-prem-${payload.strike}-${payload.expiration}`}
                    className="cursor-pointer group"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPoint(payload);
                    }}
                  >
                    <circle cx={cx} cy={cy} r={14} fill="transparent" />
                    {isSelected && (
                      <circle cx={cx} cy={cy} r={9} fill="none" stroke="#38bdf8" strokeWidth={2.5} className="animate-pulse" />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? 6 : 4}
                      fill={isSelected ? "#ffffff" : themeColor}
                      stroke={isSelected ? themeColor : "#0f172a"}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      className="transition-all duration-150 group-hover:scale-150 group-hover:stroke-white group-hover:stroke-[2px]"
                    />
                  </g>
                );
              }) as any}
              activeDot={false}
            />

            <Line
              yAxisId="left"
              type="monotone"
              dataKey="ask"
              name="Ask ($)"
              stroke="#64748b"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              activeDot={false}
            />

            {/* Cash-Secured Annualized Return % Line */}
            {showSecondaryReturnLine && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="returnCashSecured"
                name="Cash Yield (%)"
                stroke="#10b981"
                strokeWidth={1.8}
                dot={((props: any): any => {
                  const { cx, cy, payload } = props;
                  if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) return <g key="empty" />;
                  const isSelected = selectedPoint && (
                    selectedPoint.strike === payload.strike && selectedPoint.expiration === payload.expiration
                  );
                  return (
                    <g
                      key={`dot-yield-${payload.strike}-${payload.expiration}`}
                      className="cursor-pointer group"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPoint(payload);
                      }}
                    >
                      <circle cx={cx} cy={cy} r={14} fill="transparent" />
                      {isSelected && (
                        <circle cx={cx} cy={cy} r={9} fill="none" stroke="#34d399" strokeWidth={2.5} className="animate-pulse" />
                      )}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isSelected ? 6 : 3.5}
                        fill={isSelected ? "#ffffff" : "#10b981"}
                        stroke={isSelected ? "#10b981" : "#0f172a"}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        className="transition-all duration-150 group-hover:scale-150 group-hover:stroke-white group-hover:stroke-[2px]"
                      />
                    </g>
                  );
                }) as any}
                activeDot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Interactive Pinned Point Details Card */}
      {selectedPoint && (
        <ChartPointInspector
          point={selectedPoint}
          onClose={() => setSelectedPoint(null)}
          themeColor={themeColor}
        />
      )}

      {/* Mini Stats Footer */}
      {chartData.length > 0 && (
        <div className="pt-2 border-t border-slate-800 grid grid-cols-3 gap-2 text-[11px] font-mono">
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
            <span className="text-[10px] text-slate-500 block">Strike / Range</span>
            <span className="font-bold text-slate-200">
              {isSingleStrikeActive
                ? `$${chartData[0]?.strike.toFixed(2)}`
                : `$${Math.min(...chartData.map((d) => d.strike)).toFixed(2)} - $${Math.max(
                    ...chartData.map((d) => d.strike)
                  ).toFixed(2)}`}
            </span>
          </div>

          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
            <span className="text-[10px] text-slate-500 block">Expirations</span>
            <span className="font-bold text-cyan-400">
              {uniqueExpirations.length} dates
            </span>
          </div>

          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
            <span className="text-[10px] text-slate-500 block">Top Cash Yield</span>
            <span className="font-bold text-emerald-400">
              {Math.max(...chartData.map((d) => d.returnCashSecured)).toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
