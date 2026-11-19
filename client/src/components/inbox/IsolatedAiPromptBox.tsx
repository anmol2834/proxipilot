"use client";

import React, { useState, useEffect, useRef } from "react";
import { Conversation } from "@/types/inbox.types";
import {
  buildSessionContext,
  copilotService,
  draftRevision,
  type CopilotResult,
  type CopilotTurn,
  type DraftSource,
} from "@/services/copilot.service";
import {
  IconSparkles,
  IconX,
  IconCheck,
  IconCopy,
  IconRotateClockwise,
  IconBolt,
  IconShieldCheck,
  IconWand,
  IconChevronDown,
  IconChevronUp,
  IconArrowUp,
  IconTrash,
  IconArrowBackUp,
  IconAlertTriangle,
  IconPlayerStop,
} from "@tabler/icons-react";

export interface IsolatedAiPromptBoxProps {
  isOpen: boolean;
  conversation: Conversation | null;
  currentDraft: string;
  onApplyDraft: (text: string) => void;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  applied?: boolean;
  /** Backend result for assistant messages (absent for errors / cancellations). */
  result?: CopilotResult;
  error?: boolean;
  /** Which text this suggestion refined: the editor, or the previous (unapplied) suggestion. */
  basedOn?: DraftSource;
}

interface PresetAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

