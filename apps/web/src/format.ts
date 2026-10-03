import { ReportStatus } from "@mesh/contract";

export const STUCK_AFTER_MINUTES = Number(import.meta.env.VITE_STUCK_AFTER_MINUTES ?? 60);

export function minutesSince(iso: string | null | undefined, now: number): number {
  if (!iso) return 0;
  return Math.max(0, (now - Date.parse(iso)) / 60_000);
}

export function duration(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`.replace(/ 0m$/, "");
  return `${Math.floor(minutes / 1440)}d`;
}

export function ago(iso: string | null | undefined, now: number): string {
  if (!iso) return "never";
  const m = minutesSince(iso, now);
  return m < 1 ? "just now" : `${duration(m)} ago`;
}

export function day(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export type Tone = "progress" | "blocked" | "stuck" | "done" | "active";

export function toneOf(status: ReportStatus | null, statusSince: string | null, now: number): Tone {
  if (!status) return "active";
  if (status === ReportStatus.done) return "done";
  if (status === ReportStatus.blocked) return minutesSince(statusSince, now) > STUCK_AFTER_MINUTES ? "stuck" : "blocked";
  return "progress";
}

export const STATUS_LABEL: Record<Tone, string> = {
  progress: "In progress",
  blocked: "Blocked",
  stuck: "Stuck",
  done: "Done",
  active: "Active",
};

export function statusLine(status: ReportStatus | null, statusSince: string | null, lastSeen: string, now: number): string {
  const tone = toneOf(status, statusSince, now);
  if (tone === "active") return `active, last seen ${ago(lastSeen, now)}`;
  const since = duration(minutesSince(statusSince, now));
  if (tone === "done") return `done ${ago(statusSince, now)}`;
  return `${tone === "progress" ? "in progress" : "blocked"} for ${since}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
