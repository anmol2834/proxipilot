"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type RegistrationStep = "account" | "organization" | "business" | "workspace" | "completed";

export interface AccountDraft {
  firstName: string;
  lastName: string;
  email: string;
  agreedToTerms: boolean;
}

export interface OrganizationDraft {
  organizationName: string;
  website: string;
  industry: string;
  companySize: string;
}

export interface BusinessDraft {
  businessDescription: string;
  customerType: string;
  industryServed: string;
  productsServices: string;
  additionalDetails: string;
}

export interface WorkspaceDraft {
  language: string;
  timezone: string;
  responseStyle: string;
}

export interface MandatoryValidationResult {
  isValid: boolean;
  missingStep?: RegistrationStep;
  missingStepNumber?: number;
  missingStepName?: string;
  errorMessage?: string;
}

interface RegistrationState {
  currentStep: RegistrationStep;
  completedSteps: RegistrationStep[];
  isEmailVerified: boolean;
  pendingEmail: string;

  accountDraft: AccountDraft;
  organizationDraft: OrganizationDraft;
  businessDraft: BusinessDraft;
  workspaceDraft: WorkspaceDraft;
  organizationId: string | null;
  activeRole: string | null;

  // Actions
  setStep: (step: RegistrationStep) => void;
  markStepCompleted: (step: RegistrationStep) => void;
  markEmailVerified: (email: string) => void;
  setOrganizationContext: (organizationId: string, role: string) => void;

  updateAccountDraft: (data: Partial<AccountDraft>) => void;
  updateOrganizationDraft: (data: Partial<OrganizationDraft>) => void;
  updateBusinessDraft: (data: Partial<BusinessDraft>) => void;
  updateWorkspaceDraft: (data: Partial<WorkspaceDraft>) => void;

  resetRegistration: () => void;
  resolveNextAllowedStep: () => string;
  canAccessStep: (step: RegistrationStep) => boolean;
  validateAllMandatorySteps: () => MandatoryValidationResult;
}

const initialAccountDraft: AccountDraft = {
  firstName: "",
  lastName: "",
  email: "",
  agreedToTerms: false,
};

const initialOrganizationDraft: OrganizationDraft = {
  organizationName: "",
  website: "",
  industry: "",
  companySize: "",
};

const initialBusinessDraft: BusinessDraft = {
  businessDescription: "",
  customerType: "",
  industryServed: "",
  productsServices: "",
  additionalDetails: "",
};

const initialWorkspaceDraft: WorkspaceDraft = {
  language: "English",
  timezone: "Asia/Kolkata (GMT +5:30)",
  responseStyle: "Professional",
};

