import type { FeedItem, WarningCard } from "@mesh/server/api";
import { toneOf, type Tone } from "../../format";

export type TileId = "all" | "progress" | "blocked" | "stuck" | "done" | "collisions";

export const TONE_ORDER: Tone[] = ["stuck", "blocked", "progress", "active", "done"];

export function toneFor(item: FeedItem, now: number): Tone {
  return toneOf(item.status, item.status_since, now);
}

export function warningsFor(item: FeedItem, warnings: WarningCard[]): WarningCard[] {
  return warnings.filter((w) => w.reporter.session_pk === item.session_pk || w.sources.some((s) => s.session_pk === item.session_pk));
}

export function passes(tile: TileId, item: FeedItem, now: number, warnings: WarningCard[]): boolean {
  const tone = toneFor(item, now);
  if (tile === "all") return true;
  if (tile === "blocked") return tone === "blocked" || tone === "stuck";
  if (tile === "collisions") return warningsFor(item, warnings).some((w) => w.kind === "collision");
  return tone === tile;
}

export interface Group {
  tone: Tone;
  items: FeedItem[];
}

export function groupItems(items: FeedItem[], now: number): Group[] {
  const sorted = [...items].sort((a, b) => Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at));
  return TONE_ORDER.map((tone) => ({ tone, items: sorted.filter((i) => toneFor(i, now) === tone) })).filter((g) => g.items.length > 0);
}
