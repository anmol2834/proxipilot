"use client";

import React, { useState, useRef, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import { authApi } from "@/lib/api";

interface OtpDialogProps {
  open: boolean;
  email: string;
  challengeId?: string;
  onClose: () => void;
  onVerifySuccess: () => void;
}

export function OtpDialog({ open, email, challengeId, onClose, onVerifySuccess }: OtpDialogProps) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(45);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer cooldown effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (open && cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [open, cooldown]);

  // Focus first input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 150);
    }
  }, [open]);

  const handleChange = (index: number, value: string) => {
    setError(null);
    const cleaned = value.replace(/\D/g, ""); // only digits

    if (!cleaned) {
      const nextDigits = [...digits];
      nextDigits[index] = "";
      setDigits(nextDigits);
      return;
    }

    const nextDigits = [...digits];
    // If multiple characters pasted into single field
    if (cleaned.length > 1) {
      const pastedDigits = cleaned.slice(0, 6).split("");
      pastedDigits.forEach((d, i) => {
        if (index + i < 6) {
          nextDigits[index + i] = d;
        }
      });
      setDigits(nextDigits);
      const nextIndex = Math.min(index + pastedDigits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    nextDigits[index] = cleaned[cleaned.length - 1];
    setDigits(nextDigits);

    // Auto advance
    if (index < 5 && cleaned) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setError(null);
    const pasteData = e.clipboardData.getData("text").replace(/\D/g, "");
    if (pasteData) {
      const nextDigits = [...digits];
      const chars = pasteData.slice(0, 6).split("");
      chars.forEach((c, idx) => {
        nextDigits[idx] = c;
      });
      setDigits(nextDigits);
      const focusIndex = Math.min(chars.length, 5);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  const handleVerify = async () => {
    const fullOtp = digits.join("");
    if (fullOtp.length < 6) {
      setError("Please enter all 6 digits of the code.");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      if (challengeId) {
        await authApi.verifyOtp({
          email,
          challenge_id: challengeId,
          otp: fullOtp,
        });
      }
      onVerifySuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid verification code. Please check and try again.";
      setError(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setCanResend(false);
    setCooldown(45);
    setError(null);
    setDigits(["", "", "", "", "", ""]);
    inputRefs.current[0]?.focus();

    if (challengeId) {
      try {
        const res = await authApi.resendOtp({
          email,
          challenge_id: challengeId,
        });
        if (res.cooldown_seconds) {
          setCooldown(res.cooldown_seconds);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to resend code.";
        setError(msg);
      }
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      disableScrollLock
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(6px)",
          },
        },
        paper: {
          sx: {
            borderRadius: "22px",
            border: "1px solid #EEF2F6",
            boxShadow: "0 20px 50px -10px rgba(15, 23, 42, 0.15)",
            p: { xs: 2.5, sm: 3.5 },
            backgroundColor: "#FFFFFF",
          },
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        {/* Top Icon & Close Button */}
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "12px",
              backgroundColor: "#EFF6FF",
              color: "#2563EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: "#94A3B8" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </IconButton>
        </Box>

        {/* Heading & Subtitle */}
        <Typography
          variant="h2"
          component="h2"
          sx={{
            fontSize: "1.45rem",
            fontWeight: 800,
            color: "#0F172A",
            letterSpacing: "-0.02em",
            mb: 0.75,
          }}
        >
          Verify your email
        </Typography>
        <Typography sx={{ fontSize: "0.85rem", color: "#64748B", lineHeight: 1.5, mb: 3 }}>
          We sent a 6-digit verification code to{" "}
          <Box component="span" sx={{ fontWeight: 600, color: "#0F172A" }}>
            {email || "your work email"}
          </Box>
          .
        </Typography>

        {/* 6 Digit Input Group */}
        <Box
          onPaste={handlePaste}
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: { xs: 1, sm: 1.25 },
            mb: 2,
          }}
        >
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              aria-label={`Digit ${index + 1}`}
              style={{
                width: "100%",
                height: 48,
                textAlign: "center",
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#0F172A",
                backgroundColor: "#F8FAFC",
                border: error ? "1.5px solid #EF4444" : digit ? "1.5px solid #2563EB" : "1px solid #CBD5E1",
                borderRadius: 10,
                outline: "none",
                transition: "all 150ms ease",
              }}
            />
          ))}
        </Box>

        {/* Error message */}
        {error && (
          <Box
            sx={{
              mb: 2,
              p: 1,
              backgroundColor: "#FEF2F2",
              border: "1px solid #FCA5A5",
              borderRadius: "8px",
              color: "#991B1B",
              fontSize: "0.8rem",
              textAlign: "center",
            }}
          >
            {error}
          </Box>
        )}

        {/* Verify Button */}
        <Button
          onClick={handleVerify}
          variant="contained"
          fullWidth
          disabled={isVerifying}
          sx={{
            backgroundColor: "#2563EB",
            color: "#FFFFFF",
            textTransform: "none",
            fontWeight: 700,
            fontSize: "0.95rem",
            py: 1.25,
            borderRadius: "12px",
            boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)",
            mb: 2.5,
            "&:hover": {
              backgroundColor: "#1D4ED8",
            },
          }}
        >
          {isVerifying ? "Verifying..." : "Verify email →"}
        </Button>

        {/* Resend Code Action */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75 }}>
          <Typography sx={{ fontSize: "0.82rem", color: "#64748B" }}>
            Didn&apos;t receive the code?
          </Typography>
          {canResend ? (
            <Button
              onClick={handleResend}
              variant="text"
              sx={{
                p: 0,
                minWidth: "auto",
                textTransform: "none",
                fontSize: "0.82rem",
                fontWeight: 700,
                color: "#2563EB",
                "&:hover": { textDecoration: "underline", backgroundColor: "transparent" },
              }}
            >
              Resend code
            </Button>
          ) : (
            <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: "#94A3B8" }}>
              Resend in {cooldown}s
            </Typography>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
