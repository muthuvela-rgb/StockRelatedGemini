export interface FibonacciLevels {
  level_0: number;    // 0.0% (52w Low)
  level_236: number;  // 23.6%
  level_382: number;  // 38.2%
  level_500: number;  // 50.0% (Midpoint)
  level_618: number;  // 61.8% (Golden Ratio)
  level_1000: number; // 100.0% (52w High)
}

export interface FibLevelDetail {
  ratioKey: "level_0" | "level_236" | "level_382" | "level_500" | "level_618" | "level_1000";
  pctStr: string;        // "0.0%", "23.6%", "38.2%", "50.0%", "61.8%", "100.0%"
  name: string;          // "0.0% (52W Low)", "23.6% Retracement", "38.2% Retracement", "50.0% Midpoint", "61.8% Golden Ratio", "100.0% (52W High)"
  shortName: string;     // "0% Low", "23.6%", "38.2%", "50% Mid", "61.8% Golden", "100% High"
  value: number;         // e.g. 145.20
  diff: number;          // strike - value
  absDiff: number;       // Math.abs(strike - value)
  diffPct: number;       // ((strike - value) / value) * 100
  isClosest: boolean;
  isAbove: boolean;
  isBelow: boolean;
  isExact: boolean;
}

export interface ClosestFibonacciResult {
  closest: FibLevelDetail;
  allLevels: FibLevelDetail[];
  strike: number;
  levels: FibonacciLevels;
}

export function computeFibonacciLevels(
  fibData?: Partial<FibonacciLevels> | null,
  high52w?: number | null,
  low52w?: number | null
): FibonacciLevels | null {
  if (
    fibData &&
    typeof fibData.level_0 === "number" &&
    typeof fibData.level_1000 === "number" &&
    fibData.level_1000 > fibData.level_0
  ) {
    const l0 = fibData.level_0;
    const l1000 = fibData.level_1000;
    const range = l1000 - l0;
    return {
      level_0: Number(l0.toFixed(2)),
      level_236: typeof fibData.level_236 === "number" ? Number(fibData.level_236.toFixed(2)) : Number((l0 + range * 0.236).toFixed(2)),
      level_382: typeof fibData.level_382 === "number" ? Number(fibData.level_382.toFixed(2)) : Number((l0 + range * 0.382).toFixed(2)),
      level_500: typeof fibData.level_500 === "number" ? Number(fibData.level_500.toFixed(2)) : Number((l0 + range * 0.500).toFixed(2)),
      level_618: typeof fibData.level_618 === "number" ? Number(fibData.level_618.toFixed(2)) : Number((l0 + range * 0.618).toFixed(2)),
      level_1000: Number(l1000.toFixed(2)),
    };
  }

  if (high52w && low52w && high52w > low52w) {
    const range = high52w - low52w;
    return {
      level_0: Number(low52w.toFixed(2)),
      level_236: Number((low52w + range * 0.236).toFixed(2)),
      level_382: Number((low52w + range * 0.382).toFixed(2)),
      level_500: Number((low52w + range * 0.500).toFixed(2)),
      level_618: Number((low52w + range * 0.618).toFixed(2)),
      level_1000: Number(high52w.toFixed(2)),
    };
  }

  return null;
}

export function findClosestFibonacci(
  strike?: number | null,
  fibData?: Partial<FibonacciLevels> | null,
  high52w?: number | null,
  low52w?: number | null
): ClosestFibonacciResult | null {
  if (strike === undefined || strike === null || isNaN(strike) || strike <= 0) {
    return null;
  }

  const levels = computeFibonacciLevels(fibData, high52w, low52w);
  if (!levels) return null;

  const rawLevelDefs: Array<{
    ratioKey: FibLevelDetail["ratioKey"];
    pctStr: string;
    name: string;
    shortName: string;
    value: number;
  }> = [
    { ratioKey: "level_0", pctStr: "0.0%", name: "0.0% (52W Low)", shortName: "0.0% Low", value: levels.level_0 },
    { ratioKey: "level_236", pctStr: "23.6%", name: "23.6% Retracement", shortName: "23.6%", value: levels.level_236 },
    { ratioKey: "level_382", pctStr: "38.2%", name: "38.2% Retracement", shortName: "38.2%", value: levels.level_382 },
    { ratioKey: "level_500", pctStr: "50.0%", name: "50.0% Retracement (Midpoint)", shortName: "50.0% Mid", value: levels.level_500 },
    { ratioKey: "level_618", pctStr: "61.8%", name: "61.8% Retracement (Golden Ratio)", shortName: "61.8% Golden", value: levels.level_618 },
    { ratioKey: "level_1000", pctStr: "100.0%", name: "100.0% (52W High)", shortName: "100.0% High", value: levels.level_1000 },
  ];

  let minDiff = Infinity;
  let closestIdx = 0;

  const details: FibLevelDetail[] = rawLevelDefs.map((def, idx) => {
    const diff = Number((strike - def.value).toFixed(2));
    const absDiff = Math.abs(diff);
    const diffPct = def.value > 0 ? Number(((diff / def.value) * 100).toFixed(1)) : 0;
    const isExact = absDiff < 0.05;

    if (absDiff < minDiff) {
      minDiff = absDiff;
      closestIdx = idx;
    }

    return {
      ratioKey: def.ratioKey,
      pctStr: def.pctStr,
      name: def.name,
      shortName: def.shortName,
      value: def.value,
      diff,
      absDiff,
      diffPct,
      isClosest: false,
      isAbove: diff > 0,
      isBelow: diff < 0,
      isExact,
    };
  });

  details[closestIdx].isClosest = true;

  return {
    closest: details[closestIdx],
    allLevels: details,
    strike,
    levels,
  };
}
