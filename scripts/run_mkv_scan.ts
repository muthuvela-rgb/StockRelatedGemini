import { QQQ_COMPONENTS } from "../src/data/universePresets";
import fs from "fs";

async function runScan() {
  console.log(`Starting MKV Morning QQQ Deep-OTM Put Scan...`);
  console.log(`Universe: ${QQQ_COMPONENTS.length} QQQ components + QQQ + TQQQ`);

  const universe = Array.from(new Set([...QQQ_COMPONENTS, "QQQ", "TQQQ"]));
  const minDays = 180; // >= 6 months
  const maxMoneynessPct = 70.0; // strike / spot < 0.70

  const candidates: any[] = [];
  const caveats: any[] = [];
  const today = new Date();

  // Hit the local dev server or direct fetch functions
  // Let's call http://localhost:3000/api/options-scan in batches or directly
  const batchSize = 10;
  for (let i = 0; i < universe.length; i += batchSize) {
    const chunk = universe.slice(i, i + batchSize);
    console.log(`Scanning batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(universe.length / batchSize)}: ${chunk.join(", ")}...`);

    try {
      const res = await fetch("http://localhost:3000/api/options-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickers: chunk,
          minDays: minDays,
          maxDays: 1200,
          strikeMode: "band",
          pctLow: 5.0,
          pctHigh: maxMoneynessPct,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`Batch error (${res.status}): ${text.slice(0, 200)}`);
        for (const t of chunk) {
          caveats.push({ ticker: t, reason: `HTTP error ${res.status} from market server` });
        }
        continue;
      }

      const data = await res.json();
      const records = data.records || [];
      const summaries = data.summary || [];

      const summaryMap = new Map<string, any>();
      for (const s of summaries) {
        summaryMap.set(s.ticker, s);
      }

      // Group records by ticker
      const tickerRecordsMap = new Map<string, any[]>();
      for (const r of records) {
        if (!tickerRecordsMap.has(r.ticker)) {
          tickerRecordsMap.set(r.ticker, []);
        }
        tickerRecordsMap.get(r.ticker)!.push(r);
      }

      for (const ticker of chunk) {
        const recs = tickerRecordsMap.get(ticker) || [];
        const sumObj = summaryMap.get(ticker);

        if (!sumObj || !sumObj.current_price) {
          caveats.push({ ticker, reason: "No current price/quote returned from Tradier/Yahoo" });
          continue;
        }

        const spot = sumObj.current_price;
        const bollinger = sumObj.bollinger;

        let bollingerPos = "N/A";
        if (bollinger) {
          if (spot <= bollinger.lower_band) {
            bollingerPos = "Below Lower Band";
          } else if (spot <= bollinger.sma) {
            bollingerPos = `Lower Half (SMA $${bollinger.sma})`;
          } else if (spot <= bollinger.upper_band) {
            bollingerPos = `Upper Half (SMA $${bollinger.sma})`;
          } else {
            bollingerPos = "Above Upper Band";
          }
        }

        // Filter records for DTE >= 180 and moneyness < 70%
        const deepOtmPuts = recs.filter((r: any) => {
          const moneyness = (r.strike / spot) * 100;
          return r.days_to_expiration >= minDays && moneyness < maxMoneynessPct && r.bid > 0;
        });

        if (deepOtmPuts.length === 0) {
          caveats.push({
            ticker,
            spot_price: spot,
            reason: `No liquid put option found with expiration >= 180d and moneyness < ${maxMoneynessPct}% (strike < $${(spot * 0.7).toFixed(2)})`,
          });
          continue;
        }

        // Pick best annualized return option for this ticker
        deepOtmPuts.sort((a: any, b: any) => (b.annualized_return_pct_cash_secured || b.annualized_return_pct) - (a.annualized_return_pct_cash_secured || a.annualized_return_pct));

        const best = deepOtmPuts[0];
        const annReturn = best.annualized_return_pct_cash_secured || best.annualized_return_pct || 0;

        candidates.push({
          ticker,
          spot_price: spot,
          bollinger_position: bollingerPos,
          strike: best.strike,
          moneyness_pct: Number(((best.strike / spot) * 100).toFixed(2)),
          expiration_date: best.expiration,
          dte: best.days_to_expiration,
          bid: best.bid,
          ask: best.ask,
          delta: best.delta || -0.05,
          annualized_return_pct: Number(annReturn.toFixed(2)),
          volume: best.volume || 0,
          open_interest: best.open_interest || 0,
        });
      }
    } catch (err: any) {
      console.error(`Error processing chunk:`, err);
    }
  }

  // Sort candidates best first
  candidates.sort((a, b) => b.annualized_return_pct - a.annualized_return_pct);

  console.log(`Scan completed! Total candidates: ${candidates.length}, Total caveats: ${caveats.length}`);

  // Build HTML Report
  const htmlDigest = generateHtmlReport(candidates, caveats, universe.length, minDays, maxMoneynessPct);

  fs.writeFileSync("mkv_qqq_scan_digest.html", htmlDigest, "utf-8");
  fs.writeFileSync("mkv_qqq_scan_results.json", JSON.stringify({ candidates, caveats, universeCount: universe.length }, null, 2), "utf-8");

  console.log(`Report written to mkv_qqq_scan_digest.html & mkv_qqq_scan_results.json`);
}

