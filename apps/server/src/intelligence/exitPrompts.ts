import type { CoverageModule, EventRecord } from "../api/types.js";
import { redactDeep } from "../redact.js";
import { clip, shortDate } from "../text.js";

export const EXIT_SYSTEM = `You prepare an exit interview for a teammate who is leaving. You get the modules where they are the main or only contributor, how little reasoning they recorded there, and their own work reports. Respond with JSON only.

Write 5 to 8 questions that capture knowledge the team will lose. Each question:
- is grounded in a specific report of theirs: name the approach, decision, correction, file or date, for example "You abandoned approach X on Sept 3. Why, and what breaks if someone retries it?"
- targets the gaps: hidden dependencies, why something was decided, what fails if it changes, what they would tell the next owner
- is answerable in a few sentences, one topic per question
- module: the module it is about, from the coverage list
- rationale: one short sentence on why this question matters
- source_event_ids: ids of the reports it is based on, copied exactly`;

export const EXIT_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          module: { type: "string" },
          rationale: { type: "string" },
          source_event_ids: { type: "array", items: { type: "string" } },
        },
        required: ["question", "module", "rationale", "source_event_ids"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

export interface ExitPromptEvent {
  id: string;
  date: string;
  modules: string[];
  task: string | null;
  summary: string | null;
  decisions: Array<{ choice: string; reason: string; date: string }>;
  dead_ends: Array<{ attempt: string; reason: string; date: string }>;
  human_corrections: Array<{ correction: string; reason: string; date: string }>;
  files: string[];
}

export interface ExitPrompt {
  person: string;
  coverage: Array<Pick<CoverageModule, "module" | "person_sessions" | "total_sessions" | "reasoning_per_session" | "reason">>;
  events: ExitPromptEvent[];
}

export interface DraftQuestion {
  question: string;
  module: string;
  rationale: string;
  source_event_ids: string[];
}

export function buildExitPrompt(person: string, coverage: CoverageModule[], events: EventRecord[]): ExitPrompt {
  return redactDeep({
    person,
    coverage: coverage.map((c) => ({
      module: c.module,
      person_sessions: c.person_sessions,
      total_sessions: c.total_sessions,
      reasoning_per_session: c.reasoning_per_session,
      reason: c.reason,
    })),
    events: events.map((e) => ({
      id: e.event_id ?? `session-${e.session_pk}`,
      date: shortDate(e.first_seen_at),
      modules: e.modules,
      task: e.task,
      summary: e.summary ? clip(e.summary, 300) : null,
      decisions: e.decisions.map((d) => ({ choice: d.choice, reason: d.reason, date: shortDate(d.ts) })),
      dead_ends: e.dead_ends.map((d) => ({ attempt: d.attempt, reason: d.reason, date: shortDate(d.ts) })),
      human_corrections: e.human_corrections.map((c) => ({ correction: c.correction, reason: c.reason, date: shortDate(c.ts) })),
      files: e.artifacts.filter((a) => a.kind === "file").map((a) => a.ref).slice(0, 5),
    })),
  });
}

const pretty = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function templateQuestions(prompt: ExitPrompt): DraftQuestion[] {
  const modules = new Set(prompt.coverage.map((c) => c.module));
  const moduleOf = (e: ExitPromptEvent) => e.modules.find((m) => modules.has(m)) ?? e.modules[0] ?? "general";
  const out: DraftQuestion[] = [];
  for (const e of prompt.events) {
    for (const d of e.dead_ends) {
      out.push({
        question: `You abandoned "${d.attempt}" on ${pretty(d.date)}. Why, and what breaks if someone retries it?`,
        module: moduleOf(e),
        rationale: "Dead ends are the knowledge most likely to be rediscovered the hard way.",
        source_event_ids: [e.id],
      });
    }
    for (const d of e.decisions) {
      out.push({
        question: `You decided to "${d.choice}". What else depends on that, and what would break if someone changed it?`,
        module: moduleOf(e),
        rationale: "Decisions with hidden dependencies break silently when the owner is gone.",
        source_event_ids: [e.id],
      });
    }
    for (const c of e.human_corrections) {
      out.push({
        question: `You were corrected to "${c.correction}". What is the rule behind it that a newcomer should know?`,
        module: moduleOf(e),
        rationale: "Human corrections capture team rules that agents and newcomers will not infer.",
        source_event_ids: [e.id],
      });
    }
  }
  for (const c of prompt.coverage.slice(0, 2)) {
    const ids = prompt.events.filter((e) => e.modules.includes(c.module)).slice(-3).map((e) => e.id);
    if (ids.length === 0) continue;
    out.push({
      question: `You ran most of the ${c.module} work. What should the next owner read first, and what would you warn them about?`,
      module: c.module,
      rationale: c.reason,
      source_event_ids: ids,
    });
  }
  return out.slice(0, 8);
}
