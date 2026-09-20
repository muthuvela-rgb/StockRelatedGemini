export interface FomcMeetingInfo {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dateFormatted: string; // e.g. "October 27–28, 2026"
  decisionDateFormatted: string; // e.g. "Wednesday, October 28, 2026 at 2:00 PM ET"
  pressConferenceFormatted: string; // e.g. "Wednesday, October 28, 2026 at 2:30 PM ET"
  title: string;
  hasSepDotPlot: boolean;
  daysRemaining: number;
  isToday: boolean;
  isImminent: boolean; // within 7 days
  blackoutStartDate: string; // YYYY-MM-DD
  blackoutEndDate: string; // YYYY-MM-DD
  blackoutFormatted: string;
  isInBlackout: boolean;
  daysUntilBlackout: number;
  minutesReleaseDate?: string;
  minutesReleaseFormatted?: string;
  chairperson: string;
  description: string;
  keyThemes: string[];
}

export interface FomcScheduleReport {
  nextMeeting: FomcMeetingInfo;
  subsequentMeeting: FomcMeetingInfo;
  upcomingMeetings: FomcMeetingInfo[];
  recentPastMeeting?: {
    dateFormatted: string;
    decision: string;
    rateRange: string;
  };
}

const CONFIRMED_FOMC_MEETINGS = [
  {
    id: "fomc-2026-09",
    startDate: "2026-09-15",
    endDate: "2026-09-16",
    dateFormatted: "September 15–16, 2026",
    title: "FOMC Policy Decision & Summary of Economic Projections (SEP)",
    hasSepDotPlot: true,
    blackoutStartDate: "2026-09-05",
    blackoutEndDate: "2026-09-16",
    blackoutFormatted: "September 5–16, 2026",
    minutesReleaseDate: "2026-10-07",
    minutesReleaseFormatted: "Wednesday, October 7, 2026",
    chairperson: "Chair Jerome Powell",
    description: "Autumn rate recalibration with updated Dot Plot terminal rate projections and inflation horizon.",
    keyThemes: ["Terminal Fed Funds Target", "PCE Inflation Target", "Balance Sheet QT Runoff"],
  },
  {
    id: "fomc-2026-10",
    startDate: "2026-10-27",
    endDate: "2026-10-28",
    dateFormatted: "October 27–28, 2026",
    title: "FOMC Interest Rate Decision & Press Conference",
    hasSepDotPlot: false,
    blackoutStartDate: "2026-10-17",
    blackoutEndDate: "2026-10-28",
    blackoutFormatted: "October 17–28, 2026",
    minutesReleaseDate: "2026-11-18",
    minutesReleaseFormatted: "Wednesday, November 18, 2026",
    chairperson: "Chair Jerome Powell",
    description: "Key monetary policy announcement reviewing autumn labor market trends, Treasury yield curve inversion/steepening, and commercial bank credit stability.",
    keyThemes: ["Rate Decision", "Labor Market Resilience", "Real Neutral Rate (r*)", "Treasury Liquidity"],
  },
  {
    id: "fomc-2026-12",
    startDate: "2026-12-08",
    endDate: "2026-12-09",
    dateFormatted: "December 8–9, 2026",
    title: "FOMC Year-End Rate Decision & 2027 Macro SEP Dot Plot",
    hasSepDotPlot: true,
    blackoutStartDate: "2026-11-28",
    blackoutEndDate: "2026-12-09",
    blackoutFormatted: "November 28 – December 9, 2026",
    minutesReleaseDate: "2027-01-06",
    minutesReleaseFormatted: "Wednesday, January 6, 2027",
    chairperson: "Chair Jerome Powell",
    description: "Annual finale with updated 2027-2028 economic forecast projections, GDP outlook, and long-term interest rate target path.",
    keyThemes: ["2027 Dot Plot", "Terminal Funds Rate", "GDP & Unemployment Forecasts"],
  },
  {
    id: "fomc-2027-01",
    startDate: "2027-01-26",
    endDate: "2027-01-27",
    dateFormatted: "January 26–27, 2027",
    title: "FOMC Policy Decision & Press Conference",
    hasSepDotPlot: false,
    blackoutStartDate: "2027-01-16",
    blackoutEndDate: "2027-01-27",
    blackoutFormatted: "January 16–27, 2027",
    minutesReleaseDate: "2027-02-17",
    minutesReleaseFormatted: "Wednesday, February 17, 2027",
    chairperson: "Chair Jerome Powell",
    description: "First policy meeting of 2027 reviewing Q4 economic output, fiscal deficit trajectory, and financial conditions.",
    keyThemes: ["Annual Policy Stance", "Financial Conditions Index", "Inflation Momentum"],
  },
  {
    id: "fomc-2027-03",
    startDate: "2027-03-16",
    endDate: "2027-03-17",
    dateFormatted: "March 16–17, 2027",
    title: "FOMC Policy Decision & Q1 SEP Dot Plot",
    hasSepDotPlot: true,
    blackoutStartDate: "2027-03-06",
    blackoutEndDate: "2027-03-17",
    blackoutFormatted: "March 6–17, 2027",
    minutesReleaseDate: "2027-04-07",
    minutesReleaseFormatted: "Wednesday, April 7, 2027",
    chairperson: "Chair Jerome Powell",
    description: "Spring quarterly projection meeting updating the 2027 interest rate path and economic expectations.",
    keyThemes: ["Spring Dot Plot", "PCE Inflation", "Labor Supply"],
  },
];

