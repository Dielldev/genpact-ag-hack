import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeHome, runHook, startStubServer, writeConfig } from "./helpers.mjs";

const payloads = {
  "claude-code": (id, extra = {}) => ({ session_id: id, cwd: process.cwd(), hook_event_name: "Stop", ...extra }),
  codex: (id, extra = {}) => ({ session_id: id, turn_id: "t1", cwd: process.cwd(), hook_event_name: "Stop", ...extra }),
  gemini: (id, extra = {}) => ({ session_id: id, cwd: process.cwd(), hook_event_name: "AfterAgent", ...extra }),
  cursor: (id, extra = {}) => ({
    conversation_id: id,
    generation_id: "g1",
    hook_event_name: "stop",
    status: "completed",
    loop_count: 0,
    workspace_roots: [process.cwd()],
    ...extra,
  }),
};

function reasonOf(client, stdout) {
  const body = JSON.parse(stdout);
  if (client === "cursor") return body.followup_message;
  assert.equal(body.decision, client === "gemini" ? "deny" : "block");
  return body.reason;
}

describe("hook", () => {
  let server;
  let home;

  before(async () => {
    server = await startStubServer();
    home = makeHome();
    writeConfig(home, server.url);
  });

  after(() => server.close());

  for (const client of Object.keys(payloads)) {
    it(`${client}: asks for a report once, then lets the agent stop`, async () => {
      const id = `s-${client}`;
      const first = await runHook(client, payloads[client](id), { home });
      assert.equal(first.code, 0);
      const reason = reasonOf(client, first.stdout);
      assert.match(reason, /report_progress/);
      assert.match(reason, new RegExp(`session_id "${id}"`));
      assert.match(reason, /person "Test User"/);

      const ping = server.pings.find((entry) => entry.session_id === id);
      assert.equal(ping.client, client);
      assert.equal(ping.workspace, "demo");
      assert.equal(ping.visibility, "shared");

      const second = await runHook(client, payloads[client](id), { home });
      assert.equal(second.code, 0);
      assert.ok(second.stdout === "" || second.stdout === "{}");
    });
  }

  it("respects the client's own loop flag", async () => {
    const claude = await runHook("claude-code", payloads["claude-code"]("loop-a", { stop_hook_active: true }), { home });
    assert.equal(claude.stdout, "");
    const cursor = await runHook("cursor", payloads.cursor("loop-b", { loop_count: 1 }), { home });
    assert.equal(cursor.stdout, "{}");
  });

  it("does nothing for aborted cursor turns", async () => {
    const result = await runHook("cursor", payloads.cursor("aborted", { status: "aborted" }), { home });
    assert.equal(result.stdout, "{}");
  });

  it("fails open when the server is down", async () => {
    const downHome = makeHome();
    writeConfig(downHome, "http://127.0.0.1:9");
    const result = await runHook("claude-code", payloads["claude-code"]("down"), { home: downHome });
    assert.equal(result.code, 0);
    assert.equal(result.stdout, "");
  });

  it("fails open when not configured or given garbage", async () => {
    const empty = makeHome();
    const result = await runHook("codex", payloads.codex("none"), { home: empty });
    assert.equal(result.stdout, "");
    const garbage = await runHook("gemini", "not json", { home });
    assert.equal(garbage.code, 0);
    assert.equal(garbage.stdout, "{}");
  });

  it("honours .mesh.json for disabled and private projects", async () => {
    const project = join(home, "project");
    mkdirSync(project, { recursive: true });

    writeFileSync(join(project, ".mesh.json"), JSON.stringify({ enabled: false }));
    const disabled = await runHook("claude-code", payloads["claude-code"]("off", { cwd: project }), { home });
    assert.equal(disabled.stdout, "");

    writeFileSync(join(project, ".mesh.json"), JSON.stringify({ visibility: "private" }));
    const priv = await runHook("claude-code", payloads["claude-code"]("priv", { cwd: project }), { home });
    assert.match(reasonOf("claude-code", priv.stdout), /visibility "private"/);
    assert.equal(server.pings.find((entry) => entry.session_id === "priv").visibility, "private");
  });

  it("lets the server decline a report", async () => {
    const quiet = await startStubServer({ request_report: false });
    const quietHome = makeHome();
    writeConfig(quietHome, quiet.url);
    const result = await runHook("claude-code", payloads["claude-code"]("quiet"), { home: quietHome });
    assert.equal(result.stdout, "");
    assert.equal(quiet.pings.length, 1);
    await quiet.close();
  });
});
