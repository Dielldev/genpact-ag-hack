import { WarningKind } from "@mesh/contract";
import type { AnswerBlock, AskResponse, EventRecord, FeedItem, PersonSummary, SessionRow } from "@mesh/server/api";
import { minutesSince, toneOf } from "../../format";
import { PeriodId, ReportKind, type ReportSpec } from "./intent";
import type { Kpi, ReportData, Row } from "./model";
import { openIdOf } from "./model";
import { isTrouble } from "./stats";

const MAX_SESSIONS = 10;

type SectionId = "status" | "performers" | "blocked" | "issues" | "modules" | "timeline" | "decisions" | "sessions";

const FULL: SectionId[] = ["status", "performers", "blocked", "issues", "modules", "timeline", "decisions", "sessions"];

const LAYOUT: Record<ReportKind, SectionId[]> = {
  [ReportKind.sprint]: FULL,
  [ReportKind.summary]: FULL,
  [ReportKind.standup]: ["status", "sessions", "blocked", "issues", "modules", "decisions"],
  [ReportKind.blockers]: ["status", "blocked", "issues", "modules", "timeline", "sessions"],
  [ReportKind.contributors]: ["performers", "modules", "timeline", "sessions"],
  [ReportKind.retro]: ["decisions", "issues", "blocked", "modules", "sessions"],
};

function relevance(row: Row): number {
  return row.item.report_count * 2 + row.item.blockers.length * 3 + (row.tone === "done" ? 2 : 0) + (isTrouble(row.tone) ? 3 : 0);
}

export function pickSessions(rows: Row[]): string[] {
  return [...rows].sort((a, b) => relevance(b) - relevance(a)).slice(0, MAX_SESSIONS).map((r) => openIdOf(r.item));
}

const PREVIOUS_WORD: Record<PeriodId, string> = {
  [PeriodId.today]: "yesterday",
  [PeriodId.week]: "last week",
  [PeriodId.twoWeeks]: "the 2 weeks before",
  [PeriodId.month]: "the 30 days before",
};

function kpiBlock(kpis: Kpi[], period: PeriodId): AnswerBlock {
  const tones: Record<string, SessionRow["status"]> = { done: "done", progress: "progress", blocked: "blocked" };
  return {
    type: "kpis",
    items: kpis.map((k) => {
      const diff = k.prev === null || (k.id !== "sessions" && k.id !== "done") ? 0 : k.value - (k.prev ?? 0);
      const delta = diff === 0 ? undefined : `${diff > 0 ? "up" : "down"} ${Math.abs(diff)} on ${PREVIOUS_WORD[period]}`;
      const of = k.of ? `of ${k.of} on the team` : undefined;
      return { label: k.label, value: k.value, hint: delta ?? of, tone: tones[k.id] };
    }),
  };
}

const rowOf = (r: Row): SessionRow => ({
  event_id: r.item.event_id,
  session_pk: r.item.session_pk,
  person: r.item.person,
  task: r.item.task,
  summary: r.item.summary,
  status: r.tone,
  ticket_ref: r.item.ticket_ref,
  modules: r.item.modules,
  last_seen_at: r.item.last_seen_at,
});

function insightBlocks(d: ReportData, events: EventRecord[]): AnswerBlock[] {
  const inReport = new Set(d.rows.map((r) => r.item.session_pk));
  const unique = [...new Map(events.filter((e) => inReport.has(e.session_pk)).map((e) => [e.session_pk, e])).values()];
  const pick = (kind: "decisions" | "dead_ends") =>
    unique
      .flatMap((e) =>
        kind === "decisions"
          ? e.decisions.map((x) => ({ person: e.person, title: x.choice, reason: x.reason, ts: x.ts, event_id: openIdOf(e) }))
          : e.dead_ends.map((x) => ({ person: e.person, title: x.attempt, reason: x.reason, ts: x.ts, event_id: openIdOf(e) })),
      )
      .filter((r) => Date.parse(r.ts) >= d.start)
      .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))
      .slice(0, 6);
  const out: AnswerBlock[] = [];
  const decisions = pick("decisions");
  const deadEnds = pick("dead_ends");
  if (decisions.length > 0) out.push({ type: "insights", title: "Decisions", kind: "decisions", rows: decisions });
  if (deadEnds.length > 0) out.push({ type: "insights", title: "Dead ends", kind: "dead_ends", rows: deadEnds });
  return out;
}

