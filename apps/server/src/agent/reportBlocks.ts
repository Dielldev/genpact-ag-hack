import { WarningKind } from "@mesh/contract";
import type { AnswerBlock, BlockersBlock, IssuesBlock, StatusBlock } from "../api/blocks.js";
import type { EventRecord } from "../api/types.js";
import {
  blockerRows,
  deltaHint,
  groupBlockers,
  mostBlocked,
  moduleCounts,
  tallyPeople,
  tallyStatuses,
  timelineBuckets,
  topPerformers,
  type BlockerGroup,
} from "./analytics.js";
import type { PeriodRange } from "./time.js";

export interface WarningIssue {
  kind: WarningKind;
  text: string;
  people: string[];
  event_id: string;
}

export interface ReportInput {
  current: EventRecord[];
  previous: EventRecord[];
  range: PeriodRange;
  now: Date;
  warnings: WarningIssue[];
}

const ROWS = 6;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function statusBlock(events: EventRecord[], now: Date, title = "Status mix"): StatusBlock | null {
  const t = tallyStatuses(events, now);
  const segments: StatusBlock["segments"] = [
    { tone: "done", label: "Done", count: t.done },
    { tone: "progress", label: "In progress", count: t.in_progress },
    { tone: "blocked", label: "Blocked", count: t.blocked },
    { tone: "stuck", label: "Stuck", count: t.stuck },
    { tone: "active", label: "Active", count: t.active },
  ].filter((s) => s.count > 0) as StatusBlock["segments"];
  return segments.length ? { type: "status", title, segments } : null;
}

export function blockersBlock(events: EventRecord[], now: Date, title = "Blocked the longest"): BlockersBlock | null {
  const rows = blockerRows(events, now).slice(0, ROWS);
  return rows.length ? { type: "blockers", title, rows } : null;
}

export function issuesBlock(title: string, groups: BlockerGroup[], warnings: WarningIssue[], minCount = 1): IssuesBlock | null {
  const rows: IssuesBlock["rows"] = [
    ...groups.filter((g) => g.count >= minCount).map((g) => ({ kind: "blocker" as const, text: g.text, count: g.count, people: g.people })),
    ...warnings.map((w) => ({ kind: w.kind === WarningKind.collision ? ("collision" as const) : ("rediscovery" as const), text: w.text, count: 1, people: w.people })),
  ].slice(0, ROWS + 2);
  return rows.length ? { type: "issues", title, rows } : null;
}

export function teamReportBlocks(input: ReportInput): AnswerBlock[] {
  const { current, previous, range, now, warnings } = input;
  const cur = tallyStatuses(current, now);
  const prev = tallyStatuses(previous, now);
  const people = tallyPeople(current, now);
  const blocked = cur.blocked + cur.stuck;
  const out: Array<AnswerBlock | null> = [
    {
      type: "kpis",
      title: capitalize(range.label),
      items: [
        { label: "Sessions", value: cur.total, hint: deltaHint(cur.total, prev.total, range) },
        { label: "Completed", value: cur.done, hint: deltaHint(cur.done, prev.done, range), tone: "done" },
        { label: "In progress", value: cur.in_progress, tone: "progress" },
        { label: "Blocked", value: blocked, hint: cur.stuck ? `${cur.stuck} stuck over an hour` : undefined, tone: cur.stuck ? "stuck" : "blocked" },
        { label: "People", value: cur.people },
      ],
    },
    statusBlock(current, now),
  ];
  const leaders = topPerformers(people).slice(0, ROWS);
  if (leaders.length) {
    out.push({
      type: "leaderboard",
      title: "Top performers",
      unit: "sessions done",
      rows: leaders.map((t) => ({ person: t.person, value: t.done, detail: `${t.in_progress} in progress, ${t.blocked} blocked`, event_id: t.done_event_id })),
    });
  }
  out.push(blockersBlock(current, now), issuesBlock("Recurring blockers and warnings", groupBlockers(current, now), warnings, 2));
  const modules = moduleCounts(current);
  if (modules.length) out.push({ type: "bars", title: "Sessions by module", rows: modules });
  const buckets = timelineBuckets(current, range, now);
  if (buckets.length) out.push({ type: "timeline", title: range.hourly ? "Sessions by hour" : "Sessions by day", buckets });
  return out.filter((b): b is AnswerBlock => b !== null);
}

export function reportFacts(input: ReportInput) {
  const { current, previous, range, now, warnings } = input;
  const cur = tallyStatuses(current, now);
  const prev = tallyStatuses(previous, now);
  const people = tallyPeople(current, now);
  return {
    period: range.label,
    from: range.since.toISOString().slice(0, 10),
    to: new Date(range.until.getTime() - 1).toISOString().slice(0, 10),
    totals: { ...cur, previous_total: prev.total, previous_done: prev.done, previous_blocked: prev.blocked + prev.stuck },
    top_performers: topPerformers(people).slice(0, ROWS).map((t) => ({ person: t.person, done: t.done, in_progress: t.in_progress, blocked: t.blocked, example_id: t.done_event_id })),
    blocked_longest: mostBlocked(people).slice(0, ROWS).map((t) => ({ person: t.person, blocked_sessions: t.blocked, minutes_blocked: t.minutes_blocked, example_id: t.last_event_id })),
    blockers: blockerRows(current, now).slice(0, ROWS).map((r) => ({ person: r.person, task: r.task, blocker: r.blocker, minutes: r.minutes, stuck: r.stuck, id: r.event_id })),
    recurring_blockers: groupBlockers(current, now).filter((g) => g.count > 1).slice(0, ROWS),
    warnings: warnings.slice(0, ROWS).map((w) => ({ kind: w.kind, text: w.text, people: w.people, id: w.event_id })),
    modules: moduleCounts(current, ROWS),
  };
}
