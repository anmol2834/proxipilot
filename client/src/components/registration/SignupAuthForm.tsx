"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRegistrationStore } from "@/stores/registration.store";
import { authApi } from "@/lib/api";
import { env } from "@/config/env";
import { CustomCheckbox } from "@/components/ui/CustomCheckbox";
import { OtpDialog } from "./OtpDialog";
import { ProxiPilotLogo } from "@/components/ui/ProxiPilotLogo";

export function SignupAuthForm() {
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

  // Pre-fill from existing draft if user navigated back
  const initialFullName =
    accountDraft.firstName && accountDraft.lastName
      ? `${accountDraft.firstName} ${accountDraft.lastName}`
      : accountDraft.firstName || "";

  const [fullName, setFullName] = useState(initialFullName);
  const [email, setEmail] = useState(accountDraft.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(accountDraft.agreedToTerms || false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [challengeId, setChallengeId] = useState<string>("");

  const validate = () => {
    const errs: Record<string, string> = {};
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      errs.name = "Please enter your name.";
    }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      errs.email = "Please enter a valid work email.";
    }
    if (!password) {
      errs.password = "Password is required.";
    } else if (password.length < 8) {
      errs.password = "Password must be at least 8 characters.";
    }
    if (!agreed) {
      errs.agreed = "You must agree to the Terms & Privacy.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setApiError(null);

    // Split name into first and last name
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ") || firstName;

    // Autosave safe draft
    updateAccountDraft({
      firstName,
      lastName,
      email: email.trim().toLowerCase(),
      agreedToTerms: agreed,
    });

    try {
      const res = await authApi.signup({
        first_name: firstName,
        last_name: lastName,
        email: email.trim().toLowerCase(),
        password,
        agreed_to_terms: agreed,
      });

      setChallengeId(res.challenge_id);
      setOtpOpen(true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to create account. Please try again.";
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
    <div className="pp-signup-left">
      {/* Top Left Stylized Brand Logo */}
      <div style={{ marginBottom: "16px" }}>
        <ProxiPilotLogo size={32} href="/" textSize="1.2rem" />
      </div>

      {/* Main Centered Form Container */}
      <div className="pp-signup-form-wrapper">
        <div className="pp-signup-header">
          <h1 className="pp-signup-title">Get Started Now</h1>
          <p className="pp-signup-subtitle">
            Enter your credentials to access your account
          </p>
        </div>

        {apiError && (
          <div
            style={{
              backgroundColor: "#FEF2F2",
              border: "1px solid #FEE2E2",
              color: "#DC2626",
              borderRadius: "8px",
              padding: "8px 12px",
              fontSize: "0.78rem",
              marginBottom: "12px",
            }}
          >
            {apiError}
          </div>
        )}

        {/* Social Authentication Buttons Row */}
        <div className="pp-signup-social-grid">
          {/* Google */}
          <a href={googleOAuthUrl} className="pp-social-btn">
            <svg width="16" height="16" viewBox="0 0 24 24">
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
            <span>Log in with Google</span>
          </a>

          {/* Microsoft */}
          <a href={microsoftOAuthUrl} className="pp-social-btn" title="Log in with Microsoft">
            <svg width="15" height="15" viewBox="0 0 24 24">
              <path fill="#F25022" d="M1 1h10v10H1z" />
              <path fill="#00A4EF" d="M1 13h10v10H1z" />
              <path fill="#7FBA00" d="M13 1h10v10H13z" />
              <path fill="#FFB900" d="M13 13h10v10H13z" />
            </svg>
            <span>Log in with Microsoft</span>
          </a>
        </div>

        {/* Divider */}
        <div className="pp-signup-divider">
          <div className="pp-divider-line" />
          <span className="pp-divider-text">or</span>
          <div className="pp-divider-line" />
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Name Field */}
          <div className="pp-form-group">
            <label htmlFor="pp-input-name" className="pp-form-label">
              Name
            </label>
            <div className="pp-input-container">
              <input
                id="pp-input-name"
                type="text"
                placeholder="Anmol Sinha"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errors.name) {
                    setErrors((prev) => ({ ...prev, name: "" }));
                  }
                }}
                className={errors.name ? "has-error" : ""}
              />
            </div>
            {errors.name && (
              <span className="pp-form-error-msg">{errors.name}</span>
            )}
          </div>

          {/* Email address Field */}
          <div className="pp-form-group">
            <label htmlFor="pp-input-email" className="pp-form-label">
              Email address
            </label>
            <div className="pp-input-container active-glow">
              <input
                id="pp-input-email"
                type="email"
                placeholder="user@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) {
                    setErrors((prev) => ({ ...prev, email: "" }));
                  }
                }}
                className={errors.email ? "has-error" : ""}
              />
            </div>
            {errors.email && (
              <span className="pp-form-error-msg">{errors.email}</span>
            )}
          </div>

          {/* Password Field */}
          <div className="pp-form-group">
            <div className="pp-form-label-row">
              <label htmlFor="pp-input-password" className="pp-form-label">
                Password
              </label>
              <Link href="/forgot-password" className="pp-form-link">
                Forgot password?
              </Link>
            </div>
            <div className="pp-input-container">
              <input
                id="pp-input-password"
                type={showPassword ? "text" : "password"}
                placeholder="min 8 chars"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) {
                    setErrors((prev) => ({ ...prev, password: "" }));
                  }
                }}
                className={errors.password ? "has-error" : ""}
              />
              <button
                type="button"
                className="pp-input-action-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
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
              </button>
            </div>
            {errors.password && (
              <span className="pp-form-error-msg">{errors.password}</span>
            )}
          </div>

          {/* Terms Agreement Checkbox */}
          <div className="pp-signup-terms-row">
            <CustomCheckbox
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                if (errors.agreed) {
                  setErrors((prev) => ({ ...prev, agreed: "" }));
                }
              }}
              size="sm"
              variant="blue"
              error={Boolean(errors.agreed)}
              label={
                <span className="pp-terms-text">
                  I agree to the{" "}
                  <Link href="/terms">Terms & Privacy</Link>
                </span>
              }
            />
            {errors.agreed && (
              <span className="pp-form-error-msg" style={{ paddingLeft: "26px" }}>
                {errors.agreed}
              </span>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="pp-signup-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating account..." : "Login"}
          </button>

          {/* Switch Route Link */}
          <div className="pp-signup-switch-route">
            Have an account ? <Link href="/signin">Sign in</Link>
          </div>
        </form>
      </div>

      {/* Bottom Center Copyright */}
      <div className="pp-signup-footer">
        2026 ProxiPilot, All right Reserved
      </div>

      {/* OTP Verification Dialog */}
      <OtpDialog
        open={otpOpen}
        email={email}
        challengeId={challengeId}
        onClose={() => setOtpOpen(false)}
        onVerifySuccess={handleOtpSuccess}
      />
    </div>
  );
}
