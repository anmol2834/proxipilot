/** Time-zone math for the scheduler (pure). Wall time in an IANA zone <-> UTC instant, offsets, labels. */

function partsIn(utcMs: number, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const x of f.formatToParts(new Date(utcMs))) if (x.type !== "literal") p[x.type] = Number(x.value);
  return p;
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
export function offsetMs(utcMs: number, timeZone: string): number {
  try {
    const p = partsIn(utcMs, timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour === 24 ? 0 : p.hour, p.minute, p.second);
    return asUtc - Math.floor(utcMs / 1000) * 1000;
  } catch {
    return 0;
  }
}

/** Wall-clock date ("YYYY-MM-DD") + "HH:MM" in `timeZone` -> UTC epoch ms (DST aware, two passes). */
export function zonedToUtc(date: string, time: string, timeZone: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let utc = guess - offsetMs(guess, timeZone);
  utc = guess - offsetMs(utc, timeZone);
  return utc;
}

/** "GMT+5:30" style label for a zone right now. */
export function offsetLabel(timeZone: string, at = Date.now()): string {
  const off = Math.round(offsetMs(at, timeZone) / 60000);
  const sign = off >= 0 ? "+" : "-";
  const a = Math.abs(off);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `GMT${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

/** Current wall time in a zone, e.g. "10:42 AM". */
export function nowIn(timeZone: string): string {
  try {
    return new Date().toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

/** Legacy IANA aliases some browsers still report, mapped to their canonical names. */
const ALIASES: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata", "Asia/Saigon": "Asia/Ho_Chi_Minh", "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon", "Europe/Kiev": "Europe/Kyiv", "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "Atlantic/Faeroe": "Atlantic/Faroe", "Pacific/Truk": "Pacific/Chuuk", "Asia/Thimbu": "Asia/Thimphu",
  "Asia/Dacca": "Asia/Dhaka", "Asia/Ulan_Bator": "Asia/Ulaanbaatar", "America/Godthab": "America/Nuuk",
};

export function canonicalZone(z: string): string {
  return ALIASES[z] ?? z;
}

export function browserZone(): string {
  try {
    return canonicalZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  } catch {
    return "UTC";
  }
}

export function to24h(hour12: number, minute: number, pm: boolean): string {
  const h = (hour12 % 12) + (pm ? 12 : 0);
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function from24h(hhmm: string): { hour12: number; minute: number; pm: boolean } {
  const [h, m] = hhmm.split(":").map(Number);
  const hh = Number.isFinite(h) ? h : 10;
  return { hour12: hh % 12 === 0 ? 12 : hh % 12, minute: Number.isFinite(m) ? m : 0, pm: hh >= 12 };
}

export function longDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function shortDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
}
