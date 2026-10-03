import { z } from "zod";
import { ReportStatus } from "@mesh/contract";
import { AskIntent, PlanSource, type AskPlan, type AskResponse, type EventRecord, type KnowledgeEntry } from "../api/types.js";
import type { AppDeps } from "../deps.js";
import { LlmPurpose } from "../llm/types.js";
import { redact } from "../redact.js";
import { clip, keywords } from "../text.js";
import { askWithAgent, AGENT_DEGRADED } from "./askAgent.js";
import { ANSWER_SCHEMA, ANSWER_SYSTEM, answerInput, heuristicPlan, listingAnswer, PLAN_SCHEMA, PLAN_SYSTEM, type PlanInput } from "./askPrompts.js";

const PlanSchema = z.object({
  intent: z.enum(AskIntent),
  person: z.string().nullable(),
  modules: z.array(z.string()),
  keywords: z.array(z.string()),
  since_days: z.number().int().nullable(),
});

const AnswerSchema = z.object({ answer: z.string(), no_record: z.boolean(), cited_ids: z.array(z.string()) });

const NO_RECORD = "No record: the shared reports in this workspace do not cover that question.";

async function plan(deps: AppDeps, ws: string, question: string): Promise<AskPlan> {
  const vocab = await deps.api.vocabulary(ws);
  const input: PlanInput = { question, today: deps.clock().toISOString().slice(0, 10), ...vocab };
  if (!deps.llm) return heuristicPlan(input);
  try {
    const raw = await deps.llm.completeJson({
      purpose: LlmPurpose.plan,
      model: deps.config.warnModel,
      system: PLAN_SYSTEM,
      user: JSON.stringify(input),
      schema: PLAN_SCHEMA,
      maxTokens: 400,
      temperature: 0,
      timeoutMs: 15_000,
    });
    const p = PlanSchema.parse(raw);
    return {
      intent: p.intent,
      person: p.person && vocab.people.includes(p.person) ? p.person : null,
      modules: p.modules.filter((m) => vocab.modules.includes(m)),
      keywords: p.keywords.flatMap((k) => keywords(k, 4)).slice(0, 10),
      since_days: p.since_days && p.since_days > 0 ? p.since_days : null,
      source: PlanSource.llm,
    };
  } catch (error) {
    deps.log(`ask: planner fell back to heuristics: ${(error as Error).message}`);
    return heuristicPlan(input);
  }
}

async function searchRecords(deps: AppDeps, ws: string, text: string, modules: string[]) {
  const hits = await deps.api.search(ws, text, modules, [], 12);
  const pks = [...new Set(hits.map((h) => h.session_pk).filter((pk): pk is number => pk !== null))];
  const knowledgeIds = hits.filter((h) => h.doc_type === "knowledge").map((h) => h.doc_id);
  const [sessions, knowledge] = await Promise.all([
    pks.length ? deps.api.sessions(ws, { session_pks: pks, limit: 50 }) : Promise.resolve([] as EventRecord[]),
    knowledgeIds.length ? deps.api.knowledge(ws, { ids: knowledgeIds }) : Promise.resolve([] as KnowledgeEntry[]),
  ]);
  const order = new Map(pks.map((pk, i) => [pk, i]));
  return { events: sessions.sort((a, b) => (order.get(a.session_pk) ?? 0) - (order.get(b.session_pk) ?? 0)).slice(0, 8), knowledge };
}

async function fetchRecords(deps: AppDeps, ws: string, question: string, p: AskPlan) {
  const since = p.since_days ? new Date(deps.clock().getTime() - p.since_days * 86_400_000).toISOString() : null;
  const text = [question, ...p.keywords].join(" ");
  if (p.intent === AskIntent.status && p.person) {
    return { events: await deps.api.sessions(ws, { person: p.person, since, reported: true, limit: 8 }), knowledge: [] };
  }
  if (p.intent === AskIntent.status && p.modules.length === 0 && /blocked|stuck/i.test(question)) {
    return { events: await deps.api.sessions(ws, { status: ReportStatus.blocked, limit: 8 }), knowledge: [] };
  }
  if (p.intent === AskIntent.onboarding && p.modules[0]) {
    const events = await deps.api.sessions(ws, { module: p.modules[0], reported: true, limit: 30 });
    return { events, knowledge: await deps.api.knowledge(ws, { modules: [p.modules[0]] }) };
  }
  const found = await searchRecords(deps, ws, text, p.modules);
  if (found.events.length >= 2 || p.modules.length === 0) return found;
  return searchRecords(deps, ws, text, []);
}

const idOf = (e: EventRecord) => e.event_id ?? `session-${e.session_pk}`;

async function askClassic(deps: AppDeps, ws: string, rawQuestion: string): Promise<AskResponse> {
  const question = clip(redact(rawQuestion), 500);
  const p = await plan(deps, ws, question);
  const { events, knowledge } = await fetchRecords(deps, ws, question, p);
  if (events.length === 0 && knowledge.length === 0) {
    return { answer: NO_RECORD, no_record: true, citations: [], sources: [], knowledge: [], plan: p };
  }
  const listing = () => {
    const l = listingAnswer(events, knowledge);
    return { answer: l.answer, no_record: false, citations: l.cited, sources: events.slice(0, 6), knowledge: knowledge.slice(0, 3), plan: p };
  };
  if (!deps.llm) return listing();
  try {
    const raw = await deps.llm.completeJson({
      purpose: LlmPurpose.answer,
      model: deps.config.answerModel,
      system: ANSWER_SYSTEM,
      user: JSON.stringify(answerInput(question, events, knowledge)),
      schema: ANSWER_SCHEMA,
      maxTokens: 8000,
      effort: "low",
      timeoutMs: deps.config.answerTimeoutMs,
    });
    const a = AnswerSchema.parse(raw);
    const answer = redact(a.answer);
    const known = new Set([...events.map(idOf), ...knowledge.map((k) => k.entry_id)]);
    const citations = [...new Set([...a.cited_ids, ...[...known].filter((id) => answer.includes(id))])].filter((id) => known.has(id));
    if (a.no_record) return { answer, no_record: true, citations: [], sources: [], knowledge: [], plan: p };
    return {
      answer,
      no_record: false,
      citations,
      sources: events.filter((e) => citations.includes(idOf(e))),
      knowledge: knowledge.filter((k) => citations.includes(k.entry_id)),
      plan: p,
    };
  } catch (error) {
    deps.log(`ask: answer model failed, listing records: ${(error as Error).message}`);
    return { ...listing(), degraded: "The answer model failed, so this lists the matching records." };
  }
}

export async function ask(deps: AppDeps, ws: string, rawQuestion: string): Promise<AskResponse> {
  const question = clip(redact(rawQuestion), 500);
  if (!deps.agent) return askClassic(deps, ws, question);
  const answered = await askWithAgent(deps, deps.agent, ws, question);
  if (answered) return answered;
  return { ...(await askClassic(deps, ws, question)), degraded: AGENT_DEGRADED };
}
