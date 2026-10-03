import type { SessionRow, StatusTone } from "../api/blocks.js";
import type { EventRecord } from "../api/types.js";
import { clip, keywords, normText, stem } from "../text.js";
import { dayLabel, hourLabel, inRange, isBlockedTone, minutesSince, startOfDay, toneOf, type PeriodRange } from "./time.js";

const DAY_MS = 86_400_000;

export interface Tallies {
  total: number;
  done: number;
  in_progress: number;
  blocked: number;
  stuck: number;
  active: number;
  people: number;
}

export interface PersonTally {
  person: string;
  sessions: number;
  done: number;
  in_progress: number;
  blocked: number;
  stuck: number;
  minutes_blocked: number;
  modules: string[];
  done_event_id: string | null;
  last_event_id: string | null;
  last_seen_at: string;
}

export interface BlockerRow {
  person: string;
  task: string | null;
  blocker: string;
  minutes: number;
  stuck: boolean;
  ticket_ref: string | null;
  event_id: string | null;
}

export interface BlockerGroup {
  text: string;
  count: number;
  people: string[];
}

export const idOf = (e: EventRecord): string | null => e.event_id;

export function sessionRow(e: EventRecord, now: Date): SessionRow {
  return {
    event_id: e.event_id,
    session_pk: e.session_pk,
    person: e.person,
    task: e.task,
    summary: e.summary ? clip(e.summary, 240) : null,
    status: toneOf(e, now),
    ticket_ref: e.ticket_ref,
    modules: e.modules,
    last_seen_at: e.last_seen_at,
  };
}

export function inPeriod(events: EventRecord[], range: PeriodRange): EventRecord[] {
  return events.filter((e) => inRange(e, range));
}

export function tallyStatuses(events: EventRecord[], now: Date): Tallies {
  const out: Tallies = { total: events.length, done: 0, in_progress: 0, blocked: 0, stuck: 0, active: 0, people: new Set(events.map((e) => e.person)).size };
  for (const e of events) {
    const tone = toneOf(e, now);
    if (tone === "done") out.done++;
    else if (tone === "progress") out.in_progress++;
    else if (tone === "blocked") out.blocked++;
    else if (tone === "stuck") out.stuck++;
    else out.active++;
  }
  return out;
}

export function tallyPeople(events: EventRecord[], now: Date): PersonTally[] {
  const byPerson = new Map<string, PersonTally>();
  for (const e of events) {
    const t =
      byPerson.get(e.person) ??
      ({ person: e.person, sessions: 0, done: 0, in_progress: 0, blocked: 0, stuck: 0, minutes_blocked: 0, modules: [], done_event_id: null, last_event_id: null, last_seen_at: e.last_seen_at } as PersonTally);
    t.sessions++;
    const tone: StatusTone = toneOf(e, now);
    if (tone === "done") {
      t.done++;
      t.done_event_id ??= idOf(e);
    } else if (tone === "progress") t.in_progress++;
    else if (isBlockedTone(tone)) {
      t.blocked++;
      if (tone === "stuck") t.stuck++;
      t.minutes_blocked += Math.round(minutesSince(e.status_since, now));
    }
    t.modules = [...new Set([...t.modules, ...e.modules])];
    if (e.last_seen_at >= t.last_seen_at) {
      t.last_seen_at = e.last_seen_at;
      t.last_event_id = idOf(e);
    }
    byPerson.set(e.person, t);
  }
  return [...byPerson.values()];
}

export function topPerformers(tallies: PersonTally[]): PersonTally[] {
  return tallies
    .filter((t) => t.done > 0)
    .sort((a, b) => b.done - a.done || b.in_progress - a.in_progress || a.person.localeCompare(b.person));
}

export function mostBlocked(tallies: PersonTally[]): PersonTally[] {
  return tallies
    .filter((t) => t.blocked > 0)
    .sort((a, b) => b.minutes_blocked - a.minutes_blocked || b.blocked - a.blocked || a.person.localeCompare(b.person));
}

