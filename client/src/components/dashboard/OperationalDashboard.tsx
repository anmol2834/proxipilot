"use client";

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import Link from "next/link";

export function OperationalDashboard() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* 4 Compact KPI Cards */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
          gap: 2,
        }}
      >
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: "16px", border: "1px solid #EEF2F6", backgroundColor: "#FFFFFF" }}>
          <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748B" }}>Total Emails</Typography>
          <Typography sx={{ fontSize: "1.65rem", fontWeight: 800, color: "#0F172A", my: 0.5 }}>1,284</Typography>
          <Typography sx={{ fontSize: "0.72rem", color: "#16A34A", fontWeight: 600 }}>+18% from last week</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: "16px", border: "1px solid #EEF2F6", backgroundColor: "#FFFFFF" }}>
          <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748B" }}>AI Handled</Typography>
          <Typography sx={{ fontSize: "1.65rem", fontWeight: 800, color: "#2563EB", my: 0.5 }}>82.4%</Typography>
          <Typography sx={{ fontSize: "0.72rem", color: "#64748B" }}>1,058 automated drafts</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: "16px", border: "1px solid #EEF2F6", backgroundColor: "#FFFFFF" }}>
          <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748B" }}>Needs Attention</Typography>
          <Typography sx={{ fontSize: "1.65rem", fontWeight: 800, color: "#EA580C", my: 0.5 }}>3</Typography>
          <Typography sx={{ fontSize: "0.72rem", color: "#EA580C", fontWeight: 600 }}>Approval required</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: "16px", border: "1px solid #EEF2F6", backgroundColor: "#FFFFFF" }}>
          <Typography sx={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748B" }}>Avg Response Time</Typography>
          <Typography sx={{ fontSize: "1.65rem", fontWeight: 800, color: "#0F172A", my: 0.5 }}>4.2 min</Typography>
          <Typography sx={{ fontSize: "0.72rem", color: "#16A34A", fontWeight: 600 }}>-68% faster</Typography>
        </Paper>
      </Box>

      {/* Main Operational Split Grid */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.5fr 1fr" }, gap: 3 }}>
        {/* Left: Today's AI Activity */}
        <Paper elevation={0} sx={{ p: 3, borderRadius: "18px", border: "1px solid #EEF2F6", backgroundColor: "#FFFFFF" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: "#0F172A" }}>
              Today&apos;s AI Activity
            </Typography>
            <Button component={Link} href="/dashboard/inbox" size="small" sx={{ textTransform: "none", fontSize: "0.8rem", color: "#2563EB", fontWeight: 600 }}>
              View Inbox →
            </Button>
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {[
              {
                title: "Pricing Inquiry & Tier Recommendation",
                company: "Acme Corp (Sarah Jenkins)",
                status: "Response ready",
                badgeColor: "#EFF6FF",
                badgeText: "#2563EB",
                time: "8m ago",
              },
              {
                title: "Appliance Repair Maintenance Schedule",
                company: "Metro Facilities (David Miller)",
                status: "Knowledge matched",
                badgeColor: "#F0FDF4",
                badgeText: "#16A34A",
                time: "24m ago",
              },
              {
                title: "High Intent Enterprise Lead",
                company: "Global Logistics Group",
                status: "Assigned to Sales",
                badgeColor: "#FAF5FF",
                badgeText: "#9333EA",
                time: "1h ago",
              },
            ].map((item, idx) => (
              <Box
                key={idx}
                sx={{
                  p: 1.75,
                  borderRadius: "12px",
                  border: "1px solid #F1F5F9",
                  backgroundColor: "#FAFAFA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: "0.85rem", color: "#0F172A" }}>
                    {item.title}
                  </Typography>
                  <Typography sx={{ fontSize: "0.74rem", color: "#64748B", mt: 0.25 }}>
                    {item.company} &bull; {item.time}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    px: 1.25,
                    py: 0.35,
                    borderRadius: "6px",
                    backgroundColor: item.badgeColor,
                    color: item.badgeText,
                    fontSize: "0.72rem",
                    fontWeight: 700,
                  }}
                >
                  {item.status}
                </Box>
              </Box>
            ))}
          </Box>
        </Paper>

        {/* Right: Needs Attention & AI Workload */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Needs Attention Panel */}
          <Paper elevation={0} sx={{ p: 3, borderRadius: "18px", border: "1px solid #EEF2F6", backgroundColor: "#FFFFFF" }}>
            <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: "#0F172A", mb: 2 }}>
              Needs your attention
            </Typography>
            <Box sx={{ p: 1.75, borderRadius: "12px", backgroundColor: "#FFFBEB", border: "1px solid #FEF3C7" }}>
              <Typography sx={{ fontWeight: 700, fontSize: "0.82rem", color: "#92400E" }}>
                Refund Request &bull; Requires Manual Approval
              </Typography>
              <Typography sx={{ fontSize: "0.74rem", color: "#B45309", mt: 0.5 }}>
                Confidence below autonomous threshold (71%). Human approval requested.
              </Typography>
            </Box>
          </Paper>

          {/* AI Workload Summary */}
          <Paper elevation={0} sx={{ p: 3, borderRadius: "18px", border: "1px solid #EEF2F6", backgroundColor: "#FFFFFF" }}>
            <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: "#0F172A", mb: 1.5 }}>
              AI Workload
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
              <Typography sx={{ fontSize: "0.82rem", color: "#64748B" }}>Autonomous Triage</Typography>
              <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: "#2563EB" }}>82%</Typography>
            </Box>
            <Box sx={{ width: "100%", height: 8, borderRadius: 4, backgroundColor: "#E2E8F0", overflow: "hidden" }}>
              <Box sx={{ width: "82%", height: "100%", backgroundColor: "#2563EB", borderRadius: 4 }} />
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
