import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPgliteDb } from "../src/db/client.js";
import { DEV_WS } from "../src/fixtures/billing.js";
import { BANKER_MARKERS, demoSeed, demoSteps, PRIVATE_MARKER } from "../src/fixtures/demo.js";
import { ask } from "../src/intelligence/ask.js";
import { generateQuestions } from "../src/intelligence/exitInterview.js";
import type { LlmClient, LlmRequest } from "../src/llm/types.js";
import { reportProgress } from "../src/reportProgress.js";
import { loadSeed } from "../src/seed.js";
import { buildDeps } from "../src/server.js";
import { onboarding, warningCards } from "../src/views.js";
import type { AppDeps } from "../src/deps.js";

class RecordingLlm implements LlmClient {
  readonly mode = "test" as const;
  readonly calls: LlmRequest[] = [];
  async completeJson(req: LlmRequest): Promise<unknown> {
    this.calls.push(req);
    if (req.purpose === "plan") return { intent: "why", person: null, modules: ["billing"], keywords: ["webhook", "retry"], since_days: null };
    if (req.purpose === "answer") return { answer: "No record", no_record: true, cited_ids: [] };
    return { questions: [] };
  }
}

let deps: AppDeps;
const llm = new RecordingLlm();

before(async () => {
  deps = await buildDeps({ db: await createPgliteDb(), llm, log: () => undefined });
  await loadSeed(deps, demoSeed());
  await reportProgress(deps, demoSteps.devBCollision());
});
after(async () => deps.db.close());

const clean = (label: string, value: unknown) => {
  const text = JSON.stringify(value);
  assert.ok(!text.includes(PRIVATE_MARKER) && !text.includes("Kai Brennan"), `private data in ${label}`);
  assert.ok(!BANKER_MARKERS.some((m) => text.includes(m)), `other workspace in ${label}`);
};

describe("private sessions and other workspaces never surface", () => {
  it("feed, people, vocabulary, warnings, onboarding, tickets", async () => {
    clean("feed", await deps.api.sessions(DEV_WS, {}));
    clean("people", await deps.api.people(DEV_WS));
    clean("vocabulary", await deps.api.vocabulary(DEV_WS));
    clean("warnings", await warningCards(deps, DEV_WS));
    clean("onboarding", await onboarding(deps, DEV_WS, "billing"));
    clean("tickets", await deps.api.tickets(DEV_WS, { include_closed: true }));
    clean("search", await deps.api.search(DEV_WS, "webhook retry pay bands salary", ["billing", "webhooks"], [], 20));
  });
  it("no prompt sent to the LLM contains private or foreign data", async () => {
    await ask(deps, DEV_WS, "Why do webhook retries fail, and what about pay bands?");
    await generateQuestions(deps, DEV_WS, "Marta Silva", true);
    assert.ok(llm.calls.length >= 2, "expected LLM calls");
    for (const call of llm.calls) clean(`${call.purpose} prompt`, call);
  });
  it("a private report gets no warnings", async () => {
    const out = await reportProgress(deps, { ...demoSteps.devBCollision(), session_id: "bo-private", visibility: "private" });
    assert.deepEqual(out.warnings, []);
  });
});
