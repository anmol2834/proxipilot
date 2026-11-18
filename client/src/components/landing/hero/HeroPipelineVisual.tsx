"use client";

import React, { useState, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import { ProviderStack } from "./ProviderIcons";
import { IncomingEmailsCard } from "./IncomingEmailsCard";
import { IntelligenceCard } from "./IntelligenceCard";
import { DraftResponseCard } from "./DraftResponseCard";
import { TopLeftNote, TopRightNote, BottomRightNote } from "./HandwrittenNotes";
import { PIPELINE_SCENARIOS } from "./pipelineScenarios";

export function HeroPipelineVisual() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [stage, setStage] = useState<number>(0);
  const [activeStepCount, setActiveStepCount] = useState<number>(0);
  const [typedBody, setTypedBody] = useState<string>("");
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const currentScenario = PIPELINE_SCENARIOS[scenarioIndex];
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Manual scenario selection by clicking left email items
  const handleSelectScenario = (id: number) => {
    const targetIndex = PIPELINE_SCENARIOS.findIndex((s) => s.id === id);
    if (targetIndex !== -1 && targetIndex !== scenarioIndex) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setScenarioIndex(targetIndex);
      setActiveStepCount(0);
      setTypedBody("");
      setStage(0);
    }
  };

  useEffect(() => {
    if (isPaused) return;

    if (stage === 0) {
      // Step 1: Active email selected, initiate flow rapidly without dead pause
      timerRef.current = setTimeout(() => {
        setStage(1);
      }, 240);
    } else if (stage === 1) {
      // Step 2: Signal travels across Connector 1 to Intelligence (smooth 300ms)
      timerRef.current = setTimeout(() => {
        setStage(2);
        setActiveStepCount(1);
      }, 300);
    } else if (stage === 2) {
      // Step 3: Intelligence analyzes 5 steps sequentially in crisp, rhythmic cadence
      if (activeStepCount < 5) {
        timerRef.current = setTimeout(() => {
          setActiveStepCount((prev) => prev + 1);
        }, 180);
      } else {
        // Step 5 verified, immediately transition to Draft response flow
        timerRef.current = setTimeout(() => {
          setStage(3);
        }, 220);
      }
    } else if (stage === 3) {
      // Step 4: Signal travels across Connector 2 to Draft
      timerRef.current = setTimeout(() => {
        setStage(4);
      }, 300);
    } else if (stage === 4) {
      // Step 5: High-speed real-time typewriter stream
      const fullText = currentScenario.draft.body;
      if (typedBody.length < fullText.length) {
        timerRef.current = setTimeout(() => {
          const nextLength = Math.min(typedBody.length + 5, fullText.length);
          setTypedBody(fullText.slice(0, nextLength));
        }, 16);
      } else {
        timerRef.current = setTimeout(() => {
          setStage(5);
        }, 160);
      }
    } else if (stage === 5) {
      // Step 6: Brief natural pause to admire the ready-to-send draft, then seamlessly advance to next scenario
      timerRef.current = setTimeout(() => {
        setScenarioIndex((prev) => (prev + 1) % PIPELINE_SCENARIOS.length);
        setActiveStepCount(0);
        setTypedBody("");
        setStage(0);
      }, 1100);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [stage, activeStepCount, typedBody, currentScenario, scenarioIndex, isPaused]);

  return (
    <Box
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      sx={{
        position: "relative",
        width: "100%",
        maxWidth: 1260,
        mx: "auto",
        mt: 1.5,
        mb: 2,
        pt: { xs: 1.5, sm: 2, md: 3, lg: 4 },
        pb: { xs: 2.5, sm: 3, md: 4 },
      }}
    >
      {/* Background Soft Glow */}
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: "35%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: { xs: "280px", sm: "400px", md: "560px" },
            height: { xs: "280px", sm: "360px", md: "420px" },
            background:
              "radial-gradient(circle, rgba(99, 91, 255, 0.12) 0%, rgba(59, 130, 246, 0.04) 55%, transparent 75%)",
            filter: "blur(60px)",
            borderRadius: "50%",
          }}
        />
      </Box>

      {/* Handwritten Floating Annotations */}
      <TopLeftNote />
      <TopRightNote />
      <BottomRightNote />

      {/* Main 3-Part Pipeline Flex Container */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", lg: "row" },
          alignItems: "center",
          justifyContent: "center",
          gap: { xs: 2.5, lg: 1.5, xl: 2 },
          position: "relative",
          zIndex: 2,
          width: "100%",
        }}
      >
        {/* SECTION 1: Providers & Incoming Emails Card */}
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: "center",
            gap: { xs: 1.25, sm: 1.25 },
            position: "relative",
            flexShrink: 0,
            justifyContent: "center",
          }}
        >
          {/* Vertical/Horizontal Provider Stack */}
          <ProviderStack />

          {/* SVG Connector lines from provider stack into the card (tablet/desktop) */}
          <Box
            sx={{
              display: { xs: "none", sm: "block" },
              width: 14,
              height: 120,
              flexShrink: 0,
            }}
          >
            <svg width="14" height="120" viewBox="0 0 14 120" fill="none">
              <path
                d="M0 15C7 15 10 45 14 60"
                stroke="#CBD5E1"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                style={{ animation: "connectorDashFlow 1.5s linear infinite" }}
              />
              <path
                d="M0 45C6 45 10 55 14 60"
                stroke="#CBD5E1"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                style={{ animation: "connectorDashFlow 1.5s linear infinite" }}
              />
              <path
                d="M0 75C6 75 10 65 14 60"
                stroke="#CBD5E1"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                style={{ animation: "connectorDashFlow 1.5s linear infinite" }}
              />
              <path
                d="M0 105C7 105 10 75 14 60"
                stroke="#CBD5E1"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                style={{ animation: "connectorDashFlow 1.5s linear infinite" }}
              />
            </svg>
          </Box>

          <IncomingEmailsCard activeId={currentScenario.id} onSelect={handleSelectScenario} />
        </Box>

        {/* CONNECTOR 1 (Desktop): Left -> Center */}
        <Box
          sx={{
            display: { xs: "none", lg: "flex" },
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            width: 32,
            height: 24,
            flexShrink: 0,
            zIndex: 3,
          }}
        >
          <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
            <path
              d="M2 12H28"
              stroke="#635BFF"
              strokeWidth="2"
              strokeDasharray="3 3"
              strokeLinecap="round"
              style={{
                animation: stage === 1 ? "connectorDashFlow 0.4s linear infinite" : "none",
                opacity: stage === 1 ? 1 : 0.45,
              }}
            />
            <path
              d="M24 7L29 12L24 17"
              stroke="#635BFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: stage === 1 ? 1 : 0.45 }}
            />
          </svg>

          {/* Glowing Travelling Pulse Dot */}
          {stage === 1 && (
            <Box
              sx={{
                position: "absolute",
                top: "50%",
                transform: "translateY(-50%)",
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#635BFF",
                boxShadow: "0 0 10px 3px rgba(99, 91, 255, 0.9)",
                animation: "connectorPacketTravelX 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                pointerEvents: "none",
              }}
            />
          )}
        </Box>

        {/* CONNECTOR 1 (Mobile): Vertical */}
        <Box
          sx={{
            display: { xs: "flex", lg: "none" },
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            width: 24,
            height: 28,
            my: -0.5,
            zIndex: 3,
          }}
        >
          <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
            <path
              d="M12 2V22"
              stroke="#635BFF"
              strokeWidth="2"
              strokeDasharray="3 3"
              strokeLinecap="round"
              style={{
                animation: stage === 1 ? "connectorDashFlow 0.4s linear infinite" : "none",
                opacity: stage === 1 ? 1 : 0.45,
              }}
            />
            <path
              d="M7 17L12 22L17 17"
              stroke="#635BFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: stage === 1 ? 1 : 0.45 }}
            />
          </svg>

          {stage === 1 && (
            <Box
              sx={{
                position: "absolute",
                left: "50%",
                transform: "translateX(-50%)",
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#635BFF",
                boxShadow: "0 0 10px 3px rgba(99, 91, 255, 0.9)",
                animation: "connectorPacketTravelY 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                pointerEvents: "none",
              }}
            />
          )}
        </Box>

        {/* SECTION 2: Center ProxiPilot Intelligence Card */}
        <Box
          sx={{
            flexShrink: 0,
            width: { xs: "100%", sm: "auto", lg: 495 },
            display: "flex",
            justifyContent: "center",
          }}
        >
          <IntelligenceCard
            scenario={currentScenario}
            activeStepCount={activeStepCount}
            isAnalyzing={stage === 2}
            isVerified={stage >= 3}
          />
        </Box>

        {/* CONNECTOR 2 (Desktop): Center -> Right */}
        <Box
          sx={{
            display: { xs: "none", lg: "flex" },
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            width: 32,
            height: 24,
            flexShrink: 0,
            zIndex: 3,
          }}
        >
          <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
            <path
              d="M2 12H28"
              stroke="#10B981"
              strokeWidth="2"
              strokeDasharray="3 3"
              strokeLinecap="round"
              style={{
                animation: stage === 3 ? "connectorDashFlow 0.4s linear infinite" : "none",
                opacity: stage === 3 ? 1 : 0.45,
              }}
            />
            <path
              d="M24 7L29 12L24 17"
              stroke="#10B981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: stage === 3 ? 1 : 0.45 }}
            />
          </svg>

          {/* Glowing Emerald Pulse Dot */}
          {stage === 3 && (
            <Box
              sx={{
                position: "absolute",
                top: "50%",
                transform: "translateY(-50%)",
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#10B981",
                boxShadow: "0 0 10px 3px rgba(16, 185, 129, 0.9)",
                animation: "connectorPacketTravelX 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                pointerEvents: "none",
              }}
            />
          )}
        </Box>

        {/* CONNECTOR 2 (Mobile): Vertical Center -> Right */}
        <Box
          sx={{
            display: { xs: "flex", lg: "none" },
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            width: 24,
            height: 28,
            my: -0.5,
            zIndex: 3,
          }}
        >
          <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
            <path
              d="M12 2V22"
              stroke="#10B981"
              strokeWidth="2"
              strokeDasharray="3 3"
              strokeLinecap="round"
              style={{
                animation: stage === 3 ? "connectorDashFlow 0.4s linear infinite" : "none",
                opacity: stage === 3 ? 1 : 0.45,
              }}
            />
            <path
              d="M7 17L12 22L17 17"
              stroke="#10B981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: stage === 3 ? 1 : 0.45 }}
            />
          </svg>

          {stage === 3 && (
            <Box
              sx={{
                position: "absolute",
                left: "50%",
                transform: "translateX(-50%)",
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#10B981",
                boxShadow: "0 0 10px 3px rgba(16, 185, 129, 0.9)",
                animation: "connectorPacketTravelY 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                pointerEvents: "none",
              }}
            />
          )}
        </Box>

        {/* SECTION 3: Right Draft Response Card */}
        <Box
          sx={{
            flexShrink: 0,
            width: { xs: "100%", sm: "auto", lg: 340 },
            display: "flex",
            justifyContent: "center",
          }}
        >
          <DraftResponseCard
            scenario={currentScenario}
            typedBody={typedBody}
            isTyping={stage === 4}
            isReady={stage >= 4 && typedBody.length === currentScenario.draft.body.length}
          />
        </Box>
      </Box>

      {/* Global Fluid Animation Keyframes */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes connectorDashFlow {
          0% {
            stroke-dashoffset: 12;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }

        @keyframes connectorPacketTravelX {
          0% {
            left: 2px;
            opacity: 0;
            transform: translateY(-50%) scale(0.6);
          }
          20% {
            opacity: 1;
            transform: translateY(-50%) scale(1.1);
          }
          80% {
            opacity: 1;
            transform: translateY(-50%) scale(1.1);
          }
          100% {
            left: 24px;
            opacity: 0;
            transform: translateY(-50%) scale(0.6);
          }
        }

        @keyframes connectorPacketTravelY {
          0% {
            top: 2px;
            opacity: 0;
            transform: translateX(-50%) scale(0.6);
          }
          20% {
            opacity: 1;
            transform: translateX(-50%) scale(1.1);
          }
          80% {
            opacity: 1;
            transform: translateX(-50%) scale(1.1);
          }
          100% {
            top: 20px;
            opacity: 0;
            transform: translateX(-50%) scale(0.6);
          }
        }
      `,
        }}
      />
    </Box>
  );
}
