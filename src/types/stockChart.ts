export interface HistoricalBar {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma20: number | null;
  bollingerUpper: number | null;
  bollingerLower: number | null;
  bollingerBandwidth: number | null;
  bollingerPercentB: number | null;
  rsi14: number | null;
  rsiOverbought?: boolean;
  rsiOversold?: boolean;
  bollingerUpperBreach?: boolean;
  bollingerLowerBreach?: boolean;
}

export interface ChartTechnicalSummary {
  ticker: string;
  companyName: string;
  currentPrice: number;
  previousClose: number;
  periodStartPrice: number;
  periodEndPrice: number;
  periodChange: number;
  periodChangePct: number;
  periodHigh: number;
  periodLow: number;
  sma20: number | null;
  priceVsSma20Pct: number | null;
  bollingerUpper: number | null;
  bollingerLower: number | null;
  bollingerBandwidth: number | null;
  bollingerPercentB: number | null;
  rsi14: number | null;
  rsiSignal:
    | "Overbought (RSI > 70)"
    | "Oversold (RSI < 30)"
    | "Bullish Momentum (55-70)"
    | "Neutral (45-55)"
    | "Bearish Momentum (30-45)"
    | "Insufficient Data";
  bollingerSignal:
    | "Above Upper Band (+2σ)"
    | "Below Lower Band (-2σ)"
    | "Within Normal Bands"
    | "Band Squeeze (Low Volatility)";
  technicalInsight: string;
  firstDate: string;
  lastDate: string;
  dataPointsCount: number;
  currency: string;
}

export interface MultiTickerComparisonItem {
  ticker: string;
  currentPrice: number;
  periodChangePct: number;
  data: Array<{
    date: string;
    timestamp: number;
    close: number;
    pctReturn: number;
  }>;
}

export interface HistoricalChartResponse {
  primaryTicker: string;
  range: string;
  interval: string;
  bars: HistoricalBar[];
  summary: ChartTechnicalSummary;
  comparisons?: MultiTickerComparisonItem[];
  availableRanges: string[];
}
