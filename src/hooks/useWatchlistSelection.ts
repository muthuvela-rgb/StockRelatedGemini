import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { UserWatchlist } from "../types";

export interface WatchlistOption {
  /** Stable option value for a <select>, e.g. "wl-0". */
  value: string;
  label: string;
  tickers: string[];
}

/**
 * Enumerates the user's named watchlists as <select>-ready options, reading
 * directly from AuthContext (no prop drilling needed).
 *
 * Each tab keeps its own local "which universe am I scanning" state (as it
 * already did for "qqq"/"spy"/"custom"); this hook only supplies the
 * per-watchlist options and their tickers so a tab can render one option per
 * named watchlist instead of a single generic "My Watchlist" entry.
 * Selecting one is purely local to that tab — it never touches the app-wide
 * active watchlist (AuthContext.activeWatchlistIndex), so switching universes
 * in one scanner never affects any other tab.
 *
 * `fallbackTickers` covers guests / pre-hydration: the flat `watchlist` prop
 * most tabs already receive from App.tsx.
 */
export function useWatchlistOptions(fallbackTickers: string[]): WatchlistOption[] {
  const { watchlists } = useAuth();

  return useMemo<WatchlistOption[]>(() => {
    if (watchlists && watchlists.length > 0) {
      return watchlists.map((w: UserWatchlist, idx: number) => ({
        value: `wl-${idx}`,
        label: `${w.name} (${w.tickers.length} tickers)`,
        tickers: w.tickers,
      }));
    }
    return [
      {
        value: "wl-0",
        label: `My Watchlist (${fallbackTickers.length} tickers)`,
        tickers: fallbackTickers,
      },
    ];
  }, [watchlists, fallbackTickers]);
}
