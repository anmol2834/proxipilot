/** Shared labels, colours and time helpers for the follow-up UI (no React). */

export const FU = {
  primary: "#2563EB",
  text: "#0F172A",
  body: "#334155",
  muted: "#64748B",
  faint: "#94A3B8",
  border: "#E2E8F0",
  soft: "#F8FAFC",
  danger: "#DC2626",
  warn: "#B45309",
  ok: "#047857",
} as const;

type Tone = { label: string; fg: string; bg: string; hint: string };

export const STATUS: Record<string, Tone> = {
  none: { label: "No follow-up", fg: "#475569", bg: "#F1F5F9", hint: "Nothing to follow up right now." },
  open: { label: "Open · unconfirmed", fg: "#0369A1", bg: "#E0F2FE", hint: "Genuine interest; purchase or completion not confirmed yet." },
  scheduled: { label: "Scheduled", fg: "#1D4ED8", bg: "#DBEAFE", hint: "A follow-up is planned." },
  deferred: { label: "Deferred", fg: "#6D28D9", bg: "#EDE9FE", hint: "The customer asked for a later window." },
  waiting_team: { label: "Team owes reply", fg: "#B45309", bg: "#FEF3C7", hint: "Your team owes the next step." },
  needs_review: { label: "Needs review", fg: "#B91C1C", bg: "#FEE2E2", hint: "Unclear date, scope or identity — a person should decide." },
  closed: { label: "Closed", fg: "#047857", bg: "#D1FAE5", hint: "Completed or declined." },
  suppressed: { label: "Do not contact", fg: "#991B1B", bg: "#FEE2E2", hint: "The customer asked not to be contacted." },
  stopped: { label: "Planning paused", fg: "#475569", bg: "#E2E8F0", hint: "Automatic follow-up planning is paused for this conversation." },
};

export const TEMPERATURE: Record<string, { label: string; fg: string; bg: string; border: string }> = {
  hot: { label: "Hot", fg: "#DC2626", bg: "#FEF2F2", border: "#FCA5A5" },
  warm: { label: "Warm", fg: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  cold: { label: "Cold", fg: "#0284C7", bg: "#F0F9FF", border: "#BAE6FD" },
  unknown: { label: "Unknown", fg: "#64748B", bg: "#F8FAFC", border: "#E2E8F0" },
};

export const SOURCE: Record<string, string> = {
  ai: "AI",
  manual: "Set by your team",
  legacy: "Earlier label",
};

export const DUE_SOURCE: Record<string, string> = {
  customer_date: "Customer's date",
  ai: "AI-suggested window",
  cadence: "Workspace cadence",
  user: "Scheduled by your team",
};

export const ACTOR: Record<string, string> = {
  customer: "Customer",
  team: "Your team",
  third_party: "Third party",
  unclear: "Unclear",
};

export const CUSTOMER_STATUS: Record<string, { label: string; tone: "muted" | "ok" | "warn" | "danger" | "info" }> = {
  not_applicable: { label: "Reminder only — customer not emailed", tone: "muted" },
  pending: { label: "Will email after final safety checks", tone: "info" },
  sending: { label: "Sending…", tone: "info" },
  sent: { label: "Customer emailed", tone: "ok" },
  held: { label: "Customer email held", tone: "warn" },
  failed: { label: "Customer email not delivered", tone: "danger" },
  unknown: { label: "Delivery being verified", tone: "warn" },
};

export const DECISION: Record<string, string> = {
  schedule: "Follow up",
  defer: "Follow up later",
  wait_team: "Team owes the next step",
  none: "No follow-up needed",
  suppress: "Stop contacting",
  needs_review: "Needs a person to decide",
};

export function humanize(v: string | null | undefined): string {
  if (!v) return "—";
  const s = v.replace(/_/g, " ").replace(/:/g, ": ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function cap(v: string | null | undefined): string {
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : "";
}

/** "in 3 days", "2 h overdue", "in 45 min". */
export function relative(iso: string | null | undefined, now = Date.now()): { text: string; overdue: boolean } | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const diff = t - now;
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60000);
  const hrs = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const span = min < 60 ? `${min} min` : hrs < 36 ? `${hrs} h` : `${days} day${days === 1 ? "" : "s"}`;
  return diff >= 0 ? { text: `in ${span}`, overdue: false } : { text: `${span} overdue`, overdue: true };
}

/** Format an instant in a given IANA zone, e.g. "Tue 15 Dec, 15:00". */
export function inZone(iso: string | null | undefined, timeZone: string, withYear = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleString("en-GB", {
      timeZone, weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      ...(withYear ? { year: "numeric" } : {}),
    });
  } catch {
    return d.toLocaleString();
  }
}

/** Today's date (YYYY-MM-DD) and weekday (0 = Monday) in a zone. */
export function todayIn(timeZone: string): { date: string; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
    .formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  return { date: `${get("year")}-${get("month")}-${get("day")}`, weekday: wd < 0 ? 0 : wd };
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Add business days (workdays use Monday = 0). */
export function addBusinessDays(date: string, n: number, workdays: number[] = [0, 1, 2, 3, 4]): string {
  let d = date;
  let left = n;
  let guard = 0;
  while (left > 0 && guard < 60) {
    d = addDays(d, 1);
    const wd = (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7;
    if (workdays.includes(wd)) left -= 1;
    guard += 1;
  }
  return d;
}

export function nextWeekday(date: string, target: number): string {
  let d = addDays(date, 1);
  for (let i = 0; i < 7; i += 1) {
    if ((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7 === target) return d;
    d = addDays(d, 1);
  }
  return d;
}

export function timeZones(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (fn) return fn("timeZone");
  } catch {
    /* ignore */
  }
  return ["UTC", "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "Europe/Paris", "America/New_York",
    "America/Chicago", "America/Los_Angeles", "Australia/Sydney"];
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
