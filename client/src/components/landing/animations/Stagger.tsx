"use client";

import React from "react";
import { useInView, UseInViewOptions } from "@/lib/animations/useInView";

interface StaggerProps {
  children: React.ReactNode;
  className?: string;
  options?: UseInViewOptions;
}

export function Stagger({ children, className = "", options }: StaggerProps) {
  const { ref, isInView } = useInView<HTMLDivElement>(options);

  return (
    <div ref={ref} className={`anim-stagger ${isInView ? "is-in-view" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}
