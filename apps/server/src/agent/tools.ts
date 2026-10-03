import { z } from "zod";
import { PersonStatus, ReportStatus } from "@mesh/contract";
import type { AnswerBlock, InsightsBlock } from "../api/blocks.js";
import type { EventRecord } from "../api/types.js";
import { compactEvent, compactKnowledge } from "../intelligence/askPrompts.js";
import { clip, shortDate } from "../text.js";
import { groupBlockers, inPeriod, mostBlocked, sessionRow, tallyPeople, blockerRows } from "./analytics.js";
import { eventKey, loadSessions, loadWarningIssues, resolveModule, resolvePerson, searchSessions } from "./data.js";
import { blockersBlock, issuesBlock, reportFacts, teamReportBlocks } from "./reportBlocks.js";
import { minutesSince, PERIODS, periodRange, previousRange, toneOf } from "./time.js";
import type { ToolDef, ToolOutcome } from "./types.js";

const PeriodSchema = z.enum(PERIODS);
const ROWS = 8;
const EVENT_ID = /^(evt_[A-Za-z0-9_-]{4,64}|session-\d{1,12})$/;

const empty = (note: string): ToolOutcome => ({ ok: true, data: { empty: true, note } });

const brief = (e: EventRecord, now: Date) => ({
  id: eventKey(e),
  person: e.person,
  task: e.task,
  status: toneOf(e, now),
  summary: e.summary ? clip(e.summary, 200) : null,
  modules: e.modules,
  ticket: e.ticket_ref,
  updated: shortDate(e.last_report_at ?? e.last_seen_at),
});

function detailed(e: EventRecord, now: Date) {
  const tone = toneOf(e, now);
  const blocked = tone === "blocked" || tone === "stuck";
  return { ...compactEvent(e), status: tone, blocked_for_minutes: blocked ? Math.round(minutesSince(e.status_since, now)) : 0 };
}

function insightBlocks(events: EventRecord[], include: { decisions: boolean; deadEnds: boolean; corrections: boolean }): AnswerBlock[] {
  const rows = (pick: (e: EventRecord) => Array<{ title: string; reason: string; ts: string }>): InsightsBlock["rows"] =>
    events
      .flatMap((e) => pick(e).map((i) => ({ person: e.person, title: clip(i.title, 200), reason: clip(i.reason, 240), ts: i.ts, event_id: e.event_id })))
      .sort((a, b) => b.ts.localeCompare(a.ts))
      .slice(0, 6);
  const out: InsightsBlock[] = [];
  const decisions = include.decisions ? rows((e) => e.decisions.map((d) => ({ title: d.choice, reason: d.reason, ts: d.ts }))) : [];
  const deadEnds = include.deadEnds ? rows((e) => e.dead_ends.map((d) => ({ title: d.attempt, reason: d.reason, ts: d.ts }))) : [];
  const corrections = include.corrections ? rows((e) => e.human_corrections.map((c) => ({ title: c.correction, reason: c.reason, ts: c.ts }))) : [];
  if (decisions.length) out.push({ type: "insights", title: "Decisions", kind: "decisions", rows: decisions });
  if (deadEnds.length) out.push({ type: "insights", title: "Dead ends", kind: "dead_ends", rows: deadEnds });
  if (corrections.length) out.push({ type: "insights", title: "Human corrections", kind: "decisions", rows: corrections });
  return out;
}

