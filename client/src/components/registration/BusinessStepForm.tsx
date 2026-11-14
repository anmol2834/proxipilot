"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRegistrationStore } from "@/stores/registration.store";
import { authApi } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";
import { CustomSelect } from "@/components/ui/CustomSelect";

const SERVED_INDUSTRIES = [
  "Home Services & Maintenance",
  "E-Commerce & Retail",
  "SaaS & Tech Startups",
  "Healthcare & Wellness",
  "Finance & Insurance",
  "Consulting & Agencies",
  "Logistics & Shipping",
  "Education & EdTech",
  "Real Estate & Property",
  "Other",
];

export function BusinessStepForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    businessDraft,
    organizationId,
    setOrganizationContext,
    updateBusinessDraft,
    markStepCompleted,
    setStep,
  } = useRegistrationStore();

  const [description, setDescription] = useState(
    businessDraft.businessDescription || ""
  );
  const [industryServed, setIndustryServed] = useState(
    businessDraft.industryServed || ""
  );
  const [productsServices, setProductsServices] = useState(
    businessDraft.productsServices || ""
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    router.prefetch("/signup/workspace");
  }, [router]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!description.trim()) {
      errs.description = "Business description is required.";
    }
    if (!industryServed) {
      errs.industryServed = "Please select an industry category.";
    }
    if (!productsServices.trim()) {
      errs.productsServices = "Main products or services are required.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleBack = () => {
    updateBusinessDraft({
      businessDescription: description,
      industryServed,
      productsServices,
    });
    router.push("/signup/organization");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setApiError(null);

    updateBusinessDraft({
      businessDescription: description,
      industryServed,
      productsServices,
    });

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

      await authApi.updateBusinessProfile(activeOrgId, {
        description: description.trim(),
        industry_served: industryServed,
        customer_type: businessDraft.customerType || undefined,
        products_services: productsServices.trim(),
        additional_context: businessDraft.additionalDetails || undefined,
      });

      markStepCompleted("business");
      setStep("workspace");

      // Optimistically update query client cache to prevent backward redirect
      queryClient.setQueryData(queryKeys.auth.onboarding(), (old: any) => ({
        ...old,
        current_step: "WORKSPACE",
        completed_steps: Array.from(
          new Set([
            ...(old?.completed_steps || []),
            "ACCOUNT",
            "ORGANIZATION",
            "BUSINESS",
          ])
        ),
        next_route: "/signup/workspace",
      }));
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });

      router.push("/signup/workspace");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
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

      {/* What does your business do? */}
      <div className="pp-form-group">
        <label htmlFor="pp-biz-desc" className="pp-form-label">
          What does your business do? <span style={{ color: "#3562f5" }}>*</span>
        </label>
        <div className="pp-textarea-container">
          <textarea
            id="pp-biz-desc"
            rows={3}
            placeholder="E.g. We provide home appliance repair and maintenance services including AC, refrigerator, and microwave repairs."
            value={description}
            onChange={(e) => {
              if (e.target.value.length <= 300) {
                setDescription(e.target.value);
                updateBusinessDraft({ businessDescription: e.target.value });
                if (errors.description) setErrors((prev) => ({ ...prev, description: "" }));
              }
            }}
            className={errors.description ? "has-error" : ""}
          />
          <div className="pp-char-count">{description.length}/300</div>
        </div>
        {errors.description && (
          <span style={{ display: "block", fontSize: "0.74rem", color: "#ef4444", marginTop: "3px" }}>
            {errors.description}
          </span>
        )}
      </div>

      {/* Industries / Categories Served (CustomSelect) */}
      <div className="pp-form-group">
        <CustomSelect
          id="pp-biz-industry-served"
          label="Which industries or categories do you serve?"
          required
          placeholder="Select industry category"
          value={industryServed}
          onChange={(val) => {
            setIndustryServed(val);
            updateBusinessDraft({ industryServed: val });
            if (errors.industryServed) setErrors((prev) => ({ ...prev, industryServed: "" }));
          }}
          options={SERVED_INDUSTRIES}
          error={errors.industryServed}
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

      {/* Main Products or Services */}
      <div className="pp-form-group" style={{ marginBottom: "20px" }}>
        <label htmlFor="pp-biz-products" className="pp-form-label">
          What are your main products or services? <span style={{ color: "#3562f5" }}>*</span>
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
              <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
              <circle cx="7" cy="7" r=".5" fill="currentColor" />
            </svg>
          </div>
          <input
            id="pp-biz-products"
            type="text"
            placeholder="E.g. AC Repair, Refrigerator Service, Preventive Maintenance"
            value={productsServices}
            onChange={(e) => {
              setProductsServices(e.target.value);
              updateBusinessDraft({ productsServices: e.target.value });
              if (errors.productsServices) setErrors((prev) => ({ ...prev, productsServices: "" }));
            }}
            className={errors.productsServices ? "has-error" : ""}
            style={{ paddingLeft: "38px" }}
          />
        </div>
        {errors.productsServices && (
          <span style={{ display: "block", fontSize: "0.74rem", color: "#ef4444", marginTop: "4px" }}>
            {errors.productsServices}
          </span>
        )}
      </div>

      {/* Action Buttons: Back + Continue */}
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
            <span>Saving business...</span>
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
