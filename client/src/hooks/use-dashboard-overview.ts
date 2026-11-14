"use client";

import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/hooks/use-tenant";
import { dashboardService, DashboardOverview } from "@/services/dashboard.service";

/** Real overview metrics for the current organization (refreshes every minute). */
export function useDashboardOverview(days = 7) {
  const { organizationId } = useTenant();
  return useQuery<DashboardOverview, Error>({
    queryKey: ["dashboard", "overview", organizationId, days],
    queryFn: () => dashboardService.getOverview(days),
    enabled: Boolean(organizationId),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
