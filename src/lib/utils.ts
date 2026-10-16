import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined || isNaN(val)) return "N/A";
  return "$" + val.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatPct(val: number | null | undefined, decimals = 2, withSign = false): string {
  if (val === null || val === undefined || isNaN(val)) return "N/A";
  const sign = withSign && val > 0 ? "+" : "";
  return `${sign}${val.toFixed(decimals)}%`;
}

export function formatLargeNumber(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val) || val === 0) return "N/A";
  if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  return `$${val.toLocaleString()}`;
}

/**
 * Returns Tailwind text color class for stock price:
 * - Red (text-rose-400) if price is down for the day
 * - Green (text-emerald-400) if price is up for the day
 * - Neutral (fallback) if unchanged or unknown
 */
export function getStockPriceColor(
  arg1?: any,
  fallbackOrChangePct?: number | null | string,
  isUp?: boolean | null,
  fallback = "text-slate-200"
): string {
  const effectiveFallback = typeof fallbackOrChangePct === "string" ? fallbackOrChangePct : fallback;

  if (arg1 && typeof arg1 === "object") {
    const isUpDay = arg1.is_up_day ?? arg1.isUpDay ?? null;
    const change = arg1.price_change ?? arg1.priceChange ?? arg1.dayChange ?? arg1.change ?? null;
    const pct = arg1.price_change_pct ?? arg1.priceChangePct ?? arg1.dayChangePct ?? arg1.pct_change ?? arg1.changePct ?? null;
    return getStockPriceColor(change, pct, isUpDay, effectiveFallback);
  }
  const change = arg1 as number | null | undefined;
  if (change !== undefined && change !== null && !isNaN(change)) {
    if (change > 0) return "text-emerald-400";
    if (change < 0) return "text-rose-400";
    return effectiveFallback;
  }
  const pct = typeof fallbackOrChangePct === "number" ? fallbackOrChangePct : null;
  if (pct !== undefined && pct !== null && !isNaN(pct)) {
    if (pct > 0) return "text-emerald-400";
    if (pct < 0) return "text-rose-400";
    return effectiveFallback;
  }
  if (isUp !== undefined && isUp !== null) {
    return isUp ? "text-emerald-400" : "text-rose-400";
  }
  return effectiveFallback;
}
