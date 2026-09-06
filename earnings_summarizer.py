#!/usr/bin/env python3
"""
earnings_summarizer.py

A Python script that retrieves earnings call transcripts from Alpha Vantage
and summarizes them using Google's Gemini AI SDK (or REST API).

Usage:
  python earnings_summarizer.py --ticker NVDA --quarters 2
  python earnings_summarizer.py --ticker AAPL --quarter 2024Q3 --save

Prerequisites:
  pip install google-genai requests

Environment Variables:
  export ALPHA_VANTAGE_API_KEY="your_alphavantage_key"
  export GEMINI_API_KEY="your_gemini_api_key"
"""

import os
import sys
import json
import argparse
from datetime import datetime
import urllib.request
import urllib.parse
import urllib.error

# Try importing Google GenAI SDK
try:
    from google import genai
    from google.genai import types
    HAS_GENAI_SDK = True
except ImportError:
    HAS_GENAI_SDK = False


def fetch_transcript_alpha_vantage(ticker: str, quarter: str = "", api_key: str = "") -> dict:
    """
    Fetch earnings call transcript from Alpha Vantage API.
    Function: EARNINGS_CALL_TRANSCRIPT
    """
    if not api_key:
        api_key = os.environ.get("ALPHA_VANTAGE_API_KEY", "")
    if not api_key:
        raise ValueError("Alpha Vantage API key is missing. Set ALPHA_VANTAGE_API_KEY env var or pass --api-key.")

    params = {
        "function": "EARNINGS_CALL_TRANSCRIPT",
        "symbol": ticker.upper(),
        "apikey": api_key,
    }
    if quarter:
        params["quarter"] = quarter

    query_str = urllib.parse.urlencode(params)
    url = f"https://www.alphavantage.co/query?{query_str}"
    
    print(f"[*] Fetching transcript for {ticker} (quarter: {quarter or 'latest'}) from Alpha Vantage...")
    req = urllib.request.Request(url, headers={"User-Agent": "EarningsSummarizer/1.0"})
    
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    
    # Check for Alpha Vantage rate limit or error notices
    if "Note" in data:
        print(f"[!] Alpha Vantage Notice: {data['Note']}")
    if "Information" in data:
        print(f"[!] Alpha Vantage Info: {data['Information']}")
    if "Error Message" in data:
        raise RuntimeError(f"Alpha Vantage API error: {data['Error Message']}")
    
    return data


def summarize_transcript_with_gemini(transcript_text: str, ticker: str, quarter_info: str, gemini_key: str = "") -> dict:
    """
    Summarize earnings call transcript with Gemini 3.8 Flash.
    Extracts financial results, management guidance, analyst Q&A nuances, and option volatility catalysts.
    """
    if not gemini_key:
        gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if not gemini_key:
        raise ValueError("Gemini API key is missing. Set GEMINI_API_KEY env var.")

    prompt = f"""You are a Senior Equity Research Analyst and Options Volatility Structurer.
Analyze the following earnings call transcript for {ticker} ({quarter_info}).

Provide a rigorous institutional summary covering:
1. Executive Summary (2-3 sentences on core results, revenue, EPS vs expectations).
2. Guidance & Forward Outlook (Next quarter and full year revenue/margin targets).
3. Analyst Q&A Highlights & Tone (Critical probing questions, management defensiveness or confidence).
4. Catalysts & Options Risks (Key headwinds, capex changes, supply bottlenecks, margin pressures).
5. Management Sentiment (Score from 1 to 10, plus category: Bullish, Moderately Bullish, Neutral, or Cautionary).
6. 2-3 Most Impactful Quotes from Executives.

TRANSCRIPT CONTENT:
{transcript_text[:50000]}

Format your response in structured Markdown format.
"""

    if HAS_GENAI_SDK:
        client = genai.Client(api_key=gemini_key)
        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=prompt,
        )
        return {"summary_markdown": response.text}
    else:
        # Direct REST API fallback if SDK is not installed
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={gemini_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}]
        }
        req = urllib.request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            res_data = json.loads(resp.read().decode("utf-8"))
            text = res_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            return {"summary_markdown": text}


def main():
    parser = argparse.ArgumentParser(description="Pull and summarize earnings call transcripts using Alpha Vantage & Gemini AI.")
    parser.add_argument("--ticker", "-t", default="NVDA", help="Stock ticker symbol (e.g. NVDA, AAPL, MSFT)")
    parser.add_argument("--quarter", "-q", default="", help="Optional quarter, e.g. 2024Q3 (defaults to latest)")
    parser.add_argument("--api-key", help="Alpha Vantage API key (or set ALPHA_VANTAGE_API_KEY)")
    parser.add_argument("--gemini-key", help="Gemini API key (or set GEMINI_API_KEY)")
    parser.add_argument("--save", action="store_true", help="Save the summary report as a markdown file")

    args = parser.parse_args()
    ticker = args.ticker.upper()

    try:
        data = fetch_transcript_alpha_vantage(ticker, quarter=args.quarter, api_key=args.api_key)
        
        # Alpha Vantage returns transcripts either in 'transcript' string or list of speaker turns
        transcript_content = ""
        quarter_str = args.quarter or "Latest Quarter"
        
        if "transcript" in data:
            if isinstance(data["transcript"], str):
                transcript_content = data["transcript"]
            elif isinstance(data["transcript"], list):
                transcript_content = "\n\n".join([f"[{item.get('speaker', 'Unknown')}]: {item.get('content', item.get('text', ''))}" for item in data["transcript"]])
        elif isinstance(data, list):
            transcript_content = "\n\n".join([str(item) for item in data])
        else:
            transcript_content = json.dumps(data, indent=2)

        if not transcript_content or len(transcript_content) < 50:
            print(f"[!] No transcript content found for {ticker}. API Response keys: {list(data.keys())}")
            sys.exit(1)

        print(f"[*] Retrieved {len(transcript_content)} characters of transcript text.")
        print(f"[*] Generating AI summary using Gemini 3.8 Flash...")

        result = summarize_transcript_with_gemini(
            transcript_text=transcript_content,
            ticker=ticker,
            quarter_info=quarter_str,
            gemini_key=args.gemini_key
        )

        summary_md = result.get("summary_markdown", "")

        print("\n" + "="*80)
        print(f"  EARNINGS CALL SUMMARY: {ticker} ({quarter_str})")
        print("="*80 + "\n")
        print(summary_md)
        print("\n" + "="*80)

        if args.save:
            filename = f"earnings_summary_{ticker}_{datetime.now().strftime('%Y%m%d')}.md"
            with open(filename, "w", encoding="utf-8") as f:
                f.write(f"# Earnings Call Summary: {ticker} ({quarter_str})\n\n")
                f.write(f"*Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} via Alpha Vantage & Gemini AI*\n\n")
                f.write(summary_md)
            print(f"[✓] Summary saved to {filename}")

    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
