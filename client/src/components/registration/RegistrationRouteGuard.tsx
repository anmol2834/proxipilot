"use client";

import React, { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useRegistrationStore, RegistrationStep } from "@/stores/registration.store";
import { env } from "@/config/env";

import { useOnboarding } from "@/hooks/use-onboarding";

interface RegistrationRouteGuardProps {
  step: RegistrationStep;
  children: React.ReactNode;
}

const STEP_ORDER: Record<string, number> = {
  account: 0,
  organization: 1,
  business: 2,
  workspace: 3,
  completed: 4,
};

export function RegistrationRouteGuard({ step, children }: RegistrationRouteGuardProps) {
  const router = useRouter();
  const { canAccessStep, resolveNextAllowedStep, setOrganizationContext } = useRegistrationStore();
  const { onboardingState, isLoading } = useOnboarding();

  const isHydrated = useSyncExternalStore(
    (callback) => useRegistrationStore.persist.onFinishHydration(callback),
    () => useRegistrationStore.persist.hasHydrated(),
    () => false
  );

  useEffect(() => {
    if (!isHydrated) return;

    const timer = setTimeout(() => {
      if (onboardingState) {
        if (onboardingState.organization_id) {
          setOrganizationContext(onboardingState.organization_id, "OWNER");
        }

        if (onboardingState.is_completed) {
          router.replace("/dashboard");
          return;
        }

        // If user has not completed account verification, ensure they complete signup/account first
        const serverStepKey = String(onboardingState.current_step).toLowerCase();
        if (serverStepKey === "account" && step !== "account") {
          router.replace("/signup");
          return;
        }
      } else if (!isLoading && !canAccessStep(step)) {
        router.replace(resolveNextAllowedStep());
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [isHydrated, step, onboardingState, isLoading, canAccessStep, resolveNextAllowedStep, setOrganizationContext, router]);

  return <>{children}</>;
}
