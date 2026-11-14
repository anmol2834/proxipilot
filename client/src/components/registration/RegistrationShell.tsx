"use client";

import React from "react";
import Link from "next/link";
import { RegistrationStep } from "@/stores/registration.store";
import { RegistrationBrandPanel } from "./RegistrationBrandPanel";
import { RegistrationProgress } from "./RegistrationProgress";
import { ProxiPilotLogo } from "@/components/ui/ProxiPilotLogo";

interface RegistrationShellProps {
  step: RegistrationStep;
  stepNumber: number; // 2: Organization, 3: Business, 4: Workspace
  title: string;
  subtitle: string;
  showProgress?: boolean;
  topRightAction?: React.ReactNode;
  bottomTrustIndicators?: boolean;
  children: React.ReactNode;
}

export function RegistrationShell({
  step,
  stepNumber,
  title,
  subtitle,
  showProgress = true,
  topRightAction,
  children,
}: RegistrationShellProps) {
  // Normalize step number for 3-step onboarding display (1 of 3, 2 of 3, 3 of 3)
  const onboardingStepNumber = Math.max(1, stepNumber - 1);

  return (
    <div className="pp-onboarding-root">
      {/* Left Column: Form Panel */}
      <div className="pp-onboarding-left">
        {/* Top Header: Brand Logo & Right Action */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <ProxiPilotLogo size={28} href="/" textSize="1.15rem" />

          {/* Top Right Action */}
          <div>
            {topRightAction !== undefined ? (
              topRightAction
            ) : (
              <span
                style={{
                  fontSize: "0.78rem",
                  color: "#64748b",
                  fontWeight: 600,
                }}
              >
                Onboarding Setup
              </span>
            )}
          </div>
        </div>

        {/* Centered Form Wrapper */}
        <div className="pp-onboarding-form-wrapper">
          {/* Minimalist 3-Step Stepper Bar */}
          {showProgress && (
            <RegistrationProgress currentStepIndex={onboardingStepNumber} />
          )}

          {/* Step Header */}
          <div className="pp-onboarding-header">
            <div className="pp-onboarding-step-badge">
              STEP {onboardingStepNumber} OF 3
            </div>
            <h1 className="pp-onboarding-title">{title}</h1>
            <p className="pp-onboarding-subtitle">{subtitle}</p>
          </div>

          {/* Step Form Body */}
          {children}
        </div>

        {/* Bottom Clean Footer */}
        <div className="pp-signup-footer">
          © 2026 ProxiPilot. All rights reserved.
        </div>
      </div>

      {/* Right Column: Vibrant Royal Blue Showcase Card */}
      <RegistrationBrandPanel step={step} />
    </div>
  );
}
