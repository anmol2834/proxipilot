"use client";

import React, { useState, useEffect, useRef } from "react";
import { Conversation } from "@/types/inbox.types";
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
    setMessages([]);
    setCustomPrompt("");
    setAppliedToast(false);
  }, [conversation?.id]);

  const recipientName = conversation?.sender?.name || "Customer";

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

  const triggerGeneration = (promptText: string, presetId?: string) => {
    const userMsgId = `user-${Date.now()}`;
    const newMessages: ChatMessage[] = [
      ...messages,
      {
        id: userMsgId,
        role: "user",
        content: promptText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ];
    setMessages(newMessages);
    setCustomPrompt("");
    setIsGenerating(true);

    setTimeout(() => {
      let resultText = "";
      const baseGreeting = `Hi ${recipientName.split(" ")[0] || recipientName},`;
      const signOff = `\n\nBest regards,\nDolphy Support Team`;

      const lower = promptText.toLowerCase();

      if (presetId === "concise" || lower.includes("concise") || lower.includes("short")) {
        resultText = `${baseGreeting}\n\nThank you for reaching out. It looks like the PO wasn't attached to your email. Could you please re-attach it and confirm the product specifications for code DSDR0099 so we can provide exact pricing right away?${signOff}`;
      } else if (presetId === "missing_po" || lower.includes("po") || lower.includes("attach")) {
        resultText = `${baseGreeting}\n\nWe received your request regarding product code DSDR0099. However, the purchase order (PO) mentioned was not attached to your message.\n\nCould you kindly re-send the attachment? Additionally, please verify the product code or share brief specifications so we can ensure you receive the accurate catalogue pricing and stock availability.${signOff}`;
      } else if (presetId === "warm" || lower.includes("warm") || lower.includes("friendly")) {
        resultText = `${baseGreeting}\n\nThanks so much for reaching out to us! We are very glad to assist you.\n\nIt seems the PO did not come through with your email. If you could kindly attach it here and let us know what specific features you need for product DSDR0099, we'll gladly prepare the best available pricing for you right away.${signOff}`;
      } else if (presetId === "professional" || lower.includes("professional") || lower.includes("formal")) {
        resultText = `${baseGreeting}\n\nThank you for contacting us regarding your product requirements.\n\nPlease note that the purchase order referenced in your inquiry was not attached. Furthermore, we would appreciate it if you could verify the product code DSDR0099 against your specifications so we may provide the formal quotation accordingly.\n\nWe look forward to your response.${signOff}`;
      } else {
        resultText = `${baseGreeting}\n\nThank you for your message. Per your note (${promptText.trim()}):\n\nPlease note the purchase order appears to be missing from the attachment list. Kindly re-attach the document along with the required specifications for DSDR0099, and our team will immediately issue an updated quotation.${signOff}`;
      }

      const asstMsgId = `asst-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: asstMsgId,
          role: "assistant",
          content: resultText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setIsGenerating(false);
    }, 850);
  };

  const handleRunPreset = (preset: PresetAction) => {
    if (isGenerating) return;
    triggerGeneration(preset.prompt, preset.id);
  };

  const handleRunCustomPrompt = () => {
    if (!customPrompt.trim() || isGenerating) return;
    triggerGeneration(customPrompt);
  };

  const handleApplyMessage = (msgId: string, content: string) => {
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

  const handleClearChat = () => {
    setMessages([]);
    setCustomPrompt("");
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
            <span>Applied to reply editor draft!</span>
          </div>
          <span style={{ fontSize: 10.5, color: "#94A3B8" }}>Ready to send</span>
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
              Choose a quick preset below or type a custom instruction to rephrase, condense, or polish your reply.
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
                {msg.content}

                {/* Assistant Action Bar */}
                {!isUser && (
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
                        onClick={() => triggerGeneration(msg.content)}
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
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "5px 12px",
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: "#FFFFFF",
                        background: msg.applied ? "#059669" : "#2563EB",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        boxShadow: "0 1px 3px rgba(37,99,235,0.25)",
                        fontFamily: "inherit",
                        transition: "all 0.12s",
                      }}
                      onMouseEnter={(e) => {
                        if (!msg.applied) e.currentTarget.style.background = "#1D4ED8";
                      }}
                      onMouseLeave={(e) => {
                        if (!msg.applied) e.currentTarget.style.background = "#2563EB";
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
            <span>Refining reply with AI...</span>
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
