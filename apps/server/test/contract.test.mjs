import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { before, test } from "node:test";
import { CONTRACT_SRC, createDb, parseContractEnums, rejects } from "./helpers.mjs";

let ctx;
let enums;

before(async () => {
  ctx = await createDb();
  enums = parseContractEnums();
});

const lookupTables = {
  ItemKind: ["item_kinds", "kind"],
  ReportStatus: ["session_statuses", "status"],
  PersonStatus: ["person_statuses", "status"],
  WarningKind: ["warning_kinds", "kind"],
  KnowledgeSource: ["knowledge_sources", "source"],
  DecisionArea: ["decision_areas", "area"],
};

for (const [name, [table, column]] of Object.entries(lookupTables)) {
  test(`${name} in @mesh/contract matches ${table}`, async () => {
    const rows = await ctx.q(`select ${column} as v from ${table} order by 1`);
    assert.deepEqual(
      rows.map((r) => r.v),
      enums[name],
    );
  });
}

test("every contract Client and Visibility value is accepted", async () => {
  for (const client of enums.Client) {
    for (const visibility of enums.Visibility) {
      const result = await ctx.rpc("touch_session", {
        workspace: "w",
        person: "p",
        client,
        session_id: `${client}-${visibility}`,
        visibility,
      });
      assert.ok(result.session_pk);
    }
  }
  await rejects(
    ctx.rpc("touch_session", { workspace: "w", person: "p", client: "codex", session_id: "bad", visibility: "public" }),
  );
});

test("item payload keys match the ReportProgressInput fields", async () => {
  const report = readFileSync(join(CONTRACT_SRC, "report.ts"), "utf8");
  const rows = await ctx.q("select payload_key from item_kinds order by 1");
  for (const { payload_key } of rows) {
    assert.match(report, new RegExp(`\\b${payload_key}\\??\\s*:`), `${payload_key} missing from report.ts`);
  }
});

const contractReport = {
  session_id: "sess-1",
  client: "claude-code",
  person: "Ana Lee",
  workspace: "acme-dev",
  visibility: "shared",
  ticket_ref: "BILL-12",
  task: "Fix invoice retries",
  status: "in_progress",
  summary: "Retries double charge customers.",
  artifacts: [{ kind: "file", ref: "src/billing/retry.ts", label: "retry logic" }],
  modules: ["billing"],
  tags: ["payments"],
  decisions: [{ area: "technical", choice: "Use webhooks", reason: "Avoids polling" }],
  dead_ends: [{ attempt: "Polled Stripe from cron", reason: "Rate limited" }],
  human_corrections: [{ correction: "Use RS256", reason: "Security policy" }],
  blockers: ["Staging key expired"],
};

test("a ReportProgressInput exactly as the contract defines it is stored", async () => {
  const result = await ctx.rpc("report_progress", contractReport);
  assert.match(result.event_id, /^evt_/);
  assert.deepEqual(result.warnings, []);
  const items = await ctx.q("select kind, text, reason from report_items where report_id = $1 order by kind", [
    result.event_id,
  ]);
  assert.deepEqual(items, [
    { kind: "blocker", text: "Staging key expired", reason: null },
    { kind: "dead_end", text: "Polled Stripe from cron", reason: "Rate limited" },
    { kind: "decision", text: "Use webhooks", reason: "Avoids polling" },
    { kind: "human_correction", text: "Use RS256", reason: "Security policy" },
  ]);
});

test("a ReportProgressInput with every array omitted is stored", async () => {
  const result = await ctx.rpc("report_progress", {
    session_id: "sess-2",
    client: "codex",
    person: "Ana Lee",
    workspace: "acme-dev",
    visibility: "shared",
    task: "t",
    status: "done",
    summary: "s",
  });
  assert.match(result.event_id, /^evt_/);
});

test("a TurnPing exactly as the contract defines it is accepted", async () => {
  const result = await ctx.rpc("touch_session", {
    client: "cursor",
    session_id: "sess-3",
    turn_id: "550e8400-e29b-41d4-a716-446655440000",
    person: "Ana Lee",
    workspace: "acme-dev",
    project: "billing-service",
    visibility: "shared",
    ts: "2026-10-03T14:02:11.000Z",
  });
  assert.equal(result.report_count, 0);
  assert.equal(result.last_report_at, null);
});

test("touch_session reports how recently the session reported", async () => {
  const result = await ctx.rpc("touch_session", {
    client: "claude-code",
    session_id: "sess-1",
    person: "Ana Lee",
    workspace: "acme-dev",
    project: "billing-service",
    visibility: "shared",
  });
  assert.equal(result.report_count, 1);
  assert.ok(result.last_report_at);
});

test("a private ping hides an existing shared session immediately", async () => {
  await ctx.rpc("touch_session", {
    client: "claude-code",
    session_id: "sess-1",
    person: "Ana Lee",
    workspace: "acme-dev",
    visibility: "private",
  });
  const shared = await ctx.q(
    "select 1 from search_documents where workspace = 'acme-dev' and visibility = 'shared' and session_pk = (select id from sessions where session_id = 'sess-1')",
  );
  assert.equal(shared.length, 0);
});

test("a new item kind needs only an insert", async () => {
  await rejects(
    ctx.rpc("report_progress", { ...contractReport, session_id: "sess-4", assumptions: ["x"], items: [{ kind: "assumption", text: "x" }] }),
  );
  await ctx.q("insert into item_kinds (kind, payload_key, label, rediscovery_relevant) values ('assumption', 'assumptions', 'assumption', true)");
  const result = await ctx.rpc("report_progress", { ...contractReport, session_id: "sess-4", assumptions: ["Test mode mirrors production"] });
  const rows = await ctx.q("select 1 from report_items where report_id = $1 and kind = 'assumption'", [result.event_id]);
  assert.equal(rows.length, 1);
  assert.equal((await ctx.q("select mesh_api_version() as v"))[0].v, 1);
});

test("a decision's area is stored and an unknown area is rejected", async () => {
  const rows = await ctx.q("select decision_area from report_items where kind = 'decision' and text = 'Use webhooks'");
  assert.equal(rows[0].decision_area, "technical");
  const other = await ctx.q("select decision_area from report_items where kind = 'dead_end' limit 1");
  assert.equal(other[0].decision_area, null);
  await rejects(
    ctx.rpc("report_progress", { ...contractReport, session_id: "sess-5", decisions: [{ area: "legal", choice: "x", reason: "y" }] }),
  );
  const noDecisions = { ...contractReport, session_id: "sess-6" };
  delete noDecisions.decisions;
  assert.match((await ctx.rpc("report_progress", noDecisions)).event_id, /^evt_/);
});
