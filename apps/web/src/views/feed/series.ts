export interface Period {
  id: string;
  label: string;
  ms: number;
}

const HOUR = 3_600_000;

export const PERIODS: Period[] = [
  { id: "6h", label: "Last 6 hours", ms: 6 * HOUR },
  { id: "24h", label: "Last 24 hours", ms: 24 * HOUR },
  { id: "7d", label: "Last 7 days", ms: 7 * 24 * HOUR },
  { id: "30d", label: "Last 30 days", ms: 30 * 24 * HOUR },
];

export const SLOTS = 12;

function label(start: number, step: number): string {
  const d = new Date(start);
  if (step >= 24 * HOUR) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (step >= HOUR) return d.toLocaleTimeString("en-US", { hour: "numeric" }).replace(" ", "");
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(/ [AP]M/, "");
}

export interface Series {
  counts: number[];
  labels: string[];
}

export function series(times: string[], now: number, period: Period): Series {
  const step = period.ms / SLOTS;
  const origin = now - period.ms;
  const counts = Array<number>(SLOTS).fill(0);
  for (const iso of times) {
    const t = Date.parse(iso);
    if (Number.isNaN(t) || t < origin || t > now) continue;
    const i = Math.min(SLOTS - 1, Math.floor((t - origin) / step));
    counts[i] = (counts[i] ?? 0) + 1;
  }
  return { counts, labels: counts.map((_, i) => label(origin + i * step, step)) };
}

export interface Trend {
  text: string;
  dir: "up" | "down" | "flat";
}

export function trend(counts: number[]): Trend {
  const last = counts[counts.length - 1] ?? 0;
  const prev = counts[counts.length - 2] ?? 0;
  if (last === prev) return { text: "0%", dir: "flat" };
  if (prev === 0) return { text: `+${last}`, dir: "up" };
  const pct = Math.round(((last - prev) / prev) * 100);
  return { text: `${pct > 0 ? "+" : ""}${pct}%`, dir: pct > 0 ? "up" : "down" };
}

export function peak(counts: number[]): number {
  const max = Math.max(...counts);
  return max === 0 ? counts.length - 1 : counts.lastIndexOf(max);
}

export function smooth(points: Array<[number, number]>): string {
  const first = points[0];
  if (!first) return "";
  let d = `M${first[0]},${first[1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}
