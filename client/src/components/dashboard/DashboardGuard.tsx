"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useOnboarding } from "@/hooks/use-onboarding";

/**
 * DashboardGuard — Enterprise-grade auth gate (non-blocking)
 *
 * Design philosophy (matching modern SaaS apps like Linear, Vercel, Notion):
 * - NEVER block the render tree with a full-page loading screen.
 *   Page-level skeleton loaders (already implemented per-page) handle
 *   the visual loading state. The guard's only job is to redirect
 *   unauthenticated or incomplete-onboarding users, silently in the background.
 *
 * Render strategy:
 *   1. While auth is INITIALIZING → render children immediately.
 *      The per-page skeletons handle the blank/loading visual.
 *   2. Once resolved as UNAUTHENTICATED → redirect to /signin (no flash,
 *      because children are conditionally null only at that point).
 *   3. Once resolved as AUTHENTICATED but onboarding incomplete → redirect
 *      to the correct onboarding step.
 *   4. Fully authenticated + onboarding complete → children render normally.
 *
 * Redirect race-condition guard:
 *   - A ref tracks whether a redirect has already been scheduled to prevent
 *     duplicate router.replace() calls if effects fire multiple times during
 *     React strict-mode double-invocation or rapid state changes.
 */
export function DashboardGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { authState, isLoading: isAuthLoading } = useAuth();
  const { onboardingState, isLoading: isOnboardingLoading } = useOnboarding();

  // Prevent duplicate redirects across effect re-runs
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Wait until auth resolves — don't act on INITIALIZING state
    if (isAuthLoading) return;

    if (authState === "UNAUTHENTICATED") {
      if (hasRedirected.current) return;
      hasRedirected.current = true;
      router.replace("/signin");
      return;
    }

    // Auth confirmed. Now wait for onboarding state to resolve
    if (authState === "AUTHENTICATED" && !isOnboardingLoading && onboardingState) {
      if (!onboardingState.is_completed) {
        if (hasRedirected.current) return;
        hasRedirected.current = true;
        router.replace(onboardingState.next_route || "/signup/organization");
      }
    }
  }, [authState, isAuthLoading, isOnboardingLoading, onboardingState, router]);

  // After auth resolves as unauthenticated or onboarding incomplete,
  // suppress children to prevent a content flash during the redirect navigation.
  // During INITIALIZING we render children (skeleton loaders take over visually).
  const isRedirecting =
    (!isAuthLoading && authState === "UNAUTHENTICATED") ||
    (!isAuthLoading &&
      !isOnboardingLoading &&
      onboardingState != null &&
      !onboardingState.is_completed);

  if (isRedirecting) {
    // Return null silently — router.replace() is already in flight
    return null;
  }

  // Render children immediately — zero blocking loading screens
  return <>{children}</>;
}
