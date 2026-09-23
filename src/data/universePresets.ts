// Official constituent lists for S&P 500, SMH (VanEck Semiconductor ETF), and QQQ (Nasdaq-100)

/**
 * All official constituents of the S&P 500 Index (~500 large-cap US equities)
 */
export const SP500_COMPONENTS: string[] = [
  "A", "AAPL", "ABBV", "ABNB", "ABT", "ACGL", "ACN", "ADBE", "ADI", "ADM",
  "ADP", "ADSK", "AEE", "AEP", "AES", "AFL", "AIG", "AIZ", "AJG", "AKAM",
  "ALB", "ALGN", "ALL", "ALLE", "AMAT", "AMCR", "AMD", "AME", "AMGN", "AMP",
  "AMT", "AMZN", "ANET", "AON", "AOS", "APA", "APD", "APH", "APO", "APP",
  "APTV", "ARE", "ARES", "ATO", "AVGO", "AVY", "AWK", "AXON", "AXP", "AZO",
  "BA", "BAC", "BALL", "BAX", "BBY", "BDX", "BEN", "BF-B", "BG", "BIIB",
  "BK", "BKNG", "BKR", "BLDR", "BLK", "BMY", "BNY", "BR", "BRK-B", "BRO",
  "BSX", "BX", "BXP", "C", "CAG", "CAH", "CARR", "CASY", "CAT", "CB",
  "CBOE", "CBRE", "CCI", "CCL", "CDNS", "CDW", "CE", "CEG", "CF", "CFG",
  "CHD", "CHRW", "CHTR", "CI", "CIEN", "CINF", "CL", "CLX", "CMA", "CMCSA",
  "CME", "CMG", "CMI", "CMS", "CNC", "CNP", "COF", "COHR", "COIN", "COO",
  "COP", "COR", "COST", "CPAY", "CPB", "CPRT", "CPT", "CRL", "CRM", "CRWD",
  "CSCO", "CSGP", "CSX", "CTAS", "CTRA", "CTSH", "CTVA", "CVS", "CVX", "CZR",
  "D", "DAL", "DASH", "DAY", "DD", "DDOG", "DE", "DECK", "DELL", "DFS",
  "DG", "DGX", "DHI", "DHR", "DIS", "DLR", "DLTR", "DOC", "DOV", "DOW",
  "DPZ", "DRI", "DTE", "DUK", "DVA", "DVN", "DXCM", "EA", "EBAY", "ECL",
  "ED", "EFX", "EG", "EIX", "EL", "ELV", "EME", "EMN", "EMR", "EOG",
  "EPAM", "EQIX", "EQR", "EQT", "ERIE", "ES", "ESS", "ETN", "ETR", "EVRG",
  "EW", "EXC", "EXE", "EXPD", "EXPE", "EXR", "F", "FANG", "FAST", "FCX",
  "FDS", "FDX", "FE", "FERG", "FFIV", "FICO", "FIS", "FITB", "FMC", "FOX",
  "FOXA", "FRT", "FSLR", "FTNT", "FTV", "GD", "GDDY", "GE", "GEHC", "GEN",
  "GEV", "GILD", "GIS", "GL", "GLW", "GM", "GNRC", "GOOG", "GOOGL", "GPC",
  "GPN", "GRMN", "GS", "GWW", "HAL", "HAS", "HBAN", "HCA", "HD", "HES",
  "HIG", "HII", "HLT", "HOLX", "HON", "HPE", "HPQ", "HRL", "HSIC", "HST",
  "HSY", "HUBB", "HUM", "HWM", "IBM", "ICE", "IDXX", "IEX", "IFF", "INCY",
  "INTC", "INTU", "INVH", "IP", "IPG", "IQV", "IR", "IRM", "ISRG", "IT",
  "ITW", "IVZ", "J", "JBHT", "JBL", "JCI", "JKHY", "JNJ", "JNPR", "JPM",
  "K", "KDP", "KEY", "KEYS", "KHC", "KIM", "KLAC", "KMB", "KMI", "KMX",
  "KO", "KR", "KVUE", "L", "LDOS", "LEN", "LH", "LHX", "LII", "LIN",
  "LKQ", "LLY", "LMT", "LNT", "LOW", "LRCX", "LULU", "LUV", "LVS", "LW",
  "LYB", "LYV", "MA", "MAA", "MAR", "MAS", "MCD", "MCHP", "MCK", "MCO",
  "MDLZ", "MDT", "MET", "META", "MGM", "MHK", "MKC", "MKTX", "MLM", "MMC",
  "MMM", "MNST", "MO", "MOH", "MOS", "MPC", "MPWR", "MRK", "MRNA", "MRVL",
  "MS", "MSCI", "MSFT", "MSI", "MTB", "MTD", "MU", "NCLH", "NDAQ", "NDSN",
  "NEE", "NEM", "NFLX", "NI", "NKE", "NOC", "NOW", "NRG", "NSC", "NTAP",
  "NTRS", "NUE", "NVDA", "NVR", "NWS", "NWSA", "NXPI", "O", "ODFL", "OKE",
  "OMC", "ON", "ORCL", "ORLY", "OTIS", "OXY", "PANW", "PARA", "PAYC", "PAYX",
  "PCAR", "PCG", "PEG", "PEP", "PFE", "PFG", "PG", "PGR", "PH", "PHM",
  "PKG", "PLD", "PLTR", "PM", "PNC", "PNR", "PNW", "PODD", "POOL", "PPG",
  "PPL", "PRU", "PSA", "PSX", "PTC", "PWR", "PYPL", "QCOM", "QRVO", "RCL",
  "REG", "REGN", "RF", "RJF", "RL", "RMD", "ROK", "ROL", "ROP", "ROST",
  "RSG", "RTX", "RVTY", "SBAC", "SBNY", "SBUX", "SCHW", "SHW", "SJM", "SLB",
  "SMCI", "SNA", "SNPS", "SO", "SPG", "SPGI", "SRE", "STE", "STLD", "STT",
  "STX", "STZ", "SW", "SWK", "SWKS", "SYF", "SYK", "SYY", "T", "TAP",
  "TDG", "TDY", "TECH", "TEL", "TER", "TFC", "TFX", "TGT", "TJX", "TMO",
  "TMUS", "TPR", "TRGP", "TRMB", "TROW", "TRV", "TSCO", "TSLA", "TSN", "TT",
  "TTWO", "TXN", "TXT", "TYL", "UAL", "UBER", "UDR", "UHS", "ULTA", "UNH",
  "UNP", "UPS", "URI", "USB", "V", "VICI", "VLO", "VLTO", "VMC", "VNO",
  "VRSK", "VRSN", "VRTX", "VTR", "VZ", "WAB", "WAT", "WBD", "WDC", "WEC",
  "WELL", "WFC", "WM", "WMB", "WMT", "WRB", "WST", "WTW", "WY", "WYNN",
  "XEL", "XOM", "XYL", "YUM", "ZBH", "ZBRA", "ZTS"
];

