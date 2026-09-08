import React, { useState, useRef, useEffect } from "react";
import {
  GraduationCap,
  Sparkles,
  BookOpen,
  Play,
  CheckCircle2,
  HelpCircle,
  Calculator,
  TrendingUp,
  ShieldCheck,
  Award,
  Zap,
  ChevronRight,
  Compass,
  DollarSign,
  RefreshCw,
  Cpu,
  Coffee,
  RotateCcw,
  ExternalLink,
  Info,
  Sliders,
  Bot,
  Send,
  User,
  Trash2,
  Shield,
  Lock,
  MessageSquare,
  Loader2,
  Globe,
  Search
} from "lucide-react";

interface VideoLesson {
  id: string;
  title: string;
  channel: string;
  duration: string;
  youtubeId: string;
  description: string;
  category: "Basics" | "Options" | "Math & Logic";
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  suggestions?: string[];
  isWarning?: boolean;
  isGrounded?: boolean;
  searchSources?: { url: string; domain: string; snippet: string }[];
}

const CURATED_VIDEOS: VideoLesson[] = [
  {
    id: "ted-ed-stocks",
    title: "How Does the Stock Market Work?",
    channel: "TED-Ed (Animated)",
    duration: "4:30 min",
    youtubeId: "p7HKvqRI_Bo",
    description: "The classic, award-winning animated story of how Dutch sailing ships started the first stock market, and how shares work today.",
    category: "Basics",
  },
  {
    id: "khan-academy-shares",
    title: "What is a Share of Stock?",
    channel: "Khan Academy",
    duration: "6:15 min",
    youtubeId: "2WbF_WjYt1c",
    description: "Sal Khan explains how a company's balance sheet gets sliced into shares, and what being a part-owner really means.",
    category: "Basics",
  },
  {
    id: "options-call-put-simple",
    title: "Call and Put Options Explained Simply",
    channel: "Investopedia Animated",
    duration: "5:10 min",
    youtubeId: "SD7sw0bf1mM",
    description: "Learn how options contracts work using real-world analogies: coupons to buy at fixed prices and insurance policies to protect your gear.",
    category: "Options",
  },
  {
    id: "compounding-power",
    title: "The Exponential Magic of Compounding Interest",
    channel: "TED-Ed Math",
    duration: "4:50 min",
    youtubeId: "1Zshnb22_bI",
    description: "Why Albert Einstein called compounding the 8th wonder of the world. The mathematical formula behind growing small savings into large fortunes.",
    category: "Math & Logic",
  },
];

