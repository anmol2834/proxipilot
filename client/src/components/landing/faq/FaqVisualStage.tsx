"use client";

import React from "react";
import Box from "@mui/material/Box";
import { InteractiveFaqCanvas } from "./InteractiveFaqCanvas";

export function FaqVisualStage() {
  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <InteractiveFaqCanvas />
    </Box>
  );
}
