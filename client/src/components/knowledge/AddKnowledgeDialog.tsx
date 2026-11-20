"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import LinearProgress from "@mui/material/LinearProgress";
import { isUploadBusy, useKnowledgeStore } from "@/stores/knowledge.store";
import { ConcreteKnowledgeCategory, KnowledgeItemType } from "@/types/knowledge.types";

interface CategoryOption {
  id: ConcreteKnowledgeCategory;
  name: string;
  type: KnowledgeItemType;
  desc: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    id: "company-info",
    name: "Company Info",
    type: "Information",
    desc: "Add details about your organization, mission, team, and background.",
    iconBg: "#EEF2FF",
    iconColor: "#3B82F6",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="16" height="20" x="4" y="2" rx="2" />
        <path d="M9 22v-4h6v4" />
        <path d="M8 6h.01" />
        <path d="M16 6h.01" />
        <path d="M8 10h.01" />
        <path d="M16 10h.01" />
        <path d="M8 14h.01" />
        <path d="M16 14h.01" />
      </svg>
    ),
  },
  {
    id: "products-services",
    name: "Products & Services",
    type: "Service",
    desc: "Add your products or services, features, specifications, pricing, and availability.",
    iconBg: "#EFF6FF",
    iconColor: "#2563EB",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
      </svg>
    ),
  },
  {
    id: "contacts",
    name: "Contacts",
    type: "Contact",
    desc: "Add key people, team members, and contact details.",
    iconBg: "#ECFDF5",
    iconColor: "#10B981",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: "policies",
    name: "Policies",
    type: "Policy",
    desc: "Add refund, cancellation, warranty, and other business policies.",
    iconBg: "#FEF2F2",
    iconColor: "#EF4444",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    id: "support-faqs",
    name: "Support & FAQs",
    type: "FAQ",
    desc: "Add common questions and their answers.",
    iconBg: "#F0F9FF",
    iconColor: "#0284C7",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    id: "offers-promotions",
    name: "Offers & Promotions",
    type: "Offer",
    desc: "Add current offers, discounts, and campaigns.",
    iconBg: "#FFFBEB",
    iconColor: "#F59E0B",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 12 20 22 4 22 4 12" />
        <rect width="20" height="5" x="2" y="7" rx="1" />
        <line x1="12" y1="22" x2="12" y2="7" />
        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
      </svg>
    ),
  },
  {
    id: "operations",
    name: "Operations",
    type: "Process",
    desc: "Add internal processes, workflows, and how things work.",
    iconBg: "#ECFDF5",
    iconColor: "#10B981",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    id: "locations",
    name: "Locations",
    type: "Information",
    desc: "Add your business locations, service areas, and coverage details.",
    iconBg: "#F5F3FF",
    iconColor: "#6366F1",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    id: "brand-communication",
    name: "Brand & Communication",
    type: "Guideline",
    desc: "Add your brand voice, tone, messaging guidelines, and communication preferences.",
    iconBg: "#EFF6FF",
    iconColor: "#3B82F6",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <circle cx="8" cy="10" r="1" fill="#3B82F6" />
        <circle cx="12" cy="10" r="1" fill="#3B82F6" />
        <circle cx="16" cy="10" r="1" fill="#3B82F6" />
      </svg>
    ),
  },
];

