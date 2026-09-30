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
  N - Innovation Catalyst: IBD's own "N" 7-point buying checklist --
      (1) is there something genuinely new (product/service/line/
      management), as a hard yes/no gate judged from BOTH the latest
      earnings call transcript AND recent news headlines (both sources
      must agree for the gate to pass); (2) is the new thing already
      producing accelerating revenue; (3) is price within range of its
      52-week high; (4) is that high coming off a tight base, not an
      extended run; (5) is volume confirming the move; (6) is the
      company young (recent IPOs score higher); (7) has the industry
      backdrop materially changed, again judged from transcript + news
      agreement. See score_innovation_catalyst() for full logic.
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
  pip install google-genai   # optional; falls back to a plain REST call if absent

Environment Variables (both optional -- N's LLM-based gate/sub-check
fall back to "N/A" without them; everything else needs no API key):
  export GEMINI_API_KEY="your_gemini_api_key"           # for the N catalyst/industry judgment
  export ALPHA_VANTAGE_API_KEY="your_alphavantage_key"  # for the earnings call transcript

Note: Alpha Vantage's free tier is rate-limited to 5 calls/minute, so
this script throttles itself to one transcript fetch per ~13 seconds
whenever ALPHA_VANTAGE_API_KEY is set -- a full Nasdaq-100 run will take
noticeably longer than the quant-only criteria alone.
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime
from typing import Optional

import pandas as pd
import requests
import yfinance as yf

# Optional Gemini SDK -- falls back to a plain REST call if not installed.
try:
    from google import genai
    HAS_GENAI_SDK = True
except ImportError:
    HAS_GENAI_SDK = False

# ---------------------------------------------------------------------------
# CANSLIM thresholds -- tune these to adjust screening strictness.
# ---------------------------------------------------------------------------
CURRENT_EPS_GROWTH_MIN_PCT = 25.0      # C: QoQ (YoY-quarter) EPS growth
CURRENT_REV_GROWTH_MIN_PCT = 20.0      # C: QoQ (YoY-quarter) Revenue growth
ANNUAL_EPS_CAGR_MIN_PCT = 25.0         # A: multi-year EPS CAGR
MIN_ROE_PCT = 17.0                     # A: Return on Equity minimum %
NEW_HIGH_PROXIMITY_PCT = 10.0          # N: price must be within 10% of 52w high
N_WEIGHT = 0.75                        # N: calibrated weight (0.75 out of total 6.75)
UD_VOLUME_RATIO_MIN = 1.0              # S: 50-day Up/Down volume ratio (accumulation > 1.0)
UP_DAY_VOLUME_SURGE_MIN_PCT = 25.0     # S: peak recent up-day volume vs 50-day average
RS_PERCENTILE_MIN = 80.0               # L: percentile rank within Nasdaq-100
INSTITUTIONAL_OWNERSHIP_MIN_PCT = 30.0  # I: % shares held by institutions
SCORE_STRONG_MIN = 5.5                 # verdict tiers, out of 6.75 total possible
SCORE_WATCH_MIN = 4.0                  #    (strong >= 5.5, watch >= 4.0)

# N (Innovation Catalyst) sub-check thresholds -- see score_innovation_catalyst().
N_BASE_LOOKBACK_TRADING_DAYS = 45      # N4: trailing window checked for a tight base
N_BASE_EXCLUDE_RECENT_DAYS = 5         # N4: exclude the most recent days (the breakout itself)
N_BASE_MAX_RANGE_PCT = 25.0            # N4: max price range (%) over that window to call it a "base"
N_VOLUME_LOOKBACK_TRADING_DAYS = 60    # N5: window used to find breakout-day volume vs. baseline
N_VOLUME_RECENT_TRADING_DAYS = 10      # N5: "recent" (possible breakout) sub-window within it
N_BREAKOUT_VOLUME_SURGE_MIN_PCT = 40.0  # N5: peak recent volume vs. prior baseline average
N_MAX_COMPANY_AGE_YEARS = 15.0         # N6: public this long or less scores as "young"
N_SUBCHECKS_MIN_PASS = 4               # N: how many of the 6 non-gate sub-checks (N2-N7)
                                        #    must pass, once the N1 gate has passed
