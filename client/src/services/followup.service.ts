/**
 * Follow-up Service — conversation intelligence, follow-up controls, workspace policy, Leads queue.
 *
 *   GET    /followups/threads/{id}
 *   PATCH  /followups/threads/{id}/controls
 *   POST   /followups/threads/{id}/schedule
 *   DELETE /followups/threads/{id}/schedule?version=
 *   DELETE /followups/suppressions/{id}
 *   GET    /followups/policy        PATCH /followups/policy
 *   GET    /followups/leads?filter=&page=&page_size=&temperature=
 */

import { apiClient } from "@/lib/api/client";
import type {
  FollowupControlsPatch,
  FollowupPolicy,
  LeadFilter,
  LeadsResponse,
  ThreadFollowup,
} from "@/types/followup.types";

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

  async liftSuppression(id: string): Promise<{ id: string; lifted: boolean }> {
    return (await apiClient.delete<{ id: string; lifted: boolean }>(`/followups/suppressions/${id}`)).data;
  },

  async getPolicy(): Promise<FollowupPolicy> {
    return (await apiClient.get<FollowupPolicy>("/followups/policy")).data;
  },

  async patchPolicy(patch: Partial<FollowupPolicy> & { version: number }): Promise<FollowupPolicy> {
    return (await apiClient.patch<FollowupPolicy>("/followups/policy", patch)).data;
  },

  async leads(params: {
    filter: LeadFilter;
    page: number;
    pageSize: number;
    temperature?: string | null;
  }): Promise<LeadsResponse> {
    return (
      await apiClient.get<LeadsResponse>("/followups/leads", {
        params: {
          filter: params.filter,
          page: params.page,
          page_size: params.pageSize,
          temperature: params.temperature ?? undefined,
        },
      })
    ).data;
  },
};
