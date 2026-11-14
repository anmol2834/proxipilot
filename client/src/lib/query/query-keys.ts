/**
 * Centralized Query Keys Factory
 * Single source of truth for query cache invalidation, prefetching, and query keys across domains.
 */
export const queryKeys = {
  auth: {
    all: ["auth"] as const,
    session: () => [...queryKeys.auth.all, "session"] as const,
    user: () => [...queryKeys.auth.all, "me"] as const,
    onboarding: (organizationId?: string) =>
      organizationId
        ? ([...queryKeys.auth.all, "onboarding", organizationId] as const)
        : ([...queryKeys.auth.all, "onboarding"] as const),
    permissions: (organizationId?: string) =>
      organizationId
        ? ([...queryKeys.auth.all, "permissions", organizationId] as const)
        : ([...queryKeys.auth.all, "permissions"] as const),
  },
  tenant: {
    all: ["tenant"] as const,
    current: () => [...queryKeys.tenant.all, "current"] as const,
    list: () => [...queryKeys.tenant.all, "list"] as const,
    detail: (organizationId: string) => [...queryKeys.tenant.all, organizationId] as const,
    members: (organizationId: string) => [...queryKeys.tenant.all, organizationId, "members"] as const,
    businessProfile: (organizationId: string) =>
      [...queryKeys.tenant.all, organizationId, "business-profile"] as const,
    preferences: (organizationId: string) =>
      [...queryKeys.tenant.all, organizationId, "preferences"] as const,
  },
  inbox: {
    all: ["inbox"] as const,
    byTenant: (organizationId?: string) =>
      organizationId ? ([...queryKeys.inbox.all, organizationId] as const) : queryKeys.inbox.all,
    lists: (organizationId?: string) => [...queryKeys.inbox.byTenant(organizationId), "list"] as const,
    list: (organizationId?: string, filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.inbox.lists(organizationId), filters] as const)
        : queryKeys.inbox.lists(organizationId),
    details: (organizationId?: string) =>
      [...queryKeys.inbox.byTenant(organizationId), "detail"] as const,
    detail: (id: string, organizationId?: string) =>
      [...queryKeys.inbox.details(organizationId), id] as const,
    threads: (id: string, organizationId?: string) =>
      [...queryKeys.inbox.details(organizationId), id, "threads"] as const,
  },
  automation: {
    all: ["automation"] as const,
    byTenant: (organizationId: string) => [...queryKeys.automation.all, organizationId] as const,
    lists: (organizationId: string) => [...queryKeys.automation.byTenant(organizationId), "list"] as const,
    list: (organizationId: string, filters: Record<string, unknown>) =>
      [...queryKeys.automation.lists(organizationId), filters] as const,
    detail: (organizationId: string, id: string) =>
      [...queryKeys.automation.byTenant(organizationId), "detail", id] as const,
    executions: (organizationId: string, id: string) =>
      [...queryKeys.automation.byTenant(organizationId), "detail", id, "executions"] as const,
  },
  knowledge: {
    all: ["knowledge"] as const,
    byTenant: (organizationId: string) => [...queryKeys.knowledge.all, organizationId] as const,
    collections: (organizationId: string) =>
      [...queryKeys.knowledge.byTenant(organizationId), "collections"] as const,
    collection: (organizationId: string, id: string) =>
      [...queryKeys.knowledge.byTenant(organizationId), "collection", id] as const,
    documents: (organizationId: string, collectionId: string) =>
      [...queryKeys.knowledge.byTenant(organizationId), collectionId, "documents"] as const,
  },
  analytics: {
    all: ["analytics"] as const,
    byTenant: (organizationId: string) => [...queryKeys.analytics.all, organizationId] as const,
    overview: (organizationId: string, timeframe: string) =>
      [...queryKeys.analytics.byTenant(organizationId), "overview", timeframe] as const,
    metrics: (organizationId: string, filters: Record<string, unknown>) =>
      [...queryKeys.analytics.byTenant(organizationId), "metrics", filters] as const,
  },
  integrations: {
    all: ["integrations"] as const,
    byTenant: (organizationId: string) => [...queryKeys.integrations.all, organizationId] as const,
    list: (organizationId: string) =>
      [...queryKeys.integrations.byTenant(organizationId), "list"] as const,
    detail: (organizationId: string, id: string) =>
      [...queryKeys.integrations.byTenant(organizationId), "detail", id] as const,
    status: (organizationId: string, provider: string) =>
      [...queryKeys.integrations.byTenant(organizationId), "status", provider] as const,
  },
  billing: {
    all: ["billing"] as const,
    byTenant: (organizationId: string) => [...queryKeys.billing.all, organizationId] as const,
    subscription: (organizationId: string) =>
      [...queryKeys.billing.byTenant(organizationId), "subscription"] as const,
    invoices: (organizationId: string) =>
      [...queryKeys.billing.byTenant(organizationId), "invoices"] as const,
    usage: (organizationId: string) =>
      [...queryKeys.billing.byTenant(organizationId), "usage"] as const,
  },
  settings: {
    all: ["settings"] as const,
    byTenant: (organizationId: string) => [...queryKeys.settings.all, organizationId] as const,
    general: (organizationId: string) =>
      [...queryKeys.settings.byTenant(organizationId), "general"] as const,
    security: (organizationId: string) =>
      [...queryKeys.settings.byTenant(organizationId), "security"] as const,
    notifications: (organizationId: string) =>
      [...queryKeys.settings.byTenant(organizationId), "notifications"] as const,
  },
} as const;