GEMINI_MODEL = "gemini-3.8-flash"
AV_CALL_DELAY_SECONDS = 13             # Alpha Vantage free tier: throttle to ~5 calls/min

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

    try:
        out["quarterly_revenue"] = qis.loc["Total Revenue"].dropna() if qis is not None and "Total Revenue" in qis.index else None
    except Exception:
        out["quarterly_revenue"] = None

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

    # Return on Equity (ROE) for A metric
    try:
        inf = t.info or {}
        roe_val = inf.get("returnOnEquity")
        out["return_on_equity"] = float(roe_val) * 100 if roe_val is not None else None
    except Exception:
        out["return_on_equity"] = None

    # 12-month price/volume history -- used for the RS return, and for N's
    # base-tightness (N4) and breakout-volume (N5) sub-checks.
    try:
        hist_df = t.history(period="1y", interval="1d")
        out["price_history"] = hist_df if not hist_df.empty else None
        closes = hist_df["Close"].dropna()
        out["twelve_month_return_pct"] = (
            (float(closes.iloc[-1]) / float(closes.iloc[0]) - 1.0) * 100 if len(closes) >= 2 else None
        )
    except Exception:
        out["price_history"] = None
        out["twelve_month_return_pct"] = None

    # Listing age (approximate) -- used for N's company-age sub-check (N6).
    try:
        hist_max = t.history(period="max", interval="1mo")
        if not hist_max.empty:
            earliest = hist_max.index[0]
            now = pd.Timestamp.now(tz=earliest.tz)
            out["listing_age_years"] = (now - earliest).days / 365.25
        else:
            out["listing_age_years"] = None
    except Exception:
        out["listing_age_years"] = None

    return out


# ---------------------------------------------------------------------------
# Per-criterion scoring
# ---------------------------------------------------------------------------
def score_current_earnings(d: dict) -> dict:
    q = d.get("quarterly_eps")
    rev = d.get("quarterly_revenue")
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
    eps_growth = ((latest_eps - prior_eps) / abs(prior_eps)) * 100

    # Sales/Revenue YoY confirmation (CANSLIM requires sales to confirm earnings)
    rev_growth = None
    if rev is not None and len(rev) >= 2:
        r_latest_date, r_latest_val = rev.index[0], rev.iloc[0]
        r_target = r_latest_date - pd.DateOffset(years=1)
        r_prior_window = rev[(rev.index <= r_target + pd.Timedelta(days=45)) & (rev.index >= r_target - pd.Timedelta(days=45))]
        if not r_prior_window.empty and not pd.isna(r_prior_window.iloc[0]) and r_prior_window.iloc[0] != 0:
            rev_growth = ((r_latest_val - r_prior_window.iloc[0]) / abs(r_prior_window.iloc[0])) * 100

    eps_passed = eps_growth >= CURRENT_EPS_GROWTH_MIN_PCT
    # If revenue is available, require positive growth (>=20% ideal)
    rev_passed = (rev_growth >= CURRENT_REV_GROWTH_MIN_PCT or rev_growth > 0) if rev_growth is not None else True
    passed = eps_passed and rev_passed

    detail = f"EPS YoY {eps_growth:+.1f}% (min {CURRENT_EPS_GROWTH_MIN_PCT:.0f}%)"
    if rev_growth is not None:
        detail += f" | Sales YoY {rev_growth:+.1f}%"
    return {
        "passed": passed,
        "value": round(eps_growth, 1),
        "detail": detail,
    }


