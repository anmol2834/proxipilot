"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Container } from "./layout";
import { landingConfig } from "@/config/landing";

const SOCIAL_LINKS = [
  {
    name: "LinkedIn",
    href: "https://linkedin.com",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
      </svg>
    ),
  },
  {
    name: "X",
    href: "https://x.com",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    name: "YouTube",
    href: "https://youtube.com",
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    name: "GitHub",
    href: "https://github.com",
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    ),
  },
];

export function LandingFooter() {
  const { footer, navigation } = landingConfig;

  return (
    <Box
      component="footer"
      sx={{
        backgroundColor: "#FFFFFF",
        pt: { xs: 8, md: 10 },
        pb: { xs: 6, md: 7 },
      }}
    >
      <Container size="xl">
        {/* Main Footer Links Grid */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "2.6fr repeat(4, 1fr)" },
            gap: { xs: 5, md: 4 },
            mb: { xs: 7, md: 9 },
          }}
        >
          {/* Left Brand Column */}
          <Box sx={{ pr: { md: 3 } }}>
            {/* Logo */}
            <Box
              component="a"
              href="#hero"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1.25,
                textDecoration: "none",
                color: "#0F172A",
                mb: 2,
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "10px",
                  backgroundColor: "#2563EB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                </svg>
              </Box>
              <Typography
                variant="h6"
                component="span"
                sx={{
                  fontWeight: 800,
                  fontSize: "1.375rem",
                  letterSpacing: "-0.025em",
                  color: "#0F172A",
                }}
              >
                {navigation.brandName}
              </Typography>
            </Box>

            {/* Tagline */}
            <Typography
              sx={{
                color: "#64748B",
                fontSize: "0.95rem",
                lineHeight: 1.5,
                maxWidth: 280,
                mb: 1.5,
              }}
            >
              Intelligent email automation for modern teams.
            </Typography>

            {/* Subtagline: LESS INBOX. MORE IMPACT. */}
            <Typography
              sx={{
                color: "#94A3B8",
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                mb: 3,
              }}
            >
              LESS INBOX. MORE IMPACT.
            </Typography>

            {/* Social Icons Row */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              {SOCIAL_LINKS.map((item) => (
                <Box
                  key={item.name}
                  component="a"
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.name}
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    color: "#475569",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textDecoration: "none",
                    transition: "all 150ms ease",
                    "&:hover": {
                      backgroundColor: "#EFF6FF",
                      borderColor: "#BFDBFE",
                      color: "#2563EB",
                      transform: "translateY(-1px)",
                    },
                  }}
                >
                  {item.icon}
                </Box>
              ))}
            </Box>
          </Box>

          {/* 4 Nav Columns */}
          {footer.columns.map((column) => (
            <Box key={column.title}>
              <Typography
                sx={{
                  fontWeight: 700,
                  color: "#0F172A",
                  fontSize: "0.95rem",
                  letterSpacing: "-0.01em",
                  mb: 2.25,
                }}
              >
                {column.title}
              </Typography>
              <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0 }}>
                {column.links.map((link) => (
                  <Box component="li" key={link.label} sx={{ mb: 1.5 }}>
                    <Box
                      component="a"
                      href={link.href}
                      sx={{
                        fontSize: "0.9rem",
                        color: "#64748B",
                        textDecoration: "none",
                        transition: "color 150ms ease",
                        "&:hover": { color: "#2563EB" },
                      }}
                    >
                      {link.label}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Box>

        {/* Bottom Bar: Copyright & Legal / Status */}
        <Box
          sx={{
            pt: 3.5,
            borderTop: "1px solid #EEF2F6",
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "center", sm: "center" },
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Typography sx={{ color: "#64748B", fontSize: "0.85rem" }}>
            {footer.copyright}
          </Typography>

          <Box sx={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
            <Box
              component="a"
              href="/privacy"
              sx={{
                fontSize: "0.85rem",
                color: "#64748B",
                textDecoration: "none",
                "&:hover": { color: "#0F172A" },
              }}
            >
              Privacy
            </Box>
            <Box sx={{ width: "1px", height: 12, backgroundColor: "#CBD5E1" }} />
            <Box
              component="a"
              href="/terms"
              sx={{
                fontSize: "0.85rem",
                color: "#64748B",
                textDecoration: "none",
                "&:hover": { color: "#0F172A" },
              }}
            >
              Terms
            </Box>
            <Box sx={{ width: "1px", height: 12, backgroundColor: "#CBD5E1" }} />
            <Box
              component="a"
              href="/security"
              sx={{
                fontSize: "0.85rem",
                color: "#64748B",
                textDecoration: "none",
                "&:hover": { color: "#0F172A" },
              }}
            >
              Security
            </Box>
            <Box sx={{ width: "1px", height: 12, backgroundColor: "#CBD5E1" }} />
            <Box
              component="a"
              href="/status"
              sx={{
                fontSize: "0.85rem",
                color: "#64748B",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                "&:hover": { color: "#0F172A" },
              }}
            >
              Status
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: "#10B981",
                  boxShadow: "0 0 6px rgba(16, 185, 129, 0.6)",
                }}
              />
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
