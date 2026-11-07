"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Mounts its children only when it gets close to the viewport.
 *
 * The home page is ~25 shelves deep; painting all of them up front is what made
 * phones feel heavy. Reserving the space keeps the scrollbar honest and the
 * first interaction instant.
 */
export function LazySection({
  children,
  minHeight = 280,
  rootMargin = "700px",
  className,
}: {
  children: ReactNode;
  minHeight?: number;
  rootMargin?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setShow(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShow(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={className} style={show ? undefined : { minHeight }}>
      {show ? children : null}
    </div>
  );
}
