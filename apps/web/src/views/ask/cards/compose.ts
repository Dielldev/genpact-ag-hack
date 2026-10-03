import type { AnswerBlock, BlockersBlock, IssuesBlock, KpisBlock, LeaderboardBlock, PersonBlock, SessionRow, SessionsBlock, StatusBlock } from "@mesh/server/api";
import { duration, STUCK_AFTER_MINUTES } from "../../../format";
import type { Segment } from "../blocks/Overview";

export interface Stat {
  key: string;
  value: string;
  label: string;
  note?: string;
  tone?: "main" | "trouble";
}

export interface Glance {
  stats: Stat[];
  segments: Segment[];
}

export type Severity = "stuck" | "blocked" | "collision" | "rediscovery";

export interface AttentionRow {
  key: string;
  severity: Severity;
  people: string[];
  title: string;
  reason: string;
  minutes?: number;
  id: string | null;
}

export interface PersonRow {
  key: string;
  person: string;
  done: number | null;
  task: string | null;
  blocked: boolean;
  id: string | null;
}

export interface Composed {
  glance: Glance | null;
  attention: AttentionRow[] | null;
  people: PersonRow[] | null;
  rest: AnswerBlock[];
}

type Of<T extends AnswerBlock["type"]> = Extract<AnswerBlock, { type: T }>;

const first = <T extends AnswerBlock["type"]>(blocks: AnswerBlock[], type: T): Of<T> | undefined => blocks.find((b): b is Of<T> => b.type === type);

