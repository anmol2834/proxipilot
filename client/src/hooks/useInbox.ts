"use client";

import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";
import { inboxService } from "@/services/inbox.service";
import { LeadTemperature, Conversation } from "@/types/inbox.types";

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

export function useConversationMessages(conversationId: string | null) {
  return useQuery({
    queryKey: conversationId ? queryKeys.inbox.threads(conversationId) : ["inbox", "thread", "empty"],
    queryFn: () =>
      conversationId
        ? inboxService.getConversationMessages({ conversationId })
        : Promise.resolve({ items: [], previousCursor: null, hasMore: false }),
    enabled: Boolean(conversationId),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
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
