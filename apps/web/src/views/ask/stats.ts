import type { FeedItem } from "@mesh/server/api";
import { day, minutesSince, toneOf, type Tone } from "../../format";
import type { Bucket, BlockedPerson, Issue, ModuleStat, Performer, Row, ToneCounts } from "./model";
import { openIdOf } from "./model";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function overlaps(item: FeedItem, start: number, end: number): boolean {
  return Date.parse(item.last_seen_at) >= start && Date.parse(item.first_seen_at) <= end;
}

export function rowsIn(items: FeedItem[], start: number, end: number, now: number): Row[] {
  return items
    .filter((i) => overlaps(i, start, end))
    .map((item) => ({ item, tone: toneOf(item.status, item.status_since, now) }))
    .sort((a, b) => Date.parse(b.item.last_seen_at) - Date.parse(a.item.last_seen_at));
}

export function countTones(rows: Row[]): ToneCounts {
  const out: ToneCounts = { done: 0, progress: 0, blocked: 0, stuck: 0, active: 0 };
  for (const r of rows) out[r.tone] += 1;
  return out;
}

export const isTrouble = (tone: Tone): boolean => tone === "blocked" || tone === "stuck";

export function performers(rows: Row[]): Performer[] {
  const map = new Map<string, Performer>();
  for (const { item, tone } of rows) {
    const p = map.get(item.person) ?? { person: item.person, done: 0, progress: 0, blocked: 0, reports: 0 };
    if (tone === "done") p.done += 1;
    else if (tone === "progress") p.progress += 1;
    else if (isTrouble(tone)) p.blocked += 1;
    p.reports += item.report_count;
    map.set(item.person, p);
  }
  return [...map.values()].sort((a, b) => b.done - a.done || b.reports - a.reports || a.person.localeCompare(b.person));
}

export function blockedMost(rows: Row[], now: number): BlockedPerson[] {
  const map = new Map<string, BlockedPerson>();
  for (const { item, tone } of rows) {
    if (!isTrouble(tone)) continue;
    const p = map.get(item.person) ?? { person: item.person, count: 0, minutes: 0, blockers: [], openId: openIdOf(item) };
    p.count += 1;
    p.minutes += minutesSince(item.status_since, now);
    for (const b of item.blockers) if (!p.blockers.includes(b)) p.blockers.push(b);
    map.set(item.person, p);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.minutes - a.minutes);
}

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

export function issuesOf(rows: Row[]): Issue[] {
  const map = new Map<string, Issue>();
  for (const { item } of rows) {
    for (const text of item.blockers) {
      const key = normalize(text);
      if (!key) continue;
      const issue = map.get(key) ?? { text, count: 0, people: [], openId: openIdOf(item) };
      issue.count += 1;
      if (!issue.people.includes(item.person)) issue.people.push(item.person);
      map.set(key, issue);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.people.length - a.people.length);
}

export function moduleStats(rows: Row[]): ModuleStat[] {
  const map = new Map<string, ModuleStat>();
  for (const { item } of rows) {
    for (const module of item.modules) {
      const m = map.get(module) ?? { module, sessions: 0, people: [] };
      m.sessions += 1;
      if (!m.people.includes(item.person)) m.people.push(item.person);
      map.set(module, m);
    }
  }
  return [...map.values()].sort((a, b) => b.sessions - a.sessions || a.module.localeCompare(b.module));
}

function dayStart(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function hourLabel(t: number): string {
  return new Date(t).toLocaleTimeString("en-US", { hour: "numeric" }).replace(" ", "").toLowerCase();
}

export function timeline(rows: Row[], start: number, now: number): Bucket[] {
  if (rows.length === 0) return [];
  const times = rows.map((r) => Math.min(now, Math.max(start, Date.parse(r.item.first_seen_at))));
  const earliest = Math.min(...times);
  const span = now - earliest;
  const hourly = span <= 2 * DAY;
  const step = !hourly ? DAY : span > 26 * HOUR ? 2 * HOUR : HOUR;
  let origin = hourly ? Math.floor(earliest / step) * step : dayStart(earliest);
  let count = Math.floor((now - origin) / step) + 1;
  if (count < 6) {
    origin -= (6 - count) * step;
    count = 6;
  }
  const buckets: Bucket[] = Array.from({ length: count }, (_, i) => {
    const t = origin + i * step;
    return { start: t, count: 0, label: hourly ? hourLabel(t) : day(new Date(t).toISOString()) };
  });
  for (const t of times) {
    const i = Math.min(count - 1, Math.max(0, Math.floor((t - origin) / step)));
    buckets[i]!.count += 1;
  }
  return buckets;
}
