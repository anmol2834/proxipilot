"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  useInfiniteConversations,
  useConversationMessages,
  useToggleStar,
  useSetLeadTemperature,
  useDeleteConversation,
  useMarkAsRead,
} from "@/hooks/useInbox";
import {
  ConversationList,
  ConversationDetailPane,
  DeleteConfirmDialog,
} from "@/components/inbox";
import { LeadTemperature, Conversation } from "@/types/inbox.types";

function InboxContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeConversationId = searchParams.get("conversation");

  // TanStack Query Infinite Query for conversations
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteConversations();

  // Flatten paginated pages into single array
  const allConversations = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data]);

  // Determine currently selected conversation
  const selectedConversation = useMemo(() => {
    if (!allConversations.length) return null;
    if (activeConversationId) {
      const found = allConversations.find((c) => c.id === activeConversationId);
      if (found) return found;
    }
    return allConversations[0] || null;
  }, [allConversations, activeConversationId]);

  // Messages query for active thread
  const { data: messagesData } = useConversationMessages(selectedConversation?.id || null);
  const messages = messagesData?.items || [];

  // Mutations
  const toggleStarMutation = useToggleStar();
  const setLeadTempMutation = useSetLeadTemperature();
  const deleteMutation = useDeleteConversation();
  const markAsReadMutation = useMarkAsRead();

  // Mobile state
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Sync URL selection — on desktop both panes stay visible; on mobile (<768px) switches to detail
  const handleSelectConversation = (id: string) => {
    router.replace(`/dashboard/inbox?conversation=${id}`, { scroll: false });
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setMobileDetailOpen(true);
    }
    const target = allConversations.find((c) => c.id === id);
    if (target?.unread) {
      markAsReadMutation.mutate(id);
    }
  };

  const handleToggleStar = (id: string, currentStarred: boolean) => {
    toggleStarMutation.mutate({ id, starred: !currentStarred });
  };

  const handleSetLeadTemperature = (leadTemperature: LeadTemperature) => {
    if (!selectedConversation) return;
    setLeadTempMutation.mutate({ id: selectedConversation.id, leadTemperature });
  };

  const handleConfirmDelete = () => {
    if (!selectedConversation) return;
    const currentId = selectedConversation.id;
    deleteMutation.mutate(currentId);
    setIsDeleteDialogOpen(false);

    const remaining = allConversations.filter((c) => c.id !== currentId);
    if (remaining.length > 0) {
      router.replace(`/dashboard/inbox?conversation=${remaining[0].id}`, { scroll: false });
    } else {
      router.replace(`/dashboard/inbox`, { scroll: false });
      setMobileDetailOpen(false);
    }
  };

  // Keyboard navigation (J/K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        (document.activeElement as HTMLElement)?.isContentEditable ||
        isDeleteDialogOpen
      ) {
        return;
      }
      if (!allConversations.length || !selectedConversation) return;
      const currentIndex = allConversations.findIndex((c) => c.id === selectedConversation.id);

      if (e.key === "j" || e.key === "ArrowDown") {
        if (currentIndex < allConversations.length - 1)
          handleSelectConversation(allConversations[currentIndex + 1].id);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        if (currentIndex > 0)
          handleSelectConversation(allConversations[currentIndex - 1].id);
      } else if (e.key === "s") {
        handleToggleStar(selectedConversation.id, selectedConversation.starred);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [allConversations, selectedConversation, isDeleteDialogOpen]);

  return (
    <>
      <style>{`
        body:has(.inbox-responsive-grid) {
          overflow: hidden !important;
          height: 100vh !important;
          max-height: 100vh !important;
        }
        @media (min-width: 768px) {
          .inbox-responsive-grid {
            display: grid !important;
            grid-template-columns: 350px 1fr !important;
          }
          .inbox-list-column {
            display: flex !important;
          }
          .inbox-detail-column {
            display: flex !important;
          }
        }
        @media (max-width: 767px) {
          .inbox-responsive-grid {
            display: flex !important;
            flex-direction: column !important;
          }
          .inbox-list-column.mobile-hidden {
            display: none !important;
          }
          .inbox-detail-column.mobile-hidden {
            display: none !important;
          }
        }
      `}</style>

      {/* Full-bleed inbox split pane container */}
      <div
        className="inbox-responsive-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "350px 1fr",
          height: "100%",
          maxHeight: "100%",
          width: "100%",
          minHeight: 0,
          overflow: "hidden",
          background: "#FFFFFF",
        }}
      >
        {/* Left pane — conversation list (always visible on desktop) */}
        <div
          className={`inbox-list-column ${mobileDetailOpen ? "mobile-hidden" : ""}`}
          style={{
            height: "100%",
            maxHeight: "100%",
            width: "100%",
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid #E8ECF0",
          }}
        >
          <ConversationList
            conversations={allConversations}
            selectedId={selectedConversation?.id || null}
            onSelect={handleSelectConversation}
            onToggleStar={handleToggleStar}
            isLoading={isLoading}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={Boolean(hasNextPage)}
            fetchNextPage={fetchNextPage}
          />
        </div>

        {/* Right pane — conversation detail (always visible on desktop) */}
        <div
          className={`inbox-detail-column ${!mobileDetailOpen ? "mobile-hidden" : ""}`}
          style={{
            height: "100%",
            maxHeight: "100%",
            width: "100%",
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          <ConversationDetailPane
            conversation={selectedConversation}
            messages={messages}
            onToggleStar={(starred) => {
              if (selectedConversation) handleToggleStar(selectedConversation.id, !starred);
            }}
            onSetLeadTemperature={handleSetLeadTemperature}
            onDeleteClick={() => setIsDeleteDialogOpen(true)}
            onBackToList={() => setMobileDetailOpen(false)}
          />
        </div>
      </div>

      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "calc(100vh - 64px)",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: "3px solid #DBEAFE",
              borderTopColor: "#2563EB",
              animation: "spin 0.75s linear infinite",
            }}
          />
        </div>
      }
    >
      <InboxContent />
    </Suspense>
  );
}
