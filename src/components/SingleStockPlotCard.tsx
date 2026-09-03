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
  Legend,
  ReferenceLine,
  ReferenceArea
} from "recharts";
import { TrendingUp, Target, Calendar, DollarSign, MousePointerClick, Percent, Award } from "lucide-react";
import { PutOptionRecord } from "../types";
import { BollingerRsiTooltipBadge } from "./BollingerRsiTooltipBadge";
import { ChartPointInspector } from "./ChartPointInspector";
import { STOCK_COLORS } from "./MultiPlotViewMenu";
import { VerticalPutOptimizerPanel } from "./VerticalPutOptimizerPanel";
import { VerticalPutSpread } from "../utils/verticalPutOptimizer";

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
  const [yAxisMetric, setYAxisMetric] = useState<"both" | "cash_return" | "premium">(
    showSecondaryReturnLine ? "both" : "premium"
  );
  const [selectedPoint, setSelectedPoint] = useState<any | null>(null);
  const [selectedSpread, setSelectedSpread] = useState<VerticalPutSpread | null>(null);

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
  const cashReturnGradientId = `grad_cash_${ticker}_${colorIndex}`;

  const cashReturns = chartData.map((d) => d.returnCashSecured).filter((v) => !isNaN(v) && v > 0);
  const topCashYield = cashReturns.length > 0 ? Math.max(...cashReturns) : 0;
  const avgCashYield = cashReturns.length > 0 ? cashReturns.reduce((a, b) => a + b, 0) / cashReturns.length : 0;

  // Decide if right Y-axis for cash secured return is active
  const isCashReturnRightAxis = yAxisMetric === "both";
  const isCashReturnPrimaryAxis = yAxisMetric === "cash_return";
  const isPremiumPrimaryAxis = yAxisMetric === "both" || yAxisMetric === "premium";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3.5">
      {/* Header with Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: themeColor }} />
            <h4 className="text-base font-bold text-white font-display">
              {ticker} • ${spotPrice.toFixed(2)}
            </h4>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-cyan-400 font-mono border border-slate-700">
              {isXAxisExpiration ? "Expiration Term Plot" : "Strike Curve Plot"}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {isCashReturnPrimaryAxis
              ? `Plotting Annualized % Return (Cash Secured) on Y-Axis for ${ticker}`
              : isXAxisExpiration
              ? `Plotting Option Premium ($) & Cash Return (%/yr) across Expirations ${
                  isSingleStrikeActive ? `for $${chartData[0]?.strike || ""} strike` : ""
                }`
              : `Plotting Option Premium ($) & Cash Return (%/yr) across Strikes for ${ticker}`}
          </p>
        </div>

        {/* Right Header Controls: Y-Axis Selector & Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* X-Axis Mode Switcher */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[10px]">
            <span className="text-slate-500 font-medium px-1.5">X-Axis:</span>
            <button
              onClick={() => setXAxisOverride(isXAxisExpiration ? "strike" : "expiration")}
              className="px-2 py-0.5 rounded font-medium transition cursor-pointer bg-slate-800 text-slate-200 hover:text-white"
              title="Toggle between Strike Curve and Expiration Term"
            >
              {isXAxisExpiration ? "Strike Curve ($)" : "Exp Term"}
            </button>
          </div>

          {/* Y-Axis Metric Switcher */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[10px]">
            <span className="text-slate-500 font-medium px-1.5">Y-Axis:</span>
            <button
              onClick={() => setYAxisMetric("both")}
              className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                yAxisMetric === "both"
                  ? "bg-emerald-600 text-white font-bold shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Dual Y-Axis: Left = Option Premium ($), Right = Annualized % Return (Cash Secured)"
            >
              Dual (Prem + % Ret)
            </button>
            <button
              onClick={() => setYAxisMetric("cash_return")}
              className={`px-2 py-0.5 rounded font-medium transition cursor-pointer flex items-center gap-1 ${
                yAxisMetric === "cash_return"
                  ? "bg-emerald-600 text-white font-bold shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Dedicated Y-Axis: Annualized % Return (Cash Secured)"
            >
              <Percent className="w-2.5 h-2.5" />
              Cash Ret (%)
            </button>
            <button
              onClick={() => setYAxisMetric("premium")}
              className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                yAxisMetric === "premium"
                  ? "bg-cyan-600 text-white font-bold shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Single Y-Axis: Option Premium ($)"
            >
              Premium ($)
            </button>
          </div>

          {/* Strike Filter */}
          {allowFilters && uniqueStrikes.length > 1 && !isSingleStrikeGlobal && (
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
          {allowFilters && !isXAxisExpiration && uniqueExpirations.length > 1 && (
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
      </div>

      {/* Chart Canvas */}
      <div className="h-64 sm:h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{
              top: 10,
              right: isCashReturnRightAxis ? 55 : 20,
              bottom: 20,
              left: 10,
            }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={themeColor} stopOpacity={0.35} />
                <stop offset="95%" stopColor={themeColor} stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id={cashReturnGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
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

            {/* Left Y-Axis: Option Premium ($) or Annualized % Return (Cash Secured) if primary */}
            {isCashReturnPrimaryAxis ? (
              <YAxis
                yAxisId="left"
                stroke="#10b981"
                fontSize={10}
                unit="%"
                domain={[0, "auto"]}
                tickFormatter={(v) => `${v}%`}
                label={{
                  value: "Annualized % Return (Cash Secured)",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#10b981",
                  fontSize: 10,
                }}
              />
            ) : (
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
            )}

            {/* Right Y-Axis: Annualized % Return (Cash Secured) when in Dual mode */}
            {isCashReturnRightAxis && (
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#10b981"
                fontSize={10}
                unit="%"
                domain={[0, "auto"]}
                tickFormatter={(v) => `${v}%`}
                label={{
                  value: "Annualized % Return (Cash Secured)",
                  angle: 90,
                  position: "insideRight",
                  fill: "#10b981",
                  fontSize: 10,
                }}
              />
            )}

            {/* Hover Tooltip */}
            <RechartsTooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const pt = payload[0]?.payload;
                if (!pt) return null;
                return (
                  <div className="bg-slate-900/95 border border-slate-700 rounded-xl p-3 shadow-2xl text-xs space-y-1.5 min-w-[210px]">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 font-semibold text-white">
                      <span>{ticker} • ${pt.strike} Strike</span>
                      <span className="text-cyan-400 font-mono text-[11px]">{pt.expiration} ({pt.dte}d)</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Bid / Ask:</span>
                      <span className="font-mono text-slate-200 font-medium">${pt.premium?.toFixed(2)} / ${pt.ask?.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded">
                      <span className="text-emerald-300 font-semibold">Ann. Return (Cash Secured):</span>
                      <span className="font-mono text-emerald-400 font-bold">{pt.returnCashSecured?.toFixed(1)}% /yr</span>
                    </div>
                    {pt.moneyness !== undefined && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Downside Cushion:</span>
                        <span className="font-mono text-slate-300">{pt.moneyness?.toFixed(1)}% OTM</span>
                      </div>
                    )}
                    <div className="text-[10px] text-slate-500 pt-0.5 text-center">
                      Click dot to pin detailed indicators
                    </div>
                  </div>
                );
              }}
            />

            <Legend wrapperStyle={{ paddingTop: "8px", fontSize: "0.7rem" }} />

            {/* Vertical Put Strategy Highlighting (When in Strike mode) */}
            {!isXAxisExpiration && selectedSpread && (
              <>
                <ReferenceArea
                  x1={selectedSpread.buyStrike}
                  x2={selectedSpread.sellStrike}
                  yAxisId="left"
                  fill="#10b981"
                  fillOpacity={0.12}
                  stroke="#10b981"
                  strokeOpacity={0.4}
                  strokeDasharray="3 3"
                />
                <ReferenceLine
                  x={selectedSpread.sellStrike}
                  yAxisId="left"
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{
                    value: `SELL $${selectedSpread.sellStrike}`,
                    fill: "#34d399",
                    fontSize: 10,
                    position: "top",
                  }}
                />
                <ReferenceLine
                  x={selectedSpread.buyStrike}
                  yAxisId="left"
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{
                    value: `BUY $${selectedSpread.buyStrike}`,
                    fill: "#fbbf24",
                    fontSize: 10,
                    position: "top",
                  }}
                />
              </>
            )}

            {/* When Cash Return is Primary Axis: Plot Area for Cash Return */}
            {isCashReturnPrimaryAxis && (
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="returnCashSecured"
                name="Annualized % Return (Cash Secured)"
                stroke="#10b981"
                strokeWidth={2.5}
                fill={`url(#${cashReturnGradientId})`}
                dot={((props: any): any => {
                  const { cx, cy, payload, key: rechartsKey, index } = props;
                  const fallbackKey = rechartsKey || `dot-cash-ret-${payload?.strike ?? index}-${payload?.expiration ?? ""}`;
                  if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) {
                    return <g key={`empty-${fallbackKey}`} />;
                  }
                  const isSelected = selectedPoint && (
                    selectedPoint.strike === payload.strike && selectedPoint.expiration === payload.expiration
                  );
                  return (
                    <g
                      key={fallbackKey}
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
                        r={isSelected ? 6 : 4}
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

            {/* When Premium is on Left: Option Premium Area */}
            {isPremiumPrimaryAxis && (
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="premium"
                name={`${ticker} Bid ($)`}
                stroke={themeColor}
                strokeWidth={2.5}
                fill={`url(#${gradientId})`}
                dot={((props: any): any => {
                  const { cx, cy, payload, key: rechartsKey, index } = props;
                  const fallbackKey = rechartsKey || `dot-prem-${payload?.strike ?? index}-${payload?.expiration ?? ""}`;
                  if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) {
                    return <g key={`empty-${fallbackKey}`} />;
                  }
                  const isSelected = selectedPoint && (
                    selectedPoint.strike === payload.strike && selectedPoint.expiration === payload.expiration
                  );
                  const isSellStrike = !isXAxisExpiration && selectedSpread && selectedSpread.sellStrike === payload.strike;
                  const isBuyStrike = !isXAxisExpiration && selectedSpread && selectedSpread.buyStrike === payload.strike;

                  return (
                    <g
                      key={fallbackKey}
                      className="cursor-pointer group"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPoint(payload);
                      }}
                    >
                      <circle cx={cx} cy={cy} r={14} fill="transparent" />
                      {isSellStrike && (
                        <circle cx={cx} cy={cy} r={10} fill="none" stroke="#10b981" strokeWidth={2.5} className="animate-pulse" />
                      )}
                      {isBuyStrike && (
                        <circle cx={cx} cy={cy} r={10} fill="none" stroke="#f59e0b" strokeWidth={2.5} className="animate-pulse" />
                      )}
                      {isSelected && !isSellStrike && !isBuyStrike && (
                        <circle cx={cx} cy={cy} r={9} fill="none" stroke="#38bdf8" strokeWidth={2.5} className="animate-pulse" />
                      )}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isSelected || isSellStrike || isBuyStrike ? 6 : 4}
                        fill={isSellStrike ? "#10b981" : isBuyStrike ? "#f59e0b" : isSelected ? "#ffffff" : themeColor}
                        stroke={isSellStrike ? "#ffffff" : isBuyStrike ? "#ffffff" : isSelected ? themeColor : "#0f172a"}
                        strokeWidth={isSelected || isSellStrike || isBuyStrike ? 2.5 : 1.5}
                        className="transition-all duration-150 group-hover:scale-150 group-hover:stroke-white group-hover:stroke-[2px]"
                      />
                    </g>
                  );
                }) as any}
                activeDot={false}
              />
            )}

            {/* Ask Line (shown when premium is on left) */}
            {isPremiumPrimaryAxis && (
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
            )}

            {/* Annualized % Return (Cash Secured) Line on Right Y-Axis in Dual Mode */}
            {isCashReturnRightAxis && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="returnCashSecured"
                name="Annualized % Return (Cash Secured)"
                stroke="#10b981"
                strokeWidth={2}
                dot={((props: any): any => {
                  const { cx, cy, payload, key: rechartsKey, index } = props;
                  const fallbackKey = rechartsKey || `dot-yield-${payload?.strike ?? index}-${payload?.expiration ?? ""}`;
                  if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) {
                    return <g key={`empty-${fallbackKey}`} />;
                  }
                  const isSelected = selectedPoint && (
                    selectedPoint.strike === payload.strike && selectedPoint.expiration === payload.expiration
                  );
                  return (
                    <g
                      key={fallbackKey}
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

      {/* Vertical Put Strategy Optimizer (Active when plotting Strike Curve) */}
      {!isXAxisExpiration && (
        <VerticalPutOptimizerPanel
          ticker={ticker}
          expiration={expFilter !== "ALL" ? expFilter : (uniqueExpirations[0] || "")}
          spotPrice={spotPrice}
          dte={
            stockRecords.find(
              (r) => r.expiration === (expFilter !== "ALL" ? expFilter : uniqueExpirations[0])
            )?.days_to_expiration || 30
          }
          data={stockRecords
            .filter((r) => r.expiration === (expFilter !== "ALL" ? expFilter : uniqueExpirations[0]))
            .map((r) => ({
              strike: r.strike,
              bid: r.bid,
              ask: r.ask,
              premium: r.bid,
              days_to_expiration: r.days_to_expiration,
              current_price: spotPrice,
            }))}
          selectedSpread={selectedSpread}
          onSelectSpread={setSelectedSpread}
          availableExpirations={uniqueExpirations}
          selectedExpiration={expFilter !== "ALL" ? expFilter : uniqueExpirations[0]}
          onSelectExpiration={(newExp) => setExpFilter(newExp)}
        />
      )}

      {/* Mini Stats Footer */}
      {chartData.length > 0 && (
        <div className="pt-2 border-t border-slate-800 grid grid-cols-4 gap-2 text-[11px] font-mono">
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
            <span className="text-[10px] text-emerald-400 block font-semibold">Top Cash Yield (Ann.)</span>
            <span className="font-bold text-emerald-300">
              {topCashYield.toFixed(1)}% /yr
            </span>
          </div>

          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block">Avg Cash Yield (Ann.)</span>
            <span className="font-bold text-white">
              {avgCashYield.toFixed(1)}% /yr
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