export function IsolatedAiPromptBox({
  isOpen,
  conversation,
  currentDraft,
  onApplyDraft,
  onClose,
}: IsolatedAiPromptBoxProps) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showOriginalDraft, setShowOriginalDraft] = useState(false);
  const [appliedToast, setAppliedToast] = useState(false);
  const [conflictId, setConflictId] = useState<string | null>(null);
  // Editor texts replaced by Copilot applies (most recent last) for Undo.
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Esc key listener to smoothly close the isolated prompt box
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus textarea when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        promptTextareaRef.current?.focus();
      }, 350);
    }
  }, [isOpen]);

  // Auto-scroll messages to bottom
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isGenerating]);

  // Reset chat feed when active conversation switches
  useEffect(() => {
    abortRef.current?.abort();
    setMessages([]);
    setCustomPrompt("");
    setAppliedToast(false);
    setConflictId(null);
    setUndoStack([]);
  }, [conversation?.id]);

  // Cancel an in-flight request when the panel unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const presetActions: PresetAction[] = [
    {
      id: "concise",
      label: "Make it concise",
      icon: <IconBolt size={13} color="#2563EB" />,
      prompt: "Condense this reply into 2-3 crisp, actionable sentences without losing key details.",
    },
    {
      id: "professional",
      label: "Professional polish",
      icon: <IconShieldCheck size={13} color="#7C3AED" />,
      prompt: "Polish the tone to be highly professional, reassuring, and articulate.",
    },
    {
      id: "missing_po",
      label: "Clarify missing PO & specs",
      icon: <IconWand size={13} color="#059669" />,
      prompt: "Politely clarify that the PO attachment was not detected and ask them to share product specs or model details.",
    },
    {
      id: "warm",
      label: "Warm & customer-first",
      icon: <IconSparkles size={13} color="#D97706" />,
      prompt: "Rephrase with a warm, empathetic tone ensuring the customer feels valued and prioritized.",
    },
  ];

  const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const triggerGeneration = async (promptText: string) => {
    if (!conversation || isGenerating) return;
    const instruction = promptText.trim();
    if (!instruction) return;
    // Working draft: keep refining the latest suggestion the user has not applied, as long as the editor
    // is still exactly what that suggestion was based on; otherwise the editor is the source of truth.
    const editorRevision = draftRevision(currentDraft);
    const lastProposal = [...messages]
      .reverse()
      .find((m) => m.role === "assistant" && m.result && m.result.proposal && m.result.operation !== "CLARIFY");
    const refineProposal = Boolean(
      lastProposal && !lastProposal.applied && lastProposal.result?.base_draft_revision === editorRevision
    );
    const workingDraft = refineProposal && lastProposal ? lastProposal.content : currentDraft;
    const draftSource: DraftSource = refineProposal ? "proposal" : "editor";

    // Session turns: each instruction with what the Copilot changed in reply (its summary).
    const turns: CopilotTurn[] = [];
    messages.forEach((m, i) => {
      if (m.role !== "user") return;
      const reply = messages[i + 1];
      turns.push({
        instruction: m.content,
        applied: Boolean(reply?.applied),
        summary:
          reply?.result?.changes_summary ||
          (reply?.result?.message ? `copilot replied: ${reply.result.message.slice(0, 300)}` : null) ||
          (reply?.error ? "(failed)" : null),
      });
    });
    const { history, session_summary } = buildSessionContext(turns);
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", content: instruction, timestamp: now() }]);
    setCustomPrompt("");
    setConflictId(null);
    setIsGenerating(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await copilotService.refine(
        conversation.id,
        {
          instruction,
          draft_text: workingDraft,
          draft_revision: editorRevision,
          history,
          draft_source: draftSource,
          session_summary,
        },
        ac.signal
      );
      // A draft suggestion shows the email; chat / answer / clarification show the message itself.
      const content = res.proposal || res.message || res.clarification_question || "";
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${res.request_id}`,
          role: "assistant",
          content,
          timestamp: now(),
          result: res,
          basedOn: draftSource,
        },
      ]);
    } catch (err) {
      const cancelled = ac.signal.aborted;
      const detail = err instanceof Error && err.message ? err.message : "Copilot could not complete this request.";
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: cancelled
            ? "Cancelled. Your draft is unchanged."
            : /draft is unchanged/i.test(detail)
              ? detail
              : `${detail} Your draft is unchanged.`,
          timestamp: now(),
          error: true,
        },
      ]);
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      setIsGenerating(false);
    }
  };

  const handleCancel = () => abortRef.current?.abort();

  const handleRunPreset = (preset: PresetAction) => {
    if (isGenerating) return;
    void triggerGeneration(preset.prompt);
  };

  const handleRunCustomPrompt = () => {
    if (!customPrompt.trim() || isGenerating) return;
    void triggerGeneration(customPrompt);
  };

  const handleApplyMessage = (msgId: string, content: string, force = false) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg?.result || !msg.result.apply_allowed || !content.trim()) return;
    // Optimistic concurrency: never replace editor text that changed after the proposal was requested.
    if (!force && draftRevision(currentDraft) !== msg.result.base_draft_revision) {
      setConflictId(msgId);
      return;
    }
    setConflictId(null);
    setUndoStack((prev) => [...prev, currentDraft].slice(-10));
    onApplyDraft(content);
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, applied: true } : m))
    );
    setAppliedToast(true);
    setTimeout(() => {
      setAppliedToast(false);
    }, 2800);
  };

  const handleCopyMessage = (msgId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUndo = () => {
    if (!undoStack.length) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack(undoStack.slice(0, -1));
    onApplyDraft(previous);
  };

  const instructionBefore = (msgId: string) => {
    const idx = messages.findIndex((m) => m.id === msgId);
    for (let i = idx - 1; i >= 0; i--) if (messages[i].role === "user") return messages[i].content;
    return "";
  };

  const handleClearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setCustomPrompt("");
    setConflictId(null);
  };

  return (
    <aside
      aria-label="Isolated AI Copilot"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "#FFFFFF",
        color: "#0F172A",
        fontFamily: "inherit",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* 1. TOP HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid #E2E8F0",
          background: "#FFFFFF",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              boxShadow: "0 2px 6px rgba(124, 58, 237, 0.25)",
            }}
          >
            <IconSparkles size={16} stroke={2} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>
                AI Reply Copilot
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "1px 6px",
                  borderRadius: 12,
                  background: "#F3E8FF",
                  color: "#7C3AED",
                  border: "1px solid #E9D5FF",
                  letterSpacing: "0.04em",
                }}
              >
                Isolated
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: "#64748B" }}>
              Targeting current email thread
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {undoStack.length > 0 && (
            <button
              onClick={handleUndo}
              title="Undo the last Copilot change to the editor"
              aria-label="Undo last applied change"
              style={{
                height: 28,
                padding: "0 8px",
                borderRadius: 6,
                border: "1px solid #E2E8F0",
                background: "#FFFFFF",
                color: "#334155",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11.5,
                fontFamily: "inherit",
              }}
            >
              <IconArrowBackUp size={14} />
              <span>Undo</span>
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              title="Reset conversation"
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: "1px solid #E2E8F0",
                background: "#FFFFFF",
                color: "#64748B",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#FEE2E2";
                e.currentTarget.style.color = "#EF4444";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#FFFFFF";
                e.currentTarget.style.color = "#64748B";
              }}
            >
              <IconTrash size={14} />
            </button>
          )}

          <button
            onClick={onClose}
            title="Close AI Copilot (Esc)"
            aria-label="Close AI Copilot"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "1px solid #E2E8F0",
              background: "#FFFFFF",
              color: "#64748B",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#F1F5F9";
              e.currentTarget.style.color = "#0F172A";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#FFFFFF";
              e.currentTarget.style.color = "#64748B";
            }}
          >
            <IconX size={15} stroke={2} />
          </button>
        </div>
      </div>

      {/* Applied Toast Notification */}
      {appliedToast && (
        <div
          style={{
            position: "absolute",
            top: 54,
            left: 14,
            right: 14,
            zIndex: 30,
            background: "#0F172A",
            color: "#FFFFFF",
            padding: "8px 12px",
            borderRadius: 8,
            boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#10B981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconCheck size={11} color="#FFFFFF" stroke={3} />
            </div>
            <span>Applied to the reply editor</span>
          </div>
          <span style={{ fontSize: 10.5, color: "#94A3B8" }}>Review, then Send</span>
        </div>
      )}

      {/* 2. CHATGPT-STYLE MIDDLE SCROLLABLE FEED */}
      <div
        style={{
          flex: "1 1 0%",
          overflowY: "auto",
          padding: "16px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Current Draft Collapsible Preview Drawer */}
        <div
          style={{
            borderRadius: 8,
            border: "1px solid #E2E8F0",
            background: "#F8FAFC",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setShowOriginalDraft(!showOriginalDraft)}
            style={{
              width: "100%",
              padding: "7px 10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              fontFamily: "inherit",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "#475569" }}>
                Current Editor Draft
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: "#64748B",
                  background: "#E2E8F0",
                  padding: "1px 5px",
                  borderRadius: 8,
                }}
              >
                {currentDraft.trim() ? `${currentDraft.trim().length} chars` : "Empty"}
              </span>
            </div>
            {showOriginalDraft ? (
              <IconChevronUp size={14} color="#64748B" />
            ) : (
              <IconChevronDown size={14} color="#64748B" />
            )}
          </button>

          {showOriginalDraft && (
            <div
              style={{
                padding: "8px 10px 10px",
                borderTop: "1px solid #E2E8F0",
                fontSize: 11.5,
                color: "#475569",
                lineHeight: 1.5,
                maxHeight: 100,
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                background: "#FFFFFF",
              }}
            >
              {currentDraft.trim() ? (
                currentDraft
              ) : (
                <span style={{ fontStyle: "italic", color: "#94A3B8" }}>
                  No text in reply editor yet. Use prompts below to draft a reply.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Empty State when no messages */}
        {messages.length === 0 && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "24px 12px",
              color: "#64748B",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "linear-gradient(135deg, #F3E8FF 0%, #EFF6FF 100%)",
                border: "1px solid #EDE9FE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#7C3AED",
                marginBottom: 12,
              }}
            >
              <IconSparkles size={22} />
            </div>
            <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "#0F172A", margin: "0 0 6px" }}>
              How can I refine this email?
            </h3>
            <p style={{ fontSize: 12, color: "#64748B", maxWidth: 280, margin: 0, lineHeight: 1.5 }}>
              Choose a preset or type an instruction. Wording changes never search your knowledge base; prices,
              specs and other facts are checked against it before they reach your draft.
            </p>
          </div>
        )}

        {/* Chat Messages Feed */}
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isUser ? "flex-end" : "flex-start",
                gap: 4,
              }}
            >
              {/* Message Bubble */}
              <div
                style={{
                  maxWidth: isUser ? "85%" : "100%",
                  padding: isUser ? "8px 12px" : "12px 14px",
                  borderRadius: isUser ? "14px 14px 2px 14px" : "12px",
                  background: isUser
                    ? "linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)"
                    : "#F8FAFC",
                  color: isUser ? "#FFFFFF" : "#1E293B",
                  border: isUser ? "none" : "1px solid #E2E8F0",
                  fontSize: 12.5,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  boxShadow: isUser
                    ? "0 2px 6px rgba(124, 58, 237, 0.2)"
                    : "0 1px 3px rgba(0,0,0,0.02)",
                }}
              >
                {!isUser && msg.result?.proposal && msg.result.message && (
                  <div
                    style={{
                      marginBottom: 10,
                      paddingBottom: 8,
                      borderBottom: "1px dashed #CBD5E1",
                      color: "#334155",
                      fontSize: 12,
                    }}
                  >
                    {msg.result.message}
                  </div>
                )}
                {msg.content}

                {/* Only what blocks a safe Apply is shown: unverified facts, or newer editor edits. */}
                {!isUser && msg.result && (msg.result.issues.length > 0 || conflictId === msg.id) && (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, whiteSpace: "normal" }}>
                    {msg.result.issues.length > 0 && (
                      <div
                        role="alert"
                        style={{
                          fontSize: 11,
                          color: "#991B1B",
                          background: "#FEF2F2",
                          border: "1px solid #FECACA",
                          borderRadius: 6,
                          padding: "5px 8px",
                          display: "flex",
                          gap: 6,
                        }}
                      >
                        <IconAlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                        <span>Cannot be applied as is. {msg.result.issues.map((i) => i.detail).join(" ")}</span>
                      </div>
                    )}
                    {conflictId === msg.id && (
                      <div
                        role="alert"
                        style={{
                          fontSize: 11,
                          color: "#1E3A8A",
                          background: "#EFF6FF",
                          border: "1px solid #BFDBFE",
                          borderRadius: 6,
                          padding: "6px 8px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <span>
                          The editor changed after this suggestion was generated. Applying it would replace your newer
                          edits.
                        </span>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => void triggerGeneration(instructionBefore(msg.id))}
                            disabled={isGenerating}
                            style={{
                              fontSize: 11,
                              padding: "3px 8px",
                              borderRadius: 5,
                              border: "1px solid #93C5FD",
                              background: "#FFFFFF",
                              color: "#1D4ED8",
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            Regenerate from current draft
                          </button>
                          <button
                            onClick={() => handleApplyMessage(msg.id, msg.content, true)}
                            style={{
                              fontSize: 11,
                              padding: "3px 8px",
                              borderRadius: 5,
                              border: "1px solid #CBD5E1",
                              background: "#FFFFFF",
                              color: "#334155",
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            Replace anyway
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Retry for errors / clarification questions */}
                {!isUser && (msg.error || msg.result?.operation === "CLARIFY") && (
                  <div style={{ marginTop: 8 }}>
                    <button
                      onClick={() => void triggerGeneration(instructionBefore(msg.id))}
                      disabled={isGenerating}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "#64748B",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                        fontWeight: 500,
                        padding: "3px 6px",
                        borderRadius: 4,
                        fontFamily: "inherit",
                      }}
                    >
                      <IconRotateClockwise size={12} />
                      <span>Retry</span>
                    </button>
                  </div>
                )}

                {/* Assistant Action Bar */}
                {!isUser && msg.result && Boolean(msg.result.proposal) && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: 10,
                      paddingTop: 8,
                      borderTop: "1px solid #E2E8F0",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: "#64748B",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 500,
                          padding: "3px 6px",
                          borderRadius: 4,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#0F172A")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#64748B")}
                      >
                        {copiedId === msg.id ? <IconCheck size={12} /> : <IconCopy size={12} />}
                        <span>{copiedId === msg.id ? "Copied" : "Copy"}</span>
                      </button>

                      <button
                        onClick={() => void triggerGeneration(instructionBefore(msg.id))}
                        disabled={isGenerating}
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: "#64748B",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 500,
                          padding: "3px 6px",
                          borderRadius: 4,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#0F172A")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#64748B")}
                      >
                        <IconRotateClockwise size={12} />
                        <span>Retry</span>
                      </button>
                    </div>

                    <button
                      onClick={() => handleApplyMessage(msg.id, msg.content)}
                      disabled={!msg.result.apply_allowed || msg.applied}
                      title={
                        msg.result.apply_allowed
                          ? "Replace the editor text with this version"
                          : "Contains unverified facts: edit manually or regenerate"
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "5px 12px",
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: "#FFFFFF",
                        background: msg.applied ? "#059669" : msg.result.apply_allowed ? "#2563EB" : "#94A3B8",
                        border: "none",
                        borderRadius: 6,
                        cursor: msg.result.apply_allowed && !msg.applied ? "pointer" : "not-allowed",
                        boxShadow: "0 1px 3px rgba(37,99,235,0.25)",
                        fontFamily: "inherit",
                        transition: "all 0.12s",
                      }}
                      onMouseEnter={(e) => {
                        if (!msg.applied && msg.result?.apply_allowed) e.currentTarget.style.background = "#1D4ED8";
                      }}
                      onMouseLeave={(e) => {
                        if (!msg.applied && msg.result?.apply_allowed) e.currentTarget.style.background = "#2563EB";
                      }}
                    >
                      <IconCheck size={13} stroke={2.5} />
                      <span>{msg.applied ? "Applied" : "Apply to Draft"}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isGenerating && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              borderRadius: 12,
              background: "#F5F3FF",
              border: "1px solid #DDD6FE",
              fontSize: 12,
              color: "#7C3AED",
              width: "fit-content",
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                border: "2px solid #C4B5FD",
                borderTopColor: "#7C3AED",
                animation: "spin 0.7s linear infinite",
              }}
            />
            <span>Working on your reply…</span>
            <button
              onClick={handleCancel}
              title="Cancel"
              aria-label="Cancel generation"
              style={{
                marginLeft: 4,
                display: "flex",
                alignItems: "center",
                gap: 3,
                border: "1px solid #DDD6FE",
                background: "#FFFFFF",
                color: "#6D28D9",
                borderRadius: 6,
                padding: "2px 6px",
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <IconPlayerStop size={11} />
              Cancel
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. FIXED POSITION BOTTOM SECTION (CHATGPT STYLE) */}
      <div
        style={{
          flexShrink: 0,
          background: "#FFFFFF",
          borderTop: "1px solid #E2E8F0",
          padding: "10px 12px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 10,
        }}
      >
        {/* Quick Presets Section (Pill Row above Prompt Input) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            overflowX: "auto",
            scrollbarWidth: "none",
            paddingBottom: 2,
          }}
        >
          {presetActions.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleRunPreset(preset)}
              disabled={isGenerating}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                borderRadius: 16,
                border: "1px solid #E2E8F0",
                background: "#F8FAFC",
                color: "#334155",
                fontSize: 11.5,
                fontWeight: 500,
                cursor: isGenerating ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                fontFamily: "inherit",
                transition: "all 0.15s ease",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                if (!isGenerating) {
                  e.currentTarget.style.background = "#FAF5FF";
                  e.currentTarget.style.borderColor = "#DDD6FE";
                  e.currentTarget.style.color = "#7C3AED";
                }
              }}
              onMouseLeave={(e) => {
                if (!isGenerating) {
                  e.currentTarget.style.background = "#F8FAFC";
                  e.currentTarget.style.borderColor = "#E2E8F0";
                  e.currentTarget.style.color = "#334155";
                }
              }}
            >
              {preset.icon}
              <span>{preset.label}</span>
            </button>
          ))}
        </div>

        {/* ChatGPT Style Prompt Textarea Capsule */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            padding: "8px 10px 8px 12px",
            borderRadius: 14,
            border: "1px solid #CBD5E1",
            background: "#FFFFFF",
            boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        >
          <textarea
            ref={promptTextareaRef}
            rows={1}
            value={customPrompt}
            onChange={(e) => {
              setCustomPrompt(e.target.value);
              // Auto-expand up to 100px
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleRunCustomPrompt();
              }
            }}
            placeholder="Ask AI to refine this reply... (Enter to send)"
            disabled={isGenerating}
            style={{
              flex: 1,
              padding: "2px 0",
              fontSize: 12.5,
              lineHeight: 1.45,
              color: "#0F172A",
              border: "none",
              outline: "none",
              background: "transparent",
              resize: "none",
              maxHeight: 100,
              fontFamily: "inherit",
            }}
            onFocus={(e) => {
              const parent = e.currentTarget.parentElement;
              if (parent) {
                parent.style.borderColor = "#7C3AED";
                parent.style.boxShadow = "0 0 0 3px rgba(124, 58, 237, 0.1)";
              }
            }}
            onBlur={(e) => {
              const parent = e.currentTarget.parentElement;
              if (parent) {
                parent.style.borderColor = "#CBD5E1";
                parent.style.boxShadow = "0 1px 4px rgba(0,0,0,0.03)";
              }
            }}
          />

          {/* ChatGPT Arrow Send / Generate Button */}
          <button
            type="button"
            onClick={handleRunCustomPrompt}
            disabled={isGenerating || !customPrompt.trim()}
            title="Generate AI Improvement (Enter)"
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              border: "none",
              background:
                customPrompt.trim() && !isGenerating
                  ? "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)"
                  : "#F1F5F9",
              color: customPrompt.trim() && !isGenerating ? "#FFFFFF" : "#94A3B8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: customPrompt.trim() && !isGenerating ? "pointer" : "default",
              transition: "all 0.15s ease",
              flexShrink: 0,
              boxShadow:
                customPrompt.trim() && !isGenerating
                  ? "0 2px 6px rgba(124, 58, 237, 0.3)"
                  : "none",
            }}
          >
            <IconArrowUp size={16} stroke={2.5} />
          </button>
        </div>

        {/* Footer Note */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 10.5,
            color: "#94A3B8",
            padding: "0 4px",
          }}
        >
          <span>Isolated to current conversation context</span>
          <span>Esc to close</span>
        </div>
      </div>
    </aside>
  );
}
