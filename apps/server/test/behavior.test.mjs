import assert from "node:assert/strict";
import { before, test } from "node:test";
import { createDb, rejects } from "./helpers.mjs";

let ctx;
let aliceEvent;
let alicePk;
const base = { workspace: "acme", client: "claude-code", status: "in_progress" };

before(async () => {
  ctx = await createDb();
});

test("a turn ping creates a session without a report and blocks hijacking", async () => {
  await ctx.rpc("touch_session", { ...base, person: "alice", session_id: "s1" });
  assert.equal((await ctx.q("select 1 from reports")).length, 0);
  await rejects(ctx.rpc("touch_session", { ...base, person: "bob", session_id: "s1" }), "42501");
});

test("report_progress appends every turn and keeps the latest session state", async () => {
  const first = await ctx.rpc("report_progress", {
    ...base,
    person: "alice",
    session_id: "s1",
    task: "Fix billing retries",
    summary: "Investigating double charges on invoice retries",
    modules: ["billing"],
    tags: ["payments"],
    artifacts: [{ kind: "file", ref: "src/billing/retry.ts", label: "retry logic" }],
    dead_ends: [{ attempt: "Polling the Stripe API from a cron job to detect failed invoices", reason: "Hit rate limits and missed events" }],
    decisions: [{ choice: "Use Stripe webhooks with an idempotency key for invoice retries", reason: "Avoids double charges" }],
  });
  aliceEvent = first.event_id;
  assert.deepEqual(first.warnings, []);
  await ctx.rpc("report_progress", {
    ...base,
    person: "alice",
    session_id: "s1",
    summary: "Tests written",
    blockers: ["Staging Stripe key expired"],
  });
  const [session] = await ctx.q("select * from sessions where session_id = 's1'");
  alicePk = session.id;
  assert.equal(session.report_count, 2);
  assert.equal(session.task, "Fix billing retries");
  assert.equal((await ctx.q("select 1 from report_items")).length, 3);
  assert.equal((await ctx.q("select 1 from search_documents")).length, 5);
});

test("a second person gets collision and rediscovery warnings once", async () => {
  const payload = {
    ...base,
    person: "bob",
    session_id: "b1",
    task: "Stripe invoice sync",
    summary: "Working on invoice failures",
    modules: ["billing"],
    dead_ends: [{ attempt: "Polling the Stripe API with a cron job for failed invoices", reason: "rate limit" }],
  };
  const first = await ctx.rpc("report_progress", payload);
  const kinds = first.warnings.map((w) => w.kind).sort();
  assert.deepEqual(kinds, ["collision", "rediscovery"]);
  assert.deepEqual(first.warnings.find((w) => w.kind === "rediscovery").source_event_ids, [aliceEvent]);
  assert.equal((await ctx.q("select 1 from warnings")).length, 2);
  const repeat = await ctx.rpc("report_progress", payload);
  assert.deepEqual(repeat.warnings, []);
});

test("a person is never warned about their own work", async () => {
  const result = await ctx.rpc("report_progress", {
    ...base,
    person: "alice",
    session_id: "s1",
    summary: "again",
    modules: ["billing"],
    dead_ends: [{ attempt: "Polling the Stripe API from a cron job to detect failed invoices", reason: "x" }],
  });
  for (const warning of result.warnings) {
    assert.ok(!warning.message.startsWith("alice"));
  }
});

test("private sessions never reach warnings or search", async () => {
  await ctx.rpc("report_progress", {
    ...base,
    person: "carol",
    session_id: "c1",
    visibility: "private",
    summary: "private billing experiment with webhooks",
    modules: ["billing"],
    dead_ends: [{ attempt: "Secret approach to Stripe webhook idempotency keys failed badly", reason: "r" }],
  });
  const dave = await ctx.rpc("report_progress", {
    ...base,
    person: "dave",
    session_id: "d1",
    summary: "billing work",
    modules: ["billing"],
    dead_ends: [{ attempt: "Stripe webhook idempotency keys approach failed", reason: "r" }],
  });
  assert.ok(!dave.warnings.some((w) => /carol|Secret/.test(w.message)));
  const hits = await ctx.q("select person from search_knowledge('acme', 'Stripe webhook idempotency', '{}', '{}', 20)");
  assert.ok(!hits.some((h) => h.person === "carol"));
  const history = await ctx.q("select person from module_history('acme', 'billing')");
  assert.ok(!history.some((h) => h.person === "carol"));
});

test("search survives hostile input and stays inside the workspace", async () => {
  for (const input of ['why -does "billing: retry"', '"', "a:b -c (d", "", "'; drop table people; --", "& | !"]) {
    await ctx.q("select * from search_knowledge('acme', $1)", [input]);
  }
  const ranked = await ctx.q("select score from search_knowledge('acme', 'why do invoice retries use webhooks?', '{billing}', '{}', 8)");
  assert.ok(ranked.length > 0);
  assert.ok(ranked.every((row, i) => i === 0 || ranked[i - 1].score >= row.score));
  assert.equal((await ctx.q("select * from search_knowledge('other', 'invoice webhooks', '{billing}')")).length, 0);
  const byArtifact = await ctx.q("select 1 from search_knowledge('acme', 'zzzz nothing', '{}', '{src/billing/retry.ts}')");
  assert.ok(byArtifact.length > 0);
});

