/**
 * Dashboard overview service: every number on the overview screen comes from
 * GET /dashboard/overview, computed by the server from the organization's own data.
 * A metric without data is `null` and must be rendered as "—", never as a made-up value.
 */
import { apiClient } from "@/lib/api/client";

export type ActivityStatus = "replied" | "draft_ready" | "sending" | "needs_reply" | "awaiting_ai";

export interface DashboardOverview {
  window_days: number;
  generated_at: string;
  inbound: { count: number; previous: number; change_pct: number | null };
  ai: {
    drafts_generated: number;
    replies_sent: number;
    auto_sent: number;
    reply_coverage_pct: number | null;
    approval_rate: number | null;
    edit_rate: number | null;
    drafts_reviewed: number;
    avg_processing_seconds: number | null;
    model: string | null;
  };
  needs_attention: { pending_review: number };
  response_time: { avg_first_reply_minutes: number | null; replied_conversations: number };
  workspace: { knowledge_items: number; mailboxes: number };
  /** Setup state of the business's own knowledge (server rule: Products & Services + at least 2 categories). */
  knowledge?: {
    by_category: Record<string, number>;
    user_items: number;
    categories_with_data: string[];
    required_category: string;
    has_required_category: boolean;
    min_categories: number;
    ready: boolean;
    next_step: "add_products_services" | "add_another_category" | null;
  };
  recent_activity: Array<{
    thread_id: string;
    subject: string;
    contact: string | null;
    at: string | null;
    status: ActivityStatus;
  }>;
}

export const dashboardService = {
  async getOverview(days = 7): Promise<DashboardOverview> {
    return (await apiClient.get<DashboardOverview>("/dashboard/overview", { params: { days } })).data;
  },
};