const num = (v: number | string | undefined): number | null => {
  if (v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const meaningful = (hint: string | undefined): string | undefined => (hint && hint.length <= 44 && !/[↑↓]|\bvs\b|^[+-]\d/.test(hint) ? hint : undefined);

function glanceOf(kpis: KpisBlock | undefined, status: StatusBlock | undefined): Glance | null {
  if (!kpis && !status) return null;
  const item = (label: string) => kpis?.items.find((i) => i.label.toLowerCase() === label);
  const seg = (tone: string) => (status ? status.segments.filter((s) => s.tone === tone).reduce((n, s) => n + s.count, 0) : null);
  const total = num(item("sessions")?.value) ?? (status ? status.segments.reduce((n, s) => n + s.count, 0) : null);
  const done = num(item("completed")?.value) ?? seg("done");
  const progress = num(item("in progress")?.value) ?? seg("progress");
  const stuck = seg("stuck") ?? 0;
  const blocked = num(item("blocked")?.value) ?? (status ? (seg("blocked") ?? 0) + stuck : null);
  const people = num(item("people active")?.value);
  const collisions = num(item("collisions")?.value);

  if (total === null || done === null) {
    const stats = (kpis?.items ?? []).map((i, n): Stat => ({ key: i.label, value: String(i.value), label: i.label.toLowerCase(), note: meaningful(i.hint), tone: n === 0 ? "main" : undefined }));
    return { stats, segments: status?.segments.map((s) => ({ tone: s.tone, label: s.label, count: s.count })) ?? [] };
  }

  const stats: Stat[] = [
    { key: "done", value: String(done), label: `of ${total} ${total === 1 ? "session" : "sessions"} completed${total > 0 ? ` (${Math.round((done / total) * 100)}%)` : ""}`, note: meaningful(item("completed")?.hint) ?? meaningful(item("sessions")?.hint), tone: "main" },
  ];
  if (progress !== null) stats.push({ key: "progress", value: String(progress), label: "in progress" });
  if (blocked !== null) stats.push({ key: "blocked", value: String(blocked), label: stuck > 0 ? `blocked · ${stuck} stuck for over ${duration(STUCK_AFTER_MINUTES)}` : "blocked", tone: blocked > 0 ? "trouble" : undefined });
  if (people !== null) stats.push({ key: "people", value: String(people), label: people === 1 ? "person active" : "people active", note: meaningful(item("people active")?.hint) });
  if (collisions) stats.push({ key: "collisions", value: String(collisions), label: collisions === 1 ? "collision" : "collisions" });

  const segments: Segment[] = status
    ? status.segments.map((s) => ({ tone: s.tone, label: s.label, count: s.count }))
    : [
        { tone: "done", label: "Done", count: done },
        { tone: "progress", label: "In progress", count: progress ?? 0 },
        { tone: "blocked", label: "Blocked", count: blocked ?? 0 },
        { tone: "active", label: "Idle", count: Math.max(0, total - done - (progress ?? 0) - (blocked ?? 0)) },
      ];
  return { stats, segments };
}

function idsByPerson(blocks: AnswerBlock[]): Map<string, string> {
  const map = new Map<string, string>();
  const add = (person: string, id: string | null | undefined) => {
    if (id && !map.has(person)) map.set(person, id);
  };
  for (const r of first(blocks, "blockers")?.rows ?? []) add(r.person, r.event_id);
  for (const r of first(blocks, "sessions")?.rows ?? []) if (r.status !== "done") add(r.person, r.event_id ?? String(r.session_pk));
  for (const r of first(blocks, "sessions")?.rows ?? []) add(r.person, r.event_id ?? String(r.session_pk));
  for (const r of first(blocks, "leaderboard")?.rows ?? []) add(r.person, r.event_id);
  const person = first(blocks, "person");
  if (person?.current) add(person.person, person.current.event_id ?? String(person.current.session_pk));
  return map;
}

const ORDER: Record<Severity, number> = { stuck: 0, blocked: 1, collision: 2, rediscovery: 3 };

function attentionOf(blockers: BlockersBlock | undefined, issues: IssuesBlock | undefined, ids: Map<string, string>): AttentionRow[] | null {
  if (!blockers && !issues) return null;
  const rows: AttentionRow[] = (blockers?.rows ?? []).map((b, i) => ({
    key: `b-${i}`,
    severity: b.stuck ? "stuck" : "blocked",
    people: [b.person],
    title: b.task ?? b.ticket_ref ?? "Open session",
    reason: b.blocker,
    minutes: b.minutes,
    id: b.event_id,
  }));
  (issues?.rows ?? []).forEach((r, i) => {
    if (r.kind === "blocker" && blockers) return;
    const severity: Severity = r.kind === "blocker" ? "blocked" : r.kind;
    const title = r.kind === "collision" ? "Working on the same area" : r.kind === "rediscovery" ? "Re-discovered a recorded dead end" : r.count > 1 ? `Hit by ${r.count} sessions` : "Blocker";
    rows.push({ key: `i-${i}`, severity, people: r.people, title, reason: r.text, id: r.people.map((p) => ids.get(p)).find(Boolean) ?? null });
  });
  return rows.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || (b.minutes ?? 0) - (a.minutes ?? 0));
}

const idOf = (r: SessionRow) => r.event_id ?? String(r.session_pk);

function peopleOf(blocks: AnswerBlock[], leaderboard: LeaderboardBlock | undefined, person: PersonBlock | undefined, sessions: SessionsBlock | undefined, ids: Map<string, string>): PersonRow[] | null {
  if (!leaderboard && !person && !sessions) return null;
  const mine = (name: string) => (sessions?.rows ?? []).filter((r) => r.person === name);
  const taskOf = (name: string): SessionRow | null => (person?.person === name && person.current) || mine(name).find((r) => r.status !== "done") || mine(name)[0] || null;
  const troubled = new Set([
    ...(first(blocks, "blockers")?.rows ?? []).map((r) => r.person),
    ...(sessions?.rows ?? []).filter((r) => r.status === "blocked" || r.status === "stuck").map((r) => r.person),
    ...(person && person.blocked > 0 ? [person.person] : []),
  ]);
  const build = (name: string, done: number | null, id: string | null): PersonRow => {
    const current = taskOf(name);
    return { key: name, person: name, done, task: current?.task ?? null, blocked: troubled.has(name), id: current ? idOf(current) : id ?? ids.get(name) ?? null };
  };
  const doneBy = (name: string) => mine(name).filter((r) => r.status === "done").length;
  if (leaderboard) {
    const completed = leaderboard.unit === "completed";
    const rows = leaderboard.rows.map((r) => build(r.person, completed ? r.value : sessions ? doneBy(r.person) : null, r.event_id ?? null));
    if (person && !rows.some((r) => r.person === person.person)) rows.unshift(build(person.person, person.done, null));
    return rows;
  }
  const names = [...new Set([...(person ? [person.person] : []), ...(sessions?.rows ?? []).map((r) => r.person)])];
  return names.map((n) => build(n, person?.person === n ? person.done : doneBy(n), null)).sort((a, b) => (b.done ?? 0) - (a.done ?? 0));
}

const CONSUMED = new Set<AnswerBlock["type"]>(["kpis", "status", "blockers", "issues", "leaderboard", "person"]);

export function compose(blocks: AnswerBlock[]): Composed {
  const ids = idsByPerson(blocks);
  const sessions = first(blocks, "sessions");
  return {
    glance: glanceOf(first(blocks, "kpis"), first(blocks, "status")),
    attention: attentionOf(first(blocks, "blockers"), first(blocks, "issues"), ids),
    people: peopleOf(blocks, first(blocks, "leaderboard"), first(blocks, "person"), sessions, ids),
    rest: blocks.filter((b) => !CONSUMED.has(b.type)),
  };
}