/**
 * All constituents of SMH (VanEck Semiconductor ETF - MVIS US Listed Semiconductor 25 Index)
 * Contains the leading pure-play semiconductor and equipment suppliers
 */
export const SMH_COMPONENTS: string[] = [
  "NVDA", // NVIDIA Corp
  "TSM",  // Taiwan Semiconductor Manufacturing
  "AVGO", // Broadcom Inc
  "ASML", // ASML Holding NV
  "AMD",  // Advanced Micro Devices
  "QCOM", // Qualcomm Inc
  "TXN",  // Texas Instruments
  "AMAT", // Applied Materials
  "MU",   // Micron Technology
  "LRCX", // Lam Research Corp
  "ADI",  // Analog Devices
  "KLAC", // KLA Corp
  "MRVL", // Marvell Technology
  "INTC", // Intel Corp
  "NXPI", // NXP Semiconductors
  "CRDO", // Credo Technology Group
  "MPWR", // Monolithic Power Systems
  "ON",   // ON Semiconductor
  "TER",  // Teradyne Inc
  "MCHP", // Microchip Technology
  "QRVO", // Qorvo Inc
  "SWKS", // Skyworks Solutions
  "ENPH", // Enphase Energy
  "ALAB", // Astera Labs
  "ARM",  // Arm Holdings
  "STM",  // STMicroelectronics
  "CDNS", // Cadence Design Systems (EDA)
  "SNPS"  // Synopsys Inc (EDA)
];

/**
 * All constituents of the Nasdaq-100 Index (Invesco QQQ Trust)
 * Contains the 100 largest non-financial companies listed on Nasdaq
 */
