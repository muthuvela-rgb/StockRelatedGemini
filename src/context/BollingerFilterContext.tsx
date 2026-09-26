import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

export type BollingerPresetKey =
  | "all"
  | "oversold"
  | "near_lower"
  | "lower_half"
  | "neutral"
  | "upper_half"
  | "overbought";

export interface BollingerPresetItem {
  key: BollingerPresetKey;
  label: string;
  range: [number, number];
  tip: string;
}

export const CENTRAL_BOLLINGER_PRESETS: BollingerPresetItem[] = [
  {
    key: "all",
    label: "All (%B -20%–120%)",
    range: [-20, 120],
    tip: "Full Bollinger Bands envelope without %B filtering",
  },
  {
    key: "oversold",
    label: "Below Lower Band (≤ 0%)",
    range: [-20, 0],
    tip: "Extreme oversold dip pierced below 20d lower band — maximum margin of safety for put selling",
  },
  {
    key: "near_lower",
    label: "Near Lower Band (0%–25%)",
    range: [0, 25],
    tip: "Hugging lower Bollinger support band — high probability bounce zone",
  },
  {
    key: "lower_half",
    label: "Lower Half / Dip (0%–50%)",
    range: [0, 50],
    tip: "Below 20-day SMA middle band — favorable dip-buying entry",
  },
  {
    key: "neutral",
    label: "Neutral / Mean (40%–60%)",
    range: [40, 60],
    tip: "Consolidating near 20-day SMA mean reversion baseline",
  },
  {
    key: "upper_half",
    label: "Upper Half (50%–100%)",
    range: [50, 100],
    tip: "Above 20-day SMA towards upper resistance envelope",
  },
  {
    key: "overbought",
    label: "Above Upper Band (≥ 100%)",
    range: [100, 120],
    tip: "Overbought / momentum breakout riding above upper band",
  },
];

export interface BollingerFilterContextType {
  // Current active range [-20, 120]
  bollingerRange: [number, number];
  setBollingerRange: React.Dispatch<React.SetStateAction<[number, number]>>;
  resetBollingerRange: () => void;

  // Active filter state
  isBollingerFiltered: boolean;
  activePreset: BollingerPresetKey | "custom";
  applyPreset: (presetKey: BollingerPresetKey) => void;

  // Predicate: check if a raw numeric %B (decimal or percentage) passes the current range
  matchesBollinger: (percentB: number | null | undefined, isPercentage?: boolean) => boolean;

  // Entity Predicate: checks an entire item (record, recommendation, candidate, stock)
  matchesBollingerEntity: (entity: any) => boolean;

  // Helper to compute %B from price and bounds
  computePercentB: (
    price: number,
    lower?: number | null,
    upper?: number | null,
    sma?: number | null
  ) => number | null;
}

const BollingerFilterContext = createContext<BollingerFilterContextType>({
  bollingerRange: [-20, 120],
  setBollingerRange: () => {},
  resetBollingerRange: () => {},
  isBollingerFiltered: false,
  activePreset: "all",
  applyPreset: () => {},
  matchesBollinger: () => true,
  matchesBollingerEntity: () => true,
  computePercentB: () => null,
});

export const useBollingerFilter = () => useContext(BollingerFilterContext);

interface BollingerFilterProviderProps {
  children: React.ReactNode;
}

