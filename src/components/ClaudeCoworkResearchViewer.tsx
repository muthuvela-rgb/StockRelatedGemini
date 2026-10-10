import React, { useState, useEffect } from "react";
import {
  Bot,
  Sparkles,
  Copy,
  Check,
  Search,
  Filter,
  Trash2,
  ExternalLink,
  Code,
  Plus,
  RefreshCw,
  FileText,
  Terminal,
  HelpCircle,
  CheckCircle,
  AlertCircle,
  X,
  Layers,
  Globe,
  Share2,
  ChevronDown,
  ChevronUp,
  Bookmark,
  ShieldCheck,
  Send,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { SUPERADMIN_EMAIL } from "../lib/firebase";

export interface ResearchItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  tickers: string[];
  tags: string[];
  source: string;
  author: string;
  format?: "html" | "markdown" | "text" | string;
  contentType?: string;
  payload?: any;
  createdAt: string;
  updatedAt: string;
}

export const ResearchContentRenderer: React.FC<{
  content: string;
  format?: string;
  isExpanded: boolean;
}> = ({ content, format, isExpanded }) => {
  const isHtml =
    format === "html" ||
    /<[a-z][\s\S]*>/i.test(content || "") ||
    (content || "").includes("<table") ||
    (content || "").includes("<div") ||
    (content || "").includes("<p") ||
    (content || "").includes("<tr");

  if (isHtml) {
    return (
      <div
        className={`research-html-container overflow-x-auto text-xs text-slate-200 leading-relaxed font-sans p-4 bg-slate-950/80 border border-slate-800 rounded-xl transition-all ${
          isExpanded ? "max-h-[850px] overflow-y-auto" : "max-h-[300px] overflow-hidden relative"
        }`}
      >
        <div dangerouslySetInnerHTML={{ __html: content }} />
        {!isExpanded && (
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent pointer-events-none" />
        )}
      </div>
    );
  }

  return (
    <div
      className={`p-4 bg-slate-950/80 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-200 leading-relaxed whitespace-pre-line relative ${
        isExpanded ? "max-h-[600px] overflow-y-auto" : "max-h-[160px] overflow-hidden"
      }`}
    >
      {content}
      {!isExpanded && (
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none" />
      )}
    </div>
  );
};