export const useRegistrationStore = create<RegistrationState>()(
  persist(
    (set, get) => ({
      currentStep: "account",
      completedSteps: [],
      isEmailVerified: false,
      pendingEmail: "",

      accountDraft: initialAccountDraft,
      organizationDraft: initialOrganizationDraft,
      businessDraft: initialBusinessDraft,
      workspaceDraft: initialWorkspaceDraft,
      organizationId: null,
      activeRole: null,

      setStep: (step) => set({ currentStep: step }),

      setOrganizationContext: (organizationId, role) =>
        set({
          organizationId,
          activeRole: role,
        }),

      markStepCompleted: (step) =>
        set((state) => ({
          completedSteps: state.completedSteps.includes(step)
            ? state.completedSteps
            : [...state.completedSteps, step],
        })),

      markEmailVerified: (email) =>
        set((state) => ({
          isEmailVerified: true,
          pendingEmail: email,
          accountDraft: { ...state.accountDraft, email },
          completedSteps: state.completedSteps.includes("account")
            ? state.completedSteps
            : [...state.completedSteps, "account"],
        })),

      updateAccountDraft: (data) =>
        set((state) => ({
          accountDraft: { ...state.accountDraft, ...data },
        })),

      updateOrganizationDraft: (data) =>
        set((state) => ({
          organizationDraft: { ...state.organizationDraft, ...data },
        })),

      updateBusinessDraft: (data) =>
        set((state) => ({
          businessDraft: { ...state.businessDraft, ...data },
        })),

      updateWorkspaceDraft: (data) =>
        set((state) => ({
          workspaceDraft: { ...state.workspaceDraft, ...data },
        })),

      resetRegistration: () =>
        set({
          currentStep: "account",
          completedSteps: [],
          isEmailVerified: false,
          pendingEmail: "",
          accountDraft: initialAccountDraft,
          organizationDraft: initialOrganizationDraft,
          businessDraft: initialBusinessDraft,
          workspaceDraft: initialWorkspaceDraft,
        }),

      canAccessStep: (_step) => {
        // Allow user to navigate freely between the registration steps via top progress bar
        return true;
      },

      validateAllMandatorySteps: () => {
        const { accountDraft, organizationDraft, businessDraft, workspaceDraft } = get();

        // 1. Account Step Requirements (satisfied if accountDraft filled or user is authenticated/verified)
        const isAccountSatisfied = Boolean(
          (accountDraft.firstName?.trim() && accountDraft.email?.trim() && accountDraft.agreedToTerms) ||
          get().isEmailVerified ||
          get().organizationId
        );

        if (!isAccountSatisfied) {
          if (!accountDraft.firstName?.trim()) {
            return {
              isValid: false,
              missingStep: "account",
              missingStepNumber: 1,
              missingStepName: "Account",
              errorMessage: "Please fill in your name in the Account step.",
            };
          }
          if (!accountDraft.email?.trim()) {
            return {
              isValid: false,
              missingStep: "account",
              missingStepNumber: 1,
              missingStepName: "Account",
              errorMessage: "Please provide a valid work email in the Account step.",
            };
          }
          if (!accountDraft.agreedToTerms) {
            return {
              isValid: false,
              missingStep: "account",
              missingStepNumber: 1,
              missingStepName: "Account",
              errorMessage: "Please agree to the Terms of Service and Privacy Policy in the Account step.",
            };
          }
        }

        // 2. Organization Step Requirements
        if (!organizationDraft.organizationName?.trim()) {
          return {
            isValid: false,
            missingStep: "organization",
            missingStepNumber: 2,
            missingStepName: "Organization",
            errorMessage: "Please provide your organization name in the Organization step.",
          };
        }

        // 3. Business Step Requirements
        if (!businessDraft.businessDescription?.trim()) {
          return {
            isValid: false,
            missingStep: "business",
            missingStepNumber: 3,
            missingStepName: "Business",
            errorMessage: "Please describe what your business does in the Business step.",
          };
        }
        if (!businessDraft.productsServices?.trim()) {
          return {
            isValid: false,
            missingStep: "business",
            missingStepNumber: 3,
            missingStepName: "Business",
            errorMessage: "Please list your main products or services in the Business step.",
          };
        }

        // 4. Workspace Step Requirements
        if (!workspaceDraft.timezone?.trim()) {
          return {
            isValid: false,
            missingStep: "workspace",
            missingStepNumber: 4,
            missingStepName: "Workspace",
            errorMessage: "Please select your primary timezone in the Workspace step.",
          };
        }
        if (!workspaceDraft.responseStyle?.trim()) {
          return {
            isValid: false,
            missingStep: "workspace",
            missingStepNumber: 4,
            missingStepName: "Workspace",
            errorMessage: "Please select your default AI response style in the Workspace step.",
          };
        }

        return { isValid: true };
      },

      resolveNextAllowedStep: () => {
        const { isEmailVerified, completedSteps } = get();
        if (!isEmailVerified || !completedSteps.includes("account")) {
          return "/signup";
        }
        if (!completedSteps.includes("organization")) {
          return "/signup/organization";
        }
        if (!completedSteps.includes("business")) {
          return "/signup/business";
        }
        if (!completedSteps.includes("workspace")) {
          return "/signup/workspace";
        }
        return "/dashboard";
      },
    }),
    {
      name: "proxipilot-registration-draft-v1",
      storage: createJSONStorage(() => localStorage),
      // Never persist passwords or secrets
      partialize: (state) => ({
        completedSteps: state.completedSteps,
        isEmailVerified: state.isEmailVerified,
        pendingEmail: state.pendingEmail,
        accountDraft: state.accountDraft,
        organizationDraft: state.organizationDraft,
        businessDraft: state.businessDraft,
        workspaceDraft: state.workspaceDraft,
        organizationId: state.organizationId,
        activeRole: state.activeRole,
      }),
    }
  )
);
