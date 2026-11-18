"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { Container } from "./layout";
import { ProxiPilotLogo } from "@/components/ui/ProxiPilotLogo";

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

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "How It Works", href: "/how-it-works" },
      { label: "Integrations", href: "/integrations" },
      { label: "Pricing", href: "/pricing" },
      { label: "Request Demo", href: "/request-demo" },
      { label: "Product Roadmap", href: "/features#roadmap" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Overview", href: "/solutions" },
      { label: "Small Businesses", href: "/solutions/small-business" },
      { label: "Sales Teams", href: "/solutions/sales-teams" },
      { label: "Customer Support", href: "/solutions/customer-support" },
      { label: "E-commerce", href: "/solutions/ecommerce" },
      { label: "SaaS Companies", href: "/solutions/saas-companies" },
      { label: "Agencies", href: "/solutions/agencies" },
      { label: "B2B Businesses", href: "/solutions/b2b-businesses" },
      { label: "Wholesale", href: "/solutions/wholesale-businesses" },
      { label: "Operations", href: "/solutions/operations-teams" },
    ],
  },
  {
    title: "Resources & Docs",
    links: [
      { label: "Blog & Research", href: "/blog" },
      { label: "Help Center", href: "/help" },
      { label: "Documentation", href: "/docs" },
      { label: "Getting Started", href: "/docs/getting-started" },
      { label: "Connect Gmail", href: "/docs/connect-gmail" },
      { label: "Connect Outlook", href: "/docs/connect-outlook" },
      { label: "AI Automation Rules", href: "/docs/ai-automation" },
      { label: "Knowledge Base RAG", href: "/docs/business-knowledge" },
      { label: "Managing Drafts", href: "/docs/manage-drafts" },
      { label: "Troubleshooting", href: "/docs/troubleshooting" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Company & Trust",
    links: [
      { label: "About ProxiPilot", href: "/about" },
      { label: "Testimonials", href: "/testimonials" },
      { label: "Security & Trust", href: "/security" },
      { label: "Partner Program", href: "/partners" },
      { label: "Careers", href: "/careers" },
      { label: "Customer Support", href: "/support" },
      { label: "Contact Us", href: "/contact" },
      { label: "AI Transparency", href: "/ai-transparency" },
      { label: "Subprocessors", href: "/subprocessors" },
      { label: "SLA & Uptime", href: "/sla" },
    ],
  },
];

const BOTTOM_LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Cookie Policy", href: "/cookies" },
  { label: "Acceptable Use", href: "/acceptable-use" },
  { label: "Email Sending Policy", href: "/email-sending-policy" },
  { label: "DPA", href: "/dpa" },
  { label: "Privacy Request", href: "/privacy-request" },
];

export function LandingFooter() {
  return (
    <Box
      component="footer"
      sx={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid #EEF2F6",
        pt: { xs: 6, md: 7 },
        pb: { xs: 5, md: 6 },
      }}
    >
      <Container size="xl">
        {/* Main Footer Links Grid */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "1.7fr 1fr 1.15fr 1.25fr 1.15fr",
            },
            gap: { xs: 4, md: 3 },
            mb: { xs: 5, md: 6 },
          }}
        >
          {/* Left Brand Column */}
          <Box sx={{ pr: { md: 2 } }}>
            {/* Logo */}
            <Box sx={{ mb: 1.5 }}>
              <ProxiPilotLogo size={30} href="/" textSize="1.3rem" />
            </Box>

            {/* Tagline */}
            <Typography
              sx={{
                color: "#64748B",
                fontSize: "0.875rem",
                lineHeight: 1.5,
                maxWidth: 260,
                mb: 1.25,
              }}
            >
              Intelligent email automation for modern commercial teams. Grounded in business knowledge, verified before sending.
            </Typography>

            {/* Subtagline */}
            <Typography
              sx={{
                color: "#94A3B8",
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                mb: 2.5,
              }}
            >
              Operated by Cheldain
            </Typography>

            {/* Social Icons Row */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {SOCIAL_LINKS.map((item) => (
                <Box
                  key={item.name}
                  component="a"
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.name}
                  sx={{
                    width: 34,
                    height: 34,
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
          {FOOTER_COLUMNS.map((column) => (
            <Box key={column.title}>
              <Typography
                sx={{
                  fontWeight: 700,
                  color: "#0F172A",
                  fontSize: "0.825rem",
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                  mb: 1.5,
                }}
              >
                {column.title}
              </Typography>
              <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0 }}>
                {column.links.map((link) => (
                  <Box component="li" key={link.label} sx={{ mb: 0.85 }}>
                    <Link
                      href={link.href}
                      style={{
                        fontSize: "0.825rem",
                        color: "#475569",
                        textDecoration: "none",
                        transition: "color 140ms ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#2563EB")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
                    >
                      {link.label}
                    </Link>
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Box>

        {/* Bottom Bar: Copyright & Quick Links */}
        <Box
          sx={{
            pt: 2.5,
            borderTop: "1px solid #EEF2F6",
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "flex-start", sm: "center" },
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Typography sx={{ color: "#64748B", fontSize: "0.8rem" }}>
            © 2025 Cheldain. Operating ProxiPilot. All rights reserved.
          </Typography>

          <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1.5, sm: 2 }, flexWrap: "wrap" }}>
            {BOTTOM_LEGAL_LINKS.map((item, idx) => (
              <React.Fragment key={item.label}>
                <Link
                  href={item.href}
                  style={{
                    fontSize: "0.785rem",
                    color: "#64748B",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#0F172A")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#64748B")}
                >
                  {item.label}
                </Link>
                {idx < BOTTOM_LEGAL_LINKS.length - 1 && (
                  <Box sx={{ width: "1px", height: 10, backgroundColor: "#CBD5E1" }} />
                )}
              </React.Fragment>
            ))}

            <Box sx={{ width: "1px", height: 10, backgroundColor: "#CBD5E1" }} />

            <Box
              component="a"
              href="https://status.proxipilot.com"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                fontSize: "0.785rem",
                color: "#64748B",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 0.6,
                "&:hover": { color: "#0F172A" },
              }}
            >
              Systems Operational
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  backgroundColor: "#10B981",
                  boxShadow: "0 0 5px rgba(16, 185, 129, 0.7)",
                }}
              />
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
