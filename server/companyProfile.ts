import { GoogleGenAI } from "@google/genai";

export interface CompanyProfile {
  ticker: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  ipoYear: number | null;
  ipoDate: string | null;
  yearsPublic: number | null;
  marketCap: number | null;
  formattedMarketCap: string;
  sector: string | null;
  industry: string | null;
  headquarters: string | null;
  country: string | null;
  website: string | null;
  employees: number | null;
  formattedEmployees: string | null;
  ceo: string | null;
  exchange: string | null;
  currency: string | null;
  currentPrice: number | null;
  peRatio: number | null;
  forwardPE: number | null;
  dividendYield: number | null;
  beta: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  isEtf: boolean;
}

const HTTP_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
};

// In-memory cache for company profiles (1 hour TTL)
const profileCache = new Map<string, { data: CompanyProfile; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

let cachedCookie: string | null = null;
let cachedCrumb: string | null = null;
let authPromise: Promise<{ cookie: string; crumb: string }> | null = null;

async function getAuth(forceRefresh = false): Promise<{ cookie: string; crumb: string }> {
  if (!forceRefresh && cachedCookie && cachedCrumb) {
    return { cookie: cachedCookie, crumb: cachedCrumb };
  }
  if (authPromise && !forceRefresh) {
    return authPromise;
  }

  authPromise = (async () => {
    try {
      const cookieRes = await fetch("https://fc.yahoo.com", { headers: HTTP_HEADERS });
      const cookie = cookieRes.headers.get("set-cookie") || "";

      const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
        headers: { ...HTTP_HEADERS, Cookie: cookie },
      });
      const crumb = await crumbRes.text();

      cachedCookie = cookie;
      cachedCrumb = crumb;
      return { cookie, crumb };
    } catch (err) {
      console.warn("Failed to get crumb for company profile:", err);
      return { cookie: cachedCookie || "", crumb: cachedCrumb || "" };
    } finally {
      authPromise = null;
    }
  })();

  return authPromise;
}

/**
 * Format raw market cap into human-readable string ($5.37T, $426.8B, $850.5M)
 */
function formatMarketCap(cap: number | null | undefined): string {
  if (!cap || isNaN(cap) || cap <= 0) return "N/A";
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(1)}M`;
  return `$${cap.toLocaleString()}`;
}

/**
 * Extract clean 1-2 sentence executive short description from full summary
 */
function extractShortDescription(fullText: string, maxChars = 320): string {
  if (!fullText) return "";
  const cleaned = fullText.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) return cleaned;

  // Find sentence boundary near maxChars
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [];
  let short = "";
  for (const s of sentences) {
    if ((short + s).length <= maxChars) {
      short += (short ? " " : "") + s.trim();
    } else {
      break;
    }
  }

  if (!short || short.length < 80) {
    // Truncate at word boundary with ellipsis
    const cut = cleaned.substring(0, maxChars);
    const lastSpace = cut.lastIndexOf(" ");
    short = (lastSpace > 0 ? cut.substring(0, lastSpace) : cut) + "...";
  }

  return short;
}

/**
 * Fallback to Gemini when Yahoo has no summary
 */
async function generateGeminiCompanyProfileFallback(
  ticker: string,
  companyName: string,
  genAI: GoogleGenAI | null
): Promise<{ shortDescription: string; longDescription: string; sector?: string; industry?: string; ipoYear?: number }> {
  if (!genAI) {
    return {
      shortDescription: `${companyName || ticker} is a publicly traded entity listed on US exchanges.`,
      longDescription: `${companyName || ticker} operates in global public markets. Complete business summary can be obtained from official SEC EDGAR 10-K filings.`,
    };
  }

  try {
    const prompt = `Provide an authoritative, concise corporate profile for stock ticker "${ticker}" (${companyName}).
