import React, { Suspense } from "react";
import type { Metadata } from "next";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import { SettingsHub } from "@/components/settings/SettingsHub";

export const metadata: Metadata = {
  title: "Settings — ProxiPilot",
  description: "Organization configuration, security policies, and workspace preferences.",
};

function SettingsLoadingFallback() {
  return (
    <Box sx={{ width: "100%", minHeight: "100vh", backgroundColor: "#FFFFFF", display: "flex", flexDirection: "column" }}>
      <Box sx={{ px: { xs: 2.5, sm: 4 }, py: 2.25, borderBottom: "1px solid #F1F3F5" }}>
        <Skeleton variant="text" width={180} height={28} />
      </Box>
      <Box sx={{ display: "flex", flex: 1 }}>
        <Box sx={{ width: 230, borderRight: "1px solid #F1F3F5", p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
          <Skeleton variant="rounded" width="100%" height={36} sx={{ borderRadius: "8px" }} />
          <Skeleton variant="rounded" width="100%" height={36} sx={{ borderRadius: "8px" }} />
          <Skeleton variant="rounded" width="100%" height={36} sx={{ borderRadius: "8px" }} />
        </Box>
        <Box sx={{ flex: 1, p: 4, display: "flex", flexDirection: "column", gap: 2 }}>
          <Skeleton variant="text" width={220} height={32} />
          <Skeleton variant="rounded" width="100%" height={120} sx={{ borderRadius: "10px" }} />
          <Skeleton variant="rounded" width="100%" height={120} sx={{ borderRadius: "10px" }} />
        </Box>
      </Box>
    </Box>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoadingFallback />}>
      <SettingsHub />
    </Suspense>
  );
}
