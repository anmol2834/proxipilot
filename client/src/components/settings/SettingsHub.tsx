"use client";

/**
 * SettingsHub — Redesigned settings center with a categorized side-navigation panel,
 * strictly matching the reference design in media_1795168926300_e445b18c.jpg.
 *
 * Information Architecture:
 * - Top Breadcrumb Header: "Settings > [Active Section]"
 * - Categorized Left Side Navigation (Fixed, independent scrolling):
 *   ACCOUNT:
 *     - My Profile (profile) — Includes Personal Identity, Workspace Identity, Organization ID, Workspace Role, Sign out
 *     - General (general) — Reference layout with Notifications & Settings
 *     - Preferences (preferences)
 *     - Applications (applications)
 *   WORKSPACE:
 *     - Follow-ups & AI (follow-ups) — Full policy editor
 *     - Security (security)
 *     - Billing (billing)
 *     - Data & Privacy (data-privacy)
 *     - Delete Data (delete) — Delete Business Knowledge, Conversations, Complete Account
 */

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { styled } from "@mui/material/styles";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Skeleton from "@mui/material/Skeleton";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  IconAdjustments,
  IconAlertTriangle,
  IconBrain,
  IconBuilding,
  IconCheck,
  IconChevronRight,
  IconCopy,
  IconCreditCard,
  IconDatabase,
  IconDatabaseOff,
  IconDeviceDesktop,
  IconDownload,
  IconExternalLink,
  IconFingerprint,
  IconHome,
  IconInbox,
  IconLayoutGrid,
  IconLink,
  IconLock,
  IconLogout,
  IconMail,
  IconMessageOff,
  IconPencil,
  IconPlug,
  IconRocket,
  IconSettings,
  IconShield,
  IconShieldCheck,
  IconSparkles,
  IconStack2,
  IconTrash,
  IconUser,
  IconUsers,
  IconUserX,
} from "@tabler/icons-react";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { useIntegrations } from "@/hooks/use-integrations";
import type { ConnectedIntegrationAccount } from "@/types/integrations.types";
import { FollowupSettings } from "./FollowupSettings";
import { toast } from "@/stores/notification.store";

export type SettingsTabKey =
  | "profile"
  | "general"
  | "preferences"
  | "applications"
  | "follow-ups"
  | "security"
  | "billing"
  | "data-privacy"
  | "delete";

interface MenuItem {
  key: SettingsTabKey;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; stroke?: number }>;
}

interface MenuCategory {
  category: string;
  items: MenuItem[];
}

const MENU_CATEGORIES: MenuCategory[] = [
  {
    category: "ACCOUNT",
    items: [
      { key: "profile", label: "My Profile", icon: IconUser },
      { key: "general", label: "General", icon: IconHome },
      { key: "preferences", label: "Preferences", icon: IconAdjustments },
      { key: "applications", label: "Applications", icon: IconLayoutGrid },
    ],
  },
  {
    category: "WORKSPACE",
    items: [
      { key: "follow-ups", label: "Follow-ups & AI", icon: IconRocket },
      { key: "security", label: "Security", icon: IconLock },
      { key: "billing", label: "Billing", icon: IconCreditCard },
      { key: "data-privacy", label: "Data & Privacy", icon: IconShieldCheck },
      { key: "delete", label: "Delete Data", icon: IconTrash },
    ],
  },
];

/** All known tabs flat list for easy lookup */
const ALL_ITEMS = MENU_CATEGORIES.flatMap((c) => c.items);

/** Custom switch matching reference design */
export const UntitledSwitch = styled(Switch)(() => ({
  width: 42,
  height: 24,
  padding: 0,
  display: "flex",
  "& .MuiSwitch-switchBase": {
    padding: 2,
    "&.Mui-checked": {
      transform: "translateX(18px)",
      color: "#FFFFFF",
      "& + .MuiSwitch-track": {
        backgroundColor: "#3538CD",
        opacity: 1,
        border: 0,
      },
      "&.Mui-disabled + .MuiSwitch-track": {
        opacity: 0.6,
      },
    },
    "&.Mui-disabled .MuiSwitch-thumb": {
      color: "#FFFFFF",
    },
    "&.Mui-disabled + .MuiSwitch-track": {
      opacity: 0.8,
      backgroundColor: "#F2F4F7",
    },
  },
  "& .MuiSwitch-thumb": {
    boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.15), 0px 1px 3px rgba(16, 24, 40, 0.1)",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  "& .MuiSwitch-track": {
    borderRadius: 12,
    opacity: 1,
    backgroundColor: "#EAECF0",
    boxSizing: "border-box",
  },
}));

/** Secondary clean button */
const secondaryBtnSx = {
  backgroundColor: "#FFFFFF",
  border: "1px solid #D0D5DD",
  borderRadius: "8px",
  color: "#344054",
  fontSize: 14,
  fontWeight: 600,
  textTransform: "none",
  px: "14px",
  py: "8px",
  boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
  "&:hover": {
    backgroundColor: "#F9FAFB",
    borderColor: "#D0D5DD",
  },
};

/** Standard Preference Row */
function PreferenceRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "flex-start", sm: "center" },
        justifyContent: "space-between",
        py: 2.25,
        gap: { xs: 1.5, sm: 3 },
        borderBottom: "1px solid #F2F4F7",
      }}
    >
      <Box sx={{ maxWidth: 520 }}>
        <Typography sx={{ fontSize: 14.5, fontWeight: 600, color: "#101828" }}>{title}</Typography>
        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25, lineHeight: 1.45 }}>
          {description}
        </Typography>
      </Box>
      <Box sx={{ flexShrink: 0 }}>{children}</Box>
    </Box>
  );
}

type DeletionModalType = "knowledge" | "conversations" | "account" | null;

/** Plan visual themes, glowing gradients, tags, and AI credit limits */
const PLAN_CONFIGS: Record<
  string,
  {
    name: string;
    tagLabel: string;
    ringGradient: string;
    avatarShadow: string;
    tagBg: string;
    tagBorder: string;
    badgeBg: string;
    badgeBorder: string;
    badgeColor: string;
    barGradient: string;
    totalCredits: number;
    usedCredits: number;
  }
> = {
  starter: {
    name: "Starter",
    tagLabel: "STARTER",
    ringGradient: "linear-gradient(135deg, #10B981 0%, #06B6D4 50%, #3B82F6 100%)",
    avatarShadow: "0 0 10px rgba(16, 185, 129, 0.22)",
    tagBg: "linear-gradient(135deg, #059669 0%, #0D9488 100%)",
    tagBorder: "#34D399",
    badgeBg: "#ECFDF5",
    badgeBorder: "#A7F3D0",
    badgeColor: "#047857",
    barGradient: "linear-gradient(90deg, #10B981 0%, #06B6D4 100%)",
    totalCredits: 500,
    usedCredits: 160,
  },
  growth: {
    name: "Growth",
    tagLabel: "GROWTH",
    ringGradient: "linear-gradient(135deg, #8B5CF6 0%, #6366F1 50%, #EC4899 100%)",
    avatarShadow: "0 0 10px rgba(139, 92, 246, 0.25)",
    tagBg: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 50%, #DB2777 100%)",
    tagBorder: "#C084FC",
    badgeBg: "#EEF2FF",
    badgeBorder: "#C7D7FE",
    badgeColor: "#4338CA",
    barGradient: "linear-gradient(90deg, #6366F1 0%, #8B5CF6 50%, #EC4899 100%)",
    totalCredits: 2500,
    usedCredits: 660,
  },
  business: {
    name: "Business",
    tagLabel: "BUSINESS",
    ringGradient: "linear-gradient(135deg, #F59E0B 0%, #EF4444 50%, #8B5CF6 100%)",
    avatarShadow: "0 0 10px rgba(245, 158, 11, 0.25)",
    tagBg: "linear-gradient(135deg, #D97706 0%, #DC2626 50%, #7C3AED 100%)",
    tagBorder: "#FBBF24",
    badgeBg: "#FFFBEB",
    badgeBorder: "#FDE68A",
    badgeColor: "#B45309",
    barGradient: "linear-gradient(90deg, #F59E0B 0%, #EF4444 50%, #8B5CF6 100%)",
    totalCredits: 10000,
    usedCredits: 2150,
  },
  enterprise: {
    name: "Enterprise",
    tagLabel: "ENTERPRISE",
    ringGradient: "linear-gradient(135deg, #2563EB 0%, #7C3AED 50%, #06B6D4 100%)",
    avatarShadow: "0 0 10px rgba(37, 99, 235, 0.25)",
    tagBg: "linear-gradient(135deg, #1D4ED8 0%, #4F46E5 100%)",
    tagBorder: "#60A5FA",
    badgeBg: "#EFF6FF",
    badgeBorder: "#BFDBFE",
    badgeColor: "#1D4ED8",
    barGradient: "linear-gradient(90deg, #2563EB 0%, #7C3AED 100%)",
    totalCredits: 50000,
    usedCredits: 8400,
  },
};

