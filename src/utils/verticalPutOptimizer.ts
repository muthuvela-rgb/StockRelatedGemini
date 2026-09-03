export interface VerticalPutSpread {
  id: string;
  ticker: string;
  expiration: string;
  dte: number;
  spotPrice: number;
  sellStrike: number;
  sellPremium: number; // Bid collected from selling higher strike
  sellAsk?: number;
  buyStrike: number;
  buyPremium: number;  // Ask paid for buying lower strike
  buyBid?: number;
  netCredit: number;   // Net premium collected per share (sellPremium - buyPremium)
  totalCredit100: number; // Net premium per 100-share contract
  spreadWidth: number; // sellStrike - buyStrike
  maxRisk: number;     // Collateral requirement: (spreadWidth - netCredit)
  maxRisk100: number;  // Max loss per contract
  returnOnRisk: number; // (netCredit / maxRisk) * 100
  annualizedReturnOnRisk: number; // returnOnRisk * (365 / dte)
  breakeven: number;   // sellStrike - netCredit
  downsideCushionPct: number; // ((spotPrice - sellStrike) / spotPrice) * 100
  isOTM: boolean;      // sellStrike <= spotPrice
}

export interface VerticalPutOptimizerOptions {
  widthFilter?: "ALL" | number;
  cushionFilter?: "ALL" | "OTM_ONLY" | "BUFFER_5";
}

export interface OptionStrikeData {
  strike: number;
  bid?: number;
  ask?: number;
  premium?: number;
  expiration?: string;
  days_to_expiration?: number;
  current_price?: number;
}

/**
 * Finds and ranks all valid Vertical Put Spreads (Credit Put Spreads / Bull Put Spreads)
 * for a given stock and expiration date.
 *
 * Definition:
 * - Higher strike price is Sold (Short Put) -> collects Bid premium
 * - Lower strike price is Bought (Long Put) -> pays Ask premium
 *
 * Ranked by Max Total Premium Collected (Net Credit) descending.
 */
export function findVerticalPutSpreads(
  data: OptionStrikeData[],
  ticker: string,
  expiration: string,
  spotPrice: number,
  dte: number,
  options: VerticalPutOptimizerOptions = {}
): VerticalPutSpread[] {
  if (!data || data.length < 2) return [];

  // Group and sort distinct strikes ascending
  const strikeMap = new Map<number, OptionStrikeData>();
  for (const item of data) {
    if (typeof item.strike === "number" && !isNaN(item.strike) && item.strike > 0) {
      // If duplicate strike entries exist, preserve the best bid
      const existing = strikeMap.get(item.strike);
      const currentBid = item.bid ?? item.premium ?? 0;
      const existingBid = existing ? (existing.bid ?? existing.premium ?? 0) : -1;
      if (!existing || currentBid > existingBid) {
        strikeMap.set(item.strike, item);
      }
    }
  }

  const sortedStrikes = Array.from(strikeMap.keys()).sort((a, b) => a - b);
  const spreads: VerticalPutSpread[] = [];

  const effectiveDte = Math.max(1, dte || 1);

  // Iterate over all pairs (K_buy, K_sell) where K_buy < K_sell
  for (let i = 0; i < sortedStrikes.length; i++) {
    const buyStrike = sortedStrikes[i];
    const buyData = strikeMap.get(buyStrike)!;
    // For buying the lower strike put, price paid is ask (or bid if ask is absent)
    const buyPrice =
      buyData.ask && buyData.ask > 0
        ? buyData.ask
        : buyData.premium && buyData.premium > 0
        ? buyData.premium
        : buyData.bid ?? 0;

    for (let j = i + 1; j < sortedStrikes.length; j++) {
      const sellStrike = sortedStrikes[j];
      const sellData = strikeMap.get(sellStrike)!;
      // For selling the higher strike put, price received is bid (or premium)
      const sellPrice =
        sellData.bid && sellData.bid > 0
          ? sellData.bid
          : sellData.premium && sellData.premium > 0
          ? sellData.premium
          : 0;

      const netCredit = sellPrice - buyPrice;

      // Only valid credit spreads where net premium collected > 0
      if (netCredit > 0.01) {
        const spreadWidth = sellStrike - buyStrike;
        const maxRisk = Math.max(0.01, spreadWidth - netCredit);
        const returnOnRisk = (netCredit / maxRisk) * 100;
        const annualizedReturnOnRisk = returnOnRisk * (365 / effectiveDte);
        const breakeven = sellStrike - netCredit;
        const downsideCushionPct = spotPrice > 0 ? ((spotPrice - sellStrike) / spotPrice) * 100 : 0;
        const isOTM = spotPrice > 0 ? sellStrike <= spotPrice : true;

        // Apply width filter if specified
        if (options.widthFilter && options.widthFilter !== "ALL") {
          const targetWidth = options.widthFilter;
          // Tolerance for float comparison
          if (Math.abs(spreadWidth - targetWidth) > 0.05) {
            continue;
          }
        }

        // Apply cushion filter
        if (options.cushionFilter === "OTM_ONLY" && !isOTM) {
          continue;
        }
        if (options.cushionFilter === "BUFFER_5" && downsideCushionPct < 5) {
          continue;
        }

        spreads.push({
          id: `${ticker}-${expiration}-${sellStrike}-${buyStrike}`,
          ticker,
          expiration,
          dte: effectiveDte,
          spotPrice,
          sellStrike,
          sellPremium: sellPrice,
          sellAsk: sellData.ask,
          buyStrike,
          buyPremium: buyPrice,
          buyBid: buyData.bid,
          netCredit,
          totalCredit100: netCredit * 100,
          spreadWidth,
          maxRisk,
          maxRisk100: maxRisk * 100,
          returnOnRisk,
          annualizedReturnOnRisk,
          breakeven,
          downsideCushionPct,
          isOTM,
        });
      }
    }
  }

  // Sort by Max Total Premium Collected (Net Credit) descending
  spreads.sort((a, b) => b.netCredit - a.netCredit);

  return spreads;
}
