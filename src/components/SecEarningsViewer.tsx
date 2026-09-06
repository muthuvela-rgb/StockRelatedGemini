import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Search,
  ExternalLink,
  RefreshCw,
  Building2,
  Calendar,
  DollarSign,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  SlidersHorizontal,
  FileText,
  Clock,
  Layers,
  Copy,
  Check
} from "lucide-react";
import { SecCompanyReport, SecFilingSummary } from "../types";
import { formatCurrency, formatLargeNumber } from "../lib/utils";

interface SecEarningsViewerProps {
  watchlist: string[];
}

export const SecEarningsViewer: React.FC<SecEarningsViewerProps> = ({ watchlist }) => {
  const [tickersInput, setTickersInput] = useState("NVDA, MSFT, AAPL, AMZN, META, GOOGL, TSLA");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<SecCompanyReport[]>([]);
  
  // Filtering & Search
  const [selectedFormFilter, setSelectedFormFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sentimentFilter, setSentimentFilter] = useState<string>("ALL");

  // Summarization State
  const [summarizingMap, setSummarizingMap] = useState<Record<string, boolean>>({});
  const [batchSummarizing, setBatchSummarizing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [expandedSummaryMap, setExpandedSummaryMap] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchSecReports = async (tickersToFetch?: string) => {
    setLoading(true);
    setError(null);
    const list = tickersToFetch || tickersInput;
    try {
      const res = await fetch(`/api/sec-earnings?tickers=${encodeURIComponent(list)}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      const data = await res.json();
      setReports(data.results || []);
    } catch (e: any) {
      setError(e.message || "Failed to load SEC EDGAR filings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecReports();
  }, []);

  const getFilingKey = (ticker: string, form: string, date: string, url: string) => {
    return `${ticker}_${form}_${date}_${url}`;
  };

  const handleSummarizeFiling = async (ticker: string, filing: any, eps?: any, revenue?: any) => {
    const key = getFilingKey(ticker, filing.form, filing.date, filing.url);
    setSummarizingMap((prev) => ({ ...prev, [key]: true }));

    try {
      const res = await fetch("/api/sec-summarize-filing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          form: filing.form,
          date: filing.date,
          url: filing.url,
          epsData: eps,
          revData: revenue,
        }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.statusText}`);
      const data = await res.json();

      if (data.summary) {
        // Update filing summary in state
        setReports((prev) =>
          prev.map((r) => {
            if (r.ticker !== ticker) return r;
            return {
              ...r,
              filings: r.filings.map((f) => {
                if (f.url === filing.url) {
                  return { ...f, ai_summary: data.summary };
                }
                return f;
              }),
            };
          })
        );
        // Automatically expand the summary
        setExpandedSummaryMap((prev) => ({ ...prev, [key]: true }));
      }
    } catch (err: any) {
      alert(`Failed to summarize filing: ${err.message}`);
    } finally {
      setSummarizingMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleSummarizeAll10QAnd8K = async () => {
    const targetItems: Array<{ ticker: string; form: string; date: string; url: string; epsData?: any; revData?: any }> = [];

    const isSummarizable = (form: string) => {
      const base = form.replace(/\/A$/i, "").toUpperCase();
      return ["10-Q", "8-K", "10-K", "20-F", "6-K"].includes(base) || form.endsWith("/A");
    };

    reports.forEach((r) => {
      r.filings.forEach((f) => {
        if (isSummarizable(f.form) && !f.ai_summary) {
          targetItems.push({
            ticker: r.ticker,
            form: f.form,
            date: f.date,
            url: f.url,
            epsData: r.eps,
            revData: r.revenue,
          });
        }
      });
    });

    if (targetItems.length === 0) {
      alert("All eligible filings (including amendments) already have AI summaries generated!");
      return;
    }

    setBatchSummarizing(true);
    setBatchProgress({ current: 0, total: targetItems.length });

    try {
      const res = await fetch("/api/sec-summarize-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filings: targetItems }),
      });

      if (!res.ok) throw new Error(`Batch request failed: ${res.statusText}`);
      const data = await res.json();

      if (data.summaries && Array.isArray(data.summaries)) {
        const summaryLookup = new Map<string, SecFilingSummary>();
        data.summaries.forEach((s: SecFilingSummary) => {
          summaryLookup.set(`${s.ticker}_${s.form}_${s.date}_${s.url}`, s);
        });

        setReports((prev) =>
          prev.map((r) => ({
            ...r,
            filings: r.filings.map((f) => {
              const key = `${r.ticker}_${f.form}_${f.date}_${f.url}`;
              const found = summaryLookup.get(key);
              return found ? { ...f, ai_summary: found } : f;
            }),
          }))
        );

        // Expand all newly generated summaries
        setExpandedSummaryMap((prev) => {
          const next = { ...prev };
          data.summaries.forEach((s: SecFilingSummary) => {
            next[`${s.ticker}_${s.form}_${s.date}_${s.url}`] = true;
          });
          return next;
        });
      }
    } catch (err: any) {
      alert(`Batch summarization error: ${err.message}`);
    } finally {
      setBatchSummarizing(false);
    }
  };

  const copySummaryText = (summary: SecFilingSummary, key: string) => {
    const text = `=== ${summary.ticker} ${summary.form} Summary (${summary.date}) ===\n` +
      `Headline: ${summary.title}\n` +
      `Sentiment: ${summary.sentiment}\n\n` +
      `Overview:\n${summary.summary}\n\n` +
      `Key Takeaways:\n${summary.key_takeaways.map((t) => `- ${t}`).join("\n")}\n\n` +
      (summary.options_implications ? `Options & Volatility Implications:\n${summary.options_implications}\n\n` : "") +
      `SEC Edgar Archive: ${summary.url}`;

    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Filter Filings helper
  const getFilteredFilings = (filings: any[]) => {
    return filings.filter((f) => {
      if (selectedFormFilter !== "ALL") {
        const isFilingAmendment = f.form.toUpperCase().endsWith("/A") || Boolean(f.is_amendment);
        if (selectedFormFilter === "AMENDMENTS") {
          if (!isFilingAmendment) return false;
        } else {
          const filterBase = selectedFormFilter.replace(/\/A$/i, "").toUpperCase();
          const filingBase = f.form.replace(/\/A$/i, "").toUpperCase();
          if (filingBase !== filterBase && f.form.toUpperCase() !== selectedFormFilter.toUpperCase()) {
            return false;
          }
        }
      }
      if (sentimentFilter !== "ALL") {
        if (!f.ai_summary || f.ai_summary.sentiment !== sentimentFilter) return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesForm = f.form.toLowerCase().includes(query);
        const matchesDesc = (f.description || "").toLowerCase().includes(query);
        const matchesSummary = f.ai_summary?.summary?.toLowerCase().includes(query);
        const matchesTakeaways = f.ai_summary?.key_takeaways?.some((t: string) => t.toLowerCase().includes(query));
        const matchesTitle = f.ai_summary?.title?.toLowerCase().includes(query);
        if (!matchesForm && !matchesDesc && !matchesSummary && !matchesTakeaways && !matchesTitle) {
          return false;
        }
      }
      return true;
    });
  };

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case "Bullish":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-400" /> Bullish
          </span>
        );
      case "Bearish":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-rose-400" /> Bearish
          </span>
        );
      case "Mixed":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3 text-purple-400" /> Mixed
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <FileText className="w-3 h-3 text-amber-400" /> Neutral
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white font-display flex items-center gap-2">
                  SEC EDGAR Documents & LLM Earnings Summarizer
                  <span className="px-2 py-0.5 text-[10px] uppercase font-mono tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-400" /> Powered by Gemini
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Direct SEC EDGAR integration to fetch official 10-Q, 8-K, 10-K filings, and all amendments (8-K/A, 10-Q/A, 10-K/A), parse disclosures, and produce institutional-grade executive summaries.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setTickersInput(watchlist.join(", "));
                fetchSecReports(watchlist.join(", "));
              }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition cursor-pointer"
            >
              Use Watchlist
            </button>
            <button
              onClick={() => fetchSecReports()}
              disabled={loading}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" /> : <Search className="w-3.5 h-3.5" />}
              Fetch SEC Filings
            </button>
            <button
              onClick={handleSummarizeAll10QAnd8K}
              disabled={batchSummarizing || loading || reports.length === 0}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 cursor-pointer disabled:opacity-50 transition"
            >
              {batchSummarizing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Summarizing Filings with Gemini...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Summarize All Filings & Amendments
                </>
              )}
            </button>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
          <div className="md:col-span-6">
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">Tickers (Comma Separated)</label>
            <input
              type="text"
              value={tickersInput}
              onChange={(e) => setTickersInput(e.target.value)}
              placeholder="e.g. NVDA, MSFT, AAPL, AMZN, META"
              className="w-full bg-slate-950/70 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">Search Keywords in Filings</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search guidance, buyback, EPS..."
                className="w-full bg-slate-950/70 border border-slate-700 text-white rounded-xl pl-8.5 pr-3 py-2 text-xs outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">Filter Document Form</label>
            <select
              value={selectedFormFilter}
              onChange={(e) => setSelectedFormFilter(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 transition cursor-pointer font-medium"
            >
              <option value="ALL">All Document Types & Amendments</option>
              <option value="8-K">8-K & 8-K/A (Current Reports / Material Events)</option>
              <option value="10-Q">10-Q & 10-Q/A (Quarterly Reports)</option>
              <option value="10-K">10-K & 10-K/A (Annual Reports)</option>
              <option value="AMENDMENTS">Only Amendments (/A)</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Reports Grid */}
      <div className="space-y-6">
        {loading && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 shadow-xl">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
            <p className="font-semibold text-white">Connecting to SEC EDGAR & Parsing Disclosures...</p>
            <p className="text-xs text-slate-500 mt-1">Retrieving official CIK directories, primary documents & XBRL financial tables</p>
          </div>
        )}

        {!loading && reports.length === 0 && !error && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <FileSpreadsheet className="w-8 h-8 mx-auto mb-3 text-slate-600" />
            <p className="font-semibold text-white">No SEC Filings Loaded</p>
            <p className="text-xs text-slate-500 mt-1">Enter company tickers above and click &quot;Fetch SEC Filings&quot; to begin.</p>
          </div>
        )}

        {!loading &&
          reports.map((rep) => {
            const filteredFilings = getFilteredFilings(rep.filings || []);

            return (
              <div
                key={rep.ticker}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5 hover:border-slate-700/80 transition"
              >
                {/* Company Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center font-display font-black text-blue-400 text-lg shadow-inner">
                      {rep.ticker}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white font-display">{rep.ticker}</h3>
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[11px] text-slate-300 font-mono border border-slate-700">
                          CIK: {rep.cik || "N/A"}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {rep.filings?.length || 0} recent filings retrieved from SEC EDGAR database
                      </span>
                    </div>
                  </div>

                  {/* Financial Facts Badges */}
                  <div className="flex items-center gap-3">
                    {/* EPS */}
                    <div className="bg-slate-950/60 rounded-xl px-3.5 py-2 border border-slate-800 flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                        <DollarSign className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">Reported EPS</span>
                        {rep.eps ? (
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-bold text-emerald-400 font-mono">
                              ${rep.eps.value.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-500">({rep.eps.fiscal_period} {rep.eps.fiscal_year})</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">N/A</span>
                        )}
                      </div>
                    </div>

                    {/* Revenue */}
                    <div className="bg-slate-950/60 rounded-xl px-3.5 py-2 border border-slate-800 flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">Reported Revenue</span>
                        {rep.revenue ? (
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-bold text-blue-400 font-mono">
                              {formatLargeNumber(rep.revenue.value)}
                            </span>
                            <span className="text-[10px] text-slate-500">({rep.revenue.fiscal_period} {rep.revenue.fiscal_year})</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">N/A</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submissions & Summaries List */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-400" />
                      SEC Filings & AI Summaries ({filteredFilings.length})
                    </h4>
                  </div>

                  {filteredFilings.length === 0 ? (
                    <div className="p-6 bg-slate-950/40 rounded-xl border border-slate-800 text-center text-xs text-slate-500">
                      No filings matching current filter ({selectedFormFilter}) for {rep.ticker}.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredFilings.map((filing, idx) => {
                        const key = getFilingKey(rep.ticker, filing.form, filing.date, filing.url);
                        const isSummarizing = summarizingMap[key] || false;
                        const isExpanded = expandedSummaryMap[key] || false;
                        const summary = filing.ai_summary as SecFilingSummary | undefined;

                        return (
                          <div
                            key={idx}
                            className={`rounded-xl border transition-all ${
                              summary
                                ? "bg-slate-950/80 border-slate-700/80 shadow-md"
                                : "bg-slate-950/40 border-slate-800/80 hover:border-slate-700/60"
                            }`}
                          >
                            {/* Filing Card Header Row */}
                            <div className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                {(() => {
                                  const isAmendment = filing.form.toUpperCase().endsWith("/A") || Boolean(filing.is_amendment);
                                  const baseForm = filing.form.replace(/\/A$/i, "").toUpperCase();
                                  const badgeColor = baseForm === "10-Q"
                                    ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                    : baseForm === "8-K"
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                    : baseForm === "10-K"
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                    : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30";

                                  return (
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className={`px-2.5 py-1 rounded-lg font-mono font-black text-xs border ${badgeColor}`}>
                                        {filing.form}
                                      </span>
                                      {isAmendment && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wide">
                                          AMENDMENT
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}

                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-white font-mono flex items-center gap-1">
                                      <Calendar className="w-3 h-3 text-slate-400" />
                                      {filing.date}
                                    </span>
                                    {summary && getSentimentBadge(summary.sentiment)}
                                  </div>
                                  <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                    {summary?.title || filing.description || `Official ${filing.form} Disclosure`}
                                  </p>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-2 shrink-0">
                                <a
                                  href={filing.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 flex items-center gap-1 transition"
                                >
                                  SEC.gov <ExternalLink className="w-3 h-3" />
                                </a>

                                {summary ? (
                                  <button
                                    onClick={() =>
                                      setExpandedSummaryMap((prev) => ({
                                        ...prev,
                                        [key]: !prev[key],
                                      }))
                                    }
                                    className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                                    {isExpanded ? "Hide AI Summary" : "View AI Summary"}
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() =>
                                      handleSummarizeFiling(rep.ticker, filing, rep.eps, rep.revenue)
                                    }
                                    disabled={isSummarizing}
                                    className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50 transition"
                                  >
                                    {isSummarizing ? (
                                      <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        Analyzing Document...
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                        Summarize with Gemini
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Expanded AI Summary View */}
                            {summary && isExpanded && (
                              <div className="px-4 pb-4 pt-1 border-t border-slate-800/80 space-y-4 text-xs">
                                {/* Title & Copy Bar */}
                                <div className="flex items-center justify-between pt-2">
                                  <h5 className="font-bold text-white text-sm font-display flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4 text-blue-400" />
                                    {summary.title}
                                  </h5>
                                  <button
                                    onClick={() => copySummaryText(summary, key)}
                                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-md text-[11px] font-semibold border border-slate-700 flex items-center gap-1 transition cursor-pointer"
                                  >
                                    {copiedKey === key ? (
                                      <>
                                        <Check className="w-3 h-3 text-emerald-400" /> Copied
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3" /> Copy Summary
                                      </>
                                    )}
                                  </button>
                                </div>

                                {/* Executive Narrative Overview */}
                                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200 leading-relaxed">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block mb-1">
                                    Executive Overview
                                  </span>
                                  <p>{summary.summary}</p>
                                </div>

                                {/* Key Highlights / Takeaways */}
                                {summary.key_takeaways && summary.key_takeaways.length > 0 && (
                                  <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                                      Key Takeaways & Quant Disclosures
                                    </span>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                      {summary.key_takeaways.map((point, pIdx) => (
                                        <div
                                          key={pIdx}
                                          className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-start gap-2 text-slate-300"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                          <span className="leading-snug">{point}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Financial Snapshot Highlights */}
                                {summary.financial_highlights && (
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                    {summary.financial_highlights.revenue && (
                                      <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                                        <span className="text-[10px] text-slate-400 block">Revenue</span>
                                        <span className="font-semibold text-blue-300 text-[11px] block mt-0.5">
                                          {summary.financial_highlights.revenue}
                                        </span>
                                      </div>
                                    )}
                                    {summary.financial_highlights.net_income_or_eps && (
                                      <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                                        <span className="text-[10px] text-slate-400 block">EPS / Net Income</span>
                                        <span className="font-semibold text-emerald-300 text-[11px] block mt-0.5">
                                          {summary.financial_highlights.net_income_or_eps}
                                        </span>
                                      </div>
                                    )}
                                    {summary.financial_highlights.guidance && (
                                      <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                                        <span className="text-[10px] text-slate-400 block">Guidance</span>
                                        <span className="font-semibold text-purple-300 text-[11px] block mt-0.5">
                                          {summary.financial_highlights.guidance}
                                        </span>
                                      </div>
                                    )}
                                    {summary.financial_highlights.margins_or_growth && (
                                      <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                                        <span className="text-[10px] text-slate-400 block">Margins / Growth</span>
                                        <span className="font-semibold text-amber-300 text-[11px] block mt-0.5">
                                          {summary.financial_highlights.margins_or_growth}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Material Events & 8-K Triggers */}
                                {summary.material_events && summary.material_events.length > 0 && (
                                  <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 mb-1.5">
                                      <SlidersHorizontal className="w-3 h-3 text-amber-400" />
                                      Material Events & Disclosed Transactions
                                    </span>
                                    <ul className="space-y-1 text-slate-300 list-disc list-inside">
                                      {summary.material_events.map((evt, eIdx) => (
                                        <li key={eIdx} className="leading-snug">
                                          {evt}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Risk Exposures */}
                                {summary.risk_factors && summary.risk_factors.length > 0 && (
                                  <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5 mb-1.5">
                                      <ShieldAlert className="w-3 h-3 text-rose-400" />
                                      Risk Exposures & Macro Factors
                                    </span>
                                    <ul className="space-y-1 text-slate-300 list-disc list-inside">
                                      {summary.risk_factors.map((risk, rIdx) => (
                                        <li key={rIdx} className="leading-snug">
                                          {risk}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Options & Volatility Trading Impact */}
                                {summary.options_implications && (
                                  <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-slate-200">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5 mb-1">
                                      <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                                      Options, Implied Volatility & Put-Selling Implications
                                    </span>
                                    <p className="leading-relaxed text-indigo-100/90">{summary.options_implications}</p>
                                  </div>
                                )}

                                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> Generated: {new Date(summary.generated_at).toLocaleString()}
                                  </span>
                                  <a
                                    href={summary.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:underline flex items-center gap-1"
                                  >
                                    View Full Document on SEC.gov Archive <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};