def score_annual_earnings(d: dict) -> dict:
    a = d.get("annual_eps")
    roe = d.get("return_on_equity")
    if a is None or len(a) < 2:
        return {"passed": None, "value": None, "detail": "Insufficient annual EPS history"}
    latest_eps = a.iloc[0]
    earliest_eps = a.iloc[-1]
    years = len(a) - 1
    if earliest_eps <= 0 or pd.isna(earliest_eps) or pd.isna(latest_eps) or years < 1:
        return {"passed": None, "value": None, "detail": "Cannot compute EPS CAGR"}
    cagr = ((latest_eps / earliest_eps) ** (1 / years) - 1) * 100

    cagr_passed = cagr >= ANNUAL_EPS_CAGR_MIN_PCT
    # O'Neil ROE rule: ROE >= 17% ensures capital efficiency
    roe_passed = (roe >= MIN_ROE_PCT) if roe is not None else True
    passed = cagr_passed and roe_passed

    detail = f"EPS CAGR {cagr:.1f}% ({years}y)"
    if roe is not None:
        detail += f" | ROE {roe:.1f}% (min {MIN_ROE_PCT:.0f}%)"
    return {
        "passed": passed,
        "value": round(cagr, 1),
        "detail": detail,
    }


def score_new_high(d: dict) -> dict:
    """N3: is price within range of its 52-week high."""
    price, high = d.get("last_price"), d.get("year_high")
    if not price or not high:
        return {"passed": None, "value": None, "detail": "Missing price/52w-high data"}
    pct_below = ((high - price) / high) * 100
    return {
        "passed": pct_below <= NEW_HIGH_PROXIMITY_PCT,
        "value": round(pct_below, 2),
        "detail": f"${price:.2f} is {pct_below:.2f}% below 52w high ${high:.2f}",
    }


def score_revenue_acceleration(d: dict) -> dict:
    """N2: is the (presumed) new product/service/line actually producing
    revenue growth, not just an announcement -- latest quarter's YoY revenue
    growth must be positive.

    Ideally this would compare two consecutive quarters' YoY growth rates to
    confirm actual acceleration, but yfinance's free quarterly_income_stmt
    typically only returns ~5 quarters -- one short of the 6 needed to
    compute two YoY figures -- so this checks single-quarter YoY growth
    instead of a multi-quarter acceleration trend."""
    rev = d.get("quarterly_revenue")
    if rev is None or len(rev) < 2:
        return {"passed": None, "value": None, "detail": "Insufficient quarterly revenue history"}
    latest_date, latest_val = rev.index[0], rev.iloc[0]
    target = latest_date - pd.DateOffset(years=1)
    window = rev[(rev.index <= target + pd.Timedelta(days=45)) & (rev.index >= target - pd.Timedelta(days=45))]
    if window.empty or pd.isna(window.iloc[0]) or window.iloc[0] == 0 or pd.isna(latest_val):
        return {"passed": None, "value": None, "detail": "Cannot compute revenue YoY growth"}
    prior_val = window.iloc[0]
    growth = (latest_val - prior_val) / abs(prior_val) * 100
    return {
        "passed": growth > 0,
        "value": round(growth, 1),
        "detail": f"Revenue YoY {growth:.1f}% (latest quarter only -- yfinance's free quarterly "
                   f"history is too short to confirm a multi-quarter acceleration trend)",
    }


def score_base_tightness(d: dict) -> dict:
    """N4: is the move to new highs coming off a tight base, rather than an
    already-extended run. Approximated as the price range over a trailing
    window, excluding the most recent days (the breakout itself) -- this is
    a heuristic proxy, not real cup-with-handle/flat-base pattern
    recognition."""
    hist = d.get("price_history")
    if hist is None or hist.empty:
        return {"passed": None, "value": None, "detail": "Missing price history"}
    closes = hist["Close"].dropna()
    if len(closes) < N_BASE_LOOKBACK_TRADING_DAYS:
        return {"passed": None, "value": None, "detail": "Insufficient price history for base check"}
    window = closes.iloc[-N_BASE_LOOKBACK_TRADING_DAYS:-N_BASE_EXCLUDE_RECENT_DAYS]
    if window.empty:
        return {"passed": None, "value": None, "detail": "Insufficient price history for base check"}
    lo, hi = float(window.min()), float(window.max())
    if lo <= 0:
        return {"passed": None, "value": None, "detail": "Invalid price data for base check"}
    range_pct = (hi - lo) / lo * 100
    passed = range_pct <= N_BASE_MAX_RANGE_PCT
    weeks = N_BASE_LOOKBACK_TRADING_DAYS // 5
    label = "tight base" if passed else "extended / not a tight base"
    return {
        "passed": passed,
        "value": round(range_pct, 1),
        "detail": f"Trailing ~{weeks}wk range (ex. last wk) {range_pct:.1f}% -- {label}",
    }