export const QQQ_COMPONENTS: string[] = [
  "AAPL", "ABNB", "ADBE", "ADI", "ADP", "ADSK", "AEP", "ALAB", "ALNY", "AMAT",
  "AMD", "AMGN", "AMZN", "ANET", "APP", "ARM", "ASML", "AVGO", "AXON", "BIIB",
  "BKNG", "BKR", "CCEP", "CDNS", "CEG", "CHTR", "CMCSA", "COST", "CPRT", "CRDO",
  "CRWD", "CSCO", "CSX", "CTAS", "CTSH", "DASH", "DDOG", "DXCM", "EA", "EXC",
  "FANG", "FAST", "FTNT", "GEHC", "GILD", "GOOG", "GOOGL", "HON", "IDXX", "INTC",
  "INTU", "ISRG", "KDP", "KHC", "KLAC", "LIN", "LITE", "LRCX", "LULU", "MAR",
  "MCHP", "MDB", "MDLZ", "MELI", "META", "MNST", "MPWR", "MRNA", "MRVL", "MSFT",
  "MSTR", "MU", "NBIS", "NFLX", "NVDA", "NXPI", "ODFL", "ON", "ORLY", "PANW",
  "PAYX", "PCAR", "PDD", "PEP", "PLTR", "PYPL", "QCOM", "REGN", "RKLB", "ROP",
  "ROST", "SBUX", "SHOP", "SMCI", "SNPS", "STX", "TEAM", "TER", "TMUS", "TSLA",
  "TTD", "TTWO", "TXN", "VRSK", "VRTX", "WBD", "WDC", "WDAY", "XEL", "ZS"
];

export interface UniversePresetConfig {
  id: "sp500" | "smh" | "qqq" | "watchlist" | "custom";
  label: string;
  shortLabel: string;
  badge: string;
  description: string;
  countLabel: string;
  tickers: string[];
}

export const UNIVERSE_PRESETS: Record<string, UniversePresetConfig> = {
  sp500: {
    id: "sp500",
    label: "All components of S&P 500",
    shortLabel: "S&P 500 Components",
    badge: "500+ Large-Cap",
    description: "Full basket of the S&P 500 index. Broadest exposure to US large-cap equities with deep options liquidity.",
    countLabel: `${SP500_COMPONENTS.length} stocks`,
    tickers: SP500_COMPONENTS,
  },
  smh: {
    id: "smh",
    label: "All components of SMH",
    shortLabel: "SMH Components",
    badge: "Semiconductors",
    description: "All 28 semiconductor leaders & equipment suppliers (NVDA, TSM, AVGO, AMD, MU, ASML, INTC, etc.). Highest options IV and rich put premium density.",
    countLabel: `${SMH_COMPONENTS.length} stocks`,
    tickers: SMH_COMPONENTS,
  },
  qqq: {
    id: "qqq",
    label: "All components of QQQ",
    shortLabel: "QQQ Components",
    badge: "Nasdaq-100",
    description: "Complete Nasdaq-100 non-financial index constituents. Premium tech, software, AI leaders and secular growth champions.",
    countLabel: `${QQQ_COMPONENTS.length} stocks`,
    tickers: QQQ_COMPONENTS,
  },
  watchlist: {
    id: "watchlist",
    label: "My Watchlist",
    shortLabel: "My Watchlist",
    badge: "Personal",
    description: "Scan your personal curated portfolio watchlist for confirmed RSI exhaustion and bullish divergence setups.",
    countLabel: "Curated",
    tickers: [],
  },
  custom: {
    id: "custom",
    label: "Custom Tickers",
    shortLabel: "Custom Tickers",
    badge: "Flexible",
    description: "Manually input a comma-delimited list of tickers to scan on-demand.",
    countLabel: "User Defined",
    tickers: [],
  },
};

/**
 * Resolves a universe identifier to its full constituent ticker array
 */
export function getTickersForUniverse(
  universe: string,
  watchlist: string[] = [],
  customTickers: string[] = []
): string[] {
  switch (universe) {
    case "sp500":
    case "spy":
    case "expanded_500":
      return SP500_COMPONENTS;
    case "smh":
      return SMH_COMPONENTS;
    case "qqq":
      return QQQ_COMPONENTS;
    case "watchlist":
      return watchlist;
    case "custom":
      return customTickers;
    default:
      return SP500_COMPONENTS;
  }
}
