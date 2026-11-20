/**
 * Follow-up Service — conversation intelligence, follow-up controls and workspace policy.
 *
 *   GET    /followups/threads/{id}
 *   PATCH  /followups/threads/{id}/controls
 *   POST   /followups/threads/{id}/schedule
 *   DELETE /followups/threads/{id}/schedule?version=
 *   POST   /followups/threads/{id}/apply-suggestion?version=
 *   POST   /followups/threads/{id}/time-suggestion/accept?version=
 *   POST   /followups/threads/{id}/time-suggestion/dismiss?version=
 *   DELETE /followups/suppressions/{id}
 *   GET    /followups/policy        PATCH /followups/policy
 */

import { apiClient } from "@/lib/api/client";
import type { FollowupControlsPatch, FollowupPolicy, ThreadFollowup } from "@/types/followup.types";

export const followupService = {
  async getThread(threadId: string): Promise<ThreadFollowup> {
    return (await apiClient.get<ThreadFollowup>(`/followups/threads/${threadId}`)).data;
  },

  async patchControls(threadId: string, patch: FollowupControlsPatch): Promise<ThreadFollowup> {
    return (await apiClient.patch<ThreadFollowup>(`/followups/threads/${threadId}/controls`, patch)).data;
  },

  async schedule(
    threadId: string,
    body: { version: number; local_date: string; local_time: string; timezone?: string | null }
  ): Promise<ThreadFollowup> {
    return (await apiClient.post<ThreadFollowup>(`/followups/threads/${threadId}/schedule`, body)).data;
  },

  async clearSchedule(threadId: string, version: number): Promise<ThreadFollowup> {
    return (
      await apiClient.delete<ThreadFollowup>(`/followups/threads/${threadId}/schedule`, { params: { version } })
    ).data;
  },

  async applySuggestion(threadId: string, version: number): Promise<ThreadFollowup> {
    return (
      await apiClient.post<ThreadFollowup>(`/followups/threads/${threadId}/apply-suggestion`, undefined, {
        params: { version },
      })
    ).data;
  },

  async acceptTimeSuggestion(threadId: string, version: number): Promise<ThreadFollowup> {
    return (
      await apiClient.post<ThreadFollowup>(`/followups/threads/${threadId}/time-suggestion/accept`, undefined, {
        params: { version },
      })
    ).data;
  },

  async dismissTimeSuggestion(threadId: string, version: number): Promise<ThreadFollowup> {
    return (
      await apiClient.post<ThreadFollowup>(`/followups/threads/${threadId}/time-suggestion/dismiss`, undefined, {
        params: { version },
      })
    ).data;
  },

  async liftSuppression(id: string): Promise<{ id: string; lifted: boolean }> {
    return (await apiClient.delete<{ id: string; lifted: boolean }>(`/followups/suppressions/${id}`)).data;
  },

  async getPolicy(): Promise<FollowupPolicy> {
    return (await apiClient.get<FollowupPolicy>("/followups/policy")).data;
  },

  async patchPolicy(patch: Partial<FollowupPolicy> & { version: number }): Promise<FollowupPolicy> {
    return (await apiClient.patch<FollowupPolicy>("/followups/policy", patch)).data;
  },
};