/** Format bytes → "1.4 MB" / "340 KB" */
function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function AddKnowledgeModalContent({
  initialCategory,
  onClose,
}: {
  initialCategory: ConcreteKnowledgeCategory | null;
  onClose: () => void;
}) {
  // addKnowledgeItem no longer needed — uploads go through uploadAndImport

  // ── Upload store state ───────────────────────────────────────────────────
  const { upload, uploadAndImport, resetUpload } = useKnowledgeStore();

  // If an import is already running in the background, reopening the dialog shows it.
  const resumedCategory =
    isUploadBusy(upload) && upload.category
      ? (upload.category as ConcreteKnowledgeCategory)
      : null;
  const startCategory = initialCategory || resumedCategory;

  // Mode: "category-select" (9 cards view) vs "file-upload" (3-step import view)
  const [activeMode, setActiveMode] = useState<"category-select" | "file-upload">(
    startCategory ? "file-upload" : "category-select"
  );
  const [selectedCategory, setSelectedCategory] = useState<ConcreteKnowledgeCategory | null>(
    startCategory || null
  );

  // ── Local file/form state ────────────────────────────────────────────────
  const [datasetName, setDatasetName] = useState<string>(() => {
    if (isUploadBusy(upload) && upload.datasetName) return upload.datasetName;
    if (initialCategory) {
      const catName = CATEGORY_OPTIONS.find((c) => c.id === initialCategory)?.name || "Knowledge";
      return `My ${catName}`;
    }
    return "";
  });
  // Store the actual File object — never just metadata
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive convenience booleans from store upload phase
  const isUploading = upload.phase === "uploading";
  const isProcessing = upload.phase === "processing";
  const isBusy = isUploading || isProcessing;
  const isDone = upload.phase === "done";
  const isError = upload.phase === "error";

  // Auto-close dialog 1.2 s after success
  useEffect(() => {
    if (isDone) {
      const t = setTimeout(() => {
        onClose();
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [isDone, onClose]);

  // Reset upload state whenever the dialog unmounts (unless an import just completed and post-fetch is in flight)
  useEffect(() => () => {
    if (useKnowledgeStore.getState().upload.phase !== "done") {
      resetUpload();
    }
  }, [resetUpload]);

  const currentCatOption =
    (selectedCategory && CATEGORY_OPTIONS.find((c) => c.id === selectedCategory)) ||
    (initialCategory && CATEGORY_OPTIONS.find((c) => c.id === initialCategory)) ||
    CATEGORY_OPTIONS[0];

  const handleSelectCategoryCard = (cat: ConcreteKnowledgeCategory) => {
    setSelectedCategory(cat);
    const catName = CATEGORY_OPTIONS.find((c) => c.id === cat)?.name || "Knowledge";
    setDatasetName(`My ${catName}`);
    setSelectedFile(null);
    resetUpload();
    setActiveMode("file-upload");
  };

  const handleFileChosen = (file: File) => {
    // Validate extension client-side before sending
    const allowed = [".csv", ".xls", ".xlsx"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      alert(`Unsupported file type "${ext}". Please use CSV, XLS, or XLSX.`);
      return;
    }
    // Max 10 MB guard
    if (file.size > 10 * 1024 * 1024) {
      alert("File exceeds the 10 MB limit. Please upload a smaller file.");
      return;
    }
    setSelectedFile(file);
    resetUpload();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChosen(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    resetUpload();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /** Two-phase enterprise import: XHR upload → job poll */
  const handleConfirmImport = useCallback(async () => {
    if (!selectedFile || isBusy) return;
    const catId = selectedCategory || currentCatOption.id;
    const name = datasetName.trim() || currentCatOption.name;
    try {
      await uploadAndImport(selectedFile, name, catId);
      // Auto-close handled by useEffect watching isDone
    } catch {
      // Error is stored in upload.errorMessage — UI shows it inline
    }
  }, [selectedFile, isBusy, selectedCategory, currentCatOption, datasetName, uploadAndImport]);

  // ── Progress / Status overlay rendered inside the form area ─────────────
  const renderProgressPanel = () => {
    if (upload.phase === "idle") return null;

    const getStageLabel = () => {
      if (upload.phase === "uploading") return "Uploading file...";
      if (upload.phase === "done") return "Import complete!";
      if (upload.phase === "error") return upload.errorMessage ?? "Import failed";

      switch (upload.currentStage) {
        case "parsing": return "Parsing & analyzing dataset...";
        case "schema_detection": return "Detecting schema & mapping columns...";
        case "mapping": return "Compiling attribute mappings...";
        case "validating": return "Validating data quality...";
        case "importing": return "Saving records to database...";
        case "projecting": return "Generating embeddings & vector indexing...";
        case "completed": return "Import complete!";
        default: return "Processing & indexing...";
      }
    };

    const phaseMeta: Record<string, { label: string; color: string; bg: string; border: string }> = {
      uploading:  { label: "Uploading file...",          color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
      processing: { label: getStageLabel(),              color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
      done:       { label: "Import complete!",            color: "#059669", bg: "#F0FDF4", border: "#BBF7D0" },
      error:      { label: upload.errorMessage ?? "Import failed", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
    };
    const meta = phaseMeta[upload.phase];
    if (!meta) return null;

    const progress = isUploading
      ? upload.uploadProgress
      : isProcessing
      ? upload.processingProgress
      : isDone
      ? 100
      : 0;

    return (
      <Box
        sx={{
          mt: 2,
          p: 2.5,
          borderRadius: "14px",
          backgroundColor: meta.bg,
          border: `1.5px solid ${meta.border}`,
          transition: "all 200ms ease",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {isDone ? (
              <Box
                sx={{
                  width: 22, height: 22, borderRadius: "50%",
                  backgroundColor: "#059669",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </Box>
            ) : isError ? (
              <Box sx={{ color: "#DC2626" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </Box>
            ) : (
              <Box sx={{ width: 20, height: 20, position: "relative" }}>
                <svg style={{ animation: "spin 1s linear infinite" }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              </Box>
            )}
            <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: meta.color }}>
              {meta.label}
            </Typography>
          </Box>
          {(isUploading || isProcessing) && (
            <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: meta.color }}>
              {progress}%
            </Typography>
          )}
        </Box>

        {!isError && (
          <LinearProgress
            variant={progress > 0 ? "determinate" : "indeterminate"}
            value={progress}
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: `${meta.color}20`,
              "& .MuiLinearProgress-bar": { backgroundColor: meta.color, borderRadius: 3 },
            }}
          />
        )}

        {isProcessing && upload.rowCount && (
          <Typography sx={{ fontSize: "0.72rem", color: "#6D28D9", mt: 1 }}>
            {upload.processedRows.toLocaleString()} / {upload.rowCount.toLocaleString()} records indexed
          </Typography>
        )}

        {isError && (
          <Button
            size="small"
            onClick={() => { resetUpload(); }}
            sx={{
              mt: 1, textTransform: "none", fontSize: "0.76rem",
              fontWeight: 700, color: "#DC2626",
              border: "1px solid #FCA5A5", borderRadius: "7px",
              px: 1.5, py: 0.4,
              "&:hover": { backgroundColor: "#FEE2E2" },
            }}
          >
            Dismiss &amp; retry
          </Button>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, height: "100%", overflow: "hidden", position: "relative" }}>
      {/* ========================================================================= */}
      {/* VIEW 1: "What would you like to add?" (COMPACT CATEGORY SELECTION)         */}
      {/* ========================================================================= */}
      {activeMode === "category-select" && (
        <>
          {/* Top Header */}
          <Box
            sx={{
              p: { xs: 2, md: "24px 32px 14px 32px" },
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <Box>
              <Typography
                sx={{
                  color: "#3B82F6",
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  mb: 0.5,
                }}
              >
                ADD KNOWLEDGE
              </Typography>
              <Typography
                sx={{
                  color: "#0F172A",
                  fontSize: { xs: "1.35rem", md: "1.6rem" },
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                }}
              >
                What would you like to add?
              </Typography>
              <Typography sx={{ color: "#64748B", fontSize: "0.85rem", mt: 0.5, maxWidth: "620px" }}>
                Choose a category to add the right type of information. This helps ProxiPilot understand your business better.
              </Typography>
            </Box>

            {/* Close Button */}
            <IconButton
              onClick={onClose}
              size="small"
              aria-label="Close dialog"
              sx={{
                color: "#94A3B8",
                p: 1,
                borderRadius: "50%",
                transition: "all 150ms ease",
                "&:hover": {
                  backgroundColor: "#F1F5F9",
                  color: "#334155",
                },
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </IconButton>
          </Box>

          {/* Body: 3x3 Cards Grid (Title only, no description) + Right Promotional Card */}
          <DialogContent
            sx={{
              px: { xs: 2.5, md: 4 },
              py: { xs: 1, md: 1.5 },
              flex: "1 1 auto",
              minHeight: 0,
              overflowY: "auto",
            }}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", lg: "1fr 310px" },
                gap: 2.5,
                alignItems: "stretch",
              }}
            >
              {/* Left 3x3 Cards Grid */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
                  gap: 1.5,
                }}
              >
                {CATEGORY_OPTIONS.map((cat) => {
                  const isSelected = selectedCategory === cat.id;

                  return (
                    <Paper
                      key={cat.id}
                      elevation={0}
                      onClick={() => handleSelectCategoryCard(cat.id)}
                      sx={{
                        p: "14px 16px",
                        borderRadius: "14px",
                        border: isSelected ? "2px solid #2563EB" : "1px solid #E2E8F0",
                        backgroundColor: isSelected ? "#F8FAFC" : "#FFFFFF",
                        boxShadow: isSelected
                          ? "0 4px 14px rgba(37, 99, 235, 0.08)"
                          : "0 1px 2px rgba(0,0,0,0.02)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        transition: "all 180ms cubic-bezier(0.4, 0, 0.2, 1)",
                        "&:hover": {
                          borderColor: "#2563EB",
                          backgroundColor: "#F8FAFC",
                          boxShadow: "0 4px 16px rgba(37, 99, 235, 0.10)",
                          transform: "translateY(-2px)",
                          "& .cat-chevron": {
                            color: "#2563EB",
                            transform: "translateX(2px)",
                          },
                        },
                      }}
                    >
                      {/* Icon */}
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: "10px",
                          backgroundColor: cat.iconBg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {cat.icon}
                      </Box>

                      {/* Title (Only Title shown, no description) */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          sx={{
                            fontSize: "0.88rem",
                            fontWeight: 650,
                            color: "#0F172A",
                            lineHeight: 1.25,
                          }}
                        >
                          {cat.name}
                        </Typography>
                      </Box>

                      {/* Right Chevron */}
                      <Typography
                        className="cat-chevron"
                        component="span"
                        sx={{
                          color: isSelected ? "#2563EB" : "#94A3B8",
                          fontSize: "1.15rem",
                          fontWeight: 500,
                          lineHeight: 1,
                          flexShrink: 0,
                          transition: "all 150ms ease",
                        }}
                      >
                        ›
                      </Typography>
                    </Paper>
                  );
                })}
              </Box>

              {/* Right Side Info Card */}
              <Box
                sx={{
                  background: "linear-gradient(180deg, #F0F5FF 0%, #EEF2FF 100%)",
                  border: "1px solid #DBEAFE",
                  borderRadius: "18px",
                  p: { xs: 2.25, md: 2.5 },
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <Box>
                  {/* Floating Document Graphic */}
                  <Box
                    sx={{
                      width: "100%",
                      height: 92,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                      mb: 1.5,
                    }}
                  >
                    <Box
                      sx={{
                        position: "absolute",
                        width: 120,
                        height: 65,
                        borderRadius: "50%",
                        background: "radial-gradient(circle, rgba(191, 219, 254, 0.6) 0%, rgba(238, 242, 255, 0) 70%)",
                      }}
                    />
                    {/* Back Paper */}
                    <Box
                      sx={{
                        position: "absolute",
                        width: 110,
                        height: 72,
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        borderRadius: "8px",
                        transform: "rotate(-6deg) translate(-8px, -3px)",
                        boxShadow: "0 4px 12px rgba(15, 23, 42, 0.04)",
                        opacity: 0.75,
                      }}
                    />
                    {/* Front Paper with skeleton lines and sparkle badge */}
                    <Box
                      sx={{
                        position: "absolute",
                        width: 124,
                        height: 80,
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #DBEAFE",
                        borderRadius: "10px",
                        boxShadow: "0 8px 20px rgba(37, 99, 235, 0.08)",
                        p: 1.25,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Box sx={{ width: 36, height: 5, backgroundColor: "#E2E8F0", borderRadius: "3px", mt: 0.5 }} />
                        <Box
                          sx={{
                            width: 22,
                            height: 22,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/Proxipilot logo.svg"
                            alt="ProxiPilot"
                            width={20}
                            height={20}
                            style={{ objectFit: "contain", display: "block" }}
                          />
                        </Box>
                      </Box>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.65 }}>
                        <Box sx={{ width: "80%", height: 4, backgroundColor: "#EEF2F6", borderRadius: "2px" }} />
                        <Box sx={{ width: "65%", height: 4, backgroundColor: "#EEF2F6", borderRadius: "2px" }} />
                        <Box sx={{ width: "45%", height: 4, backgroundColor: "#EEF2F6", borderRadius: "2px" }} />
                      </Box>
                    </Box>
                  </Box>

                  {/* Right Title */}
                  <Typography
                    sx={{
                      fontSize: "0.98rem",
                      fontWeight: 800,
                      color: "#0F172A",
                      lineHeight: 1.3,
                      mb: 1.5,
                    }}
                  >
                    Turn your business knowledge into smarter conversations.
                  </Typography>

                  {/* Feature Bullet List */}
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.1, mb: 2 }}>
                    {[
                      "More accurate AI responses",
                      "Consistent and on-brand communication",
                      "Better customer support",
                      "Save time for your team",
                    ].map((benefit) => (
                      <Box key={benefit} sx={{ display: "flex", alignItems: "center", gap: 1.1 }}>
                        <Box
                          sx={{
                            width: 17,
                            height: 17,
                            borderRadius: "50%",
                            backgroundColor: "#2563EB",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </Box>
                        <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#1E293B" }}>
                          {benefit}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>

                {/* Bottom Testimonial Quote Card */}
                <Box
                  sx={{
                    pt: 1.5,
                    borderTop: "1px solid rgba(219, 234, 254, 0.7)",
                    display: "flex",
                    gap: 1,
                  }}
                >
                  <Typography sx={{ color: "#93C5FD", fontSize: "1.35rem", lineHeight: 0.8, fontFamily: "serif", fontWeight: 700 }}>
                    “
                  </Typography>
                  <Box>
                    <Typography sx={{ fontSize: "0.74rem", color: "#334155", lineHeight: 1.4, fontWeight: 500 }}>
                      &ldquo;Well-organized knowledge helps us give faster, more relevant answers to our customers.&rdquo;
                    </Typography>
                    <Typography sx={{ fontSize: "0.7rem", color: "#64748B", fontWeight: 500, mt: 0.25 }}>
                      — Early Access User
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </DialogContent>

          {/* Bottom Footer Bar */}
          <Box
            sx={{
              borderTop: "1px solid #F1F5F9",
              backgroundColor: "#FFFFFF",
              px: { xs: 2.5, md: 4 },
              py: 1.75,
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              alignItems: { xs: "flex-start", sm: "center" },
              justifyContent: "space-between",
              gap: 1.5,
              flexShrink: 0,
              borderBottomLeftRadius: "24px",
              borderBottomRightRadius: "24px",
            }}
          >
            {/* Left: Info icon + text */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  backgroundColor: "#EFF6FF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#3B82F6",
                  flexShrink: 0,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </Box>
              <Typography sx={{ fontSize: "0.82rem", color: "#64748B", fontWeight: 500 }}>
                Not sure what to add? Check out our documentation for examples and best practices.
              </Typography>
            </Box>

            {/* Right: View guide button */}
            <Button
              variant="outlined"
              size="small"
              onClick={() => window.open("/docs", "_blank")}
              sx={{
                textTransform: "none",
                fontSize: "0.78rem",
                fontWeight: 600,
                color: "#334155",
                borderColor: "#E2E8F0",
                backgroundColor: "#FFFFFF",
                borderRadius: "8px",
                px: 1.75,
                py: 0.65,
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                flexShrink: 0,
                "&:hover": {
                  backgroundColor: "#F8FAFC",
                  borderColor: "#CBD5E1",
                },
              }}
            >
              <span>View guide</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </Button>
          </Box>
        </>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: "Add Knowledge - Step 2 Upload" (EXACT REFERENCE MODAL)           */}
      {/* ========================================================================= */}
      {activeMode === "file-upload" && (
        <>
          {/* Top Bar with Back Arrow + Close Button */}
          <Box
            sx={{
              px: { xs: 2.5, md: 4 },
              pt: 2.5,
              pb: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <Button
              onClick={() => {
                setActiveMode("category-select");
                setSelectedCategory(null);
              }}
              startIcon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              }
              sx={{
                textTransform: "none",
                fontSize: "0.95rem",
                fontWeight: 700,
                color: "#0F172A",
                p: 0,
                "&:hover": { backgroundColor: "transparent", color: "#2563EB" },
              }}
            >
              Add Knowledge
            </Button>

            <IconButton
              onClick={onClose}
              size="small"
              aria-label="Close dialog"
              sx={{
                color: "#94A3B8",
                p: 1,
                borderRadius: "50%",
                transition: "all 150ms ease",
                "&:hover": {
                  backgroundColor: "#F1F5F9",
                  color: "#334155",
                },
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </IconButton>
          </Box>

          {/* Sub-Header: Category Details */}
          <Box
            sx={{
              px: { xs: 2.5, md: 4 },
              py: 1.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              flexShrink: 0,
            }}
          >
            {/* Category Info */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.75 }}>
              <Box
                sx={{
                  width: 46,
                  height: 46,
                  borderRadius: "14px",
                  backgroundColor: currentCatOption.iconBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {currentCatOption.icon}
              </Box>
              <Box>
                <Typography sx={{ fontSize: "1.12rem", fontWeight: 800, color: "#0F172A", lineHeight: 1.25 }}>
                  {currentCatOption.name}
                </Typography>
                <Typography sx={{ fontSize: "0.8rem", color: "#64748B", mt: 0.25 }}>
                  {currentCatOption.desc}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Main 2-Column Upload Form Body */}
          <DialogContent sx={{ px: { xs: 2.5, md: 4 }, py: 1.5, flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>
            <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", lg: "1fr 340px" },
                  gap: 3,
                  alignItems: "start",
                }}
              >
                {/* Left Column: Form & Dropzone */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2.2 }}>
                  {/* Dataset name */}
                  <Box>
                    <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#0F172A", mb: 0.5 }}>
                      Dataset name *
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      value={datasetName}
                      onChange={(e) => setDatasetName(e.target.value)}
                      placeholder={`My ${currentCatOption.name}`}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: "10px",
                          backgroundColor: "#FFFFFF",
                        },
                      }}
                    />
                    <Typography sx={{ fontSize: "0.74rem", color: "#64748B", mt: 0.5 }}>
                      Give a clear name so you can easily identify this dataset later.
                    </Typography>
                  </Box>

                  {/* Upload file Section */}
                  <Box>
                    <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: "#0F172A", mb: 0.75 }}>
                      Upload file *
                    </Typography>

                    {/* Hidden Native File Input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".csv,.xls,.xlsx"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleFileChosen(e.target.files[0]);
                          // Reset input so same file can be re-selected
                          e.target.value = "";
                        }
                      }}
                    />

                    {/* Upload Area: Empty Dropzone OR In-place Uploaded File State */}
                    {!selectedFile && isBusy ? (
                      /* Reopened while an import runs in the background */
                      <Box
                        sx={{
                          border: "1px solid #BBF7D0",
                          backgroundColor: "#F0FDF4",
                          borderRadius: "16px",
                          p: 2.5,
                        }}
                      >
                        <Typography sx={{ fontWeight: 700, color: "#0F172A", fontSize: "0.95rem" }}>
                          {upload.fileName ?? "Your file"}
                        </Typography>
                        <Typography sx={{ color: "#16A34A", fontSize: "0.82rem", mt: 0.5 }}>
                          Import is running in the background. You can close this window — we&apos;ll
                          notify you when it&apos;s done.
                        </Typography>
                      </Box>
                    ) : !selectedFile ? (
                      /* State 1: Dropzone for uploading */
                      <Box
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        sx={{
                          border: isDragging ? "2px dashed #2563EB" : "2px dashed #BFDBFE",
                          backgroundColor: isDragging ? "#EFF6FF" : "#F8FAFC",
                          borderRadius: "16px",
                          p: { xs: 3, md: 3.5 },
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          gap: 1.25,
                          transition: "all 150ms ease",
                        }}
                      >
                        {/* Big Document Icon */}
                        <Box sx={{ color: "#2563EB", mb: 0.5 }}>
                          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <line x1="10" y1="9" x2="8" y2="9" />
                          </svg>
                        </Box>

                        <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#0F172A" }}>
                          Drag and drop your file here
                        </Typography>
                        <Typography sx={{ fontSize: "0.78rem", color: "#64748B", mt: -0.5 }}>
                          or click to browse from your computer
                        </Typography>

                        {/* Choose File Button */}
                        <Button
                          variant="contained"
                          onClick={() => fileInputRef.current?.click()}
                          startIcon={
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="17 8 12 3 7 8" />
                              <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                          }
                          sx={{
                            textTransform: "none",
                            backgroundColor: "#2563EB",
                            borderRadius: "9px",
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            px: 2.5,
                            py: 0.9,
                            mt: 0.5,
                            boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)",
                            "&:hover": { backgroundColor: "#1D4ED8" },
                          }}
                        >
                          Choose file
                        </Button>

                        <Typography sx={{ fontSize: "0.74rem", color: "#64748B", mt: 0.5 }}>
                          Supports CSV, XLS, XLSX files (Max 10MB)
                        </Typography>
                      </Box>
                    ) : (
                      /* State 2: File selected — show file card + progress */
                      /* State 2: Uploaded file rendered in the exact same upload place */
                      <Box
                        onDrop={isBusy ? undefined : handleDrop}
                        onDragOver={isBusy ? undefined : handleDragOver}
                        onDragLeave={isBusy ? undefined : handleDragLeave}
                        sx={{
                          border: isDragging ? "2px dashed #2563EB" : "1.5px solid #BBF7D0",
                          backgroundColor: isDragging ? "#EFF6FF" : "#F0FDF4",
                          borderRadius: "16px",
                          p: { xs: 2.25, md: 2.5 },
                          display: "flex",
                          flexDirection: "column",
                          gap: 1.75,
                          transition: "all 150ms ease",
                          boxShadow: "0 2px 8px rgba(22, 163, 74, 0.06)",
                          opacity: isBusy ? 0.65 : 1,
                        }}
                      >
                        {/* File Details Row */}
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
                            {/* Excel/CSV Badge */}
                            <Box
                              sx={{
                                width: 44,
                                height: 44,
                                borderRadius: "10px",
                                backgroundColor: "#059669",
                                color: "#FFFFFF",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 800,
                                fontSize: "0.62rem",
                                letterSpacing: "0.03em",
                                flexShrink: 0,
                                boxShadow: "0 2px 6px rgba(5, 150, 105, 0.25)",
                              }}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                              <span>{selectedFile?.name.toLowerCase().endsWith(".csv") ? "CSV" : "XLSX"}</span>
                            </Box>

                            {/* Name & metadata */}
                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                sx={{
                                  fontSize: "0.88rem",
                                  fontWeight: 700,
                                  color: "#0F172A",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {selectedFile?.name}
                              </Typography>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.35 }}>
                                <Typography sx={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 500 }}>
                                  {selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(1)} MB` : ""}
                                </Typography>
                                <Box
                                  sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    backgroundColor: "#DCFCE7",
                                    color: "#15803D",
                                    px: 0.85,
                                    py: 0.15,
                                    borderRadius: "5px",
                                    fontSize: "0.68rem",
                                    fontWeight: 700,
                                  }}
                                >
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  Ready
                                </Box>
                              </Box>
                            </Box>
                          </Box>

                          {/* Remove file button — disabled while import is running */}
                          <IconButton
                            size="small"
                            onClick={handleRemoveFile}
                            disabled={isBusy}
                            title="Remove file"
                            sx={{
                              color: "#64748B",
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #E2E8F0",
                              p: 0.75,
                              transition: "all 150ms ease",
                              "&:hover": {
                                backgroundColor: "#FEE2E2",
                                borderColor: "#FCA5A5",
                                color: "#DC2626",
                              },
                              "&.Mui-disabled": { opacity: 0.4 },
                            }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </IconButton>
                        </Box>

                        {/* Status bar inside the upload area */}
                        <Box
                          sx={{
                            pt: 1.25,
                            borderTop: "1px dashed #BBF7D0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 1.5,
                          }}
                        >
                          <Typography sx={{ fontSize: "0.76rem", color: "#166534" }}>
                            File loaded and ready. Click <strong>Import data</strong> below to add directly.
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => { if (!isBusy) fileInputRef.current?.click(); }}
                            startIcon={
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                              </svg>
                            }
                            sx={{
                              textTransform: "none",
                              fontSize: "0.74rem",
                              fontWeight: 600,
                              color: "#15803D",
                              borderColor: "#86EFAC",
                              backgroundColor: "#FFFFFF",
                              borderRadius: "7px",
                              px: 1.5,
                              py: 0.35,
                              flexShrink: 0,
                              "&:hover": {
                                backgroundColor: "#F0FDF4",
                                borderColor: "#4ADE80",
                              },
                            }}
                          >
                            Replace file
                          </Button>
                        </Box>
                      </Box>
                    )}
                  </Box>

                  {/* Progress panel — injected after the dropzone */}
                  {renderProgressPanel()}
                </Box>

                {/* Right Column: Tips for a smooth import Card */}
                <Box
                  sx={{
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: "20px",
                    p: 3,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.5,
                  }}
                >
                  {/* Tips Header */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ color: "#2563EB" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                        <path d="M9 18h6" />
                        <path d="M10 22h4" />
                      </svg>
                    </Box>
                    <Typography sx={{ fontSize: "0.92rem", fontWeight: 800, color: "#0F172A" }}>
                      Tips for a smooth import
                    </Typography>
                  </Box>

                  {/* 4 Checkpoint Items */}
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
                      <Box
                        sx={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          backgroundColor: "#2563EB",
                          color: "#FFFFFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "#0F172A" }}>
                          Use clear column headers
                        </Typography>
                        <Typography sx={{ fontSize: "0.72rem", color: "#64748B", fontStyle: "italic", mt: 0.25 }}>
                          E.g. Name, Description, Category, Price, Availability, etc.
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
                      <Box
                        sx={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          backgroundColor: "#2563EB",
                          color: "#FFFFFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "#0F172A" }}>
                          Keep your data organized
                        </Typography>
                        <Typography sx={{ fontSize: "0.72rem", color: "#64748B", mt: 0.25 }}>
                          One product or service per row.
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
                      <Box
                        sx={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          backgroundColor: "#2563EB",
                          color: "#FFFFFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "#0F172A" }}>
                          Include relevant details
                        </Typography>
                        <Typography sx={{ fontSize: "0.72rem", color: "#64748B", mt: 0.25 }}>
                          Add features, specifications, pricing, and availability if possible.
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
                      <Box
                        sx={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          backgroundColor: "#2563EB",
                          color: "#FFFFFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "#0F172A" }}>
                          Use our template (optional)
                        </Typography>
                        <Typography sx={{ fontSize: "0.72rem", color: "#64748B", mt: 0.25 }}>
                          Download the template to get the right format.
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Accepted File Formats */}
                  <Box sx={{ pt: 1 }}>
                    <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#0F172A", mb: 1 }}>
                      Accepted file formats
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1.5 }}>
                      {[".csv", ".xls", ".xlsx"].map((ext) => (
                        <Box
                          key={ext}
                          sx={{
                            border: "1px solid #E2E8F0",
                            borderRadius: "10px",
                            backgroundColor: "#FFFFFF",
                            p: 1.25,
                            width: 60,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 0.5,
                          }}
                        >
                          <Box
                            sx={{
                              width: 28,
                              height: 28,
                              borderRadius: "6px",
                              backgroundColor: "#ECFDF5",
                              color: "#059669",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.62rem",
                              fontWeight: 800,
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          </Box>
                          <Typography sx={{ fontSize: "0.7rem", color: "#64748B", fontWeight: 600 }}>
                            {ext}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>

                  {/* Data Security Guarantee */}
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, pt: 1 }}>
                    <Box sx={{ color: "#64748B", mt: 0.2 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </Box>
                    <Typography sx={{ fontSize: "0.72rem", color: "#64748B", lineHeight: 1.4 }}>
                      Your data is secure. Files are processed safely and only used for your organization.
                    </Typography>
                  </Box>
                </Box>
              </Box>
          </DialogContent>

          {/* Bottom Footer Bar for File Upload Mode */}
          <Box
            sx={{
              borderTop: "1px solid #F1F5F9",
              backgroundColor: "#FFFFFF",
              px: { xs: 2.5, md: 4 },
              py: 2,
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              alignItems: { xs: "flex-start", sm: "center" },
              justifyContent: "space-between",
              gap: 1.5,
              flexShrink: 0,
              borderBottomLeftRadius: "24px",
              borderBottomRightRadius: "24px",
            }}
          >
            {/* Left: Template link */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ color: "#3B82F6", display: "flex" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </Box>
              <Typography sx={{ fontSize: "0.8rem", color: "#475569" }}>
                Need a template? Download our{" "}
                <Typography
                  component="span"
                  onClick={() => alert(`Downloading ${currentCatOption.name} template (.xlsx)`)}
                  sx={{
                    color: "#2563EB",
                    fontWeight: 600,
                    cursor: "pointer",
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  {currentCatOption.name} template
                </Typography>
              </Typography>
            </Box>

            {/* Right: Cancel and Direct Import */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Button
                onClick={onClose}
                variant="outlined"
                sx={{
                  textTransform: "none",
                  borderColor: "#E2E8F0",
                  color: "#475569",
                  borderRadius: "9px",
                  fontWeight: 600,
                  px: 2.5,
                  "&:hover": { borderColor: "#CBD5E1", backgroundColor: "#F8FAFC" },
                  "&.Mui-disabled": { opacity: 0.5 },
                }}
              >
                {isBusy ? "Run in background" : "Cancel"}
              </Button>

              <Button
                variant="contained"
                disabled={!selectedFile || isBusy || isDone}
                onClick={handleConfirmImport}
                startIcon={
                  isBusy ? (
                    <svg style={{ animation: "spin 1s linear infinite" }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  ) : isDone ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  )
                }
                sx={{
                  textTransform: "none",
                  backgroundColor: isDone ? "#059669" : "#2563EB",
                  borderRadius: "9px",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  px: 3,
                  py: 1,
                  boxShadow: isDone
                    ? "0 2px 8px rgba(5,150,105,0.25)"
                    : "0 2px 8px rgba(37, 99, 235, 0.25)",
                  transition: "all 200ms ease",
                  "&:hover": { backgroundColor: isDone ? "#047857" : "#1D4ED8" },
                  "&.Mui-disabled": { backgroundColor: "#93C5FD", color: "#FFFFFF" },
                }}
              >
                {isDone ? "Done!" : isBusy ? (isUploading ? `Uploading ${upload.uploadProgress}%` : `Processing ${upload.processingProgress}%`) : "Import data"}
              </Button>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}

export function AddKnowledgeDialog() {
  const { isAddDialogOpen, closeAddDialog, selectedCategoryForAdd, resetUpload } = useKnowledgeStore();

  if (!isAddDialogOpen) return null;

  return (
    <Dialog
      open={isAddDialogOpen}
      onClose={closeAddDialog}
      disableScrollLock
      maxWidth="lg"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: "24px",
            maxWidth: "1060px",
            width: "100%",
            maxHeight: "calc(100vh - 48px)",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 25px 60px -15px rgba(15, 23, 42, 0.2)",
            overflow: "hidden",
            m: { xs: 1.5, sm: 3 },
          },
        },
      }}
    >
      <AddKnowledgeModalContent
        key={selectedCategoryForAdd || "default"}
        initialCategory={selectedCategoryForAdd as ConcreteKnowledgeCategory | null}
        onClose={closeAddDialog}
      />
    </Dialog>
  );
}

