import React, { useRef, useEffect, ReactNode, useState, useLayoutEffect } from "react";
import { ArrowLeftRight } from "lucide-react";

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
  const [canScroll, setCanScroll] = useState(true);

  const syncWidthAndCheck = () => {
    const bottomEl = bottomScrollRef.current;
    const spacerEl = topSpacerRef.current;
    if (!bottomEl || !spacerEl) return;
    const scrollW = bottomEl.scrollWidth;
    const clientW = bottomEl.clientWidth;
    spacerEl.style.width = `${scrollW}px`;
    setCanScroll(scrollW > clientW + 2);
  };

  useLayoutEffect(() => {
    syncWidthAndCheck();
  });

  useEffect(() => {
    const topEl = topScrollRef.current;
    const bottomEl = bottomScrollRef.current;
    if (!topEl || !bottomEl) return;

    syncWidthAndCheck();

    const ro = new ResizeObserver(() => {
      syncWidthAndCheck();
    });
    ro.observe(bottomEl);
    if (bottomEl.firstElementChild) {
      ro.observe(bottomEl.firstElementChild);
    }

    let isSyncingTop = false;
    let isSyncingBottom = false;

    const onTopScroll = () => {
      if (isSyncingTop) {
        isSyncingTop = false;
        return;
      }
      isSyncingBottom = true;
      bottomEl.scrollLeft = topEl.scrollLeft;
    };

    const onBottomScroll = () => {
      if (isSyncingBottom) {
        isSyncingBottom = false;
        return;
      }
      isSyncingTop = true;
      topEl.scrollLeft = bottomEl.scrollLeft;
    };

    topEl.addEventListener("scroll", onTopScroll, { passive: true });
    bottomEl.addEventListener("scroll", onBottomScroll, { passive: true });

    window.addEventListener("resize", syncWidthAndCheck);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", syncWidthAndCheck);
      topEl.removeEventListener("scroll", onTopScroll);
      bottomEl.removeEventListener("scroll", onBottomScroll);
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* Top Horizontal Scrollbar Bar */}
      {canScroll && (
        <div className="bg-slate-950/95 border-b border-slate-800 px-3 py-1.5 flex items-center gap-2 select-none sticky top-0 z-20 backdrop-blur-xs">
          <div className="flex items-center gap-1.5 text-[11px] uppercase font-mono tracking-wider text-slate-400 font-semibold shrink-0">
            <ArrowLeftRight className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span>{label}</span>
          </div>
          <div
            ref={topScrollRef}
            className="flex-1 overflow-x-scroll overflow-y-hidden"
            style={{
              height: "16px",
              scrollbarColor: "#60a5fa #0f172a",
              scrollbarWidth: "thin",
            }}
            title="Drag scrollbar to pan table horizontally"
          >
            <div ref={topSpacerRef} style={{ height: "1px" }} />
          </div>
        </div>
      )}

      {/* Main Table Container */}
      <div ref={bottomScrollRef} className={tableContainerClassName}>
        {children}
      </div>
    </div>
  );
};
