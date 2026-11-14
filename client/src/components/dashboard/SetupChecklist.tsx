"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import LinearProgress from "@mui/material/LinearProgress";
import CircularProgress from "@mui/material/CircularProgress";
import { useSetupStatus } from "@/hooks/use-setup-status";
import { useRouter } from "next/navigation";

export function SetupChecklist() {
  const router = useRouter();
  const {
    accountCreated,
    emailConnected,
    knowledgeAdded,
    isEmailLoading,
    isKnowledgeLoading,
  } = useSetupStatus();

  const totalSteps = 3;
  let completedCount = 0;
  if (accountCreated) completedCount++;
  if (emailConnected) completedCount++;
  if (knowledgeAdded) completedCount++;

  const progressPercent = (completedCount / totalSteps) * 100;

  return (
    <Paper
      elevation={0}
      sx={{
        backgroundColor: "#FFFFFF",
        borderRadius: "20px",
        border: "1px solid #EEF2F6",
        p: { xs: 2.5, sm: 3.5, md: 4 },
        mb: { xs: 3, md: 4 },
        boxShadow: "0 4px 20px rgba(15, 23, 42, 0.03)",
      }}
    >
      {/* Top Header Row: Title & Progress Bar */}
      <Box
        sx={{
          display: "flex",
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          flexDirection: { xs: "column", sm: "row" },
          gap: 2,
          mb: 3.5,
        }}
      >
        <Box>
          <Typography
            sx={{
              fontSize: "0.72rem",
              fontWeight: 800,
              color: "#64748B",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              mb: 0.5,
            }}
          >
            GET STARTED
          </Typography>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              color: "#0F172A",
              letterSpacing: "-0.02em",
              fontSize: { xs: "1.25rem", sm: "1.45rem" },
            }}
          >
            Complete these steps to unlock ProxiPilot
          </Typography>
          <Typography sx={{ fontSize: "0.86rem", color: "#64748B", mt: 0.5 }}>
            Finish the setup to let our AI understand your business and start working on your emails.
          </Typography>
        </Box>

        {/* Progress Counter & Progress Bar */}
        <Box sx={{ width: { xs: "100%", sm: 160 }, flexShrink: 0 }}>
          <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 0.75 }}>
            <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#0F172A" }}>
              {completedCount} of {totalSteps} completed
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progressPercent}
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: "#E2E8F0",
              "& .MuiLinearProgress-bar": {
                backgroundColor: "#2563EB",
                borderRadius: 3,
              },
            }}
          />
        </Box>
      </Box>

      {/* Steps Cards Row */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
          gap: 2.5,
          position: "relative",
        }}
      >
        {/* Step 1: Account Created (Always Completed) */}
        <Box
          sx={{
            p: 3,
            borderRadius: "16px",
            border: "1px solid #E2E8F0",
            backgroundColor: "#F8FAFC",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            minHeight: 180,
            justifyContent: "center",
          }}
        >
          {/* Green Checkmark Circle */}
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              backgroundColor: "#16A34A",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mb: 2,
              boxShadow: "0 4px 12px rgba(22, 163, 74, 0.25)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: "1.02rem", color: "#0F172A" }}>
            Account created
          </Typography>
          <Typography sx={{ fontSize: "0.82rem", color: "#64748B", mt: 0.5 }}>
            You&apos;re all set!
          </Typography>
        </Box>

        {/* Step 2: Connect your email */}
        <Box
          sx={{
            p: 3,
            borderRadius: "16px",
            border: emailConnected ? "1px solid #E2E8F0" : "1.5px solid #2563EB",
            backgroundColor: emailConnected ? "#F8FAFC" : "#FFFFFF",
            boxShadow: emailConnected ? "none" : "0 10px 25px rgba(37, 99, 235, 0.08)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            minHeight: 180,
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          {/* Step Number Pill */}
          <Box
            sx={{
              position: "absolute",
              top: 14,
              left: 14,
              width: 20,
              height: 20,
              borderRadius: "50%",
              backgroundColor: "#EFF6FF",
              color: "#2563EB",
              fontSize: "0.72rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            2
          </Box>

          {/* Mail Icon / Loading / Check */}
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "12px",
              backgroundColor: emailConnected ? "#ECFDF5" : "#EFF6FF",
              color: emailConnected ? "#16A34A" : "#2563EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mt: 0.5,
              mb: 1.5,
            }}
          >
            {isEmailLoading ? (
              <CircularProgress size={18} sx={{ color: "#2563EB" }} />
            ) : emailConnected ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            )}
          </Box>

          {/* Title & Description */}
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "1.02rem", color: "#0F172A" }}>
              Connect your{" "}
              <Box component="span" sx={{ color: "#2563EB" }}>
                email
              </Box>
            </Typography>
            <Typography sx={{ fontSize: "0.82rem", color: "#64748B", mt: 0.5 }}>
              {emailConnected ? "Gmail connected & syncing" : "Integrate Gmail or Microsoft Workspace"}
            </Typography>
          </Box>

          {/* Action CTA — navigate only, never set phantom flag */}
          <Button
            onClick={() => {
              if (!emailConnected) {
                router.push("/dashboard/integrations");
              }
            }}
            variant="contained"
            fullWidth
            disabled={isEmailLoading}
            sx={{
              backgroundColor: emailConnected ? "#F1F5F9" : "#2563EB",
              color: emailConnected ? "#16A34A" : "#FFFFFF",
              textTransform: "none",
              fontWeight: 700,
              fontSize: "0.85rem",
              py: 1,
              borderRadius: "10px",
              boxShadow: emailConnected ? "none" : "0 4px 14px rgba(37, 99, 235, 0.3)",
              "&:hover": {
                backgroundColor: emailConnected ? "#E2E8F0" : "#1D4ED8",
              },
            }}
          >
            {emailConnected ? "Connected ✓" : "Connect email →"}
          </Button>
        </Box>

        {/* Step 3: Add business knowledge */}
        <Box
          sx={{
            p: 3,
            borderRadius: "16px",
            border: knowledgeAdded ? "1px solid #E2E8F0" : "1px solid #E2E8F0",
            backgroundColor: knowledgeAdded ? "#F8FAFC" : "#FFFFFF",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            minHeight: 180,
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          {/* Step Number Pill */}
          <Box
            sx={{
              position: "absolute",
              top: 14,
              left: 14,
              width: 20,
              height: 20,
              borderRadius: "50%",
              backgroundColor: "#F1F5F9",
              color: "#64748B",
              fontSize: "0.72rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            3
          </Box>

          {/* Book / Knowledge Icon */}
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "12px",
              backgroundColor: knowledgeAdded ? "#ECFDF5" : "#F8FAFC",
              color: knowledgeAdded ? "#16A34A" : "#64748B",
              border: "1px solid #E2E8F0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mt: 0.5,
              mb: 1.5,
            }}
          >
            {isKnowledgeLoading ? (
              <CircularProgress size={18} sx={{ color: "#64748B" }} />
            ) : knowledgeAdded ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
              </svg>
            )}
          </Box>

          {/* Title & Description */}
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "1.02rem", color: "#0F172A" }}>
              Add business knowledge
            </Typography>
            <Typography sx={{ fontSize: "0.82rem", color: "#64748B", mt: 0.5 }}>
              {knowledgeAdded ? "Knowledge indexed & ready" : "Help AI understand your products, services and FAQs"}
            </Typography>
          </Box>

          {/* Action CTA — navigate only, never set phantom flag */}
          <Button
            onClick={() => {
              if (!knowledgeAdded) {
                router.push("/dashboard/knowledge");
              }
            }}
            variant="outlined"
            fullWidth
            disabled={isKnowledgeLoading}
            sx={{
              borderColor: "#E2E8F0",
              backgroundColor: knowledgeAdded ? "#F1F5F9" : "#FFFFFF",
              color: knowledgeAdded ? "#16A34A" : "#0F172A",
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.85rem",
              py: 0.9,
              borderRadius: "10px",
              "&:hover": {
                borderColor: "#CBD5E1",
                backgroundColor: "#F8FAFC",
              },
            }}
          >
            {knowledgeAdded ? "Indexed ✓" : "Add knowledge →"}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
