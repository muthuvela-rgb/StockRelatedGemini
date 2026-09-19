export interface RebalanceEventInfo {
  quarter: string;
  year: number;
  quarterNumber: number;
  executionDate: string; // YYYY-MM-DD (3rd Friday)
  executionFormatted: string; // e.g. "December 18, 2026"
  effectiveDate: string; // YYYY-MM-DD (Following Monday)
  effectiveFormatted: string; // e.g. "December 21, 2026"
  announcementDate: string; // YYYY-MM-DD (2nd Friday)
  announcementFormatted: string; // e.g. "December 11, 2026"
  daysUntilExecution: number;
  daysUntilAnnouncement: number;
  isAnnualReconstitution: boolean;
  isPast: boolean;
}

export interface RebalanceScheduleReport {
  nextRebalance: RebalanceEventInfo;
  upcomingQuarters: RebalanceEventInfo[];
  qqq: {
    symbol: string;
    name: string;
    tracks: string;
    nextRebalanceDate: string;
    effectiveDate: string;
    type: string;
    daysRemaining: number;
    description: string;
  };
  spy: {
    symbol: string;
    name: string;
    tracks: string;
    nextRebalanceDate: string;
    effectiveDate: string;
    type: string;
    daysRemaining: number;
    description: string;
  };
  nasdaq100: {
    indexName: string;
    symbol: string;
    nextRebalanceDate: string;
    effectiveDate: string;
    announcementDate: string;
    type: string;
    daysRemaining: number;
    description: string;
    cappingRules: string;
  };
  sp100: {
    indexName: string;
    symbol: string;
    nextRebalanceDate: string;
    effectiveDate: string;
    announcementDate: string;
    type: string;
    daysRemaining: number;
    description: string;
    cappingRules: string;
  };
}

/**
 * Calculates the 3rd Friday of a given year and month (0-indexed: 2=March, 5=June, 8=September, 11=December).
 */
export function getThirdFriday(year: number, month: number): Date {
  const firstDay = new Date(Date.UTC(year, month, 1));
  const dayOfWeek = firstDay.getUTCDay(); // 0 = Sun, 5 = Fri
  const firstFriday = 1 + ((5 - dayOfWeek + 7) % 7);
  const thirdFriday = firstFriday + 14;
  return new Date(Date.UTC(year, month, thirdFriday, 20, 0, 0)); // 4:00 PM ET close
}

/**
 * Calculates the following Monday after a Friday rebalance (effective open).
 */
export function getFollowingMonday(fridayDate: Date): Date {
  const mon = new Date(fridayDate.getTime());
  mon.setUTCDate(mon.getUTCDate() + 3);
  mon.setUTCHours(13, 30, 0); // 9:30 AM ET open
  return mon;
}

/**
 * Calculates the announcement Friday (2nd Friday, 1 week before the 3rd Friday).
 */
