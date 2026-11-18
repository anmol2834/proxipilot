import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function FeatureStrip() {
  const features = [
    {
      title: "Secure by design",
      subtitle: "Your data stays yours.",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="11" width="18" height="11" rx="2" stroke="#4F46E5" strokeWidth="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      title: "Tenant-Isolated Privacy",
      subtitle: "Your data strictly segregated.",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <ellipse cx="12" cy="5" rx="9" ry="3" stroke="#4F46E5" strokeWidth="2" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" stroke="#4F46E5" strokeWidth="2" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" stroke="#4F46E5" strokeWidth="2" />
        </svg>
      ),
    },
    {
      title: "Human control",
      subtitle: "You stay in charge.",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
            stroke="#4F46E5"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="7" r="4" stroke="#4F46E5" strokeWidth="2" />
        </svg>
      ),
    },
    {
      title: "AI-powered",
      subtitle: "More than just replies.",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
            stroke="#4F46E5"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      title: "Enterprise ready",
      subtitle: "Reliable. Scalable. Secure.",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
            stroke="#4F46E5"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
  ];

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 1360,
        mx: "auto",
        mt: { xs: 4, sm: 6, md: 7 },
        backgroundColor: "#FFFFFF",
        border: "1px solid #E6EAF0",
        borderRadius: { xs: "20px", md: "9999px" },
        boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.04), 0 4px 6px -2px rgba(0, 0, 0, 0.02)",
        py: { xs: 2.5, md: 2.25 },
        px: { xs: 2.5, sm: 3, md: 4 },
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, 1fr)",
          md: "repeat(5, 1fr)",
        },
        gap: { xs: 2.5, sm: 2.5, md: 2 },
        alignItems: "center",
      }}
    >
      {features.map((feat, idx) => (
        <Box
          key={idx}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            px: { md: 1 },
          }}
        >
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              backgroundColor: "rgba(79, 70, 229, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {feat.icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                fontSize: "0.8125rem",
                color: "#111827",
                lineHeight: 1.25,
                mb: 0.25,
                whiteSpace: { xs: "normal", sm: "nowrap" },
              }}
            >
              {feat.title}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                display: "block",
                color: "#64748B",
                fontSize: "0.6875rem",
                lineHeight: 1.2,
                whiteSpace: { xs: "normal", sm: "nowrap" },
              }}
            >
              {feat.subtitle}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
