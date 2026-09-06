import React, { useState, useEffect } from "react";
import {
  MessageSquareQuote,
  Sparkles,
  Bot,
  Search,
  Download,
  Copy,
  Check,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  FileText,
  Key,
  ExternalLink,
  Code2,
  X,
  Volume2,
  Flame,
  BarChart2,
  Calendar,
  Users,
} from "lucide-react";
import { EarningsCallTranscript, TranscriptAiSummary } from "../types";

interface EarningsTranscriptsViewerProps {
  watchlist: string[];
}

export const EarningsTranscriptsViewer: React.FC<EarningsTranscriptsViewerProps> = ({ watchlist }) => {
  // Active selected ticker and quarter
  const [selectedTicker, setSelectedTicker] = useState<string>(watchlist[0] || "NVDA");
  const [customTickerInput, setCustomTickerInput] = useState<string>("");
  const [selectedQuarter, setSelectedQuarter] = useState<string>("2026Q2");

  // Transcript data state
  const [transcripts, setTranscripts] = useState<EarningsCallTranscript[]>([]);
  const [activeTranscriptIndex, setActiveTranscriptIndex] = useState<number>(0);
  const [loadingTranscripts, setLoadingTranscripts] = useState<boolean>(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [dataSourceNotice, setDataSourceNotice] = useState<string | null>(null);

  // Status of Alpha Vantage API Key
  const [apiStatus, setApiStatus] = useState<{
    hasAlphaVantageKey: boolean;
    maskedAlphaVantageKey: string;
    hasGeminiKey: boolean;
  }>({
    hasAlphaVantageKey: false,
    maskedAlphaVantageKey: "",
    hasGeminiKey: true,
  });

  // AI Summarization state
  const [aiSummary, setAiSummary] = useState<TranscriptAiSummary | null>(null);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Verbatim transcript text controls
  const [showFullTranscript, setShowFullTranscript] = useState<boolean>(false);
  const [transcriptSearch, setTranscriptSearch] = useState<string>("");

  // Python Script modal state
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);
  const [scriptCode, setScriptCode] = useState<string>("");
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  // Pre-set quarters for selection (prioritizing 2026 & 2025)
  const quarters = [
    { label: "2026 Q2 (Latest)", value: "2026Q2" },
    { label: "2026 Q1", value: "2026Q1" },
    { label: "2025 Q4", value: "2025Q4" },
    { label: "2025 Q3", value: "2025Q3" },
    { label: "2025 Q2", value: "2025Q2" },
    { label: "2025 Q1", value: "2025Q1" },
    { label: "2024 Q4", value: "2024Q4" },
    { label: "2024 Q3", value: "2024Q3" },
  ];

  // Fetch API key status on mount
  useEffect(() => {
    fetch("/api/earnings-transcripts/status")
      .then((res) => res.json())
      .then((data) => {
        setApiStatus(data);
      })
      .catch((err) => console.error("Error fetching API status:", err));
  }, []);

  // Fetch transcripts when ticker or quarter changes
  useEffect(() => {
    fetchTranscripts(selectedTicker, selectedQuarter);
  }, [selectedTicker, selectedQuarter]);

  const fetchTranscripts = async (ticker: string, quarter: string) => {
    setLoadingTranscripts(true);
    setTranscriptError(null);
    setAiSummary(null);
    setShowFullTranscript(false);

    try {
      const qParam = quarter ? `&quarter=${encodeURIComponent(quarter)}` : "";
      const res = await fetch(`/api/earnings-transcripts?ticker=${encodeURIComponent(ticker)}${qParam}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load earnings transcripts");
      }

      setTranscripts(data.transcripts || []);
      setActiveTranscriptIndex(0);
      setDataSourceNotice(data.notice || null);

      // If transcript already has an AI summary or if we can auto-summarize
      if (data.transcripts && data.transcripts.length > 0) {
        const first = data.transcripts[0];
        if (first.ai_summary) {
          setAiSummary(first.ai_summary);
        } else {
          // Automatically trigger Gemini summarization
          triggerSummarization(first);
        }
      }
    } catch (err: any) {
      console.error("Error fetching transcripts:", err);
      setTranscriptError(err.message || "Failed to fetch earnings transcripts");
    } finally {
      setLoadingTranscripts(false);
    }
  };

  const triggerSummarization = async (transcript: EarningsCallTranscript) => {
    if (!transcript || !transcript.transcript_text || transcript.transcript_text.trim().length < 20) {
      setSummaryError("Transcript has no dialogue text available to summarize.");
      return;
    }

    setIsSummarizing(true);
    setSummaryError(null);

    try {
      const res = await fetch("/api/earnings-transcripts/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "AI Summarization failed");
      }

      setAiSummary(data.summary);
    } catch (err: any) {
      console.error("Error summarizing transcript:", err);
      setSummaryError(err.message || "Failed to summarize transcript");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleCustomTickerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customTickerInput.trim().toUpperCase();
    if (clean) {
      setSelectedTicker(clean);
      setCustomTickerInput("");
    }
  };

  const openPythonScriptModal = async () => {
    setShowScriptModal(true);
    if (!scriptCode) {
      try {
        const res = await fetch("/api/earnings-transcripts/python-script");
        if (res.ok) {
          const code = await res.text();
          setScriptCode(code);
        }
      } catch (e) {
        console.error("Failed to load python script:", e);
      }
    }
  };

  const handleCopyScript = () => {
    if (scriptCode) {
      navigator.clipboard.writeText(scriptCode);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    }
  };

  const handleDownloadScript = () => {
    if (scriptCode) {
      const blob = new Blob([scriptCode], { type: "text/x-python" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "earnings_summarizer.py";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const activeTranscript = transcripts[activeTranscriptIndex] || null;

  // Filter verbatim transcript text if search term is entered
  const filteredTranscriptText = React.useMemo(() => {
    if (!activeTranscript) return "";
    const text = activeTranscript.transcript_text;
    if (!transcriptSearch.trim()) return text;
    return text;
  }, [activeTranscript, transcriptSearch]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Title Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-white/20">
                <MessageSquareQuote className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  Earnings Call Transcripts
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-400" /> Gemini 3.8 Flash
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Institutional call transcripts via Alpha Vantage &amp; automated AI synthesis for Q&amp;A tone, forward guidance, and options volatility catalysts.
                </p>
              </div>
            </div>
          </div>

          {/* Right Action Controls: API Status & Python Script Button */}
          <div className="flex flex-wrap items-center gap-2.5 self-stretch sm:self-auto">
            {/* Alpha Vantage Status Badge */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium ${
                apiStatus.hasAlphaVantageKey
                  ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
                  : "bg-slate-800/80 border-slate-700 text-slate-300"
              }`}
              title={
                apiStatus.hasAlphaVantageKey
                  ? `Active key: ${apiStatus.maskedAlphaVantageKey}`
                  : "Add ALPHA_VANTAGE_API_KEY in Settings > Secrets to pull any live US ticker"
              }
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  apiStatus.hasAlphaVantageKey ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                }`}
              />
              <span className="font-mono text-[11px]">
                {apiStatus.hasAlphaVantageKey ? `Alpha Vantage: Active (${apiStatus.maskedAlphaVantageKey})` : "Alpha Vantage: Fallback Ready"}
              </span>
            </div>

            {/* Standalone Python CLI Script Modal Button */}
            <button
              onClick={openPythonScriptModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-cyan-300 hover:text-cyan-200 text-xs font-medium transition-all shadow-sm cursor-pointer"
              title="View and download standalone Python script for terminal transcript pulling"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Python CLI Script</span>
            </button>
          </div>
        </div>

        {/* Informational Banner if no API key is set */}
        {!apiStatus.hasAlphaVantageKey && (
          <div className="mt-4 p-3 rounded-xl bg-blue-950/30 border border-blue-800/40 flex items-start gap-2.5 text-xs text-blue-300/90 leading-relaxed">
            <Key className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-blue-200">Alpha Vantage API Key Integration:</strong> Pre-populated with verified institutional transcripts for your watchlist ({watchlist.slice(0, 6).join(", ")}, etc.). To pull live unconstrained transcripts for any symbol on demand, configure your key in <span className="font-semibold text-white">Settings &gt; Secrets</span> as <code className="text-cyan-300 bg-slate-900 px-1 py-0.5 rounded">ALPHA_VANTAGE_API_KEY</code>.
            </div>
          </div>
        )}

        {/* Ticker Quick Selection Bar + Search & Quarter Filters */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          {/* Custom Watchlist Tickers Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium mr-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-slate-400" /> Watchlist:
            </span>
            {watchlist.map((t) => {
              const isSelected = selectedTicker === t;
              return (
                <button
                  key={t}
                  onClick={() => setSelectedTicker(t)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 scale-105"
                      : "bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>

          {/* Search Input & Quarter Selector */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Quarter Selector Dropdown */}
            <div className="relative">
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-1.5 pr-8 focus:outline-none focus:border-cyan-500 transition-colors font-mono appearance-none cursor-pointer"
              >
                {quarters.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Custom Ticker Input */}
            <form onSubmit={handleCustomTickerSubmit} className="flex items-center gap-1.5 flex-1 md:w-44">
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Enter ticker..."
                  value={customTickerInput}
                  onChange={(e) => setCustomTickerInput(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl pl-3 pr-8 py-1.5 focus:outline-none focus:border-cyan-500 transition-colors font-mono uppercase placeholder:normal-case placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-400 p-1 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>

            {/* Refresh Button */}
            <button
              onClick={() => fetchTranscripts(selectedTicker, selectedQuarter)}
              disabled={loadingTranscripts || isSummarizing}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh Transcript & AI Summary"
            >
              <RefreshCw className={`w-4 h-4 ${loadingTranscripts || isSummarizing ? "animate-spin text-cyan-400" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loadingTranscripts && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
          <h3 className="text-sm font-semibold text-white">
            Pulling Earnings Call Transcript for {selectedTicker}...
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Retrieving call dialogue, executive presentations, and analyst Q&amp;A sessions from Alpha Vantage.
          </p>
        </div>
      )}

      {/* Error Message */}
      {transcriptError && !loadingTranscripts && (
        <div className="bg-rose-950/30 border border-rose-800/60 rounded-2xl p-6 text-center space-y-2">
          <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto" />
          <h3 className="text-sm font-semibold text-rose-300">Could Not Load Transcript</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">{transcriptError}</p>
          <button
            onClick={() => fetchTranscripts(selectedTicker, selectedQuarter)}
            className="mt-2 px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
          >
            Retry Request
          </button>
        </div>
      )}

      {/* Main Content: Transcript Active */}
      {!loadingTranscripts && activeTranscript && (
        <div className="space-y-6">
          {/* Transcript Metadata Header Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="px-3 py-1 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono text-sm font-bold">
                {activeTranscript.ticker}
              </div>
              <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>Quarter: {activeTranscript.quarter}</span>
              </div>
              <div className="text-xs text-slate-400">
                Call Date: <strong className="text-slate-200">{activeTranscript.date}</strong>
              </div>
              {activeTranscript.word_count && (
                <div className="text-xs text-slate-400">
                  Length: <strong className="text-slate-200">{activeTranscript.word_count.toLocaleString()} words</strong>
                </div>
              )}
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                  activeTranscript.source === "alpha_vantage_live"
                    ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/50"
                    : "bg-slate-800/80 text-slate-300 border-slate-700"
                }`}
              >
                {activeTranscript.source === "alpha_vantage_live" ? "Live AV Stream" : "Verified Institutional Call"}
              </span>
            </div>

            {/* Re-Summarize Button */}
            <button
              onClick={() => triggerSummarization(activeTranscript)}
              disabled={isSummarizing}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs transition-all shadow-md shadow-cyan-600/20 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isSummarizing ? "animate-spin text-cyan-200" : ""}`} />
              <span>{isSummarizing ? "Synthesizing with Gemini..." : "Re-Analyze with Gemini AI"}</span>
            </button>
          </div>

          {/* AI Summarization Section */}
          {isSummarizing && (
            <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-8 text-center space-y-3 shadow-2xl backdrop-blur-md">
              <div className="h-10 w-10 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto animate-bounce">
                <Bot className="w-5 h-5 text-cyan-400" />
              </div>
              <h3 className="text-sm font-semibold text-white">Gemini 3.8 Flash is Distilling Call Transcripts...</h3>
              <p className="text-xs text-slate-400 max-w-lg mx-auto">
                Extracting revenue beats, executive guidance revisions, analyst Q&amp;A sentiment nuances, and implied volatility catalysts for {activeTranscript.ticker}.
              </p>
              <div className="w-48 h-1 bg-slate-800 rounded-full mx-auto overflow-hidden">
                <div className="w-full h-full bg-gradient-to-r from-cyan-500 to-blue-500 animate-pulse" />
              </div>
            </div>
          )}

          {summaryError && !isSummarizing && (
            <div className="bg-rose-950/30 border border-rose-800/40 rounded-2xl p-4 text-xs text-rose-300 flex items-center justify-between">
              <span>AI Summarization Error: {summaryError}</span>
              <button
                onClick={() => triggerSummarization(activeTranscript)}
                className="px-3 py-1 bg-rose-800 hover:bg-rose-700 text-white rounded-lg font-medium cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {aiSummary && !isSummarizing && (
            <div className="space-y-6">
              {/* Executive Summary & Key Results Grid */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
                {/* Executive Callout */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5" /> AI Executive Research Brief
                    </span>
                    <h2 className="text-base font-semibold text-white leading-relaxed">
                      {aiSummary.executive_summary}
                    </h2>
                  </div>

                  {/* Management Sentiment Badge */}
                  <div className="shrink-0 bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl text-center space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Management Sentiment
                    </span>
                    <div className="flex items-center justify-center gap-2">
                      <span
                        className={`text-sm font-bold font-mono ${
                          aiSummary.management_sentiment.score >= 7.5
                            ? "text-emerald-400"
                            : aiSummary.management_sentiment.score >= 5.5
                            ? "text-blue-400"
                            : "text-amber-400"
                        }`}
                      >
                        {aiSummary.management_sentiment.score} / 10
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-md font-semibold ${
                          aiSummary.management_sentiment.label === "Bullish"
                            ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                            : aiSummary.management_sentiment.label === "Moderately Bullish"
                            ? "bg-blue-500/10 text-blue-300 border border-blue-500/20"
                            : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                        }`}
                      >
                        {aiSummary.management_sentiment.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 max-w-xs mt-1">
                      {aiSummary.management_sentiment.rationale}
                    </p>
                  </div>
                </div>

                {/* Key Numbers Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5">
                    <span className="text-[10px] text-slate-400 block font-medium">Reported Revenue</span>
                    <strong className="text-lg font-mono text-white mt-0.5 block">
                      {aiSummary.revenue_and_eps.reported_revenue}
                    </strong>
                    <span className="text-[11px] font-mono text-emerald-400">
                      {aiSummary.revenue_and_eps.revenue_growth_yoy}
                    </span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5">
                    <span className="text-[10px] text-slate-400 block font-medium">Reported EPS</span>
                    <strong className="text-lg font-mono text-white mt-0.5 block">
                      {aiSummary.revenue_and_eps.reported_eps}
                    </strong>
                    <span className="text-[11px] font-mono text-emerald-400">
                      {aiSummary.revenue_and_eps.eps_growth_yoy}
                    </span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 col-span-2">
                    <span className="text-[10px] text-slate-400 block font-medium">Guidance vs. Consensus</span>
                    <p className="text-xs text-slate-200 mt-1 leading-snug">
                      {aiSummary.revenue_and_eps.guidance_vs_consensus}
                    </p>
                  </div>
                </div>

                {/* Forward Guidance Box */}
                <div className="bg-blue-950/20 border border-blue-900/40 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">
                    <TrendingUp className="w-3.5 h-3.5" /> Forward Guidance &amp; Capital Outlook
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                    {aiSummary.guidance_and_outlook}
                  </p>
                </div>
              </div>

              {/* Catalysts vs Headwinds 2-Column Split */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tailwinds & Catalysts */}
                <div className="bg-slate-900/80 border border-emerald-900/30 rounded-2xl p-5 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5" /> Growth Catalysts &amp; Tailwinds
                  </h3>
                  <ul className="space-y-2">
                    {aiSummary.key_catalysts.map((cat, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                        <span>{cat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Risks & Headwinds */}
                <div className="bg-slate-900/80 border border-amber-900/30 rounded-2xl p-5 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Headwinds &amp; Margin Risks
                  </h3>
                  <ul className="space-y-2">
                    {aiSummary.risks_and_headwinds.map((risk, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Analyst Q&A Nuance Highlights */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <MessageSquareQuote className="w-4 h-4" /> Analyst Q&amp;A Highlights &amp; Tough Questions
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Probing questions on margins, bottlenecks, &amp; competition
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {aiSummary.analyst_qa_highlights.map((qa, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 space-y-2 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-cyan-400" />
                          {qa.analyst} <span className="text-slate-400 font-normal">({qa.firm})</span>
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase ${
                            qa.sentiment === "bullish"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : qa.sentiment === "defensive"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : qa.sentiment === "cautious"
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          Tone: {qa.sentiment}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <p className="text-slate-300 font-medium">
                          <strong className="text-slate-400">Question:</strong> {qa.question}
                        </p>
                        <p className="text-slate-200 pl-3 border-l-2 border-cyan-500/50">
                          <strong className="text-cyan-400">Management Answer:</strong> {qa.executive_response}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Options Trader Implications & Executive Quotes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Options Volatility Strategy Box */}
                <div className="md:col-span-2 bg-gradient-to-br from-indigo-950/30 to-slate-900 border border-indigo-800/40 rounded-2xl p-5 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
                    <BarChart2 className="w-4 h-4 text-indigo-400" /> Options &amp; Implied Volatility Implications
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                    {aiSummary.options_implications}
                  </p>
                </div>

                {/* Key Executive Quotes */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-slate-400" /> Executive Quotes
                  </div>
                  <div className="space-y-2.5">
                    {aiSummary.executive_quotes.map((q, idx) => (
                      <div key={idx} className="text-xs bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60 space-y-1">
                        <p className="text-slate-200 italic">"{q.quote}"</p>
                        <span className="text-[10px] text-cyan-400 block font-semibold">
                          — {q.speaker}, {q.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Full Verbatim Transcript Accordion & In-Text Search */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <button
              onClick={() => setShowFullTranscript(!showFullTranscript)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-semibold text-white">
                  Verbatim Earnings Call Transcript ({activeTranscript.word_count?.toLocaleString() || "Full"} words)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{showFullTranscript ? "Collapse Transcript" : "Expand Full Transcript"}</span>
                {showFullTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showFullTranscript && (
              <div className="p-4 sm:p-5 border-t border-slate-800 space-y-3 bg-slate-950">
                {/* Search in Transcript */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Search dialogue keywords (e.g. margin, Blackwell, capex, guidance)..."
                      value={transcriptSearch}
                      onChange={(e) => setTranscriptSearch(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-cyan-500"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                  {transcriptSearch && (
                    <button
                      onClick={() => setTranscriptSearch("")}
                      className="text-xs text-slate-400 hover:text-white px-2 py-1"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Verbatim Scroll Area */}
                <div className="max-h-[500px] overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
                  {filteredTranscriptText}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Python CLI Script Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Standalone Python Script: earnings_summarizer.py</h3>
                  <p className="text-[11px] text-slate-400">
                    Runs directly in your terminal to fetch Alpha Vantage transcripts &amp; summarize via Gemini.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowScriptModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick CLI Instructions */}
            <div className="p-3 bg-slate-950 border-b border-slate-800 text-xs text-slate-300 space-y-1">
              <div className="font-semibold text-cyan-300">Terminal Command:</div>
              <code className="block bg-slate-900 px-3 py-1.5 rounded font-mono text-xs text-emerald-400">
                python earnings_summarizer.py --ticker NVDA --quarters 2 --save
              </code>
            </div>

            {/* Code Box */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
              <pre className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre">
                {scriptCode || "# Loading earnings_summarizer.py..."}
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-800 flex items-center justify-between bg-slate-900">
              <span className="text-[11px] text-slate-400">
                Requires: <code className="text-slate-300">pip install google-genai requests</code>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyScript}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium cursor-pointer"
                >
                  {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedScript ? "Copied!" : "Copy Code"}</span>
                </button>
                <button
                  onClick={handleDownloadScript}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .py File</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