const teamReport: ToolDef<{ period: z.infer<typeof PeriodSchema> }> = {
  name: "team_report",
  description:
    "Build the team report for a period: completed work, in progress, blocked and stuck sessions, top performers, who was blocked the longest, recurring blockers, collisions, busiest modules and a timeline. Use for sprint reports, standups, 'what was everyone doing today' and 'who got blocked the most'. The charts and tables are shown to the user automatically.",
  schema: z.object({ period: PeriodSchema.default("week").describe("today, yesterday, week (last 7 days), two_weeks, or month") }),
  label: ({ period }) => (period === "today" || period === "yesterday" ? "Reviewing the team's day" : "Building the sprint report"),
  async run({ period }, ctx) {
    const range = periodRange(period, ctx.now);
    const prev = previousRange(range);
    const [rows, warnings] = await Promise.all([loadSessions(ctx, { since: prev.since, reported: true }), loadWarningIssues(ctx, range.since)]);
    const current = inPeriod(rows, range);
    if (current.length === 0) return empty(`No shared reports for ${range.label}.`);
    const input = { current, previous: inPeriod(rows, prev), range, now: ctx.now, warnings };
    const blocks = teamReportBlocks(input);
    if (range.hourly) blocks.push({ type: "sessions", title: "Sessions", rows: current.slice(0, 6).map((e) => sessionRow(e, ctx.now)) });
    ctx.emit(blocks);
    const people = tallyPeople(current, ctx.now)
      .sort((a, b) => b.sessions - a.sessions || a.person.localeCompare(b.person))
      .slice(0, 10)
      .map((t) => ({
        person: t.person,
        done: t.done,
        in_progress: t.in_progress,
        blocked: t.blocked,
        items: current.filter((e) => e.person === t.person).slice(0, 3).map((e) => brief(e, ctx.now)),
      }));
    return { ok: true, data: { ...reportFacts(input), people } };
  },
};

const personActivity: ToolDef<{ person: string; period?: z.infer<typeof PeriodSchema> }> = {
  name: "person_activity",
  description:
    "What one person worked on: their sessions newest first with start and last-update dates, status, decisions and dead ends. Optionally limit to a period. Use for 'what was Deal working on', 'what did Bo do before X' (compare the dates), and 'how is Ana doing'.",
  schema: z.object({
    person: z.string().min(1).max(80).describe("A person's name from the known people list"),
    period: PeriodSchema.optional().describe("Optional: today, yesterday, week, two_weeks or month. Omit for their recent work."),
  }),
  label: ({ person }) => `Looking up ${clip(person, 40)}'s work`,
  async run({ person: asked, period }, ctx) {
    const person = resolvePerson(ctx, asked);
    const range = period ? periodRange(period, ctx.now) : null;
    const rows = await loadSessions(ctx, { person, since: range?.since, reported: true, limit: 60 });
    const events = range ? inPeriod(rows, range) : rows;
    if (events.length === 0) return empty(`No shared reports from ${person}${range ? ` for ${range.label}` : ""}.`);
    const tally = tallyPeople(events, ctx.now)[0];
    const summary = (await ctx.api.people(ctx.workspace)).find((p) => p.person === person);
    const open = events.find((e) => e.status !== ReportStatus.done) ?? events[0];
    const shown = events.slice(0, ROWS);
    ctx.emit([
      {
        type: "person",
        person,
        status: summary?.status ?? PersonStatus.active,
        done: tally?.done ?? 0,
        in_progress: tally?.in_progress ?? 0,
        blocked: tally?.blocked ?? 0,
        modules: tally?.modules.slice(0, 8) ?? [],
        last_activity_at: summary?.last_activity_at ?? events[0]?.last_seen_at ?? null,
        current: open ? sessionRow(open, ctx.now) : null,
      },
      { type: "sessions", title: `${person}'s recent sessions`, rows: shown.map((e) => sessionRow(e, ctx.now)) },
      ...insightBlocks(shown, { decisions: true, deadEnds: true, corrections: false }),
    ]);
    return {
      ok: true,
      data: {
        person,
        period: range?.label ?? "recent work",
        counts: { sessions: events.length, done: tally?.done ?? 0, in_progress: tally?.in_progress ?? 0, blocked: tally?.blocked ?? 0 },
        sessions_newest_first: shown.map((e) => ({ ...detailed(e, ctx.now), started: shortDate(e.first_seen_at) })),
      },
    };
  },
};

