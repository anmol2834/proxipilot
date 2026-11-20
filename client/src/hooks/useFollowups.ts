"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/use-tenant";
import { queryKeys } from "@/lib/query/query-keys";
import { followupService } from "@/services/followup.service";
import type {
  FollowupControlsPatch,
  FollowupPolicy,
  LeadFilter,
  ThreadFollowup,
} from "@/types/followup.types";

/** Keys include the organisation so switching workspace never shows another tenant's data. */
export const followupKeys = {
  all: (org: string | null) => ["followups", org ?? "none"] as const,
  thread: (org: string | null, threadId: string) => [...followupKeys.all(org), "thread", threadId] as const,
  policy: (org: string | null) => [...followupKeys.all(org), "policy"] as const,
  leads: (org: string | null, filter: LeadFilter, page: number, temperature: string | null) =>
    [...followupKeys.all(org), "leads", filter, page, temperature ?? "any"] as const,
};

export function useThreadFollowup(threadId: string | null) {
  const { organizationId } = useTenant();
  return useQuery({
    queryKey: followupKeys.thread(organizationId, threadId ?? "none"),
    queryFn: () => followupService.getThread(threadId as string),
    enabled: Boolean(threadId && organizationId),
    staleTime: 15_000,
  });
}

function useApplyPanel(threadId: string) {
  const qc = useQueryClient();
  const { organizationId } = useTenant();
  return (panel: ThreadFollowup) => {
    qc.setQueryData(followupKeys.thread(organizationId, threadId), panel);
    qc.invalidateQueries({ queryKey: [...followupKeys.all(organizationId), "leads"] });
    qc.invalidateQueries({ queryKey: queryKeys.inbox.lists() });
  };
}

export function usePatchFollowupControls(threadId: string) {
  const apply = useApplyPanel(threadId);
  return useMutation({
    mutationFn: (patch: FollowupControlsPatch) => followupService.patchControls(threadId, patch),
    onSuccess: apply,
  });
}

export function useScheduleFollowup(threadId: string) {
  const apply = useApplyPanel(threadId);
  return useMutation({
    mutationFn: (body: { version: number; local_date: string; local_time: string; timezone?: string | null }) =>
      followupService.schedule(threadId, body),
    onSuccess: apply,
  });
}

export function useClearFollowupSchedule(threadId: string) {
  const apply = useApplyPanel(threadId);
  return useMutation({
    mutationFn: (version: number) => followupService.clearSchedule(threadId, version),
    onSuccess: apply,
  });
}

export function useLiftSuppression(threadId: string) {
  const qc = useQueryClient();
  const { organizationId } = useTenant();
  return useMutation({
    mutationFn: (id: string) => followupService.liftSuppression(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: followupKeys.thread(organizationId, threadId) }),
  });
}

/** After a Hot/Warm/Cold pill change (legacy route), refresh the panel so the source shows "manual". */
export function useRefreshThreadFollowup() {
  const qc = useQueryClient();
  const { organizationId } = useTenant();
  return (threadId: string) => {
    qc.invalidateQueries({ queryKey: followupKeys.thread(organizationId, threadId) });
    qc.invalidateQueries({ queryKey: [...followupKeys.all(organizationId), "leads"] });
  };
}

export function useFollowupPolicy() {
  const { organizationId } = useTenant();
  return useQuery({
    queryKey: followupKeys.policy(organizationId),
    queryFn: () => followupService.getPolicy(),
    enabled: Boolean(organizationId),
  });
}

export function usePatchFollowupPolicy() {
  const qc = useQueryClient();
  const { organizationId } = useTenant();
  return useMutation({
    mutationFn: (patch: Partial<FollowupPolicy> & { version: number }) => followupService.patchPolicy(patch),
    onSuccess: (policy) => qc.setQueryData(followupKeys.policy(organizationId), policy),
  });
}

export function useLeads(filter: LeadFilter, page: number, temperature: string | null, pageSize = 25) {
  const { organizationId } = useTenant();
  return useQuery({
    queryKey: followupKeys.leads(organizationId, filter, page, temperature),
    queryFn: () => followupService.leads({ filter, page, pageSize, temperature }),
    enabled: Boolean(organizationId),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
}
