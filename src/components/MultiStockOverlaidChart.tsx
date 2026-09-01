import React from "react";
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
          <ComposedChart data={overlaidData} margin={{ top: 15, right: 30, bottom: 25, left: 10 }}>
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

            <RechartsTooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  const stocksObj = d.stocks || {};
                  const stockKeys = Object.keys(stocksObj);

                  return (
                    <div className="bg-slate-900/98 backdrop-blur-md border border-slate-700 p-3.5 rounded-xl shadow-2xl text-xs text-slate-200 min-w-[280px] max-w-[360px] max-h-[420px] overflow-y-auto custom-scrollbar">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                        <span className="font-bold text-white text-sm flex items-center gap-1.5">
                          <span>📅 Expiration:</span>
                          <span className="text-cyan-400 font-mono">{label}</span>
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          {d.dte} Days to Exp
                        </span>
                      </div>

                      <div className="space-y-3">
                        {stockKeys.map((t, idx) => {
                          const s = stocksObj[t];
                          const tickerColor =
                            STOCK_COLORS[
                              uniqueTickers.indexOf(t) >= 0
                                ? uniqueTickers.indexOf(t) % STOCK_COLORS.length
                                : idx % STOCK_COLORS.length
                            ];

                          return (
                            <div key={t} className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 font-bold text-xs" style={{ color: tickerColor }}>
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tickerColor }} />
                                  <span>{t} ${s.strike} Put</span>
                                </div>
                                <span className="text-white font-mono font-bold text-xs">
                                  ${s.premium.toFixed(2)}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-x-2 text-[11px] font-mono text-slate-400">
                                <div>Spot: <span className="text-slate-200">${s.spot.toFixed(2)}</span></div>
                                <div>Moneyness: <span className="text-slate-200">{s.moneyness.toFixed(1)}%</span></div>
                                <div>Cash Yield: <span className="text-emerald-400 font-bold">{s.returnCashSecured.toFixed(1)}%</span></div>
                                {s.iv && <div>IV: <span className="text-amber-400">{s.iv.toFixed(1)}%</span></div>}
                              </div>

                              {/* Bollinger Bands & RSI Technicals */}
                              <BollingerRsiTooltipBadge
                                compact
                                rsi={s.rsi_14}
                                bollinger={s.bollinger}
                                strikePosition={s.strike_bollinger_position}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "0.75rem" }} />

            {/* Render a line for each active ticker */}
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
                  dot={{ r: 3.5, fill: color }}
                  activeDot={{ r: 6, stroke: "#ffffff", strokeWidth: 2 }}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

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
