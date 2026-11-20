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
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  IconAdjustments,
  IconAlertTriangle,
  IconBell,
  IconBolt,
  IconBrain,
  IconBuilding,
  IconBuildingCommunity,
  IconCalculator,
  IconCheck,
  IconChevronRight,
  IconCircleCheck,
  IconClock,
  IconCoins,
  IconCopy,
  IconCreditCard,
  IconDatabase,
  IconDatabaseOff,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconDownload,
  IconExternalLink,
  IconEye,
  IconFileInvoice,
  IconFileText,
  IconFingerprint,
  IconHistory,
  IconHome,
  IconInbox,
  IconInfoCircle,
  IconKey,
  IconKeyboard,
  IconLayoutGrid,
  IconLink,
  IconLock,
  IconLogout,
  IconMail,
  IconMessageOff,
  IconMoon,
  IconPencil,
  IconPlug,
  IconPlus,
  IconReceipt2,
  IconRefresh,
  IconRocket,
  IconServer,
  IconSettings,
  IconShield,
  IconShieldCheck,
  IconSparkles,
  IconStack2,
  IconSun,
  IconTrash,
  IconTrendingUp,
  IconUser,
  IconUsers,
  IconUserX,
  IconWorld,
  IconX,
} from "@tabler/icons-react";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import { FollowupSettings } from "./FollowupSettings";
import { toast } from "@/stores/notification.store";

export type SettingsTabKey =
  | "profile"
  | "general"
  | "preferences"
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

interface ActiveSessionItem {
  id: string;
  device: string;
  location: string;
  ip: string;
  lastActive: string;
  isCurrent: boolean;
  icon: React.ComponentType<{ size?: number; color?: string; stroke?: number }>;
}

const INITIAL_SESSIONS: ActiveSessionItem[] = [
  {
    id: "sess_current",
    device: "Chrome on Windows 11",
    location: "New Delhi, India",
    ip: "103.211.14.*",
    lastActive: "Active right now",
    isCurrent: true,
    icon: IconDeviceDesktop,
  },
  {
    id: "sess_mobile",
    device: "Safari on iPhone 15 Pro (iOS 18)",
    location: "New Delhi, India",
    ip: "103.211.14.*",
    lastActive: "2 hours ago",
    isCurrent: false,
    icon: IconDeviceMobile,
  },
  {
    id: "sess_macos",
    device: "Edge on macOS Sequoia",
    location: "Mumbai, India",
    ip: "182.72.68.*",
    lastActive: "3 days ago",
    isCurrent: false,
    icon: IconDeviceDesktop,
  },
];

const AUDIT_EVENTS = [
  {
    id: "evt_1",
    event: "Successful sign-in",
    detail: "Password + Two-factor OTP verified",
    client: "Chrome on Windows 11",
    location: "New Delhi, India",
    timestamp: "Today at 17:42",
    status: "Success",
    statusColor: "#059669",
    statusBg: "#ECFDF5",
  },
  {
    id: "evt_2",
    event: "Security policy updated",
    detail: "Follow-up schedule & cadence limits modified",
    client: "Admin Console",
    location: "New Delhi, India",
    timestamp: "Today at 16:15",
    status: "Modified",
    statusColor: "#4F46E5",
    statusBg: "#EEF2FF",
  },
  {
    id: "evt_3",
    event: "Background token rotation",
    detail: "Gmail OAuth sync token refreshed automatically",
    client: "Sync Reconciler Worker",
    location: "Cloud Cluster",
    timestamp: "Today at 14:00",
    status: "Automated",
    statusColor: "#0284C7",
    statusBg: "#EFF6FF",
  },
  {
    id: "evt_4",
    event: "New device authorized",
    detail: "Safari on iPhone 15 Pro verified via OTP",
    client: "Safari on iOS",
    location: "New Delhi, India",
    timestamp: "Yesterday at 11:30",
    status: "Verified",
    statusColor: "#059669",
    statusBg: "#ECFDF5",
  },
  {
    id: "evt_5",
    event: "Password verification",
    detail: "Accessed security settings and encryption keys",
    client: "Chrome on Windows 11",
    location: "New Delhi, India",
    timestamp: "3 days ago",
    status: "Success",
    statusColor: "#059669",
    statusBg: "#ECFDF5",
  },
];

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

export interface PaymentMethod {
  id: string;
  brand: "visa" | "mastercard" | "amex";
  last4: string;
  expMonth: string;
  expYear: string;
  isDefault: boolean;
  holderName: string;
}

const INITIAL_PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "pm_1",
    brand: "visa",
    last4: "4242",
    expMonth: "08",
    expYear: "2028",
    isDefault: true,
    holderName: "Anmol Sinha",
  },
  {
    id: "pm_2",
    brand: "mastercard",
    last4: "8821",
    expMonth: "11",
    expYear: "2027",
    isDefault: false,
    holderName: "Dolphy India Corp",
  },
];

export interface BillingInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  description: string;
  amount: string;
  status: "Paid" | "Processing" | "Refunded";
  statusBg: string;
  statusColor: string;
}

const INITIAL_INVOICES: BillingInvoice[] = [
  {
    id: "inv_1",
    invoiceNumber: "INV-2026-011",
    date: "Nov 01, 2026",
    description: "Growth Plan — Monthly (5 Seats, 2,500 AI Credits)",
    amount: "$49.00",
    status: "Paid",
    statusBg: "#ECFDF5",
    statusColor: "#059669",
  },
  {
    id: "inv_2",
    invoiceNumber: "INV-2026-009",
    date: "Oct 18, 2026",
    description: "AI Credits Auto-Top Up (+1,000 Credits Safeguard)",
    amount: "$15.00",
    status: "Paid",
    statusBg: "#ECFDF5",
    statusColor: "#059669",
  },
  {
    id: "inv_3",
    invoiceNumber: "INV-2026-008",
    date: "Oct 01, 2026",
    description: "Growth Plan — Monthly (5 Seats, 2,500 AI Credits)",
    amount: "$49.00",
    status: "Paid",
    statusBg: "#ECFDF5",
    statusColor: "#059669",
  },
  {
    id: "inv_4",
    invoiceNumber: "INV-2026-005",
    date: "Sep 01, 2026",
    description: "Growth Plan — Monthly (5 Seats, 2,500 AI Credits)",
    amount: "$49.00",
    status: "Paid",
    statusBg: "#ECFDF5",
    statusColor: "#059669",
  },
  {
    id: "inv_5",
    invoiceNumber: "INV-2026-002",
    date: "Aug 01, 2026",
    description: "Starter to Growth Upgrade Proration",
    amount: "$30.00",
    status: "Paid",
    statusBg: "#ECFDF5",
    statusColor: "#059669",
  },
];

interface PlanTierDetail {
  id: "starter" | "growth" | "business" | "enterprise";
  name: string;
  monthlyPrice: number;
  yearlyMonthlyPrice: number;
  credits: number;
  seats: number;
  storage: string;
  popular?: boolean;
  features: string[];
}

