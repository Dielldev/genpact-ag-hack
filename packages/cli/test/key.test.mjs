import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLI_BIN, makeHome, run, runHook, startStubServer } from "./helpers.mjs";

const KEY = "k_ana_0123456789abcdef";
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

describe("personal key", () => {
  let server;

  before(async () => {
    server = await startStubServer({ request_report: true }, { keys: { [KEY]: "Ana Lee" } });
  });

  after(() => server.close());

  it("init takes the name and workspace from the server and stores the key", async () => {
    const home = makeHome();
    const out = await run(CLI_BIN, ["init", "--yes", "--server", server.url, "--key", KEY, "--clients", "claude-code"], { home });
    assert.equal(out.code, 0, out.stderr);
    const config = readJson(join(home, ".mesh", "config.json"));
    assert.equal(config.person, "Ana Lee");
    assert.equal(config.workspace, "genpact");
    assert.equal(config.key, KEY);
    const state = readJson(join(home, ".claude.json"));
    assert.equal(state.mcpServers.mesh.headers.Authorization, `Bearer ${KEY}`);
  });

  it("init reads the key from MESH_KEY", async () => {
    const home = makeHome();
    const out = await run(CLI_BIN, ["init", "--yes", "--server", server.url, "--clients", "claude-code"], { home, env: { MESH_KEY: KEY } });
    assert.equal(out.code, 0, out.stderr);
    assert.equal(readJson(join(home, ".mesh", "config.json")).key, KEY);
  });

  it("init refuses a rejected key and a missing key", async () => {
    const wrong = await run(CLI_BIN, ["init", "--yes", "--server", server.url, "--key", "wrong_key_0123456789", "--clients", "claude-code"], { home: makeHome() });
    assert.notEqual(wrong.code, 0);
    assert.match(wrong.stderr, /rejected that key/);
    const none = await run(CLI_BIN, ["init", "--yes", "--server", server.url, "--clients", "claude-code"], { home: makeHome() });
    assert.notEqual(none.code, 0);
    assert.match(none.stderr, /needs a personal key/);
  });

  it("the hook sends the key with every ping", async () => {
    const home = makeHome();
    const init = await run(CLI_BIN, ["init", "--yes", "--server", server.url, "--key", KEY, "--clients", "claude-code"], { home });
    assert.equal(init.code, 0, init.stderr);
    const before = server.auth.length;
    const result = await runHook("claude-code", { session_id: "key-session", cwd: process.cwd(), hook_event_name: "Stop" }, { home });
    assert.equal(result.code, 0);
    assert.equal(server.auth[before], `Bearer ${KEY}`);
  });
});