export function getFomcSchedule(currentDate: Date = new Date()): FomcScheduleReport {
  const now = new Date(currentDate);
  // Zero out time for clean calendar date comparisons
  const todayStr = now.toISOString().split("T")[0];

  const processedMeetings: FomcMeetingInfo[] = CONFIRMED_FOMC_MEETINGS.map((m) => {
    const endDateTime = new Date(`${m.endDate}T23:59:59`);
    const startDateTime = new Date(`${m.startDate}T00:00:00`);
    const blackoutStart = new Date(`${m.blackoutStartDate}T00:00:00`);
    const blackoutEnd = new Date(`${m.blackoutEndDate}T23:59:59`);

    const diffDays = Math.ceil((startDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const blackoutDiffDays = Math.ceil((blackoutStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const isToday = todayStr >= m.startDate && todayStr <= m.endDate;
    const isInBlackout = now >= blackoutStart && now <= blackoutEnd;

    // Decision time is 2:00 PM Eastern on endDate
    const decisionDate = new Date(`${m.endDate}T14:00:00-04:00`);
    const decisionFormatted = `${decisionDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })} at 2:00 PM ET`;
    const pressConferenceFormatted = `${decisionDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })} at 2:30 PM ET`;

    return {
      ...m,
      decisionDateFormatted: decisionFormatted,
      pressConferenceFormatted,
      daysRemaining: Math.max(0, diffDays),
      isToday,
      isImminent: diffDays <= 7 && diffDays >= 0,
      isInBlackout,
      daysUntilBlackout: Math.max(0, blackoutDiffDays),
    };
  });

  // Upcoming meetings are those whose end date is >= today
  const upcoming = processedMeetings.filter((m) => m.endDate >= todayStr);

  const nextMeeting = upcoming[0] || processedMeetings[processedMeetings.length - 1];
  const subsequentMeeting = upcoming[1] || processedMeetings[processedMeetings.length - 1];

  return {
    nextMeeting,
    subsequentMeeting,
    upcomingMeetings: upcoming,
    recentPastMeeting: {
      dateFormatted: "September 15–16, 2026",
      decision: "Fed Funds Rate Maintained / Recalibrated at 4.75% – 5.00%",
      rateRange: "4.75% – 5.00%",
    },
  };
}
