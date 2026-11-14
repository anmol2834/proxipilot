export const APP_CONFIG = {
  name: "ProxiPilot",
  version: "0.1.0",
  description: "Autonomous AI-powered communication and workflow proxy for modern enterprises",
  author: "ProxiPilot Inc.",
  supportEmail: "hello@proxipilot.com",

  pagination: {
    defaultPage: 1,
    defaultLimit: 20,
    maxLimit: 100,
  },

  timeouts: {
    apiRequest: 30000,
    toastDismiss: 5000,
    debounceSearch: 300,
  },

  storageKeys: {
    themeMode: "proxipilot_theme_mode",
    sidebarCollapsed: "proxipilot_sidebar_collapsed",
    activeWorkspaceId: "proxipilot_active_workspace_id",
    authToken: "proxipilot_auth_token",
  },

  headerKeys: {
    tenantId: "x-tenant-id",
    authorization: "authorization",
    requestId: "x-request-id",
  },
} as const;
