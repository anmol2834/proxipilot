"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/use-tenant";
import { queryKeys } from "@/lib/query/query-keys";
import { followupService } from "@/services/followup.service";
import type {
  FollowupControlsPatch,
  FollowupPolicy,
  ThreadFollowup,
} from "@/types/followup.types";

/** Keys include the organisation so switching workspace never shows another tenant's data. */
export const followupKeys = {
  all: (org: string | null) => ["followups", org ?? "none"] as const,
  thread: (org: string | null, threadId: string) => [...followupKeys.all(org), "thread", threadId] as const,
  policy: (org: string | null) => [...followupKeys.all(org), "policy"] as const,
};

/** Human-readable message from an API error (409s explain a concurrent change). */
export function followupError(e: unknown): string {
  const err = e as { statusCode?: number; message?: string } | null;
  if (err?.statusCode === 409) return err.message || "This changed in the meantime — refreshed, please try again.";
  if (err?.statusCode === 403) return "You don't have permission to do that.";
  return err?.message || "Something went wrong. Please try again.";
}

export function useThreadFollowup(threadId: string | null) {
  const { organizationId } = useTenant();
  return useQuery({
    queryKey: followupKeys.thread(organizationId, threadId ?? "none"),
    queryFn: () => followupService.getThread(threadId as string),
    enabled: Boolean(threadId && organizationId),
    staleTime: 15_000,
  });
}

/** After any change: store the fresh panel and refresh the inbox list (its follow-up badges). */
function useApplyPanel(threadId: string) {
  const qc = useQueryClient();
  const { organizationId } = useTenant();
  return (panel: ThreadFollowup) => {
    qc.setQueryData(followupKeys.thread(organizationId, threadId), panel);
    qc.invalidateQueries({ queryKey: queryKeys.inbox.lists() });
  };
}

function useRefetchOnConflict(threadId: string) {
  const qc = useQueryClient();
  const { organizationId } = useTenant();
  return (e: unknown) => {
    if ((e as { statusCode?: number })?.statusCode === 409) {
      qc.invalidateQueries({ queryKey: followupKeys.thread(organizationId, threadId) });
    }
  };
}

export function usePatchFollowupControls(threadId: string) {
  const apply = useApplyPanel(threadId);
  const onError = useRefetchOnConflict(threadId);
  return useMutation({
    mutationFn: (patch: FollowupControlsPatch) => followupService.patchControls(threadId, patch),
    onSuccess: apply,
    onError,
  });
}

export function useScheduleFollowup(threadId: string) {
  const apply = useApplyPanel(threadId);
  const onError = useRefetchOnConflict(threadId);
  return useMutation({
    mutationFn: (body: { version: number; local_date: string; local_time: string; timezone?: string | null }) =>
      followupService.schedule(threadId, body),
    onSuccess: apply,
    onError,
  });
}

export function useClearFollowupSchedule(threadId: string) {
  const apply = useApplyPanel(threadId);
  const onError = useRefetchOnConflict(threadId);
  return useMutation({
    mutationFn: (version: number) => followupService.clearSchedule(threadId, version),
    onSuccess: apply,
    onError,
  });
}

export function useApplySuggestion(threadId: string) {
  const apply = useApplyPanel(threadId);
  const onError = useRefetchOnConflict(threadId);
  return useMutation({
    mutationFn: (version: number) => followupService.applySuggestion(threadId, version),
    onSuccess: apply,
    onError,
  });
}

/** Accept the AI's proposed new follow-up time (it becomes the team's own schedule). */
export function useAcceptTimeSuggestion(threadId: string) {
  const apply = useApplyPanel(threadId);
  const onError = useRefetchOnConflict(threadId);
  return useMutation({
    mutationFn: (version: number) => followupService.acceptTimeSuggestion(threadId, version),
    onSuccess: apply,
    onError,
  });
}

/** Keep the current follow-up time and discard the AI's proposal. */
export function useDismissTimeSuggestion(threadId: string) {
  const apply = useApplyPanel(threadId);
  const onError = useRefetchOnConflict(threadId);
  return useMutation({
    mutationFn: (version: number) => followupService.dismissTimeSuggestion(threadId, version),
    onSuccess: apply,
    onError,
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

export function useFollowupPolicy(enabled: boolean = true) {
  const { organizationId } = useTenant();
  return useQuery({
    queryKey: followupKeys.policy(organizationId),
    queryFn: () => followupService.getPolicy(),
    enabled: Boolean(organizationId) && enabled,
  });
}

export function usePatchFollowupPolicy() {
  const qc = useQueryClient();
  const { organizationId } = useTenant();
  return useMutation({
    mutationFn: (patch: Partial<FollowupPolicy> & { version: number }) => followupService.patchPolicy(patch),
    onSuccess: (policy) => {
      qc.setQueryData(followupKeys.policy(organizationId), policy);
      qc.invalidateQueries({ queryKey: queryKeys.inbox.lists() });
    },
  });
}