def score_breakout_volume(d: dict) -> dict:
    """N5: is volume confirming the move -- peak volume in a recent window
    vs. the baseline average before it."""
    hist = d.get("price_history")
    if hist is None or hist.empty:
        return {"passed": None, "value": None, "detail": "Missing volume history"}
    vol = hist["Volume"].dropna()
    if len(vol) < N_VOLUME_LOOKBACK_TRADING_DAYS:
        return {"passed": None, "value": None, "detail": "Insufficient volume history"}
    recent = vol.iloc[-N_VOLUME_RECENT_TRADING_DAYS:]
    baseline = vol.iloc[-N_VOLUME_LOOKBACK_TRADING_DAYS:-N_VOLUME_RECENT_TRADING_DAYS]
    if baseline.empty or baseline.mean() == 0:
        return {"passed": None, "value": None, "detail": "Insufficient volume history"}
    surge_pct = (float(recent.max()) - float(baseline.mean())) / float(baseline.mean()) * 100
    passed = surge_pct >= N_BREAKOUT_VOLUME_SURGE_MIN_PCT
    return {
        "passed": passed,
        "value": round(surge_pct, 1),
        "detail": f"Peak volume (last {N_VOLUME_RECENT_TRADING_DAYS}d) {surge_pct:+.1f}% vs prior baseline avg",
    }


def score_company_age(d: dict) -> dict:
    """N6: younger companies (recent IPOs with a fresh product) tend to
    score higher, per O'Neil's own finding that most monster stocks were
    young companies."""
    age = d.get("listing_age_years")
    if age is None:
        return {"passed": None, "value": None, "detail": "Listing age unavailable"}
    passed = age <= N_MAX_COMPANY_AGE_YEARS
    label = "young / recent IPO" if passed else "established / older company"
    return {
        "passed": passed,
        "value": round(age, 1),
        "detail": f"Public for ~{age:.1f} years -- {label}",
    }


# ---------------------------------------------------------------------------
# N's LLM-based signals: earnings call transcript + recent news headlines,
# each independently judged by Gemini, with agreement required between the
# two sources before gating (N1) or scoring (N7). Both are optional -- with
# no GEMINI_API_KEY/ALPHA_VANTAGE_API_KEY, these simply come back as
# "insufficient data" and N1/N7 fall back to None (excluded from scoring),
# same as any other missing-data criterion in this script.
# ---------------------------------------------------------------------------
_EMPTY_CATALYST_JUDGMENT = {
    "new_catalyst": {"found": None, "rationale": "no data"},
    "industry_shift": {"found": None, "rationale": "no data"},
}


def fetch_recent_news_headlines(ticker: str, max_items: int = 8) -> list[str]:
    """Recent news headlines for `ticker` via yfinance (last ~2-4 weeks in
    practice -- yfinance's news feed doesn't reliably go back further)."""
    try:
        news = yf.Ticker(ticker).news or []
    except Exception:
        return []
    items = []
    for n in news:
        content = n.get("content", n)  # yfinance has changed this schema across versions
        title = content.get("title") or n.get("title")
        summary = content.get("summary") or content.get("description") or ""
        if not title:
            continue
        items.append(f"- {title}. {summary}".strip())
        if len(items) >= max_items:
            break
    return items


