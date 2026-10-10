import fs from "fs";
import path from "path";

export interface ClaudeCoworkResearchItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  tickers: string[];
  tags: string[];
  source: string;
  author: string;
  format?: "html" | "markdown" | "text" | string;
  contentType?: string;
  payload?: any;
  createdAt: string;
  updatedAt: string;
}

const LOCAL_STORAGE_PATH = path.join(process.cwd(), "claude_cowork_research.json");

// Default initial sample research post so the tab is never empty on boot
const INITIAL_SAMPLE_RESEARCH: ClaudeCoworkResearchItem[] = [
  {
    id: "claude-sample-1",
    title: "NVDA & TSLA Institutional Options Volatility & Surface Skew Analysis",
    summary: "Claude Cowork deep-dive into implied volatility skew for TSLA upcoming earnings and NVDA Blackwell datacenter demand signals.",
    content: `# NVDA & TSLA Institutional Options Volatility & Surface Skew Analysis

**Agent:** Claude Cowork Market Research Assistant  
**Target Equities:** NVDA, TSLA, QQQ  
**Date:** ${new Date().toISOString().split("T")[0]}

---

### Executive Overview
Recent options flow highlights a strong institutional bullish bias on **NVDA** with heightened call volume on 125/130 strike calls expiring next month. Simultaneously, **TSLA** option skew indicates elevated downside protection pricing ahead of delivery announcements.

### Key Observations
1. **NVIDIA (NVDA):**
   * Delta 0.30 Put Options yield over 18% annualized return with cash-secured collateral.
   * Institutional net flow shows steady accumulation in $120-$125 put selling for income.
2. **Tesla (TSLA):**
   * Implied Volatility (IV) is trading at the 82nd percentile over 52 weeks.
   * Put options at $210 offer a 22.4% annualized return with a 15.2% downside margin of safety.

### Actionable Strategy Recommendation
* **Cash-Secured Put Strategy:** Sell TSLA $210 Puts with 30-45 DTE to lock in rich theta decay while buffer is above 15%.
* **Overlaid Stock Chart:** Overlay NVDA and TSLA against QQQ to confirm technical momentum before entering positions.
`,
    tickers: ["NVDA", "TSLA", "QQQ"],
    tags: ["Options Flow", "Implied Volatility", "Institutional"],
    source: "Claude Cowork Webhook API",
    author: "Claude Assistant",
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
];

export function loadClaudeCoworkResearch(): ClaudeCoworkResearchItem[] {
  try {
    if (fs.existsSync(LOCAL_STORAGE_PATH)) {
      const data = fs.readFileSync(LOCAL_STORAGE_PATH, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("[Claude Cowork Service] Error loading local research storage:", err);
  }
  // Initialize default sample file if missing or empty
  saveClaudeCoworkResearch(INITIAL_SAMPLE_RESEARCH);
  return INITIAL_SAMPLE_RESEARCH;
}

export function saveClaudeCoworkResearch(items: ClaudeCoworkResearchItem[]): void {
  try {
    fs.writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify(items, null, 2), "utf-8");
  } catch (err) {
    console.error("[Claude Cowork Service] Error saving research storage:", err);
  }
}

export function addClaudeCoworkResearch(item: Omit<ClaudeCoworkResearchItem, "id" | "createdAt" | "updatedAt"> & { id?: string }): ClaudeCoworkResearchItem {
  const current = loadClaudeCoworkResearch();
  const id = item.id || `claude-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newItem: ClaudeCoworkResearchItem = {
    id,
    title: item.title?.trim() || "Untitled Research Report from Claude Cowork",
    summary: item.summary?.trim() || "Research report submitted via inbound Webhook API.",
    content: item.content?.trim() || item.summary?.trim() || "No detailed content body provided.",
    tickers: Array.isArray(item.tickers)
      ? item.tickers.map((t) => String(t).trim().toUpperCase()).filter(Boolean)
      : typeof item.tickers === "string"
      ? (item.tickers as string).split(/[\s,]+/).map((t) => t.trim().toUpperCase()).filter(Boolean)
      : [],
    tags: Array.isArray(item.tags)
      ? item.tags.map((t) => String(t).trim()).filter(Boolean)
      : typeof item.tags === "string"
      ? (item.tags as string).split(/[\s,]+/).map((t) => t.trim()).filter(Boolean)
      : ["Claude Cowork"],
    source: item.source?.trim() || "Claude Cowork Webhook API",
    author: item.author?.trim() || "Claude Assistant",
    format: item.format || (/<[a-z][\s\S]*>/i.test(item.content || "") ? "html" : "markdown"),
    contentType: item.contentType || (/<[a-z][\s\S]*>/i.test(item.content || "") ? "text/html" : "text/markdown"),
    payload: item.payload || null,
    createdAt: now,
    updatedAt: now,
  };

  // Prepend so newest is first
  const updated = [newItem, ...current.filter((i) => i.id !== id)];
  saveClaudeCoworkResearch(updated);
  return newItem;
}

export function deleteClaudeCoworkResearch(id: string): boolean {
  const current = loadClaudeCoworkResearch();
  const filtered = current.filter((item) => item.id !== id);
  if (filtered.length !== current.length) {
    saveClaudeCoworkResearch(filtered);
    return true;
  }
  return false;
}
