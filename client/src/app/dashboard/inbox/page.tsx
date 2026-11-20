"use client";

import React, { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  useInfiniteConversations,
  useConversationMessages,
  useSetLeadTemperature,
  useDeleteConversation,
  useMarkAsRead,
} from "@/hooks/useInbox";
import {
  ConversationList,
  ConversationDetailPane,
  DeleteConfirmDialog,
  IsolatedAiPromptBox,
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

  // Active thread's messages: newest batch first, older batches loaded as the user scrolls up.
  const thread = useConversationMessages(selectedConversation?.id || null);
  const { fetchNextPage: fetchOlderMessages, refetch: refetchMessages } = thread;
  const loadOlderMessages = useCallback(() => {
    void fetchOlderMessages();
  }, [fetchOlderMessages]);
  const retryMessages = useCallback(() => {
    void refetchMessages();
  }, [refetchMessages]);

  // Mutations
  const setLeadTempMutation = useSetLeadTemperature();
  const deleteMutation = useDeleteConversation();
  const markAsReadMutation = useMarkAsRead();

  // Mobile state
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // AI Prompt Box state (isolated to currently opened conversation)
  const [isAiPromptOpen, setIsAiPromptOpen] = useState(false);
  const [activeDraftText, setActiveDraftText] = useState("");
  const [injectedDraftText, setInjectedDraftText] = useState<string | null>(null);
  // Bumped on every Copilot apply/undo so the editor receives it even when the text repeats.
  const [injectedDraftNonce, setInjectedDraftNonce] = useState(0);

  const handleApplyAiDraft = (text: string) => {
    setInjectedDraftText(text);
    setInjectedDraftNonce((n) => n + 1);
    setActiveDraftText(text);
  };

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
    // Reset injected draft when switching conversations
    setInjectedDraftText(null);
  };

  const handleSetLeadTemperature = (leadTemperature: LeadTemperature) => {
    if (!selectedConversation) return;
    setLeadTempMutation.mutate({ id: selectedConversation.id, leadTemperature });
  };

  const handleConfirmDelete = async () => {
    if (!selectedConversation) return;
    const targetId = selectedConversation.id;
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(targetId);
      setIsDeleteDialogOpen(false);

      const remaining = allConversations.filter((c) => c.id !== targetId);
      if (remaining.length > 0) {
        router.replace(`/dashboard/inbox?conversation=${remaining[0].id}`, { scroll: false });
      } else {
        router.replace(`/dashboard/inbox`, { scroll: false });
        setMobileDetailOpen(false);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Failed to delete conversation. Please try again.";
      setDeleteError(msg);
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
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [allConversations, selectedConversation, isDeleteDialogOpen]);

  return (
    <>
      <style>{`
        body:has(.inbox-responsive-container) {
          overflow: hidden !important;
          height: 100vh !important;
          max-height: 100vh !important;
        }
        @media (min-width: 768px) {
          .inbox-responsive-container {
            display: flex !important;
            flex-direction: row !important;
          }
          .inbox-list-column {
            display: flex !important;
          }
          .inbox-detail-column {
            display: flex !important;
          }
        }
        @media (max-width: 767px) {
          .inbox-responsive-container {
            display: flex !important;
            flex-direction: column !important;
            position: relative !important;
          }
          .inbox-list-column.mobile-hidden {
            display: none !important;
          }
          .inbox-detail-column.mobile-hidden {
            display: none !important;
          }
          .inbox-ai-prompt-column {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            z-index: 100 !important;
          }
        }
      `}</style>

      {/* Full-bleed inbox split pane container with animated sliding columns */}
      <div
        className="inbox-responsive-container"
        style={{
          display: "flex",
          flexDirection: "row",
          height: "100%",
          maxHeight: "100%",
          width: "100%",
          minHeight: 0,
          overflow: "hidden",
          background: "#FFFFFF",
          position: "relative",
        }}
      >
        {/* Left pane — conversation list (smoothly slides off to the left when AI prompt opens) */}
        <div
          className={`inbox-list-column ${mobileDetailOpen ? "mobile-hidden" : ""}`}
          style={{
            height: "100%",
            maxHeight: "100%",
            width: isAiPromptOpen ? 0 : 350,
            minWidth: isAiPromptOpen ? 0 : 350,
            maxWidth: isAiPromptOpen ? 0 : 350,
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            borderRight: isAiPromptOpen ? "none" : "1px solid #E8ECF0",
            opacity: isAiPromptOpen ? 0 : 1,
            pointerEvents: isAiPromptOpen ? "none" : "auto",
            transform: isAiPromptOpen ? "translateX(-100%)" : "translateX(0)",
            transition:
              "width 0.38s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.38s cubic-bezier(0.16, 1, 0.3, 1), max-width 0.38s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease, transform 0.38s cubic-bezier(0.16, 1, 0.3, 1)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 350,
              minWidth: 350,
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <ConversationList
              conversations={allConversations}
              selectedId={selectedConversation?.id || null}
              onSelect={handleSelectConversation}
              isLoading={isLoading}
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={Boolean(hasNextPage)}
              fetchNextPage={fetchNextPage}
            />
          </div>
        </div>

        {/* Center pane — conversation detail (smoothly expands when left list slides off or prompt opens) */}
        <div
          className={`inbox-detail-column ${!mobileDetailOpen ? "mobile-hidden" : ""}`}
          style={{
            height: "100%",
            maxHeight: "100%",
            flex: "1 1 0%",
            minWidth: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            transition: "flex 0.38s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <ConversationDetailPane
            conversation={selectedConversation}
            messages={thread.messages}
            messagesLoading={thread.isLoading}
            messagesError={thread.isError && !thread.messages.length}
            onRetryMessages={retryMessages}
            totalMessageCount={thread.totalCount}
            mailbox={thread.mailbox}
            hasOlderMessages={Boolean(thread.hasNextPage)}
            isLoadingOlder={thread.isFetchingNextPage}
            olderMessagesError={thread.isFetchNextPageError}
            onLoadOlder={loadOlderMessages}
            onSetLeadTemperature={handleSetLeadTemperature}
            onDeleteClick={() => {
              setDeleteError(null);
              setIsDeleteDialogOpen(true);
            }}
            onBackToList={() => setMobileDetailOpen(false)}
            isAiPromptOpen={isAiPromptOpen}
            onToggleAiPrompt={() => setIsAiPromptOpen((prev) => !prev)}
            injectedDraftText={injectedDraftText}
            injectedDraftNonce={injectedDraftNonce}
            onDraftTextChange={(text) => setActiveDraftText(text)}
          />
        </div>

        {/* Right pane — isolated AI prompt box (smoothly slides open from right) */}
        <div
          className="inbox-ai-prompt-column"
          style={{
            height: "100%",
            maxHeight: "100%",
            width: isAiPromptOpen ? 430 : 0,
            minWidth: isAiPromptOpen ? 430 : 0,
            maxWidth: isAiPromptOpen ? 430 : 0,
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            borderLeft: isAiPromptOpen ? "1px solid #E2E8F0" : "none",
            opacity: isAiPromptOpen ? 1 : 0,
            pointerEvents: isAiPromptOpen ? "auto" : "none",
            transform: isAiPromptOpen ? "translateX(0)" : "translateX(100%)",
            transition:
              "width 0.38s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.38s cubic-bezier(0.16, 1, 0.3, 1), max-width 0.38s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease, transform 0.38s cubic-bezier(0.16, 1, 0.3, 1)",
            flexShrink: 0,
            background: "#FFFFFF",
            boxShadow: isAiPromptOpen ? "-8px 0 24px rgba(15, 23, 42, 0.05)" : "none",
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: 430,
              minWidth: 430,
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <IsolatedAiPromptBox
              isOpen={isAiPromptOpen}
              conversation={selectedConversation}
              currentDraft={activeDraftText}
              onApplyDraft={handleApplyAiDraft}
              onClose={() => setIsAiPromptOpen(false)}
            />
          </div>
        </div>
      </div>

      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onClose={() => {
          if (!deleteMutation.isPending) {
            setIsDeleteDialogOpen(false);
            setDeleteError(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        conversationSubject={selectedConversation?.subject}
        conversationSender={selectedConversation?.sender?.name}
        isPending={deleteMutation.isPending}
        error={deleteError}
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
