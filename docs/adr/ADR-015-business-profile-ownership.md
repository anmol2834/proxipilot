# ADR-015: Business Profile Ownership and Boundary

## Status
Accepted

## Context
Step 3 of the onboarding wizard collects details regarding what the company does, its industry, target customers, and primary products/services. We needed to decide whether this entity belongs to the `User` or to the `Organization`, and how it relates to AI persona configurations.

## Decision
1. **Ownership**: The `BusinessProfile` entity belongs to `Organization` (`business_profiles.organization_id`), NOT `User`. An organization represents the commercial entity whose services and products are being managed by ProxiPilot. Multiple team members within the organization share this single business profile.
2. **Boundary with AI Persona**: The Business Profile strictly represents commercial facts ("what we do, who we serve, products"). It does NOT store prompt engineering or communication tone heuristics. Tone and agent behavior are delegated to `WorkspacePreferences` and future AI Persona entities.

## Consequences
- Single business profile per tenant (`UNIQUE(organization_id)`).
- Member users inherit the company's business profile.
- RAG embeddings for organizational knowledge use the business profile as core grounding context.
