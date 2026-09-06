export interface FibonacciLevels {
  level_0: number;
  level_236: number;
  level_382: number;
  level_500: number;
  level_618: number;
  level_1000: number;
}

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
  fifty_two_week_high?: number | null;
  fifty_two_week_low?: number | null;
  rsi_14?: number | null;
  bollinger?: {
    sma: number;
    upper_band: number;
    lower_band: number;
    percent_b: number;
    zone: string;
  } | null;
  fibonacci?: FibonacciLevels | null;
  strike_bollinger_position?: {
    zone: string;
    zone_label: string;
    is_below_lower: boolean;
    diff_from_lower: number;
    pct_from_lower: number;
    lower_band: number;
    sma: number;
    upper_band: number;
  } | null;
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
  expiration?: string;
  days_to_expiration?: number;
}

export interface ExpirationChainData {
  expiration: string;
  days_to_expiration: number;
  calls: OptionGreeks[];
  puts: OptionGreeks[];
}

export interface OptionChainResponse {
  ticker: string;
  current_price: number;
  expirations: string[];
  selected_expiration: string;
  days_to_expiration: number;
  calls: OptionGreeks[];
  puts: OptionGreeks[];
  all_chains?: Record<string, ExpirationChainData>;
  all_calls?: OptionGreeks[];
  all_puts?: OptionGreeks[];
  is_all_expirations?: boolean;
  rsi_14?: number | null;
  bollinger?: {
    sma: number;
    upper_band: number;
    lower_band: number;
    percent_b?: number;
    zone?: string;
  } | null;
  fibonacci?: FibonacciLevels | null;
  fifty_two_week_high?: number | null;
  fifty_two_week_low?: number | null;
  next_earnings_date?: string | null;
  next_earnings_timestamp?: number | null;
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
  rsi_14?: number | null;
  bollinger?: {
    sma: number;
    upper_band: number;
    lower_band: number;
    percent_b?: number;
    zone?: string;
  } | null;
  fibonacci?: {
    level_0: number;
    level_236: number;
    level_382: number;
    level_500: number;
    level_618: number;
    level_1000: number;
  } | null;
  strike_bollinger_position?: {
    zone: string;
    zone_label: string;
    is_below_lower: boolean;
    diff_from_lower: number;
    pct_from_lower: number;
    lower_band: number;
    sma: number;
    upper_band: number;
  } | null;
}

export interface PremiumCurveAnalysis {
  ticker: string;
  current_price: number | null;
  fifty_two_week_high?: number | null;
  fifty_two_week_low?: number | null;
  expirations: string[];
  records: PremiumCurvePoint[];
  highest_ratio_point: PremiumCurvePoint | null;
  rsi_14?: number | null;
  bollinger?: {
    sma: number;
    upper_band: number;
    lower_band: number;
    percent_b?: number;
    zone?: string;
  } | null;
  fibonacci?: {
    level_0: number;
    level_236: number;
    level_382: number;
    level_500: number;
    level_618: number;
    level_1000: number;
  } | null;
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
  rsi_14?: number | null;
  bollinger?: {
    sma: number;
    upper_band: number;
    lower_band: number;
    percent_b?: number;
    zone?: string;
  } | null;
  fibonacci?: {
    level_0: number;
    level_236: number;
    level_382: number;
    level_500: number;
    level_618: number;
    level_1000: number;
  } | null;
  strike_bollinger_position?: {
    zone: string;
    zone_label: string;
    is_below_lower: boolean;
    diff_from_lower: number;
    pct_from_lower: number;
    lower_band: number;
    sma: number;
    upper_band: number;
  } | null;
}

export interface PremiumVsExpirationAnalysis {
  ticker: string;
  current_price: number;
  fifty_two_week_high?: number | null;
  fifty_two_week_low?: number | null;
  target_strike: number;
  target_strike_pct: number;
  option_type: "put" | "call";
  price_type: "bid" | "ask";
  rsi_14?: number | null;
  bollinger?: {
    sma: number;
    upper_band: number;
    lower_band: number;
    percent_b?: number;
    zone?: string;
  } | null;
  fibonacci?: {
    level_0: number;
    level_236: number;
    level_382: number;
    level_500: number;
    level_618: number;
    level_1000: number;
  } | null;
  points: PremiumVsExpirationPoint[];
  knee_point: PremiumVsExpirationPoint | null;
  // Multi-strike range support
  is_range_mode?: boolean;
  range_strikes?: Array<{
    key: string;
    label: string;
    target_strike_pct: number;
    target_strike: number;
    snapped_strike: number;
    avg_premium: number;
    avg_cash_return: number;
    avg_margin_return: number;
    avg_iv: number;
    cushion_to_strike_pct: number;
    knee_point: PremiumVsExpirationPoint | null;
    points: PremiumVsExpirationPoint[];
  }>;
  range_chart_data?: Array<{
    expiration: string;
    dte: number;
    label: string;
    shortLabel: string;
    strikes: Record<string, any>;
    [key: string]: any;
  }>;
}

export interface MultiTickerCompareResult {
  ticker: string;
  current_price: number;
  fifty_two_week_high?: number | null;
  fifty_two_week_low?: number | null;
  target_strike: number;
  target_strike_pct: number;
  rsi_14?: number | null;
  bollinger?: {
    sma: number;
    upper_band: number;
    lower_band: number;
    percent_b?: number;
    zone?: string;
  } | null;
  fibonacci?: {
    level_0: number;
    level_236: number;
    level_382: number;
    level_500: number;
    level_618: number;
    level_1000: number;
  } | null;
  points: PremiumVsExpirationPoint[];
  knee_point: PremiumVsExpirationPoint | null;
  avg_cash_return: number;
  avg_margin_return: number;
  avg_iv: number;
}

