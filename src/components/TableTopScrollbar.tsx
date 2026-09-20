import React, { useRef, useEffect, ReactNode, useState, useLayoutEffect, useCallback } from "react";
import { ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";

interface TableTopScrollbarProps {
  children: ReactNode;
  className?: string;
  tableContainerClassName?: string;
  label?: string;
}

export const TableTopScrollbar: React.FC<TableTopScrollbarProps> = ({
  children,
  className = "",
  tableContainerClassName = "overflow-x-auto",
  label = "Scroll Table",
}) => {
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const topSpacerRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState<boolean>(true);
  const [scrollProgress, setScrollProgress] = useState<number>(0);

  const syncWidthAndCheck = useCallback(() => {
    const bottomEl = bottomScrollRef.current;
    const spacerEl = topSpacerRef.current;
    if (!bottomEl || !spacerEl) return;
    const scrollW = bottomEl.scrollWidth;
    const clientW = bottomEl.clientWidth;
    spacerEl.style.width = `${scrollW}px`;
    const hasScroll = scrollW > clientW + 4;
    setCanScroll(hasScroll);

    if (hasScroll && scrollW > clientW) {
      const maxScroll = scrollW - clientW;
      const pct = Math.min(100, Math.max(0, (bottomEl.scrollLeft / maxScroll) * 100));
      setScrollProgress(Math.round(pct));
    } else {
      setScrollProgress(0);
    }
  }, []);

  useLayoutEffect(() => {
    syncWidthAndCheck();
  });

  useEffect(() => {
    const topEl = topScrollRef.current;
    const bottomEl = bottomScrollRef.current;
    if (!bottomEl) return;

    syncWidthAndCheck();

    const ro = new ResizeObserver(() => {
      syncWidthAndCheck();
    });
    ro.observe(bottomEl);
    if (bottomEl.firstElementChild) {
      ro.observe(bottomEl.firstElementChild);
    }

    const mo = new MutationObserver(() => {
      syncWidthAndCheck();
      if (bottomEl.firstElementChild) {
        ro.observe(bottomEl.firstElementChild);
      }
    });
    mo.observe(bottomEl, { childList: true, subtree: true });

    let isSyncingTop = false;
    let isSyncingBottom = false;

    const onTopScroll = () => {
      if (!topEl) return;
      if (isSyncingTop) {
        isSyncingTop = false;
        return;
      }
      isSyncingBottom = true;
      bottomEl.scrollLeft = topEl.scrollLeft;

      const maxScroll = bottomEl.scrollWidth - bottomEl.clientWidth;
      if (maxScroll > 0) {
        setScrollProgress(Math.round((bottomEl.scrollLeft / maxScroll) * 100));
      }
    };

    const onBottomScroll = () => {
      if (isSyncingBottom) {
        isSyncingBottom = false;
        return;
      }
      isSyncingTop = true;
      if (topEl) {
        topEl.scrollLeft = bottomEl.scrollLeft;
      }

      const maxScroll = bottomEl.scrollWidth - bottomEl.clientWidth;
      if (maxScroll > 0) {
        setScrollProgress(Math.round((bottomEl.scrollLeft / maxScroll) * 100));
      }
    };

    if (topEl) {
      topEl.addEventListener("scroll", onTopScroll, { passive: true });
    }
    bottomEl.addEventListener("scroll", onBottomScroll, { passive: true });

    window.addEventListener("resize", syncWidthAndCheck);

    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", syncWidthAndCheck);
      if (topEl) {
        topEl.removeEventListener("scroll", onTopScroll);
      }
      bottomEl.removeEventListener("scroll", onBottomScroll);
    };
  }, [syncWidthAndCheck]);

  const handleStepScroll = (direction: "left" | "right") => {
    const bottomEl = bottomScrollRef.current;
    if (!bottomEl) return;
    const delta = direction === "left" ? -280 : 280;
    bottomEl.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <div className={`relative ${className}`}>
      {/* Top Horizontal Scrollbar Bar */}
      {canScroll && (
        <div className="bg-slate-950 border-b border-slate-800/90 px-3 py-2 flex items-center gap-2.5 select-none sticky top-0 z-20 backdrop-blur-md shadow-sm">
          {/* Label and Quick Arrow Steppers */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-[11px] uppercase font-mono tracking-wider text-slate-300 font-bold">
              <ArrowLeftRight className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              <span>{label}</span>
            </div>

            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => handleStepScroll("left")}
                className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
                title="Pan table left"
                aria-label="Pan left"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleStepScroll("right")}
                className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
                title="Pan table right"
                aria-label="Pan right"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Native / Styled Top Scrollbar Channel */}
          <div
            ref={topScrollRef}
            className="flex-1 overflow-x-scroll overflow-y-hidden rounded-lg bg-slate-900/80 border border-slate-800 p-0.5"
            style={{
              height: "20px",
              scrollbarColor: "#3b82f6 #1e293b",
              scrollbarWidth: "auto",
            }}
            title="Drag top scrollbar to pan table horizontally"
          >
            <div ref={topSpacerRef} style={{ height: "1px" }} />
          </div>

          {/* Progress Indicator */}
          <span className="text-[10px] font-mono text-slate-400 shrink-0 hidden sm:inline-block w-9 text-right font-medium">
            {scrollProgress}%
          </span>
        </div>
      )}

      {/* Main Table Container */}
      <div ref={bottomScrollRef} className={tableContainerClassName}>
        {children}
      </div>
    </div>
  );
};
