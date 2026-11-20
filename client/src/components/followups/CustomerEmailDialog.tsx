"use client";

import React, { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Typography from "@mui/material/Typography";
import { FU } from "./meta";

const CHECKS = [
  "The latest AI assessment still supports a follow-up",
  "The customer has not refused contact or asked for no email",
  "No newer message is waiting to be read",
  "Your Gmail mailbox is connected and automation is on",
  "Within your send hours, attempt limit and minimum gap",
  "The text uses only facts already in this conversation",
];

export function CustomerEmailDialog({
  open, onClose, onConfirm, participants, defaultRecipient, loading = false, error = null, platformEnabled,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (recipient: string) => void;
  participants: string[];
  defaultRecipient?: string | null;
  loading?: boolean;
  error?: string | null;
  platformEnabled: boolean;
}) {
  const [recipient, setRecipient] = useState(defaultRecipient || participants[0] || "");
  const [agree, setAgree] = useState(false);
  useEffect(() => {
    if (open) {
      setRecipient(defaultRecipient || participants[0] || "");
      setAgree(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth
            slotProps={{ paper: { sx: { borderRadius: "14px" } } }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: 17, pb: 0.5 }}>Email this customer automatically?</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
        <Typography sx={{ fontSize: 13.5, color: FU.body }}>
          When a follow-up becomes due, ProxiPilot writes a short check-in in this conversation and sends it from your
          mailbox — only to the person you choose, and only if every check below passes at that moment. Otherwise it
          holds the email and reminds your team instead.
        </Typography>
        <Box>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: FU.muted, mb: 0.5 }}>SEND TO</Typography>
          {participants.length === 0 ? (
            <Alert severity="warning" sx={{ borderRadius: "10px" }}>Nobody has written in this conversation yet.</Alert>
          ) : (
            <RadioGroup value={recipient} onChange={(e) => setRecipient(e.target.value)}>
              {participants.map((p) => (
                <FormControlLabel key={p} value={p} control={<Radio size="small" />}
                                  label={<Typography sx={{ fontSize: 13.5 }}>{p}</Typography>} />
              ))}
            </RadioGroup>
          )}
        </Box>
        <Box sx={{ p: 1.5, borderRadius: "10px", backgroundColor: FU.soft, border: `1px solid ${FU.border}` }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: FU.muted, mb: 0.75 }}>CHECKED BEFORE EVERY SEND</Typography>
          {CHECKS.map((c) => (
            <Typography key={c} sx={{ fontSize: 13, color: FU.body, lineHeight: 1.7 }}>✓ {c}</Typography>
          ))}
        </Box>
        {!platformEnabled && (
          <Alert severity="info" sx={{ borderRadius: "10px", fontSize: 13 }}>
            Customer sending is currently switched off for the whole platform, so only reminders will go out until it is
            switched on.
          </Alert>
        )}
        <FormControlLabel control={<Checkbox size="small" checked={agree} onChange={(e) => setAgree(e.target.checked)} />}
                          label={<Typography sx={{ fontSize: 13 }}>This customer is happy to receive follow-up emails from us.</Typography>} />
        {error && <Alert severity="error" sx={{ borderRadius: "10px", fontSize: 13 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={loading} sx={{ textTransform: "none", fontWeight: 600 }}>Cancel</Button>
        <Button variant="contained" disableElevation disabled={!recipient || !agree || loading}
                onClick={() => onConfirm(recipient)}
                sx={{ textTransform: "none", fontWeight: 600, borderRadius: "9px" }}>
          {loading ? "Enabling…" : "Enable automatic email"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