function blockerText(e: EventRecord): string {
  const first = e.blockers.find((b) => b.trim().length > 0);
  return clip(first ?? e.summary ?? e.task ?? "Blocked", 200);
}

export function blockerRows(events: EventRecord[], now: Date): BlockerRow[] {
  const best = new Map<string, BlockerRow>();
  for (const e of events) {
    const tone = toneOf(e, now);
    if (!isBlockedTone(tone)) continue;
    const text = blockerText(e);
    const row: BlockerRow = {
      person: e.person,
      task: e.task,
      blocker: text,
      minutes: Math.round(minutesSince(e.status_since, now)),
      stuck: tone === "stuck",
      ticket_ref: e.ticket_ref,
      event_id: idOf(e),
    };
    const key = `${e.person}|${normText(text)}`;
    const known = best.get(key);
    if (!known || row.minutes > known.minutes) best.set(key, row);
  }
  return [...best.values()].sort((a, b) => b.minutes - a.minutes || a.person.localeCompare(b.person));
}

function termSet(text: string): Set<string> {
  return new Set(keywords(text, 40).map(stem));
}

function similar(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared++;
  return shared / (a.size + b.size - shared) >= 0.6;
}

export function groupTexts(items: Array<{ text: string; person: string }>): BlockerGroup[] {
  const groups: Array<BlockerGroup & { terms: Set<string> }> = [];
  for (const item of items) {
    const terms = termSet(item.text);
    const hit = groups.find((g) => normText(g.text) === normText(item.text) || similar(g.terms, terms));
    if (hit) {
      hit.count++;
      if (!hit.people.includes(item.person)) hit.people.push(item.person);
    } else groups.push({ text: item.text, count: 1, people: [item.person], terms });
  }
  return groups
    .map(({ terms: _terms, ...g }) => g)
    .sort((a, b) => b.count - a.count || b.people.length - a.people.length || a.text.localeCompare(b.text));
}

export function groupBlockers(events: EventRecord[], now: Date): BlockerGroup[] {
  const items = events
    .filter((e) => isBlockedTone(toneOf(e, now)))
    .flatMap((e) => (e.blockers.length ? e.blockers : [blockerText(e)]).map((text) => ({ text: clip(text, 200), person: e.person })));
  return groupTexts(items);
}

export function moduleCounts(events: EventRecord[], limit = 8): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>();
  for (const e of events) for (const m of new Set(e.modules)) counts.set(m, (counts.get(m) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export function timelineBuckets(events: EventRecord[], range: PeriodRange, now: Date): Array<{ label: string; count: number }> {
  const stamps = events.map((e) => Date.parse(e.last_seen_at)).filter((t) => t >= range.since.getTime() && t < range.until.getTime());
  if (stamps.length === 0) return [];
  if (range.hourly) {
    const counts = new Map<number, number>();
    for (const t of stamps) counts.set(new Date(t).getUTCHours(), (counts.get(new Date(t).getUTCHours()) ?? 0) + 1);
    const hours = [...counts.keys()];
    const last = startOfDay(now).getTime() === range.since.getTime() ? Math.max(now.getUTCHours(), ...hours) : Math.max(...hours);
    const out: Array<{ label: string; count: number }> = [];
    for (let h = Math.min(...hours); h <= last; h++) out.push({ label: hourLabel(h), count: counts.get(h) ?? 0 });
    return out;
  }
  const out: Array<{ label: string; count: number }> = [];
  for (let i = 0; i < range.days; i++) {
    const from = range.since.getTime() + i * DAY_MS;
    if (from > now.getTime()) break;
    out.push({ label: dayLabel(new Date(from)), count: stamps.filter((t) => t >= from && t < from + DAY_MS).length });
  }
  return out;
}

export function deltaHint(current: number, previous: number, range: PeriodRange): string {
  const span = range.days === 1 ? (range.period === "yesterday" ? "the day before" : "yesterday") : `the previous ${range.days} days`;
  if (current === previous) return `same as ${span}`;
  return `${current > previous ? "+" : "-"}${Math.abs(current - previous)} vs ${span}`;
}
