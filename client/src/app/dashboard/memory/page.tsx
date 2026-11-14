"use client";

import React, { Suspense } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { MemoryHub } from "@/components/memory";

export default function MemoryPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
          <CircularProgress size={32} sx={{ color: "#2563EB" }} />
        </Box>
      }
    >
      <MemoryHub />
    </Suspense>
  );
}
