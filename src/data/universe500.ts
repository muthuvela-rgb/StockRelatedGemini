// 500+ Liquid US Stocks Universe (S&P 500 & Nasdaq-100 Universe)
export const EXPANDED_500_UNIVERSE: string[] = [
  // Mega-Cap Tech & Communications
  "AAPL", "MSFT", "NVDA", "GOOGL", "GOOG", "AMZN", "META", "TSLA", "AVGO", "ORCL",
  "CSCO", "CRM", "ADBE", "NFLX", "AMD", "QCOM", "INTC", "IBM", "TXN", "NOW",
  "AMAT", "LRCX", "MU", "PANW", "SNPS", "CDNS", "KLAC", "NXPI", "MCHP", "ADI",
  "FTNT", "ANET", "CRWD", "WDAY", "ROP", "PLTR", "ARM", "SMCI", "MRVL", "ON",
  "MPWR", "TER", "FSLR", "ENPH", "STX", "WDC", "SWKS", "QRVO", "KEYS", "VRSN",
  "AKAM", "NTAP", "PTC", "GEN", "FFIV", "JNPR", "TYL", "EPAM", "ZBRA", "TRMB",

  // High-Volume Growth / Nasdaq Leaders
  "SHOP", "ABNB", "UBER", "DASH", "MELI", "PDD", "BIDU", "BABA", "JD", "SE",
  "SNOW", "DDOG", "NET", "MSTR", "COIN", "HOOD", "RBLX", "U", "APP", "TTD",
  "PINS", "SNAP", "SPOT", "ROKU", "DKNG", "DOCU", "ZM", "TEAM", "OKTA", "ZS",
  "ALAB", "NBIS", "CRWV", "RKLB", "SKHY", "SPCX", "SNDK", "CRDO", "TQQQ", "SQQQ",

  // Financials & Payments
  "BRK-B", "JPM", "V", "MA", "BAC", "WFC", "MS", "GS", "SPGI", "BLK",
  "AXP", "PGR", "CB", "MMC", "C", "SCHW", "MCO", "AON", "ICE", "AJG",
  "USB", "PNC", "TRV", "AFL", "ALL", "PRU", "MET", "BK", "AIG", "COF",
  "AMP", "MSCI", "TROW", "ACGL", "DFS", "HIG", "FITB", "MTB", "RJF", "BRO",
  "NTRS", "HBAN", "RF", "CFG", "KEY", "SYF", "CINF", "PFG", "WRB", "L",
  "PYPL", "SQ", "SOFI", "AFRM", "UPST", "VIRT", "CBOE", "CME", "NDAQ", "FDS",

  // Healthcare, Pharmaceuticals & Biotech
  "LLY", "UNH", "JNJ", "ABBV", "MRK", "TMO", "ABT", "DHR", "ISRG", "PFE",
  "AMGN", "SYK", "ELV", "GILD", "BSX", "VRTX", "MDT", "REGN", "CI", "ZTS",
  "BDX", "HCA", "BMY", "HUM", "MCK", "COR", "IDXX", "EW", "A", "DXCM",
  "IQV", "BIIB", "MTD", "RMD", "ALNY", "WST", "STE", "CAH", "BAX", "COO",
  "GEHC", "HOLX", "LH", "PKI", "DGX", "PODD", "TECH", "INCY", "RVTY", "BIO",
  "MRNA", "BNTX", "BMRN", "VTRS", "CRL", "TFX", "XRAY", "UHS", "MOH", "CNC",

  // Consumer Discretionary & Retail
  "AMZN", "TSLA", "HD", "MCD", "NKE", "LOW", "SBUX", "TJX", "BKNG", "TGT",
  "CMG", "LULU", "MAR", "HLT", "ORLY", "AZO", "ROST", "DRI", "YUM", "EBAY",
  "EXPE", "ULTA", "BBY", "GRMN", "DPZ", "KMX", "GPC", "TSCO", "POOL", "LKQ",
  "F", "GM", "APTV", "BWA", "HAS", "WHR", "PHM", "LEN", "DHI", "NVR",
  "CZR", "MGM", "WYNN", "LVS", "RCL", "CCL", "NCLH", "TPR", "RL", "PVH",

  // Consumer Staples
  "WMT", "PG", "COST", "KO", "PEP", "PM", "MDLZ", "MO", "CL", "KMB",
  "GIS", "STZ", "SYY", "ADM", "HSY", "K", "KHC", "MNST", "EL", "CHD",
  "CLX", "CAG", "TSN", "HRL", "SJM", "MKC", "TAP", "CPB", "LW", "KVUE",
  "KR", "DG", "DLTR", "WBA", "TGT", "CCEP", "CELH", "KDP", "BF-B", "POST",

  // Industrials & Aerospace
  "GE", "CAT", "UNP", "HON", "RTX", "BA", "DE", "LMT", "ETN", "UPS",
  "FDX", "GD", "WM", "NOC", "CSX", "NSC", "PCAR", "ITW", "EMR", "PH",
  "TT", "CARR", "TDG", "GWW", "CTAS", "URI", "CPRT", "FAST", "ODFL", "DAL",
  "UAL", "LUV", "AAL", "RSG", "WAB", "IR", "PWR", "AME", "HWM", "BLDR",
  "XYL", "JCI", "CHRW", "EXPD", "HUBB", "SNA", "MAS", "NDSN", "DOV", "IEX",

  // Energy & Utilities
  "XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO", "OXY", "WMB",
  "HES", "KMI", "HAL", "BKR", "DVN", "FANG", "TRGP", "CTRA", "MRO", "EQT",
  "NEE", "SO", "DUK", "CEG", "SRE", "AEP", "D", "EXC", "XEL", "ED",
  "PCG", "PEG", "WEC", "ES", "AWK", "EIX", "DTE", "ETR", "FE", "PPL",
  "CNP", "CMS", "NRG", "VST", "AES", "NI", "LNT", "EVRG", "ATO", "PNW",

  // Materials & Real Estate
  "LIN", "SHW", "APD", "ECL", "FCX", "NEM", "CTVA", "DOW", "NUE", "VMC",
  "MLM", "PPG", "IFF", "ALB", "CF", "FMC", "MOS", "EMN", "CE", "BALL",
  "PLD", "AMT", "EQIX", "CCI", "PSA", "O", "WELL", "SPG", "DLR", "VICI",
  "AVB", "EQR", "CBRE", "WY", "SBAC", "INVH", "EXR", "MAA", "UDR", "ESS",

  // Key Liquid ETFs
  "QQQ", "SPY", "IWM", "DIA", "SMH", "SOXX", "XLE", "XLF", "XLK", "XLV"
];

export { SP500_COMPONENTS, SMH_COMPONENTS, QQQ_COMPONENTS } from "./universePresets";

// Helper to get unique trimmed tickers
export function getExpanded500Universe(): string[] {
  return Array.from(new Set(EXPANDED_500_UNIVERSE.map((t) => t.trim().toUpperCase()))).filter(Boolean);
}
