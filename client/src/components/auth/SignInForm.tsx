"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import { CustomCheckbox } from "@/components/ui/CustomCheckbox";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { startFreshSession } from "@/lib/query/session-cache";
import { useEffect } from "react";

import { authApi } from "@/lib/api";

import { env } from "@/config/env";
import { ProxiPilotLogo } from "@/components/ui/ProxiPilotLogo";

export function SignInForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      if (errorParam === "oauth_failed") {
        setErrorMessage("Social authentication was cancelled or failed. Please try again.");
      } else if (errorParam === "token_exchange_failed") {
        setErrorMessage("Failed to exchange OAuth token with provider. Please try again.");
      } else {
        setErrorMessage(errorParam);
      }
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setIsLoading(true);

    try {
      const signinRes = await authApi.signin({
        email: email.trim().toLowerCase(),
        password,
        remember_me: keepSignedIn,
      });

      // Check authoritative server onboarding progression
      const onboardingState = await authApi.getOnboardingState(signinRes.organization_id || undefined);
      startFreshSession(queryClient, onboardingState);

      if (onboardingState.is_completed) {
        router.push("/dashboard");
      } else {
        router.push(onboardingState.next_route || "/signup/organization");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sign in. Please check your credentials.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const googleOAuthUrl = `${env.NEXT_PUBLIC_API_URL}/auth/google`;
  const microsoftOAuthUrl = `${env.NEXT_PUBLIC_API_URL}/auth/microsoft`;

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        backgroundColor: "#FFFFFF",
        p: { xs: 2.5, sm: 3, md: 3.5, lg: 4 },
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Mobile Top Header with Brand Logo & Signup Link (Visible only on xs/sm) */}
      <Box
        sx={{
          display: { xs: "flex", md: "none" },
          alignItems: "center",
          justifyContent: "space-between",
          mb: { xs: 2, sm: 2.5 },
        }}
      >
        <ProxiPilotLogo size={28} href="/" textSize="1.15rem" />

        <Typography sx={{ fontSize: "0.82rem", color: "#64748B" }}>
          <Link
            href="/signup"
            style={{
              color: "#2563EB",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Create account
          </Link>
        </Typography>
      </Box>

      {/* Desktop Top Right Navigation to Signup (Visible only on md+) */}
      <Box sx={{ display: { xs: "none", md: "flex" }, justifyContent: "flex-end", mb: 2 }}>
        <Typography sx={{ fontSize: "0.82rem", color: "#64748B" }}>
          New to ProxiPilot?{" "}
          <Link
            href="/signup"
            style={{
              color: "#2563EB",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Create an account
          </Link>
        </Typography>
      </Box>

      {/* Main Sign In Form Container */}
      <Box sx={{ maxWidth: 410, width: "100%", mx: "auto", my: "auto" }}>
        {/* Title & Subtitle */}
        <Typography
          variant="h2"
          component="h1"
          sx={{
            fontSize: { xs: "1.65rem", sm: "1.85rem" },
            fontWeight: 800,
            letterSpacing: "-0.025em",
            color: "#0F172A",
            mb: 0.35,
          }}
        >
          Sign in
        </Typography>
        <Typography
          sx={{
            fontSize: "0.82rem",
            color: "#64748B",
            mb: 2.25,
          }}
        >
          Welcome back! Please enter your details to continue.
        </Typography>

        {/* Social Authentication Buttons */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
          {/* Google Button */}
          <Button
            component="a"
            href={googleOAuthUrl}
            variant="outlined"
            fullWidth
            sx={{
              backgroundColor: "#FFFFFF",
              borderColor: "#E2E8F0",
              color: "#0F172A",
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.85rem",
              py: 0.9,
              borderRadius: "10px",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
              transition: "all 150ms ease",
              "&:hover": {
                backgroundColor: "#F8FAFC",
                borderColor: "#CBD5E1",
              },
            }}
            startIcon={
              <svg width="17" height="17" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            }
          >
            Continue with Google
          </Button>

          {/* Microsoft Button */}
          <Button
            component="a"
            href={microsoftOAuthUrl}
            variant="outlined"
            fullWidth
            sx={{
              backgroundColor: "#FFFFFF",
              borderColor: "#E2E8F0",
              color: "#0F172A",
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.85rem",
              py: 0.9,
              borderRadius: "10px",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
              transition: "all 150ms ease",
              "&:hover": {
                backgroundColor: "#F8FAFC",
                borderColor: "#CBD5E1",
              },
            }}
            startIcon={
              <svg width="17" height="17" viewBox="0 0 24 24">
                <path fill="#F25022" d="M1 1h10v10H1z" />
                <path fill="#00A4EF" d="M1 13h10v10H1z" />
                <path fill="#7FBA00" d="M13 1h10v10H13z" />
                <path fill="#FFB900" d="M13 13h10v10H13z" />
              </svg>
            }
          >
            Continue with Microsoft
          </Button>
        </Box>

        {/* Divider: or */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            my: 1.5,
            gap: 1.5,
          }}
        >
          <Box sx={{ flex: 1, height: "1px", backgroundColor: "#E2E8F0" }} />
          <Typography sx={{ fontSize: "0.78rem", color: "#94A3B8" }}>or</Typography>
          <Box sx={{ flex: 1, height: "1px", backgroundColor: "#E2E8F0" }} />
        </Box>

        {/* Form Fields */}
        <Box component="form" onSubmit={handleSubmit} noValidate>
          {errorMessage && (
            <Box
              sx={{
                mb: 1.5,
                p: 1.25,
                borderRadius: "8px",
                backgroundColor: "#FEF2F2",
                border: "1px solid #FCA5A5",
                color: "#991B1B",
                fontSize: "0.8rem",
              }}
            >
              {errorMessage}
            </Box>
          )}

          {/* Email Field */}
          <Box sx={{ mb: 1.5 }}>
            <Typography
              component="label"
              htmlFor="email-address"
              sx={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#0F172A",
                mb: 0.5,
              }}
            >
              Email address
            </Typography>
            <TextField
              id="email-address"
              type="email"
              placeholder="you@company.com"
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Box sx={{ color: "#94A3B8", display: "flex", alignItems: "center" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect width="20" height="16" x="2" y="4" rx="2" />
                          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                        </svg>
                      </Box>
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  backgroundColor: "#FFFFFF",
                  "& fieldset": {
                    borderColor: "#CBD5E1",
                  },
                  "&:hover fieldset": {
                    borderColor: "#94A3B8",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#2563EB",
                    borderWidth: "1.5px",
                  },
                },
                "& input": {
                  fontSize: "0.875rem",
                  py: 1.05,
                },
              }}
            />
          </Box>

          {/* Password Field */}
          <Box sx={{ mb: 0.75 }}>
            <Typography
              component="label"
              htmlFor="password-input"
              sx={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#0F172A",
                mb: 0.5,
              }}
            >
              Password
            </Typography>
            <TextField
              id="password-input"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Box sx={{ color: "#94A3B8", display: "flex", alignItems: "center" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </Box>
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size="small"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        sx={{ color: "#94A3B8" }}
                      >
                        {showPassword ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                            <line x1="2" y1="2" x2="22" y2="22" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  backgroundColor: "#FFFFFF",
                  "& fieldset": {
                    borderColor: "#CBD5E1",
                  },
                  "&:hover fieldset": {
                    borderColor: "#94A3B8",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#2563EB",
                    borderWidth: "1.5px",
                  },
                },
                "& input": {
                  fontSize: "0.875rem",
                  py: 1.05,
                },
              }}
            />
          </Box>

          {/* Forgot Password Link */}
          <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.75 }}>
            <Link
              href="/forgot-password"
              style={{
                fontSize: "0.8rem",
                color: "#2563EB",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Forgot password?
            </Link>
          </Box>

          {/* Sign In Submit Button */}
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={isLoading}
            sx={{
              backgroundColor: "#2563EB",
              color: "#FFFFFF",
              textTransform: "none",
              fontWeight: 700,
              fontSize: "0.92rem",
              py: 1.15,
              borderRadius: "10px",
              boxShadow: "0 3px 12px rgba(37, 99, 235, 0.3)",
              transition: "all 180ms ease",
              mb: 1.25,
              "&:hover": {
                backgroundColor: "#1D4ED8",
                boxShadow: "0 5px 16px rgba(37, 99, 235, 0.4)",
              },
            }}
          >
            {isLoading ? "Signing in..." : "Sign in →"}
          </Button>

          {/* Keep me signed in Checkbox */}
          <Box sx={{ mb: 1, mt: 0.5 }}>
            <CustomCheckbox
              checked={keepSignedIn}
              onChange={(e) => setKeepSignedIn(e.target.checked)}
              size="md"
              label={
                <Typography component="span" sx={{ fontSize: "0.82rem", color: "#475569" }}>
                  Keep me signed in
                </Typography>
              }
            />
          </Box>
        </Box>
      </Box>

      {/* Bottom Security Assurance Note */}
      <Box
        sx={{
          pt: 1.5,
          borderTop: "1px solid #F1F5F9",
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          maxWidth: 410,
          mx: "auto",
          width: "100%",
        }}
      >
        <Box sx={{ color: "#64748B", display: "flex", alignItems: "center" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </Box>
        <Typography sx={{ fontSize: "0.74rem", color: "#64748B", lineHeight: 1.35 }}>
          Your data is secure. We use industry-standard encryption to protect your information.
        </Typography>
      </Box>
    </Box>
  );
}
