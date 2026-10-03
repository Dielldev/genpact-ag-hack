export const RUN_HOUR = 9;

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const DEFAULT_DAY = 1;

export const isDay = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6;

export function slotOf(now: number, day: number): Date {
  const slot = new Date(now);
  slot.setHours(RUN_HOUR, 0, 0, 0);
  slot.setDate(slot.getDate() - ((slot.getDay() - day + 7) % 7));
  if (slot.getTime() > now) slot.setDate(slot.getDate() - 7);
  return slot;
}

export function nextSlot(now: number, day: number): Date {
  const slot = slotOf(now, day);
  slot.setDate(slot.getDate() + 7);
  return slot;
}

export const slotId = (slot: Date): string => `${slot.getFullYear()}-${slot.getMonth() + 1}-${slot.getDate()}`;

export function whenLabel(slot: Date): string {
  return slot.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function rangeLabel(endMs: number): string {
  const fmt = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(endMs - 7 * 24 * 3_600_000)} – ${fmt(endMs)}`;
}
