"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRegistrationStore } from "@/stores/registration.store";
import { authApi } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";
import { CustomSelect } from "@/components/ui/CustomSelect";

const INDUSTRIES = [
  "Technology & SaaS",
  "E-Commerce & Retail",
  "Financial Services & FinTech",
  "Healthcare & Life Sciences",
  "Logistics & Supply Chain",
  "Professional Services & Consulting",
  "Education & EdTech",
  "Real Estate & Construction",
  "Other",
];

const COMPANY_SIZES = [
  "1-10 employees",
  "11-50 employees",
  "51-200 employees",
  "201-500 employees",
  "500+ employees",
];

export function OrganizationStepForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    organizationDraft,
    updateOrganizationDraft,
    markStepCompleted,
    setStep,
    setOrganizationContext,
  } = useRegistrationStore();

  const [orgName, setOrgName] = useState(organizationDraft.organizationName || "");
  const [website, setWebsite] = useState(organizationDraft.website || "");
  const [industry, setIndustry] = useState(organizationDraft.industry || "");
  const [companySize, setCompanySize] = useState(organizationDraft.companySize || "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    router.prefetch("/signup/business");
  }, [router]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!orgName.trim()) {
      errs.orgName = "Organization name is required.";
    }
    if (!website.trim()) {
      errs.website = "Website URL is required.";
    } else {
      const cleaned = website.replace(/^https?:\/\//i, "").trim();
      if (!cleaned.includes(".") || cleaned.length < 4) {
        errs.website = "Please enter a valid website (e.g. acme.com).";
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setApiError(null);

    const normalizedWebsite =
      website.startsWith("http://") || website.startsWith("https://")
        ? website
        : `https://${website}`;

    try {
      const res = await authApi.createOrganization({
        name: orgName.trim(),
        website: normalizedWebsite,
        industry: industry || undefined,
        company_size: companySize || undefined,
      });

      const org = res?.organization;
      const mem = res?.membership;

      if (org?.id) {
        setOrganizationContext(org.id, mem?.role || "OWNER");
      }

      updateOrganizationDraft({
        organizationName: orgName,
        website: normalizedWebsite,
        industry,
        companySize,
      });

      markStepCompleted("organization");
      setStep("business");

      // Optimistically update query client cache to prevent backward redirect
      queryClient.setQueryData(queryKeys.auth.onboarding(), (old: any) => ({
        ...old,
        current_step: "BUSINESS",
        completed_steps: Array.from(
          new Set([...(old?.completed_steps || []), "ACCOUNT", "ORGANIZATION"])
        ),
        next_route: "/signup/business",
      }));
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });

      router.push("/signup/business");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save organization.";
      setApiError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
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

      {/* Organization Name */}
      <div className="pp-form-group">
        <label htmlFor="pp-org-name" className="pp-form-label">
          Organization name <span style={{ color: "#3562f5" }}>*</span>
        </label>
        <div className="pp-input-container">
          <div
            style={{
              position: "absolute",
              left: "14px",
              display: "flex",
              alignItems: "center",
              color: "#94a3b8",
              pointerEvents: "none",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="16" height="20" x="4" y="2" rx="2" />
              <path d="M9 22v-4h6v4" />
              <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
            </svg>
          </div>
          <input
            id="pp-org-name"
            type="text"
            placeholder="Acme Inc."
            value={orgName}
            onChange={(e) => {
              setOrgName(e.target.value);
              updateOrganizationDraft({ organizationName: e.target.value });
              if (errors.orgName) setErrors((prev) => ({ ...prev, orgName: "" }));
            }}
            className={errors.orgName ? "has-error" : ""}
            style={{ paddingLeft: "38px" }}
          />
        </div>
        {errors.orgName && (
          <span style={{ display: "block", fontSize: "0.74rem", color: "#ef4444", marginTop: "4px" }}>
            {errors.orgName}
          </span>
        )}
      </div>

      {/* Website */}
      <div className="pp-form-group">
        <label htmlFor="pp-org-website" className="pp-form-label">
          Website <span style={{ color: "#3562f5" }}>*</span>
        </label>
        <div className="pp-input-container">
          <div
            style={{
              position: "absolute",
              left: "14px",
              display: "flex",
              alignItems: "center",
              color: "#94a3b8",
              pointerEvents: "none",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <input
            id="pp-org-website"
            type="text"
            placeholder="https://acme.com"
            value={website}
            onChange={(e) => {
              setWebsite(e.target.value);
              updateOrganizationDraft({ website: e.target.value });
              if (errors.website) setErrors((prev) => ({ ...prev, website: "" }));
            }}
            className={errors.website ? "has-error" : ""}
            style={{ paddingLeft: "38px" }}
          />
        </div>
        {errors.website && (
          <span style={{ display: "block", fontSize: "0.74rem", color: "#ef4444", marginTop: "4px" }}>
            {errors.website}
          </span>
        )}
      </div>

      {/* Industry (Custom Dropdown) */}
      <div className="pp-form-group">
        <CustomSelect
          id="pp-org-industry"
          label="Industry"
          placeholder="Select your industry"
          value={industry}
          onChange={(val) => {
            setIndustry(val);
            updateOrganizationDraft({ industry: val });
          }}
          options={INDUSTRIES}
          startIcon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="7" height="7" x="3" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="14" rx="1" />
              <rect width="7" height="7" x="3" y="14" rx="1" />
            </svg>
          }
        />
      </div>

      {/* Company Size (Custom Dropdown) */}
      <div className="pp-form-group" style={{ marginBottom: "20px" }}>
        <CustomSelect
          id="pp-org-company-size"
          label="Company size"
          placeholder="Select company size (optional)"
          value={companySize}
          onChange={(val) => {
            setCompanySize(val);
            updateOrganizationDraft({ companySize: val });
          }}
          options={COMPANY_SIZES}
          startIcon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />
      </div>

      {/* Continue CTA */}
      <div className="pp-onboarding-actions single-action">
        <button
          type="submit"
          className="pp-btn-continue"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span>Saving workspace...</span>
          ) : (
            <>
              <span>Continue</span>
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
