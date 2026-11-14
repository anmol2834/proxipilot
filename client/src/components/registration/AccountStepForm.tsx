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
import Alert from "@mui/material/Alert";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRegistrationStore } from "@/stores/registration.store";
import { authApi } from "@/lib/api";
import { env } from "@/config/env";
import { OtpDialog } from "./OtpDialog";

export function AccountStepForm() {
  const router = useRouter();
  const {
    accountDraft,
    updateAccountDraft,
    markEmailVerified,
    markStepCompleted,
    setStep,
  } = useRegistrationStore();

  const googleOAuthUrl = `${env.NEXT_PUBLIC_API_URL}/auth/google`;
  const microsoftOAuthUrl = `${env.NEXT_PUBLIC_API_URL}/auth/microsoft`;

  const [firstName, setFirstName] = useState(accountDraft.firstName || "");
  const [lastName, setLastName] = useState(accountDraft.lastName || "");
  const [email, setEmail] = useState(accountDraft.email || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreed, setAgreed] = useState(accountDraft.agreedToTerms || false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [challengeId, setChallengeId] = useState<string>("");

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "First name is required.";
    if (!lastName.trim()) errs.lastName = "Last name is required.";
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) errs.email = "Please enter a valid work email.";
    if (!password) {
      errs.password = "Password is required.";
    } else if (password.length < 8) {
      errs.password = "Password must be at least 8 characters.";
    }
    if (password !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match.";
    }
    if (!agreed) {
      errs.agreed = "You must agree to the Terms of Service.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setApiError(null);

    // Autosave safe draft
    updateAccountDraft({
      firstName,
      lastName,
      email,
      agreedToTerms: agreed,
    });

    try {
      const res = await authApi.signup({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        agreed_to_terms: agreed,
      });

      setChallengeId(res.challenge_id);
      setOtpOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create account. Please try again.";
      setApiError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpSuccess = () => {
    setOtpOpen(false);
    markEmailVerified(email);
    markStepCompleted("account");
    setStep("organization");
    router.push("/signup/organization");
  };

  return (
    <>
      {/* Social Authentication Buttons */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
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
            transition: "all 150ms ease",
            "&:hover": {
              backgroundColor: "#F8FAFC",
              borderColor: "#CBD5E1",
            },
          }}
          startIcon={
            <svg width="17" height="17" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
          }
        >
          Continue with Google
        </Button>

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

      {/* Divider */}
      <Box sx={{ display: "flex", alignItems: "center", my: 1.5, gap: 1.5 }}>
        <Box sx={{ flex: 1, height: "1px", backgroundColor: "#E2E8F0" }} />
        <Typography sx={{ fontSize: "0.78rem", color: "#94A3B8" }}>or</Typography>
        <Box sx={{ flex: 1, height: "1px", backgroundColor: "#E2E8F0" }} />
      </Box>

      {/* Registration Form Fields */}
      <Box component="form" onSubmit={handleSubmit} noValidate>
        {apiError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: "10px", fontSize: "0.82rem" }}>
            {apiError}
          </Alert>
        )}

        {/* Name Fields Row */}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mb: 1.25 }}>
          <Box>
            <Typography component="label" htmlFor="reg-first-name" sx={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#0F172A", mb: 0.4 }}>
              First name
            </Typography>
            <TextField
              id="reg-first-name"
              placeholder="John"
              fullWidth
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                updateAccountDraft({ firstName: e.target.value });
              }}
              error={!!errors.firstName}
              helperText={errors.firstName}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  "& fieldset": { borderColor: "#CBD5E1" },
                  "&:hover fieldset": { borderColor: "#94A3B8" },
                  "&.Mui-focused fieldset": { borderColor: "#2563EB" },
                },
                "& input": { fontSize: "0.875rem", py: 1.05 },
              }}
            />
          </Box>

          <Box>
            <Typography component="label" htmlFor="reg-last-name" sx={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#0F172A", mb: 0.4 }}>
              Last name
            </Typography>
            <TextField
              id="reg-last-name"
              placeholder="Doe"
              fullWidth
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                updateAccountDraft({ lastName: e.target.value });
              }}
              error={!!errors.lastName}
              helperText={errors.lastName}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  "& fieldset": { borderColor: "#CBD5E1" },
                  "&:hover fieldset": { borderColor: "#94A3B8" },
                  "&.Mui-focused fieldset": { borderColor: "#2563EB" },
                },
                "& input": { fontSize: "0.875rem", py: 1.05 },
              }}
            />
          </Box>
        </Box>

        {/* Work Email */}
        <Box sx={{ mb: 1.25 }}>
          <Typography component="label" htmlFor="reg-work-email" sx={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#0F172A", mb: 0.4 }}>
            Work email
          </Typography>
          <TextField
            id="reg-work-email"
            type="email"
            placeholder="you@company.com"
            fullWidth
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              updateAccountDraft({ email: e.target.value });
            }}
            error={!!errors.email}
            helperText={errors.email}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Box sx={{ color: "#94A3B8", display: "flex" }}>
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
                "& fieldset": { borderColor: "#CBD5E1" },
                "&:hover fieldset": { borderColor: "#94A3B8" },
                "&.Mui-focused fieldset": { borderColor: "#2563EB" },
              },
              "& input": { fontSize: "0.875rem", py: 1.05 },
            }}
          />
        </Box>

        {/* Password */}
        <Box sx={{ mb: 1.25 }}>
          <Typography component="label" htmlFor="reg-password" sx={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#0F172A", mb: 0.4 }}>
            Password
          </Typography>
          <TextField
            id="reg-password"
            type={showPassword ? "text" : "password"}
            placeholder="Create a strong password"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={!!errors.password}
            helperText={errors.password}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Box sx={{ color: "#94A3B8", display: "flex" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </Box>
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small" sx={{ color: "#94A3B8" }}>
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
                "& fieldset": { borderColor: "#CBD5E1" },
                "&:hover fieldset": { borderColor: "#94A3B8" },
                "&.Mui-focused fieldset": { borderColor: "#2563EB" },
              },
              "& input": { fontSize: "0.875rem", py: 1.05 },
            }}
          />
        </Box>

        {/* Confirm Password */}
        <Box sx={{ mb: 1.5 }}>
          <Typography component="label" htmlFor="reg-confirm-password" sx={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#0F172A", mb: 0.4 }}>
            Confirm password
          </Typography>
          <TextField
            id="reg-confirm-password"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirm your password"
            fullWidth
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Box sx={{ color: "#94A3B8", display: "flex" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </Box>
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" size="small" sx={{ color: "#94A3B8" }}>
                      {showConfirmPassword ? (
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
                "& fieldset": { borderColor: "#CBD5E1" },
                "&:hover fieldset": { borderColor: "#94A3B8" },
                "&.Mui-focused fieldset": { borderColor: "#2563EB" },
              },
              "& input": { fontSize: "0.875rem", py: 1.05 },
            }}
          />
        </Box>

        {/* Terms Checkbox */}
        <Box sx={{ mb: 1.75 }}>
          <CustomCheckbox
            checked={agreed}
            onChange={(e) => {
              setAgreed(e.target.checked);
              updateAccountDraft({ agreedToTerms: e.target.checked });
            }}
            size="md"
            error={Boolean(errors.agreed)}
            label={
              <Typography component="span" sx={{ fontSize: "0.8rem", color: "#475569", lineHeight: 1.4 }}>
                I agree to the{" "}
                <Link href="/terms" style={{ color: "#2563EB", fontWeight: 600, textDecoration: "underline" }}>
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" style={{ color: "#2563EB", fontWeight: 600, textDecoration: "underline" }}>
                  Privacy Policy
                </Link>
              </Typography>
            }
          />
          {errors.agreed && (
            <Typography sx={{ fontSize: "0.74rem", color: "#EF4444", mt: 0.5, pl: 3.25 }}>
              {errors.agreed}
            </Typography>
          )}
        </Box>

        {/* Create account submit button */}
        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={isSubmitting}
          sx={{
            backgroundColor: "#2563EB",
            color: "#FFFFFF",
            textTransform: "none",
            fontWeight: 700,
            fontSize: "0.92rem",
            py: 1.25,
            borderRadius: "10px",
            boxShadow: "0 3px 12px rgba(37, 99, 235, 0.3)",
            transition: "all 180ms ease",
            "&:hover": {
              backgroundColor: "#1D4ED8",
              boxShadow: "0 5px 16px rgba(37, 99, 235, 0.4)",
            },
          }}
        >
          {isSubmitting ? "Creating account..." : "Create account →"}
        </Button>
      </Box>

      {/* OTP Dialog Component */}
      <OtpDialog
        open={otpOpen}
        email={email}
        challengeId={challengeId}
        onClose={() => setOtpOpen(false)}
        onVerifySuccess={handleOtpSuccess}
      />
    </>
  );
}
