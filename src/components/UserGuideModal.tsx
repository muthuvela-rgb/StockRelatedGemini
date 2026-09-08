import React, { useState, useMemo } from "react";
import {
  BookOpen,
  Search,
  X,
  ChevronRight,
  LineChart,
  ShieldCheck,
  TrendingDown,
  Activity,
  Clock,
  Layers,
  FileSpreadsheet,
  MessageSquareQuote,
  BookmarkCheck,
  GraduationCap,
  ArrowUpRight,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Calculator,
  Zap,
  Shield,
  Filter,
  Info,
  ChevronDown,
  Video,
  Play,
  ExternalLink,
  Sparkles,
  TrendingUp
} from "lucide-react";
import { ActiveTab } from "./Header";

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: ActiveTab) => void;
  initialTab?: string;
}

interface TabGuideInfo {
  id: ActiveTab;
  title: string;
  badge: string;
  icon: any;
  category: "Options & Yield" | "Technical & Fall" | "Fundamentals & Transcripts" | "Portfolio & Education" | "Security";
  tagline: string;
  whatItDoes: string;
  howToUse: string[];
  keyMetrics: { name: string; formulaOrRule: string; meaning: string }[];
  proTips: string[];
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState<
    "quick-start" | "tabs" | "formulas" | "technicals-simple" | "faq"
  >("quick-start");
  const [selectedTabId, setSelectedTabId] = useState<ActiveTab>("options-scanner");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const tabGuides: TabGuideInfo[] = useMemo(
    () => [
      {
        id: "options-scanner",
        title: "Put Scanner",
        badge: "OCC TIMS Margin",
        icon: LineChart,
        category: "Options & Yield",
        tagline: "Algorithmic screening of Cash-Secured Put opportunities across your entire watchlist.",
        whatItDoes:
          "The Put Scanner pulls live option chain data for all tickers in your active watchlist and evaluates out-of-the-money (OTM) Put contracts. It computes collateral requirements according to the Options Clearing Corporation (OCC) TIMS margin model, ranks opportunities by downside buffer and annualized return, and warns of near-term earnings risk.",
        howToUse: [
          "Ensure your Watchlist contains stocks you are fundamentally comfortable owning long-term.",
          "Review the sorted table for high Annualized Return on Capital (ARR %) with healthy Downside Cushion (>8%).",
          "Check the Days to Expiration (DTE) filter (ideally 15 to 45 days) to capture the steepest portion of theta decay.",
          "Verify the Earnings Date indicator: avoid selling puts immediately preceding binary earnings announcements unless compensated by high IV."
        ],
        keyMetrics: [
          {
            name: "OCC TIMS Margin",
            formulaOrRule: "Max(10% Strike - OTM Amount, 5% Strike) + Premium",
            meaning: "Standard collateral capital held by clearinghouses for cash-secured and naked put positions."
          },
          {
            name: "Downside Cushion (%)",
            formulaOrRule: "((Stock Price - Strike Price) / Stock Price) × 100",
            meaning: "The percentage drop in stock price tolerated before your position crosses into a net loss."
          },
          {
            name: "Annualized Return (ARR %)",
            formulaOrRule: "(Premium / Strike Price) × (365 / DTE) × 100",
            meaning: "Annualized yield on tied-up cash, useful for comparing options yield against benchmark Treasury rates."
          },
          {
            name: "Probability of Profit (POP)",
            formulaOrRule: "≈ 1 - |Delta|",
            meaning: "Statistical probability that the option expires out-of-the-money (worthless), leaving you 100% of the premium."
          }
        ],
        proTips: [
          "Target Delta between -0.12 and -0.22 for the optimal balance of high win rate and worthwhile premium.",
          "Check the Open Interest and Volume columns; higher liquidity ensures tighter bid-ask spreads when entering or rolling."
        ]
      },
      {
        id: "put-recommendations",
        title: "Put Recommendations",
        badge: "3 Risk Tiers",
        icon: ShieldCheck,
        category: "Options & Yield",
        tagline: "Curated, risk-tiered put setups ready for execution with 1-click Cloud Firestore saving.",
        whatItDoes:
          "Automatically groups scanned opportunities into 3 disciplined risk tiers (Conservative, Balanced, and Growth). It eliminates analysis paralysis by surfacing the highest quality contract setups filtered for liquidity and buffer.",
        howToUse: [
          "Select your risk tier tab: Conservative, Balanced, or Growth.",
          "Inspect the recommended strike price, premium collected, and distance to key technical support.",
          "Click 'Save Trade' to log the contract directly into your persistent Firestore database for tracking and review."
        ],
        keyMetrics: [
          {
            name: "Conservative Tier",
            formulaOrRule: "Delta: 0.10–0.15 | Cushion: >15%",
            meaning: "Maximum safety cushion; ideal for market uncertainty or defensive accounts."
          },
          {
            name: "Balanced Tier",
            formulaOrRule: "Delta: 0.15–0.22 | Cushion: 8–15%",
            meaning: "The industry standard 'sweet spot' capturing optimal annualized returns with steady probability of profit."
          },
          {
            name: "Growth / Aggressive Tier",
            formulaOrRule: "Delta: 0.22–0.30 | Cushion: 5–8%",
            meaning: "Generates aggressive cash flow on high-conviction companies you are eager to acquire if assigned."
          }
        ],
        proTips: [
          "Use the 'Saved Trades' button in the top navigation to revisit logged recommendations and see total capital allocated.",
          "Diversify strikes across different sectors (Tech, Industrials, Healthcare) rather than loading puts on a single high-beta name."
        ]
      },
      {
        id: "fall-detector",
        title: "Fall Detector",
        badge: "Context & Pullback",
        icon: TrendingDown,
        category: "Technical & Fall",
        tagline: "Identifies sharp dips and pullbacks across watchlist equities where put premiums are elevated.",
        whatItDoes:
          "When quality stocks drop, Implied Volatility (IV) spikes, making put premiums significantly more expensive. The Fall Detector tracks 1-day, 5-day, and 1-month selloffs, pairing price drops with RSI and moving average context so you can sell puts at discounted strike prices.",
        howToUse: [
          "Look for stocks flagging in red with significant pullbacks (-3% to -10%).",
          "Evaluate whether the selloff is company-specific (bad earnings) or broad market contagion (healthy dip).",
          "Cross-reference the 52-week high/low range to ensure the stock is holding major multi-month support."
        ],
        keyMetrics: [
          {
            name: "1D / 5D / 1M Drop %",
            formulaOrRule: "Percentage price change across rolling intervals",
            meaning: "Measures momentum and velocity of the current downward move."
          },
          {
            name: "RSI(14) Drop Level",
            formulaOrRule: "RSI < 35 = Oversold condition",
            meaning: "Signals high statistical likelihood of mean-reversion or selling exhaustion."
          }
        ],
        proTips: [
          "Never sell puts on a stock falling due to fraud or catastrophic business obsolescence. Use Fall Detector ONLY on companies whose products and balance sheets you admire."
        ]
      },
      {
        id: "technicals",
        title: "Technicals Screener",
        badge: "Momentum & Support",
        icon: Activity,
        category: "Technical & Fall",
        tagline: "Comprehensive multi-indicator technical diagnostic for underlying equities.",
        whatItDoes:
          "Evaluates trend strength, momentum oscillators, and volume characteristics. Provides automated calculations of key Simple Moving Averages (20, 50, and 200 SMA), MACD histograms, and structural support/resistance zones.",
        howToUse: [
          "Check whether the stock is trading above or below its 200-day Simple Moving Average (macro trend filter).",
          "Identify major support levels and ensure your put strike is located comfortably beneath that structural floor.",
          "Monitor MACD histogram divergences to anticipate trend reversals before selling new contracts."
        ],
        keyMetrics: [
          {
            name: "SMA 200",
            formulaOrRule: "200-day Simple Moving Average",
            meaning: "The line between secular bull and bear markets recognized by institutional algorithms."
          },
          {
            name: "MACD Histogram",
            formulaOrRule: "12 EMA - 26 EMA compared to 9-day Signal line",
            meaning: "Positive turning green indicates accelerating upward momentum; declining red indicates selling pressure."
          }
        ],
        proTips: [
          "Setting your put strike below the 200 SMA or a major swing-low support zone drastically improves trade win-rates."
        ]
      },
      {
        id: "short-puts",
        title: "Short-Dated Screener",
        badge: "0–14 DTE / Weeklies",
        icon: Clock,
        category: "Options & Yield",
        tagline: "Fast theta-decay options screener for ultra short weekly cash-flow cycles.",
        whatItDoes:
          "Filters specifically for contracts expiring in 0 to 14 days. This view is engineered for tactical traders exploiting the rapid weekend decay and exponential theta curves of front-month options.",
        howToUse: [
          "Review contracts expiring this Friday or next Friday.",
          "Compare the annualized yield against the tighter cushion.",
          "Check for intra-week economic announcements (CPI, FOMC, Fed meetings) that could spark sudden volatility."
        ],
        keyMetrics: [
          {
            name: "Theta (Decay / Day)",
            formulaOrRule: "Option price drop per 24 hours (time decay)",
            meaning: "At <14 DTE, theta reaches its fastest burn rate, rapidly evaporating option extrinsic value into cash."
          }
        ],
        proTips: [
          "Short-dated puts require more frequent monitoring than 30–45 DTE positions because gamma is higher near expiration.",
          "Consider closing early if 75–80% of the maximum profit has been captured within a few trading days."
        ]
      },
      {
        id: "option-chain",
        title: "Option Chain & Greeks",
        badge: "Full Chain & IV",
        icon: Layers,
        category: "Options & Yield",
        tagline: "Interactive full-depth options chain with first and second-order Black-Scholes Greeks.",
        whatItDoes:
          "Displays the complete options matrix (Calls and Puts) across any expiration date for any watchlist ticker. Shows live Bids, Asks, Volume, Open Interest, Implied Volatility, and Greeks (Delta, Gamma, Theta, Vega).",
        howToUse: [
          "Select your ticker from the dropdown and pick an expiration date.",
          "Toggle between Calls, Puts, or Side-by-Side views.",
          "Observe the Implied Volatility skew across strike prices to see where option buyers are bidding up insurance."
        ],
        keyMetrics: [
          {
            name: "Delta (Δ)",
            formulaOrRule: "Rate of change of option price per $1 move in underlying",
            meaning: "Also represents approximate probability of expiring in-the-money."
          },
          {
            name: "Gamma (Γ)",
            formulaOrRule: "Rate of change of Delta per $1 move in stock",
            meaning: "Measures sensitivity; higher gamma means delta moves quickly as the stock nears the strike."
          },
          {
            name: "Theta (Θ)",
            formulaOrRule: "Dollars gained per day through the passage of time",
            meaning: "The option seller's primary statistical edge."
          },
          {
            name: "Vega (ν)",
            formulaOrRule: "Dollar change in option price per 1% change in Implied Volatility",
            meaning: "Selling puts when IV is elevated allows you to profit from future volatility contraction."
          }
        ],
        proTips: [
          "High Open Interest (OI) at a specific strike often acts as an options 'pin' or psychological magnet near expiration."
        ]
      },
      {
        id: "premium-curves",
        title: "Premium Curves & Smile",
        badge: "Volatility Skew",
        icon: Search,
        category: "Options & Yield",
        tagline: "Visualizes the volatility smile, implied volatility skew, and annualized yield structures.",
        whatItDoes:
          "Plots graphical curves of option premium yields and implied volatility across multiple strikes and expirations. Allows options traders to visually spot mispriced tail risks and identify the steepest yield payoffs.",
        howToUse: [
          "Select a ticker to generate the dynamic SVG premium curve.",
          "Identify the inflection point on the curve where annualized return flattens out relative to increasing delta risk.",
          "Compare front-month vs. back-month term structure to see whether the market expects near-term or long-term volatility."
        ],
        keyMetrics: [
          {
            name: "Volatility Smile / Skew",
            formulaOrRule: "IV plotted against strike prices",
            meaning: "Typically shows a steep left-hand slope for equity puts (downside crash insurance demand)."
          }
        ],
        proTips: [
          "Look for strikes right at the 'kink' of the curve to maximize risk-adjusted premium collection."
        ]
      },
      {
        id: "sec-earnings",
        title: "SEC Earnings (EDGAR XBRL)",
        badge: "Official Filings",
        icon: FileSpreadsheet,
        category: "Fundamentals & Transcripts",
        tagline: "Direct integration with the U.S. Securities and Exchange Commission (SEC) EDGAR database.",
        whatItDoes:
          "Pulls official 10-K (Annual) and 10-Q (Quarterly) filings directly from the SEC. Visualizes multi-year trends in Net Revenue, Net Income, Operating Cash Flow, Total Debt, Cash & Equivalents, and EPS beats/misses.",
        howToUse: [
          "Type any ticker to inspect audited corporate balance sheets and income statements.",
          "Verify that Operating Cash Flow is consistently positive and growing.",
          "Examine the Total Debt vs. Cash Reserves ratio to ensure the company has sufficient runway to survive recessions."
        ],
        keyMetrics: [
          {
            name: "Operating Cash Flow",
            formulaOrRule: "Net cash generated from regular business operations",
            meaning: "The purest indicator of financial health; cannot easily be manipulated by accounting tricks."
          },
          {
            name: "Debt-to-Cash Ratio",
            formulaOrRule: "Total Long-Term Debt / Cash & Short-Term Equivalents",
            meaning: "Ratios under 1.5 indicate defensive solvency."
          }
        ],
        proTips: [
          "Never sell cash-secured puts on companies burning cash with unmanageable debt piles. Solid SEC fundamentals are your best margin of safety."
        ]
      },
      {
        id: "earnings-transcripts",
        title: "Earnings Transcripts",
        badge: "Alpha Vantage & AI",
        icon: MessageSquareQuote,
        category: "Fundamentals & Transcripts",
        tagline: "Corporate earnings call transcripts parsed and synthesized with Gemini AI.",
        whatItDoes:
          "Fetches verified executive earnings call transcripts via Alpha Vantage and synthesizes the commentary using server-side Gemini AI. Delivers institutional summaries highlighting management sentiment, forward guidance, and key product catalysts.",
        howToUse: [
          "Select any ticker to read recent earnings call transcripts.",
          "Review the AI-generated Executive Summary for strategic highlights and operational challenges.",
          "Read the verbatim Q&A exchange between Wall Street analysts and company leadership."
        ],
        keyMetrics: [
          {
            name: "Executive Tone & Sentiment",
            formulaOrRule: "Gemini qualitative sentiment extraction",
            meaning: "Evaluates whether management is confident, guarded, or cautious about forward quarters."
          }
        ],
        proTips: [
          "Pay close attention to CFO commentary regarding capital expenditures and share buybacks—strong buybacks act as a natural cushion for put sellers."
        ]
      },
      {
        id: "watchlist",
        title: "Watchlist Manager",
        badge: "Firestore Cloud Sync",
        icon: BookmarkCheck,
        category: "Portfolio & Education",
        tagline: "Unified watchlist control with dual-layer server and Google Cloud Firestore persistence.",
        whatItDoes:
          "Allows you to add, remove, and manage stock tickers that drive all scanners and tools. Every edit is instantly committed to central memory and synchronized to your personal Google Cloud Firestore database.",
        howToUse: [
          "Type a ticker symbol (e.g., AAPL, NVDA, GOOGL, MSFT) and click 'Add Ticker'.",
          "Use the pre-built sector bulk loader to quickly add blue-chip leaders.",
          "Click the 'Saved Trades' button to review past logged put recommendations."
        ],
        keyMetrics: [
          {
            name: "Sync Status",
            formulaOrRule: "Firestore real-time snapshot listener",
            meaning: "Confirms your watchlist is safely backed up to the cloud and persistent across all devices."
          }
        ],
        proTips: [
          "Curate a focused list of 10–25 companies you understand deeply rather than an unmanageable list of 100+ speculative names."
        ]
      },
      {
        id: "junior-academy",
        title: "Junior Investor Academy",
        badge: "Age 11+ STEM Edition",
        icon: GraduationCap,
        category: "Portfolio & Education",
        tagline: "Interactive financial education academy with live search-grounded 'Ask Dad' AI mentor.",
        whatItDoes:
          "A tailored learning academy designed for an 11-year-old student (6th grade) in Silicon Valley. Introduces stock ownership, put options as insurance (like AppleCare), and compounding math. Features an interactive simulator, options payoff visualizer, 5-question challenge quiz, curated video theater, and a child-safe 'Ask Dad' AI mentor.",
        howToUse: [
          "Explore the 6 curriculum modules with clear STEM analogies (Roblox Robux, Pokémon cards, Apple Park).",
          "Experiment with the Compounding Simulator to see how regular allowance deposits grow over 10–30 years.",
          "Open the 'Ask Dad' chat box to ask any question—Dad answers directly with real-time Google search grounding and strict child safety."
        ],
        keyMetrics: [
          {
            name: "Compounding Formula",
            formulaOrRule: "Future Value = P × (1 + r)^t",
            meaning: "Demonstrates how patience, reinvestment, and mathematical growth compound into real wealth."
          }
        ],
        proTips: [
          "Use the Quiz section together to test comprehension of Calls vs. Puts and what happens when stock prices fluctuate."
        ]
      },
      {
        id: "access-audit",
        title: "Access Audit Console",
        badge: "Superadmin Only",
        icon: Shield,
        category: "Security",
        tagline: "Restricted administrative audit log reserved strictly for muthu.vela@gmail.com.",
        whatItDoes:
          "Monitors Google Authentication sessions, tracking login attempts, verified email addresses, IP locations, user agent headers, and administrative actions stored securely in Cloud Firestore.",
        howToUse: [
          "Only visible and accessible when logged in as the superadmin.",
          "Review historical login events and inspect raw audit payloads for security compliance."
        ],
        keyMetrics: [
          {
            name: "Audit Timestamp",
            formulaOrRule: "ISO 8601 server-side verification",
            meaning: "Immutable log of authentication events."
          }
        ],
        proTips: [
          "Access is enforced at both the client navigation layer and the Express backend /api/access-logs endpoints."
        ]
      }
    ],
    []
  );

