"use client";

import React, { Suspense, useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import { useIntegrationsStore } from "@/stores/integrations.store";
import { useIntegrations } from "@/hooks/use-integrations";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  IntegrationsHeader,
  GmailHeroCard,
  ConnectedAccountsSection,
  IntegrationHowItWorks,
  ComingSoonGrid,
  DisconnectConfirmDialog,
  RequestIntegrationDialog,
  OAuthConnectModal,
  GmailAccountDetailModal,
} from "@/components/integrations";

// ─── Auto-dismissing animated success toast banner ───────────────────────────

const DISMISS_AFTER_MS = 5500;

interface OAuthSuccessBannerProps {
  email: string | null;
}

function OAuthSuccessBanner({ email }: OAuthSuccessBannerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);

  // Strip the OAuth query params from the URL immediately so a refresh
  // doesn't re-show the banner, and so Back/Forward history is clean.
  useEffect(() => {
    router.replace(pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-dismiss after DISMISS_AFTER_MS
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), DISMISS_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = useCallback(() => setVisible(false), []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="oauth-success-banner"
          initial={{ opacity: 0, y: -16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.97 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          style={{ marginBottom: 24 }}
        >
          <Box
            sx={{
              p: "14px 16px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #ECFDF5 0%, #F0FFF4 100%)",
              border: "1px solid #A7F3D0",
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              boxShadow: "0 4px 20px rgba(16, 185, 129, 0.10)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Animated progress bar at the bottom — drains over DISMISS_AFTER_MS */}
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: DISMISS_AFTER_MS / 1000, ease: "linear" }}
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 3,
                backgroundColor: "#10B981",
                transformOrigin: "left",
                borderRadius: "0 0 14px 14px",
              }}
            />

            {/* Pulsing success icon */}
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: "10px",
                backgroundColor: "#D1FAE5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: "#059669",
              }}
            >
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.15, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </motion.div>
            </Box>

            {/* Text content */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: "13.5px",
                  fontWeight: 700,
                  color: "#065F46",
                  lineHeight: 1.4,
                }}
              >
                Gmail Mailbox Connected Successfully
              </Typography>
              <Typography
                sx={{
                  fontSize: "12px",
                  color: "#047857",
                  mt: 0.25,
                  lineHeight: 1.4,
                }}
              >
                {email
                  ? `${email} is now synchronized.`
                  : "Real-time Google Cloud Pub/Sub synchronization has been registered."}
              </Typography>
            </Box>

            {/* Manual close button */}
            <IconButton
              onClick={dismiss}
              size="small"
              aria-label="Dismiss notification"
              sx={{
                color: "#6EE7B7",
                flexShrink: 0,
                p: 0.5,
                "&:hover": { color: "#059669", backgroundColor: "#D1FAE5" },
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </IconButton>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main page content ────────────────────────────────────────────────────────

function IntegrationsContent() {
  const searchParams = useSearchParams();
  const isConnectedRedirect = searchParams.get("connected") === "true";
  const connectedEmail = searchParams.get("email");

  const {
    accounts: serverAccounts,
    isLoading: isServerLoading,
    connectGmail,
    disconnectAccount: serverDisconnect,
    reconnectAccount: serverReconnect,
    triggerManualSync: serverSync,
    refetch,
  } = useIntegrations();

  const {
    isConnectModalOpen,
    setConnectModalOpen,
    isDisconnectModalOpen,
    accountToDisconnect,
    openDisconnectModal,
    closeDisconnectModal,
    isRequestModalOpen,
    setRequestModalOpen,
    isDetailModalOpen,
    selectedAccountForDetail,
    openDetailModal,
    closeDetailModal,
    submitIntegrationRequest,
  } = useIntegrationsStore();

  // Auto-refresh accounts when redirected back from successful OAuth
  React.useEffect(() => {
    if (isConnectedRedirect) {
      refetch();
    }
  }, [isConnectedRedirect, refetch]);

  const accounts = serverAccounts;

  const handleAuthorize = async (email: string, displayName?: string, isCancelled?: () => boolean) => {
    await connectGmail({ emailHint: email, displayName, isCancelled });
  };

  const handleConfirmDisconnect = async () => {
    if (accountToDisconnect) {
      await serverDisconnect(accountToDisconnect.id);
      closeDisconnectModal();
    }
  };

  const handleNeedHelp = () => {
    window.open("https://docs.proxipilot.com/integrations", "_blank", "noopener,noreferrer");
  };

  const handleLearnMore = () => {
    window.open("https://docs.proxipilot.com/integrations/gmail", "_blank", "noopener,noreferrer");
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        pb: { xs: 4, md: 6 },
        maxWidth: 1200,
        mx: "auto",
        width: "100%",
      }}
    >
      {/* Animated auto-dismiss OAuth success banner */}
      {isConnectedRedirect && (
        <OAuthSuccessBanner email={connectedEmail} />
      )}

      {/* 1. Header with Breadcrumb, Title & Right Action Button */}
      <IntegrationsHeader onNeedHelpClick={handleNeedHelp} />

      {/* 2. Gmail Primary Hero Card */}
      <GmailHeroCard
        onConnectClick={() => setConnectModalOpen(true)}
        onLearnMoreClick={handleLearnMore}
        hasConnectedAccounts={accounts.length > 0}
      />

      {/* 3. Connected Accounts Section (rendered when 1 or more Gmail accounts are connected) */}
      <ConnectedAccountsSection
        accounts={accounts}
        onConnectAnother={() => setConnectModalOpen(true)}
        onManageAccount={(account) => openDetailModal(account)}
        onDisconnectAccount={(account) => openDisconnectModal(account)}
        onManualSync={(id) => serverSync(id)}
        onReconnectAccount={(id) => serverReconnect(id)}
      />

      {/* 4. How It Works Section (3 steps with connector chevrons) */}
      <IntegrationHowItWorks />

      {/* 5. More Integrations Section (6 cards in responsive grid + Request button) */}
      <ComingSoonGrid onRequestIntegration={() => setRequestModalOpen(true)} />

      {/* Modals and Dialogs */}
      <OAuthConnectModal
        open={isConnectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        onAuthorize={handleAuthorize}
      />

      <DisconnectConfirmDialog
        open={isDisconnectModalOpen}
        account={accountToDisconnect}
        onClose={closeDisconnectModal}
        onConfirm={handleConfirmDisconnect}
      />

      <RequestIntegrationDialog
        open={isRequestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        onSubmit={submitIntegrationRequest}
      />

      <GmailAccountDetailModal
        open={isDetailModalOpen}
        account={selectedAccountForDetail}
        onClose={closeDetailModal}
        onDisconnect={(acc) => {
          closeDetailModal();
          openDisconnectModal(acc);
        }}
        onSyncNow={(id) => serverSync(id)}
        onReconnect={(id) => serverReconnect(id)}
      />
    </Box>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
          <CircularProgress size={32} sx={{ color: "#2563EB" }} />
        </Box>
      }
    >
      <IntegrationsContent />
    </Suspense>
  );
}
