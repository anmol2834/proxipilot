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
  IconInfoCircle,
  IconChevronDown,
  IconChevronUp,
  IconArrowRight,
  IconUser,
  IconCornerDownLeft,
} from "@tabler/icons-react";

export interface IsolatedAiPromptBoxProps {
  isOpen: boolean;
  conversation: Conversation | null;
  currentDraft: string;
  onApplyDraft: (text: string) => void;
  onClose: () => void;
}

type ToneType = "professional" | "formal" | "friendly" | "concise" | "persuasive";
type LengthType = "brief" | "balanced" | "detailed";

interface PresetAction {
  id: string;
  label: string;
  description: string;
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
  const [selectedTone, setSelectedTone] = useState<ToneType>("professional");
  const [selectedLength, setSelectedLength] = useState<LengthType>("balanced");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState<string>("");
  const [generatedResult, setGeneratedResult] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [showOriginalDraft, setShowOriginalDraft] = useState(false);
  const [copied, setCopied] = useState(false);
  const [appliedToast, setAppliedToast] = useState(false);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);

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

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        promptTextareaRef.current?.focus();
      }, 350);
    }
  }, [isOpen]);

  // Reset generated state when conversation changes
  useEffect(() => {
    setGeneratedResult(null);
    setActivePreset(null);
    setCustomPrompt("");
    setAppliedToast(false);
  }, [conversation?.id]);

  const recipientName = conversation?.sender?.name || "Customer";
  const recipientEmail = conversation?.sender?.email || "unknown@domain.com";
  const subject = conversation?.subject || "Email inquiry";

  const presetActions: PresetAction[] = [
    {
      id: "concise",
      label: "Make it concise",
      description: "Trim fluff while preserving key points",
      icon: <IconBolt size={14} color="#2563EB" />,
      prompt: "Condense this reply into 2-3 crisp, actionable sentences without losing key details.",
    },
    {
      id: "professional",
      label: "Professional polish",
      description: "Elevate tone to executive corporate standard",
      icon: <IconShieldCheck size={14} color="#7C3AED" />,
      prompt: "Polish the tone to be highly professional, reassuring, and articulate.",
    },
    {
      id: "missing_po",
      label: "Clarify missing PO & specs",
      description: "Politely request the missing attachment & product code",
      icon: <IconWand size={14} color="#059669" />,
      prompt: "Politely clarify that the PO attachment was not detected and ask them to share product specs or model details.",
    },
    {
      id: "warm",
      label: "Warm & customer-first",
      description: "Build rapport with friendly, helpful phrasing",
      icon: <IconSparkles size={14} color="#D97706" />,
      prompt: "Rephrase with a warm, empathetic tone ensuring the customer feels valued and prioritized.",
    },
  ];

  const handleRunPreset = (preset: PresetAction) => {
    setActivePreset(preset.id);
    setCustomPrompt(preset.prompt);
    triggerGeneration(preset.prompt, preset.id);
  };

  const handleRunCustomPrompt = () => {
    if (!customPrompt.trim()) return;
    triggerGeneration(customPrompt, "custom");
  };

  const triggerGeneration = (promptText: string, sourceId: string) => {
    setIsGenerating(true);
    setGenerationStage("Analyzing thread context & recipient...");

    // Stage 1
    setTimeout(() => {
      setGenerationStage("Grounding with workspace product catalog & memory...");
    }, 400);

    // Stage 2
    setTimeout(() => {
      setGenerationStage("Synthesizing evidence-gated draft...");
    }, 850);

    // Stage 3: Complete simulated intelligent generation tailored to the conversation
    setTimeout(() => {
      setIsGenerating(false);
      setGenerationStage("");

      let resultText = "";
      const baseGreeting = `Hi ${recipientName.split(" ")[0] || recipientName},`;
      const signOff = `\n\nBest regards,\nDolphy Support Team`;

      if (sourceId === "concise") {
        resultText = `${baseGreeting}\n\nThank you for reaching out. It looks like the PO wasn't attached to your email. Could you please re-attach it and confirm the product specifications for code DSDR0099 so we can provide exact pricing right away?${signOff}`;
      } else if (sourceId === "missing_po") {
        resultText = `${baseGreeting}\n\nWe received your request regarding product code DSDR0099. However, the purchase order (PO) mentioned was not attached to your message.\n\nCould you kindly re-send the attachment? Additionally, please verify the product code or share brief specifications so we can ensure you receive the accurate catalogue pricing and stock availability.${signOff}`;
      } else if (sourceId === "warm") {
        resultText = `${baseGreeting}\n\nThanks so much for reaching out to us! We are very glad to assist you.\n\nIt seems the PO did not come through with your email. If you could kindly attach it here and let us know what specific features you need for product DSDR0099, we'll gladly prepare the best available pricing for you right away.${signOff}`;
      } else if (selectedTone === "formal" || sourceId === "professional") {
        resultText = `${baseGreeting}\n\nThank you for contacting us regarding your product requirements.\n\nPlease note that the purchase order referenced in your inquiry was not attached. Furthermore, we would appreciate it if you could verify the product code DSDR0099 against your specifications so we may provide the formal quotation accordingly.\n\nWe look forward to your response.${signOff}`;
      } else {
        // Custom or default
        const promptNote = promptText.trim()
          ? `Per your note: "${promptText.trim()}".`
          : "";
        resultText = `${baseGreeting}\n\nThank you for your message. ${promptNote}\n\nPlease note the purchase order appears to be missing from the attachment list. Kindly re-attach the document along with the required unit quantity for model DSDR0099, and our team will immediately issue an updated quotation.${signOff}`;
      }

      setGeneratedResult(resultText);
    }, 1250);
  };

  const handleApply = () => {
    if (!generatedResult) return;
    onApplyDraft(generatedResult);
    setAppliedToast(true);
    setTimeout(() => {
      setAppliedToast(false);
    }, 2800);
  };

  const handleCopy = () => {
    if (!generatedResult) return;
    navigator.clipboard.writeText(generatedResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: "1px solid #E2E8F0",
          background: "linear-gradient(180deg, #FAF5FF 0%, #FFFFFF 100%)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              boxShadow: "0 2px 6px rgba(124, 58, 237, 0.3)",
            }}
          >
            <IconSparkles size={17} stroke={2} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", letterSpacing: "-0.01em" }}>
                AI Reply Copilot
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "2px 7px",
                  borderRadius: 20,
                  background: "#F3E8FF",
                  color: "#7C3AED",
                  border: "1px solid #E9D5FF",
                  letterSpacing: "0.04em",
                }}
              >
                Isolated
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 11.5, color: "#64748B" }}>
              Thread-scoped intelligence & tone tuning
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          title="Close AI Copilot (Esc)"
          aria-label="Close AI Copilot"
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
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
          <IconX size={16} stroke={2} />
        </button>
      </div>

      {/* Applied Toast Notification */}
      {appliedToast && (
        <div
          style={{
            position: "absolute",
            top: 60,
            left: 16,
            right: 16,
            zIndex: 30,
            background: "#0F172A",
            color: "#FFFFFF",
            padding: "8px 14px",
            borderRadius: 8,
            boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 12.5,
            fontWeight: 500,
            animation: "slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#10B981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconCheck size={12} color="#FFFFFF" stroke={3} />
            </div>
            <span>Applied to reply editor draft!</span>
          </div>
          <span style={{ fontSize: 11, color: "#94A3B8" }}>Ready to review & send</span>
        </div>
      )}

      {/* Scrollable Content Body */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Context Target Card (Proof of Isolation) */}
        <div
          style={{
            borderRadius: 10,
            border: "1px solid #EDE9FE",
            background: "linear-gradient(135deg, #FAF5FF 0%, #F5F3FF 100%)",
            padding: "12px 14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "#7C3AED",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {recipientName.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#0F172A",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {recipientName}
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: "#059669",
                    background: "#D1FAE5",
                    padding: "2px 6px",
                    borderRadius: 4,
                  }}
                >
                  Active Target
                </span>
              </div>
              <p
                style={{
                  margin: "1px 0 0",
                  fontSize: 11.5,
                  color: "#64748B",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {subject}
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 6,
                  fontSize: 11,
                  color: "#7C3AED",
                  fontWeight: 500,
                }}
              >
                <IconShieldCheck size={13} />
                <span>Isolated thread context: external conversations will not be accessed.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Current Draft Preview Drawer */}
        <div
          style={{
            borderRadius: 9,
            border: "1px solid #E2E8F0",
            background: "#F8FAFC",
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => setShowOriginalDraft(!showOriginalDraft)}
            style={{
              width: "100%",
              padding: "9px 12px",
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
              <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
                Current Editor Draft
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  color: "#64748B",
                  background: "#E2E8F0",
                  padding: "1px 6px",
                  borderRadius: 10,
                }}
              >
                {currentDraft.trim() ? `${currentDraft.trim().length} chars` : "Empty"}
              </span>
            </div>
            {showOriginalDraft ? (
              <IconChevronUp size={15} color="#64748B" />
            ) : (
              <IconChevronDown size={15} color="#64748B" />
            )}
          </button>

          {showOriginalDraft && (
            <div
              style={{
                padding: "8px 12px 12px",
                borderTop: "1px solid #E2E8F0",
                fontSize: 12,
                color: "#475569",
                lineHeight: 1.5,
                maxHeight: 120,
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                background: "#FFFFFF",
              }}
            >
              {currentDraft.trim() ? (
                currentDraft
              ) : (
                <span style={{ fontStyle: "italic", color: "#94A3B8" }}>
                  No draft text in editor. Use the prompts below to generate a reply from scratch.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Quick Action Presets */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Quick Presets
            </span>
            <span style={{ fontSize: 11, color: "#94A3B8" }}>One-click refine</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {presetActions.map((preset) => {
              const isSelected = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleRunPreset(preset)}
                  disabled={isGenerating}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 3,
                    padding: "9px 10px",
                    borderRadius: 8,
                    border: `1px solid ${isSelected ? "#7C3AED" : "#E2E8F0"}`,
                    background: isSelected ? "#FAF5FF" : "#FFFFFF",
                    cursor: isGenerating ? "not-allowed" : "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected && !isGenerating) {
                      e.currentTarget.style.borderColor = "#CBD5E1";
                      e.currentTarget.style.background = "#F8FAFC";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && !isGenerating) {
                      e.currentTarget.style.borderColor = "#E2E8F0";
                      e.currentTarget.style.background = "#FFFFFF";
                    }
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {preset.icon}
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: isSelected ? "#7C3AED" : "#0F172A",
                      }}
                    >
                      {preset.label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 10.5,
                      color: "#64748B",
                      lineHeight: 1.3,
                    }}
                  >
                    {preset.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Isolated Instruction Box */}
        <div>
          <label
            htmlFor="custom-ai-prompt"
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 700,
              color: "#334155",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              marginBottom: 6,
            }}
          >
            Custom Prompt Instruction
          </label>
          <div
            style={{
              position: "relative",
              borderRadius: 10,
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}
          >
            <textarea
              id="custom-ai-prompt"
              ref={promptTextareaRef}
              rows={3}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="E.g. Tell Suttter we found an alternate model in stock at 15% discount, and ask for delivery timeline..."
              disabled={isGenerating}
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 13,
                color: "#0F172A",
                lineHeight: 1.5,
                border: "none",
                outline: "none",
                background: "transparent",
                resize: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  parent.style.borderColor = "#7C3AED";
                  parent.style.boxShadow = "0 0 0 3px rgba(124, 58, 237, 0.12)";
                }
              }}
              onBlur={(e) => {
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  parent.style.borderColor = "#CBD5E1";
                  parent.style.boxShadow = "0 1px 3px rgba(0,0,0,0.03)";
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleRunCustomPrompt();
                }
              }}
            />

            {/* Quick Prompt Pills */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 5,
                padding: "4px 10px 8px",
                borderTop: "1px dashed #F1F5F9",
              }}
            >
              {[
                "Re-request PO",
                "Suggest similar code",
                "Offer 10% discount",
                "Ask phone call time",
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setCustomPrompt(chip)}
                  style={{
                    fontSize: 10.5,
                    color: "#475569",
                    background: "#F1F5F9",
                    border: "1px solid #E2E8F0",
                    borderRadius: 12,
                    padding: "2px 8px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.12s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#EDE9FE";
                    e.currentTarget.style.color = "#7C3AED";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#F1F5F9";
                    e.currentTarget.style.color = "#475569";
                  }}
                >
                  +{chip}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tone & Style Config Pills */}
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <span
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                color: "#64748B",
                marginBottom: 4,
              }}
            >
              Tone
            </span>
            <div
              style={{
                display: "flex",
                background: "#F1F5F9",
                borderRadius: 7,
                padding: 2,
              }}
            >
              {(["professional", "friendly", "concise"] as ToneType[]).map((tone) => (
                <button
                  key={tone}
                  onClick={() => setSelectedTone(tone)}
                  style={{
                    flex: 1,
                    padding: "4px 0",
                    fontSize: 11,
                    fontWeight: selectedTone === tone ? 600 : 500,
                    textTransform: "capitalize",
                    border: "none",
                    borderRadius: 5,
                    cursor: "pointer",
                    background: selectedTone === tone ? "#FFFFFF" : "transparent",
                    color: selectedTone === tone ? "#0F172A" : "#64748B",
                    boxShadow: selectedTone === tone ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                    transition: "all 0.12s",
                  }}
                >
                  {tone}
                </button>
              ))}
            </div>
          </div>

          <div style={{ width: 130 }}>
            <span
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                color: "#64748B",
                marginBottom: 4,
              }}
            >
              Length
            </span>
            <div
              style={{
                display: "flex",
                background: "#F1F5F9",
                borderRadius: 7,
                padding: 2,
              }}
            >
              {(["brief", "balanced"] as LengthType[]).map((len) => (
                <button
                  key={len}
                  onClick={() => setSelectedLength(len)}
                  style={{
                    flex: 1,
                    padding: "4px 0",
                    fontSize: 11,
                    fontWeight: selectedLength === len ? 600 : 500,
                    textTransform: "capitalize",
                    border: "none",
                    borderRadius: 5,
                    cursor: "pointer",
                    background: selectedLength === len ? "#FFFFFF" : "transparent",
                    color: selectedLength === len ? "#0F172A" : "#64748B",
                    boxShadow: selectedLength === len ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                    transition: "all 0.12s",
                  }}
                >
                  {len}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Generate / Run Action Button */}
        <button
          onClick={handleRunCustomPrompt}
          disabled={isGenerating || (!customPrompt.trim() && !currentDraft.trim())}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            width: "100%",
            padding: "10px 16px",
            borderRadius: 9,
            border: "none",
            background:
              isGenerating || (!customPrompt.trim() && !currentDraft.trim())
                ? "#E2E8F0"
                : "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)",
            color:
              isGenerating || (!customPrompt.trim() && !currentDraft.trim())
                ? "#94A3B8"
                : "#FFFFFF",
            fontSize: 13,
            fontWeight: 600,
            cursor:
              isGenerating || (!customPrompt.trim() && !currentDraft.trim())
                ? "not-allowed"
                : "pointer",
            boxShadow:
              isGenerating || (!customPrompt.trim() && !currentDraft.trim())
                ? "none"
                : "0 2px 8px rgba(124, 58, 237, 0.28)",
            transition: "all 0.15s ease",
            fontFamily: "inherit",
          }}
        >
          <IconSparkles size={16} />
          <span>{isGenerating ? "Refining with AI..." : "Generate AI Improvement"}</span>
        </button>

        {/* Loading state bar */}
        {isGenerating && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "#F5F3FF",
              border: "1px solid #DDD6FE",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#7C3AED",
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
            <span>{generationStage}</span>
          </div>
        )}

        {/* Improved Result Card */}
        {generatedResult && (
          <div
            style={{
              borderRadius: 10,
              border: "1px solid #C7D2FE",
              background: "#FFFFFF",
              boxShadow: "0 4px 12px rgba(99, 102, 241, 0.08)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                background: "linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)",
                borderBottom: "1px solid #E0E7FF",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <IconSparkles size={14} color="#4F46E5" />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#3730A3" }}>
                  AI Suggestion Ready
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  onClick={handleCopy}
                  title="Copy to clipboard"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "#6366F1",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 6px",
                    borderRadius: 4,
                  }}
                >
                  {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>

            <div
              style={{
                padding: "12px 14px",
                fontSize: 12.5,
                lineHeight: 1.6,
                color: "#1E293B",
                whiteSpace: "pre-wrap",
                background: "#FAFAFA",
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {generatedResult}
            </div>

            <div
              style={{
                padding: "10px 14px",
                borderTop: "1px solid #E2E8F0",
                background: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <button
                onClick={() => setGeneratedResult(null)}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  color: "#64748B",
                  background: "transparent",
                  border: "1px solid #E2E8F0",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Discard
              </button>

              <button
                onClick={handleApply}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 16px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#FFFFFF",
                  background: "#2563EB",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(37,99,235,0.3)",
                  fontFamily: "inherit",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1D4ED8")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#2563EB")}
              >
                <IconCheck size={14} stroke={2.5} />
                <span>Apply to Reply Editor</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Footer Guarantee Bar */}
      <div
        style={{
          padding: "10px 18px",
          borderTop: "1px solid #E2E8F0",
          background: "#F8FAFC",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11,
          color: "#64748B",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <IconShieldCheck size={13} color="#059669" />
          <span>Evidence-gated generation</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, background: "#E2E8F0", padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>
            Esc
          </span>
          <span>to close</span>
        </div>
      </div>
    </aside>
  );
}