def fetch_earnings_transcript_text(ticker: str, av_key: Optional[str], max_chars: int = 12000) -> Optional[str]:
    """Latest earnings call transcript via Alpha Vantage, same endpoint used
    by earnings_summarizer.py. Throttled to respect the free tier's 5
    calls/minute limit."""
    if not av_key:
        return None
    time.sleep(AV_CALL_DELAY_SECONDS)
    try:
        r = requests.get(
            "https://www.alphavantage.co/query",
            params={"function": "EARNINGS_CALL_TRANSCRIPT", "symbol": ticker, "apikey": av_key},
            timeout=30,
        )
        data = r.json()
    except Exception as e:
        print(f"[{ticker}] Alpha Vantage transcript fetch failed: {e}", file=sys.stderr)
        return None
    if not isinstance(data, dict) or "Error Message" in data or "Note" in data or "Information" in data:
        return None
    transcript = data.get("transcript")
    if isinstance(transcript, str):
        content = transcript
    elif isinstance(transcript, list):
        content = "\n".join(f"[{i.get('speaker', '?')}]: {i.get('content', i.get('text', ''))}" for i in transcript)
    else:
        content = ""
    if not content or len(content) < 50:
        return None
    return content[:max_chars]


def call_gemini_catalyst_judgment(ticker: str, source_label: str, text: Optional[str], gemini_key: Optional[str]) -> dict:
    """Ask Gemini to judge, from `text` (a transcript or a news digest),
    whether there's a genuine new catalyst (N1) and/or a changed industry
    backdrop (N7). Returns _EMPTY_CATALYST_JUDGMENT (found=None for both) if
    there's no text, no key, or the call/parse fails."""
    if not text or not gemini_key:
        return _EMPTY_CATALYST_JUDGMENT

    prompt = f"""You are an equity research analyst extracting objective signals from a {source_label} for {ticker}.

TEXT:
{text}

Answer STRICTLY as compact JSON with exactly this shape, no markdown fences, no extra commentary:
{{"new_catalyst": {{"found": true or false, "rationale": "<=20 words"}}, "industry_shift": {{"found": true or false, "rationale": "<=20 words"}}}}

Definitions:
- new_catalyst.found = true only if the text describes an actually NEW product, service, business line, or management/leadership change -- not routine updates or minor tweaks.
- industry_shift.found = true only if the text describes a materially changed industry backdrop for this company (deregulation, demand surge, supply shock, new competitive dynamic) -- not routine market commentary.
"""
    try:
        if HAS_GENAI_SDK:
            client = genai.Client(api_key=gemini_key)
            response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
            raw = response.text or ""
        else:
            r = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
                params={"key": gemini_key},
                json={"contents": [{"parts": [{"text": prompt}]}]},
                timeout=60,
            )
            r.raise_for_status()
            raw = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        parsed = json.loads(match.group(0) if match else raw)
        nc = parsed.get("new_catalyst", {}) or {}
        ind = parsed.get("industry_shift", {}) or {}
        return {
            "new_catalyst": {"found": nc.get("found"), "rationale": nc.get("rationale", "")},
            "industry_shift": {"found": ind.get("found"), "rationale": ind.get("rationale", "")},
        }
    except Exception as e:
        print(f"[{ticker}] Gemini judgment ({source_label}) failed: {e}", file=sys.stderr)
        return _EMPTY_CATALYST_JUDGMENT


def combine_dual_source(transcript_field: dict, news_field: dict) -> dict:
    """Requires both the transcript-based and news-based judgments to agree
    (both True) before a signal counts as confirmed. Either side missing
    (found=None) makes the combined result unresolved (None), not a fail."""
    t_found, n_found = transcript_field.get("found"), news_field.get("found")
    if t_found is None or n_found is None:
        return {"passed": None, "detail": "insufficient data from one or both sources (transcript/news)", "rationale": ""}
    passed = bool(t_found) and bool(n_found)
    rationale = f"transcript: {transcript_field.get('rationale', '')} | news: {news_field.get('rationale', '')}"
    return {"passed": passed, "detail": f"transcript={t_found}, news={n_found} (both must agree)", "rationale": rationale}


