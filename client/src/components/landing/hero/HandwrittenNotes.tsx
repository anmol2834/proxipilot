import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function TopLeftNote() {
  return (
    <Box
      sx={{
        position: "absolute",
        top: { xs: "0px", lg: "0px" },
        left: { lg: "22%", xl: "24%" },
        display: { xs: "none", lg: "flex" },
        flexDirection: "column",
        alignItems: "center",
        pointerEvents: "none",
        zIndex: 4,
        transform: "rotate(-6deg)",
      }}
    >
      <Typography
        sx={{
          fontFamily: "var(--font-handwritten), 'Caveat', cursive",
          fontSize: { sm: "1.25rem", md: "1.375rem" },
          color: "#64748B",
          lineHeight: 1.1,
          mb: 0.5,
        }}
      >
        From incoming emails...
      </Typography>
      {/* Hand-drawn curving arrow pointing down */}
      <svg width="45" height="35" viewBox="0 0 45 35" fill="none">
        <path
          d="M10 2C15 15 25 28 38 30"
          stroke="#94A3B8"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="2 0"
        />
        <path
          d="M32 24L39 30L35 34"
          stroke="#94A3B8"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Box>
  );
}

export function TopRightNote() {
  return (
    <Box
      sx={{
        position: "absolute",
        top: { xs: "0px", lg: "0px" },
        right: { lg: "22%", xl: "24%" },
        display: { xs: "none", lg: "flex" },
        flexDirection: "column",
        alignItems: "center",
        pointerEvents: "none",
        zIndex: 4,
        transform: "rotate(6deg)",
      }}
    >
      <Typography
        sx={{
          fontFamily: "var(--font-handwritten), 'Caveat', cursive",
          fontSize: { sm: "1.25rem", md: "1.375rem" },
          color: "#64748B",
          lineHeight: 1.1,
          mb: 0.5,
        }}
      >
        ...to intelligent action
      </Typography>
      {/* Hand-drawn curving arrow pointing down */}
      <svg width="45" height="35" viewBox="0 0 45 35" fill="none">
        <path d="M35 2C30 15 20 28 8 30" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
        <path
          d="M14 24L7 30L11 34"
          stroke="#94A3B8"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Box>
  );
}

export function BottomRightNote() {
  return (
    <Box
      sx={{
        position: "absolute",
        bottom: { xs: "-10px", lg: "-20px" },
        right: { xs: "2%", lg: "6%" },
        display: { xs: "none", xl: "flex" },
        flexDirection: "row",
        alignItems: "center",
        gap: 1.5,
        pointerEvents: "none",
        zIndex: 4,
        transform: "rotate(-4deg)",
      }}
    >
      <Box sx={{ textAlign: "right" }}>
        <Typography
          sx={{
            fontFamily: "var(--font-handwritten), 'Caveat', cursive",
            fontSize: "1.125rem",
            color: "#64748B",
            lineHeight: 1.15,
          }}
        >
          Faster responses
        </Typography>
        <Typography
          sx={{
            fontFamily: "var(--font-handwritten), 'Caveat', cursive",
            fontSize: "1.125rem",
            color: "#64748B",
            lineHeight: 1.15,
          }}
        >
          Happier customers
        </Typography>
        <Typography
          sx={{
            fontFamily: "var(--font-handwritten), 'Caveat', cursive",
            fontSize: "1.125rem",
            color: "#64748B",
            lineHeight: 1.15,
          }}
        >
          A more productive team.
        </Typography>
      </Box>

      {/* Upward curved arrow pointing up-left */}
      <svg width="40" height="50" viewBox="0 0 40 50" fill="none">
        <path
          d="M32 45C34 25 25 15 8 10"
          stroke="#94A3B8"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M16 5L6 10L12 18"
          stroke="#94A3B8"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Box>
  );
}
