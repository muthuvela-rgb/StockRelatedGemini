/**
 * Utility functions for determining whether a stock or asset's price is up or down for the day,
 * and returning consistent Tailwind styling (emerald/green for up, rose/red for down).
 */

export function isPriceUpDay(
  isUpDay?: boolean | null,
  priceChange?: number | null,
  priceChangePct?: number | null
): boolean | null {
  if (priceChange !== undefined && priceChange !== null) {
    if (priceChange > 0) return true;
    if (priceChange < 0) return false;
    return null;
  }
  if (priceChangePct !== undefined && priceChangePct !== null) {
    if (priceChangePct > 0) return true;
    if (priceChangePct < 0) return false;
    return null;
  }
  if (isUpDay !== undefined && isUpDay !== null) {
    return isUpDay;
  }
  return null;
}

export function getStockPriceColorClass(
  isUpDay?: boolean | null,
  priceChange?: number | null,
  priceChangePct?: number | null,
  neutralFallback: string = "text-slate-200"
): string {
  const isUp = isPriceUpDay(isUpDay, priceChange, priceChangePct);
  if (isUp === true) return "text-emerald-400";
  if (isUp === false) return "text-rose-400";
  return neutralFallback;
}

export function getStockPriceColor(
  item?: {
    is_up_day?: boolean | null;
    isUpDay?: boolean | null;
    price_change?: number | null;
    priceChange?: number | null;
    dayChange?: number | null;
    price_change_pct?: number | null;
    priceChangePct?: number | null;
    dayChangePct?: number | null;
    pct_change?: number | null;
    change?: number | null;
    changePct?: number | null;
  } | null,
  neutralFallback: string = "text-slate-200"
): string {
  if (!item) return neutralFallback;
  const isUp = item.is_up_day ?? item.isUpDay ?? null;
  const change = item.price_change ?? item.priceChange ?? item.dayChange ?? item.change ?? null;
  const changePct = item.price_change_pct ?? item.priceChangePct ?? item.dayChangePct ?? item.pct_change ?? item.changePct ?? null;
  return getStockPriceColorClass(isUp, change, changePct, neutralFallback);
}
