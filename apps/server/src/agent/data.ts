import type { EventRecord, KnowledgeEntry } from "../api/types.js";
import { clip } from "../text.js";
import type { WarningIssue } from "./reportBlocks.js";
import type { ToolContext } from "./types.js";

export class ToolInputError extends Error {}

function match(value: string, options: string[], noun: string): string {
  const wanted = value.trim().toLowerCase();
  const exact = options.find((o) => o.toLowerCase() === wanted);
  if (exact) return exact;
  const partial = options.filter((o) => o.toLowerCase().split(/\s+/).includes(wanted));
  if (partial.length === 1 && partial[0]) return partial[0];
  throw new ToolInputError(`Unknown ${noun} "${clip(value, 60)}". Known ${noun}s: ${options.slice(0, 40).join(", ") || "none"}.`);
}

export const resolvePerson = (ctx: ToolContext, value: string) => match(value, ctx.vocabulary.people, "person");
export const resolveModule = (ctx: ToolContext, value: string) => match(value, ctx.vocabulary.modules, "module");

export const eventKey = (e: EventRecord): string => e.event_id ?? `session-${e.session_pk}`;

export async function loadSessions(
  ctx: ToolContext,
  filter: { person?: string; status?: string; module?: string; since?: Date; reported?: boolean; limit?: number },
): Promise<EventRecord[]> {
  const { since, ...rest } = filter;
  return ctx.api.sessions(ctx.workspace, { ...rest, since: since ? since.toISOString() : undefined, limit: filter.limit ?? 500 });
}

export async function loadWarningIssues(ctx: ToolContext, since: Date, limit = 30): Promise<WarningIssue[]> {
  const rows = await ctx.api.warnings(ctx.workspace, { since: since.toISOString(), limit });
  const ids = [...new Set(rows.flatMap((r) => [r.reporter_event_id, ...r.source_event_ids]))];
  const sessions = ids.length ? await ctx.api.sessions(ctx.workspace, { event_ids: ids, limit: 500 }) : [];
  const personOf = new Map<string, string>();
  for (const s of sessions) for (const id of s.event_ids) personOf.set(id, s.person);
  const out: WarningIssue[] = [];
  for (const row of rows) {
    const people = [...new Set([row.reporter_event_id, ...row.source_event_ids].map((id) => personOf.get(id)).filter((p): p is string => Boolean(p)))];
    if (!personOf.has(row.reporter_event_id) || people.length === 0) continue;
    out.push({ kind: row.kind, text: clip(row.message, 240), people, event_id: row.reporter_event_id });
  }
  return out;
}

export async function searchSessions(ctx: ToolContext, query: string, modules: string[]): Promise<{ events: EventRecord[]; knowledge: KnowledgeEntry[] }> {
  const hits = await ctx.api.search(ctx.workspace, query, modules, [], 12);
  const pks = [...new Set(hits.map((h) => h.session_pk).filter((pk): pk is number => pk !== null))];
  const knowledgeIds = hits.filter((h) => h.doc_type === "knowledge").map((h) => h.doc_id);
  const [sessions, knowledge] = await Promise.all([
    pks.length ? ctx.api.sessions(ctx.workspace, { session_pks: pks, limit: 50 }) : Promise.resolve([] as EventRecord[]),
    knowledgeIds.length ? ctx.api.knowledge(ctx.workspace, { ids: knowledgeIds }) : Promise.resolve([] as KnowledgeEntry[]),
  ]);
  const order = new Map(pks.map((pk, i) => [pk, i]));
  const events = sessions.sort((a, b) => (order.get(a.session_pk) ?? 0) - (order.get(b.session_pk) ?? 0)).slice(0, 8);
  return { events, knowledge };
}
