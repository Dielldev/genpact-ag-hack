import { ReportStatus } from "@mesh/contract";
import type { StatusTone } from "../api/blocks.js";
import type { EventRecord } from "../api/types.js";

export const STUCK_AFTER_MINUTES = 60;

const DAY_MS = 86_400_000;

export const PERIODS = ["today", "yesterday", "week", "two_weeks", "month"] as const;
export type Period = (typeof PERIODS)[number];

export interface PeriodRange {
  period: Period;
  label: string;
  since: Date;
  until: Date;
  days: number;
  hourly: boolean;
}

const LABELS: Record<Period, string> = {
  today: "today",
  yesterday: "yesterday",
  week: "the last 7 days",
  two_weeks: "the last 14 days",
  month: "the last 30 days",
};

const SPAN_DAYS: Record<Period, number> = { today: 1, yesterday: 1, week: 7, two_weeks: 14, month: 30 };

export function startOfDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function periodRange(period: Period, now: Date): PeriodRange {
  const today = startOfDay(now);
  const days = SPAN_DAYS[period];
  const since = period === "yesterday" ? new Date(today.getTime() - DAY_MS) : new Date(today.getTime() - (days - 1) * DAY_MS);
  const until = period === "yesterday" ? today : new Date(today.getTime() + DAY_MS);
  return { period, label: LABELS[period], since, until, days, hourly: days === 1 };
}

export function previousRange(range: PeriodRange): PeriodRange {
  const span = range.until.getTime() - range.since.getTime();
  return { ...range, since: new Date(range.since.getTime() - span), until: range.since };
}

export function inRange(e: EventRecord, range: PeriodRange): boolean {
  return Date.parse(e.first_seen_at) < range.until.getTime() && Date.parse(e.last_seen_at) >= range.since.getTime();
}

export function minutesSince(iso: string | null, now: Date): number {
  if (!iso) return 0;
  return Math.max(0, (now.getTime() - Date.parse(iso)) / 60_000);
}

export function toneOf(e: Pick<EventRecord, "status" | "status_since">, now: Date): StatusTone {
  if (!e.status) return "active";
  if (e.status === ReportStatus.done) return "done";
  if (e.status === ReportStatus.blocked) return minutesSince(e.status_since, now) > STUCK_AFTER_MINUTES ? "stuck" : "blocked";
  return "progress";
}

export function isBlockedTone(tone: StatusTone): boolean {
  return tone === "blocked" || tone === "stuck";
}

export function dayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}
