import { z } from "zod";
import type { ExitInterviewResponse, KnowledgeEntry } from "../api/types.js";
import { coverageFromTargets } from "../db/meshApi.js";
import type { AppDeps } from "../deps.js";
import { LlmPurpose } from "../llm/types.js";
import { redact } from "../redact.js";
import { ValidationError } from "../schemas.js";
import { clip } from "../text.js";
import { buildExitPrompt, EXIT_SCHEMA, EXIT_SYSTEM, templateQuestions, type DraftQuestion } from "./exitPrompts.js";

const QuestionsSchema = z.object({
  questions: z.array(z.object({ question: z.string(), module: z.string(), rationale: z.string(), source_event_ids: z.array(z.string()) })),
});

export async function exitInterview(deps: AppDeps, ws: string, person: string): Promise<ExitInterviewResponse> {
  const [people, targets, stored] = await Promise.all([
    deps.api.people(ws),
    deps.api.exitTargets(ws, person),
    deps.api.exitQuestions(ws, person),
  ]);
  const status = people.find((p) => p.person === person)?.status ?? "active";
  return { workspace: ws, person, status, coverage: coverageFromTargets(person, targets), questions: stored.questions, entries: stored.entries } as ExitInterviewResponse;
}

async function draftQuestions(deps: AppDeps, ws: string, person: string): Promise<DraftQuestion[]> {
  const coverage = coverageFromTargets(person, await deps.api.exitTargets(ws, person, 4));
  const focus = new Set(coverage.map((c) => c.module));
  const all = (await deps.api.sessions(ws, { person, reported: true, limit: 300 })).reverse();
  const events = (focus.size ? all.filter((e) => e.modules.some((m) => focus.has(m))) : all).slice(-40);
  if (events.length === 0) return [];
  const prompt = buildExitPrompt(person, coverage, events);
  const valid = new Set(events.flatMap((e) => e.event_ids));
  const keep = (drafts: DraftQuestion[]) =>
    drafts
      .map((d) => ({ ...d, source_event_ids: d.source_event_ids.filter((id) => valid.has(id)) }))
      .filter((d) => d.question.trim() && d.source_event_ids.length > 0)
      .slice(0, 8);
  if (!deps.llm) return keep(templateQuestions(prompt));
  try {
    const raw = await deps.llm.completeJson({
      purpose: LlmPurpose.exitQuestions,
      model: deps.config.answerModel,
      system: EXIT_SYSTEM,
      user: JSON.stringify(prompt),
      schema: EXIT_SCHEMA,
      maxTokens: 8000,
      effort: "medium",
      timeoutMs: deps.config.answerTimeoutMs,
    });
    const drafts = keep(QuestionsSchema.parse(raw).questions);
    return drafts.length >= 3 ? drafts : [...drafts, ...keep(templateQuestions(prompt))].slice(0, 8);
  } catch (error) {
    deps.log(`exit: question model failed, using the person's own records: ${(error as Error).message}`);
    return keep(templateQuestions(prompt));
  }
}

export async function generateQuestions(deps: AppDeps, ws: string, person: string, force = false): Promise<ExitInterviewResponse> {
  const stored = await deps.api.exitQuestions(ws, person);
  if (!force && stored.questions.some((q) => !q.answer)) return exitInterview(deps, ws, person);
  const drafts = await draftQuestions(deps, ws, person);
  await deps.api.replaceExitQuestions(
    ws,
    person,
    drafts.map((d) => ({ module: d.module, question: clip(redact(d.question), 500), rationale: clip(redact(d.rationale), 300), source_event_ids: d.source_event_ids })),
  );
  return exitInterview(deps, ws, person);
}

export async function saveAnswer(deps: AppDeps, ws: string, person: string, questionId: string, rawAnswer: string): Promise<KnowledgeEntry> {
  const answer = clip(redact(rawAnswer ?? ""), 4000);
  if (!/^\d+$/.test(questionId ?? "") || !answer) throw new ValidationError(["question_id and a non-empty answer are required"]);
  return deps.api.answerExitQuestion(ws, person, questionId, answer);
}
