import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { ReportStatus } from "@mesh/contract";
import { createAgentRunner } from "../src/agent/run.js";
import { blockerRows, groupBlockers, tallyPeople, topPerformers } from "../src/agent/analytics.js";
import { periodRange, toneOf } from "../src/agent/time.js";
import type { EventRecord } from "../src/api/types.js";
import { createPgliteDb } from "../src/db/client.js";
import { DEV_WS } from "../src/fixtures/billing.js";
import { BANKER_MARKERS, demoSeed, PRIVATE_MARKER } from "../src/fixtures/demo.js";
import { ask } from "../src/intelligence/ask.js";
import { loadSeed } from "../src/seed.js";
import { buildDeps } from "../src/server.js";
import type { AppDeps } from "../src/deps.js";

type Body = { messages: Array<{ role: string; content: string | null; tool_calls?: unknown; reasoning_details?: unknown }> };

function reply(message: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", ...message } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200 });
}

const toolCall = (name: string, args: unknown, id = "call_1") => ({
  content: null,
  reasoning_details: [{ type: "reasoning.text", text: "keep me" }],
  tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
});

let deps: AppDeps;
const bodies: Body[] = [];

function agentDeps(fetchImpl: typeof fetch) {
  return createAgentRunner({ api: deps.api, config: { ...deps.config, openrouterApiKey: "test-key" }, clock: deps.clock, log: () => undefined, fetchImpl, backoffMs: 1 });
}

before(async () => {
  deps = await buildDeps({ db: await createPgliteDb(), llm: null, agent: null, log: () => undefined });
  await loadSeed(deps, demoSeed());
});
after(async () => deps.db.close());

describe("agent loop", () => {
  it("runs a tool then answers with blocks, steps and verified citations", async () => {
    let calls = 0;
    const fake: typeof fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Body;
      bodies.push(body);
      calls++;
      if (calls === 1) return reply(toolCall("team_report", { period: "week", workspace: "northbank-deals" }));
      const toolMessage = body.messages.find((m) => m.role === "tool")?.content ?? "";
      const id = toolMessage.match(/evt_[A-Za-z0-9]+/)?.[0] ?? "";
      return reply({ content: `**Jules** is blocked on SSO [${id}] and also see [evt_doesnotexist].` });
    };
    const out = await ask({ ...deps, agent: agentDeps(fake) }, DEV_WS, "give me this week's sprint report");
    assert.equal(out.degraded, undefined);
    assert.equal(out.no_record, false);
    assert.equal(out.model, deps.config.agentModel);
    assert.equal(out.citations.length, 1);
    assert.ok(!out.answer.includes("doesnotexist"));
    assert.ok(out.answer.includes(out.citations[0] ?? "?"));
    assert.ok(out.sources.length >= 1);
    assert.deepEqual(out.steps?.map((s) => s.tool), ["team_report", null]);
    assert.equal(out.steps?.[0]?.label, "Building the sprint report");
    const types = (out.blocks ?? []).map((b) => b.type);
    assert.ok(types.includes("kpis") && types.includes("status"));
    assert.ok(types.indexOf("kpis") < types.indexOf("status"));
    const second = bodies.at(-1)!.messages;
    const assistant = second.find((m) => m.role === "assistant");
    assert.deepEqual(assistant?.reasoning_details, [{ type: "reasoning.text", text: "keep me" }]);
    const everything = JSON.stringify([out, second]);
    assert.ok(!everything.includes(PRIVATE_MARKER) && !everything.includes("Kai Brennan"));
    assert.ok(!BANKER_MARKERS.some((m) => everything.includes(m)));
    assert.ok(!everything.includes("test-key"));
  });

  it("recovers from an unknown person with a tool error the model can read", async () => {
    let calls = 0;
    const seen: string[] = [];
    const fake: typeof fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Body;
      calls++;
      if (calls === 1) return reply(toolCall("person_activity", { person: "Nobody Real" }));
      if (calls === 2) {
        seen.push(body.messages.filter((m) => m.role === "tool").at(-1)?.content ?? "");
        return reply(toolCall("person_activity", { person: "jules" }, "call_2"));
      }
      return reply({ content: "Jules is blocked on the staging SSO cookie." });
    };
    const out = await ask({ ...deps, agent: agentDeps(fake) }, DEV_WS, "what is Jules doing");
    assert.match(seen[0] ?? "", /Unknown person/);
    assert.match(seen[0] ?? "", /Jules Moreau/);
    assert.equal(out.steps?.filter((s) => s.tool === "person_activity").length, 2);
    assert.ok(out.blocks?.some((b) => b.type === "person" && b.person === "Jules Moreau"));
  });

  it("falls back to the classic path and marks the answer degraded when the model fails", async () => {
    let calls = 0;
    const fake: typeof fetch = async () => {
      calls++;
      return new Response("upstream down", { status: 500 });
    };
    const out = await ask({ ...deps, agent: agentDeps(fake) }, DEV_WS, "why do webhook retries fail");
    assert.equal(calls, 2);
    assert.equal(out.degraded, "The AI agent was unavailable, so this lists the matching records.");
    assert.ok(out.answer.length > 0);
    assert.equal(out.blocks, undefined);
  });
});

const rec = (over: Partial<EventRecord>): EventRecord =>
  ({
    event_id: "evt_x", session_pk: 1, event_ids: [], person: "Ana", status: ReportStatus.done, status_since: "2026-10-03T08:00:00.000Z", summary: null, task: "t",
    modules: [], blockers: [], first_seen_at: "2026-10-03T08:00:00.000Z", last_seen_at: "2026-10-03T09:00:00.000Z", ticket_ref: null, ...over,
  }) as EventRecord;

describe("analytics", () => {
  const now = new Date("2026-10-03T12:00:00.000Z");
  it("applies the stuck rule after 60 minutes blocked", () => {
    assert.equal(toneOf({ status: ReportStatus.blocked, status_since: "2026-10-03T11:30:00.000Z" }, now), "blocked");
    assert.equal(toneOf({ status: ReportStatus.blocked, status_since: "2026-10-03T10:00:00.000Z" }, now), "stuck");
    assert.equal(toneOf({ status: null, status_since: null }, now), "active");
  });
  it("ranks top performers and dedupes blockers", () => {
    const events = [
      rec({ person: "Ana", event_id: "evt_a1" }),
      rec({ person: "Bo", event_id: "evt_b1" }),
      rec({ person: "Bo", event_id: "evt_b2" }),
      rec({ person: "Jules", event_id: "evt_j1", status: ReportStatus.blocked, status_since: "2026-10-03T09:00:00.000Z", blockers: ["Staging SSO rejects the cookie"] }),
      rec({ person: "Sam", event_id: "evt_s1", status: ReportStatus.blocked, status_since: "2026-10-03T10:00:00.000Z", blockers: ["staging sso rejects the cookie."] }),
    ];
    assert.deepEqual(topPerformers(tallyPeople(events, now)).map((t) => t.person), ["Bo", "Ana"]);
    assert.equal(groupBlockers(events, now).length, 1);
    assert.deepEqual(groupBlockers(events, now)[0]?.people, ["Jules", "Sam"]);
    assert.equal(blockerRows(events, now)[0]?.person, "Jules");
  });
  it("builds period ranges", () => {
    const week = periodRange("week", now);
    assert.equal(week.since.toISOString(), "2026-09-27T00:00:00.000Z");
    assert.equal(periodRange("yesterday", now).until.toISOString(), "2026-10-03T00:00:00.000Z");
  });
});
