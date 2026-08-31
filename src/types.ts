export interface PutOptionRecord {
  ticker: string;
  expiration: string;
  days_to_expiration: number;
  strike: number;
  current_price: number;
  moneyness_pct: number;
  bid: number;
  ask: number;
  last_price: number;
  volume: number;
  open_interest: number;
  implied_volatility: number;
  capital_basis: number;
  capital_basis_cash_secured: number;
  annualized_return_pct: number;
  annualized_return_pct_cash_secured: number;
  bid_used_fallback: boolean;
  ask_used_fallback: boolean;
  market_cap?: number;
}

export interface TechnicalsData {
  ticker: string;
  current_price: number | null;
  market_cap: number | null;
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;
  all_time_high: number | null;
  distance_to_ath_pct: number | null;
  distance_to_52w_high_pct: number | null;
  analyst_target_mean: number | null;
  analyst_count: number | null;
  analyst_upside_pct: number | null;
  rsi_14: number | null;
  bollinger: {
    sma: number;
    upper_band: number;
    lower_band: number;
    percent_b: number;
    zone: string;
  } | null;
  implied_volatility_pct: number | null;
  historical_volatility_pct: number | null;
  historical_volatility_dollar_yr: number | null;
  fibonacci: {
    level_0: number;
    level_236: number;
    level_382: number;
    level_500: number;
    level_618: number;
    level_1000: number;
  } | null;
  next_earnings_date?: string | null;
}

export interface FallenStock {
  ticker: string;
  start_price: number;
  end_price: number;
  pct_change: number;
  start_date: string;
  end_date: string;
  shares_outstanding: number;
  market_cap_before: number;
  technicals?: TechnicalsData;
  context?: {
    headlines: Array<{
      title: string;
      publisher: string;
      link: string;
      published_at: string;
    }>;
    analyst?: {
      recommendation: string | null;
      mean_target_price: number | null;
      num_analysts: number | null;
      upside_pct: number | null;
      recent_actions: Array<{
        firm: string;
        action: string;
        from_grade: string;
        to_grade: string;
        price_target: number | null;
        date: string;
      }>;
    };
    social?: {
      bullish_pct: number;
      bearish_pct: number;
      sample_size: number;
    };
  };
}

export interface OptionGreeks {
  strike: number;
  contractSymbol: string;
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  inTheMoney: boolean;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  rho: number | null;
}

export interface OptionChainResponse {
  ticker: string;
  current_price: number;
  expirations: string[];
  selected_expiration: string;
  days_to_expiration: number;
  calls: OptionGreeks[];
  puts: OptionGreeks[];
}

export interface SecFilingSummary {
  ticker: string;
  form: string;
  date: string;
  url: string;
  title: string;
  summary: string;
  sentiment: "Bullish" | "Neutral" | "Bearish" | "Mixed";
  key_takeaways: string[];
  financial_highlights?: {
    revenue?: string;
    net_income_or_eps?: string;
    guidance?: string;
    margins_or_growth?: string;
  };
  material_events?: string[];
  risk_factors?: string[];
  options_implications?: string;
  generated_at: string;
}

export interface SecFiling {
  ticker: string;
  cik: number | string;
  filing_form: string;
  filing_date: string;
  filing_url: string;
  accession_number?: string;
  primary_doc?: string;
  description?: string;
  ai_summary?: SecFilingSummary | null;
  latest_eps_tag?: string;
  latest_eps_value?: number | null;
  latest_eps_period_end?: string;
  latest_revenue_value?: number | null;
  latest_revenue_period_end?: string;
}

export interface SecCompanyReport {
  ticker: string;
  cik: number | string;
  error?: string;
  eps?: {
    tag: string;
    unit: string;
    value: number;
    period_end: string;
    fiscal_period?: string;
    fiscal_year?: number;
    form?: string;
    filed?: string;
  } | null;
  revenue?: {
    tag: string;
    unit: string;
    value: number;
    period_end: string;
    fiscal_period?: string;
    fiscal_year?: number;
    form?: string;
    filed?: string;
  } | null;
  filings: Array<{
    form: string;
    date: string;
    url: string;
    accession_number?: string;
    primary_doc?: string;
    description?: string;
    ai_summary?: SecFilingSummary | null;
  }>;
}

export interface PremiumCurvePoint {
  expiration: string;
  strike: number;
  premium: number;
  bid: number;
  ask: number;
  lastPrice: number;
  volume: number;
  openInterest: number;
  used_fallback: boolean;
  premium_to_strike: number;
}

export interface PremiumCurveAnalysis {
  ticker: string;
  current_price: number | null;
  expirations: string[];
  records: PremiumCurvePoint[];
  highest_ratio_point: PremiumCurvePoint | null;
  steepest_slopes: Array<{
    expiration: string;
    strike_a: number;
    strike_b: number;
    premium_a: number;
    premium_b: number;
    slope: number;
  }>;
  widest_bins: Array<{
    expiration: string;
    bin_lo: number;
    bin_hi: number;
    strike_lo: number;
    strike_hi: number;
    premium_lo: number;
    premium_hi: number;
    diff: number;
  }>;
  gap_markers: Array<{
    type: "widest" | "narrowest";
    exp_a: string;
    exp_b: string;
    strike: number;
    gap: number;
    low_premium: number;
    high_premium: number;
    low_expiration: string;
    high_expiration: string;
  }>;
}

export interface PremiumVsExpirationPoint {
  expiration: string;
  dte: number;
  target_strike: number;
  snapped_strike: number;
  strike_diff: number;
  moneyness_pct: number;
  premium: number;
  bid: number;
  ask: number;
  last_price: number;
  volume: number;
  open_interest: number;
  implied_volatility: number;
  used_fallback: boolean;
  capital_basis_margin: number;
  annualized_return_margin: number;
  annualized_return_cash_secured: number;
}

export interface PremiumVsExpirationAnalysis {
  ticker: string;
  current_price: number;
  target_strike: number;
  target_strike_pct: number;
  option_type: "put" | "call";
  price_type: "bid" | "ask";
  points: PremiumVsExpirationPoint[];
  knee_point: PremiumVsExpirationPoint | null;
}
