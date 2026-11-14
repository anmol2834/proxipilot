"use client";

import * as React from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  React.useEffect(() => {
    console.error("Global Error Caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{ margin: 0, fontFamily: "sans-serif", background: "#f8fafc", color: "#0f172a" }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "12px" }}>
            Fatal System Error
          </h1>
          <p style={{ maxWidth: "480px", color: "#64748b", marginBottom: "24px" }}>
            A critical system error prevented the application from loading.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              background: "#4f46e5",
              color: "#ffffff",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