Return ONLY a valid JSON object with the following fields:
{
  "shortDescription": "A 1-2 sentence executive overview of what the company does, its core products/services, and primary market.",
  "longDescription": "A comprehensive 1-2 paragraph description of the company's business segments, technology/service offerings, and competitive positioning.",
  "sector": "Primary market sector (e.g. Technology, Healthcare, Consumer Cyclical)",
  "industry": "Specific industry (e.g. Semiconductors, Software - Infrastructure)",
  "ipoYear": 1999 // Estimated year the company went public (number or null)
}`;

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text?.trim() || "{}";
    const parsed = JSON.parse(text);
    return {
      shortDescription: parsed.shortDescription || `${companyName} is an active publicly traded enterprise.`,
      longDescription: parsed.longDescription || parsed.shortDescription || "",
      sector: parsed.sector,
      industry: parsed.industry,
      ipoYear: typeof parsed.ipoYear === "number" ? parsed.ipoYear : undefined,
    };
  } catch (e) {
    console.error(`Gemini fallback failed for ${ticker}:`, e);
    return {
      shortDescription: `${companyName || ticker} is a publicly traded enterprise.`,
      longDescription: `${companyName || ticker} engages in commercial operations in its respective sector.`,
    };
  }
}

/**
 * Main function to fetch comprehensive company metadata for active stock symbol
 */
export async function getCompanyProfile(
  rawTicker: string,
  genAI?: GoogleGenAI | null
): Promise<CompanyProfile | null> {
  const ticker = rawTicker.trim().toUpperCase();
  if (!ticker) return null;

  // Check cache
  const cached = profileCache.get(ticker);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const { cookie, crumb } = await getAuth();

    // 1. Fetch Chart for firstTradeDate (IPO date), exchange, pricing, currency
    let chartMeta: any = null;
    try {
      const chartUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d`;
      const chartRes = await fetch(chartUrl, { headers: HTTP_HEADERS });
      if (chartRes.ok) {
        const chartJson = await chartRes.json();
        chartMeta = chartJson?.chart?.result?.[0]?.meta || null;
      }
    } catch (e) {
      console.warn(`Chart fetch failed for profile ${ticker}:`, e);
    }

    // 2. Fetch Quote Summary for assetProfile, defaultKeyStatistics, summaryDetail, price, fundProfile
    let quoteResData: any = null;
    try {
      let sumUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
        ticker
      )}?modules=assetProfile,defaultKeyStatistics,summaryDetail,price,fundProfile`;
      if (crumb) sumUrl += `&crumb=${encodeURIComponent(crumb)}`;

      const headers: Record<string, string> = { ...HTTP_HEADERS };
      if (cookie) headers["Cookie"] = cookie;

      const sumRes = await fetch(sumUrl, { headers });
      if (sumRes.ok) {
        const sumJson = await sumRes.json();
        quoteResData = sumJson?.quoteSummary?.result?.[0] || null;
      }
    } catch (e) {
      console.warn(`QuoteSummary fetch failed for profile ${ticker}:`, e);
    }

    const prof = quoteResData?.assetProfile || {};
    const price = quoteResData?.price || {};
    const stats = quoteResData?.defaultKeyStatistics || {};
    const detail = quoteResData?.summaryDetail || {};
    const fund = quoteResData?.fundProfile || {};

    // Determine company name
    const companyName =
      price.longName ||
      price.shortName ||
      chartMeta?.longName ||
      chartMeta?.shortName ||
      ticker;

    // Determine IPO Year / First Trade Date
    let ipoYear: number | null = null;
    let ipoDate: string | null = null;
    let yearsPublic: number | null = null;

    if (chartMeta?.firstTradeDate) {
      const ftDate = new Date(chartMeta.firstTradeDate * 1000);
      if (!isNaN(ftDate.getTime())) {
        ipoYear = ftDate.getUTCFullYear();
        ipoDate = ftDate.toISOString().split("T")[0];
        const currentYear = new Date().getUTCFullYear();
        yearsPublic = Math.max(0, currentYear - ipoYear);
      }
    }

    // Determine Market Cap / Fund AUM
    const rawMarketCap =
      price.marketCap?.raw ||
      stats.marketCap?.raw ||
      detail.marketCap?.raw ||
      detail.totalAssets?.raw ||
      (chartMeta?.regularMarketPrice && stats.sharesOutstanding?.raw
        ? chartMeta.regularMarketPrice * stats.sharesOutstanding.raw
        : null);

    const formattedMarketCap = formatMarketCap(rawMarketCap);

    // Is ETF / Fund?
    const isEtf =
      chartMeta?.instrumentType === "ETF" ||
      chartMeta?.instrumentType === "MUTUALFUND" ||
      (typeof fund?.family === "string" && fund.family.trim().length > 0) ||
      (typeof detail.totalAssets?.raw === "number" && detail.totalAssets.raw > 0);

    // Descriptions
    let fullDescription = prof.longBusinessSummary || prof.description || "";
    if (!fullDescription && fund.family) {
      fullDescription = `${companyName} is an exchange-traded fund in the ${fund.categoryName || "equity"} category managed by ${fund.family}.`;
    }

    let shortDescription = "";
    let sector = prof.sector || fund.categoryName || null;
    let industry = prof.industry || fund.family || (isEtf ? "Exchange Traded Fund" : null);

    if (fullDescription && fullDescription.trim().length > 0) {
      shortDescription = extractShortDescription(fullDescription);
    } else {
      // Use Gemini to supply concise overview if Yahoo has no summary
      const fallback = await generateGeminiCompanyProfileFallback(ticker, companyName, genAI || null);
      shortDescription = fallback.shortDescription;
      fullDescription = fallback.longDescription;
      if (!sector && fallback.sector) sector = fallback.sector;
      if (!industry && fallback.industry) industry = fallback.industry;
      if (!ipoYear && fallback.ipoYear) {
        ipoYear = fallback.ipoYear;
        yearsPublic = Math.max(0, new Date().getUTCFullYear() - ipoYear);
      }
    }

    // Headquarters
    const hqParts = [prof.city, prof.state, prof.country].filter(Boolean);
    const headquarters = hqParts.length > 0 ? hqParts.join(", ") : null;

    // CEO / Key Executive
    let ceo: string | null = null;
    if (Array.isArray(prof.companyOfficers) && prof.companyOfficers.length > 0) {
      const ceoOfficer = prof.companyOfficers.find(
        (o: any) =>
          o.title &&
          (o.title.toLowerCase().includes("ceo") ||
            o.title.toLowerCase().includes("chief executive"))
      );
      if (ceoOfficer && ceoOfficer.name) {
        ceo = `${ceoOfficer.name} (${ceoOfficer.title})`;
      } else if (prof.companyOfficers[0]?.name) {
        ceo = `${prof.companyOfficers[0].name} (${prof.companyOfficers[0].title || "Executive"})`;
      }
    }

    // Employees
    const employees = prof.fullTimeEmployees || null;
    const formattedEmployees = employees ? employees.toLocaleString() : null;

    // Website
    const website = prof.website || null;

    // Exchange
    const exchange =
      chartMeta?.fullExchangeName ||
      chartMeta?.exchangeName ||
      price.exchangeName ||
      "US";

    // Currency
    const currency = chartMeta?.currency || price.currency || "USD";

    // Current Price
    const currentPrice =
      chartMeta?.regularMarketPrice ||
      price.regularMarketPrice?.raw ||
      detail.regularMarketPrice?.raw ||
      null;

    // Multiples
    const peRatio = detail.trailingPE?.raw || stats.trailingPE?.raw || null;
    const forwardPE = detail.forwardPE?.raw || stats.forwardPE?.raw || null;
    const dividendYield = detail.dividendYield?.raw
      ? Number((detail.dividendYield.raw * 100).toFixed(2))
      : null;
    const beta = stats.beta?.raw ? Number(stats.beta.raw.toFixed(2)) : null;

    // 52-Week Range
    const fiftyTwoWeekHigh = detail.fiftyTwoWeekHigh?.raw || chartMeta?.fiftyTwoWeekHigh || null;
    const fiftyTwoWeekLow = detail.fiftyTwoWeekLow?.raw || chartMeta?.fiftyTwoWeekLow || null;

    const profileData: CompanyProfile = {
      ticker,
      name: companyName,
      shortDescription,
      longDescription: fullDescription,
      ipoYear,
      ipoDate,
      yearsPublic,
      marketCap: rawMarketCap,
      formattedMarketCap,
      sector,
      industry,
      headquarters,
      country: prof.country || null,
      website,
      employees,
      formattedEmployees,
      ceo,
      exchange,
      currency,
      currentPrice: currentPrice ? Number(currentPrice.toFixed(2)) : null,
      peRatio: peRatio ? Number(peRatio.toFixed(2)) : null,
      forwardPE: forwardPE ? Number(forwardPE.toFixed(2)) : null,
      dividendYield,
      beta,
      fiftyTwoWeekHigh: fiftyTwoWeekHigh ? Number(fiftyTwoWeekHigh.toFixed(2)) : null,
      fiftyTwoWeekLow: fiftyTwoWeekLow ? Number(fiftyTwoWeekLow.toFixed(2)) : null,
      isEtf,
    };

    // Store in cache
    profileCache.set(ticker, { data: profileData, timestamp: Date.now() });

    return profileData;
  } catch (err) {
    console.error(`Error in getCompanyProfile for ${ticker}:`, err);
    return null;
  }
}