const listBlockers: ToolDef<Record<string, never>> = {
  name: "list_blockers",
  description: "Everyone who is blocked right now, how long, and on what, with recurring blockers grouped. Use for 'who is blocked' and 'what is stuck'.",
  schema: z.object({}) as z.ZodType<Record<string, never>>,
  label: () => "Checking who is blocked",
  async run(_args, ctx) {
    const events = await loadSessions(ctx, { status: ReportStatus.blocked, limit: 100 });
    if (events.length === 0) return empty("Nobody has a blocked session right now.");
    const blocks: AnswerBlock[] = [];
    const list = blockersBlock(events, ctx.now, "Blocked right now");
    const groups = groupBlockers(events, ctx.now);
    const issues = issuesBlock("Blocker themes", groups, [], 2);
    for (const b of [list, issues]) if (b) blocks.push(b);
    ctx.emit(blocks);
    return {
      ok: true,
      data: {
        blocked: blockerRows(events, ctx.now).slice(0, ROWS).map((r) => ({ person: r.person, task: r.task, blocker: r.blocker, minutes: r.minutes, stuck: r.stuck, id: r.event_id })),
        by_person: mostBlocked(tallyPeople(events, ctx.now)).slice(0, ROWS).map((t) => ({ person: t.person, blocked_sessions: t.blocked, minutes_blocked: t.minutes_blocked })),
        recurring: groups.filter((g) => g.count > 1).slice(0, ROWS),
      },
    };
  },
};

const listWarnings: ToolDef<{ period?: z.infer<typeof PeriodSchema> }> = {
  name: "list_warnings",
  description: "Collisions (two people touching the same work) and rediscoveries (someone repeating a known dead end) raised in a period.",
  schema: z.object({ period: PeriodSchema.optional().describe("today, yesterday, week, two_weeks or month. Defaults to two_weeks.") }),
  label: () => "Checking collisions and repeated work",
  async run({ period }, ctx) {
    const range = periodRange(period ?? "two_weeks", ctx.now);
    const warnings = await loadWarningIssues(ctx, range.since);
    if (warnings.length === 0) return empty(`No collisions or rediscoveries for ${range.label}.`);
    const block = issuesBlock("Collisions and rediscoveries", [], warnings);
    if (block) ctx.emit([block]);
    return { ok: true, data: { period: range.label, warnings: warnings.slice(0, ROWS).map((w) => ({ kind: w.kind, text: w.text, people: w.people, id: w.event_id })) } };
  },
};

const searchRecords: ToolDef<{ query: string; module?: string }> = {
  name: "search_records",
  description: "Search shared session reports and exit-interview answers for a topic, error or component. Use for 'why did we...', 'who touched webhooks', 'what do we know about X'.",
  schema: z.object({ query: z.string().min(2).max(200), module: z.string().max(80).optional().describe("Optional module name from the known modules list") }),
  label: () => "Searching records",
  async run({ query, module }, ctx) {
    const modules = module ? [resolveModule(ctx, module)] : [];
    const { events, knowledge } = await searchSessions(ctx, query, modules);
    if (events.length === 0 && knowledge.length === 0) return empty("Nothing in the shared records matches that.");
    if (events.length) ctx.emit([{ type: "sessions", title: "Matching sessions", rows: events.map((e) => sessionRow(e, ctx.now)) }]);
    return { ok: true, data: { sessions: events.map((e) => detailed(e, ctx.now)), exit_interviews: knowledge.slice(0, 3).map(compactKnowledge) } };
  },
};

const getSession: ToolDef<{ id: string }> = {
  name: "get_session",
  description: "Full detail of one session by its id (evt_...): decisions with reasons, dead ends, human corrections, blockers, files. Use to explain a specific record.",
  schema: z.object({ id: z.string().regex(EVENT_ID, "id must look like evt_... as given in earlier results") }),
  label: () => "Reading a session in detail",
  async run({ id }, ctx) {
    const pk = id.startsWith("session-") ? Number(id.slice(8)) : null;
    const events = await ctx.api.sessions(ctx.workspace, pk !== null ? { session_pks: [pk], limit: 1 } : { event_ids: [id], limit: 1 });
    const event = events[0];
    if (!event) return { ok: false, data: { error: `No shared record with id ${id}.` } };
    ctx.emit([{ type: "sessions", title: "Session", rows: [sessionRow(event, ctx.now)] }, ...insightBlocks([event], { decisions: true, deadEnds: true, corrections: true })]);
    return { ok: true, data: { session: detailed(event, ctx.now), started: shortDate(event.first_seen_at) } };
  },
};

export const TOOLS: ToolDef<any>[] = [teamReport, personActivity, listBlockers, listWarnings, searchRecords, getSession];
