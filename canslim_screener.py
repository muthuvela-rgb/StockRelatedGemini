#!/usr/bin/env python3
"""
canslim_screener.py

Screens a list of tickers against William O'Neil's CANSLIM 7-point
checklist -- the framework behind Investor's Business Daily's study of
history's top-performing "monster stocks" (1880-2009).

The 7 criteria (one per letter):
  C - Current Quarterly Earnings: most recent quarter's diluted EPS
      growth vs. the same quarter a year ago.
  A - Annual Earnings Growth: multi-year diluted EPS CAGR.
  N - New High: price within a tight band of its 52-week high (the
      standard objective proxy for "something new" driving the stock,
      since genuine product/management catalysts aren't machine
      readable).
  S - Supply & Demand: shares outstanding (float) + a recent volume
      surge vs. the 3-month average (accumulation signal).
  L - Leader vs. Laggard: trailing 12-month return percentile rank
      against the Nasdaq-100 constituents, as a DIY approximation of
      IBD's proprietary RS Rating.
  I - Institutional Sponsorship: % of shares held by institutions.
  M - Market Direction: is the overall market (QQQ by default) in a
      confirmed uptrend (above its 50/200-day moving averages)? This
      is computed once per run and applied to every ticker.

Usage:
  python canslim_screener.py --tickers NVDA,PLTR,AVGO
  python canslim_screener.py --tickers-file tickers.txt --csv-out results.csv
  python canslim_screener.py --from-watchlist --benchmark QQQ

Prerequisites:
  pip install yfinance pandas requests

No API keys required -- uses Yahoo Finance (via yfinance) and the
public Nasdaq-100 constituents API, consistent with this project's
"no paid data feeds required" approach.
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime
from typing import Optional

import pandas as pd
import requests
import yfinance as yf

# ---------------------------------------------------------------------------
# CANSLIM thresholds -- tune these to adjust screening strictness.
# ---------------------------------------------------------------------------
CURRENT_EPS_GROWTH_MIN_PCT = 25.0      # C: QoQ (YoY-quarter) EPS growth
ANNUAL_EPS_CAGR_MIN_PCT = 25.0         # A: multi-year EPS CAGR
NEW_HIGH_PROXIMITY_PCT = 10.0          # N: price must be within 10% of 52w high
MAX_SHARES_OUTSTANDING = 50_000_000    # S: O'Neil's classic small-float threshold.
                                        #    Mostly obsolete for today's mega/large
                                        #    caps, so it no longer gates the S pass/
                                        #    fail call -- it only discounts S's
                                        #    weight in the overall score (see
                                        #    LARGE_FLOAT_WEIGHT below).
LARGE_FLOAT_WEIGHT = 0.5               # S: weight applied when float > MAX_SHARES_OUTSTANDING
VOLUME_SURGE_MIN_PCT = 40.0            # S: recent volume vs. 3-month average
RS_PERCENTILE_MIN = 80.0               # L: percentile rank within Nasdaq-100
INSTITUTIONAL_OWNERSHIP_MIN_PCT = 30.0  # I: % shares held by institutions
SCORE_STRONG_MIN = 6                   # verdict tiers, on the weighted score
SCORE_WATCH_MIN = 4                    #    (max possible is 7, or less when S is
                                        #    discounted or some criteria are N/A)

STATIC_NASDAQ100_FALLBACK = [
    "NVDA", "AAPL", "MSFT", "AMZN", "AVGO", "GOOGL", "META", "TSLA", "MU", "AMD",
    "COST", "NFLX", "PLTR", "ADBE", "CSCO", "QCOM", "TXN", "AMAT", "INTU", "AMGN",
]

HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Accept": "application/json",
}


# ---------------------------------------------------------------------------
# Universe resolution (for the "L" leadership benchmark)
# ---------------------------------------------------------------------------
def fetch_nasdaq100_constituents() -> tuple[list[str], str]:
    """Resolves the current Nasdaq-100 constituents, with graceful fallbacks."""
    try:
        r = requests.get(
            "https://api.nasdaq.com/api/quote/list-type/nasdaq100",
            headers=HTTP_HEADERS,
            timeout=15,
        )
        r.raise_for_status()
        rows = r.json().get("data", {}).get("data", {}).get("rows", [])
        symbols = sorted({row["symbol"].upper() for row in rows if row.get("symbol")})
        if len(symbols) >= 50:
            return symbols, "nasdaq100-api"
        raise ValueError(f"Too few symbols returned ({len(symbols)})")
    except Exception as e:
        print(f"[universe] Nasdaq-100 API failed ({e}); using static fallback list.",
              file=sys.stderr)
        return STATIC_NASDAQ100_FALLBACK, "static-fallback"


# ---------------------------------------------------------------------------
# Market direction (M) -- computed once per run
# ---------------------------------------------------------------------------
def compute_market_direction(benchmark: str = "QQQ") -> dict:
    hist = yf.Ticker(benchmark).history(period="1y", interval="1d")
    if hist.empty or len(hist) < 200:
        return {"passed": None, "detail": f"Insufficient history for {benchmark}"}

    close = hist["Close"]
    last_price = float(close.iloc[-1])
    sma50 = float(close.tail(50).mean())
    sma200 = float(close.tail(200).mean())
    passed = last_price > sma50 > sma200

    return {
        "passed": passed,
        "benchmark": benchmark,
        "last_price": round(last_price, 2),
        "sma50": round(sma50, 2),
        "sma200": round(sma200, 2),
        "detail": f"{benchmark} ${last_price:.2f} vs 50d ${sma50:.2f} / 200d ${sma200:.2f}",
    }


# ---------------------------------------------------------------------------
# Relative Strength universe (L) -- trailing 12-month returns for percentile ranking
# ---------------------------------------------------------------------------
def compute_universe_returns(universe: list[str]) -> dict[str, float]:
    """Fetches trailing 12-month % return for every ticker in the RS benchmark universe."""
    returns: dict[str, float] = {}
    try:
        data = yf.download(
            universe, period="1y", interval="1d",
            group_by="ticker", threads=True, progress=False,
        )
    except Exception as e:
        print(f"[universe] Bulk download for RS universe failed: {e}", file=sys.stderr)
        return returns

    for sym in universe:
        try:
            closes = data[sym]["Close"].dropna() if len(universe) > 1 else data["Close"].dropna()
            if len(closes) < 2:
                continue
            ret = (float(closes.iloc[-1]) / float(closes.iloc[0]) - 1.0) * 100
            returns[sym] = ret
        except Exception:
            continue
    return returns


def percentile_rank(value: float, population: list[float]) -> Optional[float]:
    if not population:
        return None
    below_or_equal = sum(1 for v in population if v <= value)
    return round((below_or_equal / len(population)) * 100, 1)


# ---------------------------------------------------------------------------
# Per-ticker raw data fetch
# ---------------------------------------------------------------------------
def fetch_ticker_data(ticker: str) -> dict:
    t = yf.Ticker(ticker)
    out: dict = {"ticker": ticker}

    # Quarterly & annual EPS
    try:
        qis = t.quarterly_income_stmt
        out["quarterly_eps"] = qis.loc["Diluted EPS"].dropna() if qis is not None and "Diluted EPS" in qis.index else None
    except Exception:
        out["quarterly_eps"] = None

    try:
        ais = t.income_stmt
        out["annual_eps"] = ais.loc["Diluted EPS"].dropna() if ais is not None and "Diluted EPS" in ais.index else None
    except Exception:
        out["annual_eps"] = None

    # Price/volume/shares
    try:
        fi = t.fast_info
        out["last_price"] = fi.get("lastPrice")
        out["year_high"] = fi.get("yearHigh")
        out["shares_outstanding"] = fi.get("shares")
        out["three_month_avg_volume"] = fi.get("threeMonthAverageVolume")
        out["last_volume"] = fi.get("lastVolume")
    except Exception:
        pass

    # Institutional ownership
    try:
        mh = t.major_holders
        if mh is not None and "institutionsPercentHeld" in mh.index:
            out["institutions_pct"] = float(mh.loc["institutionsPercentHeld"].iloc[0]) * 100
        else:
            out["institutions_pct"] = None
    except Exception:
        out["institutions_pct"] = None

    # 12-month return for RS ranking (only needed if not already in universe_returns)
    try:
        hist = t.history(period="1y", interval="1d")["Close"].dropna()
        out["twelve_month_return_pct"] = (
            (float(hist.iloc[-1]) / float(hist.iloc[0]) - 1.0) * 100 if len(hist) >= 2 else None
        )
    except Exception:
        out["twelve_month_return_pct"] = None

    return out


# ---------------------------------------------------------------------------
# Per-criterion scoring
# ---------------------------------------------------------------------------
def score_current_earnings(d: dict) -> dict:
    q = d.get("quarterly_eps")
    if q is None or len(q) < 2:
        return {"passed": None, "value": None, "detail": "Insufficient quarterly EPS history"}
    latest_date, latest_eps = q.index[0], q.iloc[0]
    target_date = latest_date - pd.DateOffset(years=1)
    prior = q[q.index <= target_date + pd.Timedelta(days=45)]
    prior = prior[prior.index >= target_date - pd.Timedelta(days=45)]
    if prior.empty:
        prior_eps = q.iloc[-1]  # fallback: oldest available quarter
    else:
        prior_eps = prior.iloc[0]
    if prior_eps == 0 or pd.isna(prior_eps) or pd.isna(latest_eps):
        return {"passed": None, "value": None, "detail": "Cannot compute YoY EPS growth"}
    growth = ((latest_eps - prior_eps) / abs(prior_eps)) * 100
    return {
        "passed": growth >= CURRENT_EPS_GROWTH_MIN_PCT,
        "value": round(growth, 1),
        "detail": f"Latest Q EPS {latest_eps:.2f} vs YoY {prior_eps:.2f} = {growth:.1f}%",
    }


def score_annual_earnings(d: dict) -> dict:
    a = d.get("annual_eps")
    if a is None or len(a) < 2:
        return {"passed": None, "value": None, "detail": "Insufficient annual EPS history"}
    latest_eps = a.iloc[0]
    earliest_eps = a.iloc[-1]
    years = len(a) - 1
    if earliest_eps <= 0 or pd.isna(earliest_eps) or pd.isna(latest_eps) or years < 1:
        return {"passed": None, "value": None, "detail": "Cannot compute EPS CAGR"}
    cagr = ((latest_eps / earliest_eps) ** (1 / years) - 1) * 100
    return {
        "passed": cagr >= ANNUAL_EPS_CAGR_MIN_PCT,
        "value": round(cagr, 1),
        "detail": f"EPS CAGR over {years}y: {cagr:.1f}% ({earliest_eps:.2f} -> {latest_eps:.2f})",
    }


def score_new_high(d: dict) -> dict:
    price, high = d.get("last_price"), d.get("year_high")
    if not price or not high:
        return {"passed": None, "value": None, "detail": "Missing price/52w-high data"}
    pct_below = ((high - price) / high) * 100
    return {
        "passed": pct_below <= NEW_HIGH_PROXIMITY_PCT,
        "value": round(pct_below, 2),
        "detail": f"${price:.2f} is {pct_below:.2f}% below 52w high ${high:.2f}",
    }


def score_supply_demand(d: dict) -> dict:
    shares = d.get("shares_outstanding")
    last_vol = d.get("last_volume")
    avg_vol = d.get("three_month_avg_volume")
    if not last_vol or not avg_vol:
        return {"passed": None, "value": None, "detail": "Missing volume data"}
    vol_surge_pct = ((last_vol - avg_vol) / avg_vol) * 100
    float_ok = shares is not None and shares <= MAX_SHARES_OUTSTANDING
    weight = 1.0 if float_ok or shares is None else LARGE_FLOAT_WEIGHT
    passed = vol_surge_pct >= VOLUME_SURGE_MIN_PCT
    shares_m = f"{shares / 1e6:.1f}M" if shares else "N/A"
    float_note = "<=50M" if float_ok else f">50M, weight discounted to {weight:.1f}x"
    return {
        "passed": passed,
        "value": round(vol_surge_pct, 1),
        "weight": weight,
        "detail": f"Volume {vol_surge_pct:+.1f}% vs 3mo avg; float {shares_m} ({float_note})",
    }


def score_leadership(d: dict, universe_returns_pop: list[float]) -> dict:
    ret = d.get("twelve_month_return_pct")
    if ret is None:
        return {"passed": None, "value": None, "detail": "Missing 12-month return"}
    pct = percentile_rank(ret, universe_returns_pop)
    if pct is None:
        return {"passed": None, "value": None, "detail": "RS universe unavailable"}
    return {
        "passed": pct >= RS_PERCENTILE_MIN,
        "value": pct,
        "detail": f"12mo return {ret:.1f}% ranks in the {pct:.0f}th percentile of Nasdaq-100",
    }


def score_institutional(d: dict) -> dict:
    pct = d.get("institutions_pct")
    if pct is None:
        return {"passed": None, "value": None, "detail": "Institutional ownership data unavailable"}
    return {
        "passed": pct >= INSTITUTIONAL_OWNERSHIP_MIN_PCT,
        "value": round(pct, 1),
        "detail": f"Institutions hold {pct:.1f}% of shares",
    }


def score_market(market_result: dict) -> dict:
    return {
        "passed": market_result.get("passed"),
        "value": market_result.get("passed"),
        "detail": market_result.get("detail", "N/A"),
    }


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------
def verdict_for_score(score: float, evaluable: float, criteria: dict) -> str:
    """Weighted score -> verdict tier, gated on earnings health.

    A stock cannot be rated "Watch" or "Strong" -- however well it scores on
    price/volume/sponsorship/market criteria -- unless its current-quarter
    earnings (C) are actually growing, and its annual earnings (A) aren't
    outright declining when that data is available. Without this gate, a
    stock with collapsing earnings but strong price action (e.g. pure M&A
    speculation) could still rank as a "Watch", which defeats the point of
    a CANSLIM screen: earnings growth is not optional, it's the "C" and "A".
    """
    if evaluable == 0:
        return "No Data"
    c_passed = criteria["C"]["passed"]
    a_passed = criteria["A"]["passed"]
    earnings_gate_failed = c_passed is not True or a_passed is False
    if earnings_gate_failed:
        return "Weak"
    if score >= SCORE_STRONG_MIN:
        return "Strong"
    if score >= SCORE_WATCH_MIN:
        return "Watch"
    return "Weak"


def screen_ticker(ticker: str, universe_returns_pop: list[float], market_result: dict) -> dict:
    data = fetch_ticker_data(ticker)
    criteria = {
        "C": score_current_earnings(data),
        "A": score_annual_earnings(data),
        "N": score_new_high(data),
        "S": score_supply_demand(data),
        "L": score_leadership(data, universe_returns_pop),
        "I": score_institutional(data),
        "M": score_market(market_result),
    }
    # Some of the above compute "passed" from numpy/pandas comparisons, which
    # yield numpy.bool_ rather than a native bool. numpy.bool_ is truthy-equal
    # to Python's True/False but NOT identical to it (`numpy.True_ is True`
    # is False), which silently breaks every `is True`/`is False` check below
    # and in verdict_for_score's earnings gate. Normalize to native bool/None
    # here, once, so identity checks are safe everywhere downstream.
    for c in criteria.values():
        c["passed"] = None if c["passed"] is None else bool(c["passed"])
    score = sum(c.get("weight", 1.0) for c in criteria.values() if c["passed"] is True)
    evaluable = sum(c.get("weight", 1.0) for c in criteria.values() if c["passed"] is not None)
    return {
        "ticker": ticker,
        "criteria": criteria,
        "score": round(score, 1),
        "evaluable": round(evaluable, 1),
        "verdict": verdict_for_score(score, evaluable, criteria),
    }


def load_tickers(args) -> list[str]:
    tickers: list[str] = []
    if args.tickers:
        tickers.extend(t.strip().upper() for t in args.tickers.split(",") if t.strip())
    if args.tickers_file:
        with open(args.tickers_file) as f:
            tickers.extend(line.strip().upper() for line in f if line.strip())
    if args.from_watchlist:
        watchlist_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "watchlist.json")
        try:
            with open(watchlist_path) as f:
                tickers.extend(t.strip().upper() for t in json.load(f))
        except Exception as e:
            print(f"[watchlist] Could not read {watchlist_path}: {e}", file=sys.stderr)
    # De-duplicate, preserve order
    seen = set()
    deduped = []
    for t in tickers:
        if t not in seen:
            seen.add(t)
            deduped.append(t)
    return deduped


def print_table(results: list[dict]) -> None:
    header = f"{'TICKER':<8}{'C':^7}{'A':^7}{'N':^7}{'S':^7}{'L':^7}{'I':^7}{'M':^7}{'SCORE':^10}{'VERDICT':<10}"
    print(header)
    print("-" * len(header))

    def cell(c: dict) -> str:
        if c["passed"] is None:
            return " N/A "
        return "  Y  " if c["passed"] else "  .  "

    def fmt_num(n: float) -> str:
        return f"{n:g}"

    for r in sorted(results, key=lambda x: (-x["score"], x["ticker"])):
        crit = r["criteria"]
        row = f"{r['ticker']:<8}"
        for letter in ["C", "A", "N", "S", "L", "I", "M"]:
            row += f"{cell(crit[letter]):^7}"
        score_str = f"{fmt_num(r['score'])}/{fmt_num(r['evaluable'])}"
        row += f"{score_str:^10}{r['verdict']:<10}"
        print(row)


def write_csv(results: list[dict], path: str) -> None:
    rows = []
    for r in results:
        row = {"ticker": r["ticker"], "score": r["score"], "evaluable": r["evaluable"], "verdict": r["verdict"]}
        for letter, c in r["criteria"].items():
            row[f"{letter}_passed"] = c["passed"]
            row[f"{letter}_value"] = c["value"]
            row[f"{letter}_detail"] = c["detail"]
        rows.append(row)
    pd.DataFrame(rows).sort_values(["score", "ticker"], ascending=[False, True]).to_csv(path, index=False)
    print(f"\nWrote {len(rows)} rows to {path}")


def main():
    parser = argparse.ArgumentParser(description="CANSLIM 7-point checklist screener")
    parser.add_argument("--tickers", help="Comma-separated ticker list, e.g. NVDA,PLTR,AVGO")
    parser.add_argument("--tickers-file", help="Path to a file with one ticker per line")
    parser.add_argument("--from-watchlist", action="store_true",
                         help="Also include tickers from this repo's watchlist.json")
    parser.add_argument("--benchmark", default="QQQ", help="Market-direction benchmark index (default: QQQ)")
    parser.add_argument("--csv-out", help="Optional path to write detailed results as CSV")
    parser.add_argument("--verbose", action="store_true", help="Print per-criterion detail for each ticker")
    args = parser.parse_args()

    tickers = load_tickers(args)
    if not tickers:
        parser.error("No tickers provided. Use --tickers, --tickers-file, or --from-watchlist.")

    print(f"[1/4] Resolving Nasdaq-100 RS benchmark universe...")
    universe, source = fetch_nasdaq100_constituents()
    print(f"      -> {len(universe)} symbols from source: {source}")

    print(f"[2/4] Computing market direction (M) via {args.benchmark}...")
    market_result = compute_market_direction(args.benchmark)
    print(f"      -> {market_result.get('detail')}")

    print(f"[3/4] Computing trailing 12-month returns across the RS universe...")
    universe_returns = compute_universe_returns(universe)
    universe_returns_pop = list(universe_returns.values())
    print(f"      -> Got returns for {len(universe_returns_pop)}/{len(universe)} symbols")

    print(f"[4/4] Screening {len(tickers)} ticker(s) against the 7-point checklist...")
    results = []
    for i, ticker in enumerate(tickers, 1):
        try:
            result = screen_ticker(ticker, universe_returns_pop, market_result)
            results.append(result)
        except Exception as e:
            print(f"      ! Skipping {ticker}: {e}", file=sys.stderr)
        if i < len(tickers):
            time.sleep(0.3)  # light rate-limit courtesy pause

    print()
    print_table(results)

    if args.verbose:
        for r in sorted(results, key=lambda x: (-x["score"], x["ticker"])):
            print(f"\n{r['ticker']} -- {r['score']:g}/{r['evaluable']:g} ({r['verdict']})")
            for letter, c in r["criteria"].items():
                mark = "PASS" if c["passed"] else ("N/A" if c["passed"] is None else "fail")
                print(f"  {letter} [{mark:>4}] {c['detail']}")

    if args.csv_out:
        write_csv(results, args.csv_out)


if __name__ == "__main__":
    main()
