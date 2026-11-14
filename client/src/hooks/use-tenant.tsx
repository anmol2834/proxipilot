"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { queryKeys } from "@/lib/query/query-keys";

export interface TenantOrganization {
  organization_id: string;
  id?: string;
  name: string;
  slug: string;
  role: string;
  status: string;
}

interface TenantContextValue {
  currentOrganization: TenantOrganization | null;
  organizationId: string | null;
  role: string | null;
  organizations: TenantOrganization[];
  isSwitching: boolean;
  switchOrganization: (targetOrgId: string) => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const organizations: TenantOrganization[] = useMemo(() => {
    const rawOrgs = (user as any)?.organizations ?? [];
    return rawOrgs.map((o: any) => ({
      ...o,
      organization_id: o.organization_id || o.id,
      id: o.id || o.organization_id,
    }));
  }, [user]);

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  // Initialize selectedOrgId to user's primary organization or first active membership
  useEffect(() => {
    if (!selectedOrgId) {
      const primaryId = (user as any)?.primary_organization_id;
      if (primaryId) {
        setSelectedOrgId(primaryId);
      } else if (organizations.length > 0) {
        setSelectedOrgId(organizations[0].organization_id);
      }
    }
  }, [organizations, selectedOrgId, user]);

  const currentOrganization = useMemo(() => {
    if (!selectedOrgId) return organizations[0] || null;
    return (
      organizations.find((o) => o.organization_id === selectedOrgId || o.id === selectedOrgId) ||
      organizations[0] ||
      null
    );
  }, [organizations, selectedOrgId]);

  const organizationId = currentOrganization?.organization_id || currentOrganization?.id || null;
  const role = currentOrganization?.role || null;

  /**
   * Enterprise tenant switching logic:
   * 1. Cancel in-flight queries
   * 2. Invalidate / remove queries belonging to the previous tenant
   * 3. Set the new tenant ID
   * 4. Preload new tenant context
   */
  const switchOrganization = useCallback(
    async (targetOrgId: string) => {
      if (targetOrgId === organizationId) return;

      setIsSwitching(true);
      try {
        // Cancel all in-flight queries
        await queryClient.cancelQueries();

        // Clear previous tenant's cached server state
        if (organizationId) {
          queryClient.removeQueries({
            predicate: (query) => {
              const key = query.queryKey;
              return Array.isArray(key) && key.includes(organizationId);
            },
          });
        }

        setSelectedOrgId(targetOrgId);

        // Targeted invalidation for new tenant
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.tenant.detail(targetOrgId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.inbox.byTenant(targetOrgId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.byTenant(targetOrgId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.integrations.byTenant(targetOrgId) }),
        ]);
      } finally {
        setIsSwitching(false);
      }
    },
    [organizationId, queryClient]
  );

  return (
    <TenantContext.Provider
      value={{
        currentOrganization,
        organizationId,
        role,
        organizations,
        isSwitching,
        switchOrganization,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}
