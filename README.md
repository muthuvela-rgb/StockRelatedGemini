# StockRelated — Quantitative Options & Equities Suite

**StockRelated** is a full-stack, real-time quantitative options scanner, equities fall detector, and technical analysis web application built with **React**, **TypeScript**, **Tailwind CSS**, **Recharts**, and **Node.js/Express**.

The suite runs on public market data (Yahoo Finance, SEC EDGAR XBRL, StockTwits) with automated crumb/session token negotiation and Black-Scholes Greeks computations—requiring no paid data feeds or brokerage credentials.

---

## Key Features & Modules

### 1. ⚡ Put Options Annualized Return Scanner
- **Quantitative Options Scanning**: Multi-ticker and universe scanning (QQQ Leaders, SPY Leaders, Watchlist, or Custom Tickers) across customizable DTE (0–365 days) and strike selection modes.
- **Flexible Strike Selection Modes**:
  - **Moneyness Band Mode**: Filter all strikes between configurable spot % boundaries (e.g. 70% to 95%).
  - **Single Target Strike ($ or %)**: Focus on a specific target dollar strike (e.g. $580, $200) or target % of spot price (e.g. 85% OTM), snapping to the nearest listed strike across all expiration dates with an expiration yield comparison chart.
  - **Bollinger Lower Band Snapping**: Automatically derive put strikes from the lower 20-day 2-std Bollinger Band.
- **OCC TIMS Portfolio Margin Stress Test**: Simulates standard Options Clearing Corporation portfolio margin requirements (configurable downside price shock %, minimum floor per share, and price floor %) vs. Cash-Secured (100% strike) collateral.
- **Interactive Visualizations**:
  - **Premium ($) vs. Expiration Date Plot**: Dedicated single-stock decay curve plotting option premium ($) against expiration dates and DTE horizons with knee-of-the-curve sweet spot identification and dual-axis annualized return overlay.
  - **Annualized Return (%) by Expiration**: Expiration bar chart highlighting high-yielding maturity windows.
  - **Moneyness vs. Annualized Return Scatter**: Broad universe view mapping safety margin % against annualized yield.
- **CSV Export**: One-click download of screened contracts.

### 2. 📉 Stock Fall Detector & Deep Context Analyzer
- **Multi-Day Drop Screener**: Detects sudden price drops across configurable lookback windows (3 to 60 days) and minimum drop percentages (3% to 30%+).
- **Technical Indicators**: Automated calculation of 14-day Wilder's RSI, 20-day Bollinger %B, and At-The-Money (ATM) Implied Volatility.
- **Deep Context Intelligence**:
  - **Wall Street Consensus**: Target price, implied upside, recommendation breakdown, and recent upgrade/downgrade history.
  - **Social Sentiment**: Bullish vs. Bearish ratio derived from StockTwits sentiment tags.
  - **Latest News**: Real-time ticker-tagged news headlines.

### 3. 📊 Technicals & Volatility Screener
- **14-Day Wilder's RSI & 20-Day Bollinger Bands**: Upper, Middle (SMA20), and Lower bands.
- **52-Week Fibonacci Retracements**: 0%, 23.6%, 38.2%, 50%, 61.8% (Golden Pocket), and 100% levels.
- **Historical vs. Implied Volatility**: 252-day Realized Volatility (%) paired with expected 1-standard-deviation annual dollar move ($\pm\$/\text{yr}$).

### 4. ⏱️ Short-Dated High-Theta Put Screener
- Targets weekly and short-dated options ($\le 15$ DTE) with high safety margins (Moneyness $\le 90\%$) and liquid minimum bid premiums.

### 5. 🔬 Option Chain & Black-Scholes Greeks
- Live call/put options chain with computed Black-Scholes Greeks:
  - **Delta ($\Delta$)**
  - **Gamma ($\Gamma$)**
  - **Theta ($\Theta$)** (Daily time decay)
  - **Vega ($\nu$)** (1% IV change sensitivity)
  - **Rho ($\rho$)** (1% interest rate sensitivity)
- Visual highlighting of In-The-Money (ITM) and At-The-Money (ATM) strikes.

### 6. 📈 Premium vs. Strike & Expiration Curves
- Visualizes decay and pricing curves across multiple expirations simultaneously.
- Identifies:
  - Highest Premium-to-Strike ratio points.
  - Steepest adjacent strike slope steps ($\Delta \$/\$1\text{ Strike}$).
  - Widest 5% price bin differences and inter-expiration spread gaps.
  - Linear and Logarithmic scale toggling.

### 7. 🏛️ SEC EDGAR Earnings & XBRL Filings
- Resolves official SEC CIK directories for any US ticker.
- Fetches recent 10-K, 10-Q, and 8-K disclosure filings with direct links to SEC.gov archives.
- Pulls reported GAAP Diluted EPS and Total Revenues directly from official XBRL fact dictionaries.

### 8. 🔖 Watchlist & Universe Manager
- Manage persistent custom watchlists with built-in universe presets (*Tech & Options Leaders*, *Semiconductor Powerhouses*, *High Volatility*, *Big Tech*).

---

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Recharts
- **Backend**: Node.js, Express, tsx, esbuild
- **Pricing & Quantitative Engine**: Black-Scholes Greeks closed-form solver, Cumulative Normal Distribution approximation, OCC TIMS margin stress simulator, Wilder's RSI smoothing, SEC EDGAR XBRL parser

---

## Local Development & Setup

### 1. Prerequisites
- **Node.js**: Version 18.0 or higher
- **npm** or **bun**

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/muthuvela-rgb/StockRelated.git
cd StockRelated
npm install
```

### 3. Running in Development
Start the unified full-stack server (runs on port 3000):
```bash
npm run dev
```
Open your browser and navigate to:
```
http://localhost:3000
```

### 4. Building for Production
```bash
npm run build
npm start
```

---

## API Endpoints Overview

| Endpoint | Method | Description |
|---|---|---|
| `/api/options-scan` | `POST` | Multi-ticker put options scan with OCC TIMS margin & annualized return |
| `/api/fall-detector` | `GET` | Equities drop scanner with technicals & contextual news |
| `/api/technicals` | `GET` | 14d RSI, 20d Bollinger, Fib retracements, & Realized Volatility |
| `/api/option-chain` | `GET` | Full call/put option chain with Black-Scholes Greeks |
| `/api/premium-curves`| `GET` | Multi-expiration premium decay curves & slope analysis |
| `/api/sec-earnings` | `GET` | SEC EDGAR CIK resolution, 10-K/10-Q links, & XBRL EPS/Revenue |
| `/api/watchlist` | `GET / POST` | Retrieve or persist custom user watchlist |

---

## Disclaimer
*This software is intended for data analysis and research purposes only. It does not provide investment advice and does not execute trades.*
