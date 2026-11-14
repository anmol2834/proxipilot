"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
  avatar: string;
  metrics: Array<{
    value: string;
    label: string;
  }>;
}

const TESTIMONIALS: Testimonial[] = [
  {
    id: "aarav",
    quote:
      "ProxiPilot reduced the manual work around our inbox and helps us respond faster with consistent, accurate information.",
    author: "Aarav Khan",
    role: "Head of Operations, Acme Inc.",
    avatar: "AK",
    metrics: [
      { value: "70%", label: "less manual work" },
      { value: "3x", label: "faster response time" },
      { value: "90%", label: "improved accuracy" },
    ],
  },
  {
    id: "sarah",
    quote:
      "Our support team handles 3x the volume with zero seasonal contractor overhead and complete leadership trust.",
    author: "Sarah Parker",
    role: "VP of Customer Support, Vertex",
    avatar: "SP",
    metrics: [
      { value: "85%", label: "first-contact resolution" },
      { value: "4.8/5", label: "CSAT customer rating" },
      { value: "< 45s", label: "average response time" },
    ],
  },
  {
    id: "elena",
    quote:
      "Evidence-gated generation gave our operations team the confidence to automate sensitive tier-1 customer workflows safely.",
    author: "Elena Rostova",
    role: "Director of Operations, NovaTech",
    avatar: "ER",
    metrics: [
      { value: "99.4%", label: "factual accuracy" },
      { value: "62%", label: "support cost savings" },
      { value: "0", label: "hallucinations" },
    ],
  },
];

export function TestimonialCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? TESTIMONIALS.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === TESTIMONIALS.length - 1 ? 0 : prev + 1));
  };

  const current = TESTIMONIALS[currentIndex];

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 1140,
        mx: "auto",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        mb: { xs: 5, sm: 6, md: 7 },
      }}
    >
      {/* Carousel Main Container with Side Navigation Arrows */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          position: "relative",
          gap: { xs: 1.5, sm: 2.5, md: 3 },
        }}
      >
        {/* Left Arrow Button */}
        <Box
          component="button"
          onClick={handlePrev}
          aria-label="Previous testimonial"
          sx={{
            width: { xs: 38, sm: 44 },
            height: { xs: 38, sm: 44 },
            borderRadius: "50%",
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            boxShadow: "0 4px 14px rgba(0, 0, 0, 0.05)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#0F172A",
            cursor: "pointer",
            flexShrink: 0,
            transition: "all 180ms ease",
            zIndex: 3,
            "&:hover": {
              backgroundColor: "#F8FAFC",
              transform: "scale(1.05)",
              boxShadow: "0 6px 18px rgba(0, 0, 0, 0.08)",
            },
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Box>

        {/* Central Featured Testimonial Card */}
        <Box
          sx={{
            flex: 1,
            maxWidth: 880,
            backgroundColor: "#FFFFFF",
            borderRadius: "24px",
            border: "1px solid #EEF2F6",
            boxShadow:
              "0 20px 45px -10px rgba(15, 23, 42, 0.06), 0 10px 20px -5px rgba(0, 0, 0, 0.03)",
            p: { xs: 3, sm: 4, md: 5 },
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            alignItems: { xs: "flex-start", md: "center" },
            gap: { xs: 3.5, md: 4.5 },
            transition: "all 250ms ease",
            position: "relative",
            zIndex: 2,
          }}
        >
          {/* Left Quote Column */}
          <Box sx={{ flex: { md: "1 1 58%" } }}>
            {/* Quote Icon */}
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: "10px",
                backgroundColor: "#EFF6FF",
                color: "#3B82F6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 2,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
              </svg>
            </Box>

            {/* Quote Text */}
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: { xs: "1.0625rem", sm: "1.1875rem", md: "1.25rem" },
                lineHeight: 1.5,
                color: "#0F172A",
                mb: 3,
                letterSpacing: "-0.015em",
              }}
            >
              &ldquo;{current.quote}&rdquo;
            </Typography>

            {/* Author Row */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  backgroundColor: "#F1F5F9",
                  color: "#475569",
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {current.avatar}
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: "0.875rem", color: "#0F172A", lineHeight: 1.25 }}>
                  {current.author}
                </Typography>
                <Typography sx={{ fontSize: "0.78125rem", color: "#64748B", lineHeight: 1.25 }}>
                  {current.role}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Vertical Divider (Desktop) */}
          <Box
            sx={{
              display: { xs: "none", md: "block" },
              width: "1px",
              alignSelf: "stretch",
              backgroundColor: "#EEF2F6",
            }}
          />

          {/* Right Impact Metrics Column */}
          <Box
            sx={{
              flex: { md: "1 1 42%" },
              display: "flex",
              flexDirection: "column",
              gap: 2.25,
              width: "100%",
            }}
          >
            {current.metrics.map((metric, idx) => (
              <Box key={idx} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box
                  sx={{
                    color: "#10B981",
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </Box>
                <Box>
                  <Typography
                    sx={{
                      fontWeight: 800,
                      fontSize: { xs: "1.35rem", sm: "1.5rem" },
                      lineHeight: 1.1,
                      color: "#3B82F6",
                    }}
                  >
                    {metric.value}
                  </Typography>
                  <Typography sx={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 500 }}>
                    {metric.label}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Right Arrow Button */}
        <Box
          component="button"
          onClick={handleNext}
          aria-label="Next testimonial"
          sx={{
            width: { xs: 38, sm: 44 },
            height: { xs: 38, sm: 44 },
            borderRadius: "50%",
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            boxShadow: "0 4px 14px rgba(0, 0, 0, 0.05)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#0F172A",
            cursor: "pointer",
            flexShrink: 0,
            transition: "all 180ms ease",
            zIndex: 3,
            "&:hover": {
              backgroundColor: "#F8FAFC",
              transform: "scale(1.05)",
              boxShadow: "0 6px 18px rgba(0, 0, 0, 0.08)",
            },
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Box>
      </Box>

      {/* Pagination Bar Indicators */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 3 }}>
        {TESTIMONIALS.map((_, idx) => {
          const isActive = idx === currentIndex;
          return (
            <Box
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              sx={{
                width: isActive ? 36 : 24,
                height: 4,
                borderRadius: "9999px",
                backgroundColor: isActive ? "#4F46E5" : "#E2E8F0",
                cursor: "pointer",
                transition: "all 200ms ease",
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
}