export interface MultiTickerCompareAnalysis {
  tickers: string[];
  target_strike_pct: number;
  option_type: "put" | "call";
  price_type: "bid" | "ask";
  expirations: Array<{ expiration: string; dte: number; label: string }>;
  results_by_ticker: Record<string, MultiTickerCompareResult>;
  overlaid_chart_data: Array<{
    expiration: string;
    dte: number;
    label: string;
    stocks: Record<string, any>;
    [key: string]: any;
  }>;
}

export type RiskTier = "least_risk" | "medium_risk" | "high_risk";

export interface RecommendedPut {
  id: string;
  ticker: string;
  current_price: number;
  strike: number;
  expiration: string;
  dte: number;
  risk_tier: RiskTier;
  risk_tier_label: string;
  score: number;
  bid: number;
  ask: number;
  mid: number;
  spread_pct: number;
  last_price: number;
  volume: number;
  open_interest: number;
  contract_symbol: string;
  moneyness_pct: number;
  cushion_to_strike_pct: number;
  breakeven_price: number;
  cushion_to_breakeven_pct: number;
  premium_per_contract: number;
  capital_basis_margin: number;
  capital_basis_cash_secured: number;
  annualized_return_margin: number;
  annualized_return_cash_secured: number;
  daily_theta_decay: number;
  probability_of_profit: number;
  probability_of_assignment: number;
  greeks: {
    delta: number | null;
    gamma: number | null;
    theta: number | null;
    vega: number | null;
    rho: number | null;
    iv_pct: number;
  };
  technicals: {
    rsi_14: number | null;
    bollinger_zone: string | null;
    bollinger_lower: number | null;
    is_below_bollinger_lower: boolean;
    hist_vol_pct: number | null;
    iv_to_hv_ratio: number | null;
    fifty_two_week_high: number | null;
    fifty_two_week_low?: number | null;
    dist_to_52w_high_pct: number | null;
    market_cap?: number | null;
    next_earnings_date?: string | null;
    fibonacci?: {
      level_0: number;
      level_236: number;
      level_382: number;
      level_500: number;
      level_618: number;
      level_1000: number;
    } | null;
  };
  rationale: string;
  strategy_flags: string[];
  earnings_context?: {
    next_earnings_date: string | null;
    days_to_earnings: number | null;
    spans_earnings: boolean;
    expires_before_earnings: boolean;
    earnings_passed_recently?: boolean;
    score_impact: number;
    label: string;
  };
  fifty_two_week_high?: number | null;
  fifty_two_week_low?: number | null;
  rsi_14?: number | null;
  bollinger?: {
    sma: number;
    upper_band: number;
    lower_band: number;
    percent_b?: number;
    zone?: string;
  } | null;
  fibonacci?: FibonacciLevels | null;
  strike_bollinger_position?: {
    zone: string;
    zone_label: string;
    is_below_lower: boolean;
    diff_from_lower: number;
    pct_from_lower: number;
    lower_band: number;
    sma: number;
    upper_band: number;
  } | null;
}

export interface RiskTierSummary {
  count: number;
  avg_pop: number;
  avg_margin_return: number;
  avg_cash_return: number;
  avg_cushion: number;
  avg_theta: number;
  top_pick?: RecommendedPut;
}

export interface PutRecommendationsResponse {
  least_risk: RecommendedPut[];
  medium_risk: RecommendedPut[];
  high_risk: RecommendedPut[];
  all_recommendations: RecommendedPut[];
  tickers_scanned: string[];
  total_contracts_evaluated: number;
  tier_summaries: {
    least_risk: RiskTierSummary;
    medium_risk: RiskTierSummary;
    high_risk: RiskTierSummary;
  };
  market_context: Record<
    string,
    {
      price: number;
      rsi: number | null;
      iv: number | null;
      hv: number | null;
      bollinger_lower: number | null;
      bollinger_upper: number | null;
      dist_to_52w_high_pct: number | null;
    }
  >;
  timestamp: string;
}

export interface AiPortfolioStrategy {
  market_regime: string;
  allocation: {
    least_risk_pct: number;
    medium_risk_pct: number;
    high_risk_pct: number;
    cash_reserve_pct: number;
  };
  executive_summary: string;
  tier_guidance: {
    least_risk_rationale: string;
    medium_risk_rationale: string;
    high_risk_rationale: string;
  };
  recommended_trades: Array<{
    ticker: string;
    tier: string;
    strike: number;
    expiration: string;
    action_thesis: string;
    catalyst_or_risk: string;
  }>;
  risk_rules: string[];
}

export interface EarningsCallTranscript {
  ticker: string;
  quarter: string;
  date: string;
  year?: number;
  quarter_number?: number;
  speakers?: Array<{ name: string; title: string }>;
  transcript_text: string;
  word_count?: number;
  source: "alpha_vantage_live" | "sample_verified";
  ai_summary?: TranscriptAiSummary | null;
}

export interface TranscriptAiSummary {
  executive_summary: string;
  revenue_and_eps: {
    reported_revenue: string;
    revenue_growth_yoy: string;
    reported_eps: string;
    eps_growth_yoy: string;
    guidance_vs_consensus: string;
  };
  guidance_and_outlook: string;
  key_catalysts: string[];
  risks_and_headwinds: string[];
  analyst_qa_highlights: Array<{
    analyst: string;
    firm: string;
    question: string;
    executive_response: string;
    sentiment: "bullish" | "neutral" | "defensive" | "cautious";
  }>;
  management_sentiment: {
    score: number;
    label: "Bullish" | "Moderately Bullish" | "Neutral" | "Cautious" | "Bearish";
    rationale: string;
  };
  options_implications: string;
  executive_quotes: Array<{
    speaker: string;
    role: string;
    quote: string;
  }>;
}