  const filteredTabs = useMemo(() => {
    if (!searchQuery.trim()) return tabGuides;
    const q = searchQuery.toLowerCase();
    return tabGuides.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.tagline.toLowerCase().includes(q) ||
        t.whatItDoes.toLowerCase().includes(q) ||
        t.badge.toLowerCase().includes(q) ||
        t.keyMetrics.some((m) => m.name.toLowerCase().includes(q) || m.meaning.toLowerCase().includes(q))
    );
  }, [tabGuides, searchQuery]);

  const activeTabDetails = useMemo(() => {
    return tabGuides.find((t) => t.id === selectedTabId) || tabGuides[0];
  }, [tabGuides, selectedTabId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden ring-1 ring-white/10">
        
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-inner">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white font-display">
                  StockRelated User Guide & Reference
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-mono font-semibold border border-blue-500/20">
                  Version 2.4
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Complete functional manual, tab directory, options formulas, and trading workflow
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Close User Guide (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Section Selector */}
        <div className="px-6 py-2.5 border-b border-slate-800/80 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            <button
              onClick={() => setSelectedSection("quick-start")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                selectedSection === "quick-start"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>3-Step Quick Start</span>
            </button>
            <button
              onClick={() => setSelectedSection("tabs")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                selectedSection === "tabs"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All 12 Tabs Explained</span>
            </button>
            <button
              onClick={() => setSelectedSection("formulas")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                selectedSection === "formulas"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Formulas & Greeks Cheat Sheet</span>
            </button>
            <button
              onClick={() => setSelectedSection("technicals-simple")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                selectedSection === "technicals-simple"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Simple Technicals (Kids & Beginners)</span>
            </button>
            <button
              onClick={() => setSelectedSection("faq")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                selectedSection === "faq"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>FAQ & Best Practices</span>
            </button>
          </div>

          {/* Search box (active across tabs, formulas, and technicals) */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tabs, RSI, SMA, IV, Greeks..."
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                const lower = val.toLowerCase();
                if (
                  lower.includes("rsi") ||
                  lower.includes("bollinger") ||
                  lower.includes("sma") ||
                  lower.includes("moving average") ||
                  lower.includes("macd") ||
                  lower.includes("volume") ||
                  lower.includes("support") ||
                  lower.includes("resistance")
                ) {
                  if (selectedSection !== "technicals-simple" && selectedSection !== "tabs") {
                    setSelectedSection("technicals-simple");
                  }
                } else if (
                  lower.includes("iv") ||
                  lower.includes("volatility") ||
                  lower.includes("greek") ||
                  lower.includes("delta") ||
                  lower.includes("theta") ||
                  lower.includes("gamma") ||
                  lower.includes("vega")
                ) {
                  if (selectedSection !== "formulas" && selectedSection !== "tabs") {
                    setSelectedSection("formulas");
                  }
                } else if (
                  selectedSection !== "tabs" &&
                  selectedSection !== "technicals-simple" &&
                  selectedSection !== "formulas"
                ) {
                  setSelectedSection("tabs");
                }
              }}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* SECTION 1: 3-STEP QUICK START */}
          {selectedSection === "quick-start" && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-500/30 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-display">
                    The StockRelated Core Strategy: High-Probability Cash-Secured Puts
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    StockRelated is engineered for investors who generate consistent cash flow by selling out-of-the-money 
                    Cash-Secured Puts (CSPs) on elite companies they would be happy to own at a discount. By collecting option 
                    premium while establishing a 10%–20% downside buffer, you turn mathematical probability into your primary edge.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Step 1 */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 relative group hover:border-slate-700 transition">
                  <div className="flex items-center justify-between">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                      1
                    </span>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold">
                      Watchlist Tab
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Curate Quality Assets</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Add profitable, cash-generative equities (e.g. Apple, Microsoft, Nvidia, Google) to your Watchlist. 
                    Never sell puts on low-quality, unprofitable penny stocks.
                  </p>
                  <button
                    onClick={() => {
                      onNavigateTab("watchlist");
                      onClose();
                    }}
                    className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <span>Go to Watchlist</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Step 2 */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 relative group hover:border-slate-700 transition">
                  <div className="flex items-center justify-between">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                      2
                    </span>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold">
                      Scanner & Recs
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Scan 15–45 DTE Contracts</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Open <strong className="text-slate-200">Put Recommendations</strong> or <strong className="text-slate-200">Put Scanner</strong>. 
                    Filter for Delta between <code className="text-cyan-400">-0.12 and -0.22</code>, Downside Cushion &gt;10%, and Annualized Return &gt;12%.
                  </p>
                  <button
                    onClick={() => {
                      onNavigateTab("put-recommendations");
                      onClose();
                    }}
                    className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <span>View Recommendations</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Step 3 */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 relative group hover:border-slate-700 transition">
                  <div className="flex items-center justify-between">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                      3
                    </span>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold">
                      Verify & Log
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Audit SEC & Save Trade</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Check the <strong className="text-slate-200">SEC Earnings</strong> tab to verify growing cash flow, verify support on <strong className="text-slate-200">Technicals</strong>, then hit <strong className="text-slate-200">Save Trade</strong> to track collateral.
                  </p>
                  <button
                    onClick={() => {
                      onNavigateTab("sec-earnings");
                      onClose();
                    }}
                    className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <span>Check SEC Earnings</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Golden Rules Banner */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4" />
                  <span>The 4 Golden Rules of Cash-Secured Put Selling</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>1. Always keep 100% cash backing:</strong> Never sell more puts than you can purchase in shares if assigned.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>2. Avoid binary earnings:</strong> Check the earnings flag; IV crush is profitable, but unexpected earnings drops can wipe out months of premium.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>3. Delta is your probability gauge:</strong> Selling a 0.15 Delta put means approximately an 85% probability of expiring safely out-of-the-money.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>4. Take profits early:</strong> When an option loses 75% to 80% of its initial value, close or roll it early to eliminate remaining tail risk.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: ALL 12 TABS EXPLAINED */}
          {selectedSection === "tabs" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left tab list selector */}
              <div className="lg:col-span-4 space-y-1.5 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700">
                <div className="text-[11px] font-mono uppercase text-slate-400 px-2 pb-1 font-semibold flex items-center justify-between">
                  <span>Directory ({filteredTabs.length})</span>
                  {searchQuery && <span className="text-blue-400 font-normal">Filtered</span>}
                </div>

                {filteredTabs.map((t) => {
                  const Icon = t.icon;
                  const isSelected = selectedTabId === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTabId(t.id)}
                      className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                        isSelected
                          ? "bg-blue-600/15 border-blue-500/50 text-white shadow-sm"
                          : "bg-slate-950/40 border-slate-800/80 text-slate-300 hover:bg-slate-800/60 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`p-1.5 rounded-lg shrink-0 ${
                            isSelected ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-bold truncate">{t.title}</div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">{t.badge}</div>
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 transition ${
                          isSelected ? "text-blue-400 translate-x-0.5" : "text-slate-600"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Right tab detail view */}
              <div className="lg:col-span-8 bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-5">
                {/* Header of selected tab */}
                <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md">
                      {React.createElement(activeTabDetails.icon, { className: "w-5 h-5" })}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white font-display">
                          {activeTabDetails.title}
                        </h3>
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700">
                          {activeTabDetails.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {activeTabDetails.tagline}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onNavigateTab(activeTabDetails.id);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                  >
                    <span>Open Tab</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* What it does */}
                <div>
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-400" />
                    <span>What It Does</span>
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {activeTabDetails.whatItDoes}
                  </p>
                </div>

                {/* How to use */}
                <div>
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Step-by-Step Trader Workflow</span>
                  </h4>
                  <div className="space-y-1.5">
                    {activeTabDetails.howToUse.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                        <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-400 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Key Metrics */}
                {activeTabDetails.keyMetrics && activeTabDetails.keyMetrics.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Key Metrics & Calculations</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {activeTabDetails.keyMetrics.map((m, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 space-y-1">
                          <div className="text-xs font-bold text-white">{m.name}</div>
                          <div className="text-[11px] font-mono text-cyan-400 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800">
                            {m.formulaOrRule}
                          </div>
                          <div className="text-[11px] text-slate-400 leading-snug">{m.meaning}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pro Tips */}
                {activeTabDetails.proTips && activeTabDetails.proTips.length > 0 && (
                  <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/20 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Pro Tips</span>
                    </div>
                    {activeTabDetails.proTips.map((tip, idx) => (
                      <p key={idx} className="text-xs text-slate-300 leading-relaxed">
                        • {tip}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION 3: FORMULAS & GREEKS CHEAT SHEET */}
          {selectedSection === "formulas" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Formula 1: OCC TIMS Margin */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white">OCC TIMS Margin Requirement</h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Clearing Standard
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 font-mono text-xs text-cyan-300 border border-slate-800">
                    Collateral = Option Market Value + Max(10% Strike - OTM Amount, 5% Strike)
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Used by the Options Clearing Corporation (OCC) and major brokers (Schwab, Fidelity, Interactive Brokers) 
                    to compute margin collateral on short put positions. For standard cash accounts, collateral equals 
                    100% of the Strike Price ($Strike \times 100$).
                  </p>
                </div>

                {/* Formula 2: Downside Cushion */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white">Downside Cushion (%)</h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Safety Buffer
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 font-mono text-xs text-emerald-300 border border-slate-800">
                    Cushion % = ((Stock Price - Strike Price) / Stock Price) × 100
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    The percentage distance the stock must crash before your put strike is breached. A 15% cushion 
                    means the underlying equity can fall 15% before your trade is at risk of assignment.
                  </p>
                </div>

                {/* Formula 3: Annualized Return on Capital (ARR) */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white">Annualized Return on Capital (ARR %)</h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Yield Metric
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 font-mono text-xs text-amber-300 border border-slate-800">
                    ARR % = (Option Premium / Strike Price) × (365 / DTE) × 100
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Normalizes returns across contracts with different durations. If selling a 30 DTE put earns 1.5% unannualized, 
                    the annualized return is approximately 18.25% ARR.
                  </p>
                </div>

                {/* Formula 4: Probability of Profit (POP) */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white">Probability of Profit (POP)</h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      Statistical Edge
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 font-mono text-xs text-purple-300 border border-slate-800">
                    POP ≈ 1 - |Delta| (e.g. 0.16 Delta ≈ 84% POP)
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Derived from Black-Scholes log-normal distribution. Shows the mathematical likelihood that the option 
                    expires fully out-of-the-money, retaining 100% of the initial premium collected.
                  </p>
                </div>
              </div>

              {/* The Option Greeks Summary Table */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-blue-400" />
                    <span>The 4 Option Greeks Explained for Put Sellers</span>
                  </h4>
                  <a
                    href="https://www.youtube.com/results?search_query=Option+Greeks+Explained+for+Beginners+ProjectOption"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Watch Greeks Video Guide</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-mono">
                        <th className="pb-2">Greek</th>
                        <th className="pb-2">Definition</th>
                        <th className="pb-2">Target for Put Sellers</th>
                        <th className="pb-2">Why It Matters</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      <tr>
                        <td className="py-2.5 font-bold text-cyan-400">Delta (Δ)</td>
                        <td className="py-2.5">Change in put price per $1 move in stock</td>
                        <td className="py-2.5 font-mono text-emerald-400">-0.12 to -0.22</td>
                        <td className="py-2.5 text-slate-400">Controls your win rate. Lower delta = higher win rate (~80-88% POP).</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-bold text-amber-400">Theta (Θ)</td>
                        <td className="py-2.5">Daily time decay collected by option seller</td>
                        <td className="py-2.5 font-mono text-emerald-400">Positive ($/day)</td>
                        <td className="py-2.5 text-slate-400">Your primary statistical engine. Accelerates under 30 DTE.</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-bold text-purple-400">Gamma (Γ)</td>
                        <td className="py-2.5">Rate of change in Delta per $1 stock move</td>
                        <td className="py-2.5 font-mono text-slate-300">Low (&lt; 0.05)</td>
                        <td className="py-2.5 text-slate-400">High gamma causes delta to swing violently near expiration.</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-bold text-indigo-400">Vega (ν)</td>
                        <td className="py-2.5">Price change per 1% move in Implied Volatility</td>
                        <td className="py-2.5 font-mono text-slate-300">Sell high, buy low</td>
                        <td className="py-2.5 text-slate-400">When IV collapses (IV crush), short puts instantly gain value.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Comprehensive Implied Volatility (IV) Deep Dive & Video Links */}
              <div className="p-5 rounded-xl bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950/40 border border-blue-500/30 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        What is Implied Volatility (IV)? The "Fear & Excitement" Meter
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        The single most powerful price driver in options trading — explained in plain English
                      </p>
                    </div>
                  </div>
                  <span className="self-start sm:self-auto text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Must-Know for Put Sellers
                  </span>
                </div>

                {/* Plain English / Kid-friendly Explanation */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <span>🌪️ The Hurricane Insurance Analogy</span>
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Imagine buying hurricane insurance in Florida. In clear, sunny February, insurance is cheap because nobody expects a storm. But if a Category 5 hurricane is forecast to hit tomorrow, insurance prices skyrocket!
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      <strong>That is Implied Volatility (IV).</strong> When the market is calm, IV is low and options are cheap. When earnings or panic hit, everyone scrambles to buy protection, driving option prices through the roof.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5">
                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <span>💰 Why Put Sellers LOVE High IV</span>
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      As an option seller, <strong>you are the insurance company</strong>. When IV is unusually high, buyers pay you inflated, fat premiums.
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Once the big event passes (earnings report or news), the panic evaporates overnight. This rapid collapse in option price is called <strong>IV Crush</strong>, allowing you to buy back the put for pennies or let it expire worthless!
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5">
                    <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <span>🔍 IV vs. Historical Volatility (HV)</span>
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong>Historical Volatility (HV)</strong> is the rear-view mirror: how much the stock actually bounced around over the past 30 or 90 days.
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      <strong>Implied Volatility (IV)</strong> looks out the front windshield: what traders expect the stock to do in the future, calculated backward from current option market prices using the Black-Scholes formula.
                    </p>
                  </div>
                </div>

                {/* Key IV Rules for Trading */}
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs text-slate-300 space-y-1.5">
                  <div className="font-semibold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>How to Use IV to Trade Puts Profitably:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
                    <li><strong className="text-slate-200">High IV (&gt;40% or IV Rank &gt; 50%)</strong>: Ideal time to sell cash-secured puts. You collect juicy yield and can afford to choose strikes 15%–20% below the current price.</li>
                    <li><strong className="text-slate-200">Low IV (&lt;20%)</strong>: Premiums are thin. Focus on index ETFs (like QQQ/SPY) or wait for a market dip before selling puts.</li>
                    <li><strong className="text-slate-200">Earnings IV Spike</strong>: IV always spikes right before earnings reports. While premiums are huge, the stock can gap 10%+. Prudent traders sell puts with 20%+ downside cushion or wait until after earnings to avoid binary surprises.</li>
                  </ul>
                </div>

                {/* Curated Video Learning Links */}
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-2.5">
                    <Video className="w-3.5 h-3.5 text-red-400" />
                    <span>Top Curated Video Tutorials on Implied Volatility & Greeks (Kid & Beginner Friendly)</span>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <a
                      href="https://www.youtube.com/results?search_query=Khan+Academy+Implied+volatility"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 flex items-center justify-between group transition"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                          <Play className="w-3 h-3 fill-current" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-white group-hover:text-blue-400 transition">
                            Khan Academy: Implied Volatility
                          </div>
                          <div className="text-[10px] text-slate-400">Clear 5-minute visual explanation</div>
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 shrink-0" />
                    </a>

                    <a
                      href="https://www.youtube.com/results?search_query=Why+Implied+Volatility+Changes+ProjectOption"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 flex items-center justify-between group transition"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                          <Play className="w-3 h-3 fill-current" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-white group-hover:text-blue-400 transition">
                            ProjectOption: Why IV Changes
                          </div>
                          <div className="text-[10px] text-slate-400">Essential guide for option sellers</div>
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 shrink-0" />
                    </a>

                    <a
                      href="https://www.youtube.com/results?search_query=Option+Greeks+Explained+for+Beginners+ProjectOption"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 flex items-center justify-between group transition"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                          <Play className="w-3 h-3 fill-current" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-white group-hover:text-blue-400 transition">
                            Option Greeks for Beginners
                          </div>
                          <div className="text-[10px] text-slate-400">Delta, Theta, Gamma, Vega in detail</div>
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 shrink-0" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: SUPER SIMPLE TECHNICAL TERMS (KIDS & BEGINNERS) */}
          {selectedSection === "technicals-simple" && (
            <div className="space-y-6">
              {/* Introduction Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-900/20 via-blue-900/20 to-purple-900/20 border border-amber-500/30 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
                    <span>Technical Analysis Explained in Super Simple Terms</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Kids & Beginners Welcome
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    You don't need a finance degree to read a stock chart! Below are the most important technical indicators — 
                    explained using everyday analogies like tired runners, bouncy rubber walls, and 3-lane highways — so anyone can understand 
                    and use them to time Cash-Secured Put trades with confidence.
                  </p>
                </div>
              </div>

              {/* 6 Core Simple Indicator Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. RSI */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 relative group hover:border-slate-700 transition">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider font-mono">
                      RSI (Relative Strength Index)
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                      🏃 "The Tired Runner Meter"
                    </span>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                    <strong className="text-white block font-medium">The Everyday Analogy:</strong>
                    <p className="text-slate-300 leading-relaxed">
                      Imagine a kid running as fast as they can up a hill. If they sprint too fast without stopping, they get completely exhausted and have to stop for water. If they trip and roll down the hill, they sit on the grass, catch their breath, and stand back up!
                    </p>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>RSI Scale: <strong>0 to 100</strong></span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-slate-400">
                      <li><strong className="text-red-400">Above 70 ("Overbought")</strong>: The runner is exhausted. Don't chase! Price is likely to pull back or rest.</li>
                      <li><strong className="text-slate-300">40 to 60 ("Neutral")</strong>: Cruising speed, normal price action.</li>
                      <li><strong className="text-emerald-400">Below 30 ("Oversold")</strong>: The runner is resting on the grass. The stock is having a flash sale!</li>
                    </ul>
                  </div>

                  <div className="p-2.5 rounded bg-blue-950/30 border border-blue-500/20 text-xs text-blue-200">
                    <strong>💡 How to use for Cash-Secured Puts:</strong> When a great stock (Apple, Nvidia) has an RSI below 30, everyone else is panicking. That is the ideal time to sell a put! Options premiums are huge, and the stock is statistically primed to bounce.
                  </div>

                  <a
                    href="https://www.youtube.com/results?search_query=RSI+Indicator+Explained+Simply+Rayner+Teo+Investopedia"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5 transition"
                  >
                    <Play className="w-3 h-3 text-red-400 fill-current" />
                    <span>Watch RSI Video Guide</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                </div>

                {/* 2. Bollinger Bands */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 relative group hover:border-slate-700 transition">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
                      Bollinger Bands
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      🛣️ "The Rubber Band Highway"
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                    <strong className="text-white block font-medium">The Everyday Analogy:</strong>
                    <p className="text-slate-300 leading-relaxed">
                      Imagine walking down a sidewalk with bouncy rubber walls on your left and right. 95% of the time, you walk calmly inside the lines. But if you stumble and crash into the bottom rubber wall, it stretches and flings you right back to the center of the sidewalk!
                    </p>
                  </div>

                  <div className="space-y-1 text-xs text-slate-400">
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong className="text-slate-200">Upper Band</strong>: The top rubber wall (+2 standard deviations). If price hits here, it's stretched too high.</li>
                      <li><strong className="text-slate-200">Middle Line</strong>: The calm center of the road (the 20-day moving average).</li>
                      <li><strong className="text-slate-200">Lower Band</strong>: The bottom trampoline (-2 standard deviations). Where price bounces back up.</li>
                    </ul>
                  </div>

                  <div className="p-2.5 rounded bg-amber-950/30 border border-amber-500/20 text-xs text-amber-200">
                    <strong>💡 How to use for Cash-Secured Puts:</strong> When a stock plunges and touches the Lower Bollinger Band, sell a put strike <em>below</em> that lower band. The rubber band bounce protects your strike from getting hit!
                  </div>

                  <a
                    href="https://www.youtube.com/results?search_query=Bollinger+Bands+Explained+for+Beginners"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5 transition"
                  >
                    <Play className="w-3 h-3 text-red-400 fill-current" />
                    <span>Watch Bollinger Bands Video Guide</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                </div>

                {/* 3. SMA */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 relative group hover:border-slate-700 transition">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono">
                      SMA (Simple Moving Averages)
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                      🚗 "The 3 Traffic Lanes & Floors"
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                    <strong className="text-white block font-medium">The Everyday Analogy:</strong>
                    <p className="text-slate-300 leading-relaxed">
                      Daily stock prices bounce around like a hyperactive puppy. A Simple Moving Average adds up the closing prices over 20, 50, or 200 days and draws a calm, smooth line showing the real direction of the trend.
                    </p>
                  </div>

                  <div className="space-y-1 text-xs text-slate-400">
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong className="text-emerald-300">20 SMA (1 Month)</strong>: The fast bicycle lane. Shows immediate short-term momentum.</li>
                      <li><strong className="text-blue-300">50 SMA (1 Quarter)</strong>: The institutional car highway. Giant mutual funds and banks buy dips right at the 50-day line.</li>
                      <li><strong className="text-amber-300">200 SMA (1 Year Bedrock)</strong>: The concrete foundation of the whole building. If price is above the 200 SMA, you are in a healthy Bull Market!</li>
                    </ul>
                  </div>

                  <div className="p-2.5 rounded bg-emerald-950/30 border border-emerald-500/20 text-xs text-emerald-200">
                    <strong>💡 How to use for Cash-Secured Puts:</strong> Always sell your put strike <em>underneath</em> the 50 SMA or 200 SMA. The moving average acts like a heavy concrete ceiling that stops the stock from falling down into your strike.
                  </div>

                  <a
                    href="https://www.youtube.com/results?search_query=Moving+Averages+SMA+20+50+200+Explained+for+Beginners"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5 transition"
                  >
                    <Play className="w-3 h-3 text-red-400 fill-current" />
                    <span>Watch Moving Averages Video Guide</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                </div>

                {/* 4. MACD */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 relative group hover:border-slate-700 transition">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-400 uppercase tracking-wider font-mono">
                      MACD (Moving Average Convergence Divergence)
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      🚦 "Gas Pedal & Brake Lights"
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                    <strong className="text-white block font-medium">The Everyday Analogy:</strong>
                    <p className="text-slate-300 leading-relaxed">
                      MACD tells you whether the driver is stomping on the gas pedal or slamming on the brakes. It shows if speed and momentum are speeding up or slowing down.
                    </p>
                  </div>

                  <div className="space-y-1 text-xs text-slate-400">
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong className="text-emerald-400">Growing Green Bars</strong>: The driver is stepping on the gas! Buyers are in full control and pushing prices up.</li>
                      <li><strong className="text-slate-300">Shrinking Green Bars</strong>: Foot is off the gas pedal; the car is coasting.</li>
                      <li><strong className="text-red-400">Red Bars</strong>: Brake lights are on! Sellers are dumping stock and driving prices down.</li>
                      <li><strong className="text-emerald-300">Shrinking Red Bars</strong>: Sellers are letting off the brakes — a bottom is forming!</li>
                    </ul>
                  </div>

                  <div className="p-2.5 rounded bg-purple-950/30 border border-purple-500/20 text-xs text-purple-200">
                    <strong>💡 How to use for Cash-Secured Puts:</strong> Never sell a put when tall red bars are expanding (the car is crashing). Wait until the red bars start shrinking and turn green before entering.
                  </div>

                  <a
                    href="https://www.youtube.com/results?search_query=MACD+Indicator+Explained+for+Beginners"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5 transition"
                  >
                    <Play className="w-3 h-3 text-red-400 fill-current" />
                    <span>Watch MACD Video Guide</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                </div>

                {/* 5. Support & Resistance */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 relative group hover:border-slate-700 transition">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wider font-mono">
                      Support & Resistance
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      🏠 "Floors & Ceilings"
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                    <strong className="text-white block font-medium">The Everyday Analogy:</strong>
                    <p className="text-slate-300 leading-relaxed">
                      <strong>Support is the wooden floor in your bedroom</strong>: when you bounce a basketball, it hits the floor and bounces back up. <strong>Resistance is the ceiling</strong>: when you let go of a helium balloon, it hits the ceiling and stops.
                    </p>
                  </div>

                  <div className="space-y-1 text-xs text-slate-400">
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong className="text-emerald-300">Support (The Floor)</strong>: A price level where buyers consistently step in with money to catch the stock from falling.</li>
                      <li><strong className="text-red-300">Resistance (The Ceiling)</strong>: A price level where sellers take profits and prevent the stock from rising higher.</li>
                    </ul>
                  </div>

                  <div className="p-2.5 rounded bg-blue-950/30 border border-blue-500/20 text-xs text-blue-200">
                    <strong>💡 How to use for Cash-Secured Puts:</strong> Find the strongest floor (Support) on the chart, and sell your put strike <em>safely beneath that floor</em>. Even if the stock drops and bounces on the floor, your strike is safely untouched downstairs!
                  </div>

                  <a
                    href="https://www.youtube.com/results?search_query=Support+and+Resistance+Explained+for+Beginners"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5 transition"
                  >
                    <Play className="w-3 h-3 text-red-400 fill-current" />
                    <span>Watch Support & Resistance Video</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                </div>

                {/* 6. Trading Volume */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 relative group hover:border-slate-700 transition">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider font-mono">
                      Trading Volume
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      🏟️ "The Crowd at the Stadium"
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                    <strong className="text-white block font-medium">The Everyday Analogy:</strong>
                    <p className="text-slate-300 leading-relaxed">
                      If 3 people clap in a park, nobody notices. But if 60,000 screaming fans roar at Levi's Stadium in Santa Clara, the whole ground shakes! Volume is the total number of shares traded that day.
                    </p>
                  </div>

                  <div className="space-y-1 text-xs text-slate-400">
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong className="text-indigo-300">High Volume Bar</strong>: Giant institutional investors (hedge funds, pension funds, Warren Buffett) are actively buying or selling millions of shares.</li>
                      <li><strong className="text-slate-400">Low Volume Bar</strong>: Only small retail traders are active. Price moves on low volume can easily fake you out.</li>
                    </ul>
                  </div>

                  <div className="p-2.5 rounded bg-indigo-950/30 border border-indigo-500/20 text-xs text-indigo-200">
                    <strong>💡 How to use for Cash-Secured Puts:</strong> Only trade options on stocks with massive daily volume (like QQQ, SPY, Apple, Nvidia). High volume guarantees tight bid-ask spreads (pennies apart), so brokers don't eat your profits.
                  </div>

                  <a
                    href="https://www.youtube.com/results?search_query=Stock+Volume+Analysis+for+Beginners"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5 transition"
                  >
                    <Play className="w-3 h-3 text-red-400 fill-current" />
                    <span>Watch Stock Volume Video Guide</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                </div>

              </div>
            </div>
          )}

          {/* SECTION 4: FAQ & BEST PRACTICES */}
          {selectedSection === "faq" && (
            <div className="space-y-3">
              {[
                {
                  q: "What exactly happens if a stock falls below my Put Strike price at expiration?",
                  a: "If the stock is below your strike price at 4:00 PM EST on the expiration date, the option will automatically be assigned. You will buy 100 shares of the stock per contract at your strike price. Because you kept the initial cash premium, your effective purchase cost basis is Strike Price minus Premium Collected. If it's a great company (like Apple or Nvidia), you now own shares at a substantial discount!"
                },
                {
                  q: "How does the Firebase Cloud Firestore database sync work?",
                  a: "When you sign in with Google (using muthu.vela@gmail.com or any authenticated account), your personal Watchlist and all Saved Trades are automatically synced with a persistent Google Cloud Firestore database. You can close your browser tab, open it on another device, and your data remains intact."
                },
                {
                  q: "When should I close a Cash-Secured Put before expiration?",
                  a: "A widely respected rule of thumb is the '80% Rule': if you sell a put for $2.00, and within 10 days the option drops in price to $0.40 (capturing 80% of maximum profit), buy to close the put! Holding the position for the remaining 20 days just to squeeze out the final $0.40 subjects your capital to needless tail risk. Close it and redeploy your cash elsewhere."
                },
                {
                  q: "Why does the app warn about upcoming Earnings dates?",
                  a: "Corporate earnings reports are binary events. A stock can gap down 15% overnight regardless of technical support. Unless you are intentionally trading earnings volatility with extra wide strikes, it is best practice to avoid selling puts that expire right across an earnings date."
                },
                {
                  q: "How does the 'Ask Dad' AI chat work in the Junior Investor Academy?",
                  a: "The Junior Investor Academy features a child-safe AI chat box powered by server-side Gemini. It is grounded with live Google and web search to answer questions directly in the persona of a tech-savvy Silicon Valley Dad, providing relatable analogies (Roblox, Pokémon cards, Apple Park) with strict filters against adult or gambling content."
                },
                {
                  q: "Who can access the 'Access Audit' tab?",
                  a: "The Access Audit tab is an administrative console strictly restricted to the superadmin account (muthu.vela@gmail.com). Non-admin users cannot view the tab or access the underlying /api/access-logs endpoints."
                }
              ].map((item, idx) => {
                const isOpenFaq = expandedFaq === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden transition"
                  >
                    <button
                      onClick={() => setExpandedFaq(isOpenFaq ? null : idx)}
                      className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-slate-900/60 transition cursor-pointer"
                    >
                      <span className="text-xs font-bold text-white flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-blue-400 shrink-0" />
                        <span>{item.q}</span>
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                          isOpenFaq ? "rotate-180 text-blue-400" : ""
                        }`}
                      />
                    </button>
                    {isOpenFaq && (
                      <div className="px-4 pb-4 pt-1 text-xs text-slate-300 leading-relaxed border-t border-slate-800/60 bg-slate-900/30">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Quantitative Options Analysis • OCC TIMS • SEC EDGAR XBRL</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onNavigateTab("options-scanner");
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition cursor-pointer"
            >
              Open Put Scanner
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md shadow-blue-600/20 transition cursor-pointer"
            >
              Done & Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
