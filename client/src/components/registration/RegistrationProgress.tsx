"use client";

import React from "react";
import { useRouter } from "next/navigation";

interface RegistrationProgressProps {
  currentStepIndex: number; // 1: Organization, 2: Business, 3: Workspace
}

interface StepItem {
  id: string;
  name: string;
  route: string;
}

const ONBOARDING_STEPS: StepItem[] = [
  { id: "org", name: "Organization", route: "/signup/organization" },
  { id: "biz", name: "Business", route: "/signup/business" },
  { id: "ws", name: "Workspace", route: "/signup/workspace" },
];

export function RegistrationProgress({ currentStepIndex }: RegistrationProgressProps) {
  const router = useRouter();

  // Normalize currentStepIndex to 0-indexed for the 3 onboarding steps
  // (In RegistrationShell, stepNumber is 2 for org, 3 for biz, 4 for ws)
  const activeIndex = Math.max(0, Math.min(2, currentStepIndex - 1));

  return (
    <div
      className="pp-stepper-bar"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        marginBottom: "18px",
      }}
    >
      {ONBOARDING_STEPS.map((step, idx) => {
        const isCompleted = idx < activeIndex;
        const isActive = idx === activeIndex;

        const handleStepClick = () => {
          if (isCompleted) {
            router.push(step.route);
          }
        };

        return (
          <React.Fragment key={step.id}>
            <div
              onClick={handleStepClick}
              className={`pp-step-pill ${
                isActive ? "active" : isCompleted ? "completed" : "pending"
              }`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "9999px",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: isCompleted ? "pointer" : "default",
                transition: "all 0.15s ease",
              }}
              title={
                isCompleted
                  ? `Return to ${step.name}`
                  : isActive
                  ? `Current: ${step.name}`
                  : step.name
              }
            >
              {/* Step indicator circle / checkmark */}
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  backgroundColor: isActive
                    ? "rgba(255, 255, 255, 0.25)"
                    : isCompleted
                    ? "#3562f5"
                    : "#cbd5e1",
                  color: "#ffffff",
                }}
              >
                {isCompleted ? (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>

              <span>{step.name}</span>
            </div>

            {/* Divider between steps */}
            {idx < ONBOARDING_STEPS.length - 1 && (
              <div
                className="pp-step-divider"
                style={{
                  flex: 1,
                  height: "1px",
                  backgroundColor: isCompleted ? "#bfdbfe" : "#e2e8f0",
                  margin: "0 6px",
                  transition: "background-color 0.2s ease",
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
