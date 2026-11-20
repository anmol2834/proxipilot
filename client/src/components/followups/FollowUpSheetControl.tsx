"use client";

/**
 * Toolbar "Follow-up" button + drop-down sheet for the conversation pane.
 * The sheet opens right under the pane toolbar (no scrolling to find it) and closes on: the same
 * button, its close button, Esc, or any click/tap outside it. Clicks inside dialogs, menus and
 * pickers that the sheet itself opened (rendered in MUI portals) do not close it.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import { IconTargetArrow } from "@tabler/icons-react";
import { useThreadFollowup } from "@/hooks/useFollowups";
import { FollowUpPanel } from "./FollowUpPanel";

const PORTAL_SELECTOR = ".MuiDialog-root, .MuiPopover-root, .MuiPopper-root, .MuiMenu-root, .MuiModal-root, .MuiSnackbar-root, .MuiTooltip-popper";

function statusHint(data: ReturnType<typeof useThreadFollowup>["data"]): { text: string; color: string; bg: string } | null {
  if (!data) return null;
  if (data.status === "suppressed") return { text: "Do not contact", color: "#991B1B", bg: "#FEE2E2" };
  if (data.needs_review) return { text: "Review", color: "#B91C1C", bg: "#FEE2E2" };
  if (data.due.at) {
    const due = new Date(data.due.at);
    if (due.getTime() <= Date.now()) return { text: "Due now", color: "#B91C1C", bg: "#FEE2E2" };
    return { text: due.toLocaleDateString(undefined, { day: "numeric", month: "short" }), color: "#1D4ED8", bg: "#DBEAFE" };
  }
  if (data.status === "waiting_team") return { text: "Team owes reply", color: "#B45309", bg: "#FEF3C7" };
  if (data.workspace.mode === "shadow") return { text: "Observing", color: "#6D28D9", bg: "#F5F3FF" };
  return null;
}

export function FollowUpSheetControl({ threadId }: { threadId: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { data } = useThreadFollowup(threadId);
  const hint = statusHint(data);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => { setOpen(false); }, [threadId]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t || !(t instanceof Element)) return;
      if (rootRef.current?.contains(t)) return;              // inside the sheet or its button
      if (t.closest(PORTAL_SELECTOR)) return;                 // the sheet's own dialogs / menus / pickers
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector(".MuiDialog-root, .MuiMenu-root, .MuiPopover-root")) return; // let them close first
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <Box ref={rootRef} sx={{ display: "flex", alignItems: "center" }}>
      <Box component="button" type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
           aria-controls="followup-sheet" aria-label="Follow-up" title="Follow-up"
           sx={{
             display: "inline-flex", alignItems: "center", gap: 0.75, height: 32, px: 1.25, borderRadius: "8px",
             border: `1px solid ${open ? "#93C5FD" : "#E2E8F0"}`, backgroundColor: open ? "#EFF6FF" : "#FFFFFF",
             color: open ? "#1D4ED8" : "#334155", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
             transition: "all 120ms ease", "&:hover": { backgroundColor: open ? "#EFF6FF" : "#F8FAFC", borderColor: "#BFDBFE" },
             "&:focus-visible": { outline: "none", boxShadow: "0 0 0 3px #BFDBFE" },
           }}>
        <IconTargetArrow size={15} stroke={2} />
        Follow-up
        {hint && (
          <Box component="span" sx={{ fontSize: 10.5, fontWeight: 700, color: hint.color, backgroundColor: hint.bg,
                                      borderRadius: "5px", px: 0.75, py: "1px", whiteSpace: "nowrap" }}>
            {hint.text}
          </Box>
        )}
      </Box>

      {open && (
        <Box id="followup-sheet" role="dialog" aria-label="Follow-up"
             sx={{
               position: "absolute", top: "calc(100% + 6px)", left: 16, zIndex: 40,
               width: "min(760px, calc(100% - 32px))", maxHeight: "calc(100vh - 190px)", overflowY: "auto",
               backgroundColor: "#FFFFFF", borderRadius: "14px", border: "1px solid #E2E8F0", p: "16px 20px",
               boxShadow: "0 18px 48px rgba(15,23,42,0.16), 0 4px 12px rgba(15,23,42,0.06)",
               transformOrigin: "top left", animation: "fuSheetIn 180ms cubic-bezier(0.16, 1, 0.3, 1)",
               "@keyframes fuSheetIn": { from: { opacity: 0, transform: "translateY(-8px) scale(0.98)" }, to: { opacity: 1, transform: "none" } },
             }}>
          <FollowUpPanel threadId={threadId} onClose={close} flat />
        </Box>
      )}
    </Box>
  );
}
