"use client";

import React, { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import { ProviderStack } from "./ProviderIcons";
import { IncomingEmailsCard } from "./IncomingEmailsCard";
import { IntelligenceCard } from "./IntelligenceCard";
import { DraftResponseCard } from "./DraftResponseCard";
import { TopLeftNote, TopRightNote, BottomRightNote } from "./HandwrittenNotes";
import { PIPELINE_SCENARIOS } from "./pipelineScenarios";

export function HeroPipelineVisual() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  // Stage:
  // 0: Select email in inbox
  // 1: Signal transfers along Arrow 1 into Intelligence
  // 2: Intelligence analyzes steps 1..5
  // 3: Signal transfers along Arrow 2 into Draft
  // 4: Draft response typing animation
  // 5: Pause & show full ready state, then advance
  const [stage, setStage] = useState<number>(0);
  const [activeStepCount, setActiveStepCount] = useState<number>(0);
  const [typedBody, setTypedBody] = useState<string>("");

  const currentScenario = PIPELINE_SCENARIOS[scenarioIndex];

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (stage === 0) {
      // Step 1: Incoming email is selected
      timer = setTimeout(() => {
        setStage(1);
      }, 1200);
    } else if (stage === 1) {
      // Step 2: Packet travels across Arrow 1 to Intelligence
      timer = setTimeout(() => {
        setStage(2);
        setActiveStepCount(1);
      }, 1000);
    } else if (stage === 2) {
      // Step 3: Intelligence analyzes sequentially
      if (activeStepCount < 5) {
        timer = setTimeout(() => {
          setActiveStepCount((prev) => prev + 1);
        }, 550);
      } else {
        // Step 5 completed, wait a moment then pass to Draft
        timer = setTimeout(() => {
          setStage(3);
        }, 700);
      }
    } else if (stage === 3) {
      // Step 4: Packet travels across Arrow 2 to Draft
      timer = setTimeout(() => {
        setStage(4);
      }, 1000);
    } else if (stage === 4) {
      // Step 5: Typing animation
      const fullText = currentScenario.draft.body;
      if (typedBody.length < fullText.length) {
        timer = setTimeout(() => {
          // Type chunks of 3-4 characters for a realistic, snappy typing effect
          const nextLength = Math.min(typedBody.length + 3, fullText.length);
          setTypedBody(fullText.slice(0, nextLength));
        }, 35);
      } else {
        timer = setTimeout(() => {
          setStage(5);
        }, 400);
      }
    } else if (stage === 5) {
      // Step 6: Complete view pause, then advance to next email!
      timer = setTimeout(() => {
        setScenarioIndex((prev) => (prev + 1) % PIPELINE_SCENARIOS.length);
        setActiveStepCount(0);
        setTypedBody("");
        setStage(0);
      }, 2600);
    }

    return () => clearTimeout(timer);
  }, [stage, activeStepCount, typedBody, currentScenario, scenarioIndex]);

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        maxWidth: 1240,
        mx: "auto",
        mt: 3,
        mb: 2,
        pt: { xs: 2, sm: 3, md: 7, lg: 8 },
        pb: { xs: 3, sm: 5, md: 6 },
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
            width: { xs: "280px", sm: "400px", md: "520px" },
            height: { xs: "280px", sm: "360px", md: "400px" },
            background:
              "radial-gradient(circle, rgba(99, 91, 255, 0.14) 0%, rgba(79, 124, 255, 0.04) 60%, transparent 75%)",
            filter: "blur(60px)",
            borderRadius: "50%",
          }}
        />

        {/* Tilted background card 1 */}
        <Box
          sx={{
            position: "absolute",
            top: 20,
            left: -30,
            width: 220,
            height: 180,
            backgroundColor: "#FFFFFF",
            border: "1px solid #E6EAF0",
            borderRadius: "16px",
            opacity: 0.45,
            transform: "rotate(-12deg) skewX(-4deg)",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.04)",
            display: { xs: "none", xl: "block" },
          }}
        />

        {/* Tilted background card 2 */}
        <Box
          sx={{
            position: "absolute",
            top: 25,
            right: -25,
            width: 240,
            height: 190,
            backgroundColor: "#FFFFFF",
            border: "1px solid #E6EAF0",
            borderRadius: "16px",
            opacity: 0.45,
            transform: "rotate(10deg) skewX(3deg)",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.04)",
            display: { xs: "none", xl: "block" },
          }}
        />
      </Box>

      {/* Handwritten Floating Annotations (Clearly visible & positioned above cards) */}
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
          gap: { xs: 3, lg: 3 },
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
            gap: { xs: 2, sm: 2 },
            position: "relative",
            width: "100%",
            maxWidth: { xs: 360, sm: "none" },
            justifyContent: "center",
          }}
        >
          {/* Vertical/Horizontal Provider Stack */}
          <ProviderStack />

          {/* SVG Connector lines from provider stack into the card (tablet/desktop) */}
          <Box
            sx={{
              display: { xs: "none", sm: "block" },
              width: 20,
              height: 140,
              flexShrink: 0,
            }}
          >
            <svg width="20" height="140" viewBox="0 0 20 140" fill="none">
              <path
                d="M0 15C10 15 15 50 20 70"
                stroke="#CBD5E1"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                style={{ animation: "connectorDashFlow 2s linear infinite" }}
              />
              <path
                d="M0 50C8 50 15 65 20 70"
                stroke="#CBD5E1"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                style={{ animation: "connectorDashFlow 2s linear infinite" }}
              />
              <path
                d="M0 90C8 90 15 75 20 70"
                stroke="#CBD5E1"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                style={{ animation: "connectorDashFlow 2s linear infinite" }}
              />
              <path
                d="M0 125C10 125 15 90 20 70"
                stroke="#CBD5E1"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                style={{ animation: "connectorDashFlow 2s linear infinite" }}
              />
            </svg>
          </Box>

          <IncomingEmailsCard activeId={currentScenario.id} />
        </Box>

        {/* CONNECTOR 1 (Desktop): Left -> Center with 100% Centered Dot */}
        <Box
          sx={{
            display: { xs: "none", lg: "flex" },
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            width: 48,
            height: 24,
            flexShrink: 0,
            zIndex: 3,
          }}
        >
          <svg width="48" height="24" viewBox="0 0 48 24" fill="none">
            <path
              d="M2 12H44"
              stroke="#4F46E5"
              strokeWidth="2"
              strokeDasharray="4 4"
              strokeLinecap="round"
              style={{
                animation: stage === 1 ? "connectorDashFlow 0.8s linear infinite" : "none",
              }}
            />
            <path
              d="M38 7L44 12L38 17"
              stroke="#4F46E5"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Centered Glowing Packet: top 50% & translateY(-50%) guarantees exact alignment on line */}
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
                animation: "connectorPacketTravelX 1s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                pointerEvents: "none",
              }}
            />
          )}
        </Box>

        {/* CONNECTOR 1 (Mobile): Vertical with 100% Centered Dot */}
        <Box
          sx={{
            display: { xs: "flex", lg: "none" },
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            width: 24,
            height: 32,
            my: -0.5,
            zIndex: 3,
          }}
        >
          <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
            <path
              d="M12 2V26"
              stroke="#4F46E5"
              strokeWidth="2"
              strokeDasharray="4 4"
              strokeLinecap="round"
              style={{
                animation: stage === 1 ? "connectorDashFlow 0.8s linear infinite" : "none",
              }}
            />
            <path
              d="M7 21L12 26L17 21"
              stroke="#4F46E5"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Centered Glowing Packet (Vertical): left 50% & translateX(-50%) */}
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
                animation: "connectorPacketTravelY 1s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                pointerEvents: "none",
              }}
            />
          )}
        </Box>

        {/* SECTION 2: Center ProxiPilot Intelligence Card */}
        <Box
          sx={{
            width: "100%",
            maxWidth: { xs: 360, sm: 440, lg: "none" },
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

        {/* CONNECTOR 2 (Desktop): Center -> Right with 100% Centered Dot */}
        <Box
          sx={{
            display: { xs: "none", lg: "flex" },
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            width: 48,
            height: 24,
            flexShrink: 0,
            zIndex: 3,
          }}
        >
          <svg width="48" height="24" viewBox="0 0 48 24" fill="none">
            <path
              d="M2 12H44"
              stroke="#4F46E5"
              strokeWidth="2"
              strokeDasharray="4 4"
              strokeLinecap="round"
              style={{
                animation: stage === 3 ? "connectorDashFlow 0.8s linear infinite" : "none",
              }}
            />
            <path
              d="M38 7L44 12L38 17"
              stroke="#4F46E5"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Centered Emerald Packet */}
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
                animation: "connectorPacketTravelX 1s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                pointerEvents: "none",
              }}
            />
          )}
        </Box>

        {/* CONNECTOR 2 (Mobile): Vertical Center -> Right with 100% Centered Dot */}
        <Box
          sx={{
            display: { xs: "flex", lg: "none" },
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            width: 24,
            height: 32,
            my: -0.5,
            zIndex: 3,
          }}
        >
          <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
            <path
              d="M12 2V26"
              stroke="#4F46E5"
              strokeWidth="2"
              strokeDasharray="4 4"
              strokeLinecap="round"
              style={{
                animation: stage === 3 ? "connectorDashFlow 0.8s linear infinite" : "none",
              }}
            />
            <path
              d="M7 21L12 26L17 21"
              stroke="#4F46E5"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Centered Emerald Packet (Vertical) */}
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
                animation: "connectorPacketTravelY 1s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                pointerEvents: "none",
              }}
            />
          )}
        </Box>

        {/* SECTION 3: Right Draft Response Card */}
        <Box
          sx={{
            width: "100%",
            maxWidth: { xs: 360, sm: 360, lg: "none" },
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
    </Box>
  );
}