def score_innovation_catalyst(ticker: str, d: dict, gemini_key: Optional[str], av_key: Optional[str]) -> dict:
    """N (Innovation Catalyst): IBD's own 7-point "N" checklist. #1 is a
    hard yes/no gate (requiring the earnings-call-transcript judgment AND
    the news-headline judgment to agree there's a genuine new catalyst);
    #2-#6 are quantitative; #7 (industry backdrop) uses the same dual-source
    agreement rule as #1 but doesn't gate, it's just one of the 6 sub-checks
    counted after the gate passes."""
    news_items = fetch_recent_news_headlines(ticker)
    news_text = "\n".join(news_items) if news_items else None
    transcript_text = fetch_earnings_transcript_text(ticker, av_key)

    news_judgment = call_gemini_catalyst_judgment(ticker, "recent news headline digest", news_text, gemini_key)
    transcript_judgment = call_gemini_catalyst_judgment(ticker, "earnings call transcript", transcript_text, gemini_key)

    gate = combine_dual_source(transcript_judgment["new_catalyst"], news_judgment["new_catalyst"])
    sub_checks = {"N1_new_catalyst_gate": gate}

    if gate["passed"] is None:
        return {
            "passed": None, "value": None,
            "weight": N_WEIGHT,
            "detail": f"N1 (new catalyst gate) unresolved -- {gate['detail']}",
            "sub_checks": sub_checks,
        }
    if gate["passed"] is False:
        return {
            "passed": False, "value": 0,
            "weight": N_WEIGHT,
            "detail": f"N1 (new catalyst gate) FAILED -- {gate['detail']} | {gate['rationale']}",
            "sub_checks": sub_checks,
        }

    n7_combo = combine_dual_source(transcript_judgment["industry_shift"], news_judgment["industry_shift"])
    subs = {
        "N2_revenue_accel": score_revenue_acceleration(d),
        "N3_new_high": score_new_high(d),
        "N4_base_tightness": score_base_tightness(d),
        "N5_breakout_volume": score_breakout_volume(d),
        "N6_company_age": score_company_age(d),
        "N7_industry_shift": {
            "passed": n7_combo["passed"], "value": None,
            "detail": f"{n7_combo['detail']} | {n7_combo['rationale']}",
        },
    }
    # Same numpy.bool_ vs. Python bool identity pitfall as screen_ticker's
    # top-level normalization (see its comment) -- some of these sub-checks
    # derive "passed" from pandas/numpy comparisons, and the `is True`/
    # `is not None` checks below need native types to work correctly.
    for s in subs.values():
        s["passed"] = None if s["passed"] is None else bool(s["passed"])
    sub_checks.update(subs)

    evaluated = [s for s in subs.values() if s["passed"] is not None]
    if not evaluated:
        return {
            "passed": None, "value": None,
            "weight": N_WEIGHT,
            "detail": f"N1 gate passed, but no sub-checks were evaluable -- {gate['detail']}",
            "sub_checks": sub_checks,
        }
    passed_count = sum(1 for s in evaluated if s["passed"] is True)
    overall_passed = passed_count >= N_SUBCHECKS_MIN_PASS
    breakdown = ", ".join(
        f"{k}={'Y' if s['passed'] else ('N/A' if s['passed'] is None else 'n')}" for k, s in subs.items()
    )
    return {
        "passed": overall_passed,
        "value": passed_count,
        "weight": N_WEIGHT,
        "detail": f"N1 gate passed; {passed_count}/{len(evaluated)} evaluable sub-checks passed "
                   f"(need >={N_SUBCHECKS_MIN_PASS}) -- {breakdown}",
        "sub_checks": sub_checks,
    }


