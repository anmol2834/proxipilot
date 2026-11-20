/** Conversation intelligence & follow-ups — API contracts (mirrors server/app/api/v1/routes/followups.py). */

export type FollowupTemperature = "hot" | "warm" | "cold" | "unknown";
export type FollowupStatus =
  | "none"
  | "open"
  | "scheduled"
  | "deferred"
  | "waiting_team"
  | "needs_review"
  | "closed"
  | "suppressed"
  | "stopped";

export interface FollowupOccurrenceDTO {
  id: string;
  origin: "ai" | "customer_date" | "cadence" | "user";
  status: "scheduled" | "cancelled" | "superseded" | "done" | "held";
  due_at: string | null;
  due_local: string | null;
  notice_at: string | null;
  notice_local: string | null;
  advance_status: string;
  due_notice_status: string;
  customer_status: string;
  hold_reason: string | null;
  reason: string | null;
  step: number;
  notices: Record<string, Record<string, number>>;
}

export interface FollowupHistoryDTO {
  id: string;
  message_id: string;
  created_at: string | null;
  status: string;
  temperature: FollowupTemperature | null;
  decision: string | null;
  outcome: string | null;
  next_actor: string | null;
  explanation: string | null;
  applied: boolean;
  not_applied_reason: string | null;
}

export interface ThreadFollowup {
  thread_id: string;
  revision: number;
  version: number;
  temperature: {
    effective: FollowupTemperature | null;
    suggested: FollowupTemperature | null;
    source: "ai" | "manual" | "legacy" | null;
    reason: string | null;
    label_confidence: number | null;
    buying_interest: number | null;
  };
  status: FollowupStatus;
  outcome: string | null;
  decision: string | null;
  next_actor: string | null;
  next_action: string | null;
  opportunities: { key: string; subject: string; status: string; temperature: string }[];
  due: {
    at: string | null;
    local: string | null;
    timezone: string | null;
    precision: string | null;
    source: string | null;
    phrase: string | null;
  };
  notice: { at: string | null; local: string | null };
  needs_review: boolean;
  review_reason: string | null;
  stale: boolean;
  stale_reason: string | null;
  attempts_used: number;
  controls: {
    assessment_enabled: boolean;
    assessment_override: boolean | null;
    planning_enabled: boolean;
    planning_override: boolean | null;
    customer_email_enabled: boolean;
    customer_recipient_email: string | null;
    manual_temperature: FollowupTemperature | null;
    manual_due_at: string | null;
    manual_due_local: string | null;
    manual_interval_days: number | null;
    manual_max_attempts: number | null;
    manual_notice_days: number | null;
    snoozed_until: string | null;
    completed: boolean;
  };
  participants: string[];
  suppressions: { id: string; recipient_email: string; scope: string; until_at: string | null; quote: string | null }[];
  capabilities: {
    customer_email_supported: boolean;
    mailbox_automation_enabled: boolean;
    customer_send_globally_enabled: boolean;
    reminders_enabled: boolean;
    can_edit: boolean;
    can_send: boolean;
    can_manage_settings: boolean;
    workspace_timezone: string;
  };
  occurrences: FollowupOccurrenceDTO[];
  history: FollowupHistoryDTO[];
}

export interface FollowupControlsPatch {
  version: number;
  assessment_enabled?: boolean | null;
  planning_enabled?: boolean | null;
  customer_email_enabled?: boolean;
  customer_recipient_email?: string | null;
  manual_temperature?: FollowupTemperature | null;
  completed?: boolean;
  snoozed_until?: string | null;
  manual_interval_days?: number | null;
  manual_max_attempts?: number | null;
  manual_notice_days?: number | null;
}

export interface FollowupPolicy {
  version: number;
  assessment_enabled: boolean;
  planning_enabled: boolean;
  cadence_hot_days: number;
  cadence_warm_days: number;
  cadence_cold_days: number;
  workdays: number[];
  send_window_start: string;
  send_window_end: string;
  default_local_time: string;
  advance_notice_days: number;
  max_attempts: number;
  min_spacing_hours: number;
  timezone: string | null;
  effective_timezone: string;
}

export type LeadFilter =
  | "active"
  | "open_unconfirmed"
  | "scheduled"
  | "due"
  | "deferred"
  | "waiting_team"
  | "needs_review"
  | "closed";

export interface LeadItem {
  thread_id: string;
  subject: string | null;
  sender_name: string | null;
  sender_email: string | null;
  latest_message_at: string | null;
  temperature: FollowupTemperature | null;
  temperature_source: string | null;
  status: FollowupStatus;
  outcome: string | null;
  next_actor: string | null;
  next_action: string | null;
  due_at: string | null;
  due_local: string | null;
  notice_at: string | null;
  needs_review: boolean;
  review_reason: string | null;
  stale: boolean;
}

export interface LeadsResponse {
  filter: LeadFilter;
  page: number;
  page_size: number;
  total: number;
  counts: Record<LeadFilter, number>;
  items: LeadItem[];
}