export function SettingsHub() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get("tab");
  const activeTab: SettingsTabKey = useMemo(() => {
    // Backward-compatibility aliases
    if (
      rawTab === "account-security" ||
      rawTab === "workspace" ||
      rawTab === "settings" ||
      rawTab === "members" ||
      rawTab === "team" ||
      rawTab === "team-access"
    ) {
      return "profile";
    }
    if (rawTab === "notifications") return "general";
    if (rawTab === "integrations") return "applications";
    if (rawTab === "upgrade") return "billing";
    if (rawTab === "templates") return "preferences";
    if (rawTab === "delete" || rawTab === "delete-data" || rawTab === "danger-zone") return "delete";

    if (rawTab && ALL_ITEMS.some((t) => t.key === rawTab)) {
      return rawTab as SettingsTabKey;
    }
    return "general";
  }, [rawTab]);

  const activeMeta = useMemo(() => {
    return ALL_ITEMS.find((item) => item.key === activeTab) || ALL_ITEMS[1];
  }, [activeTab]);

  const handleSelectTab = useCallback(
    (tabKey: SettingsTabKey) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tabKey);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const { user, signout } = useAuth();
  const { organizationId, currentOrganization, role } = useTenant();
  const { accounts = [], isLoading: isLoadingIntegrations } = useIntegrations();

  // Active subscription plan and AI credits computation
  const rawPlan = (
    ((currentOrganization as any)?.plan || (user as any)?.plan || "growth") as string
  ).toLowerCase();
  const hasPlan = Boolean(rawPlan && rawPlan !== "none" && rawPlan !== "unpaid");
  const planKey = (rawPlan in PLAN_CONFIGS ? rawPlan : "growth") as keyof typeof PLAN_CONFIGS;
  const planMeta = PLAN_CONFIGS[planKey];
  const creditsTotal = planMeta.totalCredits;
  const creditsUsed = (currentOrganization as any)?.credits_used ?? planMeta.usedCredits;
  const creditsRemaining = Math.max(0, creditsTotal - creditsUsed);
  const percentRemaining = Math.round((creditsRemaining / creditsTotal) * 100);

  // Organization copy ID
  const [copiedId, setCopiedId] = useState(false);
  const handleCopyOrgId = () => {
    if (!organizationId) return;
    navigator.clipboard.writeText(organizationId);
    setCopiedId(true);
    toast.success("Organization ID copied to clipboard");
    setTimeout(() => setCopiedId(false), 2000);
  };

  // State for General screen (matching reference screenshot)
  const [productivityUpdate, setProductivityUpdate] = useState(true);
  const [newEventCreated, setNewEventCreated] = useState(true);
  const [addedOnNewTeam, setAddedOnNewTeam] = useState(true);

  const [mobilePush, setMobilePush] = useState(true);
  const [desktopNotification, setDesktopNotification] = useState(true);
  const [emailNotification, setEmailNotification] = useState(false);

  const [appearance, setAppearance] = useState("Light");
  const [twoFactorAuth, setTwoFactorAuth] = useState(true);
  const [language, setLanguage] = useState("English");

  // Deletion UI interactive modal state
  const [activeDeleteModal, setActiveDeleteModal] = useState<DeletionModalType>(null);
  const [confirmInputText, setConfirmInputText] = useState("");
  const [confirmUnderstood, setConfirmUnderstood] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCloseDeleteModal = () => {
    setActiveDeleteModal(null);
    setConfirmInputText("");
    setConfirmUnderstood(false);
    setIsDeleting(false);
  };

  const requiredConfirmationKeyword = useMemo(() => {
    if (activeDeleteModal === "knowledge") return "DELETE KNOWLEDGE";
    if (activeDeleteModal === "conversations") return "DELETE CONVERSATIONS";
    if (activeDeleteModal === "account") return "DELETE MY ACCOUNT";
    return "";
  }, [activeDeleteModal]);

  const isConfirmationValid =
    confirmInputText.trim().toUpperCase() === requiredConfirmationKeyword && confirmUnderstood;

  const handleConfirmDeletion = () => {
    if (!isConfirmationValid) return;
    setIsDeleting(true);
    setTimeout(() => {
      setIsDeleting(false);
      if (activeDeleteModal === "knowledge") {
        toast.success(
          "Business knowledge documents and AI training scheduled for permanent deletion."
        );
      } else if (activeDeleteModal === "conversations") {
        toast.success(
          "All conversation threads, drafts, and message history scheduled for complete deletion."
        );
      } else if (activeDeleteModal === "account") {
        toast.success(
          "Account profile and all associated data scheduled for permanent erasure."
        );
      }
      handleCloseDeleteModal();
    }, 1000);
  };

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        backgroundColor: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* 1. Top Breadcrumb Bar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          px: { xs: 2.5, sm: 4 },
          py: 2,
          borderBottom: "1px solid #F1F3F5",
          backgroundColor: "#FFFFFF",
          flexShrink: 0,
        }}
      >
        <Typography sx={{ fontSize: 18, fontWeight: 700, color: "#101828" }}>Settings</Typography>
        <Typography sx={{ fontSize: 16, color: "#98A2B3", mx: 1.25, fontWeight: 500 }}>&gt;</Typography>
        <Typography sx={{ fontSize: 16, color: "#667085", fontWeight: 500 }}>{activeMeta.label}</Typography>
      </Box>

      {/* 2. Split-Pane: Side Navigation (Fixed) + Content Panel (Scrollable) */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          flex: 1,
          minHeight: 0,
          overflow: { xs: "auto", md: "hidden" },
          backgroundColor: "#FFFFFF",
        }}
      >
        {/* Left Side Navigation Panel — Fixed and non-scrolling with the right side panel */}
        <Box
          component="nav"
          aria-label="Settings navigation"
          sx={{
            width: { xs: "100%", md: 230 },
            flexShrink: 0,
            height: { xs: "auto", md: "100%" },
            overflowY: { xs: "visible", md: "auto" },
            borderRight: { xs: "none", md: "1px solid #F1F3F5" },
            borderBottom: { xs: "1px solid #F1F3F5", md: "none" },
            py: 3,
            px: 2,
            display: "flex",
            flexDirection: "column",
            gap: 3,
            "&::-webkit-scrollbar": { width: 4 },
            "&::-webkit-scrollbar-thumb": { backgroundColor: "#EAECF0", borderRadius: 4 },
          }}
        >
          {MENU_CATEGORIES.map((cat) => (
            <Box key={cat.category} sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Typography
                sx={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#98A2B3",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  px: 1.5,
                  mb: 0.5,
                }}
              >
                {cat.category}
              </Typography>

              {cat.items.map((item) => {
                const Icon = item.icon;
                const isSelected = activeTab === item.key;
                const isDelete = item.key === "delete";

                return (
                  <Box
                    key={item.key}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectTab(item.key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectTab(item.key);
                      }
                    }}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.25,
                      px: 1.5,
                      py: 1,
                      borderRadius: "8px",
                      cursor: "pointer",
                      backgroundColor: isSelected
                        ? isDelete
                          ? "#FEF3F2"
                          : "#EEF2FF"
                        : "transparent",
                      color: isSelected
                        ? isDelete
                          ? "#D92D20"
                          : "#4F46E5"
                        : isDelete
                        ? "#B42318"
                        : "#475467",
                      transition: "all 120ms ease",
                      outline: "none",
                      "&:hover": {
                        backgroundColor: isSelected
                          ? isDelete
                            ? "#FEF3F2"
                            : "#EEF2FF"
                          : isDelete
                          ? "#FEF3F2"
                          : "#F9FAFB",
                        color: isDelete ? "#D92D20" : isSelected ? "#4F46E5" : "#101828",
                      },
                      "&:focus-visible": {
                        boxShadow: "0 0 0 2px #BFDBFE",
                      },
                    }}
                  >
                    <Icon
                      size={18}
                      stroke={isSelected ? 2.2 : 1.8}
                      color={
                        isSelected
                          ? isDelete
                            ? "#D92D20"
                            : "#4F46E5"
                          : isDelete
                          ? "#D92D20"
                          : "#667085"
                      }
                    />
                    <Typography
                      sx={{
                        fontSize: 13.5,
                        fontWeight: isSelected ? 600 : 500,
                        color: "inherit",
                      }}
                    >
                      {item.label}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          ))}
        </Box>

        {/* Right Main Content Panel — Independently scrollable */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            height: { xs: "auto", md: "100%" },
            overflowY: { xs: "visible", md: "auto" },
            px: { xs: 2, sm: 3, md: 4 },
            py: { xs: 2.5, sm: 3 },
            "&::-webkit-scrollbar": { width: 6 },
            "&::-webkit-scrollbar-thumb": { backgroundColor: "#EAECF0", borderRadius: 4 },
          }}
        >
          <Box sx={{ width: "100%", maxWidth: 960, mx: "auto" }}>
            {/* TAB: General (Exact UI from Reference Screenshot) */}
            {activeTab === "general" && (
              <Box sx={{ display: "flex", flexDirection: "column" }}>
                {/* My Notifications Header */}
                <Typography sx={{ fontSize: 18, fontWeight: 700, color: "#101828", mb: 2 }}>
                  My Notifications
                </Typography>

                {/* Notify me when... */}
                <Box sx={{ mb: 2.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                      Notify me when...
                    </Typography>
                    <Typography
                      component="a"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        toast.info("Notifications are sent based on your workspace activity preferences.");
                      }}
                      sx={{ fontSize: 13, color: "#3538CD", fontWeight: 500, textDecoration: "none", cursor: "pointer" }}
                    >
                      About notifications?
                    </Typography>
                  </Box>

                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Checkbox
                        checked={productivityUpdate}
                        onChange={(e) => setProductivityUpdate(e.target.checked)}
                        disableRipple
                        sx={{ p: 0, color: "#D0D5DD", "&.Mui-checked": { color: "#3538CD" } }}
                      />
                      <Typography sx={{ fontSize: 13.5, color: "#344054", fontWeight: 500 }}>
                        Daily productivity update
                      </Typography>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Checkbox
                        checked={newEventCreated}
                        onChange={(e) => setNewEventCreated(e.target.checked)}
                        disableRipple
                        sx={{ p: 0, color: "#D0D5DD", "&.Mui-checked": { color: "#3538CD" } }}
                      />
                      <Typography sx={{ fontSize: 13.5, color: "#344054", fontWeight: 500 }}>
                        New event created
                      </Typography>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Checkbox
                        checked={addedOnNewTeam}
                        onChange={(e) => setAddedOnNewTeam(e.target.checked)}
                        disableRipple
                        sx={{ p: 0, color: "#D0D5DD", "&.Mui-checked": { color: "#3538CD" } }}
                      />
                      <Typography sx={{ fontSize: 13.5, color: "#344054", fontWeight: 500 }}>
                        When added on new team
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Notification Channels */}
                <Box sx={{ display: "flex", flexDirection: "column", mb: 4 }}>
                  <PreferenceRow
                    title="Mobile push notifications"
                    description="Receive push notification whenever your organisation requires your attentions"
                  >
                    <UntitledSwitch
                      checked={mobilePush}
                      onChange={(e) => setMobilePush(e.target.checked)}
                      slotProps={{ input: { "aria-label": "Mobile push notifications" } }}
                    />
                  </PreferenceRow>

                  <PreferenceRow
                    title="Desktop Notification"
                    description="Receive desktop notification whenever your organisation requires your attentions"
                  >
                    <UntitledSwitch
                      checked={desktopNotification}
                      onChange={(e) => setDesktopNotification(e.target.checked)}
                      slotProps={{ input: { "aria-label": "Desktop Notification" } }}
                    />
                  </PreferenceRow>

                  <PreferenceRow
                    title="Email Notification"
                    description="Receive email whenever your organisation requires your attentions"
                  >
                    <UntitledSwitch
                      checked={emailNotification}
                      onChange={(e) => setEmailNotification(e.target.checked)}
                      slotProps={{ input: { "aria-label": "Email Notification" } }}
                    />
                  </PreferenceRow>
                </Box>

                {/* My Settings Header */}
                <Typography sx={{ fontSize: 18, fontWeight: 700, color: "#101828", mb: 2 }}>
                  My Settings
                </Typography>

                {/* Settings Rows */}
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                  <PreferenceRow
                    title="Appearance"
                    description="Customize how you theams looks on your device."
                  >
                    <Box
                      component="select"
                      value={appearance}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAppearance(e.target.value)}
                      sx={{
                        backgroundColor: "#F9FAFB",
                        border: "1px solid #EAECF0",
                        borderRadius: "8px",
                        px: 2,
                        py: 0.75,
                        fontSize: 13.5,
                        fontWeight: 500,
                        color: "#344054",
                        outline: "none",
                        cursor: "pointer",
                        minWidth: 100,
                        "&:hover": { borderColor: "#D0D5DD" },
                      }}
                    >
                      <option value="Light">Light ∨</option>
                      <option value="Dark">Dark ∨</option>
                      <option value="System">System ∨</option>
                    </Box>
                  </PreferenceRow>

                  <PreferenceRow
                    title="Two-factor authentication"
                    description="Keep your account secure by enabling 2FA via SMS or using a temporary one-time passcode (TOTP)."
                  >
                    <UntitledSwitch
                      checked={twoFactorAuth}
                      onChange={(e) => setTwoFactorAuth(e.target.checked)}
                      slotProps={{ input: { "aria-label": "Two-factor authentication" } }}
                    />
                  </PreferenceRow>

                  <PreferenceRow
                    title="Language"
                    description="Customize how you theams looks on your device."
                  >
                    <Box
                      component="select"
                      value={language}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLanguage(e.target.value)}
                      sx={{
                        backgroundColor: "#F9FAFB",
                        border: "1px solid #EAECF0",
                        borderRadius: "8px",
                        px: 2,
                        py: 0.75,
                        fontSize: 13.5,
                        fontWeight: 500,
                        color: "#344054",
                        outline: "none",
                        cursor: "pointer",
                        minWidth: 100,
                        "&:hover": { borderColor: "#D0D5DD" },
                      }}
                    >
                      <option value="English">English ∨</option>
                      <option value="Spanish">Spanish ∨</option>
                      <option value="French">French ∨</option>
                      <option value="German">German ∨</option>
                    </Box>
                  </PreferenceRow>
                </Box>
              </Box>
            )}

            {/* TAB: Follow-ups & AI (Full Policy Engine) */}
            {activeTab === "follow-ups" && (
              <Box sx={{ display: "flex", flexDirection: "column" }}>
                <FollowupSettings isTabActive={activeTab === "follow-ups"} />
              </Box>
            )}

            {/* TAB: My Profile (Exact Redesign matching media_1795172528489_6e392550.jpg) */}
            {activeTab === "profile" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, width: "100%" }}>
                {/* Profile Title Header with AI Credits Left Card on complete right side */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: { xs: "flex-start", sm: "center" },
                    justifyContent: "space-between",
                    flexDirection: { xs: "column", sm: "row" },
                    gap: 2,
                    mb: 0.5,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.75 }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: "12px",
                        backgroundColor: "#EEF2FF",
                        color: "#4F46E5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IconUser size={24} stroke={2} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 20, fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>
                        My Profile
                      </Typography>
                      <Typography sx={{ fontSize: 13.5, color: "#6B7280", mt: 0.25 }}>
                        Your personal identity, workspace credentials, and organization access.
                      </Typography>
                    </Box>
                  </Box>

                  {/* AI Credits Left Card at complete right side of Title section */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.75,
                      backgroundColor: "#FFFFFF",
                      borderRadius: "12px",
                      border: "1px solid #EAECF0",
                      px: 2,
                      py: 1.2,
                      minWidth: { xs: "100%", sm: 260, md: 280 },
                      boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.04)",
                      flexShrink: 0,
                    }}
                  >
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: "10px",
                        background: planMeta.ringGradient,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#FFFFFF",
                        flexShrink: 0,
                      }}
                    >
                      <IconSparkles size={20} stroke={2} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                        <Typography
                          sx={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#64748B",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          AI Credits Left
                        </Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>
                          {creditsRemaining.toLocaleString()}{" "}
                          <Typography component="span" sx={{ fontSize: 11, fontWeight: 500, color: "#94A3B8" }}>
                            / {creditsTotal.toLocaleString()}
                          </Typography>
                        </Typography>
                      </Box>
                      {/* Mini gradient progress bar */}
                      <Box
                        sx={{
                          width: "100%",
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: "#E2E8F0",
                          overflow: "hidden",
                        }}
                      >
                        <Box
                          sx={{
                            width: `${percentRemaining}%`,
                            height: "100%",
                            borderRadius: 3,
                            background: planMeta.barGradient,
                            transition: "width 0.4s ease",
                          }}
                        />
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 0.5 }}>
                        <Typography sx={{ fontSize: 11, color: "#64748B", fontWeight: 500 }}>
                          {percentRemaining}% balance remaining
                        </Typography>
                        <Typography sx={{ fontSize: 10.5, color: "#94A3B8" }}>
                          Resets monthly
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Box>

                {/* 1. Personal Identity Card */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    alignItems: { xs: "flex-start", sm: "center" },
                    justifyContent: "space-between",
                    flexDirection: { xs: "column", sm: "row" },
                    gap: 2.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {/* Left: Avatar with Glowing Plan Ring & Tag + Identity Details */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2.5, flexShrink: 0 }}>
                    {/* Glowing Avatar with floating Plan Tag */}
                    <Box sx={{ position: "relative", flexShrink: 0 }}>
                      <Box
                        sx={{
                          width: 70,
                          height: 70,
                          borderRadius: "50%",
                          p: hasPlan ? "3px" : 0,
                          background: hasPlan ? planMeta.ringGradient : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: hasPlan ? planMeta.avatarShadow : "none",
                          transition: "all 0.3s ease",
                        }}
                      >
                        <Box
                          sx={{
                            width: "100%",
                            height: "100%",
                            borderRadius: "50%",
                            backgroundColor: "#0F172A",
                            color: "#FFFFFF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 25,
                            fontWeight: 700,
                            letterSpacing: "-0.02em",
                          }}
                        >
                          {user?.first_name?.[0]?.toUpperCase() || user?.full_name?.[0]?.toUpperCase() || "A"}
                        </Box>
                      </Box>

                      {/* Attractive Floating Plan Tag Badge */}
                      {hasPlan && (
                        <Box
                          sx={{
                            position: "absolute",
                            bottom: -7,
                            left: "50%",
                            transform: "translateX(-50%)",
                            background: planMeta.tagBg,
                            color: "#FFFFFF",
                            fontSize: "9px",
                            fontWeight: 800,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            px: 1,
                            py: 0.2,
                            borderRadius: "10px",
                            border: `1.5px solid ${planMeta.tagBorder}`,
                            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.12)",
                            whiteSpace: "nowrap",
                            zIndex: 2,
                            display: "flex",
                            alignItems: "center",
                            gap: 0.3,
                          }}
                        >
                          {planMeta.tagLabel}
                        </Box>
                      )}
                    </Box>

                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
                        <Typography sx={{ fontSize: 18, fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>
                          {user?.full_name || user?.first_name || "Anmol Sinha"}
                        </Typography>
                        <Box
                          sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.5,
                            px: 1.2,
                            py: 0.3,
                            borderRadius: "6px",
                            backgroundColor: "#059669",
                            color: "#FFFFFF",
                            fontSize: 11.5,
                            fontWeight: 700,
                            letterSpacing: "0.02em",
                          }}
                        >
                          ✓ Verified
                        </Box>
                        {hasPlan && (
                          <Box
                            sx={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 0.5,
                              px: 1.1,
                              py: 0.3,
                              borderRadius: "6px",
                              backgroundColor: planMeta.badgeBg,
                              border: `1px solid ${planMeta.badgeBorder}`,
                              color: planMeta.badgeColor,
                              fontSize: 11.5,
                              fontWeight: 700,
                              letterSpacing: "0.02em",
                            }}
                          >
                            <IconSparkles size={12} stroke={2.5} />
                            {planMeta.name} Plan
                          </Box>
                        )}
                      </Box>

                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                        <IconMail size={16} color="#6B7280" />
                        <Typography sx={{ fontSize: 13.5, color: "#4B5563" }}>
                          {user?.email || "anmolsinha4321@gmail.com"}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Right: Action Buttons */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap", flexShrink: 0 }}>
                    <Button
                      variant="outlined"
                      startIcon={<IconPencil size={15} />}
                      onClick={() => toast.info("Profile name can be updated in personal settings.")}
                      sx={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #D1D5DB",
                        color: "#374151",
                        textTransform: "none",
                        fontWeight: 600,
                        fontSize: 13,
                        borderRadius: "10px",
                        px: 1.75,
                        py: 0.85,
                        boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                        whiteSpace: "nowrap",
                        "&:hover": { backgroundColor: "#F9FAFB", borderColor: "#9CA3AF" },
                      }}
                    >
                      Edit Profile
                    </Button>

                    <Button
                      variant="contained"
                      startIcon={<IconCreditCard size={15} />}
                      onClick={() => handleSelectTab("billing")}
                      sx={{
                        backgroundColor: "#4F46E5",
                        color: "#FFFFFF",
                        textTransform: "none",
                        fontWeight: 600,
                        fontSize: 13,
                        borderRadius: "10px",
                        px: 2,
                        py: 0.85,
                        boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                        whiteSpace: "nowrap",
                        "&:hover": { backgroundColor: "#4338CA" },
                      }}
                    >
                      Manage Plan
                    </Button>
                  </Box>
                </Box>

                {/* 2. Workspace & Role Card */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.05), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {/* Card Header */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "10px",
                        backgroundColor: "#EEF2FF",
                        color: "#4F46E5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IconUsers size={20} stroke={2} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                        Workspace & Role
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: "#6B7280" }}>
                        Your assigned access level and privileges within this organization.
                      </Typography>
                    </Box>
                  </Box>

                  {/* Content Row */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: { xs: "wrap", md: "nowrap" },
                      gap: 2.5,
                      pt: 0.5,
                    }}
                  >
                    {/* Workspace */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexShrink: 0 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "8px",
                          backgroundColor: "#F3F4F6",
                          color: "#4F46E5",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <IconBuilding size={18} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 11.5, color: "#6B7280", fontWeight: 500 }}>
                          Workspace
                        </Typography>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#111827", whiteSpace: "nowrap" }}>
                          {currentOrganization?.name || "Dolphy India"}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Divider */}
                    <Box sx={{ width: "1px", minWidth: "1px", height: 32, backgroundColor: "#E5E7EB", display: { xs: "none", md: "block" }, flexShrink: 0 }} />

                    {/* Active Plan */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexShrink: 0 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "8px",
                          backgroundColor: planMeta.badgeBg,
                          color: planMeta.badgeColor,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <IconSparkles size={18} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 11.5, color: "#6B7280", fontWeight: 500 }}>
                          Active Plan
                        </Typography>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#111827", whiteSpace: "nowrap" }}>
                          {planMeta.name} Plan
                        </Typography>
                      </Box>
                    </Box>

                    {/* Divider */}
                    <Box sx={{ width: "1px", minWidth: "1px", height: 32, backgroundColor: "#E5E7EB", display: { xs: "none", md: "block" }, flexShrink: 0 }} />

                    {/* Your Role */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexShrink: 0 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "8px",
                          backgroundColor: "#F3F4F6",
                          color: "#4F46E5",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <IconShield size={18} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 11.5, color: "#6B7280", fontWeight: 500, mb: 0.25 }}>
                          Your Role
                        </Typography>
                        <Box
                          sx={{
                            display: "inline-block",
                            px: 1.2,
                            py: 0.25,
                            borderRadius: "6px",
                            backgroundColor: "#4F46E5",
                            color: "#FFFFFF",
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {role ? role.toUpperCase() : "OWNER"}
                        </Box>
                      </Box>
                    </Box>

                    {/* Divider */}
                    <Box sx={{ width: "1px", minWidth: "1px", height: 32, backgroundColor: "#E5E7EB", display: { xs: "none", md: "block" }, flexShrink: 0 }} />

                    {/* Team Access */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexShrink: 0 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "8px",
                          backgroundColor: "#F3F4F6",
                          color: "#4F46E5",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <IconUsers size={18} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 11.5, color: "#6B7280", fontWeight: 500 }}>
                          Team Access
                        </Typography>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#111827", whiteSpace: "nowrap" }}>
                          {currentOrganization?.member_count ? `${currentOrganization.member_count} member${currentOrganization.member_count > 1 ? "s" : ""}` : "1 member"}
                        </Typography>
                      </Box>
                    </Box>

                    {/* View Team Button */}
                    <Button
                      component={Link}
                      href="/dashboard/team"
                      startIcon={<IconUsers size={16} color="#4F46E5" />}
                      sx={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #C7D7FE",
                        color: "#1E1B4B",
                        textTransform: "none",
                        fontWeight: 600,
                        fontSize: 13,
                        borderRadius: "10px",
                        px: 2,
                        py: 0.85,
                        boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.04)",
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                        ml: { xs: 0, md: "auto" },
                        "&:hover": { backgroundColor: "#EEF2FF", borderColor: "#A5B4FC" },
                      }}
                    >
                      View Team →
                    </Button>
                  </Box>
                </Box>

                {/* 3. Workspace Identity Card */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.05), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {/* Card Header */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "10px",
                        backgroundColor: "#EEF2FF",
                        color: "#4F46E5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IconStack2 size={20} stroke={2} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                        Workspace Identity
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: "#6B7280" }}>
                        The public display name and unique URL identifier for this organization.
                      </Typography>
                    </Box>
                  </Box>

                  {/* 3 Fields in a row */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 2,
                      flexWrap: { xs: "wrap", md: "nowrap" },
                    }}
                  >
                    {/* Field 1: Display Name */}
                    <Box sx={{ flex: 1, minWidth: 180 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.75 }}>
                        <IconBuilding size={15} color="#6B7280" />
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>
                          Display Name
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          backgroundColor: "#F9FAFB",
                          border: "1px solid #E5E7EB",
                          borderRadius: "8px",
                          px: 1.75,
                          py: 0.9,
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "#111827",
                        }}
                      >
                        {currentOrganization?.name || "Dolphy India"}
                      </Box>
                    </Box>

                    {/* Field 2: Slug */}
                    <Box sx={{ flex: 1, minWidth: 180 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.75 }}>
                        <IconLink size={15} color="#6B7280" />
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>
                          Slug (URL Identifier)
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          backgroundColor: "#F9FAFB",
                          border: "1px solid #E5E7EB",
                          borderRadius: "8px",
                          px: 1.75,
                          py: 0.9,
                          fontSize: 13.5,
                          fontWeight: 500,
                          color: "#374151",
                        }}
                      >
                        {currentOrganization?.slug || "dolphy-india"}
                      </Box>
                    </Box>

                    {/* Field 3: Organization ID */}
                    <Box sx={{ flex: 1.5, minWidth: 260 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.75 }}>
                        <IconFingerprint size={15} color="#6B7280" />
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>
                          Organization ID
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Box
                          component="code"
                          sx={{
                            flex: 1,
                            backgroundColor: "#F9FAFB",
                            border: "1px solid #E5E7EB",
                            borderRadius: "8px",
                            px: 1.75,
                            py: 0.9,
                            fontSize: 13,
                            fontFamily: "monospace",
                            color: "#374151",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {organizationId || "org_691edeb6c78c4fd1a2f525c3e5005118"}
                        </Box>
                        <Button
                          onClick={handleCopyOrgId}
                          disabled={!organizationId}
                          startIcon={copiedId ? <IconCheck size={14} color="#16A34A" /> : <IconCopy size={14} />}
                          sx={{
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #D1D5DB",
                            color: "#374151",
                            textTransform: "none",
                            fontWeight: 600,
                            fontSize: 13,
                            borderRadius: "8px",
                            px: 1.75,
                            py: 0.85,
                            flexShrink: 0,
                            boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                            "&:hover": { backgroundColor: "#F9FAFB", borderColor: "#9CA3AF" },
                          }}
                        >
                          {copiedId ? "Copied" : "Copy ID"}
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                </Box>

                {/* 4. Account & Session Card */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.05), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {/* Card Header */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "10px",
                        backgroundColor: "#EEF2FF",
                        color: "#4F46E5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IconLock size={20} stroke={2} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                        Account & Session
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: "#6B7280" }}>
                        Manage your account security, active session, and authentication.
                      </Typography>
                    </Box>
                  </Box>

                  {/* 2 Sub-cards + Sign out button */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      flexWrap: { xs: "wrap", md: "nowrap" },
                    }}
                  >
                    {/* Account Protection */}
                    <Box
                      onClick={() => handleSelectTab("security")}
                      sx={{
                        flex: 1,
                        minWidth: 220,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        p: 1.5,
                        borderRadius: "12px",
                        border: "1px solid #E5E7EB",
                        backgroundColor: "#FFFFFF",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        "&:hover": { backgroundColor: "#F9FAFB", borderColor: "#D1D5DB" },
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: "10px",
                            backgroundColor: "#EEF2FF",
                            color: "#4F46E5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconShieldCheck size={20} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: "#111827" }}>
                            Account Protection
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: "#6B7280" }}>
                            Update your security and authentication settings.
                          </Typography>
                        </Box>
                      </Box>
                      <IconChevronRight size={16} color="#9CA3AF" />
                    </Box>

                    {/* Active Session */}
                    <Box
                      onClick={() => {
                        toast.info(`Active session: Current session authenticated as ${user?.email || "user"}`);
                      }}
                      sx={{
                        flex: 1,
                        minWidth: 220,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        p: 1.5,
                        borderRadius: "12px",
                        border: "1px solid #E5E7EB",
                        backgroundColor: "#FFFFFF",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        "&:hover": { backgroundColor: "#F9FAFB", borderColor: "#D1D5DB" },
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: "10px",
                            backgroundColor: "#EEF2FF",
                            color: "#4F46E5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconDeviceDesktop size={20} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: "#111827" }}>
                            Active Session
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: "#6B7280" }}>
                            View and manage your current session.
                          </Typography>
                        </Box>
                      </Box>
                      <IconChevronRight size={16} color="#9CA3AF" />
                    </Box>

                    {/* Sign Out Button */}
                    <Button
                      onClick={signout}
                      startIcon={<IconLogout size={16} />}
                      sx={{
                        backgroundColor: "#FFF1F2",
                        border: "1px solid #FECDD3",
                        color: "#E11D48",
                        textTransform: "none",
                        fontWeight: 700,
                        fontSize: 13.5,
                        borderRadius: "10px",
                        px: 2.5,
                        py: 1.25,
                        boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.04)",
                        flexShrink: 0,
                        "&:hover": {
                          backgroundColor: "#FFE4E6",
                          borderColor: "#FDA4AF",
                        },
                      }}
                    >
                      Sign Out
                    </Button>
                  </Box>
                </Box>
              </Box>
            )}

            {/* TAB: Preferences */}
            {activeTab === "preferences" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Box sx={{ mb: 1 }}>
                  <Typography sx={{ fontSize: 18, fontWeight: 700, color: "#101828" }}>Preferences</Typography>
                  <Typography sx={{ fontSize: 13.5, color: "#667085", mt: 0.5 }}>
                    Workspace response guidelines and display options.
                  </Typography>
                </Box>

                <PreferenceRow
                  title="Default response style"
                  description="Tone applied by AI when drafting suggestions for your customer emails."
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Chip label="Professional & Direct" variant="outlined" sx={{ fontWeight: 600, fontSize: 13, borderColor: "#D0D5DD" }} />
                    <Button
                      component={Link}
                      href="/dashboard/knowledge"
                      sx={secondaryBtnSx}
                    >
                      Manage Knowledge →
                    </Button>
                  </Box>
                </PreferenceRow>
              </Box>
            )}

            {/* TAB: Applications */}
            {activeTab === "applications" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Box sx={{ mb: 1 }}>
                  <Typography sx={{ fontSize: 18, fontWeight: 700, color: "#101828" }}>Applications & Mailboxes</Typography>
                  <Typography sx={{ fontSize: 13.5, color: "#667085", mt: 0.5 }}>
                    Connected Gmail and Outlook accounts and external API webhooks.
                  </Typography>
                </Box>

                <PreferenceRow
                  title="Connected mailboxes"
                  description="Active mailboxes syncing incoming emails and drafting AI suggestions."
                >
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, width: "100%", maxWidth: 420 }}>
                    {isLoadingIntegrations ? (
                      <Skeleton variant="rounded" width="100%" height={40} />
                    ) : accounts.length > 0 ? (
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, width: "100%" }}>
                        {accounts.map((acc: ConnectedIntegrationAccount) => (
                          <Box
                            key={acc.id}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1.5,
                              px: 1.5,
                              py: 1,
                              borderRadius: "8px",
                              border: "1px solid #D0D5DD",
                              backgroundColor: "#FFFFFF",
                              boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                            }}
                          >
                            <IconMail size={16} color="#3538CD" />
                            <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: "#344054" }}>
                              {acc.emailAddress || acc.displayName}
                            </Typography>
                            <Chip
                              size="small"
                              label={acc.status === "syncing" ? "Syncing" : "Connected"}
                              color={acc.status === "syncing" ? "info" : "success"}
                              sx={{ ml: "auto", height: 20, fontSize: 11, fontWeight: 600 }}
                            />
                          </Box>
                        ))}
                      </Box>
                    ) : (
                      <Typography sx={{ fontSize: 13.5, color: "#64748B" }}>No mailboxes connected yet</Typography>
                    )}
                    <Button
                      component={Link}
                      href="/dashboard/integrations"
                      startIcon={<IconPlug size={16} />}
                      sx={secondaryBtnSx}
                    >
                      Manage Integrations
                    </Button>
                  </Box>
                </PreferenceRow>

                <PreferenceRow
                  title="REST API & Webhooks"
                  description="Developer webhook endpoints and integration credentials."
                >
                  <Button
                    component={Link}
                    href="/dashboard/integrations"
                    endIcon={<IconExternalLink size={16} />}
                    sx={secondaryBtnSx}
                  >
                    View API documentation
                  </Button>
                </PreferenceRow>
              </Box>
            )}

            {/* TAB: Billing */}
            {activeTab === "billing" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Box sx={{ mb: 1 }}>
                  <Typography sx={{ fontSize: 18, fontWeight: 700, color: "#101828" }}>Plan & Billing</Typography>
                  <Typography sx={{ fontSize: 13.5, color: "#667085", mt: 0.5 }}>
                    Manage team subscription plan, seat limits, and invoices.
                  </Typography>
                </Box>

                <PreferenceRow
                  title="Subscription tier"
                  description="Manage plan limits, payment methods, and billing details."
                >
                  <Button
                    component={Link}
                    href="/dashboard/billing"
                    sx={secondaryBtnSx}
                  >
                    Manage Billing & Invoices
                  </Button>
                </PreferenceRow>
              </Box>
            )}

            {/* TAB: Security */}
            {activeTab === "security" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Box sx={{ mb: 1 }}>
                  <Typography sx={{ fontSize: 18, fontWeight: 700, color: "#101828" }}>Security & Credentials</Typography>
                  <Typography sx={{ fontSize: 13.5, color: "#667085", mt: 0.5 }}>
                    Manage passwords, multi-factor authentication, and session safety.
                  </Typography>
                </Box>

                <PreferenceRow
                  title="Password management"
                  description="Change your password via email OTP verification."
                >
                  <Button
                    component={Link}
                    href="/forgot-password"
                    endIcon={<IconExternalLink size={16} />}
                    sx={secondaryBtnSx}
                  >
                    Reset password
                  </Button>
                </PreferenceRow>

                <PreferenceRow
                  title="Two-factor authentication (TOTP)"
                  description="Protect sign-ins with authenticator app challenges."
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Chip size="small" label="Private preview" sx={{ backgroundColor: "#F2F4F7", color: "#344054", fontWeight: 600, fontSize: 12 }} />
                    <Typography sx={{ fontSize: 13, color: "#475467" }}>Rolling out for enterprise workspaces</Typography>
                  </Box>
                </PreferenceRow>
              </Box>
            )}

            {/* TAB: Data & Privacy */}
            {activeTab === "data-privacy" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <Box>
                  <Typography sx={{ fontSize: 18, fontWeight: 700, color: "#101828" }}>Data & Privacy</Typography>
                  <Typography sx={{ fontSize: 13.5, color: "#667085", mt: 0.5 }}>
                    Transparent review, self-service export, and deletion controls over your data and AI memory.
                  </Typography>
                </Box>

                {/* Group 1 */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#101828", mb: 0.5 }}>
                    1. What data can I review?
                  </Typography>

                  <PreferenceRow
                    title="Conversations & messages"
                    description="Read, review, or reply to customer email threads synchronized from connected mailboxes."
                  >
                    <Button
                      component={Link}
                      href="/dashboard/inbox"
                      startIcon={<IconInbox size={16} />}
                      sx={secondaryBtnSx}
                    >
                      Go to Inbox
                    </Button>
                  </PreferenceRow>

                  <PreferenceRow
                    title="Connected mailboxes & tokens"
                    description="Review authorized OAuth tokens, sync health, and connected account scopes."
                  >
                    <Button
                      component={Link}
                      href="/dashboard/integrations"
                      startIcon={<IconPlug size={16} />}
                      sx={secondaryBtnSx}
                    >
                      Go to Integrations
                    </Button>
                  </PreferenceRow>

                  <PreferenceRow
                    title="Uploaded knowledge base"
                    description="Company documents, PDF guidelines, and product catalogs indexed for AI retrieval."
                  >
                    <Button
                      component={Link}
                      href="/dashboard/knowledge"
                      startIcon={<IconDatabase size={16} />}
                      sx={secondaryBtnSx}
                    >
                      Go to Knowledge
                    </Button>
                  </PreferenceRow>

                  <PreferenceRow
                    title="AI memory & learned facts"
                    description="Learned business context, contact profiles, commitments, and user feedback."
                  >
                    <Button
                      component={Link}
                      href="/dashboard/memory"
                      startIcon={<IconBrain size={16} />}
                      sx={secondaryBtnSx}
                    >
                      Go to AI Memory
                    </Button>
                  </PreferenceRow>
                </Box>

                {/* Group 2 */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1, pt: 2, borderTop: "1px solid #EAECF0" }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#101828", mb: 0.5 }}>
                    2. How can I get a copy?
                  </Typography>

                  <PreferenceRow
                    title="Personal data archive"
                    description="Request a machine-readable export of your personal account profile, authentication events, and activity logs."
                  >
                    <Button
                      component="a"
                      href="mailto:hello@proxipilot.com?subject=Personal%20Data%20Export%20Request"
                      startIcon={<IconDownload size={16} />}
                      sx={secondaryBtnSx}
                    >
                      Request Archive
                    </Button>
                  </PreferenceRow>

                  <PreferenceRow
                    title="Full workspace export"
                    description="Bulk export of all workspace emails, uploaded documents, and activity history."
                  >
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
                      <Chip
                        size="small"
                        label="Awaiting backend support"
                        sx={{ backgroundColor: "#F2F4F7", color: "#344054", fontWeight: 600, fontSize: 12, border: "1px solid #EAECF0" }}
                      />
                      <Button
                        component="a"
                        href="mailto:hello@proxipilot.com?subject=Workspace%20Compliance%20Export%20Request"
                        sx={secondaryBtnSx}
                      >
                        Enterprise Request
                      </Button>
                    </Box>
                  </PreferenceRow>
                </Box>

                {/* Group 3 */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1, pt: 2, borderTop: "1px solid #EAECF0" }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#101828", mb: 0.5 }}>
                    3. What data can I remove?
                  </Typography>

                  <PreferenceRow
                    title="Permanent conversation deletion"
                    description="Permanently remove selected conversations and exclusively owned records directly from the Inbox. Original provider mailboxes remain untouched."
                  >
                    <Button
                      component={Link}
                      href="/dashboard/inbox"
                      startIcon={<IconTrash size={16} />}
                      sx={secondaryBtnSx}
                    >
                      Go to Inbox
                    </Button>
                  </PreferenceRow>

                  <PreferenceRow
                    title="Mailbox disconnection"
                    description="Revoke OAuth access tokens and immediately halt sync for any connected mailbox."
                  >
                    <Button
                      component={Link}
                      href="/dashboard/integrations"
                      startIcon={<IconPlug size={16} />}
                      sx={secondaryBtnSx}
                    >
                      Manage Connections
                    </Button>
                  </PreferenceRow>

                  <PreferenceRow
                    title="Full workspace erasure"
                    description="Permanently purge all workspace records, knowledge base embeddings, and tenant encryption keys."
                  >
                    <Button
                      onClick={() => handleSelectTab("delete")}
                      sx={{
                        ...secondaryBtnSx,
                        color: "#B42318",
                        borderColor: "#FECDCA",
                        "&:hover": { backgroundColor: "#FEF3F2", borderColor: "#FECDCA" },
                      }}
                    >
                      Go to Delete Data →
                    </Button>
                  </PreferenceRow>
                </Box>
              </Box>
            )}

            {/* TAB: Delete Data (Bulk Purge & Total Erasure Wireframe) */}
            {activeTab === "delete" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
                {/* Header */}
                <Box>
                  <Typography sx={{ fontSize: 18, fontWeight: 700, color: "#101828" }}>
                    Delete Data & Reset
                  </Typography>
                  <Typography sx={{ fontSize: 13.5, color: "#667085", mt: 0.5 }}>
                    Permanent actions to delete your uploaded business documents, clear conversation history, or delete your account completely.
                  </Typography>
                </Box>

                {/* High-visibility Warning Notice Banner */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 1.5,
                    p: 2,
                    borderRadius: "10px",
                    backgroundColor: "#FEF3F2",
                    border: "1px solid #FECDCA",
                  }}
                >
                  <IconAlertTriangle size={20} color="#D92D20" style={{ flexShrink: 0, marginTop: 2 }} />
                  <Box>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#B42318" }}>
                      Warning: Deletion actions cannot be undone
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: "#B42318", mt: 0.5, lineHeight: 1.45 }}>
                      These actions permanently remove your information from ProxiPilot. Once deleted, this information cannot be recovered. Please ensure you have saved any important records before proceeding.
                    </Typography>
                  </Box>
                </Box>

                {/* SECTION 1: Business Knowledge */}
                <Box
                  sx={{
                    p: 3,
                    borderRadius: "12px",
                    border: "1px solid #EAECF0",
                    backgroundColor: "#FFFFFF",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, flexWrap: { xs: "wrap", sm: "nowrap" } }}>
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.75 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: "10px",
                          backgroundColor: "#FEE4E2",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          color: "#D92D20",
                        }}
                      >
                        <IconDatabaseOff size={22} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 15.5, fontWeight: 700, color: "#101828" }}>
                          Delete All Business Knowledge
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Permanently remove all your uploaded company documents, guides, manuals, and business training at once.
                        </Typography>
                      </Box>
                    </Box>

                    <Button
                      variant="contained"
                      onClick={() => setActiveDeleteModal("knowledge")}
                      startIcon={<IconTrash size={16} />}
                      sx={{
                        backgroundColor: "#D92D20",
                        color: "#FFFFFF",
                        textTransform: "none",
                        fontWeight: 600,
                        fontSize: 13.5,
                        borderRadius: "8px",
                        px: 2,
                        py: 0.9,
                        flexShrink: 0,
                        boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                        "&:hover": { backgroundColor: "#B42318" },
                      }}
                    >
                      Delete All Knowledge
                    </Button>
                  </Box>

                  {/* Scopes Covered */}
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: "8px",
                      backgroundColor: "#F9FAFB",
                      border: "1px solid #EAECF0",
                      display: "flex",
                      flexDirection: "column",
                      gap: 1.25,
                    }}
                  >
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "#344054", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      What will be deleted:
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      <Chip size="small" label="Uploaded Files (PDF, Excel, Word, TXT)" sx={{ backgroundColor: "#FFFFFF", border: "1px solid #D0D5DD", fontSize: 12, fontWeight: 600 }} />
                      <Chip size="small" label="Company Guidelines & FAQs" sx={{ backgroundColor: "#FFFFFF", border: "1px solid #D0D5DD", fontSize: 12, fontWeight: 600 }} />
                      <Chip size="small" label="Product Catalogs & Price Lists" sx={{ backgroundColor: "#FFFFFF", border: "1px solid #D0D5DD", fontSize: 12, fontWeight: 600 }} />
                      <Chip size="small" label="AI Business Memory & Training" sx={{ backgroundColor: "#FFFFFF", border: "1px solid #D0D5DD", fontSize: 12, fontWeight: 600, color: "#B42318" }} />
                    </Box>
                    <Typography sx={{ fontSize: 12.5, color: "#667085", mt: 0.5, lineHeight: 1.45 }}>
                      • All company documents and training files you uploaded will be permanently deleted.<br />
                      • ProxiPilot AI will immediately stop using your company guidelines when writing draft replies.<br />
                      • You can upload fresh business documents at any time from the Knowledge page.
                    </Typography>
                  </Box>
                </Box>

                {/* SECTION 2: Conversations & Threads */}
                <Box
                  sx={{
                    p: 3,
                    borderRadius: "12px",
                    border: "1px solid #EAECF0",
                    backgroundColor: "#FFFFFF",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, flexWrap: { xs: "wrap", sm: "nowrap" } }}>
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.75 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: "10px",
                          backgroundColor: "#FEE4E2",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          color: "#D92D20",
                        }}
                      >
                        <IconMessageOff size={22} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 15.5, fontWeight: 700, color: "#101828" }}>
                          Delete All Conversations & Messages
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Permanently clear all email conversations, drafts, scheduled follow-ups, and AI summaries from ProxiPilot.
                        </Typography>
                      </Box>
                    </Box>

                    <Button
                      variant="contained"
                      onClick={() => setActiveDeleteModal("conversations")}
                      startIcon={<IconTrash size={16} />}
                      sx={{
                        backgroundColor: "#D92D20",
                        color: "#FFFFFF",
                        textTransform: "none",
                        fontWeight: 600,
                        fontSize: 13.5,
                        borderRadius: "8px",
                        px: 2,
                        py: 0.9,
                        flexShrink: 0,
                        boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                        "&:hover": { backgroundColor: "#B42318" },
                      }}
                    >
                      Delete All Conversations
                    </Button>
                  </Box>

                  {/* Scopes Covered */}
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: "8px",
                      backgroundColor: "#F9FAFB",
                      border: "1px solid #EAECF0",
                      display: "flex",
                      flexDirection: "column",
                      gap: 1.25,
                    }}
                  >
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "#344054", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      What will be deleted:
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      <Chip size="small" label="All Customer Conversations" sx={{ backgroundColor: "#FFFFFF", border: "1px solid #D0D5DD", fontSize: 12, fontWeight: 600 }} />
                      <Chip size="small" label="Email Messages & Drafts" sx={{ backgroundColor: "#FFFFFF", border: "1px solid #D0D5DD", fontSize: 12, fontWeight: 600 }} />
                      <Chip size="small" label="Scheduled Follow-up Reminders" sx={{ backgroundColor: "#FFFFFF", border: "1px solid #D0D5DD", fontSize: 12, fontWeight: 600 }} />
                      <Chip size="small" label="AI Notes & Conversation Summaries" sx={{ backgroundColor: "#FFFFFF", border: "1px solid #D0D5DD", fontSize: 12, fontWeight: 600 }} />
                    </Box>
                    <Typography sx={{ fontSize: 12.5, color: "#667085", mt: 0.5, lineHeight: 1.45 }}>
                      • All synchronized email threads, message copies, reply drafts, and AI notes in ProxiPilot are deleted.<br />
                      • <strong>Your real email account (Gmail or Outlook) is completely safe and untouched.</strong> No emails will be deleted from your Google or Microsoft inbox.<br />
                      • This clears your ProxiPilot inbox back to a clean, fresh start.
                    </Typography>
                  </Box>
                </Box>

                {/* SECTION 3: Completely Delete Account & Profile */}
                <Box
                  sx={{
                    p: 3,
                    borderRadius: "12px",
                    border: "1px solid #FECDCA",
                    backgroundColor: "#FFFBFA",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, flexWrap: { xs: "wrap", sm: "nowrap" } }}>
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.75 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: "10px",
                          backgroundColor: "#FEE4E2",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          color: "#B42318",
                        }}
                      >
                        <IconUserX size={22} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 15.5, fontWeight: 700, color: "#B42318" }}>
                          Completely Delete Account & Profile
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Permanently delete your personal profile, login access, and all information connected to you in ProxiPilot.
                        </Typography>
                      </Box>
                    </Box>

                    <Button
                      variant="contained"
                      onClick={() => setActiveDeleteModal("account")}
                      startIcon={<IconUserX size={16} />}
                      sx={{
                        backgroundColor: "#B42318",
                        color: "#FFFFFF",
                        textTransform: "none",
                        fontWeight: 600,
                        fontSize: 13.5,
                        borderRadius: "8px",
                        px: 2,
                        py: 0.9,
                        flexShrink: 0,
                        boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                        "&:hover": { backgroundColor: "#912018" },
                      }}
                    >
                      Delete My Account
                    </Button>
                  </Box>

                  {/* Scopes Covered */}
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: "8px",
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #FECDCA",
                      display: "flex",
                      flexDirection: "column",
                      gap: 1.25,
                    }}
                  >
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "#B42318", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      What will be deleted:
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      <Chip size="small" label="Your Profile Name & Email" sx={{ backgroundColor: "#FEF3F2", color: "#B42318", border: "1px solid #FECDCA", fontSize: 12, fontWeight: 600 }} />
                      <Chip size="small" label="Login Access & Password" sx={{ backgroundColor: "#FEF3F2", color: "#B42318", border: "1px solid #FECDCA", fontSize: 12, fontWeight: 600 }} />
                      <Chip size="small" label="Team Memberships & Roles" sx={{ backgroundColor: "#FEF3F2", color: "#B42318", border: "1px solid #FECDCA", fontSize: 12, fontWeight: 600 }} />
                      <Chip size="small" label="All Personal Activity History" sx={{ backgroundColor: "#FEF3F2", color: "#B42318", border: "1px solid #FECDCA", fontSize: 12, fontWeight: 600 }} />
                    </Box>
                    <Typography sx={{ fontSize: 12.5, color: "#475467", mt: 0.5, lineHeight: 1.45 }}>
                      • Your personal profile (`{user?.email || "current user"}`) and login account will be permanently closed.<br />
                      • If you are the only owner of this workspace, all workspace data, email connections, and team settings will be closed permanently.<br />
                      • You will be signed out immediately and this account cannot be reopened or recovered.
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* 3. Interactive Confirmation Dialog for Deletion Wireframe */}
      <Dialog
        open={activeDeleteModal !== null}
        onClose={handleCloseDeleteModal}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: "14px",
              p: 1,
              boxShadow: "0px 20px 24px -4px rgba(16, 24, 40, 0.08), 0px 8px 8px -4px rgba(16, 24, 40, 0.03)",
            },
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: "10px",
              backgroundColor: "#FEE4E2",
              color: "#D92D20",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IconAlertTriangle size={22} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 16.5, fontWeight: 700, color: "#101828" }}>
              {activeDeleteModal === "knowledge" && "Delete Complete Business Knowledge?"}
              {activeDeleteModal === "conversations" && "Delete All Conversations & Threads?"}
              {activeDeleteModal === "account" && "Permanently Delete Your Account?"}
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#667085" }}>
              This action is permanent and cannot be undone.
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 1.5, display: "flex", flexDirection: "column", gap: 2 }}>
          <Alert severity="error" sx={{ borderRadius: "8px", fontSize: 13 }}>
            {activeDeleteModal === "knowledge" && (
              <>
                <strong>Warning:</strong> All your uploaded company documents, guides, manuals, and business training will be permanently deleted. The AI assistant will no longer know your business details.
              </>
            )}
            {activeDeleteModal === "conversations" && (
              <>
                <strong>Warning:</strong> All customer email threads, drafts, messages, and AI summaries will be cleared from ProxiPilot. (Your real Gmail or Outlook email account remains safe and untouched).
              </>
            )}
            {activeDeleteModal === "account" && (
              <>
                <strong>Critical Warning:</strong> Your personal profile, login access, and all information connected to your account will be permanently deleted.
              </>
            )}
          </Alert>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Typography sx={{ fontSize: 13.5, color: "#344054", fontWeight: 500 }}>
              To confirm, type <strong>{requiredConfirmationKeyword}</strong> below:
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={confirmInputText}
              onChange={(e) => setConfirmInputText(e.target.value)}
              placeholder={requiredConfirmationKeyword}
              autoFocus
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "8px",
                  fontSize: 14,
                  fontFamily: "monospace",
                },
              }}
            />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
            <Checkbox
              checked={confirmUnderstood}
              onChange={(e) => setConfirmUnderstood(e.target.checked)}
              sx={{ p: 0, color: "#D0D5DD", "&.Mui-checked": { color: "#D92D20" } }}
            />
            <Typography sx={{ fontSize: 13, color: "#344054", fontWeight: 500 }}>
              I understand that this deletion is immediate and irreversible.
            </Typography>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 1 }}>
          <Button
            onClick={handleCloseDeleteModal}
            disabled={isDeleting}
            sx={{
              ...secondaryBtnSx,
              fontSize: 13.5,
              py: "6px",
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!isConfirmationValid || isDeleting}
            onClick={handleConfirmDeletion}
            sx={{
              backgroundColor: "#D92D20",
              color: "#FFFFFF",
              textTransform: "none",
              fontWeight: 600,
              fontSize: 13.5,
              borderRadius: "8px",
              px: 2,
              py: "7px",
              boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
              "&:hover": { backgroundColor: "#B42318" },
              "&.Mui-disabled": { backgroundColor: "#F2F4F7", color: "#98A2B3" },
            }}
          >
            {isDeleting ? "Processing..." : "Permanently Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
