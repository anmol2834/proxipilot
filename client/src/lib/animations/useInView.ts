"use client";

import { useEffect, useRef, useState } from "react";

export interface UseInViewOptions {
  threshold?: number | number[];
  rootMargin?: string;
  triggerOnce?: boolean;
}

/**
 * Lightweight IntersectionObserver hook for high-performance scroll triggers.
 * Automatically disconnects once triggered when triggerOnce is true (default).
 * Avoids scroll event listeners and prevents unnecessary React re-renders.
 */
export function useInView<T extends HTMLElement = HTMLElement>(options: UseInViewOptions = {}) {
  const { threshold = 0.15, rootMargin = "0px 0px -40px 0px", triggerOnce = true } = options;
  const ref = useRef<T | null>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      // Fallback for SSR or unsupported environments: immediately visible
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          if (triggerOnce) {
            observer.unobserve(element);
            observer.disconnect();
          }
        } else if (!triggerOnce) {
          setIsInView(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin, triggerOnce]);

  return { ref, isInView };
}
