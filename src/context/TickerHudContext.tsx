import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { StockHudModal } from "../components/StockHudModal";
import { ActiveTab } from "../components/Header";

interface TickerHudContextType {
  openTickerHud: (ticker: string) => void;
  closeTickerHud: () => void;
  activeHudTicker: string | null;
}

const TickerHudContext = createContext<TickerHudContextType>({
  openTickerHud: () => {},
  closeTickerHud: () => {},
  activeHudTicker: null,
});

export const useTickerHud = () => useContext(TickerHudContext);

interface TickerHudProviderProps {
  children: React.ReactNode;
  onNavigateTab?: (tab: ActiveTab, ticker?: string) => void;
}

export const TickerHudProvider: React.FC<TickerHudProviderProps> = ({
  children,
  onNavigateTab,
}) => {
  const [activeHudTicker, setActiveHudTicker] = useState<string | null>(null);

  const openTickerHud = useCallback((ticker: string) => {
    if (!ticker) return;
    const clean = ticker.trim().toUpperCase();
    if (clean) {
      setActiveHudTicker(clean);
    }
  }, []);

  const closeTickerHud = useCallback(() => {
    setActiveHudTicker(null);
  }, []);

  // Global Table Click Interceptor:
  // Detect clicks on any symbol inside ANY table across the application
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // 1. Explicit data-ticker attribute
      const tickerEl = target.closest("[data-ticker]") as HTMLElement | null;
      if (tickerEl) {
        const ticker = tickerEl.getAttribute("data-ticker");
        if (ticker && /^[A-Z0-9.\-]{1,8}$/.test(ticker.trim().toUpperCase())) {
          e.preventDefault();
          e.stopPropagation();
          openTickerHud(ticker.trim().toUpperCase());
          return;
        }
      }

      // 2. Click inside any <table> cell
      const td = target.closest("td");
      const table = target.closest("table");
      if (table && td) {
        // If clicking on an explicit action button or input inside the cell, do not intercept
        if (
          target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          (target.tagName === "BUTTON" && !target.classList.contains("ticker-btn"))
        ) {
          return;
        }

        // Check if td or element has a ticker class or attribute
        const explicitSymbol = td.getAttribute("data-symbol");
        if (explicitSymbol && /^[A-Z0-9.\-]{1,8}$/.test(explicitSymbol.trim().toUpperCase())) {
          e.preventDefault();
          e.stopPropagation();
          openTickerHud(explicitSymbol.trim().toUpperCase());
          return;
        }

        // Check table header to see if this column is "Ticker", "Symbol", or "Stock"
        const colIndex = td.cellIndex;
        if (colIndex >= 0) {
          const th = table.querySelector(`thead tr th:nth-child(${colIndex + 1})`);
          const headerText = (th?.textContent || "").toLowerCase();
          const isTickerColumn =
            headerText.includes("ticker") ||
            headerText.includes("symbol") ||
            headerText.includes("stock") ||
            td.classList.contains("ticker-cell");

          if (isTickerColumn) {
            // Extract the first word from the cell (usually the ticker, e.g. "NVDA", "$128.40")
            const textContent = td.innerText || td.textContent || "";
            const potentialTicker = textContent
              .trim()
              .split(/[\s\n\r/]+/)[0]
              .replace(/[^A-Za-z0-9.\-]/g, "")
              .toUpperCase();

            // Valid ticker regex (1 to 5 uppercase characters, e.g. NVDA, QQQ, AAPL, BRK.B)
            if (
              potentialTicker.length >= 1 &&
              potentialTicker.length <= 6 &&
              /^[A-Z]{1,5}(\.[A-Z]{1,2})?$/.test(potentialTicker)
            ) {
              e.preventDefault();
              e.stopPropagation();
              openTickerHud(potentialTicker);
            }
          }
        }
      }
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [openTickerHud]);

  return (
    <TickerHudContext.Provider
      value={{
        openTickerHud,
        closeTickerHud,
        activeHudTicker,
      }}
    >
      {children}
      <StockHudModal
        isOpen={Boolean(activeHudTicker)}
        ticker={activeHudTicker}
        onClose={closeTickerHud}
        onNavigateTab={onNavigateTab}
      />
    </TickerHudContext.Provider>
  );
};

interface TickerSymbolButtonProps {
  ticker: string;
  subtitle?: string;
  className?: string;
  spotPrice?: number | null;
  badge?: React.ReactNode;
  showHudIcon?: boolean;
}

export const TickerSymbolButton: React.FC<TickerSymbolButtonProps> = ({
  ticker,
  subtitle,
  className = "",
  spotPrice,
  badge,
  showHudIcon = true,
}) => {
  const { openTickerHud } = useTickerHud();

  return (
    <div
      data-ticker={ticker}
      onClick={(e) => {
        e.stopPropagation();
        openTickerHud(ticker);
      }}
      className={`group/ticker inline-flex items-center gap-1.5 cursor-pointer text-left select-none transition-all ${className}`}
      title={`Click to open Technical HUD for ${ticker} (ATH, 52W High, RSI, Bollinger, Volatility)`}
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          <span className="font-bold text-white group-hover/ticker:text-cyan-400 group-hover/ticker:underline underline-offset-2 transition-colors">
            {ticker}
          </span>
          {showHudIcon && (
            <span className="opacity-0 group-hover/ticker:opacity-100 transition-opacity text-[10px] text-cyan-400 font-mono">
              [HUD]
            </span>
          )}
          {badge}
        </div>
        {subtitle && (
          <div className="text-[10px] text-slate-400 group-hover/ticker:text-slate-300">
            {subtitle}
          </div>
        )}
        {spotPrice !== undefined && spotPrice !== null && (
          <div className="text-[10px] text-slate-400 group-hover/ticker:text-slate-300">
            ${spotPrice.toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
};
