"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRegistrationStore, RegistrationStep } from "@/stores/registration.store";
import { authApi } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";
import { useAuth } from "@/hooks/use-auth";
import { CustomSelect } from "@/components/ui/CustomSelect";

const TIMEZONES = [
  "Asia/Kolkata (GMT +5:30)",
  "America/New_York (EST / GMT -5:00)",
  "America/Los_Angeles (PST / GMT -8:00)",
  "America/Chicago (CST / GMT -6:00)",
  "Europe/London (GMT +0:00)",
  "Europe/Paris (CET / GMT +1:00)",
  "Asia/Dubai (GMT +4:00)",
  "Asia/Singapore (SGT / GMT +8:00)",
  "Asia/Tokyo (JST / GMT +9:00)",
  "Australia/Sydney (AEST / GMT +10:00)",
];

const AI_STYLES = [
  {
    value: "Professional",
    label: "Professional",
    description: "Polished, balanced, and direct tone",
  },
  {
    value: "Friendly",
    label: "Friendly",
    description: "Warm, conversational, and approachable",
  },
  {
    value: "Concise",
    label: "Concise",
    description: "Ultra-brief, bulleted, action-first",
  },
  {
    value: "Executive",
    label: "Executive",
    description: "High-level summary, strategic, decision-focused",
  },
];

const STEP_URL_MAP: Record<RegistrationStep, string> = {
  account: "/signup",
  organization: "/signup/organization",
  business: "/signup/business",
  workspace: "/signup/workspace",
  completed: "/dashboard",
};

export function WorkspaceStepForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const {
    accountDraft,
    updateAccountDraft,
    workspaceDraft,
    organizationId,
    setOrganizationContext,
    updateWorkspaceDraft,
    markStepCompleted,
    setStep,
    validateAllMandatorySteps,
  } = useRegistrationStore();

  // Autofill name and email from authenticated user (e.g. OAuth Google)
  useEffect(() => {
    if (user) {
      if (!accountDraft.firstName) {
        const parts = (user.full_name || "").trim().split(/\s+/);
        const fName = parts[0] || user.email.split("@")[0] || "User";
        const lName = parts.slice(1).join(" ") || "";
        updateAccountDraft({
          firstName: fName,
          lastName: lName,
          email: user.email,
          agreedToTerms: true,
        });
      }
    }
  }, [user, accountDraft.firstName, updateAccountDraft]);

  const [timezone, setTimezone] = useState(
    workspaceDraft.timezone || "Asia/Kolkata (GMT +5:30)"
  );
  const [responseStyle, setResponseStyle] = useState(
    workspaceDraft.responseStyle || "Professional"
  );
  const [validationError, setValidationError] = useState<{
    message: string;
    targetStep?: RegistrationStep;
    targetStepName?: string;
  } | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  const handleBack = () => {
    updateWorkspaceDraft({
      timezone,
      responseStyle,
    });
    setStep("business");
    router.push("/signup/business");
  };

  const handleFinish = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setValidationError(null);
    setApiError(null);

    // Save current step data first
    updateWorkspaceDraft({
      timezone,
      responseStyle,
    });

    // Validate that mandatory fields are filled (skip account check if user is already authenticated)
    const validation = validateAllMandatorySteps();
    if (!validation.isValid && validation.missingStep !== "account") {
      setValidationError({
        message:
          validation.errorMessage ||
          "Please fill all mandatory fields before finishing setup.",
        targetStep: validation.missingStep,
        targetStepName: validation.missingStepName,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let activeOrgId = organizationId;

      if (!activeOrgId) {
        const stateData = await authApi.getOnboardingState();
        const orgId = stateData?.organization_id;
        if (orgId) {
          activeOrgId = orgId;
          setOrganizationContext(orgId, "OWNER");
        }
      }

      if (!activeOrgId) {
        throw new Error(
          "Active organization could not be resolved. Please return to the Organization step."
        );
      }

      // Update workspace preferences & complete onboarding
      await authApi.updateWorkspacePreferences(activeOrgId, {
        timezone,
        default_response_style: responseStyle,
      });

      markStepCompleted("workspace");
      setStep("completed");

      // Optimistically update query cache
      queryClient.setQueryData(queryKeys.auth.onboarding(), (old: any) => ({
        ...old,
        is_completed: true,
        current_step: "COMPLETED",
        completed_steps: [
          "ACCOUNT",
          "ORGANIZATION",
          "BUSINESS",
          "WORKSPACE",
        ],
        next_route: "/dashboard",
      }));
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });

      router.push("/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to finalize workspace setup.";
      setApiError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleFinish} noValidate>
      {apiError && (
        <div className="pp-error-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{apiError}</span>
        </div>
      )}

      {validationError && (
        <div
          className="pp-error-banner"
          style={{
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "6px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{validationError.message}</span>
          </div>
          {validationError.targetStep && (
            <button
              type="button"
              onClick={() => {
                if (validationError.targetStep) {
                  setStep(validationError.targetStep);
                  router.push(STEP_URL_MAP[validationError.targetStep]);
                }
              }}
              style={{
                background: "none",
                border: "none",
                color: "#b91c1c",
                fontWeight: 700,
                fontSize: "0.76rem",
                textDecoration: "underline",
                cursor: "pointer",
                padding: 0,
                marginLeft: "24px",
              }}
            >
              Go to {validationError.targetStepName || "missing step"} →
            </button>
          )}
        </div>
      )}

      {/* Timezone */}
      <div className="pp-form-group">
        <CustomSelect
          id="pp-ws-timezone"
          label="Timezone"
          required
          placeholder="Select your primary timezone"
          value={timezone}
          onChange={(val) => {
            setTimezone(val);
            updateWorkspaceDraft({ timezone: val });
          }}
          options={TIMEZONES}
          helperText="Used for autonomous scheduling, reminders, and time-based automations."
          startIcon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />
      </div>

      {/* Default AI Response Style */}
      <div className="pp-form-group" style={{ marginBottom: "20px" }}>
        <CustomSelect
          id="pp-ws-response-style"
          label="Default AI response style"
          required
          placeholder="Select default AI tone"
          value={responseStyle}
          onChange={(val) => {
            setResponseStyle(val);
            updateWorkspaceDraft({ responseStyle: val });
          }}
          options={AI_STYLES}
          helperText="Sets the default tone for AI-drafted replies. Can be adjusted anytime."
          startIcon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
          }
        />
      </div>

      {/* Action Buttons: Back + Finish setup */}
      <div className="pp-onboarding-actions">
        <button
          type="button"
          onClick={handleBack}
          className="pp-btn-back"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Back</span>
        </button>

        <button
          type="submit"
          className="pp-btn-continue"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span>Setting up workspace...</span>
          ) : (
            <>
              <span>Finish setup</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
