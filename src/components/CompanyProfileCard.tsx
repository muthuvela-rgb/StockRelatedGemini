import React, { useState } from "react";
import {
  Building2,
  Calendar,
  DollarSign,
  Globe,
  Users,
  MapPin,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Landmark,
  Layers,
  Sparkles,
  Award,
} from "lucide-react";
import { CompanyProfile } from "../types/stockChart";

interface CompanyProfileCardProps {
  profile: CompanyProfile | null;
  loading: boolean;
  activeTicker: string;
}

export const CompanyProfileCard: React.FC<CompanyProfileCardProps> = ({
  profile,
  loading,
  activeTicker,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Loading skeleton state
  if (loading && !profile) {
    return (
      <div
        id="company-profile-skeleton"
        className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg relative overflow-hidden animate-pulse"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-2">
            <div className="h-6 w-48 bg-slate-800 rounded-lg" />
            <div className="h-4 w-32 bg-slate-800/60 rounded" />
          </div>
          <div className="flex gap-2">
            <div className="h-7 w-24 bg-slate-800 rounded-lg" />
            <div className="h-7 w-28 bg-slate-800 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 my-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-800/40 rounded-xl p-3 border border-slate-800/60" />
          ))}
        </div>
        <div className="h-14 bg-slate-800/40 rounded-xl" />
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div
      id="active-stock-company-profile"
      className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden transition-all"
    >
      {/* Subtle ambient gradient accent */}
      <div className="absolute -left-12 -top-12 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header: Company Identity & Industry Classification */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight font-display flex items-center gap-2">
              <span>{profile.name}</span>
              <span className="text-xs px-2 py-0.5 rounded-lg bg-indigo-600/20 text-indigo-300 font-mono font-bold border border-indigo-500/30">
                {profile.ticker}
              </span>
              {profile.exchange && (
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono border border-slate-700/60">
                  {profile.exchange}
                </span>
              )}
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 pt-0.5">
            {profile.sector && (
              <span className="flex items-center gap-1 font-medium text-slate-300">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>{profile.sector}</span>
              </span>
            )}
            {profile.sector && profile.industry && <span className="text-slate-600">•</span>}
            {profile.industry && (
              <span className="text-slate-400 font-medium">
                {profile.industry}
              </span>
            )}
            {profile.isEtf && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold tracking-wider uppercase">
                ETF / Fund
              </span>
            )}
          </div>
        </div>

        {/* Action / Official Website Links */}
        <div className="flex items-center gap-2 shrink-0">
          {profile.website && (
            <a
              id="company-website-link"
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 transition-all cursor-pointer shadow-sm"
              title={`Visit official site: ${profile.website}`}
            >
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span>Official Website</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          )}
          <div className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/70 text-[11px] font-mono text-slate-400">
            Currency: <span className="font-bold text-slate-200">{profile.currency || "USD"}</span>
          </div>
        </div>
      </div>

      {/* Core Key Metrics Grid: Year Went Public, Market Cap, HQ, Employees, CEO */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 my-4">
        {/* 1. Year Went Public (IPO) */}
        <div
          id="stat-went-public-year"
          className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 hover:border-slate-700/80 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold tracking-wider uppercase flex items-center gap-1.5 text-amber-400/90">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              {profile.isEtf ? "Inception Year" : "Went Public (IPO)"}
            </span>
          </div>
          <div className="text-lg font-black text-white font-mono">
            {profile.ipoYear ? profile.ipoYear : "Pre-Electronic"}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium flex items-center gap-1">
            {profile.ipoDate ? (
              <span>
                {profile.ipoDate}
                {profile.yearsPublic !== null && ` • ${profile.yearsPublic}y on market`}
              </span>
            ) : profile.yearsPublic !== null ? (
              <span>{profile.yearsPublic} years public</span>
            ) : (
              <span>Established Public Entity</span>
            )}
          </div>
        </div>

        {/* 2. Total Market Cap */}
        <div
          id="stat-total-market-cap"
          className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 hover:border-slate-700/80 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold tracking-wider uppercase flex items-center gap-1.5 text-emerald-400/90">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              {profile.isEtf ? "Total Fund AUM" : "Total Market Cap"}
            </span>
          </div>
          <div className="text-lg font-black text-white font-mono">
            {profile.formattedMarketCap}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">
            {profile.marketCap ? (
              <span>${(profile.marketCap).toLocaleString()} USD</span>
            ) : (
              <span>Capitalization unavailable</span>
            )}
          </div>
        </div>

        {/* 3. Headquarters */}
        <div
          id="stat-headquarters"
          className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 hover:border-slate-700/80 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold tracking-wider uppercase flex items-center gap-1.5 text-sky-400/90">
              <MapPin className="w-3.5 h-3.5 text-sky-400" />
              Headquarters
            </span>
          </div>
          <div className="text-sm font-bold text-white truncate" title={profile.headquarters || "Global"}>
            {profile.headquarters || profile.country || "Global Corporate Office"}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">
            {profile.country || "Global Operations"}
          </div>
        </div>

        {/* 4. Employees / Team Size */}
        <div
          id="stat-employees"
          className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 hover:border-slate-700/80 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold tracking-wider uppercase flex items-center gap-1.5 text-purple-400/90">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              Employees
            </span>
          </div>
          <div className="text-lg font-black text-white font-mono">
            {profile.formattedEmployees ? profile.formattedEmployees : profile.isEtf ? "Fund Managed" : "Enterprise"}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">
            {profile.employees ? "Full-time Workforce" : profile.isEtf ? "Asset Manager Trust" : "Global Staff"}
          </div>
        </div>

        {/* 5. Leadership / CEO */}
        <div
          id="stat-leadership-ceo"
          className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 hover:border-slate-700/80 transition-colors col-span-2 sm:col-span-1"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold tracking-wider uppercase flex items-center gap-1.5 text-rose-400/90">
              <Award className="w-3.5 h-3.5 text-rose-400" />
              {profile.isEtf ? "Fund Sponsor" : "Key Leadership"}
            </span>
          </div>
          <div className="text-sm font-bold text-white truncate" title={profile.ceo || "Corporate Board"}>
            {profile.ceo ? profile.ceo.split("(")[0].trim() : profile.isEtf ? profile.industry || "Trust Custodian" : "Corporate Board"}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium truncate">
            {profile.ceo && profile.ceo.includes("(") ? profile.ceo.substring(profile.ceo.indexOf("(") + 1).replace(")", "") : "Executive Officer"}
          </div>
        </div>
      </div>

      {/* Secondary Quick Ratios Strip (P/E, Forward P/E, Div Yield, Beta, 52W Range) */}
      {(profile.peRatio !== null || profile.dividendYield !== null || profile.beta !== null || profile.fiftyTwoWeekHigh !== null) && (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none text-xs font-mono">
          <span className="text-[11px] font-sans font-semibold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Key Ratios:
          </span>

          {profile.peRatio !== null && (
            <div className="px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-300 shrink-0">
              <span className="text-slate-500 mr-1">Trailing P/E:</span>
              <span className="font-bold text-white">{profile.peRatio.toFixed(1)}x</span>
            </div>
          )}

          {profile.forwardPE !== null && (
            <div className="px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-300 shrink-0">
              <span className="text-slate-500 mr-1">Forward P/E:</span>
              <span className="font-bold text-white">{profile.forwardPE.toFixed(1)}x</span>
            </div>
          )}

          {profile.dividendYield !== null && (
            <div className="px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-300 shrink-0">
              <span className="text-slate-500 mr-1">Div Yield:</span>
              <span className="font-bold text-emerald-400">+{profile.dividendYield}%</span>
            </div>
          )}

          {profile.beta !== null && (
            <div className="px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-300 shrink-0">
              <span className="text-slate-500 mr-1">Beta (5Y):</span>
              <span className="font-bold text-sky-400">{profile.beta.toFixed(2)}</span>
            </div>
          )}

          {profile.fiftyTwoWeekHigh !== null && profile.fiftyTwoWeekLow !== null && (
            <div className="px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-300 shrink-0">
              <span className="text-slate-500 mr-1">52W Range:</span>
              <span className="font-bold text-slate-200">
                ${profile.fiftyTwoWeekLow.toFixed(2)} – ${profile.fiftyTwoWeekHigh.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Short Company Description & Expandable Full Overview */}
      <div
        id="company-description-container"
        className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4 text-xs leading-relaxed"
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 font-display">
            <Landmark className="w-3.5 h-3.5 text-indigo-400" />
            Company Overview • {profile.ticker}
          </span>

          {profile.longDescription && profile.longDescription !== profile.shortDescription && (
            <button
              id="toggle-company-description-btn"
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1 cursor-pointer"
            >
              <span>{isExpanded ? "Show Less" : "Read Full Overview"}</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Description Body */}
        <p className="text-slate-300 text-xs sm:text-[13px] leading-relaxed font-sans">
          {isExpanded ? profile.longDescription : profile.shortDescription || profile.longDescription}
        </p>
      </div>
    </div>
  );
};