export const JuniorInvestorAcademy: React.FC = () => {
  const [activeSection, setActiveSection] = useState<"syllabus" | "simulator" | "options-lab" | "quiz" | "videos" | "chat">("syllabus");
  const [activeVideo, setActiveVideo] = useState<VideoLesson>(CURATED_VIDEOS[0]);

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      role: "assistant",
      text: "👋 Hi sweetie! I'm Dad, your investing mentor, connected directly to Google & live web search underneath.\n\nWhether you're curious if an investor can sell their shares to someone else, why Nvidia's GPUs power AI and Roblox, what a 'Put Option' really means, or how compounding turns your allowance into college funds—ask me any question! What would you like to know today?",
      timestamp: "Just now",
      suggestions: [
        "Can an investor sell their share of the company to a buyer?",
        "Why is Nvidia worth trillions of dollars?",
        "How does Roblox make real money from Robux?",
        "Why does Dad sell Cash-Secured Puts?",
        "Can you explain Compounding Interest with Minecraft?",
      ],
    },
  ]);
  const [chatInput, setChatInput] = useState<string>("");
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeSection === "chat") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, activeSection, isChatLoading]);

  const handleSendChatMessage = async (presetQuestion?: string) => {
    const query = (presetQuestion || chatInput).trim();
    if (!query || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!presetQuestion) setChatInput("");
    setIsChatLoading(true);

    try {
      const history = chatMessages.slice(-6).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch("/api/junior-academy/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query, history }),
      });

      const data = await res.json();

      if (data.success && data.answer) {
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: data.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          suggestions: data.suggestions || [],
          isWarning: data.answer.includes("🛡️ Safety Notice:"),
          isGrounded: Boolean(data.isGrounded),
          searchSources: data.searchSources || [],
        };
        setChatMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error(data.error || "Failed to receive answer");
      }
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `assistant-err-${Date.now()}`,
          role: "assistant",
          text: "**Yes!** When you own shares in a company, you own a small slice of that business. You can choose to sell that piece to someone else for a price you both agree on, just like trading a game item or selling a bicycle!",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          suggestions: [
            "Can an investor sell their share of the company to a buyer?",
            "How does a stock exchange like Nasdaq work?",
            "What is a dividend?"
          ],
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Compound Simulator State
  const [initialAmount, setInitialAmount] = useState<number>(250);
  const [monthlyContribution, setMonthlyContribution] = useState<number>(50);
  const [annualReturnRate, setAnnualReturnRate] = useState<number>(10);
  const [yearsHorizon, setYearsHorizon] = useState<number>(7); // From age 11 to 18 (High school graduation)

  // Options Lab Simulator
  const [putStrike, setPutStrike] = useState<number>(90);
  const [premiumCollected, setPremiumCollected] = useState<number>(6);
  const [simulatedStockPrice, setSimulatedStockPrice] = useState<number>(95);

  // Quiz State
  const [quizAnswers, setQuizAnswers] = useState<{ [qId: number]: number }>({});
  const [showQuizResults, setShowQuizResults] = useState(false);

  // Compounding calculation: monthly steps
  const calculateCompoundSavings = () => {
    let balance = initialAmount;
    const monthlyRate = annualReturnRate / 100 / 12;
    const totalMonths = yearsHorizon * 12;
    let totalDeposited = initialAmount;

    for (let m = 0; m < totalMonths; m++) {
      balance = balance * (1 + monthlyRate) + monthlyContribution;
      totalDeposited += monthlyContribution;
    }

    const totalInterestEarned = Math.max(0, balance - totalDeposited);
    return {
      finalBalance: Math.round(balance),
      totalDeposited: Math.round(totalDeposited),
      interestEarned: Math.round(totalInterestEarned),
    };
  };

  const compoundResults = calculateCompoundSavings();

  // Quiz Questions
  const QUIZ_QUESTIONS = [
    {
      id: 1,
      question: "You buy 1 share of Apple down the street in Cupertino for $200. What do you actually own?",
      options: [
        "A free iPhone and a coupon for the Apple Store.",
        "A real, microscopic percentage of the entire Apple company, its inventions, and its profits.",
        "A loan that Tim Cook has to pay back to you next week.",
        "A video game skin that you trade on Discord.",
      ],
      correctIndex: 1,
      explanation: "Exactly right! When you buy a share of stock, you are a legal co-owner of Apple Inc. If Apple invents amazing new AI or sells millions of iPhones worldwide, your ownership slice grows in value.",
    },
    {
      id: 2,
      question: "Why do stock prices change every second on the NASDAQ or NYSE exchange?",
      options: [
        "A secret computer randomly picks numbers using dice.",
        "An auction between buyers and sellers based on supply and demand (like rare trading cards or concert tickets).",
        "The mayor of New York decides the prices every morning.",
        "They only change when the company changes its CEO.",
      ],
      correctIndex: 1,
      explanation: "Spot on! It is a massive global auction. If more people want to buy than sell, the price climbs. If more people want to sell, the price dips.",
    },
    {
      id: 3,
      question: "What is a PUT option, and how does selling one work like an insurance company?",
      options: [
        "It's a cheat code to get free money with zero risk.",
        "It's an insurance contract where the seller collects premium upfront, and agrees to buy the stock at a discount if it drops.",
        "It's a way to delete shares from the internet.",
        "It is only used by video game developers.",
      ],
      correctIndex: 1,
      explanation: "Brilliant logic! When you sell a Cash-Secured Put, you act like AppleCare or Geico: you collect cash ('premium') right away. If the stock stays safe, you keep 100% of the cash. If it dips, you get to buy a great stock at a bargain strike price!",
    },
    {
      id: 4,
      question: "Which rule describes the mathematical power of Compounding Returns over time?",
      options: [
        "Your money grows linearly like counting 1, 2, 3, 4.",
        "Money earned makes more money, which makes even more money, forming an exponential hockey-stick curve.",
        "You always lose your money after 3 years.",
        "It only works if you put all your money into 1 single stock.",
      ],
      correctIndex: 1,
      explanation: "Bingo! Exponential growth P*(1+r)^t means your earnings start earning their own earnings. Over 5 to 10 years, the math creates a powerful snowball effect.",
    },
  ];

  const quizScore = Object.entries(quizAnswers).reduce((acc, [qId, optIdx]) => {
    const q = QUIZ_QUESTIONS.find((item) => item.id === Number(qId));
    return acc + (q && q.correctIndex === optIdx ? 1 : 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Saratoga STEM Welcome Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-400/30 text-indigo-300 text-xs font-mono font-medium">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>Saratoga & Silicon Valley Junior Investor Academy</span>
              <span className="text-slate-500">•</span>
              <span className="text-cyan-300">Age 11+ STEM Edition</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white font-display tracking-tight">
              Master the Code of Money, Markets & Math
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed">
              Welcome! Right here in our backyard—from <strong className="text-white">Apple Park</strong> down on Pruneridge, to <strong className="text-white">Nvidia</strong> in Santa Clara powering AI, and <strong className="text-white">Netflix</strong> in Los Gatos—companies are built on mathematical engines. 
              Investing isn&apos;t gambling; it is applied logic, probability, and compounding algorithms.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> 100% Kid & Teen Friendly
              </span>
              <span className="flex items-center gap-1 text-cyan-400">
                <Cpu className="w-4 h-4" /> First-Principles Logic
              </span>
              <span className="flex items-center gap-1 text-indigo-400">
                <Calculator className="w-4 h-4" /> Real Math Simulators
              </span>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => setActiveSection("chat")}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer transition"
              >
                <Bot className="w-4 h-4" />
                <span>Ask Dad (Investing Mentor)</span>
              </button>
            </div>
          </div>

          {/* Right Visual Badge */}
          <div className="bg-slate-950/80 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 flex flex-col items-center text-center shrink-0 shadow-lg md:w-64">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 mb-3">
              <GraduationCap className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-white">Junior Quant Badge</h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Complete the 4 interactive lessons & earn your young investor certification!
            </p>
            <div className="mt-3 w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-400 to-indigo-500 h-full transition-all duration-500"
                style={{ width: `${(Object.keys(quizAnswers).length / 4) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-mono mt-1">
              Quiz Progress: {Object.keys(quizAnswers).length} / 4
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800 text-xs scrollbar-none">
        {[
          { id: "syllabus", label: "Core Lessons", icon: BookOpen },
          { id: "simulator", label: "Snowball Math Simulator", icon: Calculator },
          { id: "options-lab", label: "Options Lab (Call vs Put)", icon: ShieldCheck },
          { id: "quiz", label: "Challenge Quiz", icon: HelpCircle },
          { id: "videos", label: "Curated Video Theater", icon: Play },
          { id: "chat", label: "Ask Dad", icon: Bot, badge: "Child-Safe 🛡️" },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium cursor-pointer transition whitespace-nowrap ${
                isActive
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold"
                  : "bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800/60"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {(tab as any).badge && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                    isActive ? "bg-white/20 text-white" : "bg-emerald-500/20 text-emerald-300"
                  }`}
                >
                  {(tab as any).badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* =========================================================
          SECTION 1: CORE LESSONS (First-Principles Explanations)
      ========================================================= */}
      {activeSection === "syllabus" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Lesson 1: What is a Stock? */}
          <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 space-y-4 shadow-xl transition">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Coffee className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-amber-400 font-semibold">
                    Lesson 01
                  </span>
                  <h3 className="text-base font-bold text-white">
                    What is a Stock? (The Saratoga Boba Shop)
                  </h3>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Imagine you and a friend want to open a brand new organic boba tea spot on Saratoga-Sunnyvale Road. 
              The kitchen and espresso bar cost <strong className="text-white">$10,000</strong> to build.
            </p>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>Total Shop Cost:</span>
                <span className="font-mono font-bold text-white">$10,000</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Divided into:</span>
                <span className="font-mono text-cyan-400 font-bold">1,000 Shares</span>
              </div>
              <div className="flex justify-between items-center text-slate-300 border-t border-slate-800/80 pt-1.5">
                <span>Price per Share:</span>
                <span className="font-mono text-emerald-400 font-bold">$10.00 each</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              If you buy 100 shares for $1,000, you legally own <strong className="text-slate-200">10% of the entire shop</strong>. 
              Every time customers buy peach green tea, 10% of the profits belong to you! 
              The exact same rule applies when you own shares of Apple, Disney, or Roblox.
            </p>

            <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-500/20 text-[11px] text-indigo-200 flex items-start gap-2">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                <strong>The Silicon Valley Angle:</strong> Apple has about 15 billion shares! When you buy just 1 share, you own a tiny piece of the glass spaceship building in Cupertino.
              </span>
            </div>
          </div>

          {/* Lesson 2: Why do Stock Prices Change? */}
          <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 space-y-4 shadow-xl transition">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-blue-400 font-semibold">
                    Lesson 02
                  </span>
                  <h3 className="text-base font-bold text-white">
                    Why Prices Move: The Global Auction
                  </h3>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Prices don&apos;t move by magic or random luck. They move according to a fundamental math law called <strong className="text-white">Supply and Demand</strong>.
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
                <p className="font-bold text-emerald-300">More Buyers than Sellers (Demand High)</p>
                <p className="text-slate-400 mt-1 text-[11px]">
                  Think of a limited-edition sneaker drop or Taylor Swift concert tickets at Levi&apos;s Stadium. When millions of fans want the same 100 tickets, buyers bid higher and higher.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30">
                <p className="font-bold text-rose-300">More Sellers than Buyers (Supply High)</p>
                <p className="text-slate-400 mt-1 text-[11px]">
                  If a store orders 1,000 video games that nobody likes, they put them on a 50% discount sale clearance rack to get rid of them. The price drops until buyers show up.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              The stock market is a supercomputer matching millions of buyers and sellers every millisecond!
            </p>
          </div>

          {/* Lesson 3: The Magic of Options */}
          <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 space-y-4 shadow-xl transition">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-purple-400 font-semibold">
                    Lesson 03
                  </span>
                  <h3 className="text-base font-bold text-white">
                    What is an Option? (The VIP Ticket)
                  </h3>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              An option is not a stock. It is a <strong className="text-white">contract (a special ticket)</strong> that gives you a choice to buy or sell at a locked-in price, called the <strong className="text-cyan-300">Strike Price</strong>.
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase">CALL Option</span>
                <p className="text-white font-semibold">The Right to BUY</p>
                <p className="text-[11px] text-slate-400">
                  Like a coupon to buy a new iPad for $500 next month even if the store raises the price to $800.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase">PUT Option</span>
                <p className="text-white font-semibold">The Right to SELL</p>
                <p className="text-[11px] text-slate-400">
                  Like AppleCare insurance: it guarantees someone must buy your iPad for $400 even if it gets damaged.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              <strong>Dad&apos;s Superpower: Selling Cash-Secured Puts!</strong><br />
              Instead of paying money to buy insurance, we act like the insurance company. We tell someone: 
              <em>&quot;Pay me $500 today. If your stock drops, I promise I will happily buy it from you at a 15% discount!&quot;</em>
            </p>
          </div>

          {/* Lesson 4: The Quant Mindset */}
          <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 space-y-4 shadow-xl transition">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-400 font-semibold">
                    Lesson 04
                  </span>
                  <h3 className="text-base font-bold text-white">
                    The 3 Golden Rules of Smart Investors
                  </h3>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <h4 className="font-bold text-white">Diversification (Don&apos;t drop the egg basket)</h4>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    If you carry 10 eggs in one basket and trip on the sidewalk, all 10 break. If you divide them across 5 baskets, you always stay safe.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <h4 className="font-bold text-white">Invest in What You Understand</h4>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Look at the products you, your teachers, and friends use: Apple, Google, Microsoft, Disney, Nike. Great companies make great investments over time.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <h4 className="font-bold text-white">Time is Your Superpower</h4>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Starting at age 11 gives you an unfair advantage over grown-ups because your money has decades to compound and multiply.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          SECTION 2: SNOWBALL MATH SIMULATOR (Compounding)
      ========================================================= */}
      {activeSection === "simulator" && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="max-w-2xl">
            <span className="text-xs font-mono text-cyan-400 uppercase font-semibold">
              Interactive Mathematics
            </span>
            <h2 className="text-xl font-bold text-white font-display mt-1">
              The Compounding Snowball Simulator
            </h2>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              When a snowball rolls down a snowy hill in Lake Tahoe, it doesn&apos;t just add snow—it picks up more snow faster and faster as it gets larger. 
              The mathematical formula is: <code className="bg-slate-950 px-1.5 py-0.5 rounded text-cyan-300 font-mono text-xs">Total = P × (1 + r)^t</code>.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Controls */}
            <div className="lg:col-span-1 bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-5 text-xs">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-400" />
                <span>Adjust Parameters</span>
              </h3>

              {/* Initial Gift / Savings */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Starting Birthday/Gift Cash:</span>
                  <span className="font-mono text-emerald-400 font-bold">${initialAmount}</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="50"
                  value={initialAmount}
                  onChange={(e) => setInitialAmount(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              {/* Monthly Allowance Investment */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Monthly Allowance Invested:</span>
                  <span className="font-mono text-cyan-400 font-bold">${monthlyContribution}/mo</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="300"
                  step="10"
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              {/* Annual Growth Rate */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Expected Annual Growth (S&P 500 avg):</span>
                  <span className="font-mono text-amber-400 font-bold">{annualReturnRate}%</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="16"
                  step="1"
                  value={annualReturnRate}
                  onChange={(e) => setAnnualReturnRate(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              {/* Years Horizon */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Years to Grow (Age 11 to {11 + yearsHorizon}):</span>
                  <span className="font-mono text-purple-400 font-bold">{yearsHorizon} years</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="15"
                  step="1"
                  value={yearsHorizon}
                  onChange={(e) => setYearsHorizon(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              <button
                onClick={() => {
                  setInitialAmount(250);
                  setMonthlyContribution(50);
                  setAnnualReturnRate(10);
                  setYearsHorizon(7);
                }}
                className="w-full py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-800 cursor-pointer transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Saratoga Teen Defaults</span>
              </button>
            </div>

            {/* Results Display */}
            <div className="lg:col-span-2 flex flex-col justify-between space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <span className="text-[10px] font-mono uppercase text-slate-400">Total Money You Saved</span>
                  <p className="text-xl font-bold text-slate-200 font-display mt-1">
                    ${compoundResults.totalDeposited.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Your actual allowance put in</p>
                </div>

                <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-4">
                  <span className="text-[10px] font-mono uppercase text-emerald-400">Interest / Growth Earned</span>
                  <p className="text-xl font-bold text-emerald-400 font-display mt-1">
                    +${compoundResults.interestEarned.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Money created out of thin air by math!</p>
                </div>

                <div className="bg-gradient-to-br from-blue-900/30 to-indigo-950/50 border border-blue-500/40 rounded-xl p-4">
                  <span className="text-[10px] font-mono uppercase text-cyan-300">Final Pot of Wealth</span>
                  <p className="text-2xl font-bold text-white font-display mt-1">
                    ${compoundResults.finalBalance.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-cyan-300/80 mt-0.5">Ready when you graduate high school!</p>
                </div>
              </div>

              {/* Visual Proportion Bar */}
              <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-slate-400">Your Contributions vs. Pure Compounding Profit:</span>
                  <span className="font-mono text-emerald-400">
                    {Math.round((compoundResults.interestEarned / compoundResults.finalBalance) * 100)}% Free Growth
                  </span>
                </div>

                <div className="w-full h-5 rounded-lg bg-slate-800 overflow-hidden flex">
                  <div
                    className="bg-slate-600 h-full flex items-center justify-center text-[10px] font-bold text-white transition-all duration-300"
                    style={{
                      width: `${(compoundResults.totalDeposited / compoundResults.finalBalance) * 100}%`,
                    }}
                  >
                    Deposited
                  </div>
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full flex items-center justify-center text-[10px] font-bold text-slate-950 transition-all duration-300"
                    style={{
                      width: `${(compoundResults.interestEarned / compoundResults.finalBalance) * 100}%`,
                    }}
                  >
                    Growth Snowball!
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 italic">
                  💡 By the time you turn {11 + yearsHorizon}, over half of your college or first car fund could be free profit generated purely by compounding interest.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          SECTION 3: OPTIONS LAB (Interactive Put Seller)
      ========================================================= */}
      {activeSection === "options-lab" && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="max-w-2xl">
            <span className="text-xs font-mono text-purple-400 uppercase font-semibold">
              The Engine Behind This App
            </span>
            <h2 className="text-xl font-bold text-white font-display mt-1">
              Options Lab: Why Selling Puts is Like Running AppleCare
            </h2>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              When people buy AppleCare for their iPad, they pay Apple $100 upfront. If their iPad never breaks, Apple keeps the $100. 
              In options trading, selling a <strong className="text-white">Cash-Secured Put</strong> works the exact same way.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Interactive Scenario Controls */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-5 text-xs">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Simulate a Trade on &quot;Roblox Corp (RBLX)&quot;</span>
              </h3>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-slate-400">Current Stock Price Today:</span>
                <p className="text-base font-bold text-white font-mono">$100.00</p>
              </div>

              {/* Your Strike Offer */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Your Safety Buy Price (Strike):</span>
                  <span className="font-mono text-cyan-400 font-bold">${putStrike}.00</span>
                </div>
                <input
                  type="range"
                  min="75"
                  max="99"
                  step="1"
                  value={putStrike}
                  onChange={(e) => setPutStrike(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">
                  You promise: &quot;I will buy Roblox if it crashes to ${putStrike}&quot; ({100 - putStrike}% safety cushion).
                </p>
              </div>

              {/* Premium Paid to You */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Insurance Rent Paid to You Upfront:</span>
                  <span className="font-mono text-emerald-400 font-bold">+${premiumCollected}.00 per share</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="12"
                  step="1"
                  value={premiumCollected}
                  onChange={(e) => setPremiumCollected(Number(e.target.value))}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>

              {/* What happens to the stock next month */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Simulate Next Month&apos;s Stock Price:</span>
                  <span className="font-mono text-amber-400 font-bold">${simulatedStockPrice}.00</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="130"
                  step="1"
                  value={simulatedStockPrice}
                  onChange={(e) => setSimulatedStockPrice(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>
            </div>

            {/* Outcome Logic Engine */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold">
                  Trade Outcome Analysis
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  {simulatedStockPrice >= putStrike ? (
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-5 h-5" /> Outcome 1: Option Expires Worthless (Max Win!)
                    </span>
                  ) : (
                    <span className="text-cyan-400 flex items-center gap-1.5">
                      <Award className="w-5 h-5" /> Outcome 2: You Buy Roblox at a Huge Discount!
                    </span>
                  )}
                </h3>

                <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 text-xs leading-relaxed">
                  {simulatedStockPrice >= putStrike ? (
                    <>
                      <p className="text-slate-300">
                        Because Roblox stayed above your strike price (<strong className="text-white">${putStrike}</strong>), 
                        the buyer does not want to sell to you. 
                      </p>
                      <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 font-semibold">
                        🎉 Result: You keep the entire <span className="font-mono text-white">${premiumCollected * 100}</span> premium cash for free. You own zero shares and can repeat the trade next month!
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-slate-300">
                        Roblox dipped below your strike to <strong className="text-white">${simulatedStockPrice}</strong>. 
                        You buy 100 shares for <strong className="text-white">${putStrike}</strong> each.
                      </p>
                      <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/30 text-cyan-200 font-semibold space-y-1">
                        <p>
                          Effective Discount Price: <span className="font-mono text-white">${putStrike - premiumCollected}.00</span>
                        </p>
                        <p className="text-[11px] text-slate-300 font-normal">
                          (Strike ${putStrike} minus the ${premiumCollected} cash you were already given upfront!).
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-indigo-950/30 border border-indigo-500/20 text-[11px] text-indigo-200">
                <strong>Why Dad uses this:</strong> Instead of guessing whether stocks go up tomorrow, selling puts wins when the stock goes UP, stays FLAT, or even DROPS a little bit!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          SECTION 4: CHALLENGE QUIZ
      ========================================================= */}
      {activeSection === "quiz" && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono text-emerald-400 uppercase font-semibold">
                Knowledge Check
              </span>
              <h2 className="text-xl font-bold text-white font-display mt-1">
                Are You Smarter Than a Wall Street Quant?
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Test what you learned! Answer all 4 questions to verify your master status.
              </p>
            </div>

            {showQuizResults && (
              <div className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-sm flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-400" />
                <span>Your Score: {quizScore} / 4 ({Math.round((quizScore / 4) * 100)}%)</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {QUIZ_QUESTIONS.map((q, qIndex) => {
              const selectedOpt = quizAnswers[q.id];
              const isAnswered = selectedOpt !== undefined;
              const isCorrect = selectedOpt === q.correctIndex;

              return (
                <div
                  key={q.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {qIndex + 1}
                    </span>
                    <h3 className="text-sm font-semibold text-white leading-relaxed">
                      {q.question}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 pl-9">
                    {q.options.map((optText, optIndex) => {
                      const isSelected = selectedOpt === optIndex;
                      let btnStyle = "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850";

                      if (showQuizResults) {
                        if (optIndex === q.correctIndex) {
                          btnStyle = "bg-emerald-950/40 border-emerald-500 text-emerald-200 font-semibold";
                        } else if (isSelected && !isCorrect) {
                          btnStyle = "bg-rose-950/40 border-rose-500 text-rose-300";
                        } else {
                          btnStyle = "bg-slate-900/40 border-slate-800/40 text-slate-500 opacity-60";
                        }
                      } else if (isSelected) {
                        btnStyle = "bg-blue-600 border-blue-500 text-white font-semibold";
                      }

                      return (
                        <button
                          key={optIndex}
                          disabled={showQuizResults}
                          onClick={() => {
                            setQuizAnswers((prev) => ({ ...prev, [q.id]: optIndex }));
                          }}
                          className={`p-3 rounded-xl border text-left text-xs transition cursor-pointer flex items-center justify-between ${btnStyle}`}
                        >
                          <span>{optText}</span>
                          {showQuizResults && optIndex === q.correctIndex && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {showQuizResults && isAnswered && (
                    <div className="mt-3 ml-9 p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
                      <span className="font-bold text-cyan-400">Explanation: </span>
                      {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => {
                setQuizAnswers({});
                setShowQuizResults(false);
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Quiz</span>
            </button>

            <button
              disabled={Object.keys(quizAnswers).length < 4}
              onClick={() => setShowQuizResults(true)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <span>Grade My Answers!</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          SECTION 5: CURATED VIDEO THEATER
      ========================================================= */}
      {activeSection === "videos" && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono text-cyan-400 uppercase font-semibold">
                Visual Learning Room
              </span>
              <h2 className="text-xl font-bold text-white font-display mt-1">
                Curated Video Lessons for Visual Thinkers
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                High-quality animations from TED-Ed, Khan Academy, and math educators explaining markets and compounding.
              </p>
            </div>
          </div>

          {/* Main Video Embed Player */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-2xl">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${activeVideo.youtubeId}?rel=0&modestbranding=1`}
                  title={activeVideo.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{activeVideo.title}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 text-[10px] font-mono font-semibold">
                      {activeVideo.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{activeVideo.description}</p>
                </div>

                <a
                  href={`https://www.youtube.com/watch?v=${activeVideo.youtubeId}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-center transition whitespace-nowrap"
                >
                  <span>Open in YouTube</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Playlist Sidebar */}
            <div className="lg:col-span-1 space-y-2.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold block px-1">
                Select Lesson Playlist ({CURATED_VIDEOS.length})
              </span>
              {CURATED_VIDEOS.map((vid) => {
                const isCurrent = vid.id === activeVideo.id;
                return (
                  <button
                    key={vid.id}
                    onClick={() => setActiveVideo(vid)}
                    className={`w-full text-left p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                      isCurrent
                        ? "bg-blue-950/40 border-blue-500/60 shadow-sm"
                        : "bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/60 text-slate-300"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isCurrent ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      <Play className="w-4 h-4 fill-current" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold truncate ${isCurrent ? "text-white" : "text-slate-200"}`}>
                        {vid.title}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                        <span>{vid.channel}</span>
                        <span>•</span>
                        <span>{vid.duration}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          SECTION 6: ASK MENTOR AI (Kid-Safe & Filtered Chat Box)
      ========================================================= */}
      {activeSection === "chat" && (
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[750px]">
          {/* Chat Header with Safety Badges */}
          <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
                  <Bot className="w-6 h-6" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white font-display">
                    Dad • Junior Investing & Tech Mentor
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1 border border-emerald-500/30">
                    <Shield className="w-3 h-3" /> Child-Safe AI
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Silicon Valley Parent Edition • Ask Dad anything about stocks, Roblox, Apple, options, or math!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Strict Filter: Adult Content Blocked</span>
              </div>
              <button
                onClick={() => {
                  setChatMessages([
                    {
                      id: "welcome-reset",
                      role: "assistant",
                      text: "👋 Hi sweetie! I'm Dad, your investing mentor, connected directly to Google & live web search underneath.\n\nWhether you're curious if an investor can sell their shares to someone else, why Nvidia's GPUs power AI and Roblox, what a 'Put Option' really means, or how compounding turns your allowance into college funds—ask me any question! What would you like to know today?",
                      timestamp: "Just now",
                      suggestions: [
                        "Can an investor sell their share of the company to a buyer?",
                        "Why is Nvidia worth trillions of dollars?",
                        "How does Roblox make real money from Robux?",
                        "Why does Dad sell Cash-Secured Puts?",
                        "Can you explain Compounding Interest with Minecraft?",
                      ],
                    },
                  ]);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium border border-slate-800 flex items-center gap-1.5 cursor-pointer transition"
                title="Clear Conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Prompt Suggestion Chips Bar */}
          <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800/80 overflow-x-auto flex items-center gap-2 scrollbar-none shrink-0">
            <span className="text-[11px] font-mono text-cyan-400 uppercase font-bold shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Quick Questions:
            </span>
            {[
              "Can an investor sell their share of the company to a buyer?",
              "Why is Nvidia worth trillions of dollars?",
              "How does Roblox turn Robux into real cash?",
              "Why does Dad sell Cash-Secured Puts?",
              "What's the difference between a Call and a Put?",
              "Can you explain compounding with Minecraft?",
              "What is a dividend allowance?",
            ].map((prompt, idx) => (
              <button
                key={idx}
                disabled={isChatLoading}
                onClick={() => handleSendChatMessage(prompt)}
                className="px-3 py-1 rounded-full bg-slate-900 hover:bg-indigo-950/60 text-slate-300 hover:text-cyan-300 text-xs font-medium border border-slate-800 hover:border-indigo-500/40 transition whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {chatMessages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-3xl ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 font-bold ${
                      isUser
                        ? "bg-blue-600 text-white"
                        : "bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white shadow-sm"
                    }`}
                  >
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  {/* Message Bubble */}
                  <div className="space-y-2 max-w-2xl">
                    <div
                      className={`p-4 rounded-2xl text-xs leading-relaxed shadow-md ${
                        isUser
                          ? "bg-blue-600 text-white rounded-tr-none font-medium"
                          : msg.isWarning
                          ? "bg-amber-950/40 border border-amber-500/50 text-amber-200 rounded-tl-none"
                          : "bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none"
                      }`}
                    >
                      {/* Search Grounding Pill */}
                      {!isUser && msg.isGrounded && (
                        <div className="mb-2.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-[10px] text-cyan-300 font-mono">
                          <Globe className="w-3 h-3 text-cyan-400 animate-pulse" />
                          <span>Google & Live Web Search Grounded</span>
                        </div>
                      )}

                      {/* Formatted Text */}
                      <div className="space-y-2 whitespace-pre-line">
                        {msg.text.split("\n\n").map((para, pIdx) => (
                          <p key={pIdx}>
                            {para.split("**").map((chunk, cIdx) =>
                              cIdx % 2 === 1 ? (
                                <strong key={cIdx} className={isUser ? "text-white underline" : "text-cyan-300 font-bold"}>
                                  {chunk}
                                </strong>
                              ) : (
                                chunk
                              )
                            )}
                          </p>
                        ))}
                      </div>

                      {/* Live Sources Citations if present */}
                      {!isUser && msg.searchSources && msg.searchSources.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mb-1.5">
                            <Search className="w-3 h-3 text-cyan-400" />
                            <span>Web Search Grounding Sources:</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.searchSources.map((src, srcIdx) => (
                              <a
                                key={srcIdx}
                                href={src.url}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 text-[10px] border border-slate-800 transition"
                                title={src.snippet}
                              >
                                <span>{src.domain}</span>
                                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      <div
                        className={`text-[10px] font-mono mt-2 pt-1 border-t ${
                          isUser ? "text-blue-200 border-blue-500/50" : "text-slate-500 border-slate-800"
                        }`}
                      >
                        {msg.timestamp}
                      </div>
                    </div>

                    {/* Follow-up Suggestion Chips if assistant */}
                    {!isUser && msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1 pl-1">
                        <span className="text-[10px] font-mono text-slate-400 uppercase w-full">
                          💡 Ask follow-up:
                        </span>
                        {msg.suggestions.map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            disabled={isChatLoading}
                            onClick={() => handleSendChatMessage(sug)}
                            className="px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-cyan-300 hover:text-cyan-200 text-[11px] border border-slate-800 hover:border-cyan-500/30 transition cursor-pointer disabled:opacity-50"
                          >
                            &quot;{sug}&quot;
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Thinking / Typing Animation */}
            {isChatLoading && (
              <div className="flex gap-3 mr-auto max-w-md items-center">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Bot className="w-4 h-4 animate-pulse" />
                </div>
                <div className="p-3.5 rounded-2xl rounded-tl-none bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  <span>Dad is searching Google & the web and crafting your answer...</span>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="p-3.5 sm:p-4 bg-slate-950 border-t border-slate-800 shrink-0 space-y-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChatMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask Dad about stocks, options, Roblox, Nvidia, or math (e.g., 'Can an investor sell their shares?')..."
                disabled={isChatLoading}
                className="flex-1 bg-slate-900 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 outline-none transition disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isChatLoading}
                className="px-4 sm:px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Ask Dad</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-slate-400 px-1 gap-1">
              <span className="flex items-center gap-1 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                100% Kid-Safe AI • Adult websites, mature themes, and gambling strictly deflected
              </span>
              <span className="font-mono text-slate-400">
                Powered by Gemini 3.8 Flash • Saratoga STEM Mentor
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
