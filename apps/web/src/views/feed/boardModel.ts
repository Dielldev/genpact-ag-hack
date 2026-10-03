import type { FeedItem } from "@mesh/server/api";
import { minutesSince, type Tone } from "../../format";
import { toneFor } from "./filters";

export type ColumnId = "progress" | "blocked" | "done";

export interface PersonCard {
  person: string;
  tone: Tone;
  lead: FeedItem;
  others: FeedItem[];
}

export interface BoardColumn {
  id: ColumnId;
  label: string;
  cards: PersonCard[];
}

const COLUMN_OF: Record<Tone, ColumnId> = {
  progress: "progress",
  active: "progress",
  stuck: "blocked",
  blocked: "blocked",
  done: "done",
};

const COLUMN_LABEL: Record<ColumnId, string> = {
  progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

export const COLUMN_IDS: ColumnId[] = ["progress", "blocked", "done"];

export const LIVE_WITHIN_MINUTES = 5;

const byRecent = (a: FeedItem, b: FeedItem) => Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at);

function cardFor(person: string, items: FeedItem[], now: number): PersonCard {
  const sorted = [...items].sort(byRecent);
  const lead = sorted.find((i) => toneFor(i, now) !== "done") ?? sorted[0]!;
  return { person, tone: toneFor(lead, now), lead, others: sorted.filter((i) => i !== lead) };
}

export function buildBoard(items: FeedItem[], now: number): BoardColumn[] {
  const byPerson = new Map<string, FeedItem[]>();
  for (const item of items) byPerson.set(item.person, [...(byPerson.get(item.person) ?? []), item]);
  const cards = [...byPerson].map(([person, list]) => cardFor(person, list, now));
  return COLUMN_IDS.map((id) => ({
    id,
    label: COLUMN_LABEL[id],
    cards: cards
      .filter((c) => COLUMN_OF[c.tone] === id)
      .sort((a, b) => Number(b.tone === "stuck") - Number(a.tone === "stuck") || byRecent(a.lead, b.lead)),
  }));
}

export function isLive(card: PersonCard, now: number): boolean {
  return card.tone !== "done" && minutesSince(card.lead.last_seen_at, now) <= LIVE_WITHIN_MINUTES;
}

export function leadVerb(card: PersonCard): string {
  if (card.tone === "done") return "finished";
  if (card.tone === "stuck") return "has been stuck on";
  if (card.tone === "blocked") return "is blocked on";
  if (card.lead.task === null) return "has an open session";
  return "is working on";
}

export function troubled(items: FeedItem[], now: number): number {
  return items.filter((i) => {
    const tone = toneFor(i, now);
    return tone === "blocked" || tone === "stuck";
  }).length;
}
