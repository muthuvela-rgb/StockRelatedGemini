import fs from "fs";

function buildHtml() {
  const data = JSON.parse(fs.readFileSync("full_mkv_qqq_scan.json", "utf-8"));
  const candidates: any[] = data.candidates || [];
  const caveats: any[] = data.caveats || [];
  const universeCount = data.universe_count || 112;
  const scanDate = new Date(data.scan_date || Date.now()).toUTCString();

  const topCandidates = candidates.slice(0, Math.max(50, candidates.length));

  const rows = topCandidates.map((c, idx) => {
    const bg = idx % 2 === 0 ? "#0f172a" : "#1e293b";
    let bollingerBg = "#1e3a8a";
    let bollingerColor = "#93c5fd";
    if (c.bollinger_position.includes("Below")) {
      bollingerBg = "#7f1d1d";
      bollingerColor = "#fca5a5";
    } else if (c.bollinger_position.includes("Above")) {
      bollingerBg = "#701a75";
      bollingerColor = "#f5d0fe";
    } else if (c.bollinger_position.includes("Upper")) {
      bollingerBg = "#14532d";
      bollingerColor = "#86efac";
    }

    return `
      <tr style="background-color: ${bg}; border-bottom: 1px solid #334155;">
        <td style="padding: 10px 12px; font-weight: bold; color: #94a3b8; text-align: center;">${idx + 1}</td>
        <td style="padding: 10px 12px; font-weight: bold; color: #38bdf8; font-family: monospace; font-size: 14px;">${c.ticker}</td>
        <td style="padding: 10px 12px; text-align: right; color: #f8fafc; font-family: monospace;">$${c.spot_price.toFixed(2)}</td>
        <td style="padding: 10px 12px; text-align: center; color: #cbd5e1; font-size: 12px;">
          <span style="display: inline-block; padding: 3px 8px; border-radius: 4px; background: ${bollingerBg}; color: ${bollingerColor}; font-weight: 600;">
            ${c.bollinger_position}
          </span>
        </td>
        <td style="padding: 10px 12px; text-align: right; font-weight: bold; color: #fbbf24; font-family: monospace;">$${c.strike.toFixed(2)}</td>
        <td style="padding: 10px 12px; text-align: right; color: #94a3b8; font-family: monospace;">${c.moneyness_pct.toFixed(1)}%</td>
        <td style="padding: 10px 12px; text-align: center; color: #e2e8f0; font-family: monospace; font-size: 13px;">${c.expiration_date} (${c.dte}d)</td>
        <td style="padding: 10px 12px; text-align: right; color: #34d399; font-weight: bold; font-family: monospace;">$${c.bid.toFixed(2)}</td>
        <td style="padding: 10px 12px; text-align: right; color: #a78bfa; font-family: monospace;">${c.delta.toFixed(3)}</td>
        <td style="padding: 10px 12px; text-align: right; font-weight: bold; color: #38bdf8; font-family: monospace; font-size: 14px; background: rgba(56, 189, 248, 0.12);">
          ${c.annualized_return_pct.toFixed(2)}%
        </td>
      </tr>
    `;
  }).join("");

  const caveatItems = caveats.map(c => `
    <li style="margin-bottom: 6px; color: #94a3b8; font-size: 13px;">
      <strong style="color: #f8fafc; font-family: monospace;">${c.ticker}</strong> ${c.spot_price ? `($${c.spot_price.toFixed(2)})` : ''}: ${c.reason}
    </li>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>MKV Scheduled Morning Options Scan Digest - Deep OTM Cash-Secured Puts (QQQ Universe)</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 24px; line-height: 1.5; }
    .container { max-width: 1250px; margin: 0 auto; background-color: #0f172a; border-radius: 12px; border: 1px solid #1e293b; padding: 28px; box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.5); }
    .header { border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px; }
    .title { font-size: 24px; font-weight: 800; color: #38bdf8; margin: 0 0 8px 0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
    .badge { font-size: 12px; background: #1e3a8a; color: #93c5fd; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; }
    .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; background: #1e293b; padding: 16px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #334155; }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 2px; }
    .meta-value { font-size: 15px; font-weight: 700; color: #f1f5f9; font-family: monospace; }
    .section-title { font-size: 18px; font-weight: 700; color: #f8fafc; margin: 28px 0 16px 0; padding-bottom: 6px; border-bottom: 1px solid #334155; display: flex; align-items: center; gap: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
    th { background-color: #1e293b; color: #94a3b8; text-transform: uppercase; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; padding: 12px; text-align: left; border-bottom: 2px solid #334155; }
    .disclaimer { background: rgba(234, 179, 8, 0.1); border-left: 4px solid #eab308; padding: 14px 18px; border-radius: 4px; color: #fef08a; font-size: 12px; margin-top: 28px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">
        <span>⚡ MKV Scheduled Morning Options Scan Digest</span>
        <span class="badge">Tradier Brokerage Market Data</span>
      </div>
      <div style="color: #94a3b8; font-size: 14px;">Automated Deep-OTM Cash-Secured Put Screener for QQQ Index Components & TQQQ</div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <span class="meta-label">Scan Timestamp</span>
        <span class="meta-value">${scanDate}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Scanned Universe</span>
        <span class="meta-value">${universeCount} Symbols</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Qualifying Candidates</span>
        <span class="meta-value" style="color: #34d399;">${candidates.length} Tickers</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Screening Criteria</span>
        <span class="meta-value" style="color: #fbbf24;">DTE ≥ 180d | Moneyness &lt; 70%</span>
      </div>
    </div>

    <!-- (a) Top candidates -->
    <div class="section-title">
      (a) Top Candidates — QQQ Components & TQQQ (Sorted Best Annualized Cash-Secured Return First)
    </div>
    <div style="overflow-x: auto;">
      <table>
        <thead>
          <tr>
            <th style="text-align: center;">#</th>
            <th>Ticker</th>
            <th style="text-align: right;">Spot Price</th>
            <th style="text-align: center;">Bollinger Position</th>
            <th style="text-align: right;">Chosen Strike</th>
            <th style="text-align: right;">Moneyness %</th>
            <th style="text-align: center;">Expiration (DTE)</th>
            <th style="text-align: right;">Put Bid</th>
            <th style="text-align: right;">Delta</th>
            <th style="text-align: right;">Ann. Return %</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>

    <!-- (b) Full scan notes -->
    <div class="section-title">
      (b) Full Scan Notes
    </div>
    <div style="background: #1e293b; padding: 18px; border-radius: 8px; font-size: 13px; color: #cbd5e1; border: 1px solid #334155;">
      <p style="margin: 0 0 10px 0;">• <strong>Universe Overview:</strong> Scanned ${universeCount} total symbols (all ~110 current constituents of the Invesco QQQ Trust / Nasdaq-100, plus QQQ index and TQQQ 3x ETF).</p>
      <p style="margin: 0 0 10px 0;">• <strong>Option Type & Strategy:</strong> Cash-Secured Put (sell to open) targeting deep out-of-the-money put contracts.</p>
      <p style="margin: 0 0 10px 0;">• <strong>Expiration Filter:</strong> Retained all option chains with expiration dates ≥ 6 months (≥ 180 days out).</p>
      <p style="margin: 0 0 10px 0;">• <strong>Strike Selection:</strong> Moneyness strictly &lt; 70% (i.e. put strike price / underlying current price &lt; 0.70).</p>
      <p style="margin: 0 0 10px 0;">• <strong>Optimization Rule:</strong> Selected the single strike price and expiration date for each ticker that maximizes annualized yield on cash secured: (premium / strike) * (365 / DTE) * 100%.</p>
      <p style="margin: 0;">• <strong>Qualifying Results:</strong> Found qualifying deep-OTM put contracts across <strong>${candidates.length}</strong> tickers with annualized yields ranging from <strong>${candidates[0]?.annualized_return_pct.toFixed(2)}%</strong> down to <strong>${candidates[candidates.length - 1]?.annualized_return_pct.toFixed(2)}%</strong>.</p>
    </div>

    <!-- (c) Data quality / caveats -->
    <div class="section-title">
      (c) Data Quality & Caveats (${caveats.length} Tickers Flagged)
    </div>
    <div style="background: #020617; border: 1px solid #334155; border-radius: 8px; padding: 16px; max-height: 200px; overflow-y: auto;">
      <ul style="margin: 0; padding-left: 20px;">
        ${caveatItems.length > 0 ? caveatItems : '<li style="color: #64748b;">No data quality caveats detected. All symbols passed liquid option checks.</li>'}
      </ul>
    </div>

    <div class="disclaimer">
      ⚠️ <strong>Trader Note:</strong> These figures are estimates derived from web and Tradier paper account market data. Figures should be verified against live trading quotes before executing orders.
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync("mkv_qqq_scan_digest.html", html, "utf-8");
  console.log("Successfully generated mkv_qqq_scan_digest.html!");
}

buildHtml();