function section(id: SectionId, d: ReportData, events: EventRecord[]): AnswerBlock[] {
  switch (id) {
    case "status":
      return [{ type: "status", title: "Status distribution", segments: [
        { tone: "done", label: "Done", count: d.tones.done },
        { tone: "progress", label: "In progress", count: d.tones.progress },
        { tone: "blocked", label: "Blocked", count: d.tones.blocked },
        { tone: "stuck", label: "Stuck", count: d.tones.stuck },
        { tone: "active", label: "Idle", count: d.tones.active },
      ] }];
    case "performers":
      return [{ type: "leaderboard", title: "Top performers", unit: "completed", rows: d.performers.slice(0, 8).map((p) => ({
        person: p.person,
        value: p.done,
        detail: p.progress > 0 ? `${p.progress} in progress` : p.blocked > 0 ? `${p.blocked} blocked` : undefined,
      })) }];
    case "blocked":
      return [{ type: "blockers", title: "Blocked the most", rows: d.rows.filter((r) => isTrouble(r.tone)).map((r) => ({
        person: r.item.person,
        task: r.item.task,
        blocker: r.item.blockers[0] ?? "No blocker text reported",
        minutes: minutesSince(r.item.status_since, d.now),
        stuck: r.tone === "stuck",
        ticket_ref: r.item.ticket_ref,
        event_id: openIdOf(r.item),
      })).sort((a, b) => b.minutes - a.minutes).slice(0, 6) }];
    case "issues":
      return [{ type: "issues", title: "Main issues", rows: [
        ...d.issues.slice(0, 6).map((i) => ({ kind: "blocker" as const, text: i.text, count: i.count, people: i.people })),
        ...d.warnings.slice(0, 5).map((w) => ({ kind: w.kind === WarningKind.collision ? ("collision" as const) : ("rediscovery" as const), text: w.message, count: 1, people: w.people })),
      ] }];
    case "modules":
      return [{ type: "bars", title: "Modules touched", rows: d.modules.slice(0, 8).map((m) => ({ label: m.module, value: m.sessions })) }];
    case "timeline":
      return [{ type: "timeline", title: "Activity timeline", buckets: d.timeline.map((b) => ({ label: b.label, count: b.count })) }];
    case "decisions":
      return insightBlocks(d, events);
    case "sessions":
      return [{ type: "sessions", title: "Sessions", rows: d.rows.map(rowOf) }];
  }
}

export function reportBlocks(d: ReportData, events: EventRecord[]): AnswerBlock[] {
  return [kpiBlock(d.kpis, d.spec.period), ...LAYOUT[d.spec.kind].flatMap((id) => section(id, d, events))];
}

export function reportResponse(d: ReportData, events: EventRecord[], started: number, spec: ReportSpec): AskResponse {
  const empty = d.rows.length === 0;
  const text = empty
    ? `${spec.person ?? "Nobody"} has no reported sessions in the ${d.periodLabel.toLowerCase()}. Try a longer period.`
    : d.narrative;
  const ms = Math.max(1, Date.now() - started);
  return {
    answer: text,
    no_record: false,
    citations: [],
    sources: [],
    knowledge: [],
    plan: { intent: "status", person: spec.person ?? null, modules: [], keywords: [], since_days: null, source: "heuristic" } as AskResponse["plan"],
    blocks: empty ? [] : reportBlocks(d, events),
    steps: [
      { label: "Read the live feed and warnings", tool: "feed", ms: Math.round(ms * 0.55) },
      { label: `Computed ${d.title.toLowerCase()} analytics`, tool: null, ms: Math.round(ms * 0.45) },
    ],
    elapsed_ms: ms,
    model: "local-analytics",
  };
}

export function personBlocks(person: PersonSummary, items: FeedItem[], now: number): AnswerBlock[] {
  const mine = items.filter((i) => i.person === person.person);
  const rows: Row[] = mine.map((item) => ({ item, tone: toneOf(item.status, item.status_since, now) }));
  const open = rows.find((r) => r.tone !== "done");
  const count = (pred: (r: Row) => boolean) => rows.filter(pred).length;
  return [
    {
      type: "person",
      person: person.person,
      status: person.status,
      done: count((r) => r.tone === "done"),
      in_progress: count((r) => r.tone === "progress"),
      blocked: count((r) => isTrouble(r.tone)),
      modules: person.modules,
      last_activity_at: person.last_activity_at,
      current: open ? rowOf(open) : null,
    },
    { type: "sessions", title: `${person.person}'s sessions`, rows: rows.map(rowOf) },
  ];
}