def score_supply_demand(d: dict) -> dict:
    """S: Supply and Demand (Volume Dynamics / Institutional Accumulation).
    Evaluates the 50-day Up/Down Volume Ratio (U/D Ratio >= 1.0 indicates net
    accumulation) and checks for recent up-day volume surges.
    Weight is fixed at 1.0 (no float penalties)."""
    hist = d.get("price_history")
    if hist is None or hist.empty or len(hist) < 15:
        # Fallback to last volume vs 3-month average if history is short
        last_vol = d.get("last_volume")
        avg_vol = d.get("three_month_avg_volume")
        if not last_vol or not avg_vol:
            return {"passed": None, "value": None, "weight": 1.0, "detail": "Missing volume data"}
        vol_surge_pct = ((last_vol - avg_vol) / avg_vol) * 100
        passed = vol_surge_pct >= UP_DAY_VOLUME_SURGE_MIN_PCT
        return {
            "passed": passed,
            "value": round(vol_surge_pct, 1),
            "weight": 1.0,
            "detail": f"Last volume {vol_surge_pct:+.1f}% vs 3mo avg",
        }

    closes = hist["Close"].dropna()
    volumes = hist["Volume"].dropna()
    idx = closes.index.intersection(volumes.index)
    closes = closes.loc[idx]
    volumes = volumes.loc[idx]

    window_len = min(50, len(closes))
    window_closes = closes.iloc[-window_len:]
    window_vols = volumes.iloc[-window_len:]

    price_diffs = window_closes.diff().iloc[1:]
    vols = window_vols.iloc[1:]

    up_vols = vols[price_diffs > 0]
    down_vols = vols[price_diffs < 0]

    total_up = float(up_vols.sum()) if not up_vols.empty else 0.0
    total_down = float(down_vols.sum()) if not down_vols.empty else 0.0

    if total_down > 0:
        ud_ratio = round(total_up / total_down, 2)
    else:
        ud_ratio = 2.0 if total_up > 0 else 1.0

    # Peak up-day surge in the last 10 trading days vs 50-day average
    recent_len = min(10, len(closes))
    recent_closes = closes.iloc[-recent_len:]
    recent_vols = volumes.iloc[-recent_len:]
    recent_diffs = recent_closes.diff().iloc[1:]
    recent_up_vols = recent_vols.iloc[1:][recent_diffs > 0]

    avg_vol = float(window_vols.mean())
    peak_up_vol = float(recent_up_vols.max()) if not recent_up_vols.empty else float(vols.mean())
    up_surge_pct = round(((peak_up_vol - avg_vol) / avg_vol) * 100, 1) if avg_vol > 0 else 0.0

    # Passed if Up/Down volume ratio shows accumulation (>= 1.0)
    passed = ud_ratio >= UD_VOLUME_RATIO_MIN

    status_label = "Net Accumulation" if ud_ratio >= 1.0 else "Net Distribution"
    detail = f"50d U/D Vol Ratio: {ud_ratio:.2f}x ({status_label}); Recent Up-Day Surge: {up_surge_pct:+.1f}% vs avg"

    return {
        "passed": passed,
        "value": ud_ratio,
        "weight": 1.0,
        "detail": detail,
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


def screen_ticker(
    ticker: str,
    universe_returns_pop: list[float],
    market_result: dict,
    gemini_key: Optional[str] = None,
    av_key: Optional[str] = None,
) -> dict:
    data = fetch_ticker_data(ticker)
    criteria = {
        "C": score_current_earnings(data),
        "A": score_annual_earnings(data),
        "N": score_innovation_catalyst(ticker, data, gemini_key, av_key),
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
    parser.add_argument("--gemini-key", help="Gemini API key for N's catalyst/industry judgment (or set GEMINI_API_KEY)")
    parser.add_argument("--av-key", help="Alpha Vantage API key for N's earnings call transcript (or set ALPHA_VANTAGE_API_KEY)")
    args = parser.parse_args()

    tickers = load_tickers(args)
    if not tickers:
        parser.error("No tickers provided. Use --tickers, --tickers-file, or --from-watchlist.")

    gemini_key = args.gemini_key or os.environ.get("GEMINI_API_KEY", "") or None
    av_key = args.av_key or os.environ.get("ALPHA_VANTAGE_API_KEY", "") or None
    if not gemini_key or not av_key:
        print("[N] Note: GEMINI_API_KEY and/or ALPHA_VANTAGE_API_KEY not set -- "
              "N's catalyst/industry-shift checks will show as N/A.", file=sys.stderr)

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
            result = screen_ticker(ticker, universe_returns_pop, market_result, gemini_key, av_key)
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
