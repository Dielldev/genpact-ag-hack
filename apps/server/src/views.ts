import { z } from "zod";
import { PersonStatus, ReportStatus } from "@mesh/contract";
import type {
  ContributorSummary,
  EventRecord,
  EventRef,
  OnboardingResponse,
  Provenance,
  Ticket,
  TicketDetail,
  WarningCard,
} from "./api/types.js";
import type { AppDeps } from "./deps.js";
import { redact } from "./redact.js";
import { issuesOf, ValidationError } from "./schemas.js";
import { clip } from "./text.js";

export function eventRef(e: EventRecord): EventRef {
  return {
    event_id: e.event_id,
    session_pk: e.session_pk,
    person: e.person,
    task: e.task,
    status: e.status,
    project: e.project,
    ticket_ref: e.ticket_ref,
    modules: e.modules,
    last_seen_at: e.last_seen_at,
  };
}

export async function warningCards(deps: AppDeps, ws: string, filter: { since?: string; event_id?: string } = {}): Promise<WarningCard[]> {
  const rows = await deps.api.warnings(ws, filter);
  const ids = [...new Set(rows.flatMap((r) => [r.reporter_event_id, ...r.source_event_ids]))];
  const sessions = ids.length ? await deps.api.sessions(ws, { event_ids: ids, limit: 500 }) : [];
  const byEvent = new Map<string, EventRecord>();
  for (const s of sessions) for (const id of s.event_ids) byEvent.set(id, s);
  const cards: WarningCard[] = [];
  for (const row of rows) {
    const reporter = byEvent.get(row.reporter_event_id);
    const sources = row.source_event_ids.map((id) => byEvent.get(id)).filter((s): s is EventRecord => s !== undefined);
    if (!reporter || sources.length === 0) continue;
    cards.push({
      warning_id: row.warning_id,
      kind: row.kind,
      message: row.message,
      created_at: row.created_at,
      reporter: eventRef(reporter),
      sources: sources.map((s) => ({ ...eventRef(s), event_id: row.source_event_ids.find((id) => s.event_ids.includes(id)) ?? s.event_id })),
      people: [...new Set([reporter.person, ...sources.map((s) => s.person)])],
    });
  }
  return cards;
}

const CreateTicketSchema = z.object({
  workspace: z.string().min(1),
  title: z.string().min(1),
  created_by: z.string().min(1),
  description: z.string().nullish(),
  assignee: z.string().nullish(),
  ref: z.string().nullish(),
});

export async function createTicket(deps: AppDeps, raw: unknown): Promise<Ticket> {
  const parsed = CreateTicketSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(issuesOf(parsed.error));
  const t = parsed.data;
  return deps.api.createTicket({
    workspace: clip(t.workspace, 200),
    title: clip(redact(t.title), 200),
    created_by: clip(t.created_by, 200),
    description: t.description ? clip(redact(t.description), 4000) : null,
    assignee: t.assignee ? clip(t.assignee, 200) : null,
    ref: t.ref ? clip(redact(t.ref), 60) : null,
  });
}

function provenance<T extends { ts: string }>(events: EventRecord[], pick: (e: EventRecord) => T[]): Array<Omit<T, "ts"> & Provenance> {
  return events
    .flatMap((e) => pick(e).map(({ ts, ...rest }) => ({ ...rest, event_id: e.event_id, person: e.person, ts })))
    .sort((a, b) => (a.ts < b.ts ? -1 : 1)) as Array<Omit<T, "ts"> & Provenance>;
}

export async function ticketDetail(deps: AppDeps, ws: string, ref: string): Promise<TicketDetail | null> {
  const [tickets, events] = await Promise.all([
    deps.api.tickets(ws, { ref, include_closed: true }),
    deps.api.sessions(ws, { ticket_ref: ref, reported: true, limit: 200 }),
  ]);
  const ticket = tickets[0] ?? null;
  if (!ticket && events.length === 0) return null;
  const ordered = [...events].sort((a, b) => (a.first_seen_at < b.first_seen_at ? -1 : 1));
  const modules = [...new Set(ordered.flatMap((e) => e.modules))];
  return {
    ref: ticket?.ref ?? ref,
    ticket,
    modules,
    notes: ordered.map((e) => ({ event_id: e.event_id, person: e.person, status: e.status, task: e.task, summary: e.summary, last_seen_at: e.last_seen_at })),
    decisions: provenance(ordered, (e) => e.decisions),
    dead_ends: provenance(ordered, (e) => e.dead_ends),
    human_corrections: provenance(ordered, (e) => e.human_corrections),
    knowledge: modules.length ? await deps.api.knowledge(ws, { modules }) : [],
  };
}

function filesToRead(events: EventRecord[]) {
  const counts = new Map<string, { ref: string; label: string | null; sessions: number }>();
  for (const e of events) {
    for (const a of e.artifacts) {
      if (a.kind !== "file") continue;
      const current = counts.get(a.ref) ?? { ref: a.ref, label: a.label ?? null, sessions: 0 };
      current.sessions += 1;
      counts.set(a.ref, current);
    }
  }
  return [...counts.values()].sort((a, b) => b.sessions - a.sessions || a.ref.localeCompare(b.ref)).slice(0, 8);
}

export async function onboarding(deps: AppDeps, ws: string, module: string): Promise<OnboardingResponse> {
  const [events, people, exitAnswers] = await Promise.all([
    deps.api.sessions(ws, { module, reported: true, limit: 300 }),
    deps.api.people(ws),
    deps.api.knowledge(ws, { modules: [module] }),
  ]);
  const history = [...events].sort((a, b) => (a.first_seen_at < b.first_seen_at ? -1 : 1));
  const statusOf = new Map(people.map((p) => [p.person, p.status]));
  const byPerson = new Map<string, ContributorSummary>();
  for (const e of history) {
    const c = byPerson.get(e.person) ?? { person: e.person, status: statusOf.get(e.person) ?? PersonStatus.active, sessions: 0, last_activity_at: null };
    c.sessions += 1;
    if (!c.last_activity_at || e.last_seen_at > c.last_activity_at) c.last_activity_at = e.last_seen_at;
    byPerson.set(e.person, c);
  }
  const contributors = [...byPerson.values()].sort((a, b) => b.sessions - a.sessions || a.person.localeCompare(b.person));
  const top = contributors[0];
  const owner = top ? { ...top, share: top.sessions / history.length } : null;
  return {
    workspace: ws,
    module,
    owner,
    owner_left: owner ? owner.status === PersonStatus.left || owner.status === PersonStatus.leaving : false,
    contributors,
    history,
    dead_ends: provenance(history, (e) => e.dead_ends),
    decisions: provenance(history, (e) => e.decisions),
    human_corrections: provenance(history, (e) => e.human_corrections),
    exit_answers: exitAnswers,
    files_to_read: filesToRead(history),
    open_work: history.filter((e) => e.status === ReportStatus.inProgress || e.status === ReportStatus.blocked),
  };
}
