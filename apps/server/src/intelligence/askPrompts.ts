import { AskIntent, PlanSource, type AskPlan, type EventRecord, type KnowledgeEntry } from "../api/types.js";
import { redactDeep } from "../redact.js";
import { clip, keywords, shortDate, slugify } from "../text.js";

export const PLAN_SYSTEM = `You turn a question about a team's agent work reports into a search plan. Respond with JSON only.
- intent: "status" (what someone is doing or how work stands), "why" (reasons, decisions, how something works, what failed), "onboarding" (getting up to speed on an area or module), or "other".
- person: one name from the people list, or null. Never invent a name.
- modules: values from the modules list that the question is about; [] if none fit.
- keywords: 2 to 8 search words from the question (errors, components, technologies).
- since_days: how many days back the question asks about, or null for no limit.`;

export const PLAN_SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: Object.values(AskIntent) },
    person: { anyOf: [{ type: "string" }, { type: "null" }] },
    modules: { type: "array", items: { type: "string" } },
    keywords: { type: "array", items: { type: "string" } },
    since_days: { anyOf: [{ type: "integer" }, { type: "null" }] },
  },
  required: ["intent", "person", "modules", "keywords", "since_days"],
  additionalProperties: false,
};

export const ANSWER_SYSTEM = `You answer a project manager's question using only the records provided: agent work reports (events, ids look like evt_3f2a...) and exit-interview answers (knowledge entries). Respond with JSON only.
- answer: 2 to 6 sentences or a short list. Use the people's names and dates from the records. After each claim, cite its record id in square brackets, for example [evt_3f2a...]. Do not use any knowledge outside the records.
- no_record: true when the records do not answer the question. Then start the answer with "No record" and say briefly what is missing.
- cited_ids: every id you cited.`;

export const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    no_record: { type: "boolean" },
    cited_ids: { type: "array", items: { type: "string" } },
  },
  required: ["answer", "no_record", "cited_ids"],
  additionalProperties: false,
};

export interface PlanInput {
  question: string;
  today: string;
  people: string[];
  modules: string[];
  tags: string[];
}

export function heuristicPlan(input: PlanInput): AskPlan {
  const q = input.question.toLowerCase();
  const person =
    input.people.find((p) => q.includes(p.toLowerCase())) ??
    input.people.find((p) => {
      const first = p.toLowerCase().split(/\s+/)[0] ?? "";
      return first.length >= 3 && new RegExp(`\\b${first}\\b`).test(q);
    }) ??
    null;
  const words = new Set(keywords(input.question, 40).map((w) => slugify(w)));
  const modules = input.modules.filter((m) => q.includes(m.replace(/-/g, " ")) || q.includes(m) || words.has(m));
  const intent = /onboard|get started|new to|getting up to speed|history of|before touching|what should i know/.test(q)
    ? AskIntent.onboarding
    : /working on|doing|status|stuck|blocked|progress|up to/.test(q) && !/\bwhy\b/.test(q)
      ? AskIntent.status
      : AskIntent.why;
  const sinceDays = /today/.test(q) ? 1 : /this week|past week|last week/.test(q) ? 7 : null;
  return { intent, person, modules, keywords: keywords(input.question, 8), since_days: sinceDays, source: PlanSource.heuristic };
}

export interface AnswerInput {
  question: string;
  events: Array<Record<string, unknown>>;
  knowledge: Array<Record<string, unknown>>;
}

export function compactEvent(e: EventRecord) {
  return {
    id: e.event_id ?? `session-${e.session_pk}`,
    person: e.person,
    status: e.status,
    task: e.task,
    summary: e.summary ? clip(e.summary, 400) : null,
    modules: e.modules,
    ticket: e.ticket_ref,
    started: shortDate(e.first_seen_at),
    last_update: shortDate(e.last_report_at ?? e.last_seen_at),
    decisions: e.decisions.slice(-6).map((d) => ({ choice: d.choice, reason: d.reason, date: shortDate(d.ts) })),
    dead_ends: e.dead_ends.slice(-6).map((d) => ({ attempt: d.attempt, reason: d.reason, date: shortDate(d.ts) })),
    human_corrections: e.human_corrections.slice(-4).map((c) => ({ correction: c.correction, reason: c.reason, date: shortDate(c.ts) })),
    blockers: e.blockers,
    files: e.artifacts.filter((a) => a.kind === "file").slice(0, 6).map((a) => a.ref),
    artifacts: e.artifacts.filter((a) => a.kind !== "file").slice(0, 6).map((a) => `${a.kind}: ${a.ref}`),
  };
}

export function compactKnowledge(k: KnowledgeEntry) {
  return { id: k.entry_id, person: k.person, module: k.module, question: k.question, answer: clip(k.answer, 800), date: shortDate(k.created_at) };
}

export function answerInput(question: string, events: EventRecord[], knowledge: KnowledgeEntry[]): AnswerInput {
  return redactDeep({ question, events: events.map(compactEvent), knowledge: knowledge.map(compactKnowledge) });
}

export function listingAnswer(events: EventRecord[], knowledge: KnowledgeEntry[]): { answer: string; cited: string[] } {
  const lines = [
    ...events.slice(0, 6).map((e) => {
      const status = e.status ? e.status.replace("_", " ") : "active";
      return `- ${e.person}: ${e.task ?? "session"} (${status}, ${shortDate(e.last_report_at ?? e.last_seen_at)}). ${e.summary ?? ""} [${e.event_id ?? `session-${e.session_pk}`}]`;
    }),
    ...knowledge.slice(0, 3).map((k) => `- ${k.person} (exit interview): ${clip(k.answer, 200)} [${k.entry_id}]`),
  ];
  return {
    answer: `Matching records:\n${lines.join("\n")}`,
    cited: [...events.slice(0, 6).map((e) => e.event_id ?? `session-${e.session_pk}`), ...knowledge.slice(0, 3).map((k) => k.entry_id)],
  };
}
