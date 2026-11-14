"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import Link from "next/link";
import { Container } from "./layout/Container";
import { landingConfig } from "@/config/landing";
import { ExpandableCtaButton } from "@/components/ui/ExpandableCtaButton";

export function LandingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { navigation } = landingConfig;

  const handleDrawerToggle = () => {
    setMobileOpen((prevState) => !prevState);
  };

  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 1100,
        width: "100%",
        backgroundColor: "rgba(255, 255, 255, 0.82)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #E6EAF0",
        transition: "background-color 200ms ease, border-color 200ms ease",
      }}
    >
      <Container size="xl">
        <Box
          component="nav"
          aria-label="Main navigation"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: { xs: 64, md: 72 },
          }}
        >
          {/* Logo / Brand Anchor */}
          <Box
            component="a"
            href="#hero"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              textDecoration: "none",
              color: "#111827",
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
                <circle cx="11" cy="16" r="6" fill="#3B82F6" fillOpacity="0.9" />
                <circle cx="21" cy="16" r="6" fill="#635BFF" fillOpacity="0.9" />
                <path
                  d="M16 11.5C17.5 12.8 18.5 14.3 18.5 16C18.5 17.7 17.5 19.2 16 20.5C14.5 19.2 13.5 17.7 13.5 16C13.5 14.3 14.5 12.8 16 11.5Z"
                  fill="#4F46E5"
                />
                <circle cx="16" cy="10" r="3.5" fill="#4F7CFF" />
              </svg>
            </Box>
            <Typography
              variant="h6"
              component="span"
              sx={{
                fontWeight: 700,
                fontSize: "1.25rem",
                letterSpacing: "-0.02em",
                color: "#111827",
              }}
            >
              ProxiPilot
            </Typography>
          </Box>

          {/* Desktop Navigation Links */}
          <Box
            sx={{
              display: { xs: "none", md: "flex" },
              alignItems: "center",
              gap: 3.5,
            }}
          >
            {[
              { label: "Product", href: "#product", hasDropdown: true },
              { label: "Solutions", href: "#use-cases", hasDropdown: true },
              { label: "How it works", href: "#how-it-works", hasDropdown: false },
              { label: "Resources", href: "#faq", hasDropdown: true },
              { label: "Pricing", href: "#pricing", hasDropdown: false },
            ].map((link) => (
              <Box
                key={link.label}
                component="a"
                href={link.href}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5,
                  fontSize: "0.9375rem",
                  fontWeight: 500,
                  color: "#475569",
                  textDecoration: "none",
                  transition: "color 150ms ease",
                  "&:hover": {
                    color: "#111827",
                  },
                }}
              >
                <span>{link.label}</span>
                {link.hasDropdown && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    style={{ opacity: 0.7 }}
                  >
                    <path
                      d="M2.5 4.5L6 8L9.5 4.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </Box>
            ))}
          </Box>

          {/* Desktop Call to Actions */}
          <Box
            sx={{
              display: { xs: "none", md: "flex" },
              alignItems: "center",
              gap: 2.5,
            }}
          >
            <Box
              component={Link}
              href={navigation.ctaSecondary.href}
              sx={{
                color: "#475569",
                fontWeight: 500,
                fontSize: "0.9375rem",
                textDecoration: "none",
                transition: "color 150ms ease",
                "&:hover": {
                  color: "#111827",
                },
              }}
            >
              Sign in
            </Box>
            <ExpandableCtaButton
              href={navigation.ctaPrimary.href}
              text={navigation.ctaPrimary.label}
              size="sm"
            />
          </Box>

          {/* Mobile Hamburger Trigger */}
          <IconButton
            color="inherit"
            aria-label="open mobile navigation menu"
            edge="end"
            onClick={handleDrawerToggle}
            sx={{ display: { md: "none" }, color: "#111827" }}
          >
            <MenuIcon />
          </IconButton>
        </Box>
      </Container>

      {/* Accessible Mobile Navigation Drawer */}
      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width: "80%",
            maxWidth: 320,
            p: 3,
            backgroundColor: "#FFFFFF",
          },
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#111827" }}>
            {navigation.brandName}
          </Typography>
          <IconButton onClick={handleDrawerToggle} aria-label="close navigation menu">
            <CloseIcon />
          </IconButton>
        </Box>
        <List sx={{ mb: 4 }}>
          {navigation.links.map((link) => (
            <ListItem key={link.label} disablePadding>
              <ListItemButton
                component="a"
                href={link.href}
                onClick={handleDrawerToggle}
                sx={{ py: 1.5, borderRadius: "6px" }}
              >
                <ListItemText
                  primary={
                    <Typography sx={{ fontWeight: 500, color: "#111827" }}>{link.label}</Typography>
                  }
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Button
            component={Link}
            href={navigation.ctaSecondary.href}
            variant="outlined"
            fullWidth
            sx={{
              borderColor: "#E6EAF0",
              color: "#111827",
              textTransform: "none",
              fontWeight: 600,
              py: 1,
            }}
          >
            {navigation.ctaSecondary.label}
          </Button>
          <ExpandableCtaButton
            href={navigation.ctaPrimary.href}
            text={navigation.ctaPrimary.label}
            size="md"
            fullWidth
            onClick={handleDrawerToggle}
          />
        </Box>
      </Drawer>
    </Box>
  );
}
