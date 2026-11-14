"use client";

import React from "react";
import Box from "@mui/material/Box";
import { OrgHierarchyCanvas } from "./OrgHierarchyCanvas";
import { OrgPillarsBar } from "./OrgPillarsBar";

export function OrganizationVisualStage() {
  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <OrgHierarchyCanvas />
      <OrgPillarsBar />
    </Box>
  );
}