const PLAN_TIER_DETAILS: PlanTierDetail[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 19,
    yearlyMonthlyPrice: 15,
    credits: 500,
    seats: 2,
    storage: "100 MB",
    features: [
      "500 AI Execution Credits / mo",
      "Up to 2 team member seats",
      "Universal Unified Inbox aggregation",
      "Standard autonomous follow-ups",
      "Community & email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    monthlyPrice: 49,
    yearlyMonthlyPrice: 39,
    credits: 2500,
    seats: 5,
    storage: "500 MB",
    popular: true,
    features: [
      "2,500 AI Execution Credits / mo",
      "Up to 5 team member seats",
      "Universal Unified Inbox with instant sync",
      "Smart Lead Scoring (Hot, Warm, Cold)",
      "Autonomous policy cadence engine",
      "Auto-Top Up safeguard protection",
      "Priority email & chat support",
    ],
  },
  {
    id: "business",
    name: "Business",
    monthlyPrice: 99,
    yearlyMonthlyPrice: 79,
    credits: 10000,
    seats: 15,
    storage: "2 GB",
    features: [
      "10,000 AI Execution Credits / mo",
      "Up to 15 team member seats",
      "Universal Unified Inbox with multi-channel routing",
      "Custom brand voice & AI tone fine-tuning",
      "Advanced multi-channel policy logic",
      "Custom invoice procurement & PO numbers",
      "Dedicated account manager & 99.9% SLA",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: 299,
    yearlyMonthlyPrice: 249,
    credits: 50000,
    seats: 50,
    storage: "Unlimited",
    features: [
      "50,000+ AI Execution Credits / mo",
      "Unlimited team member seats",
      "Universal Unified Inbox across all corporate domains",
      "Dedicated private inference cluster",
      "SOC2 Type II & HIPAA compliance pack",
      "Custom integrations & ERP sync",
      "24/7 Phone & Slack channel support",
    ],
  },
];

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
    if (rawTab === "integrations" || rawTab === "applications") return "general";
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

  // State for Preferences screen (Comprehensive AI & Workspace Settings)
  const [responseTone, setResponseTone] = useState("Professional & Direct");
  const [requireHumanReview, setRequireHumanReview] = useState(true);
  const [strictGrounding, setStrictGrounding] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState("85%");
  const [includeSignature, setIncludeSignature] = useState(true);
  const [includeThreadHistory, setIncludeThreadHistory] = useState(true);
  const [autoSaveDrafts, setAutoSaveDrafts] = useState("30s");
  const [replyBehavior, setReplyBehavior] = useState("Reply All");
  const [inboxDensity, setInboxDensity] = useState("Comfortable");
  const [autoAdvance, setAutoAdvance] = useState("Next thread");
  const [keyboardShortcuts, setKeyboardShortcuts] = useState(true);
  const [autoSentimentTagging, setAutoSentimentTagging] = useState(true);
  const [autoFollowupReminders, setAutoFollowupReminders] = useState(true);

  // State for Security tab
  const [passkeysEnabled, setPasskeysEnabled] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState("24 hours");
  const [ipWhitelistEnabled, setIpWhitelistEnabled] = useState(false);
  const [ssoEnforced, setSsoEnforced] = useState(false);
  const [suspiciousAlerts, setSuspiciousAlerts] = useState(true);
  const [revokedSessionIds, setRevokedSessionIds] = useState<string[]>([]);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleRevokeSession = (sessionId: string, deviceName: string) => {
    setRevokedSessionIds((prev) => [...prev, sessionId]);
    toast.success(`Revoked session on ${deviceName}`);
  };

  const handleRevokeAllOtherSessions = () => {
    setRevokedSessionIds(["sess_mobile", "sess_macos"]);
    toast.success("Signed out of all other active sessions");
  };

  const handleChangePasswordSubmit = () => {
    if (!currentPasswordInput) {
      toast.error("Please enter your current password");
      return;
    }
    if (newPasswordInput.length < 8) {
      toast.error("New password must be at least 8 characters long");
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      toast.error("New passwords do not match");
      return;
    }
    setIsUpdatingPassword(true);
    setTimeout(() => {
      setIsUpdatingPassword(false);
      setIsChangePasswordOpen(false);
      setCurrentPasswordInput("");
      setNewPasswordInput("");
      setConfirmPasswordInput("");
      toast.success("Account password updated successfully");
    }, 600);
  };

  const handleExportAuditLogs = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["Event,Detail,Client,Location,Timestamp,Status"]
        .concat(
          AUDIT_EVENTS.map(
            (e) => `"${e.event}","${e.detail}","${e.client}","${e.location}","${e.timestamp}","${e.status}"`
          )
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `proxipilot-security-audit-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Security audit logs exported to CSV");
  };

  // State for Billing tab
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [currentPlanTier, setCurrentPlanTier] = useState<keyof typeof PLAN_CONFIGS>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("proxipilot_active_plan") as keyof typeof PLAN_CONFIGS | null;
        if (stored && PLAN_CONFIGS[stored]) return stored;
      } catch {}
    }
    return planKey;
  });
  const [creditsExtraPurchased, setCreditsExtraPurchased] = useState(0);
  const [seatsExtraPurchased, setSeatsExtraPurchased] = useState(0);
  const [storageExtraPurchasedMB, setStorageExtraPurchasedMB] = useState(0);
  const [autoTopUpEnabled, setAutoTopUpEnabled] = useState(true);
  const [autoTopUpThreshold, setAutoTopUpThreshold] = useState("15% (375 credits)");
  const [autoTopUpPack, setAutoTopUpPack] = useState("1,000 credits ($15)");
  const [maxAutoTopUps, setMaxAutoTopUps] = useState("2 times per month");
  const [budgetAlertEnabled, setBudgetAlertEnabled] = useState(true);
  const [invoiceEmail, setInvoiceEmail] = useState("billing@dolphyindia.com");
  const [billingCurrency, setBillingCurrency] = useState("USD ($)");
  const [poNumber, setPoNumber] = useState("PO-2026-Q4-089");
  const [companyLegalName, setCompanyLegalName] = useState("Dolphy India Pvt. Ltd.");
  const [taxIdNumber, setTaxIdNumber] = useState("27AADCB2234P1Z2");
  const [companyBillingAddress, setCompanyBillingAddress] = useState(
    "102 Business Hub, Bandra West, Mumbai, MH 400050, India"
  );
  const [paymentMethodsList, setPaymentMethodsList] = useState<PaymentMethod[]>(INITIAL_PAYMENT_METHODS);
  const [invoicesList] = useState<BillingInvoice[]>(INITIAL_INVOICES);

  // Billing interactive modal states
  const [isUpgradePlanOpen, setIsUpgradePlanOpen] = useState(false);
  const [isBuyCreditsOpen, setIsBuyCreditsOpen] = useState(false);
  const [isBuySeatsOpen, setIsBuySeatsOpen] = useState(false);
  const [isBuyStorageOpen, setIsBuyStorageOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [isEditBillingInfoOpen, setIsEditBillingInfoOpen] = useState(false);

  // Smart Billing states & intelligence features
  const [smartSpendCapEnabled, setSmartSpendCapEnabled] = useState(true);
  const [smartSpendCapAmount, setSmartSpendCapAmount] = useState(150);
  const [hourlyLaborRate, setHourlyLaborRate] = useState(30);
  const [selectedInvoiceForPreview, setSelectedInvoiceForPreview] = useState<BillingInvoice | null>(null);

  // Data & Privacy governance states
  const [piiMaskingEnabled, setPiiMaskingEnabled] = useState(true);
  const [breakGlassAccessEnabled, setBreakGlassAccessEnabled] = useState(false);
  const [retentionCustomerEmails, setRetentionCustomerEmails] = useState("Keep Indefinitely (Default)");
  const [retentionAiDrafts, setRetentionAiDrafts] = useState("30 Days (Recommended)");
  const [autoPurgeTrashEnabled, setAutoPurgeTrashEnabled] = useState(true);
  const [isGeneratingDataDump, setIsGeneratingDataDump] = useState(false);
  const [isDpaModalOpen, setIsDpaModalOpen] = useState(false);
  const [isSubprocessorsModalOpen, setIsSubprocessorsModalOpen] = useState(false);

  // Add Payment Modal Form States
  const [newCardHolder, setNewCardHolder] = useState("");
  const [newCardNumber, setNewCardNumber] = useState("");
  const [newCardExp, setNewCardExp] = useState("");
  const [newCardCvc, setNewCardCvc] = useState("");
  const [newCardIsDefault, setNewCardIsDefault] = useState(true);
  const [isSavingCard, setIsSavingCard] = useState(false);

  // Edit Billing Info Modal Form States
  const [tempCompanyName, setTempCompanyName] = useState(companyLegalName);
  const [tempBillingEmail, setTempBillingEmail] = useState(invoiceEmail);
  const [tempTaxId, setTempTaxId] = useState(taxIdNumber);
  const [tempAddress, setTempAddress] = useState(companyBillingAddress);
  const [isSavingBillingInfo, setIsSavingBillingInfo] = useState(false);

  const handleSelectPlan = (tierId: keyof typeof PLAN_CONFIGS) => {
    setCurrentPlanTier(tierId);
    try {
      localStorage.setItem("proxipilot_active_plan", tierId);
      window.dispatchEvent(new Event("plan-updated"));
    } catch {}
    setIsUpgradePlanOpen(false);
    toast.success(`Successfully switched to ${PLAN_CONFIGS[tierId].name} Plan!`);
  };

  const handleBuyCredits = (creditsAmount: number, priceStr: string) => {
    setCreditsExtraPurchased((prev) => prev + creditsAmount);
    setIsBuyCreditsOpen(false);
    toast.success(`Added ${creditsAmount.toLocaleString()} AI Credits to your account (${priceStr})`);
  };

  const handleBuySeats = (seatsAmount: number, priceStr: string) => {
    setSeatsExtraPurchased((prev) => prev + seatsAmount);
    setIsBuySeatsOpen(false);
    toast.success(`Added ${seatsAmount} extra team seat${seatsAmount > 1 ? "s" : ""} to your workspace (${priceStr})`);
  };

  const handleBuyStorage = (storageMB: number, priceStr: string) => {
    setStorageExtraPurchasedMB((prev) => prev + storageMB);
    setIsBuyStorageOpen(false);
    toast.success(`Added ${storageMB >= 1000 ? `${storageMB / 1000} GB` : `${storageMB} MB`} extra docs storage (${priceStr})`);
  };

  const handleAddPaymentMethod = () => {
    if (!newCardNumber || newCardNumber.trim().length < 14) {
      toast.error("Please enter a valid card number");
      return;
    }
    if (!newCardHolder.trim()) {
      toast.error("Please enter the cardholder name");
      return;
    }
    if (!newCardExp || !newCardExp.includes("/")) {
      toast.error("Please enter expiration date (MM/YY)");
      return;
    }
    setIsSavingCard(true);
    setTimeout(() => {
      const [expMonth, expYear] = newCardExp.split("/");
      const last4 = newCardNumber.replace(/\s+/g, "").slice(-4) || "9912";
      const cleanNum = newCardNumber.replace(/\s+/g, "");
      const brand: "visa" | "mastercard" | "amex" = cleanNum.startsWith("3")
        ? "amex"
        : cleanNum.startsWith("5")
        ? "mastercard"
        : "visa";
      const newMethod: PaymentMethod = {
        id: `pm_${Date.now()}`,
        brand,
        last4,
        expMonth: expMonth.trim(),
        expYear: expYear.trim().length === 2 ? `20${expYear.trim()}` : expYear.trim(),
        isDefault: newCardIsDefault,
        holderName: newCardHolder.trim(),
      };

      setPaymentMethodsList((prev) => {
        if (newCardIsDefault) {
          return [newMethod, ...prev.map((p) => ({ ...p, isDefault: false }))];
        }
        return [...prev, newMethod];
      });

      setIsSavingCard(false);
      setIsAddPaymentOpen(false);
      setNewCardHolder("");
      setNewCardNumber("");
      setNewCardExp("");
      setNewCardCvc("");
      toast.success(`Payment card •••• ${last4} added successfully`);
    }, 600);
  };

  const handleSetDefaultPayment = (id: string) => {
    setPaymentMethodsList((prev) =>
      prev.map((pm) => ({
        ...pm,
        isDefault: pm.id === id,
      }))
    );
    toast.success("Default payment method updated");
  };

  const handleRemovePaymentMethod = (id: string) => {
    setPaymentMethodsList((prev) => prev.filter((p) => p.id !== id));
    toast.success("Payment method removed");
  };

  const handleSaveBillingInfo = () => {
    setIsSavingBillingInfo(true);
    setTimeout(() => {
      setCompanyLegalName(tempCompanyName);
      setInvoiceEmail(tempBillingEmail);
      setTaxIdNumber(tempTaxId);
      setCompanyBillingAddress(tempAddress);
      setIsSavingBillingInfo(false);
      setIsEditBillingInfoOpen(false);
      toast.success("Billing and tax details updated successfully");
    }, 400);
  };

  const handleDownloadInvoice = (inv: BillingInvoice) => {
    const invoiceHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${inv.invoiceNumber} - ProxiPilot</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
    .logo { font-size: 24px; font-weight: 800; color: #4f46e5; }
    .meta { margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 30px; font-size: 14px; }
    th { text-align: left; padding: 12px; background: #f8fafc; border-bottom: 1px solid #cbd5e1; font-weight: 700; }
    td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
    .total { text-align: right; margin-top: 25px; font-size: 18px; font-weight: 800; color: #0f172a; }
    .badge { background: #ecfdf5; color: #059669; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 12px; border: 1px solid #a7f3d0; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">⚡ ProxiPilot</div>
      <p style="color: #64748b; margin: 4px 0 0 0;">Autonomous Follow-up Intelligence & Autopilot</p>
    </div>
    <div style="text-align: right;">
      <h2 style="margin: 0; color: #0f172a;">${inv.invoiceNumber}</h2>
      <p style="color: #64748b; margin: 4px 0 0 0;">Date: ${inv.date}</p>
      <div style="margin-top: 6px;"><span class="badge">PAID</span></div>
    </div>
  </div>
  <div class="meta">
    <div>
      <strong>Billed To:</strong><br>
      ${companyLegalName}<br>
      ${companyBillingAddress}<br>
      Tax ID / GSTIN: ${taxIdNumber}<br>
      Contact: ${invoiceEmail}
    </div>
    <div style="text-align: right;">
      <strong>Issued By:</strong><br>
      ProxiPilot Technologies Inc.<br>
      548 Market St, Suite 3200<br>
      San Francisco, CA 94104<br>
      support@proxipilot.com
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align: right;">Qty</th>
        <th style="text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${inv.description}</td>
        <td style="text-align: right;">1</td>
        <td style="text-align: right;">${inv.amount}</td>
      </tr>
    </tbody>
  </table>
  <div class="total">
    Total Paid: ${inv.amount}
  </div>
</body>
</html>`;
    const blob = new Blob([invoiceHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proxipilot-${inv.invoiceNumber.toLowerCase()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${inv.invoiceNumber}`);
  };

  const handleExportAllInvoices = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["Invoice Number,Date,Description,Amount,Status"]
        .concat(
          invoicesList.map(
            (inv) => `"${inv.invoiceNumber}","${inv.date}","${inv.description}","${inv.amount}","${inv.status}"`
          )
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `proxipilot-invoices-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Invoice history exported to CSV");
  };

  const handleGenerateDataDump = () => {
    setIsGeneratingDataDump(true);
    toast.info("Packaging workspace emails, knowledge embeddings, and logs...");
    setTimeout(() => {
      const dumpPayload = {
        exportVersion: "2.4.0",
        workspaceId: "ws_dolphy_091",
        workspaceName: "Dolphy India",
        exportedAt: new Date().toISOString(),
        gdprCompliant: true,
        scope: "Full workspace correspondence, vector documents, audit logs, and AI memory",
        tables: {
          conversationsCount: 842,
          knowledgeDocumentsCount: 38,
          aiMemoryFactsCount: 129,
          activeSeatsCount: 5,
        },
        encryptionInfo: "AES-256 GCM encrypted bundle",
      };
      const blob = new Blob([JSON.stringify(dumpPayload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proxipilot_workspace_data_dump_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsGeneratingDataDump(false);
      toast.success("Workspace compliance package generated and downloaded successfully");
    }, 1200);
  };

  const handleRequestPersonalArchive = () => {
    toast.info("Generating your personal account archive...");
    setTimeout(() => {
      const personalData = {
        userId: user?.user_id || "usr_anmol_001",
        email: user?.email || "anmolsinha4321@gmail.com",
        name: user?.full_name || "Anmol Sinha",
        role: "Workspace Owner & Administrator",
        organization: "Dolphy India",
        mfaEnabled: true,
        activeSessionsCount: 2,
        securityLogEventsCount: 47,
        exportTimestamp: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(personalData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proxipilot_personal_data_takeout_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Personal data takeout archive downloaded");
    }, 800);
  };

  // Deletion UI interactive modal state
  const [activeDeleteModal, setActiveDeleteModal] = useState<DeletionModalType>(null);
  const [confirmInputText, setConfirmInputText] = useState("");
  const [confirmUnderstood, setConfirmUnderstood] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Smart Deletion features
  const [selectivePurgeFilter, setSelectivePurgeFilter] = useState<"all" | "older_90" | "soft_trash">("all");
  const [softFreezeGracePeriod, setSoftFreezeGracePeriod] = useState(true);

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
          "All business knowledge documents, FAQs, and semantic embeddings permanently purged."
        );
      } else if (activeDeleteModal === "conversations") {
        const msg = selectivePurgeFilter === "older_90"
          ? "Conversation threads older than 90 days permanently deleted."
          : selectivePurgeFilter === "soft_trash"
          ? "All soft-deleted and trashed threads permanently purged."
          : "All customer conversation threads, drafts, and AI notes permanently cleared from ProxiPilot.";
        toast.success(msg);
      } else if (activeDeleteModal === "account") {
        if (softFreezeGracePeriod) {
          toast.success(
            "Account locked under 7-day soft-freeze protection. Support ticket initiated for final cryptographic erasure."
          );
        } else {
          toast.success(
            "Account profile and workspace encryption keys permanently destroyed. Signing out..."
          );
        }
      }
      handleCloseDeleteModal();
    }, 1200);
  };

  const currentPlanMeta = PLAN_CONFIGS[currentPlanTier] || planMeta;
  const currentTierDetail =
    PLAN_TIER_DETAILS.find((p) => p.id === currentPlanTier) || PLAN_TIER_DETAILS[1];
  const dynamicTotalCredits = currentPlanMeta.totalCredits + creditsExtraPurchased;
  const dynamicUsedCredits = currentPlanMeta.usedCredits;
  const dynamicRemainingCredits = Math.max(0, dynamicTotalCredits - dynamicUsedCredits);
  const dynamicPercentRemaining = Math.round((dynamicRemainingCredits / dynamicTotalCredits) * 100);
  const dynamicTotalSeats = currentTierDetail.seats + seatsExtraPurchased;
  const baseStorageMB =
    currentTierDetail.storage === "Unlimited"
      ? 0
      : parseInt(currentTierDetail.storage, 10) *
        (currentTierDetail.storage.includes("GB") ? 1000 : 1);
  const totalStorageMB = baseStorageMB + storageExtraPurchasedMB;
  const dynamicStorageDisplay =
    currentTierDetail.storage === "Unlimited"
      ? "Unlimited"
      : totalStorageMB >= 1000
      ? `${(totalStorageMB / 1000).toFixed(1).replace(/\.0$/, "")} GB`
      : `${totalStorageMB} MB`;

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
            {/* TAB: General (Unified Card Theme & Thoughtful UI Matching Profile) */}
            {activeTab === "general" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, width: "100%" }}>
                {/* General Settings Title Header */}
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
                      <IconAdjustments size={24} stroke={2} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 20, fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>
                        General Settings
                      </Typography>
                      <Typography sx={{ fontSize: 13.5, color: "#6B7280", mt: 0.25 }}>
                        Customize notification triggers, alert delivery channels, interface theme, and regional options.
                      </Typography>
                    </Box>
                  </Box>

                  {/* Auto-saved badge on complete right side */}
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 1,
                      px: 1.5,
                      py: 0.75,
                      borderRadius: "10px",
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #EAECF0",
                      color: "#059669",
                      fontSize: 12.5,
                      fontWeight: 600,
                      boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.04)",
                      flexShrink: 0,
                    }}
                  >
                    <Box sx={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#10B981" }} />
                    Changes auto-saved
                  </Box>
                </Box>

                {/* 1. Notification Events Card */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {/* Card Header */}
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
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
                        <IconBell size={20} stroke={2} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                          Notification Events
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#6B7280" }}>
                          Select which automated actions and workspace milestones trigger alerts for your account.
                        </Typography>
                      </Box>
                    </Box>

                    <Typography
                      component="button"
                      onClick={() => toast.info("Notifications are routed based on your connected integrations and assigned roles.")}
                      sx={{
                        background: "none",
                        border: "none",
                        p: 0,
                        fontSize: 13,
                        color: "#4F46E5",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: { xs: "none", sm: "block" },
                        "&:hover": { textDecoration: "underline" },
                      }}
                    >
                      About notifications?
                    </Typography>
                  </Box>

                  {/* Interactive Trigger Tiles */}
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                    {[
                      {
                        title: "Daily productivity update",
                        desc: "Receive an automated morning summary of processed emails, drafted AI responses, and queue metrics.",
                        checked: productivityUpdate,
                        onChange: setProductivityUpdate,
                      },
                      {
                        title: "New event created",
                        desc: "Instant alert when follow-up rules execute, calendar invites arrive, or urgent threads are flagged.",
                        checked: newEventCreated,
                        onChange: setNewEventCreated,
                      },
                      {
                        title: "When added on new team",
                        desc: "Notify immediately when assigned to an organization workspace, team role, or shared inbox queue.",
                        checked: addedOnNewTeam,
                        onChange: setAddedOnNewTeam,
                      },
                    ].map((item, idx) => (
                      <Box
                        key={idx}
                        onClick={() => item.onChange(!item.checked)}
                        sx={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 2,
                          p: 2,
                          borderRadius: "12px",
                          border: "1px solid",
                          borderColor: item.checked ? "#C7D7FE" : "#EAECF0",
                          backgroundColor: item.checked ? "#F9FAFB" : "#FFFFFF",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          "&:hover": {
                            backgroundColor: "#F9FAFB",
                            borderColor: item.checked ? "#A5B4FC" : "#D0D5DD",
                          },
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                          <Checkbox
                            checked={item.checked}
                            onChange={(e) => {
                              e.stopPropagation();
                              item.onChange(e.target.checked);
                            }}
                            disableRipple
                            sx={{
                              p: 0,
                              mt: 0.25,
                              color: "#D0D5DD",
                              "&.Mui-checked": { color: "#4F46E5" },
                            }}
                          />
                          <Box>
                            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#111827", lineHeight: 1.3 }}>
                              {item.title}
                            </Typography>
                            <Typography sx={{ fontSize: 13, color: "#6B7280", mt: 0.3, lineHeight: 1.45 }}>
                              {item.desc}
                            </Typography>
                          </Box>
                        </Box>

                        <Chip
                          size="small"
                          label={item.checked ? "Active" : "Muted"}
                          sx={{
                            flexShrink: 0,
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.02em",
                            height: 24,
                            backgroundColor: item.checked ? "#EEF2FF" : "#F3F4F6",
                            color: item.checked ? "#4F46E5" : "#6B7280",
                            border: item.checked ? "1px solid #C7D7FE" : "1px solid #E5E7EB",
                          }}
                        />
                      </Box>
                    ))}
                  </Box>
                </Box>

                {/* 2. Delivery Channels Card */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
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
                      <IconDeviceDesktop size={20} stroke={2} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                        Delivery Channels
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: "#6B7280" }}>
                        Control which hardware channels and connected clients receive notification dispatch.
                      </Typography>
                    </Box>
                  </Box>

                  {/* Channels List */}
                  <Box sx={{ display: "flex", flexDirection: "column" }}>
                    {/* Mobile Push */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        py: 2,
                        gap: 2,
                        borderBottom: "1px solid #F2F4F7",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: "8px",
                            backgroundColor: "#F3F4F6",
                            color: "#4F46E5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconDeviceMobile size={18} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                            Mobile push notifications
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: "#6B7280", mt: 0.25 }}>
                            Receive instant push notifications whenever your organization requires attention.
                          </Typography>
                        </Box>
                      </Box>
                      <UntitledSwitch
                        checked={mobilePush}
                        onChange={(e) => setMobilePush(e.target.checked)}
                        slotProps={{ input: { "aria-label": "Mobile push notifications" } }}
                      />
                    </Box>

                    {/* Desktop Notification */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        py: 2,
                        gap: 2,
                        borderBottom: "1px solid #F2F4F7",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: "8px",
                            backgroundColor: "#F3F4F6",
                            color: "#4F46E5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconDeviceDesktop size={18} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                            Desktop Notification
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: "#6B7280", mt: 0.25 }}>
                            Receive desktop notifications whenever your organization requires attention.
                          </Typography>
                        </Box>
                      </Box>
                      <UntitledSwitch
                        checked={desktopNotification}
                        onChange={(e) => setDesktopNotification(e.target.checked)}
                        slotProps={{ input: { "aria-label": "Desktop Notification" } }}
                      />
                    </Box>

                    {/* Email Notification */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        py: 2,
                        gap: 2,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: "8px",
                            backgroundColor: "#F3F4F6",
                            color: "#4F46E5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconMail size={18} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                            Email Notification
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: "#6B7280", mt: 0.25 }}>
                            Receive email digest and priority thread notices whenever your organization requires attention.
                          </Typography>
                        </Box>
                      </Box>
                      <UntitledSwitch
                        checked={emailNotification}
                        onChange={(e) => setEmailNotification(e.target.checked)}
                        slotProps={{ input: { "aria-label": "Email Notification" } }}
                      />
                    </Box>
                  </Box>
                </Box>

                {/* 3. System & Display Preferences Card */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
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
                      <IconAdjustments size={20} stroke={2} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                        Display & Security Settings
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: "#6B7280" }}>
                        Customize your dashboard appearance, authentication security, and localization options.
                      </Typography>
                    </Box>
                  </Box>

                  {/* Settings Rows */}
                  <Box sx={{ display: "flex", flexDirection: "column" }}>
                    {/* Appearance */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: { xs: "flex-start", sm: "center" },
                        justifyContent: "space-between",
                        flexDirection: { xs: "column", sm: "row" },
                        py: 2,
                        gap: 2,
                        borderBottom: "1px solid #F2F4F7",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: "8px",
                            backgroundColor: "#F3F4F6",
                            color: "#4F46E5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconSun size={18} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                            Appearance
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: "#6B7280", mt: 0.25 }}>
                            Customize how the dashboard theme looks on your device.
                          </Typography>
                        </Box>
                      </Box>

                      {/* Segmented Choice Control */}
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          backgroundColor: "#F3F4F6",
                          p: "4px",
                          borderRadius: "10px",
                          border: "1px solid #E5E7EB",
                          flexShrink: 0,
                        }}
                      >
                        {[
                          { key: "Light", label: "Light", icon: IconSun },
                          { key: "Dark", label: "Dark", icon: IconMoon },
                          { key: "System", label: "System", icon: IconDeviceDesktop },
                        ].map((mode) => {
                          const ModeIcon = mode.icon;
                          const isSelected = appearance === mode.key;
                          return (
                            <Box
                              key={mode.key}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setAppearance(mode.key);
                                toast.success(`Theme switched to ${mode.label}`);
                              }}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.75,
                                px: 1.75,
                                py: 0.6,
                                borderRadius: "8px",
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                backgroundColor: isSelected ? "#FFFFFF" : "transparent",
                                color: isSelected ? "#111827" : "#6B7280",
                                boxShadow: isSelected ? "0px 1px 2px rgba(16, 24, 40, 0.08)" : "none",
                                "&:hover": {
                                  color: "#111827",
                                },
                              }}
                            >
                              <ModeIcon size={15} stroke={isSelected ? 2.2 : 1.8} />
                              {mode.label}
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>

                    {/* Two-Factor Authentication */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        py: 2,
                        gap: 2,
                        borderBottom: "1px solid #F2F4F7",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: "8px",
                            backgroundColor: "#F3F4F6",
                            color: "#4F46E5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconShieldCheck size={18} />
                        </Box>
                        <Box>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                              Two-factor authentication
                            </Typography>
                            <Chip
                              size="small"
                              label={twoFactorAuth ? "Enabled" : "Off"}
                              sx={{
                                fontSize: 11,
                                fontWeight: 700,
                                height: 20,
                                backgroundColor: twoFactorAuth ? "#ECFDF5" : "#F3F4F6",
                                color: twoFactorAuth ? "#059669" : "#6B7280",
                                border: twoFactorAuth ? "1px solid #A7F3D0" : "1px solid #E5E7EB",
                              }}
                            />
                          </Box>
                          <Typography sx={{ fontSize: 13, color: "#6B7280", mt: 0.25 }}>
                            Keep your account secure by enabling 2FA via SMS or using a temporary one-time passcode (TOTP).
                          </Typography>
                        </Box>
                      </Box>
                      <UntitledSwitch
                        checked={twoFactorAuth}
                        onChange={(e) => setTwoFactorAuth(e.target.checked)}
                        slotProps={{ input: { "aria-label": "Two-factor authentication" } }}
                      />
                    </Box>

                    {/* Language */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: { xs: "flex-start", sm: "center" },
                        justifyContent: "space-between",
                        flexDirection: { xs: "column", sm: "row" },
                        py: 2,
                        gap: 2,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: "8px",
                            backgroundColor: "#F3F4F6",
                            color: "#4F46E5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconWorld size={18} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                            Language
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: "#6B7280", mt: 0.25 }}>
                            Choose your preferred language for the user interface and system notifications.
                          </Typography>
                        </Box>
                      </Box>

                      {/* Styled Language Select */}
                      <Box
                        component="select"
                        value={language}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                          setLanguage(e.target.value);
                          toast.success(`Language set to ${e.target.value}`);
                        }}
                        sx={{
                          backgroundColor: "#FFFFFF",
                          border: "1px solid #D1D5DB",
                          borderRadius: "10px",
                          px: 2,
                          py: 0.85,
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "#344054",
                          outline: "none",
                          cursor: "pointer",
                          minWidth: 150,
                          boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                          transition: "all 0.15s ease",
                          "&:hover": { borderColor: "#9CA3AF" },
                          "&:focus": { borderColor: "#4F46E5", boxShadow: "0 0 0 2px rgba(79, 70, 229, 0.2)" },
                        }}
                      >
                        <option value="English">🇺🇸 English (US)</option>
                        <option value="Spanish">🇪🇸 Spanish (Español)</option>
                        <option value="French">🇫🇷 French (Français)</option>
                        <option value="German">🇩🇪 German (Deutsch)</option>
                      </Box>
                    </Box>
                  </Box>
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

            {/* TAB: Preferences (Rich, Thoughtful Multi-Card Architecture Matching Profile & General Theme) */}
            {activeTab === "preferences" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, width: "100%" }}>
                {/* Preferences Title Header */}
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
                      <IconAdjustments size={24} stroke={2} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 20, fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>
                        Workspace Preferences
                      </Typography>
                      <Typography sx={{ fontSize: 13.5, color: "#6B7280", mt: 0.25 }}>
                        Configure AI drafting intelligence, composer behavior, inbox density, and automation rules.
                      </Typography>
                    </Box>
                  </Box>

                  {/* Auto-saved badge on complete right side */}
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 1,
                      px: 1.5,
                      py: 0.75,
                      borderRadius: "10px",
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #EAECF0",
                      color: "#059669",
                      fontSize: 12.5,
                      fontWeight: 600,
                      boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.04)",
                      flexShrink: 0,
                    }}
                  >
                    <Box sx={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#10B981" }} />
                    Preferences synced
                  </Box>
                </Box>

                {/* 1. AI Drafting & Copilot Intelligence Card */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {/* Card Header */}
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
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
                        <IconBrain size={20} stroke={2} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                          AI Drafting & Copilot Intelligence
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#6B7280" }}>
                          Control tone presets, review gates, and knowledge grounding for generated draft suggestions.
                        </Typography>
                      </Box>
                    </Box>

                    <Button
                      component={Link}
                      href="/dashboard/knowledge"
                      endIcon={<IconChevronRight size={14} />}
                      sx={{
                        backgroundColor: "#F9FAFB",
                        border: "1px solid #D0D5DD",
                        borderRadius: "8px",
                        color: "#344054",
                        fontSize: 12.5,
                        fontWeight: 600,
                        textTransform: "none",
                        px: 1.5,
                        py: 0.6,
                        display: { xs: "none", sm: "inline-flex" },
                        boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                        "&:hover": { backgroundColor: "#F2F4F7", borderColor: "#98A2B3" },
                      }}
                    >
                      Knowledge Base
                    </Button>
                  </Box>

                  {/* Settings Rows */}
                  <Box sx={{ display: "flex", flexDirection: "column" }}>
                    {/* Default Response Tone */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: { xs: "flex-start", lg: "center" },
                        justifyContent: "space-between",
                        flexDirection: { xs: "column", lg: "row" },
                        py: 2,
                        gap: 2,
                        borderBottom: "1px solid #F2F4F7",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: "8px",
                            backgroundColor: "#F3F4F6",
                            color: "#4F46E5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconSparkles size={18} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                            Default response tone
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: "#6B7280", mt: 0.25 }}>
                            Tone applied by AI when drafting suggestions for incoming customer inquiries.
                          </Typography>
                        </Box>
                      </Box>

                      {/* Segmented Choice Tone Control */}
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          backgroundColor: "#F3F4F6",
                          p: "4px",
                          borderRadius: "10px",
                          border: "1px solid #E5E7EB",
                          flexWrap: "wrap",
                        }}
                      >
                        {[
                          { key: "Professional & Direct", label: "Professional" },
                          { key: "Friendly & Warm", label: "Friendly" },
                          { key: "Concise & Fast", label: "Concise" },
                          { key: "Formal & Polished", label: "Formal" },
                        ].map((tone) => {
                          const isSelected = responseTone === tone.key;
                          return (
                            <Box
                              key={tone.key}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setResponseTone(tone.key);
                                toast.success(`Default tone set to ${tone.label}`);
                              }}
                              sx={{
                                px: 1.75,
                                py: 0.6,
                                borderRadius: "8px",
                                fontSize: 12.5,
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                backgroundColor: isSelected ? "#FFFFFF" : "transparent",
                                color: isSelected ? "#4F46E5" : "#6B7280",
                                boxShadow: isSelected ? "0px 1px 2px rgba(16, 24, 40, 0.08)" : "none",
                                "&:hover": { color: "#111827" },
                              }}
                            >
                              {tone.label}
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>

                    {/* Require Human Review */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        py: 2,
                        gap: 2,
                        borderBottom: "1px solid #F2F4F7",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: "8px",
                            backgroundColor: "#F3F4F6",
                            color: "#4F46E5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconCheck size={18} />
                        </Box>
                        <Box>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                              Require Human Review Before Sending
                            </Typography>
                            <Chip
                              size="small"
                              label={requireHumanReview ? "Review Queue Enforced" : "Autopilot"}
                              sx={{
                                fontSize: 11,
                                fontWeight: 700,
                                height: 20,
                                backgroundColor: requireHumanReview ? "#EEF2FF" : "#FFFBEB",
                                color: requireHumanReview ? "#4F46E5" : "#D97706",
                                border: requireHumanReview ? "1px solid #C7D7FE" : "1px solid #FDE68A",
                              }}
                            />
                          </Box>
                          <Typography sx={{ fontSize: 13, color: "#6B7280", mt: 0.25 }}>
                            Ensure every AI-generated suggestion is reviewed and confirmed by an agent before dispatch.
                          </Typography>
                        </Box>
                      </Box>
                      <UntitledSwitch
                        checked={requireHumanReview}
                        onChange={(e) => setRequireHumanReview(e.target.checked)}
                        slotProps={{ input: { "aria-label": "Require Human Review Before Sending" } }}
                      />
                    </Box>

                    {/* Strict Knowledge Grounding */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        py: 2,
                        gap: 2,
                        borderBottom: "1px solid #F2F4F7",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: "8px",
                            backgroundColor: "#F3F4F6",
                            color: "#4F46E5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconShieldCheck size={18} />
                        </Box>
                        <Box>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                              Strict Knowledge Grounding
                            </Typography>
                            <Chip
                              size="small"
                              label={strictGrounding ? "Zero Speculation" : "Creative"}
                              sx={{
                                fontSize: 11,
                                fontWeight: 700,
                                height: 20,
                                backgroundColor: strictGrounding ? "#ECFDF5" : "#F3F4F6",
                                color: strictGrounding ? "#059669" : "#6B7280",
                                border: strictGrounding ? "1px solid #A7F3D0" : "1px solid #E5E7EB",
                              }}
                            />
                          </Box>
                          <Typography sx={{ fontSize: 13, color: "#6B7280", mt: 0.25 }}>
                            Only answer inquiries backed by indexed documents; politely decline unknown product questions.
                          </Typography>
                        </Box>
                      </Box>
                      <UntitledSwitch
                        checked={strictGrounding}
                        onChange={(e) => setStrictGrounding(e.target.checked)}
                        slotProps={{ input: { "aria-label": "Strict Knowledge Grounding" } }}
                      />
                    </Box>

                    {/* Confidence Threshold */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: { xs: "flex-start", sm: "center" },
                        justifyContent: "space-between",
                        flexDirection: { xs: "column", sm: "row" },
                        py: 2,
                        gap: 2,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: "8px",
                            backgroundColor: "#F3F4F6",
                            color: "#4F46E5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconBrain size={18} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                            Confidence threshold
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: "#6B7280", mt: 0.25 }}>
                            Minimum confidence score required for AI Copilot to automatically prepare draft responses.
                          </Typography>
                        </Box>
                      </Box>

                      <Box
                        component="select"
                        value={confidenceThreshold}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                          setConfidenceThreshold(e.target.value);
                          toast.success(`Confidence threshold set to ${e.target.value}`);
                        }}
                        sx={{
                          backgroundColor: "#FFFFFF",
                          border: "1px solid #D1D5DB",
                          borderRadius: "10px",
                          px: 2,
                          py: 0.85,
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "#344054",
                          outline: "none",
                          cursor: "pointer",
                          minWidth: 160,
                          boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                          transition: "all 0.15s ease",
                          "&:hover": { borderColor: "#9CA3AF" },
                          "&:focus": { borderColor: "#4F46E5", boxShadow: "0 0 0 2px rgba(79, 70, 229, 0.2)" },
                        }}
                      >
                        <option value="90%">Strict (90%+ Confidence)</option>
                        <option value="85%">Balanced (85%+ Confidence)</option>
                        <option value="70%">Permissive (70%+ Confidence)</option>
                      </Box>
                    </Box>
                  </Box>
                </Box>

                {/* 2. Email Composition & Working Defaults Card */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
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
                      <IconPencil size={20} stroke={2} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                        Email Composition & Working Defaults
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: "#6B7280" }}>
                        Configure default reply actions, signature injection, and auto-save caching.
                      </Typography>
                    </Box>
                  </Box>

                  {/* Settings Rows */}
                  <Box sx={{ display: "flex", flexDirection: "column" }}>
                    {/* Default Reply Action */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: { xs: "flex-start", sm: "center" },
                        justifyContent: "space-between",
                        flexDirection: { xs: "column", sm: "row" },
                        py: 2,
                        gap: 2,
                        borderBottom: "1px solid #F2F4F7",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: "8px",
                            backgroundColor: "#F3F4F6",
                            color: "#4F46E5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconMail size={18} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                            Default reply action
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: "#6B7280", mt: 0.25 }}>
                            Primary action triggered when replying to multi-recipient email threads.
                          </Typography>
                        </Box>
                      </Box>

                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          backgroundColor: "#F3F4F6",
                          p: "4px",
                          borderRadius: "10px",
                          border: "1px solid #E5E7EB",
                          flexShrink: 0,
                        }}
                      >
                        {["Reply All", "Reply Sender"].map((action) => {
                          const isSelected = replyBehavior === action;
                          return (
                            <Box
                              key={action}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setReplyBehavior(action);
                                toast.success(`Default reply set to ${action}`);
                              }}
                              sx={{
                                px: 1.75,
                                py: 0.6,
                                borderRadius: "8px",
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                backgroundColor: isSelected ? "#FFFFFF" : "transparent",
                                color: isSelected ? "#111827" : "#6B7280",
                                boxShadow: isSelected ? "0px 1px 2px rgba(16, 24, 40, 0.08)" : "none",
                                "&:hover": { color: "#111827" },
                              }}
                            >
                              {action}
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>

                    {/* Include Verified Signature */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        py: 2,
                        gap: 2,
                        borderBottom: "1px solid #F2F4F7",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: "8px",
                            backgroundColor: "#F3F4F6",
                            color: "#4F46E5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconPencil size={18} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                            Include verified workspace signature
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: "#6B7280", mt: 0.25 }}>
                            Automatically append your sender signature and team details to outgoing email drafts.
                          </Typography>
                        </Box>
                      </Box>
                      <UntitledSwitch
                        checked={includeSignature}
                        onChange={(e) => setIncludeSignature(e.target.checked)}
                        slotProps={{ input: { "aria-label": "Include verified workspace signature" } }}
                      />
                    </Box>

                    {/* Quote Thread History */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        py: 2,
                        gap: 2,
                        borderBottom: "1px solid #F2F4F7",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: "8px",
                            backgroundColor: "#F3F4F6",
                            color: "#4F46E5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconStack2 size={18} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                            Quote prior conversation history
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: "#6B7280", mt: 0.25 }}>
                            Automatically append the client&rsquo;s previous email chain at the bottom of drafts.
                          </Typography>
                        </Box>
                      </Box>
                      <UntitledSwitch
                        checked={includeThreadHistory}
                        onChange={(e) => setIncludeThreadHistory(e.target.checked)}
                        slotProps={{ input: { "aria-label": "Quote prior conversation history" } }}
                      />
                    </Box>

                    {/* Auto-Save Draft Frequency */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: { xs: "flex-start", sm: "center" },
                        justifyContent: "space-between",
                        flexDirection: { xs: "column", sm: "row" },
                        py: 2,
                        gap: 2,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: "8px",
                            backgroundColor: "#F3F4F6",
                            color: "#4F46E5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconDeviceDesktop size={18} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                            Draft auto-save interval
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: "#6B7280", mt: 0.25 }}>
                            Frequency at which ongoing draft edits are synced to encrypted browser storage.
                          </Typography>
                        </Box>
                      </Box>

                      <Box
                        component="select"
                        value={autoSaveDrafts}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                          setAutoSaveDrafts(e.target.value);
                          toast.success(`Auto-save interval updated`);
                        }}
                        sx={{
                          backgroundColor: "#FFFFFF",
                          border: "1px solid #D1D5DB",
                          borderRadius: "10px",
                          px: 2,
                          py: 0.85,
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "#344054",
                          outline: "none",
                          cursor: "pointer",
                          minWidth: 160,
                          boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                          transition: "all 0.15s ease",
                          "&:hover": { borderColor: "#9CA3AF" },
                          "&:focus": { borderColor: "#4F46E5", boxShadow: "0 0 0 2px rgba(79, 70, 229, 0.2)" },
                        }}
                      >
                        <option value="15s">Every 15 seconds</option>
                        <option value="30s">Every 30 seconds</option>
                        <option value="60s">Every 1 minute</option>
                      </Box>
                    </Box>
                  </Box>
                </Box>

                {/* 3. Inbox Display & Workflow Density Card */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
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
                      <IconLayoutGrid size={20} stroke={2} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                        Inbox Display & Workflow Density
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: "#6B7280" }}>
                        Configure inbox list layout, triage auto-advance rules, and hotkey navigation.
                      </Typography>
                    </Box>
                  </Box>

                  {/* Settings Rows */}
                  <Box sx={{ display: "flex", flexDirection: "column" }}>
                    {/* List Density */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: { xs: "flex-start", sm: "center" },
                        justifyContent: "space-between",
                        flexDirection: { xs: "column", sm: "row" },
                        py: 2,
                        gap: 2,
                        borderBottom: "1px solid #F2F4F7",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: "8px",
                            backgroundColor: "#F3F4F6",
                            color: "#4F46E5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconLayoutGrid size={18} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                            Conversation list density
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: "#6B7280", mt: 0.25 }}>
                            Select between spacious preview snippets or a high-density triage list.
                          </Typography>
                        </Box>
                      </Box>

                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          backgroundColor: "#F3F4F6",
                          p: "4px",
                          borderRadius: "10px",
                          border: "1px solid #E5E7EB",
                          flexShrink: 0,
                        }}
                      >
                        {["Comfortable", "Compact"].map((mode) => {
                          const isSelected = inboxDensity === mode;
                          return (
                            <Box
                              key={mode}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setInboxDensity(mode);
                                toast.success(`Inbox density switched to ${mode}`);
                              }}
                              sx={{
                                px: 1.75,
                                py: 0.6,
                                borderRadius: "8px",
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                backgroundColor: isSelected ? "#FFFFFF" : "transparent",
                                color: isSelected ? "#111827" : "#6B7280",
                                boxShadow: isSelected ? "0px 1px 2px rgba(16, 24, 40, 0.08)" : "none",
                                "&:hover": { color: "#111827" },
                              }}
                            >
                              {mode}
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>

                    {/* Auto-Advance */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: { xs: "flex-start", sm: "center" },
                        justifyContent: "space-between",
                        flexDirection: { xs: "column", sm: "row" },
                        py: 2,
                        gap: 2,
                        borderBottom: "1px solid #F2F4F7",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: "8px",
                            backgroundColor: "#F3F4F6",
                            color: "#4F46E5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconChevronRight size={18} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                            Auto-advance on send or archive
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: "#6B7280", mt: 0.25 }}>
                            Automatically open the next thread after completing a message action.
                          </Typography>
                        </Box>
                      </Box>

                      <Box
                        component="select"
                        value={autoAdvance}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                          setAutoAdvance(e.target.value);
                          toast.success(`Auto-advance set to ${e.target.value}`);
                        }}
                        sx={{
                          backgroundColor: "#FFFFFF",
                          border: "1px solid #D1D5DB",
                          borderRadius: "10px",
                          px: 2,
                          py: 0.85,
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "#344054",
                          outline: "none",
                          cursor: "pointer",
                          minWidth: 160,
                          boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                          transition: "all 0.15s ease",
                          "&:hover": { borderColor: "#9CA3AF" },
                          "&:focus": { borderColor: "#4F46E5", boxShadow: "0 0 0 2px rgba(79, 70, 229, 0.2)" },
                        }}
                      >
                        <option value="Next thread">Next thread</option>
                        <option value="Previous thread">Previous thread</option>
                        <option value="Return to list">Return to inbox list</option>
                      </Box>
                    </Box>

                    {/* Keyboard Shortcuts */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        py: 2,
                        gap: 2,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: "8px",
                            backgroundColor: "#F3F4F6",
                            color: "#4F46E5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconKeyboard size={18} />
                        </Box>
                        <Box>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                              Superhuman-style keyboard shortcuts
                            </Typography>
                            <Chip
                              size="small"
                              label="⌘ Hotkeys"
                              sx={{
                                fontSize: 11,
                                fontWeight: 700,
                                height: 20,
                                backgroundColor: keyboardShortcuts ? "#ECFDF5" : "#F3F4F6",
                                color: keyboardShortcuts ? "#059669" : "#6B7280",
                                border: keyboardShortcuts ? "1px solid #A7F3D0" : "1px solid #E5E7EB",
                              }}
                            />
                          </Box>
                          <Typography sx={{ fontSize: 13, color: "#6B7280", mt: 0.25 }}>
                            Triage faster with keyboard shortcuts: E to archive, R to reply, J/K to navigate threads.
                          </Typography>
                        </Box>
                      </Box>
                      <UntitledSwitch
                        checked={keyboardShortcuts}
                        onChange={(e) => setKeyboardShortcuts(e.target.checked)}
                        slotProps={{ input: { "aria-label": "Superhuman-style keyboard shortcuts" } }}
                      />
                    </Box>
                  </Box>
                </Box>

                {/* 4. Smart Tagging & Customer Insights Card */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {/* Card Header */}
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
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
                        <IconRocket size={20} stroke={2} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                          Smart Tagging & Customer Insights
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#6B7280" }}>
                          Automate lead intent classification, priority badges, and follow-up schedules.
                        </Typography>
                      </Box>
                    </Box>

                    <Button
                      onClick={() => handleSelectTab("follow-ups")}
                      endIcon={<IconChevronRight size={14} />}
                      sx={{
                        backgroundColor: "#F9FAFB",
                        border: "1px solid #D0D5DD",
                        borderRadius: "8px",
                        color: "#344054",
                        fontSize: 12.5,
                        fontWeight: 600,
                        textTransform: "none",
                        px: 1.5,
                        py: 0.6,
                        display: { xs: "none", sm: "inline-flex" },
                        boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                        "&:hover": { backgroundColor: "#F2F4F7", borderColor: "#98A2B3" },
                      }}
                    >
                      Follow-up Rules
                    </Button>
                  </Box>

                  {/* Settings Rows */}
                  <Box sx={{ display: "flex", flexDirection: "column" }}>
                    {/* Automated Intent Classification */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        py: 2,
                        gap: 2,
                        borderBottom: "1px solid #F2F4F7",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: "8px",
                            backgroundColor: "#F3F4F6",
                            color: "#4F46E5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconSparkles size={18} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                            Automated lead intent classification
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: "#6B7280", mt: 0.25 }}>
                            Automatically categorize incoming emails into Hot Leads, Billing, Support, and Inquiries.
                          </Typography>
                        </Box>
                      </Box>
                      <UntitledSwitch
                        checked={autoSentimentTagging}
                        onChange={(e) => setAutoSentimentTagging(e.target.checked)}
                        slotProps={{ input: { "aria-label": "Automated lead intent classification" } }}
                      />
                    </Box>

                    {/* Follow-up Policy Reminders */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        py: 2,
                        gap: 2,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: "8px",
                            backgroundColor: "#F3F4F6",
                            color: "#4F46E5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconMail size={18} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                            Unanswered thread follow-up alerts
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: "#6B7280", mt: 0.25 }}>
                            Flag high-value customer threads that haven&rsquo;t received a response after 48 hours.
                          </Typography>
                        </Box>
                      </Box>
                      <UntitledSwitch
                        checked={autoFollowupReminders}
                        onChange={(e) => setAutoFollowupReminders(e.target.checked)}
                        slotProps={{ input: { "aria-label": "Unanswered thread follow-up alerts" } }}
                      />
                    </Box>
                  </Box>
                </Box>
              </Box>
            )}

            {/* TAB: Billing */}
            {activeTab === "billing" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {/* Section Header with Live Renewal Status Card */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: { xs: "flex-start", sm: "center" },
                    justifyContent: "space-between",
                    gap: 2,
                    flexWrap: "wrap",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.75 }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: "12px",
                        background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
                        color: "#4F46E5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid rgba(99, 102, 241, 0.15)",
                        boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                      }}
                    >
                      <IconCreditCard size={24} stroke={2.2} />
                    </Box>
                    <Box>
                      <Typography
                        sx={{
                          fontSize: { xs: 20, sm: 22 },
                          fontWeight: 700,
                          color: "#101828",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        Plan & Billing
                      </Typography>
                      <Typography sx={{ fontSize: 13.5, color: "#667085", mt: 0.25 }}>
                        Manage subscription tier, seat limits, automated recharge safeguards, and invoice history.
                      </Typography>
                    </Box>
                  </Box>

                  {/* Live Subscription Status Card */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      px: 2,
                      py: 1.25,
                      borderRadius: "12px",
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E5E7EB",
                      boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                    }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "10px",
                        background: currentPlanMeta.ringGradient,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#FFFFFF",
                        flexShrink: 0,
                      }}
                    >
                      <IconSparkles size={18} stroke={2.2} />
                    </Box>
                    <Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography
                          sx={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: "#667085",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            lineHeight: 1,
                          }}
                        >
                          Next Renewal • Dec 01, 2026
                        </Typography>
                        <Box
                          sx={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            backgroundColor: "#10B981",
                            boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.2)",
                          }}
                        />
                      </Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#101828", mt: 0.35, lineHeight: 1.2 }}>
                        {currentPlanMeta.name} Plan • {billingCycle === "yearly" ? `$${currentTierDetail.yearlyMonthlyPrice}/mo` : `$${currentTierDetail.monthlyPrice}/mo`}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* CARD 1: Active Subscription Plan & Tier Overview */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                  }}
                >
                  {/* Card Header & Monthly/Yearly Toggle */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: { xs: "flex-start", sm: "center" },
                      justifyContent: "space-between",
                      gap: 2,
                      flexWrap: "wrap",
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
                        <IconSparkles size={20} stroke={2} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
                          Active Subscription Plan
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Your workspace is operating on the {currentPlanMeta.name} tier with full AI autopilot access.
                        </Typography>
                      </Box>
                    </Box>

                    {/* Segmented Monthly / Yearly Selector */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        backgroundColor: "#F3F4F6",
                        p: "4px",
                        borderRadius: "10px",
                        border: "1px solid #E5E7EB",
                        flexShrink: 0,
                      }}
                    >
                      <Box
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setBillingCycle("monthly");
                          toast.info("Switched view to monthly billing");
                        }}
                        sx={{
                          px: 1.75,
                          py: 0.6,
                          borderRadius: "8px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          backgroundColor: billingCycle === "monthly" ? "#FFFFFF" : "transparent",
                          color: billingCycle === "monthly" ? "#111827" : "#6B7280",
                          boxShadow: billingCycle === "monthly" ? "0px 1px 2px rgba(16, 24, 40, 0.08)" : "none",
                        }}
                      >
                        Monthly
                      </Box>
                      <Box
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setBillingCycle("yearly");
                          toast.info("Switched view to yearly billing (Save 20%)");
                        }}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.75,
                          px: 1.75,
                          py: 0.6,
                          borderRadius: "8px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          backgroundColor: billingCycle === "yearly" ? "#FFFFFF" : "transparent",
                          color: billingCycle === "yearly" ? "#111827" : "#6B7280",
                          boxShadow: billingCycle === "yearly" ? "0px 1px 2px rgba(16, 24, 40, 0.08)" : "none",
                        }}
                      >
                        Yearly
                        <Chip
                          size="small"
                          label="Save 20%"
                          sx={{
                            height: 18,
                            fontSize: 10,
                            fontWeight: 700,
                            backgroundColor: "#DCFCE7",
                            color: "#16A34A",
                            border: "1px solid #86EFAC",
                          }}
                        />
                      </Box>
                    </Box>
                  </Box>

                  {/* Plan Showcase Banner */}
                  <Box
                    sx={{
                      borderRadius: "14px",
                      border: "1.5px solid #E0E7FF",
                      background: "linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)",
                      p: { xs: 2, sm: 2.5 },
                      display: "flex",
                      alignItems: { xs: "flex-start", lg: "center" },
                      justifyContent: "space-between",
                      flexDirection: { xs: "column", lg: "row" },
                      gap: 2.5,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2.5 }}>
                      {/* Plan Glowing Tag Avatar */}
                      <Box sx={{ position: "relative", flexShrink: 0 }}>
                        <Box
                          sx={{
                            width: 64,
                            height: 64,
                            borderRadius: "50%",
                            p: "3px",
                            background: currentPlanMeta.ringGradient,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: currentPlanMeta.avatarShadow,
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
                              fontSize: 22,
                              fontWeight: 700,
                            }}
                          >
                            {currentPlanMeta.name[0]}
                          </Box>
                        </Box>
                        <Box
                          sx={{
                            position: "absolute",
                            bottom: -6,
                            left: "50%",
                            transform: "translateX(-50%)",
                            background: currentPlanMeta.tagBg,
                            color: "#FFFFFF",
                            fontSize: "8.5px",
                            fontWeight: 800,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            px: 0.9,
                            py: 0.2,
                            borderRadius: "10px",
                            border: `1.5px solid ${currentPlanMeta.tagBorder}`,
                            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.12)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {currentPlanMeta.tagLabel}
                        </Box>
                      </Box>

                      {/* Plan Summary Details */}
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
                          <Typography sx={{ fontSize: 18, fontWeight: 700, color: "#101828" }}>
                            {currentPlanMeta.name} Plan
                          </Typography>
                          <Chip
                            size="small"
                            label="✓ Currently Active"
                            sx={{
                              height: 22,
                              fontSize: 11,
                              fontWeight: 700,
                              backgroundColor: "#ECFDF5",
                              color: "#059669",
                              border: "1px solid #A7F3D0",
                            }}
                          />
                        </Box>

                        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, mt: 0.5 }}>
                          <Typography sx={{ fontSize: 26, fontWeight: 800, color: "#101828", letterSpacing: "-0.03em" }}>
                            {billingCycle === "yearly" ? `$${currentTierDetail.yearlyMonthlyPrice}` : `$${currentTierDetail.monthlyPrice}`}
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: "#667085", fontWeight: 500 }}>
                            / user / month ({billingCycle === "yearly" ? "billed annually" : "billed monthly"})
                          </Typography>
                        </Box>

                        {/* Plan Feature Grid */}
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                            gap: 1,
                            mt: 1.5,
                          }}
                        >
                          {currentTierDetail.features.slice(0, 4).map((feat, idx) => (
                            <Box key={idx} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                              <IconCircleCheck size={16} color="#059669" />
                              <Typography sx={{ fontSize: 12.5, color: "#475467", fontWeight: 500 }}>
                                {feat}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    </Box>

                    {/* Action Buttons */}
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: { xs: "row", lg: "column" },
                        gap: 1.25,
                        flexShrink: 0,
                        width: { xs: "100%", sm: "auto" },
                        justifyContent: "flex-end",
                      }}
                    >
                      <Button
                        variant="contained"
                        onClick={() => setIsUpgradePlanOpen(true)}
                        startIcon={<IconRocket size={16} />}
                        sx={{
                          textTransform: "none",
                          fontWeight: 700,
                          fontSize: 13,
                          backgroundColor: "#4F46E5",
                          borderRadius: "10px",
                          px: 2.25,
                          py: 1,
                          boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                          whiteSpace: "nowrap",
                          "&:hover": { backgroundColor: "#4338CA" },
                        }}
                      >
                        Change Plan / Upgrade
                      </Button>

                      <Button
                        variant="outlined"
                        onClick={() => {
                          toast.info("Opening Stripe billing customer portal...");
                          window.open("https://billing.stripe.com/p/login/test", "_blank");
                        }}
                        endIcon={<IconExternalLink size={15} />}
                        sx={{
                          textTransform: "none",
                          fontWeight: 600,
                          fontSize: 13,
                          color: "#344054",
                          borderColor: "#D0D5DD",
                          backgroundColor: "#FFFFFF",
                          borderRadius: "10px",
                          px: 2,
                          py: 0.9,
                          whiteSpace: "nowrap",
                          "&:hover": {
                            borderColor: "#98A2B3",
                            backgroundColor: "#F9FAFB",
                          },
                        }}
                      >
                        Customer Portal
                      </Button>
                    </Box>
                  </Box>
                </Box>

                {/* CARD 1b: Smart AI Intelligence ROI & Realized Labor Savings */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1.5px solid #E0E7FF",
                    background: "linear-gradient(180deg, #FAFBFF 0%, #FFFFFF 100%)",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", flexWrap: "wrap", gap: 1.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: "12px",
                          background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
                          color: "#4F46E5",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                        }}
                      >
                        <IconTrendingUp size={22} stroke={2.2} />
                      </Box>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography sx={{ fontSize: 16.5, fontWeight: 700, color: "#101828" }}>
                            AI Value Realization & ROI Intelligence
                          </Typography>
                          <Chip
                            size="small"
                            label="10.9x Net ROI"
                            sx={{
                              height: 20,
                              fontSize: 10.5,
                              fontWeight: 800,
                              backgroundColor: "#ECFDF5",
                              color: "#059669",
                              border: "1px solid #A7F3D0",
                            }}
                          />
                        </Box>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Quantified time and labor savings delivered by ProxiPilot&apos;s autonomous follow-up agent this billing cycle.
                        </Typography>
                      </Box>
                    </Box>

                    {/* Hourly Wage Adjustment for Custom ROI */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, backgroundColor: "#F8FAFC", p: "4px 10px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                      <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>
                        Sales Rep Rate:
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>$</Typography>
                        <Box
                          component="input"
                          type="number"
                          value={hourlyLaborRate}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHourlyLaborRate(Math.max(10, Math.min(250, Number(e.target.value) || 30)))}
                          sx={{
                            width: 48,
                            py: 0.2,
                            px: 0.5,
                            fontSize: 12,
                            fontWeight: 700,
                            borderRadius: "4px",
                            border: "1px solid #CBD5E1",
                            textAlign: "center",
                            outline: "none",
                          }}
                        />
                        <Typography sx={{ fontSize: 11.5, color: "#64748B" }}>/hr</Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* 4-Stat Value Realization Matrix */}
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
                      gap: 2,
                    }}
                  >
                    <Box sx={{ p: 2, borderRadius: "12px", backgroundColor: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                        Human Hours Saved
                      </Typography>
                      <Typography sx={{ fontSize: 24, fontWeight: 800, color: "#101828", mt: 0.5 }}>
                        142 hrs
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: "#16A34A", fontWeight: 600, mt: 0.25 }}>
                        ↑ 18% vs last month
                      </Typography>
                    </Box>

                    <Box sx={{ p: 2, borderRadius: "12px", backgroundColor: "#F0FDF4", border: "1px solid #DCFCE7" }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>
                        Realized Labor Value
                      </Typography>
                      <Typography sx={{ fontSize: 24, fontWeight: 800, color: "#15803D", mt: 0.5 }}>
                        +${(142 * hourlyLaborRate).toLocaleString()}
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: "#166534", fontWeight: 500, mt: 0.25 }}>
                        Net saved after subscription
                      </Typography>
                    </Box>

                    <Box sx={{ p: 2, borderRadius: "12px", backgroundColor: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                        Follow-up Accuracy
                      </Typography>
                      <Typography sx={{ fontSize: 24, fontWeight: 800, color: "#101828", mt: 0.5 }}>
                        98.4%
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: "#64748B", mt: 0.25 }}>
                        0 hallucinations flagged
                      </Typography>
                    </Box>

                    <Box sx={{ p: 2, borderRadius: "12px", backgroundColor: "#EFF6FF", border: "1px solid #DBEAFE" }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#1E40AF", textTransform: "uppercase" }}>
                        Effective Cost / Email
                      </Typography>
                      <Typography sx={{ fontSize: 24, fontWeight: 800, color: "#1D4ED8", mt: 0.5 }}>
                        $0.019
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: "#1E40AF", fontWeight: 600, mt: 0.25 }}>
                        86% cheaper than manual
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* CARD 2: Resource Quotas & AI Credit Balances */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          backgroundColor: "#FEF3C7",
                          color: "#D97706",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <IconBolt size={20} stroke={2} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
                          Resource Quotas & AI Credit Balances
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Live consumption tracking across AI intelligence tokens, team seats, and vector knowledge storage.
                        </Typography>
                      </Box>
                    </Box>

                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setIsBuyCreditsOpen(true)}
                      startIcon={<IconPlus size={15} />}
                      sx={{
                        textTransform: "none",
                        fontWeight: 600,
                        fontSize: 12.5,
                        color: "#4F46E5",
                        borderColor: "#C7D7FE",
                        backgroundColor: "#EEF2FF",
                        borderRadius: "8px",
                        px: 1.75,
                        "&:hover": {
                          borderColor: "#6366F1",
                          backgroundColor: "#E0E7FF",
                        },
                      }}
                    >
                      + Buy AI Credits
                    </Button>
                  </Box>

                  {/* 3 Quota Meter Grid */}
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(3, minmax(0, 1fr))",
                      },
                      gap: 2,
                    }}
                  >
                    {/* Meter 1: AI Credits */}
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: "12px",
                        border: "1px solid #E5E7EB",
                        backgroundColor: "#FAFAFA",
                        display: "flex",
                        flexDirection: "column",
                        gap: 1.25,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#667085", textTransform: "uppercase" }}>
                          AI Credits Left
                        </Typography>
                        <Chip
                          size="small"
                          label={`${dynamicPercentRemaining}%`}
                          sx={{
                            height: 18,
                            fontSize: 10,
                            fontWeight: 700,
                            backgroundColor: "#EEF2FF",
                            color: "#4F46E5",
                          }}
                        />
                      </Box>
                      <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#101828" }}>
                        {dynamicRemainingCredits.toLocaleString()}{" "}
                        <Typography component="span" sx={{ fontSize: 12, fontWeight: 500, color: "#98A2B3" }}>
                          / {dynamicTotalCredits.toLocaleString()}
                        </Typography>
                      </Typography>
                      <Box sx={{ width: "100%", height: 6, borderRadius: 3, backgroundColor: "#E5E7EB", overflow: "hidden" }}>
                        <Box
                          sx={{
                            width: `${dynamicPercentRemaining}%`,
                            height: "100%",
                            background: currentPlanMeta.barGradient,
                            borderRadius: 3,
                            transition: "width 0.3s ease",
                          }}
                        />
                      </Box>

                      {/* 1-Click Quick Refill Chips */}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", mt: 0.25 }}>
                        <Typography sx={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                          Quick Refill:
                        </Typography>
                        {[
                          { credits: 500, price: "$8" },
                          { credits: 1000, price: "$15" },
                          { credits: 2500, price: "$30" },
                        ].map((chip) => (
                          <Box
                            key={chip.credits}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleBuyCredits(chip.credits, chip.price)}
                            sx={{
                              px: 0.9,
                              py: 0.2,
                              borderRadius: "6px",
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #D0D5DD",
                              fontSize: 10.5,
                              fontWeight: 600,
                              color: "#344054",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              "&:hover": {
                                backgroundColor: "#EEF2FF",
                                borderColor: "#6366F1",
                                color: "#4F46E5",
                              },
                            }}
                          >
                            +{chip.credits.toLocaleString()} ({chip.price})
                          </Box>
                        ))}
                      </Box>

                      <Box
                        component="span"
                        onClick={() => setIsBuyCreditsOpen(true)}
                        sx={{
                          fontSize: 11.5,
                          color: "#4F46E5",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.5,
                          "&:hover": { textDecoration: "underline" },
                        }}
                      >
                        + Buy AI Credits →
                      </Box>
                    </Box>

                    {/* Meter 2: Team Member Seats */}
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: "12px",
                        border: "1px solid #E5E7EB",
                        backgroundColor: "#FAFAFA",
                        display: "flex",
                        flexDirection: "column",
                        gap: 1.25,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#667085", textTransform: "uppercase" }}>
                          Team Seats
                        </Typography>
                        <Chip
                          size="small"
                          label="1 In Use"
                          sx={{
                            height: 18,
                            fontSize: 10,
                            fontWeight: 700,
                            backgroundColor: "#DCFCE7",
                            color: "#16A34A",
                          }}
                        />
                      </Box>
                      <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#101828" }}>
                        1{" "}
                        <Typography component="span" sx={{ fontSize: 12, fontWeight: 500, color: "#98A2B3" }}>
                          / {dynamicTotalSeats} seats
                        </Typography>
                      </Typography>
                      <Box sx={{ width: "100%", height: 6, borderRadius: 3, backgroundColor: "#E5E7EB", overflow: "hidden" }}>
                        <Box
                          sx={{
                            width: `${Math.round((1 / dynamicTotalSeats) * 100)}%`,
                            height: "100%",
                            backgroundColor: "#10B981",
                            borderRadius: 3,
                          }}
                        />
                      </Box>
                      <Box
                        component="span"
                        onClick={() => setIsBuySeatsOpen(true)}
                        sx={{
                          fontSize: 11.5,
                          color: "#4F46E5",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.5,
                          "&:hover": { textDecoration: "underline" },
                        }}
                      >
                        + Buy Seats →
                      </Box>
                    </Box>

                    {/* Meter 3: Vector Storage */}
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: "12px",
                        border: "1px solid #E5E7EB",
                        backgroundColor: "#FAFAFA",
                        display: "flex",
                        flexDirection: "column",
                        gap: 1.25,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#667085", textTransform: "uppercase" }}>
                          Docs Storage
                        </Typography>
                        <Chip
                          size="small"
                          label="8% Used"
                          sx={{
                            height: 18,
                            fontSize: 10,
                            fontWeight: 700,
                            backgroundColor: "#F3E8FF",
                            color: "#7E22CE",
                          }}
                        />
                      </Box>
                      <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#101828" }}>
                        42 MB{" "}
                        <Typography component="span" sx={{ fontSize: 12, fontWeight: 500, color: "#98A2B3" }}>
                          / {dynamicStorageDisplay}
                        </Typography>
                      </Typography>
                      <Box sx={{ width: "100%", height: 6, borderRadius: 3, backgroundColor: "#E5E7EB", overflow: "hidden" }}>
                        <Box
                          sx={{
                            width: "8%",
                            height: "100%",
                            backgroundColor: "#8B5CF6",
                            borderRadius: 3,
                          }}
                        />
                      </Box>
                      <Box
                        component="span"
                        onClick={() => setIsBuyStorageOpen(true)}
                        sx={{
                          fontSize: 11.5,
                          color: "#4F46E5",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.5,
                          "&:hover": { textDecoration: "underline" },
                        }}
                      >
                        + Buy Storage →
                      </Box>
                    </Box>
                  </Box>

                  {/* Predictive Runway Forecast Tile */}
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: "12px",
                      backgroundColor: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      display: "flex",
                      alignItems: { xs: "flex-start", sm: "center" },
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          backgroundColor: "#ECFDF5",
                          color: "#059669",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <IconTrendingUp size={20} stroke={2} />
                      </Box>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: "#101828" }}>
                            Predictive Credit Runway: 34 Days Available
                          </Typography>
                          <Chip
                            size="small"
                            label="Healthy Runway"
                            sx={{
                              height: 18,
                              fontSize: 10,
                              fontWeight: 700,
                              backgroundColor: "#DCFCE7",
                              color: "#16A34A",
                              border: "1px solid #86EFAC",
                            }}
                          />
                        </Box>
                        <Typography sx={{ fontSize: 12, color: "#64748B", mt: 0.25 }}>
                          At current pace of ~42 credits/day, your remaining {dynamicRemainingCredits.toLocaleString()} credits will comfortably sustain operations until next monthly renewal on Dec 01, 2026 (~{Math.max(0, dynamicRemainingCredits - 462).toLocaleString()} credits projected buffer).
                        </Typography>
                      </Box>
                    </Box>
                    <Button
                      size="small"
                      onClick={() => setIsBuyCreditsOpen(true)}
                      sx={{ textTransform: "none", fontWeight: 700, fontSize: 12, color: "#4F46E5" }}
                    >
                      Top Up Balance →
                    </Button>
                  </Box>

                  {/* Smart Feature: Automatic AI Credit Top-Up Safeguard */}
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: "14px",
                      border: "1.5px solid #C7D7FE",
                      backgroundColor: "#F8FAFC",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: { xs: "flex-start", sm: "center" },
                        justifyContent: "space-between",
                        gap: 2,
                        flexWrap: "wrap",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
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
                            mt: 0.25,
                          }}
                        >
                          <IconRefresh size={18} stroke={2} />
                        </Box>
                        <Box>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#101828" }}>
                              Automatic AI Credit Top-Up Safeguard
                            </Typography>
                            <Chip
                              size="small"
                              label={autoTopUpEnabled ? "Active" : "Disabled"}
                              sx={{
                                height: 20,
                                fontSize: 11,
                                fontWeight: 700,
                                backgroundColor: autoTopUpEnabled ? "#ECFDF5" : "#F3F4F6",
                                color: autoTopUpEnabled ? "#059669" : "#6B7280",
                                border: autoTopUpEnabled ? "1px solid #A7F3D0" : "1px solid #E5E7EB",
                              }}
                            />
                          </Box>
                          <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                            Automatically purchase credits when your balance drops low, ensuring autonomous customer follow-ups and AI autopilot never pause.
                          </Typography>
                        </Box>
                      </Box>
                      <UntitledSwitch
                        checked={autoTopUpEnabled}
                        onChange={(e) => {
                          setAutoTopUpEnabled(e.target.checked);
                          toast.success(
                            e.target.checked
                              ? "AI Credit auto-top up safeguard enabled"
                              : "AI Credit auto-top up disabled"
                          );
                        }}
                        slotProps={{ input: { "aria-label": "Auto-top up credits" } }}
                      />
                    </Box>

                    {autoTopUpEnabled && (
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
                          gap: 2,
                          pt: 1.5,
                          borderTop: "1px solid #EAECF0",
                        }}
                      >
                        <Box>
                          <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#475467", mb: 0.5 }}>
                            Recharge Trigger Threshold
                          </Typography>
                          <Box
                            component="select"
                            value={autoTopUpThreshold}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                              setAutoTopUpThreshold(e.target.value);
                              toast.success(`Trigger threshold set to ${e.target.value}`);
                            }}
                            sx={{
                              width: "100%",
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #D1D5DB",
                              borderRadius: "8px",
                              px: 1.5,
                              py: 0.75,
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#374151",
                              outline: "none",
                              cursor: "pointer",
                            }}
                          >
                            <option value="10% (250 credits)">10% (250 credits)</option>
                            <option value="15% (375 credits)">15% (375 credits - Recommended)</option>
                            <option value="20% (500 credits)">20% (500 credits)</option>
                          </Box>
                        </Box>

                        <Box>
                          <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#475467", mb: 0.5 }}>
                            Top-Up Package
                          </Typography>
                          <Box
                            component="select"
                            value={autoTopUpPack}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                              setAutoTopUpPack(e.target.value);
                              toast.success(`Top-up pack set to ${e.target.value}`);
                            }}
                            sx={{
                              width: "100%",
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #D1D5DB",
                              borderRadius: "8px",
                              px: 1.5,
                              py: 0.75,
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#374151",
                              outline: "none",
                              cursor: "pointer",
                            }}
                          >
                            <option value="1,000 credits ($15)">1,000 credits ($15)</option>
                            <option value="2,500 credits ($30)">2,500 credits ($30 • Save 20%)</option>
                            <option value="5,000 credits ($55)">5,000 credits ($55 • Save 27%)</option>
                          </Box>
                        </Box>

                        <Box>
                          <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#475467", mb: 0.5 }}>
                            Monthly Safety Limit
                          </Typography>
                          <Box
                            component="select"
                            value={maxAutoTopUps}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                              setMaxAutoTopUps(e.target.value);
                              toast.success(`Monthly safety cap set to ${e.target.value}`);
                            }}
                            sx={{
                              width: "100%",
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #D1D5DB",
                              borderRadius: "8px",
                              px: 1.5,
                              py: 0.75,
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#374151",
                              outline: "none",
                              cursor: "pointer",
                            }}
                          >
                            <option value="1 time per month">Max 1 time per month</option>
                            <option value="2 times per month">Max 2 times per month (Default)</option>
                            <option value="5 times per month">Max 5 times per month</option>
                            <option value="Unlimited">Unlimited</option>
                          </Box>
                        </Box>
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* CARD 3: Payment Methods & Billing Information */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
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
                      <IconCreditCard size={20} stroke={2} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
                        Payment Methods & Billing Contact
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                        Manage authorized payment cards, billing address, and tax deduction IDs.
                      </Typography>
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                      gap: 2.5,
                    }}
                  >
                    {/* Left: Saved Payment Cards */}
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: "12px",
                        border: "1px solid #E5E7EB",
                        backgroundColor: "#FFFFFF",
                        display: "flex",
                        flexDirection: "column",
                        gap: 1.5,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#101828" }}>
                          Saved Payment Cards
                        </Typography>
                        <Button
                          size="small"
                          onClick={() => setIsAddPaymentOpen(true)}
                          startIcon={<IconPlus size={14} />}
                          sx={{ textTransform: "none", fontWeight: 600, fontSize: 12, color: "#4F46E5" }}
                        >
                          + Add Card
                        </Button>
                      </Box>

                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        {paymentMethodsList.map((pm) => (
                          <Box
                            key={pm.id}
                            sx={{
                              p: 1.5,
                              borderRadius: "10px",
                              border: pm.isDefault ? "1.5px solid #C7D7FE" : "1px solid #EAECF0",
                              backgroundColor: pm.isDefault ? "#F8FAFC" : "#FFFFFF",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 1.5,
                            }}
                          >
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                              <Box
                                sx={{
                                  px: 1,
                                  py: 0.4,
                                  borderRadius: "6px",
                                  backgroundColor: pm.brand === "visa" ? "#1E40AF" : "#DC2626",
                                  color: "#FFFFFF",
                                  fontSize: 10,
                                  fontWeight: 800,
                                  letterSpacing: "0.05em",
                                  textTransform: "uppercase",
                                }}
                              >
                                {pm.brand}
                              </Box>
                              <Box>
                                <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#101828" }}>
                                  •••• •••• •••• {pm.last4}
                                </Typography>
                                <Typography sx={{ fontSize: 11.5, color: "#667085" }}>
                                  Expires {pm.expMonth}/{pm.expYear.slice(-2)} • {pm.holderName}
                                </Typography>
                              </Box>
                            </Box>

                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              {pm.isDefault ? (
                                <Chip
                                  size="small"
                                  label="Default"
                                  sx={{
                                    height: 20,
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    backgroundColor: "#EEF2FF",
                                    color: "#4F46E5",
                                    border: "1px solid #C7D7FE",
                                  }}
                                />
                              ) : (
                                <Button
                                  size="small"
                                  onClick={() => handleSetDefaultPayment(pm.id)}
                                  sx={{ textTransform: "none", fontSize: 11.5, color: "#475467", fontWeight: 600 }}
                                >
                                  Make Default
                                </Button>
                              )}
                              {!pm.isDefault && (
                                <Button
                                  size="small"
                                  onClick={() => handleRemovePaymentMethod(pm.id)}
                                  sx={{ textTransform: "none", fontSize: 11.5, color: "#DC2626", minWidth: 0, p: 0.5 }}
                                >
                                  Remove
                                </Button>
                              )}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>

                    {/* Right: Billing Address & Tax ID */}
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: "12px",
                        border: "1px solid #E5E7EB",
                        backgroundColor: "#FFFFFF",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: 1.5,
                      }}
                    >
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#101828" }}>
                            Billing Entity & Tax ID
                          </Typography>
                          <Button
                            size="small"
                            onClick={() => {
                              setTempCompanyName(companyLegalName);
                              setTempBillingEmail(invoiceEmail);
                              setTempTaxId(taxIdNumber);
                              setTempAddress(companyBillingAddress);
                              setIsEditBillingInfoOpen(true);
                            }}
                            startIcon={<IconPencil size={13} />}
                            sx={{ textTransform: "none", fontWeight: 600, fontSize: 12, color: "#4F46E5" }}
                          >
                            Edit
                          </Button>
                        </Box>

                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <Box>
                            <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#667085", textTransform: "uppercase" }}>
                              Legal Entity Name
                            </Typography>
                            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#101828" }}>
                              {companyLegalName}
                            </Typography>
                          </Box>

                          <Box>
                            <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#667085", textTransform: "uppercase" }}>
                              Invoice Email Recipient
                            </Typography>
                            <Typography sx={{ fontSize: 13, color: "#374151" }}>
                              {invoiceEmail}
                            </Typography>
                          </Box>

                          <Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                              <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#667085", textTransform: "uppercase" }}>
                                Tax ID / GSTIN
                              </Typography>
                              <Chip
                                size="small"
                                label="Verified"
                                sx={{
                                  height: 16,
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  backgroundColor: "#ECFDF5",
                                  color: "#059669",
                                }}
                              />
                            </Box>
                            <Typography sx={{ fontSize: 13, fontFamily: "monospace", color: "#101828" }}>
                              {taxIdNumber}
                            </Typography>
                          </Box>

                          <Box>
                            <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#667085", textTransform: "uppercase" }}>
                              Registered Billing Address
                            </Typography>
                            <Typography sx={{ fontSize: 12.5, color: "#475467" }}>
                              {companyBillingAddress}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                </Box>

                {/* CARD 4: Billing Preferences & Cost Controls */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "10px",
                        backgroundColor: "#FDF2F8",
                        color: "#DB2777",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <IconReceipt2 size={20} stroke={2} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
                        Billing Preferences & Cost Controls
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                        Configure invoice receipt delivery, budget threshold alerts, and purchase orders.
                      </Typography>
                    </Box>
                  </Box>

                  {/* Row 1: Invoice Email */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 1.75,
                      borderBottom: "1px solid #F1F5F9",
                      gap: 2,
                      flexWrap: { xs: "wrap", sm: "nowrap" },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
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
                          mt: 0.25,
                        }}
                      >
                        <IconMail size={18} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                          Invoice delivery email
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Send automated PDF tax invoices and receipts to your accounting inbox.
                        </Typography>
                      </Box>
                    </Box>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: "#4F46E5" }}>
                      {invoiceEmail}
                    </Typography>
                  </Box>

                  {/* Row 2: Budget Alert */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 1.75,
                      borderBottom: "1px solid #F1F5F9",
                      gap: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          backgroundColor: "#FEF3C7",
                          color: "#D97706",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        <IconAlertTriangle size={18} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                          Monthly budget & usage alert
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Receive immediate notification emails when your workspace consumes 85% of monthly credit allowance.
                        </Typography>
                      </Box>
                    </Box>
                    <UntitledSwitch
                      checked={budgetAlertEnabled}
                      onChange={(e) => {
                        setBudgetAlertEnabled(e.target.checked);
                        toast.success(
                          e.target.checked
                            ? "Budget threshold alerts enabled"
                            : "Budget threshold alerts disabled"
                        );
                      }}
                      slotProps={{ input: { "aria-label": "Budget alerts" } }}
                    />
                  </Box>

                  {/* Row 2b: Smart Hard-Cap Monthly Spend Ceiling */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 1.75,
                      borderBottom: "1px solid #F1F5F9",
                      gap: 2,
                      flexWrap: { xs: "wrap", sm: "nowrap" },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          backgroundColor: "#FEF2F2",
                          color: "#DC2626",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        <IconShield size={18} />
                      </Box>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                            Hard-Cap Monthly Spend Ceiling Guardrail
                          </Typography>
                          <Chip
                            size="small"
                            label={smartSpendCapEnabled ? `Active • Max $${smartSpendCapAmount}/mo` : "Disabled"}
                            sx={{
                              height: 20,
                              fontSize: 10.5,
                              fontWeight: 700,
                              backgroundColor: smartSpendCapEnabled ? "#ECFDF5" : "#F3F4F6",
                              color: smartSpendCapEnabled ? "#059669" : "#6B7280",
                              border: smartSpendCapEnabled ? "1px solid #A7F3D0" : "1px solid #E5E7EB",
                            }}
                          />
                        </Box>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Hard-stops all billable auto top-ups if monthly invoice total exceeds this cap, protecting against unexpected surges.
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      {smartSpendCapEnabled && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>$</Typography>
                          <Box
                            component="input"
                            type="number"
                            value={smartSpendCapAmount}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSmartSpendCapAmount(Math.max(20, Number(e.target.value) || 150))}
                            sx={{
                              width: 64,
                              py: 0.5,
                              px: 1,
                              borderRadius: "8px",
                              border: "1px solid #D1D5DB",
                              fontSize: 13,
                              fontWeight: 700,
                              textAlign: "center",
                              outline: "none",
                            }}
                          />
                        </Box>
                      )}
                      <UntitledSwitch
                        checked={smartSpendCapEnabled}
                        onChange={(e) => {
                          setSmartSpendCapEnabled(e.target.checked);
                          toast.success(
                            e.target.checked
                              ? `Hard spend cap set to $${smartSpendCapAmount}/month`
                              : "Monthly hard spend cap disabled"
                          );
                        }}
                        slotProps={{ input: { "aria-label": "Hard-Cap Spend Limit" } }}
                      />
                    </Box>
                  </Box>

                  {/* Row 3: Billing Currency */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 1.75,
                      borderBottom: "1px solid #F1F5F9",
                      gap: 2,
                      flexWrap: { xs: "wrap", sm: "nowrap" },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          backgroundColor: "#ECFDF5",
                          color: "#059669",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        <IconCoins size={18} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                          Billing currency display
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Default currency for invoices, resource meters, and credit packs.
                        </Typography>
                      </Box>
                    </Box>
                    <Box
                      component="select"
                      value={billingCurrency}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        setBillingCurrency(e.target.value);
                        toast.success(`Currency set to ${e.target.value}`);
                      }}
                      sx={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #D1D5DB",
                        borderRadius: "8px",
                        px: 1.75,
                        py: 0.75,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#374151",
                        cursor: "pointer",
                        outline: "none",
                        minWidth: 140,
                      }}
                    >
                      <option value="USD ($)">USD ($)</option>
                      <option value="INR (₹)">INR (₹)</option>
                      <option value="EUR (€)">EUR (€)</option>
                      <option value="GBP (£)">GBP (£)</option>
                    </Box>
                  </Box>

                  {/* Row 4: Purchase Order Number */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 1.75,
                      gap: 2,
                      flexWrap: { xs: "wrap", sm: "nowrap" },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          backgroundColor: "#EFF6FF",
                          color: "#2563EB",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        <IconFileInvoice size={18} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                          Purchase Order (PO) Number
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Appears on all generated invoices for corporate accounting reconciliation.
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <TextField
                        size="small"
                        value={poNumber}
                        onChange={(e) => setPoNumber(e.target.value)}
                        placeholder="PO-XXXX"
                        sx={{
                          width: 170,
                          "& .MuiOutlinedInput-root": {
                            borderRadius: "8px",
                            fontSize: 13,
                            backgroundColor: "#FFFFFF",
                          },
                        }}
                      />
                      <Button
                        size="small"
                        onClick={() => toast.success(`PO Number saved as ${poNumber}`)}
                        sx={{ textTransform: "none", fontWeight: 600, color: "#4F46E5" }}
                      >
                        Save
                      </Button>
                    </Box>
                  </Box>
                </Box>

                {/* CARD 5: Invoices & Payment History */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5, flexWrap: "wrap", gap: 1.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          backgroundColor: "#ECFDF5",
                          color: "#059669",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <IconFileInvoice size={20} stroke={2} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
                          Invoices & Payment History
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Download tax-compliant PDF invoices and view historical payment transactions.
                        </Typography>
                      </Box>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleExportAllInvoices}
                      startIcon={<IconDownload size={15} />}
                      sx={{
                        textTransform: "none",
                        fontWeight: 600,
                        fontSize: 12.5,
                        color: "#344054",
                        borderColor: "#D0D5DD",
                        borderRadius: "8px",
                        px: 1.75,
                        "&:hover": {
                          borderColor: "#4F46E5",
                          backgroundColor: "#F8FAFC",
                          color: "#4F46E5",
                        },
                      }}
                    >
                      Export All (.CSV)
                    </Button>
                  </Box>

                  {/* Invoice Rows */}
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {invoicesList.map((inv) => (
                      <Box
                        key={inv.id}
                        sx={{
                          display: "flex",
                          alignItems: { xs: "flex-start", sm: "center" },
                          justifyContent: "space-between",
                          py: 1.5,
                          px: 2,
                          borderRadius: "10px",
                          border: "1px solid #F1F5F9",
                          backgroundColor: "#FAFAFA",
                          gap: 1.5,
                          flexWrap: { xs: "wrap", sm: "nowrap" },
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: "8px",
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #E5E7EB",
                              color: "#475467",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <IconFileInvoice size={16} />
                          </Box>
                          <Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: "#101828" }}>
                                {inv.invoiceNumber}
                              </Typography>
                              <Chip
                                size="small"
                                label={inv.status}
                                sx={{
                                  height: 18,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  backgroundColor: inv.statusBg,
                                  color: inv.statusColor,
                                }}
                              />
                            </Box>
                            <Typography sx={{ fontSize: 12, color: "#667085", mt: 0.25 }}>
                              {inv.date} • {inv.description}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, ml: { xs: 2.5, sm: "auto" } }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#101828", whiteSpace: "nowrap" }}>
                            {inv.amount}
                          </Typography>
                          <Button
                            size="small"
                            onClick={() => setSelectedInvoiceForPreview(inv)}
                            startIcon={<IconEye size={14} />}
                            sx={{
                              textTransform: "none",
                              fontWeight: 600,
                              fontSize: 12,
                              color: "#344054",
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #D1D5DB",
                              borderRadius: "6px",
                              px: 1.25,
                              py: 0.4,
                              "&:hover": {
                                borderColor: "#4F46E5",
                                backgroundColor: "#EEF2FF",
                                color: "#4F46E5",
                              },
                            }}
                          >
                            Preview
                          </Button>
                          <Button
                            size="small"
                            onClick={() => handleDownloadInvoice(inv)}
                            startIcon={<IconDownload size={14} />}
                            sx={{
                              textTransform: "none",
                              fontWeight: 600,
                              fontSize: 12,
                              color: "#4F46E5",
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #D1D5DB",
                              borderRadius: "6px",
                              px: 1.25,
                              py: 0.4,
                              "&:hover": {
                                borderColor: "#4F46E5",
                                backgroundColor: "#EEF2FF",
                              },
                            }}
                          >
                            PDF
                          </Button>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            )}

            {/* TAB: Security */}
            {activeTab === "security" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {/* Section Header */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: { xs: "flex-start", sm: "center" },
                    justifyContent: "space-between",
                    gap: 2,
                    flexWrap: "wrap",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.75 }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: "12px",
                        background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
                        color: "#4F46E5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid rgba(99, 102, 241, 0.15)",
                        boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                      }}
                    >
                      <IconLock size={24} stroke={2.2} />
                    </Box>
                    <Box>
                      <Typography
                        sx={{
                          fontSize: { xs: 20, sm: 22 },
                          fontWeight: 700,
                          color: "#101828",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        Security & Credentials
                      </Typography>
                      <Typography sx={{ fontSize: 13.5, color: "#667085", mt: 0.25 }}>
                        Manage password security, multi-factor authentication, active devices, and workspace guardrails.
                      </Typography>
                    </Box>
                  </Box>

                  {/* Security Health Score Card */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      px: 2,
                      py: 1.25,
                      borderRadius: "12px",
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E5E7EB",
                      boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                    }}
                  >
                    <Box
                      sx={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        backgroundColor: "#10B981",
                        boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.2)",
                      }}
                    />
                    <Box>
                      <Typography
                        sx={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: "#667085",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          lineHeight: 1,
                        }}
                      >
                        Protection Level
                      </Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#101828", mt: 0.35, lineHeight: 1.2 }}>
                        94% Optimal • 2FA Enforced
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* CARD 1: Password & Authentication Methods */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
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
                      }}
                    >
                      <IconKey size={20} stroke={2} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
                        Password & Authentication
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                        Manage password hygiene, biometric passkeys, and two-factor authentication.
                      </Typography>
                    </Box>
                  </Box>

                  {/* Row 1: Account Password */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 2,
                      borderBottom: "1px solid #F1F5F9",
                      gap: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
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
                          mt: 0.25,
                        }}
                      >
                        <IconKey size={18} />
                      </Box>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                            Account password
                          </Typography>
                          <Chip
                            size="small"
                            label="Strong (16 chars)"
                            sx={{
                              height: 20,
                              fontSize: 11,
                              fontWeight: 700,
                              backgroundColor: "#ECFDF5",
                              color: "#059669",
                              border: "1px solid #A7F3D0",
                            }}
                          />
                        </Box>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Password last rotated 28 days ago. We recommend updating passwords periodically.
                        </Typography>
                      </Box>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setIsChangePasswordOpen(true)}
                      sx={{
                        textTransform: "none",
                        fontWeight: 600,
                        fontSize: 13,
                        color: "#344054",
                        borderColor: "#D0D5DD",
                        borderRadius: "8px",
                        px: 2,
                        py: 0.75,
                        flexShrink: 0,
                        "&:hover": {
                          borderColor: "#4F46E5",
                          backgroundColor: "#F8FAFC",
                          color: "#4F46E5",
                        },
                      }}
                    >
                      Change Password
                    </Button>
                  </Box>

                  {/* Row 2: Two-Factor Authentication */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 2,
                      borderBottom: "1px solid #F1F5F9",
                      gap: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          backgroundColor: "#ECFDF5",
                          color: "#059669",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        <IconShieldCheck size={18} />
                      </Box>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                            Two-factor authentication (TOTP)
                          </Typography>
                          <Chip
                            size="small"
                            label={twoFactorAuth ? "Enforced" : "Disabled"}
                            sx={{
                              height: 20,
                              fontSize: 11,
                              fontWeight: 700,
                              backgroundColor: twoFactorAuth ? "#ECFDF5" : "#F3F4F6",
                              color: twoFactorAuth ? "#059669" : "#6B7280",
                              border: twoFactorAuth ? "1px solid #A7F3D0" : "1px solid #E5E7EB",
                            }}
                          />
                        </Box>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Protect your account by requiring an authenticator code (Google Authenticator, Authy, or 1Password) on sign-in.
                        </Typography>
                      </Box>
                    </Box>
                    <UntitledSwitch
                      checked={twoFactorAuth}
                      onChange={(e) => {
                        setTwoFactorAuth(e.target.checked);
                        toast.success(
                          e.target.checked
                            ? "Two-factor authentication enabled"
                            : "Two-factor authentication disabled"
                        );
                      }}
                      slotProps={{ input: { "aria-label": "Two-factor authentication" } }}
                    />
                  </Box>

                  {/* Row 3: Biometric Passkeys */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 2,
                      gap: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          backgroundColor: "#F3E8FF",
                          color: "#7E22CE",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        <IconFingerprint size={18} />
                      </Box>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                            Biometric passkeys & Windows Hello
                          </Typography>
                          <Chip
                            size="small"
                            label={passkeysEnabled ? "Enabled" : "Off"}
                            sx={{
                              height: 20,
                              fontSize: 11,
                              fontWeight: 700,
                              backgroundColor: passkeysEnabled ? "#F3E8FF" : "#F3F4F6",
                              color: passkeysEnabled ? "#7E22CE" : "#6B7280",
                              border: passkeysEnabled ? "1px solid #E9D5FF" : "1px solid #E5E7EB",
                            }}
                          />
                        </Box>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Sign in seamlessly using fingerprint, facial recognition, or hardware FIDO2 security keys without passwords.
                        </Typography>
                      </Box>
                    </Box>
                    <UntitledSwitch
                      checked={passkeysEnabled}
                      onChange={(e) => {
                        setPasskeysEnabled(e.target.checked);
                        toast.success(
                          e.target.checked
                            ? "Biometric passkey sign-in enabled"
                            : "Biometric passkey sign-in disabled"
                        );
                      }}
                      slotProps={{ input: { "aria-label": "Passkeys & Biometrics" } }}
                    />
                  </Box>
                </Box>

                {/* CARD 2: Active Sessions & Connected Devices */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5, flexWrap: "wrap", gap: 1.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          backgroundColor: "#EFF6FF",
                          color: "#2563EB",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <IconDeviceDesktop size={20} stroke={2} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
                          Active Sessions & Connected Devices
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Devices and browsers currently authorized to access your ProxiPilot workspace.
                        </Typography>
                      </Box>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleRevokeAllOtherSessions}
                      startIcon={<IconLogout size={16} />}
                      sx={{
                        textTransform: "none",
                        fontWeight: 600,
                        fontSize: 12.5,
                        color: "#DC2626",
                        borderColor: "#FECACA",
                        borderRadius: "8px",
                        px: 1.75,
                        "&:hover": {
                          borderColor: "#DC2626",
                          backgroundColor: "#FEF2F2",
                        },
                      }}
                    >
                      Sign out all other sessions
                    </Button>
                  </Box>

                  {/* Sessions List */}
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                    {INITIAL_SESSIONS.filter((s) => !revokedSessionIds.includes(s.id)).map((sess) => {
                      const IconComp = sess.icon;
                      return (
                        <Box
                          key={sess.id}
                          sx={{
                            display: "flex",
                            alignItems: { xs: "flex-start", sm: "center" },
                            justifyContent: "space-between",
                            p: 2,
                            borderRadius: "12px",
                            border: sess.isCurrent ? "1.5px solid #A7F3D0" : "1px solid #E5E7EB",
                            backgroundColor: sess.isCurrent ? "#F0FDF4" : "#FFFFFF",
                            gap: 2,
                            flexWrap: { xs: "wrap", sm: "nowrap" },
                            transition: "all 0.15s ease",
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            <Box
                              sx={{
                                width: 38,
                                height: 38,
                                borderRadius: "10px",
                                backgroundColor: sess.isCurrent ? "#DCFCE7" : "#F3F4F6",
                                color: sess.isCurrent ? "#16A34A" : "#64748B",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <IconComp size={20} stroke={2} />
                            </Box>
                            <Box>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#101828" }}>
                                  {sess.device}
                                </Typography>
                                {sess.isCurrent && (
                                  <Chip
                                    size="small"
                                    icon={<Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#16A34A", ml: 0.5 }} />}
                                    label="This device"
                                    sx={{
                                      height: 20,
                                      fontSize: 11,
                                      fontWeight: 700,
                                      backgroundColor: "#DCFCE7",
                                      color: "#16A34A",
                                      border: "1px solid #86EFAC",
                                    }}
                                  />
                                )}
                              </Box>
                              <Typography sx={{ fontSize: 12.5, color: "#667085", mt: 0.25 }}>
                                {sess.ip} • {sess.location} • <span style={{ fontWeight: 600 }}>{sess.lastActive}</span>
                              </Typography>
                            </Box>
                          </Box>

                          {!sess.isCurrent && (
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => handleRevokeSession(sess.id, sess.device)}
                              sx={{
                                textTransform: "none",
                                fontWeight: 600,
                                fontSize: 12,
                                color: "#B42318",
                                borderColor: "#FECDCA",
                                borderRadius: "8px",
                                px: 1.5,
                                flexShrink: 0,
                                "&:hover": {
                                  borderColor: "#D92D20",
                                  backgroundColor: "#FEF3F2",
                                },
                              }}
                            >
                              Revoke
                            </Button>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>

                {/* CARD 3: Workspace Access Guardrails */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "10px",
                        backgroundColor: "#FFF7ED",
                        color: "#EA580C",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <IconShield size={20} stroke={2} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
                        Workspace Access Guardrails
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                        Enforce organizational session lifetime, network restrictions, and security hygiene.
                      </Typography>
                    </Box>
                  </Box>

                  {/* Row 1: Session Timeout */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 2,
                      borderBottom: "1px solid #F1F5F9",
                      gap: 2,
                      flexWrap: { xs: "wrap", sm: "nowrap" },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          backgroundColor: "#FEF3C7",
                          color: "#D97706",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        <IconClock size={18} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                          Automatic idle session timeout
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Automatically sign out inactive sessions after a prolonged period of workspace inactivity.
                        </Typography>
                      </Box>
                    </Box>
                    <Box
                      component="select"
                      value={sessionTimeout}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        setSessionTimeout(e.target.value);
                        toast.success(`Session timeout set to ${e.target.value}`);
                      }}
                      sx={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #D1D5DB",
                        borderRadius: "10px",
                        px: 2,
                        py: 1,
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: "#374151",
                        cursor: "pointer",
                        outline: "none",
                        minWidth: 160,
                        "&:focus": {
                          borderColor: "#4F46E5",
                          boxShadow: "0 0 0 3px rgba(79, 70, 229, 0.15)",
                        },
                      }}
                    >
                      <option value="15 minutes">15 minutes</option>
                      <option value="30 minutes">30 minutes</option>
                      <option value="1 hour">1 hour</option>
                      <option value="4 hours">4 hours</option>
                      <option value="12 hours">12 hours</option>
                      <option value="24 hours">24 hours (Default)</option>
                    </Box>
                  </Box>

                  {/* Row 2: IP Whitelist */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 2,
                      borderBottom: "1px solid #F1F5F9",
                      gap: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          backgroundColor: "#EFF6FF",
                          color: "#2563EB",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        <IconWorld size={18} />
                      </Box>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                            Authorized IP restriction & network fencing
                          </Typography>
                          <Chip
                            size="small"
                            label={ipWhitelistEnabled ? "Enforced" : "Disabled"}
                            sx={{
                              height: 20,
                              fontSize: 11,
                              fontWeight: 700,
                              backgroundColor: ipWhitelistEnabled ? "#EFF6FF" : "#F3F4F6",
                              color: ipWhitelistEnabled ? "#2563EB" : "#6B7280",
                              border: ipWhitelistEnabled ? "1px solid #BFDBFE" : "1px solid #E5E7EB",
                            }}
                          />
                        </Box>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Restrict workspace access and AI execution exclusively to corporate VPNs and approved office IP addresses.
                        </Typography>
                      </Box>
                    </Box>
                    <UntitledSwitch
                      checked={ipWhitelistEnabled}
                      onChange={(e) => {
                        setIpWhitelistEnabled(e.target.checked);
                        toast.success(
                          e.target.checked
                            ? "IP restriction enabled for workspace"
                            : "IP restriction disabled"
                        );
                      }}
                      slotProps={{ input: { "aria-label": "Authorized IP restriction" } }}
                    />
                  </Box>

                  {/* Row 3: Single Sign-On */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 2,
                      borderBottom: "1px solid #F1F5F9",
                      gap: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          backgroundColor: "#F0FDF4",
                          color: "#16A34A",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        <IconBuildingCommunity size={18} />
                      </Box>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                            Single Sign-On (SSO / SAML 2.0)
                          </Typography>
                          <Chip
                            size="small"
                            label="Enterprise"
                            sx={{
                              height: 20,
                              fontSize: 11,
                              fontWeight: 700,
                              backgroundColor: "#F0FDF4",
                              color: "#16A34A",
                              border: "1px solid #BBF7D0",
                            }}
                          />
                        </Box>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Enforce identity authentication through Okta, Google Workspace, or Microsoft Entra ID (Azure AD).
                        </Typography>
                      </Box>
                    </Box>
                    <UntitledSwitch
                      checked={ssoEnforced}
                      onChange={(e) => {
                        setSsoEnforced(e.target.checked);
                        toast.success(
                          e.target.checked
                            ? "SSO SAML 2.0 enforcement active"
                            : "SSO enforcement disabled"
                        );
                      }}
                      slotProps={{ input: { "aria-label": "SSO Enforcement" } }}
                    />
                  </Box>

                  {/* Row 4: Suspicious Activity Alerts */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 2,
                      gap: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          backgroundColor: "#FEE2E2",
                          color: "#DC2626",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        <IconAlertTriangle size={18} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                          New sign-in & suspicious activity alerts
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Receive immediate notification emails when account sign-in is detected from a new location or unrecognized device.
                        </Typography>
                      </Box>
                    </Box>
                    <UntitledSwitch
                      checked={suspiciousAlerts}
                      onChange={(e) => {
                        setSuspiciousAlerts(e.target.checked);
                        toast.success(
                          e.target.checked
                            ? "Suspicious activity notifications enabled"
                            : "Suspicious activity notifications muted"
                        );
                      }}
                      slotProps={{ input: { "aria-label": "Suspicious Activity Alerts" } }}
                    />
                  </Box>
                </Box>

                {/* CARD 4: Security Audit & Sign-in Activity */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5, flexWrap: "wrap", gap: 1.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          backgroundColor: "#FDF2F8",
                          color: "#DB2777",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <IconHistory size={20} stroke={2} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
                          Security Audit & Sign-in Activity
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Immutable audit log of recent authentications, credential changes, and security events.
                        </Typography>
                      </Box>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleExportAuditLogs}
                      startIcon={<IconDownload size={16} />}
                      sx={{
                        textTransform: "none",
                        fontWeight: 600,
                        fontSize: 12.5,
                        color: "#344054",
                        borderColor: "#D0D5DD",
                        borderRadius: "8px",
                        px: 1.75,
                        "&:hover": {
                          borderColor: "#4F46E5",
                          backgroundColor: "#F8FAFC",
                          color: "#4F46E5",
                        },
                      }}
                    >
                      Export Audit Log (.CSV)
                    </Button>
                  </Box>

                  {/* Audit Events List */}
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {AUDIT_EVENTS.map((evt) => (
                      <Box
                        key={evt.id}
                        sx={{
                          display: "flex",
                          alignItems: { xs: "flex-start", sm: "center" },
                          justifyContent: "space-between",
                          py: 1.5,
                          px: 2,
                          borderRadius: "10px",
                          border: "1px solid #F1F5F9",
                          backgroundColor: "#FAFAFA",
                          gap: 1.5,
                          flexWrap: { xs: "wrap", sm: "nowrap" },
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              backgroundColor: evt.statusColor,
                              flexShrink: 0,
                            }}
                          />
                          <Box>
                            <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: "#101828" }}>
                              {evt.event}
                            </Typography>
                            <Typography sx={{ fontSize: 12, color: "#667085", mt: 0.25 }}>
                              {evt.detail} • <span style={{ color: "#475467" }}>{evt.client}</span> ({evt.location})
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, ml: { xs: 2.5, sm: "auto" } }}>
                          <Typography sx={{ fontSize: 12, color: "#667085", fontWeight: 500, whiteSpace: "nowrap" }}>
                            {evt.timestamp}
                          </Typography>
                          <Chip
                            size="small"
                            label={evt.status}
                            sx={{
                              height: 20,
                              fontSize: 11,
                              fontWeight: 700,
                              backgroundColor: evt.statusBg,
                              color: evt.statusColor,
                            }}
                          />
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            )}

            {/* TAB: Data & Privacy Governance */}
            {activeTab === "data-privacy" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {/* Title Section with Live SOC2 / GDPR Status Card */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: { xs: "flex-start", sm: "center" },
                    justifyContent: "space-between",
                    gap: 2,
                    flexWrap: "wrap",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.75 }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: "12px",
                        background: "linear-gradient(135deg, #0F766E 0%, #0D9488 100%)",
                        color: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid rgba(13, 148, 136, 0.2)",
                        boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                      }}
                    >
                      <IconShieldCheck size={24} stroke={2.2} />
                    </Box>
                    <Box>
                      <Typography
                        sx={{
                          fontSize: { xs: 20, sm: 22 },
                          fontWeight: 700,
                          color: "#101828",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        Data & Privacy Governance
                      </Typography>
                      <Typography sx={{ fontSize: 13.5, color: "#667085", mt: 0.25 }}>
                        Enterprise data isolation, zero AI foundation model training guarantees, retention schedules, and GDPR / CCPA portability.
                      </Typography>
                    </Box>
                  </Box>

                  {/* Live Compliance Status Card */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      px: 2,
                      py: 1.25,
                      borderRadius: "12px",
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E5E7EB",
                      boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                    }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "10px",
                        background: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
                        color: "#059669",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        border: "1px solid #A7F3D0",
                      }}
                    >
                      <IconLock size={18} stroke={2.2} />
                    </Box>
                    <Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography
                          sx={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: "#667085",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            lineHeight: 1,
                          }}
                        >
                          SOC2 Type II & GDPR Active
                        </Typography>
                        <Box
                          sx={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            backgroundColor: "#10B981",
                            boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.2)",
                          }}
                        />
                      </Box>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "#101828", mt: 0.35, lineHeight: 1.2 }}>
                        AES-256 At-Rest • Zero AI Model Training
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* CARD 1: AI Model Privacy & Zero Foundation Model Training Safeguards */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "10px",
                        backgroundColor: "#ECFDF5",
                        color: "#0D9488",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IconBrain size={20} stroke={2} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
                        AI Privacy & Foundation Model Safeguards
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                        Strict non-retention agreements guaranteeing your customer threads, emails, and business data are never exposed or trained upon.
                      </Typography>
                    </Box>
                  </Box>

                  {/* Row 1: Zero Foundation Model Training Guarantee */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 2,
                      borderBottom: "1px solid #F1F5F9",
                      gap: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          backgroundColor: "#F0FDF4",
                          color: "#16A34A",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        <IconShieldCheck size={18} />
                      </Box>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                            Zero Foundation Model Training Guarantee
                          </Typography>
                          <Chip
                            size="small"
                            label="✓ Contractually Enforced"
                            sx={{
                              height: 20,
                              fontSize: 10.5,
                              fontWeight: 700,
                              backgroundColor: "#ECFDF5",
                              color: "#059669",
                              border: "1px solid #A7F3D0",
                            }}
                          />
                        </Box>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Customer communications, prompt inputs, and AI memory facts are strictly processed through isolated enterprise API endpoints. They are never used to train OpenAI, Anthropic, or ProxiPilot public foundation models.
                        </Typography>
                      </Box>
                    </Box>
                    <Chip
                      label="Enforced by DPA"
                      size="small"
                      sx={{
                        backgroundColor: "#F8FAFC",
                        color: "#475467",
                        fontWeight: 600,
                        fontSize: 11,
                        border: "1px solid #E2E8F0",
                        flexShrink: 0,
                      }}
                    />
                  </Box>

                  {/* Row 2: Pre-inference PII Masking */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 2,
                      borderBottom: "1px solid #F1F5F9",
                      gap: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
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
                          mt: 0.25,
                        }}
                      >
                        <IconFingerprint size={18} />
                      </Box>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                            Pre-inference PII Masking & Data Sanitization
                          </Typography>
                          <Chip
                            size="small"
                            label={piiMaskingEnabled ? "Active" : "Disabled"}
                            sx={{
                              height: 20,
                              fontSize: 10.5,
                              fontWeight: 700,
                              backgroundColor: piiMaskingEnabled ? "#EEF2FF" : "#F3F4F6",
                              color: piiMaskingEnabled ? "#4F46E5" : "#6B7280",
                              border: piiMaskingEnabled ? "1px solid #C7D7FE" : "1px solid #E5E7EB",
                            }}
                          />
                        </Box>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Automatically redacts credit card numbers, national identification numbers (SSN/Aadhaar), bank IBANs, and private phone numbers before prompt transmission to AI inference models.
                        </Typography>
                      </Box>
                    </Box>
                    <UntitledSwitch
                      checked={piiMaskingEnabled}
                      onChange={(e) => {
                        setPiiMaskingEnabled(e.target.checked);
                        toast.success(
                          e.target.checked
                            ? "Pre-inference PII masking enabled"
                            : "Pre-inference PII masking disabled"
                        );
                      }}
                      slotProps={{ input: { "aria-label": "Pre-inference PII Masking" } }}
                    />
                  </Box>

                  {/* Row 3: Cryptographic Vector Index Isolation */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 2,
                      borderBottom: "1px solid #F1F5F9",
                      gap: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          backgroundColor: "#F3E8FF",
                          color: "#7E22CE",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        <IconDatabase size={18} />
                      </Box>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                            Cryptographic Vector Index Isolation
                          </Typography>
                          <Chip
                            size="small"
                            label="Dedicated Tenant Partition"
                            sx={{
                              height: 20,
                              fontSize: 10.5,
                              fontWeight: 700,
                              backgroundColor: "#F3E8FF",
                              color: "#7E22CE",
                              border: "1px solid #E9D5FF",
                            }}
                          />
                        </Box>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Knowledge base documents and semantic embeddings for Dolphy India are isolated within your workspace&apos;s private tenant namespace. Cross-tenant retrieval or vector leakage is mathematically impossible.
                        </Typography>
                      </Box>
                    </Box>
                    <Chip
                      label="Isolated Namespace"
                      size="small"
                      sx={{
                        backgroundColor: "#F8FAFC",
                        color: "#475467",
                        fontWeight: 600,
                        fontSize: 11,
                        border: "1px solid #E2E8F0",
                        flexShrink: 0,
                      }}
                    />
                  </Box>

                  {/* Row 4: Break-Glass Support Telemetry Access */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 2,
                      gap: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          backgroundColor: "#FEF3C7",
                          color: "#D97706",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        <IconKey size={18} />
                      </Box>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                            Break-Glass Support Telemetry Access
                          </Typography>
                          <Chip
                            size="small"
                            label={breakGlassAccessEnabled ? "Authorized for 24h" : "Disabled (Default)"}
                            sx={{
                              height: 20,
                              fontSize: 10.5,
                              fontWeight: 700,
                              backgroundColor: breakGlassAccessEnabled ? "#FEF3C7" : "#F3F4F6",
                              color: breakGlassAccessEnabled ? "#B45309" : "#6B7280",
                              border: breakGlassAccessEnabled ? "1px solid #FDE68A" : "1px solid #E5E7EB",
                            }}
                          />
                        </Box>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Require explicit admin consent before ProxiPilot customer engineering can inspect workspace debug logs. All sessions are cryptographically logged and automatically expire after 24 hours.
                        </Typography>
                      </Box>
                    </Box>
                    <UntitledSwitch
                      checked={breakGlassAccessEnabled}
                      onChange={(e) => {
                        setBreakGlassAccessEnabled(e.target.checked);
                        toast.success(
                          e.target.checked
                            ? "Break-glass engineering support access granted (Expires in 24 hours)"
                            : "Support access revoked"
                        );
                      }}
                      slotProps={{ input: { "aria-label": "Break-Glass Support Access" } }}
                    />
                  </Box>
                </Box>

                {/* CARD 2: Data Lifecycle & Automated Retention Schedules */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
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
                      <IconClock size={20} stroke={2} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
                        Data Lifecycle & Automated Retention Schedules
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                        Configure automatic expiration thresholds to delete aged customer correspondence, discarded drafts, and index cache.
                      </Typography>
                    </Box>
                  </Box>

                  {/* Row 1: Email Correspondence Retention */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 1.75,
                      borderBottom: "1px solid #F1F5F9",
                      gap: 2,
                      flexWrap: { xs: "wrap", sm: "nowrap" },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          backgroundColor: "#EFF6FF",
                          color: "#2563EB",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        <IconMail size={18} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                          Customer email correspondence retention
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          How long synchronized customer threads and messages are retained before automated scheduled purge.
                        </Typography>
                      </Box>
                    </Box>
                    <Box
                      component="select"
                      value={retentionCustomerEmails}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        setRetentionCustomerEmails(e.target.value);
                        toast.success(`Correspondence retention set to ${e.target.value}`);
                      }}
                      sx={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #D1D5DB",
                        borderRadius: "8px",
                        px: 1.5,
                        py: 0.75,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#374151",
                        cursor: "pointer",
                        outline: "none",
                        minWidth: 200,
                      }}
                    >
                      <option value="Keep Indefinitely (Default)">Keep Indefinitely (Default)</option>
                      <option value="30 Days (Strict Compliance)">30 Days (Strict Compliance)</option>
                      <option value="60 Days">60 Days</option>
                      <option value="90 Days">90 Days</option>
                      <option value="180 Days">180 Days</option>
                      <option value="1 Year">1 Year</option>
                      <option value="2 Years">2 Years</option>
                    </Box>
                  </Box>

                  {/* Row 2: AI Scratchpads & Discarded Drafts */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 1.75,
                      borderBottom: "1px solid #F1F5F9",
                      gap: 2,
                      flexWrap: { xs: "wrap", sm: "nowrap" },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
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
                          mt: 0.25,
                        }}
                      >
                        <IconBrain size={18} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                          Intermediate AI drafts & reasoning logs
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Retention window for discarded draft iterations, telemetry tokens, and temporary prompt chains.
                        </Typography>
                      </Box>
                    </Box>
                    <Box
                      component="select"
                      value={retentionAiDrafts}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        setRetentionAiDrafts(e.target.value);
                        toast.success(`AI drafts retention set to ${e.target.value}`);
                      }}
                      sx={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #D1D5DB",
                        borderRadius: "8px",
                        px: 1.5,
                        py: 0.75,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#374151",
                        cursor: "pointer",
                        outline: "none",
                        minWidth: 200,
                      }}
                    >
                      <option value="7 Days (Ephemeral)">7 Days (Ephemeral)</option>
                      <option value="14 Days">14 Days</option>
                      <option value="30 Days (Recommended)">30 Days (Recommended)</option>
                      <option value="90 Days">90 Days</option>
                    </Box>
                  </Box>

                  {/* Row 3: Auto-Purge Soft Deleted */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 1.75,
                      borderBottom: "1px solid #F1F5F9",
                      gap: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          backgroundColor: "#FEF2F2",
                          color: "#DC2626",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        <IconTrash size={18} />
                      </Box>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                            Automated purge of soft-deleted threads
                          </Typography>
                          <Chip
                            size="small"
                            label={autoPurgeTrashEnabled ? "30 Days Purge" : "Disabled"}
                            sx={{
                              height: 20,
                              fontSize: 10.5,
                              fontWeight: 700,
                              backgroundColor: autoPurgeTrashEnabled ? "#ECFDF5" : "#F3F4F6",
                              color: autoPurgeTrashEnabled ? "#059669" : "#6B7280",
                              border: autoPurgeTrashEnabled ? "1px solid #A7F3D0" : "1px solid #E5E7EB",
                            }}
                          />
                        </Box>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Permanently delete conversations moved to trash after 30 days without requiring manual intervention.
                        </Typography>
                      </Box>
                    </Box>
                    <UntitledSwitch
                      checked={autoPurgeTrashEnabled}
                      onChange={(e) => {
                        setAutoPurgeTrashEnabled(e.target.checked);
                        toast.success(
                          e.target.checked
                            ? "Automated 30-day trash purge enabled"
                            : "Automated trash purge disabled"
                        );
                      }}
                      slotProps={{ input: { "aria-label": "Auto-purge trash" } }}
                    />
                  </Box>

                  {/* Row 4: Total Deletion Callout */}
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: "12px",
                      backgroundColor: "#FEF2F2",
                      border: "1px solid #FECDCA",
                      display: "flex",
                      alignItems: { xs: "flex-start", sm: "center" },
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 1.5,
                      mt: 0.5,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                      <IconAlertTriangle size={20} color="#DC2626" />
                      <Box>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: "#991B1B" }}>
                          Immediate Permanent Erasure & Account Reset
                        </Typography>
                        <Typography sx={{ fontSize: 12.5, color: "#B91C1C", mt: 0.25 }}>
                          Need to wipe knowledge base vector indexes, conversation history, or delete entire workspace?
                        </Typography>
                      </Box>
                    </Box>
                    <Button
                      onClick={() => handleSelectTab("delete")}
                      sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        fontSize: 12.5,
                        backgroundColor: "#DC2626",
                        color: "#FFFFFF",
                        borderRadius: "8px",
                        px: 2,
                        py: 0.6,
                        "&:hover": { backgroundColor: "#B91C1C" },
                      }}
                    >
                      Delete Data Center →
                    </Button>
                  </Box>
                </Box>

                {/* CARD 3: Data Portability & GDPR / CCPA Compliance Exports */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "10px",
                        backgroundColor: "#EFF6FF",
                        color: "#2563EB",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IconDownload size={20} stroke={2} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
                        Data Portability & DSR Compliance Exports
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                        Self-service data takeout to fulfill GDPR Article 20, CCPA, and compliance audit requests.
                      </Typography>
                    </Box>
                  </Box>

                  {/* Export Row 1: Personal Data Takeout */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: { xs: "flex-start", sm: "center" },
                      justifyContent: "space-between",
                      py: 2,
                      borderBottom: "1px solid #F1F5F9",
                      gap: 2,
                      flexWrap: { xs: "wrap", sm: "nowrap" },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
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
                          mt: 0.25,
                        }}
                      >
                        <IconUser size={18} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                          Personal Account Data Package (DSR Takeout)
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Machine-readable JSON archive containing your user profile, active sessions, security audit events, and activity logs.
                        </Typography>
                      </Box>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleRequestPersonalArchive}
                      startIcon={<IconDownload size={15} />}
                      sx={{
                        textTransform: "none",
                        fontWeight: 600,
                        fontSize: 12.5,
                        color: "#344054",
                        borderColor: "#D0D5DD",
                        borderRadius: "8px",
                        px: 2,
                        py: 0.75,
                        whiteSpace: "nowrap",
                        "&:hover": { borderColor: "#4F46E5", backgroundColor: "#F8FAFC", color: "#4F46E5" },
                      }}
                    >
                      Request Archive
                    </Button>
                  </Box>

                  {/* Export Row 2: Workspace Compliance Package */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: { xs: "flex-start", sm: "center" },
                      justifyContent: "space-between",
                      py: 2,
                      borderBottom: "1px solid #F1F5F9",
                      gap: 2,
                      flexWrap: { xs: "wrap", sm: "nowrap" },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          backgroundColor: "#ECFDF5",
                          color: "#059669",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        <IconStack2 size={18} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                          Full Workspace Data Dump (.json + .csv)
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Comprehensive archive of all synchronized email correspondence, knowledge base documents, AI memory facts, and team logs (~48.2 MB).
                        </Typography>
                      </Box>
                    </Box>
                    <Button
                      variant="contained"
                      size="small"
                      disabled={isGeneratingDataDump}
                      onClick={handleGenerateDataDump}
                      startIcon={<IconDownload size={15} />}
                      sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        fontSize: 12.5,
                        backgroundColor: "#4F46E5",
                        borderRadius: "8px",
                        px: 2,
                        py: 0.75,
                        whiteSpace: "nowrap",
                        boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                        "&:hover": { backgroundColor: "#4338CA" },
                      }}
                    >
                      {isGeneratingDataDump ? "Generating..." : "Generate Dump"}
                    </Button>
                  </Box>

                  {/* Export Row 3: Executed DPA & Authorized Subprocessors */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: { xs: "flex-start", sm: "center" },
                      justifyContent: "space-between",
                      py: 2,
                      gap: 2,
                      flexWrap: { xs: "wrap", sm: "nowrap" },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          backgroundColor: "#F8FAFC",
                          color: "#475467",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          mt: 0.25,
                          border: "1px solid #E2E8F0",
                        }}
                      >
                        <IconFileText size={18} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
                          Executed DPA & Authorized Subprocessors
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Review our signed GDPR Data Processing Addendum, EU Standard Contractual Clauses (SCC), and third-party subprocessors list.
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Button
                        size="small"
                        onClick={() => setIsDpaModalOpen(true)}
                        startIcon={<IconFileText size={14} />}
                        sx={{
                          textTransform: "none",
                          fontWeight: 600,
                          fontSize: 12,
                          color: "#344054",
                          backgroundColor: "#FFFFFF",
                          border: "1px solid #D1D5DB",
                          borderRadius: "8px",
                          px: 1.5,
                          py: 0.6,
                          "&:hover": { borderColor: "#4F46E5", color: "#4F46E5", backgroundColor: "#F8FAFC" },
                        }}
                      >
                        View DPA ↗
                      </Button>
                      <Button
                        size="small"
                        onClick={() => setIsSubprocessorsModalOpen(true)}
                        startIcon={<IconBuildingCommunity size={14} />}
                        sx={{
                          textTransform: "none",
                          fontWeight: 600,
                          fontSize: 12,
                          color: "#4F46E5",
                          backgroundColor: "#EEF2FF",
                          border: "1px solid #C7D7FE",
                          borderRadius: "8px",
                          px: 1.5,
                          py: 0.6,
                          "&:hover": { backgroundColor: "#E0E7FF" },
                        }}
                      >
                        Subprocessors (5) ↗
                      </Button>
                    </Box>
                  </Box>
                </Box>

                {/* CARD 4: Data Residency & Physical Encryption Infrastructure */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "10px",
                        backgroundColor: "#ECFDF5",
                        color: "#059669",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IconWorld size={20} stroke={2} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
                        Data Residency & Cryptographic Key Management
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                        Physical hosting infrastructure, multi-region failover, and hardware envelope encryption.
                      </Typography>
                    </Box>
                  </Box>

                  {/* 3 Infrastructure Cards */}
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                      gap: 2,
                    }}
                  >
                    <Box sx={{ p: 2, borderRadius: "12px", border: "1px solid #E5E7EB", backgroundColor: "#FAFAFA" }}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#667085", textTransform: "uppercase" }}>
                          Primary Datacenter
                        </Typography>
                        <Chip size="small" label="Primary" sx={{ height: 18, fontSize: 10, fontWeight: 700, backgroundColor: "#EEF2FF", color: "#4F46E5" }} />
                      </Box>
                      <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#101828" }}>
                        AWS us-east-1 (N. Virginia)
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: "#667085", mt: 0.5 }}>
                        Tier 4 Datacenter • SOC 1/2/3, ISO 27001, FedRAMP High compliant hosting.
                      </Typography>
                    </Box>

                    <Box sx={{ p: 2, borderRadius: "12px", border: "1px solid #E5E7EB", backgroundColor: "#FAFAFA" }}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#667085", textTransform: "uppercase" }}>
                          Geo-Replication
                        </Typography>
                        <Chip size="small" label="Daily Sync" sx={{ height: 18, fontSize: 10, fontWeight: 700, backgroundColor: "#ECFDF5", color: "#059669" }} />
                      </Box>
                      <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#101828" }}>
                        AWS eu-central-1 (Frankfurt)
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: "#667085", mt: 0.5 }}>
                        Automated 24-hour encrypted cross-region backup snapshots for disaster recovery.
                      </Typography>
                    </Box>

                    <Box sx={{ p: 2, borderRadius: "12px", border: "1px solid #E5E7EB", backgroundColor: "#FAFAFA" }}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#667085", textTransform: "uppercase" }}>
                          Tenant Encryption
                        </Typography>
                        <Chip size="small" label="AES-256 GCM" sx={{ height: 18, fontSize: 10, fontWeight: 700, backgroundColor: "#F3E8FF", color: "#7E22CE" }} />
                      </Box>
                      <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#101828" }}>
                        Hardware HSM (AWS KMS)
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: "#667085", mt: 0.5 }}>
                        Customer-specific key rotation. TLS 1.3 enforced for all browser & API traffic.
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            )}

            {/* TAB: Delete Data & Workspace Reset */}
            {activeTab === "delete" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {/* Title Section with Live Safeguard Status Card */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: { xs: "flex-start", sm: "center" },
                    justifyContent: "space-between",
                    gap: 2,
                    flexWrap: "wrap",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.75 }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: "12px",
                        background: "linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)",
                        color: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid rgba(220, 38, 38, 0.2)",
                        boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                      }}
                    >
                      <IconTrash size={24} stroke={2.2} />
                    </Box>
                    <Box>
                      <Typography
                        sx={{
                          fontSize: { xs: 20, sm: 22 },
                          fontWeight: 700,
                          color: "#101828",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        Delete Data & Workspace Reset
                      </Typography>
                      <Typography sx={{ fontSize: 13.5, color: "#667085", mt: 0.25 }}>
                        Permanent destruction controls for business documents, synchronized conversation records, or total workspace closure.
                      </Typography>
                    </Box>
                  </Box>

                  {/* Live Safeguard Status Card */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      px: 2,
                      py: 1.25,
                      borderRadius: "12px",
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E5E7EB",
                      boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                    }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "10px",
                        background: "linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)",
                        color: "#DC2626",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        border: "1px solid #FECACA",
                      }}
                    >
                      <IconShield size={18} stroke={2.2} />
                    </Box>
                    <Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography
                          sx={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: "#667085",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            lineHeight: 1,
                          }}
                        >
                          Safeguards Armed
                        </Typography>
                        <Box
                          sx={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            backgroundColor: "#DC2626",
                            boxShadow: "0 0 0 2px rgba(220, 38, 38, 0.2)",
                          }}
                        />
                      </Box>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "#101828", mt: 0.35, lineHeight: 1.2 }}>
                        Two-Step Verification • Audit Logged
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* SMART BANNER: Pre-Deletion Safety Snapshot & Quick Backup */}
                <Box
                  sx={{
                    p: 2.5,
                    borderRadius: "14px",
                    border: "1.5px solid #C7D7FE",
                    background: "linear-gradient(180deg, #F0F6FF 0%, #FFFFFF 100%)",
                    display: "flex",
                    alignItems: { xs: "flex-start", md: "center" },
                    justifyContent: "space-between",
                    flexDirection: { xs: "column", md: "row" },
                    gap: 2,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: "10px",
                        backgroundColor: "#EEF2FF",
                        color: "#4F46E5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        mt: 0.25,
                      }}
                    >
                      <IconDownload size={22} stroke={2.2} />
                    </Box>
                    <Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#101828" }}>
                          Smart Safety Guardrail: Download Backup Before Purging
                        </Typography>
                        <Chip
                          size="small"
                          label="Highly Recommended"
                          sx={{
                            height: 20,
                            fontSize: 10.5,
                            fontWeight: 700,
                            backgroundColor: "#EEF2FF",
                            color: "#4F46E5",
                            border: "1px solid #C7D7FE",
                          }}
                        />
                      </Box>
                      <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                        Once deleted, cloud records cannot be recovered. Download a complete JSON snapshot of all your knowledge documents, email threads, and AI memory facts.
                      </Typography>
                      {/* Live Data Inventory Pills */}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mt: 1 }}>
                        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.35, borderRadius: "6px", backgroundColor: "#FFFFFF", border: "1px solid #D0D5DD", fontSize: 11, fontWeight: 600, color: "#344054" }}>
                          📁 38 Knowledge Docs (42 MB)
                        </Box>
                        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.35, borderRadius: "6px", backgroundColor: "#FFFFFF", border: "1px solid #D0D5DD", fontSize: 11, fontWeight: 600, color: "#344054" }}>
                          💬 842 Customer Threads
                        </Box>
                        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.35, borderRadius: "6px", backgroundColor: "#FFFFFF", border: "1px solid #D0D5DD", fontSize: 11, fontWeight: 600, color: "#344054" }}>
                          🧠 129 AI Memory Facts
                        </Box>
                      </Box>
                    </Box>
                  </Box>

                  <Button
                    variant="contained"
                    disabled={isGeneratingDataDump}
                    onClick={handleGenerateDataDump}
                    startIcon={<IconDownload size={16} />}
                    sx={{
                      textTransform: "none",
                      fontWeight: 700,
                      fontSize: 13,
                      backgroundColor: "#4F46E5",
                      borderRadius: "10px",
                      px: 2.25,
                      py: 1,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                      "&:hover": { backgroundColor: "#4338CA" },
                    }}
                  >
                    {isGeneratingDataDump ? "Preparing Archive..." : "Download Backup Archive (.json)"}
                  </Button>
                </Box>

                {/* CARD 1: Business Knowledge & Vector Memory Reset */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: "10px",
                          backgroundColor: "#FEF2F2",
                          color: "#DC2626",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <IconDatabaseOff size={22} stroke={2} />
                      </Box>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
                            Delete All Business Knowledge & Training
                          </Typography>
                          <Chip
                            size="small"
                            label="Moderate Impact"
                            sx={{
                              height: 20,
                              fontSize: 10.5,
                              fontWeight: 700,
                              backgroundColor: "#FFFBEB",
                              color: "#B45309",
                              border: "1px solid #FDE68A",
                            }}
                          />
                        </Box>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Permanently remove all uploaded PDF guidelines, price lists, product catalogs, and semantic vector embeddings.
                        </Typography>
                      </Box>
                    </Box>

                    <Button
                      variant="contained"
                      onClick={() => setActiveDeleteModal("knowledge")}
                      startIcon={<IconTrash size={16} />}
                      sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        fontSize: 13,
                        backgroundColor: "#DC2626",
                        borderRadius: "10px",
                        px: 2.25,
                        py: 0.9,
                        boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                        whiteSpace: "nowrap",
                        "&:hover": { backgroundColor: "#B91C1C" },
                      }}
                    >
                      Delete All Knowledge
                    </Button>
                  </Box>

                  {/* Impact Breakdown Matrix */}
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: "12px",
                      backgroundColor: "#FAFAFA",
                      border: "1px solid #EAECF0",
                      display: "flex",
                      flexDirection: "column",
                      gap: 1.5,
                    }}
                  >
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#475467", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Scope & Destruction Summary:
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      <Chip size="small" label="38 Uploaded Files (PDF, Excel, Docs)" sx={{ backgroundColor: "#FFFFFF", border: "1px solid #D0D5DD", fontSize: 12, fontWeight: 600, color: "#344054" }} />
                      <Chip size="small" label="42 MB Vector Search Embeddings" sx={{ backgroundColor: "#FFFFFF", border: "1px solid #D0D5DD", fontSize: 12, fontWeight: 600, color: "#344054" }} />
                      <Chip size="small" label="129 Learned Business Context Rules" sx={{ backgroundColor: "#FFFFFF", border: "1px solid #D0D5DD", fontSize: 12, fontWeight: 600, color: "#344054" }} />
                      <Chip size="small" label="✓ Email Threads Remain Intact" sx={{ backgroundColor: "#ECFDF5", border: "1px solid #A7F3D0", fontSize: 12, fontWeight: 700, color: "#059669" }} />
                    </Box>
                    <Typography sx={{ fontSize: 12.5, color: "#667085", lineHeight: 1.5 }}>
                      • All company documents and training files will be permanently purged from PostgreSQL and vector index partitions.<br />
                      • ProxiPilot AI will immediately cease referencing your custom guidelines and price sheets when composing drafts.<br />
                      • You can re-upload fresh documents at any time from the <strong>Knowledge</strong> tab.
                    </Typography>
                  </Box>
                </Box>

                {/* CARD 2: Customer Conversations & Email Threads Purge */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: "10px",
                          backgroundColor: "#FEF2F2",
                          color: "#DC2626",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <IconMessageOff size={22} stroke={2} />
                      </Box>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
                            Delete Customer Conversations & Messages
                          </Typography>
                          <Chip
                            size="small"
                            label="High Impact"
                            sx={{
                              height: 20,
                              fontSize: 10.5,
                              fontWeight: 700,
                              backgroundColor: "#FEF2F2",
                              color: "#DC2626",
                              border: "1px solid #FECACA",
                            }}
                          />
                        </Box>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Permanently wipe synchronized customer email threads, drafts, scheduled cadence reminders, and thread telemetry.
                        </Typography>
                      </Box>
                    </Box>

                    <Button
                      variant="contained"
                      onClick={() => setActiveDeleteModal("conversations")}
                      startIcon={<IconTrash size={16} />}
                      sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        fontSize: 13,
                        backgroundColor: "#DC2626",
                        borderRadius: "10px",
                        px: 2.25,
                        py: 0.9,
                        boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                        whiteSpace: "nowrap",
                        "&:hover": { backgroundColor: "#B91C1C" },
                      }}
                    >
                      Delete Conversations
                    </Button>
                  </Box>

                  {/* Smart Selective Purge Range Filter */}
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: "12px",
                      backgroundColor: "#F8FAFC",
                      border: "1.5px solid #E2E8F0",
                      display: "flex",
                      alignItems: { xs: "flex-start", sm: "center" },
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 2,
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: "#101828" }}>
                        Smart Purge Scope Filter:
                      </Typography>
                      <Typography sx={{ fontSize: 12.5, color: "#667085", mt: 0.25 }}>
                        Choose whether to wipe everything or only prune aged or soft-deleted correspondence.
                      </Typography>
                    </Box>

                    <Box
                      component="select"
                      value={selectivePurgeFilter}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        const val = e.target.value as "all" | "older_90" | "soft_trash";
                        setSelectivePurgeFilter(val);
                        toast.info(`Selected purge scope: ${e.target.options[e.target.selectedIndex].text}`);
                      }}
                      sx={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #CBD5E1",
                        borderRadius: "8px",
                        px: 1.75,
                        py: 0.75,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#1E293B",
                        outline: "none",
                        cursor: "pointer",
                        minWidth: 260,
                      }}
                    >
                      <option value="all">Purge All Conversations (Full Reset)</option>
                      <option value="older_90">Prune Threads Older than 90 Days</option>
                      <option value="soft_trash">Empty Soft-Deleted Trash Only</option>
                    </Box>
                  </Box>

                  {/* Guaranteed Safe Reassurance Box */}
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: "12px",
                      backgroundColor: "#F0FDF4",
                      border: "1px solid #DCFCE7",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 1.5,
                    }}
                  >
                    <IconShieldCheck size={22} color="#16A34A" style={{ marginTop: 2, flexShrink: 0 }} />
                    <Box>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: "#15803D" }}>
                        100% Mailbox Safety Guarantee: Your actual Gmail / Outlook accounts are untouched
                      </Typography>
                      <Typography sx={{ fontSize: 12.5, color: "#166534", mt: 0.35, lineHeight: 1.5 }}>
                        This deletion only removes the local database cache, drafts, and AI notes within ProxiPilot. <strong>No messages will ever be removed from your Google or Microsoft inboxes.</strong>
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* CARD 3: Complete Account & Workspace Destruction */}
                <Box
                  sx={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1.5px solid #FECDCA",
                    p: { xs: 2.5, sm: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.5,
                    boxShadow: "0px 1px 3px rgba(16, 24, 40, 0.04), 0px 1px 2px rgba(16, 24, 40, 0.02)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: "10px",
                          backgroundColor: "#FEF2F2",
                          color: "#991B1B",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <IconUserX size={22} stroke={2} />
                      </Box>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#991B1B" }}>
                            Completely Delete Account & Workspace
                          </Typography>
                          <Chip
                            size="small"
                            label="Critical Destruction"
                            sx={{
                              height: 20,
                              fontSize: 10.5,
                              fontWeight: 800,
                              backgroundColor: "#991B1B",
                              color: "#FFFFFF",
                            }}
                          />
                        </Box>
                        <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                          Permanently close your personal account (`{user?.email || "anmolsinha4321@gmail.com"}`), cancel Stripe billing, and destroy tenant encryption keys.
                        </Typography>
                      </Box>
                    </Box>

                    <Button
                      variant="contained"
                      onClick={() => setActiveDeleteModal("account")}
                      startIcon={<IconUserX size={16} />}
                      sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        fontSize: 13,
                        backgroundColor: "#991B1B",
                        borderRadius: "10px",
                        px: 2.25,
                        py: 0.9,
                        boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                        whiteSpace: "nowrap",
                        "&:hover": { backgroundColor: "#7F1D1D" },
                      }}
                    >
                      Delete My Account
                    </Button>
                  </Box>

                  {/* Smart 7-Day Soft-Freeze Protection Feature */}
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: "12px",
                      backgroundColor: "#FFFBEB",
                      border: "1px solid #FDE68A",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "10px",
                          backgroundColor: "#FEF3C7",
                          color: "#D97706",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          mt: 0.25,
                        }}
                      >
                        <IconClock size={18} />
                      </Box>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#92400E" }}>
                            7-Day Soft-Freeze Safety Protection
                          </Typography>
                          <Chip
                            size="small"
                            label={softFreezeGracePeriod ? "Enabled (Recommended)" : "Immediate Hard Purge"}
                            sx={{
                              height: 20,
                              fontSize: 10.5,
                              fontWeight: 700,
                              backgroundColor: softFreezeGracePeriod ? "#DCFCE7" : "#FEE2E2",
                              color: softFreezeGracePeriod ? "#166534" : "#991B1B",
                              border: softFreezeGracePeriod ? "1px solid #86EFAC" : "1px solid #FECACA",
                            }}
                          />
                        </Box>
                        <Typography sx={{ fontSize: 12.5, color: "#B45309", mt: 0.25 }}>
                          Locks the workspace immediately and halts AI autopilot. Allows workspace administrators to recover data via support if triggered accidentally within 7 days.
                        </Typography>
                      </Box>
                    </Box>

                    <UntitledSwitch
                      checked={softFreezeGracePeriod}
                      onChange={(e) => {
                        setSoftFreezeGracePeriod(e.target.checked);
                        toast.info(
                          e.target.checked
                            ? "7-day soft-freeze grace period enabled"
                            : "7-day grace period disabled: Deletion will be immediately permanent"
                        );
                      }}
                      slotProps={{ input: { "aria-label": "7-Day Soft-Freeze Protection" } }}
                    />
                  </Box>

                  {/* Critical Scopes Checklist */}
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: "12px",
                      backgroundColor: "#FEF2F2",
                      border: "1px solid #FECDCA",
                      display: "flex",
                      flexDirection: "column",
                      gap: 1.25,
                    }}
                  >
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#991B1B", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Permanent Irreversible Consequences:
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      <Chip size="small" label="Identity & Login Credentials Wiped" sx={{ backgroundColor: "#FFFFFF", color: "#991B1B", border: "1px solid #FECDCA", fontSize: 12, fontWeight: 600 }} />
                      <Chip size="small" label="Stripe Subscription Canceled" sx={{ backgroundColor: "#FFFFFF", color: "#991B1B", border: "1px solid #FECDCA", fontSize: 12, fontWeight: 600 }} />
                      <Chip size="small" label="Tenant KMS Encryption Keys Shredded" sx={{ backgroundColor: "#FFFFFF", color: "#991B1B", border: "1px solid #FECDCA", fontSize: 12, fontWeight: 600 }} />
                      <Chip size="small" label="All Team Seats Disconnected" sx={{ backgroundColor: "#FFFFFF", color: "#991B1B", border: "1px solid #FECDCA", fontSize: 12, fontWeight: 600 }} />
                    </Box>
                    <Typography sx={{ fontSize: 12.5, color: "#7F1D1D", mt: 0.5, lineHeight: 1.5 }}>
                      • You will be signed out immediately and all active web and API sessions will be terminated.<br />
                      • If you are the sole owner, your workspace and all tenant configurations will be completely dissolved.
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
          backdrop: {
            sx: {
              backgroundColor: "rgba(16, 24, 40, 0.7)",
              backdropFilter: "blur(8px)",
            },
          },
          paper: {
            sx: {
              borderRadius: "20px",
              p: { xs: 2.5, sm: 3 },
              boxShadow: "0px 24px 48px -12px rgba(16, 24, 40, 0.28)",
            },
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "12px",
                backgroundColor: "#FEE4E2",
                color: "#D92D20",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                border: "1px solid #FECDCA",
              }}
            >
              <IconAlertTriangle size={24} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#101828", letterSpacing: "-0.01em" }}>
                {activeDeleteModal === "knowledge" && "Delete Complete Business Knowledge?"}
                {activeDeleteModal === "conversations" && "Delete All Conversations & Threads?"}
                {activeDeleteModal === "account" && "Permanently Delete Your Account?"}
              </Typography>
              <Typography sx={{ fontSize: 13, color: "#667085", mt: 0.25 }}>
                {activeDeleteModal === "account"
                  ? softFreezeGracePeriod
                    ? "7-Day Soft-Freeze protection active • Irreversible thereafter"
                    : "Immediate permanent destruction • Cannot be undone"
                  : "This action is permanent and cannot be undone."}
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={handleCloseDeleteModal} sx={{ color: "#98A2B3" }}>
            <IconX size={18} />
          </IconButton>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, my: 1 }}>
          <Alert
            severity="error"
            sx={{
              borderRadius: "12px",
              fontSize: 13,
              backgroundColor: "#FEF2F2",
              border: "1px solid #FECDCA",
              color: "#991B1B",
              "& .MuiAlert-icon": { color: "#DC2626" },
            }}
          >
            {activeDeleteModal === "knowledge" && (
              <>
                <strong>Destruction Notice:</strong> 38 company documents and 42 MB vector semantic embeddings will be permanently wiped. ProxiPilot AI will immediately cease referencing your custom guidelines and price sheets.
              </>
            )}
            {activeDeleteModal === "conversations" && (
              <>
                <strong>Destruction Notice:</strong> {selectivePurgeFilter === "older_90" ? "Threads older than 90 days" : selectivePurgeFilter === "soft_trash" ? "Soft-deleted trash threads" : "All 842 customer email threads and drafts"} will be permanently cleared from ProxiPilot. <em>(Your real Gmail / Outlook mailbox is 100% safe and untouched).</em>
              </>
            )}
            {activeDeleteModal === "account" && (
              <>
                <strong>Critical Workspace Closure:</strong> Your login identity ({user?.email || "anmolsinha4321@gmail.com"}), active sessions, and tenant encryption keys will be permanently dissolved.
              </>
            )}
          </Alert>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: 13, color: "#344054", fontWeight: 600 }}>
                To confirm, type keyword below:
              </Typography>
              <Box
                role="button"
                tabIndex={0}
                onClick={() => setConfirmInputText(requiredConfirmationKeyword)}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5,
                  px: 1,
                  py: 0.25,
                  borderRadius: "6px",
                  backgroundColor: "#FEE4E2",
                  color: "#B42318",
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "monospace",
                  cursor: "pointer",
                  border: "1px solid #FECDCA",
                  "&:hover": { backgroundColor: "#FECDCA" },
                }}
              >
                {requiredConfirmationKeyword} (Click to fill)
              </Box>
            </Box>
            <TextField
              fullWidth
              size="small"
              value={confirmInputText}
              onChange={(e) => setConfirmInputText(e.target.value)}
              placeholder={`Type "${requiredConfirmationKeyword}" to confirm`}
              autoFocus
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  fontSize: 14,
                  fontFamily: "monospace",
                  backgroundColor: "#FAFAFA",
                },
              }}
            />
          </Box>

          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, p: 1.5, borderRadius: "10px", backgroundColor: "#F8FAFC", border: "1px solid #EAECF0" }}>
            <Checkbox
              checked={confirmUnderstood}
              onChange={(e) => setConfirmUnderstood(e.target.checked)}
              sx={{ p: 0, mt: 0.25, color: "#D0D5DD", "&.Mui-checked": { color: "#D92D20" } }}
            />
            <Typography sx={{ fontSize: 13, color: "#344054", fontWeight: 500, lineHeight: 1.45 }}>
              I understand that this action is immediate, irreversible, and permanently removes the selected records from cloud infrastructure.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.25, pt: 2, borderTop: "1px solid #EAECF0", mt: 1 }}>
          <Button
            onClick={handleCloseDeleteModal}
            disabled={isDeleting}
            sx={{
              ...secondaryBtnSx,
              fontSize: 13,
              borderRadius: "8px",
              px: 2,
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
              fontWeight: 700,
              fontSize: 13,
              borderRadius: "8px",
              px: 2.5,
              py: 0.8,
              boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
              "&:hover": { backgroundColor: "#B42318" },
              "&.Mui-disabled": { backgroundColor: "#F2F4F7", color: "#98A2B3" },
            }}
          >
            {isDeleting ? "Processing Permanent Wipe..." : "Permanently Delete"}
          </Button>
        </Box>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog
        open={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: "rgba(16, 24, 40, 0.6)",
              backdropFilter: "blur(6px)",
            },
          },
          paper: {
            sx: {
              borderRadius: "20px",
              p: 3,
              boxShadow: "0px 24px 48px -12px rgba(16, 24, 40, 0.25)",
            },
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
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
              }}
            >
              <IconKey size={20} stroke={2} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
                Update Password
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#667085" }}>
                Ensure your account uses a secure passphrase
              </Typography>
            </Box>
          </Box>
          <IconButton
            size="small"
            onClick={() => setIsChangePasswordOpen(false)}
            sx={{ color: "#98A2B3" }}
          >
            <IconX size={18} />
          </IconButton>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, my: 1 }}>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#344054", mb: 0.5 }}>
              Current Password
            </Typography>
            <TextField
              type="password"
              fullWidth
              size="small"
              placeholder="••••••••••••"
              value={currentPasswordInput}
              onChange={(e) => setCurrentPasswordInput(e.target.value)}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  backgroundColor: "#FFFFFF",
                  fontSize: 13.5,
                  "& fieldset": { borderColor: "#D0D5DD" },
                  "&:hover fieldset": { borderColor: "#98A2B3" },
                  "&.Mui-focused fieldset": { borderColor: "#4F46E5", borderWidth: "1.5px" },
                },
              }}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#344054", mb: 0.5 }}>
              New Password
            </Typography>
            <TextField
              type="password"
              fullWidth
              size="small"
              placeholder="••••••••••••"
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  backgroundColor: "#FFFFFF",
                  fontSize: 13.5,
                  "& fieldset": { borderColor: "#D0D5DD" },
                  "&:hover fieldset": { borderColor: "#98A2B3" },
                  "&.Mui-focused fieldset": { borderColor: "#4F46E5", borderWidth: "1.5px" },
                },
              }}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#344054", mb: 0.5 }}>
              Confirm New Password
            </Typography>
            <TextField
              type="password"
              fullWidth
              size="small"
              placeholder="••••••••••••"
              value={confirmPasswordInput}
              onChange={(e) => setConfirmPasswordInput(e.target.value)}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  backgroundColor: "#FFFFFF",
                  fontSize: 13.5,
                  "& fieldset": { borderColor: "#D0D5DD" },
                  "&:hover fieldset": { borderColor: "#98A2B3" },
                  "&.Mui-focused fieldset": { borderColor: "#4F46E5", borderWidth: "1.5px" },
                },
              }}
            />
          </Box>

          <Box
            sx={{
              p: 1.5,
              borderRadius: "10px",
              backgroundColor: "#F8FAFC",
              border: "1px solid #EAECF0",
            }}
          >
            <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#475467", textTransform: "uppercase", letterSpacing: "0.04em", mb: 0.5 }}>
              Password Requirements
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
              <Typography sx={{ fontSize: 12, color: newPasswordInput.length >= 8 ? "#16A34A" : "#64748B" }}>
                {newPasswordInput.length >= 8 ? "✓" : "•"} Minimum 8 characters
              </Typography>
              <Typography sx={{ fontSize: 12, color: /[A-Z]/.test(newPasswordInput) && /[a-z]/.test(newPasswordInput) ? "#16A34A" : "#64748B" }}>
                {/[A-Z]/.test(newPasswordInput) && /[a-z]/.test(newPasswordInput) ? "✓" : "•"} Uppercase & lowercase letters
              </Typography>
              <Typography sx={{ fontSize: 12, color: /[0-9!@#$%^&*]/.test(newPasswordInput) ? "#16A34A" : "#64748B" }}>
                {/[0-9!@#$%^&*]/.test(newPasswordInput) ? "✓" : "•"} At least one number or symbol
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.25, mt: 2 }}>
          <Button
            variant="text"
            onClick={() => setIsChangePasswordOpen(false)}
            sx={{ textTransform: "none", fontWeight: 600, color: "#475467" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={isUpdatingPassword}
            onClick={handleChangePasswordSubmit}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              backgroundColor: "#4F46E5",
              borderRadius: "8px",
              px: 2.5,
              "&:hover": { backgroundColor: "#4338CA" },
            }}
          >
            {isUpdatingPassword ? "Updating…" : "Update Password"}
          </Button>
        </Box>
      </Dialog>

      {/* Change / Upgrade Plan Dialog */}
      <Dialog
        open={isUpgradePlanOpen}
        onClose={() => setIsUpgradePlanOpen(false)}
        maxWidth={false}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: "rgba(16, 24, 40, 0.65)",
              backdropFilter: "blur(8px)",
            },
          },
          paper: {
            sx: {
              borderRadius: "24px",
              maxWidth: "1240px",
              width: "96vw",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0px 32px 64px -12px rgba(16, 24, 40, 0.28)",
              p: 0,
            },
          },
        }}
      >
        {/* Pinned Modal Header */}
        <Box
          sx={{
            p: { xs: 2.5, sm: 3 },
            pb: 2,
            borderBottom: "1px solid #EAECF0",
            backgroundColor: "#FFFFFF",
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
                  color: "#4F46E5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid rgba(99, 102, 241, 0.15)",
                }}
              >
                <IconRocket size={24} stroke={2.2} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 20, fontWeight: 700, color: "#101828", letterSpacing: "-0.02em" }}>
                  Upgrade or Change Subscription Plan
                </Typography>
                <Typography sx={{ fontSize: 13.5, color: "#667085", mt: 0.25 }}>
                  Select a tier to match your team size, lead volume, and AI intelligence requirements.
                </Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={() => setIsUpgradePlanOpen(false)} sx={{ color: "#98A2B3" }}>
              <IconX size={20} />
            </IconButton>
          </Box>

          {/* Monthly / Yearly Toggle in Modal */}
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                backgroundColor: "#F3F4F6",
                p: "4px",
                borderRadius: "10px",
                border: "1px solid #E5E7EB",
              }}
            >
              <Box
                role="button"
                tabIndex={0}
                onClick={() => setBillingCycle("monthly")}
                sx={{
                  px: 2.5,
                  py: 0.7,
                  borderRadius: "8px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  backgroundColor: billingCycle === "monthly" ? "#FFFFFF" : "transparent",
                  color: billingCycle === "monthly" ? "#111827" : "#6B7280",
                  boxShadow: billingCycle === "monthly" ? "0px 1px 2px rgba(16, 24, 40, 0.08)" : "none",
                }}
              >
                Monthly billing
              </Box>
              <Box
                role="button"
                tabIndex={0}
                onClick={() => setBillingCycle("yearly")}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  px: 2.5,
                  py: 0.7,
                  borderRadius: "8px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  backgroundColor: billingCycle === "yearly" ? "#FFFFFF" : "transparent",
                  color: billingCycle === "yearly" ? "#111827" : "#6B7280",
                  boxShadow: billingCycle === "yearly" ? "0px 1px 2px rgba(16, 24, 40, 0.08)" : "none",
                }}
              >
                Yearly billing
                <Chip
                  size="small"
                  label="Save 20%"
                  sx={{
                    height: 18,
                    fontSize: 10,
                    fontWeight: 700,
                    backgroundColor: "#DCFCE7",
                    color: "#16A34A",
                    border: "1px solid #86EFAC",
                  }}
                />
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Scrollable Content Area */}
        <Box
          sx={{
            p: { xs: 2, sm: 3 },
            overflowY: "auto",
            flex: 1,
            backgroundColor: "#F8FAFC",
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
                lg: "repeat(4, minmax(0, 1fr))",
              },
              gap: 2.5,
              alignItems: "stretch",
            }}
          >
            {PLAN_TIER_DETAILS.map((plan) => {
              const isCurrent = plan.id === currentPlanTier;
              const meta = PLAN_CONFIGS[plan.id];
              const price = billingCycle === "yearly" ? plan.yearlyMonthlyPrice : plan.monthlyPrice;

              const PLAN_ORDER = ["starter", "growth", "business", "enterprise"];
              const currentIdx = PLAN_ORDER.indexOf(currentPlanTier);
              const planIdx = PLAN_ORDER.indexOf(plan.id);
              const isUpgrade = planIdx > currentIdx;

              return (
                <Box
                  key={plan.id}
                  sx={{
                    p: 2.5,
                    borderRadius: "18px",
                    border: isCurrent ? "2.5px solid #4F46E5" : "1px solid #E5E7EB",
                    backgroundColor: "#FFFFFF",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    position: "relative",
                    transition: "all 0.2s ease",
                    boxShadow: isCurrent
                      ? "0px 12px 28px -4px rgba(79, 70, 229, 0.18)"
                      : "0px 1px 3px rgba(16, 24, 40, 0.05)",
                    "&:hover": {
                      borderColor: isCurrent ? "#4F46E5" : "#CBD5E1",
                      boxShadow: "0px 12px 24px -4px rgba(16, 24, 40, 0.08)",
                    },
                  }}
                >
                  {/* Popular or Recommended Tag */}
                  {plan.popular && !isCurrent && (
                    <Box
                      sx={{
                        position: "absolute",
                        top: -11,
                        left: "50%",
                        transform: "translateX(-50%)",
                        backgroundColor: "#4F46E5",
                        color: "#FFFFFF",
                        fontSize: 10,
                        fontWeight: 800,
                        px: 1.5,
                        py: 0.35,
                        borderRadius: "10px",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        boxShadow: "0 2px 4px rgba(79, 70, 229, 0.25)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Most Popular
                    </Box>
                  )}

                  {/* Top: Plan identity, pricing, and quota pills */}
                  <Box>
                    {/* Header Row */}
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.25 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: meta.ringGradient,
                          }}
                        />
                        <Typography sx={{ fontSize: 17, fontWeight: 700, color: "#101828" }}>
                          {plan.name}
                        </Typography>
                      </Box>
                      {isCurrent ? (
                        <Chip
                          size="small"
                          label="✓ Active Plan"
                          sx={{
                            height: 20,
                            fontSize: 10.5,
                            fontWeight: 700,
                            backgroundColor: "#ECFDF5",
                            color: "#059669",
                            border: "1px solid #A7F3D0",
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            background: meta.badgeBg,
                            border: `1px solid ${meta.badgeBorder}`,
                            color: meta.badgeColor,
                            fontSize: 10.5,
                            fontWeight: 700,
                            px: 1,
                            py: 0.2,
                            borderRadius: "6px",
                          }}
                        >
                          {meta.tagLabel}
                        </Box>
                      )}
                    </Box>

                    {/* Price display */}
                    <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, mt: 1 }}>
                      <Typography sx={{ fontSize: 32, fontWeight: 800, color: "#101828", letterSpacing: "-0.03em" }}>
                        ${price}
                      </Typography>
                      <Typography sx={{ fontSize: 12.5, color: "#667085", fontWeight: 500 }}>
                        / user / month
                      </Typography>
                    </Box>

                    <Typography sx={{ fontSize: 11.5, color: "#64748B", mt: 0.25, mb: 1.5 }}>
                      {billingCycle === "yearly" ? `Billed annually ($${price * 12}/yr)` : "Billed monthly • cancel anytime"}
                    </Typography>

                    {/* Compact Quota Badges */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", mb: 2 }}>
                      <Box
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.5,
                          px: 1,
                          py: 0.4,
                          borderRadius: "6px",
                          backgroundColor: "#F1F5F9",
                          color: "#334155",
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        ⚡ {plan.credits.toLocaleString()} Credits
                      </Box>
                      <Box
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.5,
                          px: 1,
                          py: 0.4,
                          borderRadius: "6px",
                          backgroundColor: "#F1F5F9",
                          color: "#334155",
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        👥 {plan.seats} Seats
                      </Box>
                    </Box>

                    {/* Features list */}
                    <Box sx={{ borderTop: "1px solid #F1F5F9", pt: 1.75 }}>
                      <Typography
                        sx={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#94A3B8",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          mb: 1.25,
                        }}
                      >
                        What&apos;s Included:
                      </Typography>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        {plan.features.map((feat, fIdx) => (
                          <Box key={fIdx} sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                            <IconCircleCheck
                              size={16}
                              color="#059669"
                              style={{ marginTop: 2, flexShrink: 0 }}
                            />
                            <Typography sx={{ fontSize: 12.5, color: "#374151", lineHeight: 1.45, fontWeight: 500 }}>
                              {feat}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>

                  {/* Bottom: Action Upgrade/Downgrade Button - Guaranteed 100% visible */}
                  <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid #F1F5F9" }}>
                    {isCurrent ? (
                      <Button
                        fullWidth
                        disabled
                        startIcon={<IconCheck size={16} color="#059669" />}
                        sx={{
                          textTransform: "none",
                          fontWeight: 700,
                          fontSize: 13,
                          borderRadius: "10px",
                          py: 1.1,
                          backgroundColor: "#ECFDF5 !important",
                          color: "#059669 !important",
                          border: "1.5px solid #A7F3D0",
                        }}
                      >
                        Current Plan
                      </Button>
                    ) : isUpgrade ? (
                      <Button
                        fullWidth
                        variant="contained"
                        onClick={() => handleSelectPlan(plan.id)}
                        sx={{
                          textTransform: "none",
                          fontWeight: 700,
                          fontSize: 13,
                          borderRadius: "10px",
                          py: 1.1,
                          background: meta.tagBg,
                          color: "#FFFFFF",
                          boxShadow: "0 2px 6px rgba(79, 70, 229, 0.25)",
                          "&:hover": {
                            filter: "brightness(0.95)",
                            boxShadow: "0 4px 12px rgba(79, 70, 229, 0.35)",
                          },
                        }}
                      >
                        Upgrade to {plan.name} →
                      </Button>
                    ) : (
                      <Button
                        fullWidth
                        variant="outlined"
                        onClick={() => handleSelectPlan(plan.id)}
                        sx={{
                          textTransform: "none",
                          fontWeight: 600,
                          fontSize: 13,
                          borderRadius: "10px",
                          py: 1.1,
                          color: "#344054",
                          borderColor: "#D0D5DD",
                          backgroundColor: "#FFFFFF",
                          "&:hover": {
                            borderColor: "#98A2B3",
                            backgroundColor: "#F9FAFB",
                          },
                        }}
                      >
                        Switch to {plan.name}
                      </Button>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Dialog>

      {/* Buy AI Credits Dialog */}
      <Dialog
        open={isBuyCreditsOpen}
        onClose={() => setIsBuyCreditsOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: "rgba(16, 24, 40, 0.6)",
              backdropFilter: "blur(6px)",
            },
          },
          paper: {
            sx: {
              borderRadius: "20px",
              p: 3,
              boxShadow: "0px 24px 48px -12px rgba(16, 24, 40, 0.25)",
            },
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: "10px",
                backgroundColor: "#FEF3C7",
                color: "#D97706",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconBolt size={20} stroke={2} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
                Buy Instant AI Credits
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#667085" }}>
                Credits never expire and roll over indefinitely.
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setIsBuyCreditsOpen(false)} sx={{ color: "#98A2B3" }}>
            <IconX size={18} />
          </IconButton>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, my: 1 }}>
          {[
            { credits: 1000, price: "$15", rate: "$0.015 / credit", badge: "" },
            { credits: 2500, price: "$30", rate: "$0.012 / credit", badge: "Save 20% • Popular" },
            { credits: 5000, price: "$55", rate: "$0.011 / credit", badge: "Save 27% • Best Value" },
          ].map((pack, idx) => (
            <Box
              key={idx}
              sx={{
                p: 2,
                borderRadius: "12px",
                border: "1px solid #EAECF0",
                backgroundColor: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                transition: "all 0.15s ease",
                "&:hover": { borderColor: "#4F46E5", backgroundColor: "#F8FAFC" },
              }}
            >
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#101828" }}>
                    +{pack.credits.toLocaleString()} AI Credits
                  </Typography>
                  {pack.badge && (
                    <Chip
                      size="small"
                      label={pack.badge}
                      sx={{
                        height: 18,
                        fontSize: 9.5,
                        fontWeight: 700,
                        backgroundColor: "#DCFCE7",
                        color: "#16A34A",
                        border: "1px solid #86EFAC",
                      }}
                    />
                  )}
                </Box>
                <Typography sx={{ fontSize: 12, color: "#667085", mt: 0.25 }}>
                  {pack.rate} • Instant account top-up
                </Typography>
              </Box>

              <Button
                variant="contained"
                onClick={() => handleBuyCredits(pack.credits, pack.price)}
                sx={{
                  backgroundColor: "#4F46E5",
                  textTransform: "none",
                  fontWeight: 700,
                  fontSize: 13,
                  borderRadius: "8px",
                  px: 2,
                  py: 0.75,
                  "&:hover": { backgroundColor: "#4338CA" },
                }}
              >
                {pack.price}
              </Button>
            </Box>
          ))}
        </Box>
      </Dialog>

      {/* Buy Extra Seats Dialog */}
      <Dialog
        open={isBuySeatsOpen}
        onClose={() => setIsBuySeatsOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: "rgba(16, 24, 40, 0.6)",
              backdropFilter: "blur(6px)",
            },
          },
          paper: {
            sx: {
              borderRadius: "20px",
              p: 3,
              boxShadow: "0px 24px 48px -12px rgba(16, 24, 40, 0.25)",
            },
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: "10px",
                backgroundColor: "#DCFCE7",
                color: "#16A34A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconUsers size={20} stroke={2} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
                Add Extra Team Seats
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#667085" }}>
                Add more teammate access to your workspace.
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setIsBuySeatsOpen(false)} sx={{ color: "#98A2B3" }}>
            <IconX size={18} />
          </IconButton>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, my: 1 }}>
          {[
            { seats: 1, price: "$15/mo", badge: "" },
            { seats: 3, price: "$40/mo", badge: "Save 11% • Popular" },
            { seats: 5, price: "$60/mo", badge: "Save 20% • Best Value" },
          ].map((pack, idx) => (
            <Box
              key={idx}
              sx={{
                p: 2,
                borderRadius: "12px",
                border: "1px solid #EAECF0",
                backgroundColor: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                transition: "all 0.15s ease",
                "&:hover": { borderColor: "#16A34A", backgroundColor: "#F0FDF4" },
              }}
            >
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#101828" }}>
                    +{pack.seats} Team Seat{pack.seats > 1 ? "s" : ""}
                  </Typography>
                  {pack.badge && (
                    <Chip
                      size="small"
                      label={pack.badge}
                      sx={{
                        height: 18,
                        fontSize: 9.5,
                        fontWeight: 700,
                        backgroundColor: "#DCFCE7",
                        color: "#16A34A",
                        border: "1px solid #86EFAC",
                      }}
                    />
                  )}
                </Box>
                <Typography sx={{ fontSize: 12, color: "#667085", mt: 0.25 }}>
                  Immediate activation for new collaborators
                </Typography>
              </Box>

              <Button
                variant="contained"
                onClick={() => handleBuySeats(pack.seats, pack.price)}
                sx={{
                  backgroundColor: "#16A34A",
                  textTransform: "none",
                  fontWeight: 700,
                  fontSize: 13,
                  borderRadius: "8px",
                  px: 2,
                  py: 0.75,
                  "&:hover": { backgroundColor: "#15803D" },
                }}
              >
                {pack.price}
              </Button>
            </Box>
          ))}
        </Box>
      </Dialog>

      {/* Buy Extra Storage Dialog */}
      <Dialog
        open={isBuyStorageOpen}
        onClose={() => setIsBuyStorageOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: "rgba(16, 24, 40, 0.6)",
              backdropFilter: "blur(6px)",
            },
          },
          paper: {
            sx: {
              borderRadius: "20px",
              p: 3,
              boxShadow: "0px 24px 48px -12px rgba(16, 24, 40, 0.25)",
            },
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: "10px",
                backgroundColor: "#F3E8FF",
                color: "#7E22CE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconDatabase size={20} stroke={2} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
                Add Docs & Vector Storage
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#667085" }}>
                Increase capacity for PDF guidelines and knowledge docs.
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setIsBuyStorageOpen(false)} sx={{ color: "#98A2B3" }}>
            <IconX size={18} />
          </IconButton>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, my: 1 }}>
          {[
            { mb: 500, label: "+500 MB Storage", price: "$10/mo", badge: "" },
            { mb: 1000, label: "+1,000 MB (1 GB)", price: "$18/mo", badge: "Save 10% • Popular" },
            { mb: 5000, label: "+5,000 MB (5 GB)", price: "$45/mo", badge: "Save 55% • Best Value" },
          ].map((pack, idx) => (
            <Box
              key={idx}
              sx={{
                p: 2,
                borderRadius: "12px",
                border: "1px solid #EAECF0",
                backgroundColor: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                transition: "all 0.15s ease",
                "&:hover": { borderColor: "#7E22CE", backgroundColor: "#FAF5FF" },
              }}
            >
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#101828" }}>
                    {pack.label}
                  </Typography>
                  {pack.badge && (
                    <Chip
                      size="small"
                      label={pack.badge}
                      sx={{
                        height: 18,
                        fontSize: 9.5,
                        fontWeight: 700,
                        backgroundColor: "#F3E8FF",
                        color: "#7E22CE",
                        border: "1px solid #E9D5FF",
                      }}
                    />
                  )}
                </Box>
                <Typography sx={{ fontSize: 12, color: "#667085", mt: 0.25 }}>
                  High-speed vector embedding capacity
                </Typography>
              </Box>

              <Button
                variant="contained"
                onClick={() => handleBuyStorage(pack.mb, pack.price)}
                sx={{
                  backgroundColor: "#7E22CE",
                  textTransform: "none",
                  fontWeight: 700,
                  fontSize: 13,
                  borderRadius: "8px",
                  px: 2,
                  py: 0.75,
                  "&:hover": { backgroundColor: "#6B21A8" },
                }}
              >
                {pack.price}
              </Button>
            </Box>
          ))}
        </Box>
      </Dialog>

      {/* Add Payment Method Dialog */}
      <Dialog
        open={isAddPaymentOpen}
        onClose={() => setIsAddPaymentOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: "rgba(16, 24, 40, 0.6)",
              backdropFilter: "blur(6px)",
            },
          },
          paper: {
            sx: {
              borderRadius: "20px",
              p: 3,
              boxShadow: "0px 24px 48px -12px rgba(16, 24, 40, 0.25)",
            },
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: "10px",
                backgroundColor: "#EEF2FF",
                color: "#4F46E5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconCreditCard size={20} stroke={2} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
                Add Payment Method
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#667085" }}>
                Secured by 256-bit Stripe encryption
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setIsAddPaymentOpen(false)} sx={{ color: "#98A2B3" }}>
            <IconX size={18} />
          </IconButton>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, my: 1 }}>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#344054", mb: 0.5 }}>
              Name on Card
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="e.g. Anmol Sinha"
              value={newCardHolder}
              onChange={(e) => setNewCardHolder(e.target.value)}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  fontSize: 13.5,
                },
              }}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#344054", mb: 0.5 }}>
              Card Number
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="•••• •••• •••• ••••"
              value={newCardNumber}
              onChange={(e) => setNewCardNumber(e.target.value)}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  fontSize: 13.5,
                },
              }}
            />
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#344054", mb: 0.5 }}>
                Expiry (MM/YY)
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="MM/YY"
                value={newCardExp}
                onChange={(e) => setNewCardExp(e.target.value)}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "10px",
                    fontSize: 13.5,
                  },
                }}
              />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#344054", mb: 0.5 }}>
                CVC / CVV
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="123"
                value={newCardCvc}
                onChange={(e) => setNewCardCvc(e.target.value)}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "10px",
                    fontSize: 13.5,
                  },
                }}
              />
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Checkbox
              size="small"
              checked={newCardIsDefault}
              onChange={(e) => setNewCardIsDefault(e.target.checked)}
              sx={{ p: 0.5, color: "#4F46E5", "&.Mui-checked": { color: "#4F46E5" } }}
            />
            <Typography sx={{ fontSize: 13, color: "#344054" }}>
              Set as default payment method for this organization
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.25, mt: 2 }}>
          <Button
            variant="text"
            onClick={() => setIsAddPaymentOpen(false)}
            sx={{ textTransform: "none", fontWeight: 600, color: "#475467" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={isSavingCard}
            onClick={handleAddPaymentMethod}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              backgroundColor: "#4F46E5",
              borderRadius: "8px",
              px: 2.5,
              "&:hover": { backgroundColor: "#4338CA" },
            }}
          >
            {isSavingCard ? "Saving…" : "Save Payment Card"}
          </Button>
        </Box>
      </Dialog>

      {/* Edit Billing Information Dialog */}
      <Dialog
        open={isEditBillingInfoOpen}
        onClose={() => setIsEditBillingInfoOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: "rgba(16, 24, 40, 0.6)",
              backdropFilter: "blur(6px)",
            },
          },
          paper: {
            sx: {
              borderRadius: "20px",
              p: 3,
              boxShadow: "0px 24px 48px -12px rgba(16, 24, 40, 0.25)",
            },
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: "10px",
                backgroundColor: "#EEF2FF",
                color: "#4F46E5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconFileInvoice size={20} stroke={2} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#101828" }}>
                Edit Billing Details & Tax ID
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#667085" }}>
                Updated credentials will appear on all future tax invoices and receipts.
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setIsEditBillingInfoOpen(false)} sx={{ color: "#98A2B3" }}>
            <IconX size={18} />
          </IconButton>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, my: 1 }}>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#344054", mb: 0.5 }}>
              Legal Company Name
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={tempCompanyName}
              onChange={(e) => setTempCompanyName(e.target.value)}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  fontSize: 13.5,
                },
              }}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#344054", mb: 0.5 }}>
              Invoice Email Recipient
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={tempBillingEmail}
              onChange={(e) => setTempBillingEmail(e.target.value)}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  fontSize: 13.5,
                },
              }}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#344054", mb: 0.5 }}>
              Tax ID / GSTIN / VAT ID
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={tempTaxId}
              onChange={(e) => setTempTaxId(e.target.value)}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  fontSize: 13.5,
                },
              }}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#344054", mb: 0.5 }}>
              Registered Billing Address
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={2}
              size="small"
              value={tempAddress}
              onChange={(e) => setTempAddress(e.target.value)}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  fontSize: 13.5,
                },
              }}
            />
          </Box>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.25, mt: 2 }}>
          <Button
            variant="text"
            onClick={() => setIsEditBillingInfoOpen(false)}
            sx={{ textTransform: "none", fontWeight: 600, color: "#475467" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={isSavingBillingInfo}
            onClick={handleSaveBillingInfo}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              backgroundColor: "#4F46E5",
              borderRadius: "8px",
              px: 2.5,
              "&:hover": { backgroundColor: "#4338CA" },
            }}
          >
            {isSavingBillingInfo ? "Saving…" : "Save Changes"}
          </Button>
        </Box>
      </Dialog>

      {/* Invoice Preview Dialog */}
      <Dialog
        open={Boolean(selectedInvoiceForPreview)}
        onClose={() => setSelectedInvoiceForPreview(null)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: "rgba(16, 24, 40, 0.65)",
              backdropFilter: "blur(6px)",
            },
          },
          paper: {
            sx: {
              borderRadius: "20px",
              p: { xs: 2.5, sm: 3.5 },
              boxShadow: "0px 24px 48px -12px rgba(16, 24, 40, 0.25)",
            },
          },
        }}
      >
        {selectedInvoiceForPreview && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            {/* Header */}
            <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", pb: 2, borderBottom: "1.5px solid #EAECF0" }}>
              <Box>
                <Typography sx={{ fontSize: 20, fontWeight: 800, color: "#4F46E5", letterSpacing: "-0.02em" }}>
                  ⚡ ProxiPilot
                </Typography>
                <Typography sx={{ fontSize: 12, color: "#64748B", mt: 0.25 }}>
                  Autonomous Follow-up Intelligence & Autopilot
                </Typography>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Typography sx={{ fontSize: 16, fontWeight: 800, color: "#101828" }}>
                  {selectedInvoiceForPreview.invoiceNumber}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "#64748B" }}>
                  Date: {selectedInvoiceForPreview.date}
                </Typography>
                <Chip
                  size="small"
                  label="PAID"
                  sx={{
                    height: 18,
                    fontSize: 10,
                    fontWeight: 800,
                    backgroundColor: "#ECFDF5",
                    color: "#059669",
                    border: "1px solid #A7F3D0",
                    mt: 0.5,
                  }}
                />
              </Box>
            </Box>

            {/* Entity Details */}
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, fontSize: 13 }}>
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
                  Billed To
                </Typography>
                <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: "#101828", mt: 0.25 }}>
                  {companyLegalName}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "#475467", mt: 0.25 }}>
                  {companyBillingAddress}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "#475467" }}>
                  Tax ID: {taxIdNumber}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "#475467" }}>
                  Email: {invoiceEmail}
                </Typography>
              </Box>

              <Box sx={{ textAlign: "right" }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
                  Payment Method
                </Typography>
                <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: "#101828", mt: 0.25 }}>
                  Visa ending in 4242
                </Typography>
                <Typography sx={{ fontSize: 12, color: "#475467", mt: 0.25 }}>
                  PO Number: {poNumber}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "#475467" }}>
                  Currency: {billingCurrency}
                </Typography>
              </Box>
            </Box>

            {/* Line Items Table */}
            <Box sx={{ borderRadius: "10px", border: "1px solid #EAECF0", overflow: "hidden" }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "2.5fr 1fr 1fr", p: 1.25, backgroundColor: "#F8FAFC", borderBottom: "1px solid #EAECF0" }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Description</Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", textAlign: "center" }}>Qty</Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", textAlign: "right" }}>Total</Typography>
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: "2.5fr 1fr 1fr", p: 1.5, alignItems: "center" }}>
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#101828" }}>
                    {selectedInvoiceForPreview.description}
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, color: "#64748B" }}>
                    Service period: {selectedInvoiceForPreview.date} - Renewal
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 13, color: "#475467", textAlign: "center" }}>1</Typography>
                <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: "#101828", textAlign: "right" }}>
                  {selectedInvoiceForPreview.amount}
                </Typography>
              </Box>
            </Box>

            {/* Total Summary */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, alignItems: "flex-end", pr: 0.5 }}>
              <Box sx={{ display: "flex", gap: 4 }}>
                <Typography sx={{ fontSize: 12.5, color: "#64748B" }}>Subtotal:</Typography>
                <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "#101828" }}>{selectedInvoiceForPreview.amount}</Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 4 }}>
                <Typography sx={{ fontSize: 12.5, color: "#64748B" }}>Tax / GST (0% Reverse Charge):</Typography>
                <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "#101828" }}>$0.00</Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 4, pt: 1, borderTop: "1px solid #EAECF0", mt: 0.5 }}>
                <Typography sx={{ fontSize: 15, fontWeight: 800, color: "#101828" }}>Total Paid:</Typography>
                <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#4F46E5" }}>{selectedInvoiceForPreview.amount}</Typography>
              </Box>
            </Box>

            {/* Actions */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 2, borderTop: "1px solid #EAECF0" }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => window.print()}
                sx={{ textTransform: "none", fontWeight: 600, color: "#344054", borderColor: "#D0D5DD" }}
              >
                Print Invoice
              </Button>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setSelectedInvoiceForPreview(null)}
                  sx={{ textTransform: "none", fontWeight: 600, color: "#475467" }}
                >
                  Close
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => {
                    handleDownloadInvoice(selectedInvoiceForPreview);
                  }}
                  startIcon={<IconDownload size={15} />}
                  sx={{
                    textTransform: "none",
                    fontWeight: 700,
                    backgroundColor: "#4F46E5",
                    borderRadius: "8px",
                    px: 2,
                    "&:hover": { backgroundColor: "#4338CA" },
                  }}
                >
                  Download PDF
                </Button>
              </Box>
            </Box>
          </Box>
        )}
      </Dialog>

      {/* DPA Agreement Modal */}
      <Dialog
        open={isDpaModalOpen}
        onClose={() => setIsDpaModalOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: "rgba(16, 24, 40, 0.65)",
              backdropFilter: "blur(6px)",
            },
          },
          paper: {
            sx: {
              borderRadius: "20px",
              p: { xs: 2.5, sm: 3.5 },
              boxShadow: "0px 24px 48px -12px rgba(16, 24, 40, 0.25)",
            },
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, pb: 1.5, borderBottom: "1px solid #EAECF0" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: "10px",
                backgroundColor: "#EEF2FF",
                color: "#4F46E5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconFileText size={20} stroke={2} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 17, fontWeight: 700, color: "#101828" }}>
                Executed Data Processing Addendum (DPA)
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#64748B" }}>
                In compliance with GDPR Article 28 & EU Standard Contractual Clauses (SCC)
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setIsDpaModalOpen(false)} sx={{ color: "#98A2B3" }}>
            <IconX size={18} />
          </IconButton>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, my: 1, maxHeight: "60vh", overflowY: "auto", pr: 1 }}>
          <Box sx={{ p: 2, borderRadius: "10px", backgroundColor: "#F8FAFC", border: "1px solid #EAECF0" }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#101828", mb: 0.5 }}>
              1. Scope & Parties
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: "#475467", lineHeight: 1.5 }}>
              This Data Processing Addendum (&quot;DPA&quot;) supplements the Master Services Agreement between ProxiPilot Inc. (&quot;Data Processor&quot;) and Dolphy India Pvt. Ltd. (&quot;Data Controller&quot;). It governs the processing of Personal Data in connection with the autonomous communication and AI intelligence services.
            </Typography>
          </Box>

          <Box sx={{ p: 2, borderRadius: "10px", backgroundColor: "#F8FAFC", border: "1px solid #EAECF0" }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#101828", mb: 0.5 }}>
              2. Technical & Organizational Security Measures (TOMs)
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: "#475467", lineHeight: 1.5 }}>
              • <strong>Encryption:</strong> AES-256 GCM encryption at rest across all databases and vector stores. TLS 1.3 enforced for all transmission.<br />
              • <strong>Zero Foundation Model Training:</strong> ProxiPilot guarantees customer emails and memory facts are never submitted to public LLM training datasets.<br />
              • <strong>Access Controls:</strong> Role-based access control (RBAC), multi-factor authentication (MFA), and audit logging across all customer data operations.
            </Typography>
          </Box>

          <Box sx={{ p: 2, borderRadius: "10px", backgroundColor: "#F8FAFC", border: "1px solid #EAECF0" }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#101828", mb: 0.5 }}>
              3. Data Subject Rights & Breach Notifications
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: "#475467", lineHeight: 1.5 }}>
              ProxiPilot provides self-service export and deletion capabilities. In the unlikely event of a verified security incident impacting Customer Personal Data, ProxiPilot will notify the customer without undue delay and within 48 hours of confirmation.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 2, borderTop: "1px solid #EAECF0", mt: 1 }}>
          <Typography sx={{ fontSize: 12, color: "#64748B" }}>
            Status: Active & Legally Binding
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setIsDpaModalOpen(false)}
              sx={{ textTransform: "none", fontWeight: 600, color: "#475467" }}
            >
              Close
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => {
                toast.success("Downloading signed DPA PDF package...");
                setIsDpaModalOpen(false);
              }}
              startIcon={<IconDownload size={15} />}
              sx={{
                textTransform: "none",
                fontWeight: 700,
                backgroundColor: "#4F46E5",
                borderRadius: "8px",
                px: 2,
                "&:hover": { backgroundColor: "#4338CA" },
              }}
            >
              Download Signed DPA (.pdf)
            </Button>
          </Box>
        </Box>
      </Dialog>

      {/* Subprocessors Directory Modal */}
      <Dialog
        open={isSubprocessorsModalOpen}
        onClose={() => setIsSubprocessorsModalOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: "rgba(16, 24, 40, 0.65)",
              backdropFilter: "blur(6px)",
            },
          },
          paper: {
            sx: {
              borderRadius: "20px",
              p: { xs: 2.5, sm: 3.5 },
              boxShadow: "0px 24px 48px -12px rgba(16, 24, 40, 0.25)",
            },
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, pb: 1.5, borderBottom: "1px solid #EAECF0" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: "10px",
                backgroundColor: "#EEF2FF",
                color: "#4F46E5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconBuildingCommunity size={20} stroke={2} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 17, fontWeight: 700, color: "#101828" }}>
                Authorized Cloud Subprocessors (5 Active)
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#64748B" }}>
                Third-party services engaged by ProxiPilot to provide hosting, database, and isolated LLM inference
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setIsSubprocessorsModalOpen(false)} sx={{ color: "#98A2B3" }}>
            <IconX size={18} />
          </IconButton>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, my: 1, maxHeight: "60vh", overflowY: "auto", pr: 0.5 }}>
          {[
            {
              name: "Amazon Web Services, Inc. (AWS)",
              purpose: "Cloud hosting, PostgreSQL relational database, vector embeddings storage, and AWS KMS hardware key management",
              location: "US East (N. Virginia), EU Central (Frankfurt)",
              cert: "SOC 1/2/3, ISO 27001, FedRAMP",
            },
            {
              name: "OpenAI, LLC",
              purpose: "Enterprise Isolated Foundation Model Inference (Zero Data Retention agreement in place)",
              location: "United States (US East)",
              cert: "SOC 2 Type II, HIPAA",
            },
            {
              name: "Anthropic, PBC",
              purpose: "Claude 3.5 Sonnet / Haiku Enterprise Isolated Inference (Zero Data Retention agreement in place)",
              location: "United States (US West)",
              cert: "SOC 2 Type II, ISO 27001",
            },
            {
              name: "Stripe, Inc.",
              purpose: "Payment card processing, subscription billing lifecycle, and PCI-DSS compliance tokenization",
              location: "Global / United States",
              cert: "PCI-DSS Level 1",
            },
            {
              name: "Cloudflare, Inc.",
              purpose: "Edge DNS routing, DDoS mitigation, Web Application Firewall (WAF), and TLS 1.3 termination",
              location: "Global Edge Network",
              cert: "SOC 2 Type II, ISO 27001",
            },
          ].map((subp, idx) => (
            <Box
              key={idx}
              sx={{
                p: 2,
                borderRadius: "12px",
                border: "1px solid #EAECF0",
                backgroundColor: "#FFFFFF",
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                alignItems: { xs: "flex-start", sm: "center" },
                justifyContent: "space-between",
                gap: 1.5,
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#101828" }}>
                    {subp.name}
                  </Typography>
                  <Chip
                    size="small"
                    label={subp.cert}
                    sx={{
                      height: 18,
                      fontSize: 10,
                      fontWeight: 700,
                      backgroundColor: "#ECFDF5",
                      color: "#059669",
                      border: "1px solid #A7F3D0",
                    }}
                  />
                </Box>
                <Typography sx={{ fontSize: 12.5, color: "#475467", mt: 0.35 }}>
                  {subp.purpose}
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: "#64748B", mt: 0.25 }}>
                  Data Location: {subp.location}
                </Typography>
              </Box>
              <Chip
                label="DPA Verified"
                size="small"
                sx={{
                  backgroundColor: "#EEF2FF",
                  color: "#4F46E5",
                  fontWeight: 600,
                  fontSize: 11,
                  border: "1px solid #C7D7FE",
                  flexShrink: 0,
                }}
              />
            </Box>
          ))}
        </Box>

        <Box sx={{ display: "flex", justifyContent: "flex-end", pt: 2, borderTop: "1px solid #EAECF0", mt: 1 }}>
          <Button
            variant="contained"
            size="small"
            onClick={() => setIsSubprocessorsModalOpen(false)}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              backgroundColor: "#4F46E5",
              borderRadius: "8px",
              px: 2.5,
              "&:hover": { backgroundColor: "#4338CA" },
            }}
          >
            Close
          </Button>
        </Box>
      </Dialog>
    </Box>
  );
}
