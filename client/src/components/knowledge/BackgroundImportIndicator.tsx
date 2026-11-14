"use client";

import React, { useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import { usePathname, useRouter } from "next/navigation";
import { isUploadBusy, useKnowledgeStore } from "@/stores/knowledge.store";
import { KnowledgeCategory } from "@/types/knowledge.types";

const KNOWLEDGE_PATH = "/dashboard/knowledge";

function stageLabel(phase: string, stage: string | null): string {
  if (phase === "uploading") return "Uploading file";
  switch (stage) {
    case "parsing":
      return "Reading file";
    case "schema_detection":
    case "mapping":
      return "Mapping columns";
    case "validating":
      return "Validating data";
    case "importing":
      return "Saving & indexing records";
    case "projecting":
      return "Finalizing search index";
    default:
      return "Preparing import";
  }
}

/**
 * Floating progress card for a knowledge import that runs while the Add Knowledge
 * dialog is closed. Tracking lives in the knowledge store, so it continues across
 * dashboard navigation; the job id is persisted, so it also resumes after a reload.
 */
export function BackgroundImportIndicator() {
  const upload = useKnowledgeStore((s) => s.upload);
  const isAddDialogOpen = useKnowledgeStore((s) => s.isAddDialogOpen);
  const openAddDialog = useKnowledgeStore((s) => s.openAddDialog);
  const resumeActiveImport = useKnowledgeStore((s) => s.resumeActiveImport);
  const pathname = usePathname();
  const router = useRouter();

  // Resume tracking an import that was running before a page reload.
  useEffect(() => {
    void resumeActiveImport();
  }, [resumeActiveImport]);

  if (!isUploadBusy(upload) || isAddDialogOpen) return null;

  const progress = upload.phase === "uploading" ? upload.uploadProgress : upload.processingProgress;
  const title = upload.datasetName || upload.fileName || "Knowledge import";

  const handleView = () => {
    if (pathname !== KNOWLEDGE_PATH) router.push(KNOWLEDGE_PATH);
    openAddDialog((upload.category as KnowledgeCategory | null) ?? undefined);
  };

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        position: "fixed",
        right: 24,
        bottom: 24,
        zIndex: (theme) => theme.zIndex.snackbar - 1,
        width: { xs: "calc(100vw - 32px)", sm: 360 },
        maxWidth: 360,
        backgroundColor: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "14px",
        boxShadow: "0 12px 32px -8px rgba(15, 23, 42, 0.18)",
        p: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{ fontWeight: 700, fontSize: "0.9rem", color: "#0F172A" }}
            noWrap
            title={title}
          >
            Importing &ldquo;{title}&rdquo;
          </Typography>
          <Typography sx={{ fontSize: "0.78rem", color: "#64748B", mt: 0.25 }}>
            {stageLabel(upload.phase, upload.currentStage)} · {progress}%
          </Typography>
        </Box>
        <Button
          size="small"
          onClick={handleView}
          sx={{ textTransform: "none", fontWeight: 600, minWidth: 0, px: 1.25 }}
        >
          View
        </Button>
      </Box>
      <LinearProgress
        variant="determinate"
        value={Math.max(2, Math.min(100, progress))}
        sx={{ mt: 1.5, height: 6, borderRadius: 3, backgroundColor: "#EEF2FF" }}
      />
      {upload.rowCount ? (
        <Typography sx={{ fontSize: "0.75rem", color: "#64748B", mt: 1 }}>
          {upload.processedRows.toLocaleString()} / {upload.rowCount.toLocaleString()} records
          · you can keep working, we&apos;ll notify you when it&apos;s done
        </Typography>
      ) : (
        <Typography sx={{ fontSize: "0.75rem", color: "#64748B", mt: 1 }}>
          You can keep working — we&apos;ll notify you when it&apos;s done
        </Typography>
      )}
    </Box>
  );
}