function generateHtmlReport(candidates: any[], caveats: any[], universeLength: number, minDays: number, maxMoneynessPct: number) {
  const scanTimeStr = new Date().toUTCString();
  const topCandidates = candidates.slice(0, Math.max(50, candidates.length));

  const candidateRows = topCandidates.map((c, idx) => `
    <tr style="border-bottom: 1px solid #1e293b; ${idx % 2 === 0 ? 'background-color: #0f172a;' : 'background-color: #1e293b;'}">
      <td style="padding: 10px 12px; font-weight: bold; color: #94a3b8; text-align: center;">${idx + 1}</td>
      <td style="padding: 10px 12px; font-weight: bold; color: #38bdf8; font-family: monospace; font-size: 14px;">${c.ticker}</td>
      <td style="padding: 10px 12px; text-align: right; color: #f8fafc; font-family: monospace;">$${c.spot_price.toFixed(2)}</td>
      <td style="padding: 10px 12px; text-align: center; color: #cbd5e1; font-size: 12px;">
        <span style="display: inline-block; padding: 2px 8px; borderRadius: 4px; ${
          c.bollinger_position.includes("Below") ? "background: #7f1d1d; color: #fca5a5;" :
          c.bollinger_position.includes("Lower") ? "background: #1e3a8a; color: #93c5fd;" :
          c.bollinger_position.includes("Upper") ? "background: #14532d; color: #86efac;" :
          "background: #701a75; color: #f5d0fe;"
        }">
          ${c.bollinger_position}
        </span>
      </td>
      <td style="padding: 10px 12px; text-align: right; font-weight: bold; color: #fbbf24; font-family: monospace;">$${c.strike.toFixed(2)}</td>
      <td style="padding: 10px 12px; text-align: right; color: #94a3b8; font-family: monospace;">${c.moneyness_pct.toFixed(1)}%</td>
      <td style="padding: 10px 12px; text-align: center; color: #e2e8f0; font-family: monospace; font-size: 13px;">${c.expiration_date} (${c.dte}d)</td>
      <td style="padding: 10px 12px; text-align: right; color: #34d399; font-weight: bold; font-family: monospace;">$${c.bid.toFixed(2)}</td>
      <td style="padding: 10px 12px; text-align: right; color: #a78bfa; font-family: monospace;">${c.delta.toFixed(2)}</td>
      <td style="padding: 10px 12px; text-align: right; font-weight: bold; color: #38bdf8; font-family: monospace; font-size: 14px; background: rgba(56, 189, 248, 0.1);">
        ${c.annualized_return_pct.toFixed(2)}%
      </td>
    </tr>
  `).join("");

  const caveatsList = caveats.map(c => `
    <li style="margin-bottom: 6px; color: #94a3b8; font-size: 13px;">
      <strong style="color: #f8fafc; font-family: monospace;">${c.ticker}</strong> ${c.spot_price ? `($${c.spot_price.toFixed(2)})` : ''}: ${c.reason}
    </li>
  `).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>MKV Scheduled Morning Options Scan - Deep OTM Cash-Secured Puts (QQQ Components)</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 24px; line-height: 1.5; }
    .container { max-width: 1200px; margin: 0 auto; background-color: #0f172a; border-radius: 12px; border: 1px solid #1e293b; padding: 24px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
    .header { border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px; }
    .title { font-size: 24px; font-weight: 800; color: #38bdf8; margin: 0 0 8px 0; display: flex; align-items: center; justify-content: space-between; }
    .badge { font-size: 12px; background: #1e3a8a; color: #93c5fd; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; }
    .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; background: #1e293b; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.05em; }
    .meta-value { font-size: 15px; font-weight: 700; color: #f1f5f9; font-family: monospace; }
    .section-title { font-size: 18px; font-weight: 700; color: #f8fafc; margin: 28px 0 16px 0; padding-bottom: 6px; border-bottom: 1px solid #334155; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
    th { background-color: #1e293b; color: #94a3b8; text-transform: uppercase; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; padding: 10px 12px; text-align: left; }
    .disclaimer { background: rgba(234, 179, 8, 0.1); border-left: 4px solid #eab308; padding: 12px 16px; border-radius: 4px; color: #fef08a; font-size: 12px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">
        <span>⚡ MKV Scheduled Morning Options Scan Digest</span>
        <span class="badge">Tradier Paper Connector</span>
      </div>
      <div style="color: #94a3b8; font-size: 13px;">Automated Deep-OTM Cash-Secured Put Screener for QQQ Index Components & TQQQ</div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <span class="meta-label">Scan Timestamp</span>
        <span class="meta-value">${scanTimeStr}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Scanned Universe</span>
        <span class="meta-value">${universeLength} Symbols</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Qualifying Candidates</span>
        <span class="meta-value" style="color: #34d399;">${candidates.length} Tickers</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Screening Filter</span>
        <span class="meta-value">DTE ≥ ${minDays}d | Moneyness &lt; ${maxMoneynessPct}%</span>
      </div>
    </div>

    <!-- (a) Top Candidates -->
    <div class="section-title">
      (a) Top Candidates — Ranked by Best Annualized Cash-Secured Return
    </div>
    <div style="overflow-x: auto;">
      <table>
        <thead>
          <tr>
            <th style="text-align: center;">#</th>
            <th>Ticker</th>
            <th style="text-align: right;">Spot Price</th>
            <th style="text-align: center;">Bollinger Band Position</th>
            <th style="text-align: right;">Strike</th>
            <th style="text-align: right;">Moneyness %</th>
            <th style="text-align: center;">Expiration (DTE)</th>
            <th style="text-align: right;">Put Bid</th>
            <th style="text-align: right;">Delta</th>
            <th style="text-align: right;">Ann. Return %</th>
          </tr>
        </thead>
        <tbody>
          ${candidateRows}
        </tbody>
      </table>
    </div>

    <!-- (b) Full Scan Notes -->
    <div class="section-title">
      (b) Full Scan Notes
    </div>
    <div style="background: #1e293b; padding: 16px; border-radius: 8px; font-size: 13px; color: #cbd5e1;">
      <p style="margin: 0 0 8px 0;">• <strong>Universe Overview:</strong> Scanned ${universeLength} total equities (the ~110 constituents of the Invesco QQQ Trust / Nasdaq-100 plus QQQ index and TQQQ 3x ETF).</p>
      <p style="margin: 0 0 8px 0;">• <strong>Filter Execution:</strong> Screened for cash-secured PUT option chains expiring in 6+ months (≥ 180 days out) with strike prices strictly under 70% of current spot price (moneyness &lt; 70%).</p>
      <p style="margin: 0 0 8px 0;">• <strong>Optimization:</strong> For each ticker, selected the single strike/expiration pair that maximizes annualized yield on cash required (`(premium / strike) * (365 / DTE)`).</p>
      <p style="margin: 0;">• <strong>Yield Range:</strong> Annualized yields in the qualifying candidates range from <strong>${candidates[0]?.annualized_return_pct || 0}%</strong> down to <strong>${candidates[candidates.length - 1]?.annualized_return_pct || 0}%</strong>.</p>
    </div>

    <!-- (c) Data Quality / Caveats -->
    <div class="section-title">
      (c) Data Quality & Caveats (${caveats.length} Tickers)
    </div>
    <div style="background: #020617; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; max-height: 200px; overflow-y: auto;">
      <ul style="margin: 0; padding-left: 20px;">
        ${caveatsList.length > 0 ? caveatsList : '<li style="color: #64748b;">No data quality caveats detected across the scanned universe.</li>'}
      </ul>
    </div>

    <div class="disclaimer">
      ⚠️ <strong>Trader Disclaimer:</strong> These figures are estimates derived from Tradier brokerage paper account market data & web sources. All quotes and Greeks should be verified against live trading quotes prior to executing orders.
    </div>
  </div>
</body>
</html>`;
}

runScan().catch(err => console.error("Scan script failed:", err));