export const ClaudeCoworkResearchViewer: React.FC = () => {
  const { user, createWatchlist } = useAuth();
  const [researchList, setResearchList] = useState<ResearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTickerFilter, setSelectedTickerFilter] = useState<string>("ALL");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("ALL");

  // Copy states
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedReportId, setCopiedReportId] = useState<string | null>(null);

  // Modals & Panels
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [showTestPostModal, setShowTestPostModal] = useState(false);
  const [selectedRawPayload, setSelectedRawPayload] = useState<ResearchItem | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Test Post Form State
  const [testTitle, setTestTitle] = useState("TSLA & NVDA Options Volatility & Surface Analysis");
  const [testSummary, setTestSummary] = useState("Key insights on TSLA upcoming earnings and NVDA Blackwell datacenter demand signals.");
  const [testContent, setTestContent] = useState(`# TSLA & NVDA Institutional Options Volatility & Surface Skew Analysis

**Agent:** Claude Cowork Market Research Assistant  
**Target Equities:** TSLA, NVDA, QQQ  

### Executive Summary
Recent options flow highlights a strong institutional bullish bias on **NVDA** with heightened call volume on 125/130 strike calls. Simultaneously, **TSLA** option skew indicates elevated downside protection pricing ahead of delivery announcements.

### Actionable Strategy Recommendation
* **Cash-Secured Put Strategy:** Sell TSLA $210 Puts with 30-45 DTE to lock in rich theta decay while buffer is above 15%.
* **Overlaid Stock Chart:** Overlay NVDA and TSLA against QQQ to confirm technical momentum before entering positions.`);
  const [testTickers, setTestTickers] = useState("TSLA, NVDA, QQQ");
  const [testTags, setTestTags] = useState("Options Flow, Vol Skew, Institutional");
  const [testAuthor, setTestAuthor] = useState("Claude Cowork");
  const [testSecretKey, setTestSecretKey] = useState("claude_cowork_secret_93942aad");
  const [isSubmittingTest, setIsSubmittingTest] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  const webhookUrl = `${window.location.protocol}//${window.location.host}/api/webhook/claude-cowork`;
  const defaultSecretKey = "claude_cowork_secret_93942aad";

  const fetchResearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/webhook/claude-cowork");
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setResearchList(data.research || []);
    } catch (err: any) {
      console.error("Error loading Claude Cowork research:", err);
      setError("Failed to fetch published research reports. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResearch();
  }, []);

  const handleCopy = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const handleCopyReport = (report: ResearchItem) => {
    const textToCopy = `# ${report.title}\n\n**Author:** ${report.author} | **Source:** ${report.source} | **Date:** ${new Date(report.createdAt).toLocaleString()}\n**Tickers:** ${report.tickers.join(", ")}\n\n---\n\n${report.content}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedReportId(report.id);
    setTimeout(() => setCopiedReportId(null), 2000);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this research report from the feed?")) return;
    try {
      const res = await fetch(`/api/webhook/claude-cowork/${id}`, { method: "DELETE" });
      if (res.ok) {
        setResearchList((prev) => prev.filter((item) => item.id !== id));
      } else {
        alert("Failed to delete record.");
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleImportTickersToWatchlist = async (tickers: string[], title: string) => {
    if (!tickers || tickers.length === 0) return;
    try {
      await createWatchlist(`Claude Research (${title.slice(0, 18)}...)`, tickers, true);
      alert(`Created new watchlist with ${tickers.length} tickers: ${tickers.join(", ")}`);
    } catch (err: any) {
      alert(`Failed to create watchlist: ${err?.message || err}`);
    }
  };

  const handleSendTestWebhook = async () => {
    setIsSubmittingTest(true);
    setTestStatus(null);
    try {
      const cleanTickers = testTickers.split(/[\s,]+/).map((t) => t.trim().toUpperCase()).filter(Boolean);
      const cleanTags = testTags.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);

      const res = await fetch("/api/webhook/claude-cowork", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": testSecretKey,
        },
        body: JSON.stringify({
          title: testTitle,
          summary: testSummary,
          content: testContent,
          tickers: cleanTickers,
          tags: cleanTags,
          author: testAuthor,
          source: "Manual UI Test / Webhook Simulator",
          payload: {
            simulatedBy: user?.email || "Guest User",
            clientTimestamp: new Date().toISOString(),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Webhook request failed");

      setTestStatus("✅ Research post successfully published to tab!");
      fetchResearch();
      setTimeout(() => {
        setShowTestPostModal(false);
        setTestStatus(null);
      }, 1500);
    } catch (err: any) {
      setTestStatus(`⚠️ Error: ${err?.message || "Failed to post webhook payload"}`);
    } finally {
      setIsSubmittingTest(false);
    }
  };

  const isSuperAdmin = Boolean(
    user?.email && user.email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()
  );

  // Extract all unique tickers & tags for filter buttons
  const allTickers = Array.from(
    new Set(researchList.flatMap((r) => r.tickers || []))
  ).sort();
  const allTags = Array.from(
    new Set(researchList.flatMap((r) => r.tags || []))
  ).sort();

  // Filter research list
  const filteredList = researchList.filter((item) => {
    const matchesSearch =
      !searchQuery.trim() ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tickers.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTicker =
      selectedTickerFilter === "ALL" ||
      item.tickers.includes(selectedTickerFilter);

    const matchesTag =
      selectedTagFilter === "ALL" ||
      item.tags.includes(selectedTagFilter);

    return matchesSearch && matchesTicker && matchesTag;
  });

  const promptTemplateForClaude = `Please analyze the market data / options flow for [TSLA and NVDA]. When done, publish your research report directly to my trading webapp tab by executing an HTTP POST request:

URL: ${webhookUrl}
Headers:
  Content-Type: application/json
  x-api-key: ${defaultSecretKey}

JSON Payload:
{
  "title": "[Short descriptive report title]",
  "summary": "[1-2 sentence executive summary]",
  "content": "[Full detailed markdown report with analysis, key levels, and option trade setups]",
  "tickers": ["TSLA", "NVDA"],
  "tags": ["Options Flow", "Vol Surface", "Macro"],
  "author": "Claude Cowork Assistant"
}`;

  return (
    <div className="flex-1 w-full mx-auto px-4 sm:px-8 lg:px-12 py-6 space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20 ring-1 ring-white/10 shrink-0">
                <Bot className="w-5.5 h-5.5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white font-display tracking-tight flex items-center gap-2">
                  <span>Research from Claude Cowork</span>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30">
                    Inbound Webhook
                  </span>
                </h1>
                <p className="text-xs text-slate-400">
                  Real-time market analysis, option flow reports, and macro digests automatically posted by Claude Cowork or external AI agents.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowInstructionsModal(true)}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold cursor-pointer transition flex items-center gap-2 shadow-md hover:border-purple-500/50"
            >
              <Terminal className="w-4 h-4 text-purple-400" />
              <span>Instruct Claude Cowork</span>
            </button>

            <button
              onClick={() => setShowTestPostModal(true)}
              className="px-3.5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer transition flex items-center gap-2 shadow-lg shadow-purple-900/30 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Publish Test Report</span>
            </button>

            <button
              onClick={fetchResearch}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs cursor-pointer transition"
              title="Refresh Research Feed"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-purple-400" : ""}`} />
            </button>
          </div>
        </div>

        {/* Credentials & Webhook Endpoint Ribbon */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {/* Endpoint URL Box */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block font-mono">
                Inbound Webhook Endpoint URL
              </span>
              <span className="text-slate-300 font-mono text-[11px] truncate block font-medium">
                {webhookUrl}
              </span>
            </div>
            <button
              onClick={() => handleCopy(webhookUrl, setCopiedUrl)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition shrink-0 cursor-pointer border border-slate-700"
              title="Copy Webhook Endpoint URL"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Secret Key Box */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block font-mono">
                Authentication Key Header (<code className="text-purple-400">x-api-key</code>)
              </span>
              <span className="text-purple-300 font-mono text-[11px] truncate block font-semibold">
                {defaultSecretKey}
              </span>
            </div>
            <button
              onClick={() => handleCopy(defaultSecretKey, setCopiedSecret)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition shrink-0 cursor-pointer border border-slate-700"
              title="Copy Secret Key"
            >
              {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports by title, ticker, analysis content, or author..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                Clear
              </button>
            )}
          </div>

          <div className="text-xs text-slate-400 font-mono shrink-0">
            Showing <span className="text-purple-300 font-bold">{filteredList.length}</span> of {researchList.length} reports
          </div>
        </div>

        {/* Ticker & Tag Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/60 text-xs">
          <span className="text-slate-400 font-semibold flex items-center gap-1 mr-1 text-[11px]">
            <Filter className="w-3 h-3 text-purple-400" />
            <span>Ticker:</span>
          </span>
          <button
            onClick={() => setSelectedTickerFilter("ALL")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono transition cursor-pointer ${
              selectedTickerFilter === "ALL"
                ? "bg-purple-600 text-white shadow-md shadow-purple-900/30"
                : "bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            ALL TICKERS
          </button>
          {allTickers.map((ticker) => (
            <button
              key={ticker}
              onClick={() => setSelectedTickerFilter(ticker)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono transition cursor-pointer ${
                selectedTickerFilter === ticker
                  ? "bg-purple-600 text-white shadow-md shadow-purple-900/30"
                  : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white"
              }`}
            >
              {ticker}
            </button>
          ))}

          {allTags.length > 0 && (
            <>
              <span className="text-slate-500 mx-1">|</span>
              <span className="text-slate-400 font-semibold text-[11px]">Tag:</span>
              <button
                onClick={() => setSelectedTagFilter("ALL")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono transition cursor-pointer ${
                  selectedTagFilter === "ALL"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/30"
                    : "bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                ALL TAGS
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTagFilter(tag)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    selectedTagFilter === tag
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/30"
                      : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Main Content Area: Feed of Published Research */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3 shadow-xl">
          <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-white">Loading published research from Claude Cowork...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-950/30 border border-rose-800/50 rounded-2xl p-6 text-center text-rose-300 space-y-2 shadow-xl">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <p className="text-sm font-bold">{error}</p>
          <button
            onClick={fetchResearch}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold cursor-pointer transition inline-block mt-2"
          >
            Retry Loading
          </button>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4 shadow-xl">
          <Bot className="w-12 h-12 text-purple-400/50 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-white">No research reports match your query</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {searchQuery || selectedTickerFilter !== "ALL" || selectedTagFilter !== "ALL"
                ? "Try adjusting your filters or search keywords."
                : "No research posts have been published yet. Instruct Claude Cowork or click 'Publish Test Report' to add one."}
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedTickerFilter("ALL");
                setSelectedTagFilter("ALL");
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition"
            >
              Reset Filters
            </button>
            <button
              onClick={() => setShowInstructionsModal(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold cursor-pointer transition"
            >
              View Instructions
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredList.map((item) => {
            const isExpanded = expandedCardId === item.id;
            return (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 sm:p-6 shadow-xl transition space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase font-mono border border-purple-500/30 flex items-center gap-1">
                        <Bot className="w-3 h-3 text-purple-400" />
                        <span>{item.author || "Claude Cowork"}</span>
                      </span>
                      <span className="text-slate-500 text-xs">•</span>
                      <span className="text-xs text-slate-400 font-mono">
                        {new Date(item.createdAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>

                    <h2 className="text-base sm:text-lg font-bold text-white font-display leading-tight">
                      {item.title}
                    </h2>
                  </div>

                  {/* Top Right Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleCopyReport(item)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium cursor-pointer transition border border-slate-700 flex items-center gap-1.5"
                      title="Copy full report as Markdown"
                    >
                      {copiedReportId === item.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Markdown</span>
                        </>
                      )}
                    </button>

                    {item.payload && (
                      <button
                        onClick={() => setSelectedRawPayload(item)}
                        className="px-2.5 py-1.5 bg-purple-950/40 hover:bg-purple-900/40 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-medium cursor-pointer transition flex items-center gap-1"
                        title="Inspect Raw JSON Payload"
                      >
                        <Code className="w-3.5 h-3.5 text-purple-400" />
                        <span>Raw JSON</span>
                      </button>
                    )}

                    {isSuperAdmin && (
                      <button
                        onClick={(e) => handleDelete(item.id, e)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                        title="Delete research report"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Tickers & Tags Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.tickers && item.tickers.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400 font-semibold">Equities:</span>
                        {item.tickers.map((ticker) => (
                          <span
                            key={ticker}
                            className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-mono font-bold"
                          >
                            {ticker}
                          </span>
                        ))}
                      </div>
                    )}

                    {item.tags && item.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 ml-2">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-medium"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {item.tickers && item.tickers.length > 0 && (
                    <button
                      onClick={() => handleImportTickersToWatchlist(item.tickers, item.title)}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Watchlist with Tickers</span>
                    </button>
                  )}
                </div>

                {/* Summary Box */}
                {item.summary && (
                  <div className="p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl text-xs text-purple-200 leading-relaxed font-sans">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-purple-400 block mb-0.5 font-mono">
                      Executive Summary:
                    </span>
                    {item.summary}
                  </div>
                )}

                {/* Content Body (Collapsible / Formatted HTML or Markdown) */}
                <div className="text-xs text-slate-300 leading-relaxed font-sans space-y-2 pt-1">
                  <ResearchContentRenderer
                    content={item.content}
                    format={item.format}
                    isExpanded={isExpanded}
                  />

                  <button
                    onClick={() => setExpandedCardId(isExpanded ? null : item.id)}
                    className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer pt-1"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        <span>Collapse Report View</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        <span>Read Full Report</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- INSTRUCTIONS MODAL: HOW TO INSTRUCT CLAUDE COWORK --- */}
      {showInstructionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-display">
                    How to Instruct Claude Cowork
                  </h3>
                  <p className="text-xs text-slate-400">
                    Copy and paste the prompt below into Claude Cowork or any external AI agent.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInstructionsModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Prompt Template Box */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 font-mono">
                  📋 Ready-to-use Prompt for Claude Cowork
                </span>
                <button
                  onClick={() => handleCopy(promptTemplateForClaude, setCopiedPrompt)}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  {copiedPrompt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPrompt ? "Copied Prompt!" : "Copy Full Prompt"}</span>
                </button>
              </div>

              <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs text-purple-200 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto select-all">
                {promptTemplateForClaude}
              </pre>
            </div>

            {/* Step-by-Step Explanation */}
            <div className="space-y-2 pt-2 border-t border-slate-800 text-xs text-slate-300">
              <h4 className="font-bold text-white font-display flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>How the Integration Works</span>
              </h4>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-400 leading-relaxed">
                <li>
                  <strong className="text-slate-200">Copy the prompt above</strong> and open your Claude Cowork workspace or Python/Curl script.
                </li>
                <li>
                  Claude Cowork will research options flow, implied volatility, or macro data for your requested tickers.
                </li>
                <li>
                  When finished, Claude Cowork issues an HTTP POST payload with header <code className="text-purple-300 font-mono">x-api-key: {defaultSecretKey}</code>.
                </li>
                <li>
                  The report instantly appears in this tab and stays stored permanently for all team members.
                </li>
              </ol>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowInstructionsModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold cursor-pointer transition"
              >
                Close Instructions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- TEST WEBHOOK MODAL --- */}
      {showTestPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-display">
                    Simulate Webhook Payload
                  </h3>
                  <p className="text-xs text-slate-400">
                    Test posting a research report directly to the Inbound Webhook API.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTestPostModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Header Secret Key (<code className="text-purple-400">x-api-key</code>)
                </label>
                <input
                  type="text"
                  value={testSecretKey}
                  onChange={(e) => setTestSecretKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-purple-300 font-mono outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Report Title</label>
                <input
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tickers (comma separated)</label>
                  <input
                    type="text"
                    value={testTickers}
                    onChange={(e) => setTestTickers(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono uppercase outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={testTags}
                    onChange={(e) => setTestTags(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Executive Summary</label>
                <input
                  type="text"
                  value={testSummary}
                  onChange={(e) => setTestSummary(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Detailed Content Body (Markdown)</label>
                <textarea
                  rows={5}
                  value={testContent}
                  onChange={(e) => setTestContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-[11px] outline-none focus:border-purple-500"
                />
              </div>

              {testStatus && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold ${
                    testStatus.includes("Error")
                      ? "bg-rose-950/50 text-rose-300 border border-rose-800"
                      : "bg-emerald-950/50 text-emerald-300 border border-emerald-800"
                  }`}
                >
                  {testStatus}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowTestPostModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendTestWebhook}
                disabled={isSubmittingTest}
                className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-lg active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmittingTest ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>{isSubmittingTest ? "Publishing..." : "Send Webhook Request"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- RAW JSON INSPECTOR MODAL --- */}
      {selectedRawPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white font-display">
                  Raw Webhook Payload ({selectedRawPayload.id})
                </h3>
              </div>
              <button
                onClick={() => setSelectedRawPayload(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs text-emerald-400 font-mono whitespace-pre-wrap max-h-[450px] overflow-y-auto leading-relaxed">
              {JSON.stringify(selectedRawPayload, null, 2)}
            </pre>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedRawPayload(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold cursor-pointer transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