test("reports, items and knowledge are append-only", async () => {
  await rejects(ctx.q("update reports set summary = 'tampered'"), "55000");
  await rejects(ctx.q("delete from report_items"), "55000");
  await rejects(ctx.q("update report_items set text = 'x'"), "55000");
});

test("visibility changes cascade and mismatched children are rejected", async () => {
  await ctx.rpc("report_progress", { ...base, person: "alice", session_id: "s1", visibility: "private", summary: "went private" });
  for (const table of ["reports", "report_items", "search_documents"]) {
    assert.equal((await ctx.q(`select 1 from ${table} where session_pk = $1 and visibility = 'shared'`, [alicePk])).length, 0);
  }
  const insert = (workspace, visibility) =>
    ctx.q("insert into reports (session_pk, workspace, visibility, status, summary, raw_json) values ($1, $2, $3, 'done', 'x', '{}')", [
      alicePk,
      workspace,
      visibility,
    ]);
  await rejects(insert("acme", "shared"));
  await rejects(insert("evil", "private"));
  await ctx.rpc("report_progress", { ...base, person: "alice", session_id: "s1", visibility: "shared", summary: "back" });
});

test("invalid input is rejected and rolled back whole", async () => {
  await rejects(ctx.rpc("report_progress", { ...base, person: "x", session_id: "z", status: "done" }), "22023");
  await rejects(ctx.rpc("report_progress", { ...base, person: "x", session_id: "z", summary: "s", status: "weird" }));
  await rejects(ctx.rpc("report_progress", { ...base, person: "x", session_id: "z", summary: "s", items: [{ kind: "nope", text: "t" }] }));
  assert.equal((await ctx.q("select 1 from sessions where session_id = 'z'")).length, 0);
});

test("alternate payload shapes and unknown keys are tolerated", async () => {
  const result = await ctx.rpc("report_progress", {
    workspace: "acme",
    client: "cursor",
    person: "erin",
    session_id: "e1",
    status: "blocked",
    summary: "alt shape",
    future_field: { anything: 1 },
    modules: ["auth"],
    decisions: [{ choice: "Use JWT", reason: "stateless" }, "Plain string decision"],
    blockers: ["Waiting on key rotation", ""],
    artifacts: ["src/auth/jwt.ts", { type: "document", path: "docs/auth.md", name: "Auth doc" }],
  });
  const items = await ctx.q("select kind from report_items where report_id = $1", [result.event_id]);
  assert.equal(items.length, 3);
  const artifacts = await ctx.q("select kind, label from session_artifacts where session_pk = $1 order by ref", [result.session_pk]);
  assert.deepEqual(artifacts, [
    { kind: "document", label: "Auth doc" },
    { kind: "file", label: null },
  ]);
  const raw = await ctx.q("select raw_json->'future_field' as f from reports where id = $1", [result.event_id]);
  assert.equal(raw[0].f.anything, 1);
});

test("knowledge, targeting, history and vocabulary read back correctly", async () => {
  await ctx.q("select record_knowledge($1::jsonb)", [
    JSON.stringify({
      workspace: "acme",
      person: "alice",
      module: "billing",
      question: "Why do we use webhooks instead of polling?",
      answer: "Polling hit Stripe rate limits and missed events.",
      source: "exit_interview",
      source_event_ids: [aliceEvent],
    }),
  ]);
  await rejects(ctx.rpc("record_knowledge", { workspace: "acme", person: "alice", question: "q", answer: "a", source: "chat" }));
  const found = await ctx.q("select doc_type from search_knowledge('acme', 'why polling instead of webhooks')");
  assert.ok(found.some((r) => r.doc_type === "knowledge"));
  const targets = await ctx.q("select * from exit_interview_targets('acme', 'alice')");
  assert.ok(targets.some((t) => t.module === "billing"));
  const history = await ctx.q("select source, ts from module_history('acme', 'billing')");
  for (const source of ["report", "item", "knowledge"]) {
    assert.ok(history.some((h) => h.source === source));
  }
  const times = history.map((h) => +new Date(h.ts));
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
  const vocabulary = (await ctx.q("select workspace_vocabulary('acme') as v"))[0].v;
  assert.ok(vocabulary.people.includes("alice"));
  assert.ok(vocabulary.modules.includes("billing"));
  assert.ok(vocabulary.tags.includes("payments"));
});

test("renaming a person cascades without breaking append-only tables", async () => {
  await ctx.q("update people set name = 'alicia' where workspace = 'acme' and name = 'alice'");
  assert.equal((await ctx.q("select 1 from knowledge_entries where person = 'alicia'")).length, 1);
  assert.ok((await ctx.q("select 1 from search_documents where person = 'alicia'")).length > 0);
});
