const MINUTE = 60_000;
const TIME_KEYS = ["first_seen_at", "last_seen_at", "last_report_at", "status_since", "ts", "created_at"];

function back(value: unknown, minutes: number): unknown {
  if (typeof value !== "string") return value;
  return new Date(Date.parse(value) - minutes * MINUTE).toISOString();
}

export function backdate<T>(node: T, minutes: number): T {
  if (Array.isArray(node)) return node.map((n) => backdate(n, minutes)) as T;
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) out[k] = TIME_KEYS.includes(k) ? back(v, minutes) : backdate(v, minutes);
  return out as T;
}

export const minutesFor = (key: number | string): number => (Number(key) * 97 + 13) % 1320;