export function getAnnouncementFriday(fridayDate: Date): Date {
  const ann = new Date(fridayDate.getTime());
  ann.setUTCDate(ann.getUTCDate() - 7);
  return ann;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function formatDate(d: Date): string {
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * Generates the live comprehensive Rebalance Schedule Report for QQQ, SPY, Nasdaq-100, and S&P 100.
 */
export function getRebalanceSchedule(refDate: Date = new Date()): RebalanceScheduleReport {
  const nowUtc = new Date(Date.UTC(refDate.getFullYear(), refDate.getMonth(), refDate.getDate()));
  const currentYear = refDate.getFullYear();

  // Generate 8 sequential quarters (current year and next 2 years)
  const quarters: { year: number; month: number }[] = [];
  for (let yr = currentYear - 1; yr <= currentYear + 2; yr++) {
    for (const m of [2, 5, 8, 11]) {
      quarters.push({ year: yr, month: m });
    }
  }

  const allEvents: RebalanceEventInfo[] = quarters.map((q) => {
    const executionFri = getThirdFriday(q.year, q.month);
    const effectiveMon = getFollowingMonday(executionFri);
    const announcementFri = getAnnouncementFriday(executionFri);

    // Days difference
    const diffMs = executionFri.getTime() - nowUtc.getTime();
    const daysUntilExecution = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const annDiffMs = announcementFri.getTime() - nowUtc.getTime();
    const daysUntilAnnouncement = Math.ceil(annDiffMs / (1000 * 60 * 60 * 24));

    const quarterNum = Math.floor(q.month / 3) + 1;
    const isPast = executionFri.getTime() < nowUtc.getTime();

    return {
      quarter: `${q.year} Q${quarterNum}`,
      year: q.year,
      quarterNumber: quarterNum,
      executionDate: toISODate(executionFri),
      executionFormatted: formatDate(executionFri),
      effectiveDate: toISODate(effectiveMon),
      effectiveFormatted: formatDate(effectiveMon),
      announcementDate: toISODate(announcementFri),
      announcementFormatted: formatDate(announcementFri),
      daysUntilExecution,
      daysUntilAnnouncement,
      isAnnualReconstitution: q.month === 11,
      isPast,
    };
  });

  // Find the next upcoming event (or if today is execution day, that one)
  const upcomingEvents = allEvents.filter((e) => !e.isPast);
  const nextRebalance = upcomingEvents[0] || allEvents[allEvents.length - 1];

  const nextQuarterUpcoming = upcomingEvents.slice(0, 5);

  const isDec = nextRebalance.quarterNumber === 4;

  return {
    nextRebalance,
    upcomingQuarters: nextQuarterUpcoming,
    qqq: {
      symbol: "QQQ",
      name: "Invesco QQQ Trust",
      tracks: "Nasdaq-100 Index (NDX)",
      nextRebalanceDate: nextRebalance.executionFormatted,
      effectiveDate: nextRebalance.effectiveFormatted,
      type: isDec ? "Quarterly Rebalance & Annual Reconstitution" : "Quarterly Rebalance",
      daysRemaining: nextRebalance.daysUntilExecution,
      description: isDec
        ? "Full annual constituent reconstitution and quarterly share weight realignment after the market close on the 3rd Friday of December."
        : "Quarterly portfolio reweighting aligning ETF holdings with updated Nasdaq-100 index float and constituent weight targets.",
    },
    spy: {
      symbol: "SPY",
      name: "SPDR S&P 500 ETF Trust",
      tracks: "S&P 500 Index (SPX)",
      nextRebalanceDate: nextRebalance.executionFormatted,
      effectiveDate: nextRebalance.effectiveFormatted,
      type: "Quarterly Share & Float Rebalance",
      daysRemaining: nextRebalance.daysUntilExecution,
      description: "Quarterly reweighting and share allocation adjustments based on updated float-adjusted shares and market capitalization.",
    },
    nasdaq100: {
      indexName: "Nasdaq-100 Index",
      symbol: "NDX",
      nextRebalanceDate: nextRebalance.executionFormatted,
      effectiveDate: nextRebalance.effectiveFormatted,
      announcementDate: nextRebalance.announcementFormatted,
      type: isDec ? "Annual Reconstitution & Quarterly Rebalance" : "Quarterly Weight Capping Review",
      daysRemaining: nextRebalance.daysUntilExecution,
      description: isDec
        ? "Official annual index reconstitution re-ranking top 100 non-financial companies, announcing additions/deletions on the 2nd Friday, and re-allocating weight caps on the 3rd Friday."
        : "Quarterly share adjustments and weight cap verification (ensuring single stocks ≤ 24% and cumulative weights > 4.5% sum ≤ 40%).",
      cappingRules: "Single stock max cap: 24.0% • Aggregate weight of companies > 4.5% cannot exceed 40.0%.",
    },
    sp100: {
      indexName: "S&P 100 Index",
      symbol: "OEX",
      nextRebalanceDate: nextRebalance.executionFormatted,
      effectiveDate: nextRebalance.effectiveFormatted,
      announcementDate: nextRebalance.announcementFormatted,
      type: "Quarterly Index Rebalance",
      daysRemaining: nextRebalance.daysUntilExecution,
      description: "Quarterly review of constituent float-adjusted market capitalization, Investable Weight Factors (IWF), and share counts by S&P Dow Jones Indices.",
      cappingRules: "Float-adjusted market capitalization weighting with constituent selection drawn from the highest-liquidity mega-cap leaders in the S&P 500.",
    },
  };
}
