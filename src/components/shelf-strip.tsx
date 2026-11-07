"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * One scrolling shelf that feels right on whatever the viewer is holding:
 *
 *   phone    → native swipe with snap points + page dots
 *   trackpad → horizontal pan (native) with the arrows as an extra
 *   mouse    → click-and-drag to pan, wheel to sweep, edge arrows, keyboard
 *
 * A drag never opens the title behind the pointer — the click that ends a pan
 * is swallowed, so dragging past a card can't fire it by accident.
 */
export function ShelfStrip({
  children,
  className,
  contentClassName,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  label?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const [pages, setPages] = useState({ count: 1, index: 0 });
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: 0 });
  const swallowClick = useRef(false);

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const count = max <= 12 ? 1 : Math.ceil(el.scrollWidth / Math.max(el.clientWidth, 1));
    setEdges({ left: el.scrollLeft > 8, right: max - el.scrollLeft > 8 });
    setPages({
      count,
      index: max <= 12 ? 0 : Math.min(count - 1, Math.round(el.scrollLeft / Math.max(el.clientWidth, 1))),
    });
  }, []);

  useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el) return;
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child));
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure, children]);

  const nudge = (dir: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.86), behavior: "smooth" });
  };

  const jumpTo = (page: number) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: page * el.clientWidth, behavior: "smooth" });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return; // let the browser swipe natively
    const el = scroller.current;
    if (!el) return;
    drag.current = { active: true, startX: event.clientX, startLeft: el.scrollLeft, moved: 0 };
    el.style.scrollSnapType = "none";
    el.style.scrollBehavior = "auto";
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = scroller.current;
    const state = drag.current;
    if (!state.active || !el) return;
    const dx = event.clientX - state.startX;
    state.moved = Math.max(state.moved, Math.abs(dx));
    if (state.moved > 4) el.scrollLeft = state.startLeft - dx;
  };

  const endDrag = () => {
    const el = scroller.current;
    const state = drag.current;
    if (!state.active) return;
    state.active = false;
    if (el) {
      el.style.scrollSnapType = "";
      el.style.scrollBehavior = "";
    }
    if (state.moved > 8) {
      swallowClick.current = true;
      window.setTimeout(() => {
        swallowClick.current = false;
      }, 60);
    }
  };

  const onClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!swallowClick.current) return;
    event.preventDefault();
    event.stopPropagation();
    swallowClick.current = false;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      nudge(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      nudge(-1);
    } else if (event.key === "Home") {
      scroller.current?.scrollTo({ left: 0, behavior: "smooth" });
    } else if (event.key === "End") {
      const el = scroller.current;
      el?.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
    }
  };

  return (
    <div className={cn("group/shelf relative", className)}>
      <button
        type="button"
        aria-label="Scroll left"
        onClick={() => nudge(-1)}
        disabled={!edges.left}
        className={cn(
          "absolute left-0 top-0 z-20 hidden h-full w-10 items-center justify-center rounded-r bg-black/50 text-white opacity-0 transition duration-300 hover:bg-black/75 disabled:pointer-events-none disabled:opacity-0 md:flex md:w-12",
          edges.left && "pointer-events-auto group-hover/shelf:opacity-100",
        )}
      >
        <ChevronLeftIcon width={30} height={30} />
      </button>

      <button
        type="button"
        aria-label="Scroll right"
        onClick={() => nudge(1)}
        disabled={!edges.right}
        className={cn(
          "absolute right-0 top-0 z-20 hidden h-full w-10 items-center justify-center rounded-l bg-black/50 text-white opacity-0 transition duration-300 hover:bg-black/75 disabled:pointer-events-none disabled:opacity-0 md:flex md:w-12",
          edges.right && "pointer-events-auto group-hover/shelf:opacity-100",
        )}
      >
        <ChevronRightIcon width={30} height={30} />
      </button>

      <div
        ref={scroller}
        role="list"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={onClickCapture}
        className={cn(
          "no-scrollbar flex snap-x snap-mandatory items-start gap-2 overflow-x-auto overscroll-x-contain px-4 pb-6 outline-none md:cursor-grab md:gap-2.5 md:px-12 md:snap-proximity md:active:cursor-grabbing",
          contentClassName,
        )}
      >
        {children}
      </div>

      {/* page dots — the swipe affordance on touch screens */}
      {pages.count > 1 && (
        <div className="mt-1 flex items-center justify-center gap-1.5 md:hidden">
          {Array.from({ length: pages.count }).map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Go to page ${index + 1}`}
              onClick={() => jumpTo(index)}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                index === pages.index ? "w-5 bg-white" : "w-1.5 bg-white/30",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
