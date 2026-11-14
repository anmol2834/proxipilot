"use client";

import React from "react";
import { useInView, UseInViewOptions } from "@/lib/animations/useInView";

interface FadeInProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  options?: UseInViewOptions;
}

export function FadeIn({ children, className = "", delayMs, options }: FadeInProps) {
  const { ref, isInView } = useInView<HTMLDivElement>(options);

  return (
    <div
      ref={ref}
      className={`anim-fade-in ${isInView ? "is-in-view" : ""} ${className}`.trim()}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
