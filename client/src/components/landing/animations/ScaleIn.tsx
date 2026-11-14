"use client";

import React from "react";
import { useInView, UseInViewOptions } from "@/lib/animations/useInView";

interface ScaleInProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  options?: UseInViewOptions;
}

export function ScaleIn({ children, className = "", delayMs, options }: ScaleInProps) {
  const { ref, isInView } = useInView<HTMLDivElement>(options);

  return (
    <div
      ref={ref}
      className={`anim-scale-in ${isInView ? "is-in-view" : ""} ${className}`.trim()}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
