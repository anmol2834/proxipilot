"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface BrandLogo {
  id: string;
  name: string;
  icon: React.ReactNode;
}

const BRANDS: BrandLogo[] = [
  {
    id: "acme",
    name: "Acme Inc.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 22h20L12 2zm0 6l5 10H7l5-10z" />
      </svg>
    ),
  },
  {
    id: "vertex",
    name: "Vertex",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 22L2 4h6l4 10 4-10h6L12 22z" />
      </svg>
    ),
  },
  {
    id: "lumen",
    name: "Lumen",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="12" cy="12" r="3" fill="currentColor" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="4.93" y1="4.93" x2="7.05" y2="7.05" />
        <line x1="16.95" y1="16.95" x2="19.07" y2="19.07" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
        <line x1="4.93" y1="19.07" x2="7.05" y2="16.95" />
        <line x1="16.95" y1="7.05" x2="19.07" y2="4.93" />
      </svg>
    ),
  },
  {
    id: "orion",
    name: "Orion",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
        <circle cx="12" cy="12" r="8" />
      </svg>
    ),
  },
  {
    id: "novatech",
    name: "NovaTech",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4 4h4.5l7 10.5V4H20v16h-4.5L8.5 9.5V20H4V4z" />
      </svg>
    ),
  },
  {
    id: "pioneer",
    name: "Pioneer",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4 4h8a6 6 0 0 1 6 6 6 6 0 0 1-6 6H9v4H4V4zm5 7h3a2 2 0 0 0 2-2 2 2 0 0 0-2-2H9v4z" />
      </svg>
    ),
  },
];

export function TrustedLogosStrip() {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: { xs: 2, sm: 3, md: 4 },
        py: { xs: 2, sm: 3 },
        mb: { xs: 4, sm: 5, md: 6 },
        width: "100%",
        maxWidth: 1040,
        mx: "auto",
      }}
    >
      {BRANDS.map((brand, idx) => (
        <React.Fragment key={brand.id}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              color: "#334155",
              opacity: 0.85,
              transition: "opacity 180ms ease, transform 180ms ease",
              "&:hover": { opacity: 1, transform: "scale(1.03)" },
            }}
          >
            {brand.icon}
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: { xs: "0.875rem", sm: "0.9375rem" },
                letterSpacing: "-0.01em",
                color: "#1E293B",
              }}
            >
              {brand.name}
            </Typography>
          </Box>
          {idx < BRANDS.length - 1 && (
            <Box
              sx={{
                display: { xs: "none", sm: "block" },
                width: "1px",
                height: 20,
                backgroundColor: "#E2E8F0",
              }}
            />
          )}
        </React.Fragment>
      ))}
    </Box>
  );
}
