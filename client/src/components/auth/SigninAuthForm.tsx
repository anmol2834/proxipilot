"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi } from "@/lib/api";
import { env } from "@/config/env";
import { CustomCheckbox } from "@/components/ui/CustomCheckbox";
import { ProxiPilotLogo } from "@/components/ui/ProxiPilotLogo";

export function SigninAuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const googleOAuthUrl = `${env.NEXT_PUBLIC_API_URL}/auth/google`;
  const microsoftOAuthUrl = `${env.NEXT_PUBLIC_API_URL}/auth/microsoft`;

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      if (errorParam === "oauth_failed") {
        setErrorMessage(
          "Social authentication was cancelled or failed. Please try again."
        );
      } else if (errorParam === "token_exchange_failed") {
        setErrorMessage(
          "Failed to exchange OAuth token with provider. Please try again."
        );
      } else if (errorParam === "signin_unavailable") {
        setErrorMessage(
          "We couldn't complete sign-in right now. Please try again in a moment."
        );
      } else {
        setErrorMessage(errorParam);
      }
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email.trim() || !password) {
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
      const onboardingState = await authApi.getOnboardingState(
        signinRes.organization_id || undefined
      );

      if (onboardingState.is_completed) {
        router.push("/dashboard");
      } else {
        router.push(onboardingState.next_route || "/signup/organization");
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to sign in. Please check your credentials.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="pp-signin-form-panel">
      {/* Top Right Brand Logo */}
      <div style={{ display: "flex", justifyContent: "flex-end", width: "100%", marginBottom: "16px" }}>
        <ProxiPilotLogo size={30} href="/" textSize="1.15rem" />
      </div>

      {/* Main Centered Form Container */}
      <div className="pp-signup-form-wrapper">
        <div className="pp-signup-header">
          <h1 className="pp-signup-title">Welcome Back</h1>
          <p className="pp-signup-subtitle">
            Enter your credentials to access your account
          </p>
        </div>

        {errorMessage && (
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
            {errorMessage}
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
          <a
            href={microsoftOAuthUrl}
            className="pp-social-btn"
            title="Log in with Microsoft"
          >
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
          {/* Email address Field */}
          <div className="pp-form-group">
            <label htmlFor="signin-email" className="pp-form-label">
              Email address
            </label>
            <div className="pp-input-container active-glow">
              <input
                id="signin-email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="pp-form-group">
            <div className="pp-form-label-row">
              <label htmlFor="signin-password" className="pp-form-label">
                Password
              </label>
              <Link href="/forgot-password" className="pp-form-link">
                Forgot password?
              </Link>
            </div>
            <div className="pp-input-container">
              <input
                id="signin-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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
          </div>

          {/* Remember Me Checkbox */}
          <div className="pp-signup-terms-row">
            <CustomCheckbox
              checked={keepSignedIn}
              onChange={(e) => setKeepSignedIn(e.target.checked)}
              size="sm"
              variant="blue"
              label={
                <span className="pp-terms-text">
                  Remember me on this device
                </span>
              }
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="pp-signup-submit-btn"
            disabled={isLoading}
          >
            {isLoading ? "Signing in..." : "Login"}
          </button>

          {/* Switch Route Link */}
          <div className="pp-signup-switch-route">
            Don&apos;t have an account ? <Link href="/signup">Sign up</Link>
          </div>
        </form>
      </div>

      {/* Bottom Center Copyright */}
      <div className="pp-signup-footer">
        2026 ProxiPilot, All right Reserved
      </div>
    </div>
  );
}
