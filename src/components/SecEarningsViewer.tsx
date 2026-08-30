import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Search,
  ExternalLink,
  RefreshCw,
  Building2,
  Calendar,
  DollarSign,
  AlertCircle
} from "lucide-react";
import { SecCompanyReport } from "../types";
import { formatCurrency, formatLargeNumber } from "../lib/utils";

interface SecEarningsViewerProps {
  watchlist: string[];
}

export const SecEarningsViewer: React.FC<SecEarningsViewerProps> = ({ watchlist }) => {
  const [tickersInput, setTickersInput] = useState("NVDA, MSFT, AAPL, AMZN, META, GOOGL, TSLA");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<SecCompanyReport[]>([]);

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

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white font-display flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-400" />
              SEC EDGAR Filings & XBRL Financial Facts
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Resolves CIK directories from SEC.gov, inspects 10-K, 10-Q, and 8-K disclosure filings, and pulls reported GAAP Diluted EPS and Total Revenues.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setTickersInput(watchlist.join(", "));
                fetchSecReports(watchlist.join(", "));
              }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition"
            >
              Use Watchlist
            </button>
            <button
              onClick={() => fetchSecReports()}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Fetch SEC Filings
            </button>
          </div>
        </div>

        <div className="pt-4">
          <label className="block text-xs font-semibold text-slate-300 mb-1">Tickers (Comma Separated)</label>
          <input
            type="text"
            value={tickersInput}
            onChange={(e) => setTickersInput(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading && (
          <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
            <p className="font-semibold text-white">Connecting to SEC EDGAR API...</p>
            <p className="text-xs text-slate-500 mt-1">Retrieving official CIK records, XBRL tags & archive links</p>
          </div>
        )}

        {!loading &&
          reports.map((rep) => (
            <div
              key={rep.ticker}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4 hover:border-slate-700/80 transition"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-display font-bold text-white text-base">
                    {rep.ticker}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white font-display">{rep.ticker}</h3>
                    <span className="text-[11px] text-slate-400 font-mono">
                      SEC CIK: {rep.cik || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Facts */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* EPS */}
                <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-1">Latest Reported EPS</span>
                  {rep.eps ? (
                    <div>
                      <span className="text-lg font-bold text-emerald-400 font-mono">
                        ${rep.eps.value.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        {rep.eps.fiscal_period} {rep.eps.fiscal_year} (End: {rep.eps.period_end})
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-500">Not in current XBRL</span>
                  )}
                </div>

                {/* Revenue */}
                <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-1">Latest Total Revenue</span>
                  {rep.revenue ? (
                    <div>
                      <span className="text-lg font-bold text-blue-400 font-mono">
                        {formatLargeNumber(rep.revenue.value)}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        {rep.revenue.fiscal_period} {rep.revenue.fiscal_year} (End: {rep.revenue.period_end})
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-500">Not in current XBRL</span>
                  )}
                </div>
              </div>

              {/* Recent Filings */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Recent SEC Submissions (10-K, 10-Q, 8-K)
                </h4>
                {rep.filings && rep.filings.length > 0 ? (
                  <div className="space-y-1.5">
                    {rep.filings.map((f, idx) => (
                      <a
                        key={idx}
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between px-3 py-2 bg-slate-950/40 hover:bg-slate-800/80 rounded-lg text-xs border border-slate-800/60 group transition"
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold font-mono text-[10px]">
                            {f.form}
                          </span>
                          <span className="text-slate-300 font-mono">{f.date}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 group-hover:text-blue-400 flex items-center gap-1">
                          View on SEC.gov <ExternalLink className="w-3 h-3" />
                        </span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No recent filings retrieved.</p>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
