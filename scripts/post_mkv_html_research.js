import fs from 'fs';

async function main() {
  const html = fs.readFileSync('mkv_qqq_scan_digest.html', 'utf-8');

  const bodyData = JSON.stringify({
    title: "MKV Morning QQQ Deep-OTM Cash-Secured Put Scan Digest",
    summary: "Automated daily morning options scan for MKV across all 110 QQQ components + TQQQ (DTE ≥ 180d, Strike < 70% spot, Tradier broker quotes). Best candidates sorted by annualized yield.",
    content: html,
    tickers: ["QQQ", "TQQQ", "CHTR", "MU", "BKNG", "MSTR", "PLTR", "META", "AMD", "NVDA", "TSLA", "AMZN", "MSFT", "AAPL", "COST"],
    tags: ["MKV Scan", "Cash-Secured Put", "QQQ Components", "Deep-OTM", "Tradier Data"],
    author: "GEMINI Research",
    source: "Automated Options Screener Engine",
    format: "html",
    contentType: "text/html"
  });

  const res = await fetch('http://localhost:3000/api/webhook/claude-cowork', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'claude_cowork_secret_93942aad'
    },
    body: bodyData
  });

  const json = await res.json();
  console.log('Ingested successfully:', json.success, json.message, 'Title:', json.item?.title);
}

main().catch(console.error);
