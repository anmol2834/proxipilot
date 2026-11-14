"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";
import {
  authApi,
  OnboardingStateData,
  OrganizationCreateData,
  BusinessProfileData,
  WorkspacePreferencesData,
} from "@/lib/api";

export function useOnboarding(organizationId?: string) {
  const queryClient = useQueryClient();

  const {
    data: onboardingState,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<OnboardingStateData, Error>({
    queryKey: queryKeys.auth.onboarding(organizationId),
    queryFn: () => authApi.getOnboardingState(organizationId),
    staleTime: 60 * 1000,
    retry: false,
  });

  const createOrganizationMutation = useMutation({
    mutationFn: (data: OrganizationCreateData) => authApi.createOrganization(data),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tenant.all }),
      ]);
    },
  });

  const updateBusinessProfileMutation = useMutation({
    mutationFn: ({ orgId, data }: { orgId: string; data: BusinessProfileData }) =>
      authApi.updateBusinessProfile(orgId, data),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.onboarding() }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.tenant.businessProfile(variables.orgId),
        }),
      ]);
    },
  });

  const updateWorkspacePreferencesMutation = useMutation({
    mutationFn: ({ orgId, data }: { orgId: string; data: WorkspacePreferencesData }) =>
      authApi.updateWorkspacePreferences(orgId, data),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.onboarding() }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.tenant.preferences(variables.orgId),
        }),
      ]);
    },
  });

  return {
    onboardingState,
    isLoading,
    isCompleted: onboardingState?.is_completed ?? false,
    currentStep: onboardingState?.current_step ?? "account",
    completedSteps: onboardingState?.completed_steps ?? [],
    nextRoute: onboardingState?.next_route ?? "/signup",
    isError,
    error,
    refetch,
    createOrganization: createOrganizationMutation.mutateAsync,
    isCreatingOrg: createOrganizationMutation.isPending,
    updateBusinessProfile: updateBusinessProfileMutation.mutateAsync,
    isUpdatingBusiness: updateBusinessProfileMutation.isPending,
    updateWorkspacePreferences: updateWorkspacePreferencesMutation.mutateAsync,
    isUpdatingPreferences: updateWorkspacePreferencesMutation.isPending,
  };
}
