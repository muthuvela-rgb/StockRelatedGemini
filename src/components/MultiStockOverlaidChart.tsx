import React, { useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Area
} from "recharts";
import { PutOptionRecord } from "../types";
import { BollingerRsiTooltipBadge } from "./BollingerRsiTooltipBadge";
import { ChartPointInspector } from "./ChartPointInspector";
import { STOCK_COLORS } from "./MultiPlotViewMenu";

interface MultiStockOverlaidChartProps {
  records: PutOptionRecord[];
  selectedTickers: string[];
  uniqueTickers: string[];
  isSingleStrike: boolean;
  showSecondaryReturnLine?: boolean;
}

export const MultiStockOverlaidChart: React.FC<MultiStockOverlaidChartProps> = ({
  records,
  selectedTickers,
  uniqueTickers,
  isSingleStrike,
  showSecondaryReturnLine = true,
}) => {
  const [selectedPoint, setSelectedPoint] = useState<any | null>(null);
  const activeTickers = selectedTickers.includes("ALL") ? uniqueTickers : selectedTickers;

  // Filter records for active tickers
  const activeRecords = records.filter((r) => activeTickers.includes(r.ticker));

  // If single strike is selected: X-Axis is Expiration Date!
  // Collect all unique expiration dates sorted chronologically by DTE
  const expMap: Record<string, { expiration: string; dte: number; label: string }> = {};
  activeRecords.forEach((r) => {
    if (!expMap[r.expiration]) {
      expMap[r.expiration] = {
        expiration: r.expiration,
        dte: r.days_to_expiration,
        label: `${r.expiration} (${r.days_to_expiration}d)`,
      };
    }
  });

  const sortedExpirations = Object.values(expMap).sort((a, b) => a.dte - b.dte);

  // Build chart dataset per expiration date
  const overlaidData = sortedExpirations.map((expObj) => {
    const row: any = {
      expiration: expObj.expiration,
      dte: expObj.dte,
      label: expObj.label,
      stocks: {},
    };

    activeTickers.forEach((t) => {
      // Find the contract for ticker t at this expiration
      const contract = activeRecords.find((r) => r.ticker === t && r.expiration === expObj.expiration);
      if (contract) {
        row[`${t}_premium`] = contract.bid;
        row[`${t}_ask`] = contract.ask;
        row[`${t}_return`] = contract.annualized_return_pct_cash_secured;
        row[`${t}_strike`] = contract.strike;
        row[`${t}_spot`] = contract.current_price;
        row[`${t}_moneyness`] = contract.moneyness_pct;
        row.stocks[t] = {
          ticker: t,
          strike: contract.strike,
          spot: contract.current_price,
          moneyness: contract.moneyness_pct,
          premium: contract.bid,
          ask: contract.ask,
          returnCashSecured: contract.annualized_return_pct_cash_secured,
          returnMargin: contract.annualized_return_pct,
          iv: contract.implied_volatility,
          rsi_14: contract.rsi_14,
          bollinger: contract.bollinger,
          fibonacci: contract.fibonacci,
          fifty_two_week_high: contract.fifty_two_week_high,
          fifty_two_week_low: contract.fifty_two_week_low,
          strike_bollinger_position: contract.strike_bollinger_position,
        };
      }
    });

    return row;
  });

  return (
    <div className="space-y-4">
      <div className="h-72 sm:h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={overlaidData}
            margin={{ top: 15, right: showSecondaryReturnLine ? 55 : 30, bottom: 25, left: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            
            {/* X-Axis: Expiration Date */}
            <XAxis
              dataKey="expiration"
              stroke="#64748b"
              fontSize={11}
              tickFormatter={(v) => v}
              label={{
                value: "Expiration Date (Chronological Term Structure)",
                position: "insideBottom",
                offset: -15,
                fill: "#94a3b8",
                fontSize: 11,
              }}
            />

            {/* Left Y-Axis: Option Premium ($) */}
            <YAxis
              yAxisId="left"
              stroke="#06b6d4"
              fontSize={11}
              unit="$"
              domain={[0, "auto"]}
              label={{
                value: "Option Premium ($)",
                angle: -90,
                position: "insideLeft",
                fill: "#06b6d4",
                fontSize: 11,
              }}
            />

            {/* Right Y-Axis: Cash-Secured Annualized Return (%) */}
            {showSecondaryReturnLine && (
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#10b981"
                fontSize={11}
                unit="%"
                domain={[0, "auto"]}
                tickFormatter={(v) => `${v}%`}
                label={{
                  value: "Annualized % Return (Cash Secured)",
                  angle: 90,
                  position: "insideRight",
                  fill: "#10b981",
                  fontSize: 11,
                }}
              />
            )}

            <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "0.75rem" }} />

            {/* Render a line for each active ticker with clickable dots */}
            {activeTickers.map((t, idx) => {
              const color =
                STOCK_COLORS[
                  uniqueTickers.indexOf(t) >= 0
                    ? uniqueTickers.indexOf(t) % STOCK_COLORS.length
                    : idx % STOCK_COLORS.length
                ];

              return (
                <Line
                  key={t}
                  yAxisId="left"
                  type="monotone"
                  dataKey={`${t}_premium`}
                  name={`${t} Premium ($)`}
                  stroke={color}
                  strokeWidth={2.5}
                  dot={((props: any): any => {
                    const { cx, cy, payload, key: rechartsKey, index } = props;
                    const fallbackKey = rechartsKey || `dot-${t}-${payload?.expiration ?? index}`;
                    if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) {
                      return <g key={`empty-${fallbackKey}`} />;
                    }
                    const st = payload?.stocks?.[t];
                    if (!st) return <g key={`empty-${fallbackKey}`} />;
                    const isSelected = selectedPoint && (
                      selectedPoint.ticker === t && selectedPoint.expiration === payload.expiration
                    );

                    return (
                      <g
                        key={fallbackKey}
                        className="cursor-pointer group"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPoint({
                            ...st,
                            expiration: payload.expiration,
                            dte: payload.dte,
                            themeColor: color,
                          });
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
                          fill={isSelected ? "#ffffff" : color}
                          stroke={isSelected ? color : "#0f172a"}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                          className="transition-all duration-150 group-hover:scale-150 group-hover:stroke-white group-hover:stroke-[2px]"
                        />
                      </g>
                    );
                  }) as any}
                  activeDot={false}
                />
              );
            })}

            {/* Cash-Secured Annualized Return (%) dashed lines on Right Y-Axis */}
            {showSecondaryReturnLine &&
              activeTickers.map((t, idx) => {
                const color =
                  STOCK_COLORS[
                    uniqueTickers.indexOf(t) >= 0
                      ? uniqueTickers.indexOf(t) % STOCK_COLORS.length
                      : idx % STOCK_COLORS.length
                  ];
                return (
                  <Line
                    key={`${t}_return_line`}
                    yAxisId="right"
                    type="monotone"
                    dataKey={`${t}_return`}
                    name={`${t} Ann. Return (Cash Secured %)`}
                    stroke={color}
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    dot={false}
                    activeDot={false}
                  />
                );
              })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Pinned Point Inspector */}
      {selectedPoint && (
        <ChartPointInspector
          point={selectedPoint}
          onClose={() => setSelectedPoint(null)}
          themeColor={selectedPoint.themeColor || "#06b6d4"}
        />
      )}

      {/* Analytical Callout Summary */}
      <div className="pt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <span className="text-[10px] text-slate-500 uppercase block">Overlaid Plots</span>
          <span className="font-bold text-white font-mono">
            {activeTickers.length} Stocks Overlaid
          </span>
          <span className="text-[10px] text-cyan-400 block truncate">
            {activeTickers.join(", ")}
          </span>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <span className="text-[10px] text-slate-500 uppercase block">Term Expirations</span>
          <span className="font-bold text-cyan-400 font-mono">
            {sortedExpirations.length} Expirations
          </span>
          <span className="text-[10px] text-slate-400 block">
            {sortedExpirations[0]?.expiration} to {sortedExpirations[sortedExpirations.length - 1]?.expiration}
          </span>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <span className="text-[10px] text-slate-500 uppercase block">X-Axis Mapping</span>
          <span className="font-bold text-emerald-400 font-mono">
            Expiration Date
          </span>
          <span className="text-[10px] text-slate-400 block">
            Chronological Term Structure
          </span>
        </div>

        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
          <span className="text-[10px] text-slate-500 uppercase block">Y-Axis Mapping</span>
          <span className="font-bold text-slate-200 font-mono">
            Option Premium ($)
          </span>
          <span className="text-[10px] text-slate-400 block">
            Bid Premium across DTE
          </span>
        </div>
      </div>
    </div>
  );
};
