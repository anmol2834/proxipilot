"use client";

import React from "react";
import { useInView, UseInViewOptions } from "@/lib/animations/useInView";

interface FadeUpProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  options?: UseInViewOptions;
}

export function FadeUp({ children, className = "", delayMs, options }: FadeUpProps) {
  const { ref, isInView } = useInView<HTMLDivElement>(options);

  return (
    <div
      ref={ref}
      className={`anim-fade-up ${isInView ? "is-in-view" : ""} ${className}`.trim()}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