export const BollingerFilterProvider: React.FC<BollingerFilterProviderProps> = ({ children }) => {
  const [bollingerRange, setBollingerRange] = useState<[number, number]>([-20, 120]);

  const isBollingerFiltered = useMemo(() => {
    return bollingerRange[0] > -20 || bollingerRange[1] < 120;
  }, [bollingerRange]);

  const resetBollingerRange = useCallback(() => {
    setBollingerRange([-20, 120]);
  }, []);

  const activePreset = useMemo<BollingerPresetKey | "custom">(() => {
    for (const p of CENTRAL_BOLLINGER_PRESETS) {
      if (bollingerRange[0] === p.range[0] && bollingerRange[1] === p.range[1]) {
        return p.key;
      }
    }
    return "custom";
  }, [bollingerRange]);

  const applyPreset = useCallback((presetKey: BollingerPresetKey) => {
    const found = CENTRAL_BOLLINGER_PRESETS.find((p) => p.key === presetKey);
    if (found) {
      setBollingerRange(found.range);
    }
  }, []);

  const computePercentB = useCallback(
    (
      price: number,
      lower?: number | null,
      upper?: number | null,
      sma?: number | null
    ): number | null => {
      if (price === undefined || price === null || isNaN(price)) return null;

      if (upper !== null && upper !== undefined && lower !== null && lower !== undefined && upper !== lower) {
        return Number((((price - lower) / (upper - lower)) * 100).toFixed(1));
      }

      if (lower !== null && lower !== undefined && sma !== null && sma !== undefined && sma !== lower) {
        const impliedUpper = sma + (sma - lower);
        if (impliedUpper !== lower) {
          return Number((((price - lower) / (impliedUpper - lower)) * 100).toFixed(1));
        }
      }

      return null;
    },
    []
  );

  const matchesBollinger = useCallback(
    (rawPctB: number | null | undefined, isPercentage = false): boolean => {
      // 1. If filter is not active, all items pass
      if (!isBollingerFiltered) return true;

      // 2. Filter is active: items without Bollinger metrics fail verification
      if (rawPctB === null || rawPctB === undefined || isNaN(rawPctB)) {
        return false;
      }

      // 3. Normalize to percentage scale (-20 to 120)
      // In our server backend, percent_b is standard decimal: (price - lower) / (upper - lower).
      // E.g. 0.45 = 45%, 1.05 = 105%, -0.10 = -10%.
      // If isPercentage is true or |rawPctB| > 2.5, it is already on 0..100 scale.
      const val = isPercentage || Math.abs(rawPctB) > 2.5 ? rawPctB : rawPctB * 100;

      return val >= bollingerRange[0] && val <= bollingerRange[1];
    },
    [isBollingerFiltered, bollingerRange]
  );

  const matchesBollingerEntity = useCallback(
    (entity: any): boolean => {
      if (!isBollingerFiltered) return true;
      if (!entity) return false;

      // Check entity fields in order of prevalence:
      // 1. entity.bollinger?.percent_b (PutScanner, PutRecommendations, ShortDated, Technicals)
      if (entity.bollinger?.percent_b !== undefined && entity.bollinger?.percent_b !== null) {
        return matchesBollinger(entity.bollinger.percent_b, false);
      }

      // 2. entity.technicals?.bollinger?.percent_b (FallDetector, PutRecommendations technicals)
      if (entity.technicals?.bollinger?.percent_b !== undefined && entity.technicals?.bollinger?.percent_b !== null) {
        return matchesBollinger(entity.technicals.bollinger.percent_b, false);
      }

      // 3. entity.bollingerPercentB (stockChart summaries)
      if (entity.bollingerPercentB !== undefined && entity.bollingerPercentB !== null) {
        return matchesBollinger(entity.bollingerPercentB, false);
      }

      // 4. entity.percent_b directly
      if (entity.percent_b !== undefined && entity.percent_b !== null) {
        return matchesBollinger(entity.percent_b, false);
      }

      // 5. Raw bounds: c.bb_upper, c.bb_lower, c.bb_sma, c.current_price (CspRsiDivergenceCandidate)
      if (
        (entity.bb_upper || entity.bb_lower || entity.bb_sma) &&
        (entity.current_price || entity.price)
      ) {
        const p = entity.current_price || entity.price;
        const computed = computePercentB(p, entity.bb_lower, entity.bb_upper, entity.bb_sma);
        if (computed !== null) {
          return matchesBollinger(computed, true);
        }
      }

      // 6. Underlying price and bollinger on parent object (e.g. option chain row with chainData)
      if (entity.chainData?.bollinger?.percent_b !== undefined && entity.chainData?.bollinger?.percent_b !== null) {
        return matchesBollinger(entity.chainData.bollinger.percent_b, false);
      }

      // Filter is active and entity has no usable Bollinger data -> filter out
      return false;
    },
    [isBollingerFiltered, matchesBollinger, computePercentB]
  );

  const contextValue = useMemo(
    () => ({
      bollingerRange,
      setBollingerRange,
      resetBollingerRange,
      isBollingerFiltered,
      activePreset,
      applyPreset,
      matchesBollinger,
      matchesBollingerEntity,
      computePercentB,
    }),
    [
      bollingerRange,
      resetBollingerRange,
      isBollingerFiltered,
      activePreset,
      applyPreset,
      matchesBollinger,
      matchesBollingerEntity,
      computePercentB,
    ]
  );

  return (
    <BollingerFilterContext.Provider value={contextValue}>
      {children}
    </BollingerFilterContext.Provider>
  );
};
