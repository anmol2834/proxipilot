"use client";

import { useMemo } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";
import { inboxService } from "@/services/inbox.service";
import { LeadTemperature, Conversation, Message } from "@/types/inbox.types";

export function useInfiniteConversations() {
  return useInfiniteQuery({
    queryKey: queryKeys.inbox.lists(),
    queryFn: ({ pageParam }) =>
      inboxService.getConversations({ cursor: pageParam, limit: 25 }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 60 * 1000, // 1 minute fresh time to prevent illogic polling
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Messages fetched per request when opening a thread / scrolling up through its history. */
export const THREAD_PAGE_SIZE = 5;

/**
 * A thread's messages, loaded newest-first in small batches.
 *
 * Page 0 is the newest {@link THREAD_PAGE_SIZE} messages (one small request on open); each
 * `fetchNextPage()` loads the batch just OLDER than everything loaded so far, using the
 * server's keyset cursor. `messages` is the de-duplicated, chronological list (oldest first)
 * across all loaded batches, ready to render top-to-bottom.
 */
export function useConversationMessages(conversationId: string | null) {
  const query = useInfiniteQuery({
    queryKey: conversationId ? queryKeys.inbox.threads(conversationId) : ["inbox", "thread", "empty"],
    queryFn: ({ pageParam }) =>
      inboxService.getConversationMessages({
        conversationId: conversationId as string,
        before: pageParam,
        limit: THREAD_PAGE_SIZE,
      }),
    initialPageParam: null as string | null,
    // "Next" page = older history (the user scrolls up for it).
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.previousCursor ?? undefined : undefined),
    enabled: Boolean(conversationId),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const pages = query.data?.pages;
  const messages = useMemo<Message[]>(() => {
    if (!pages?.length) return [];
    const seen = new Set<string>();
    const out: Message[] = [];
    // pages[0] is the newest batch: walk from the oldest loaded batch to the newest.
    for (let p = pages.length - 1; p >= 0; p--) {
      for (const m of pages[p].items) {
        if (seen.has(m.id)) continue; // a refetch after new mail can shift batch edges
        seen.add(m.id);
        out.push(m);
      }
    }
    return out;
  }, [pages]);

  return {
    ...query,
    messages,
    /** Total messages in the thread (from the newest page), or null if not known yet. */
    totalCount: pages?.[0]?.totalCount ?? null,
    mailbox: pages?.[0]?.mailbox ?? null,
  };
}

export function useToggleStar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, starred }: { id: string; starred: boolean }) =>
      inboxService.toggleStar(id, starred),
    onMutate: async ({ id, starred }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.inbox.lists() });

      queryClient.setQueriesData({ queryKey: queryKeys.inbox.lists() }, (oldData: any) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            items: page.items.map((item: Conversation) =>
              item.id === id ? { ...item, starred } : item
            ),
          })),
        };
      });
    },
  });
}

export function useSetLeadTemperature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      leadTemperature,
    }: {
      id: string;
      leadTemperature: LeadTemperature;
    }) => inboxService.setLeadTemperature(id, leadTemperature),
    onMutate: async ({ id, leadTemperature }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.inbox.lists() });

      queryClient.setQueriesData({ queryKey: queryKeys.inbox.lists() }, (oldData: any) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            items: page.items.map((item: Conversation) =>
              item.id === id ? { ...item, leadTemperature } : item
            ),
          })),
        };
      });
    },
    // A Hot/Warm/Cold pick is a manual override (null = use automatic classification): refresh the
    // follow-up panel and Leads so they show the new source.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["followups"] });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => inboxService.deleteConversation(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.inbox.lists() });

      queryClient.setQueriesData({ queryKey: queryKeys.inbox.lists() }, (oldData: any) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            items: page.items.filter((item: Conversation) => item.id !== id),
          })),
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inbox.lists() });
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => inboxService.markAsRead(id),
    onMutate: async (id: string) => {
      queryClient.setQueriesData({ queryKey: queryKeys.inbox.lists() }, (oldData: any) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            items: page.items.map((item: Conversation) =>
              item.id === id ? { ...item, unread: false } : item
            ),
          })),
        };
      });
    },
  });
}
