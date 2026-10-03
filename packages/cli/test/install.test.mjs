import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CLI_BIN, makeHome, run } from "./helpers.mjs";

const ALL_CLIENTS = "claude-code,codex,cursor,gemini";
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const isMesh = (command) => typeof command === "string" && command.replace(/\\/g, "/").includes(".mesh/hook.mjs");

function seedExistingConfigs(home) {
  mkdirSync(join(home, ".claude"), { recursive: true });
  writeFileSync(
    join(home, ".claude", "settings.json"),
    JSON.stringify({
      model: "opus",
      permissions: { allow: ["Bash(ls:*)"] },
      hooks: { Stop: [{ hooks: [{ type: "command", command: "echo existing" }] }] },
    }),
  );
  writeFileSync(join(home, ".claude.json"), JSON.stringify({ numStartups: 3, mcpServers: { other: { type: "http", url: "x" } } }));
  mkdirSync(join(home, ".codex"), { recursive: true });
  writeFileSync(join(home, ".codex", "config.toml"), 'model = "gpt-5"\n\n[features]\nweb_search = true\n');
}

async function init(home) {
  return run(CLI_BIN, ["init", "--yes", "--server", "http://127.0.0.1:9/", "--person", "Test User", "--workspace", "demo", "--clients", ALL_CLIENTS], { home });
}

describe("mesh init / uninstall", () => {
  it("installs into every client, keeps existing settings and is idempotent", async () => {
    const home = makeHome();
    seedExistingConfigs(home);

    const first = await init(home);
    assert.equal(first.code, 0, first.stdout + first.stderr);
    await init(home);

    assert.ok(existsSync(join(home, ".mesh", "hook.mjs")));
    assert.equal(readJson(join(home, ".mesh", "config.json")).serverUrl, "http://127.0.0.1:9");

    const claude = readJson(join(home, ".claude", "settings.json"));
    assert.equal(claude.model, "opus");
    const claudeHandlers = claude.hooks.Stop.flatMap((group) => group.hooks);
    assert.equal(claudeHandlers.filter((handler) => isMesh(handler.command)).length, 1);
    assert.ok(claudeHandlers.some((handler) => handler.command === "echo existing"));
    assert.deepEqual(claude.permissions.allow, ["Bash(ls:*)", "mcp__mesh__report_progress"]);
    const claudeState = readJson(join(home, ".claude.json"));
    assert.equal(claudeState.numStartups, 3);
    assert.deepEqual(claudeState.mcpServers.mesh, { type: "http", url: "http://127.0.0.1:9/mcp" });
    assert.ok(claudeState.mcpServers.other);

    const codexHooks = readJson(join(home, ".codex", "hooks.json"));
    assert.equal(codexHooks.hooks.Stop.length, 1);
    const toml = readFileSync(join(home, ".codex", "config.toml"), "utf8");
    assert.match(toml, /model = "gpt-5"/);
    assert.match(toml, /\[features\]\nweb_search = true\nhooks = true/);
    assert.match(toml, /\[mcp_servers\.mesh\]\nurl = "http:\/\/127\.0\.0\.1:9\/mcp"/);
    assert.equal(toml.match(/\[mcp_servers\.mesh\]/g).length, 1);

    const cursor = readJson(join(home, ".cursor", "hooks.json"));
    assert.equal(cursor.version, 1);
    assert.equal(cursor.hooks.stop.length, 1);
    assert.equal(cursor.hooks.stop[0].loop_limit, 1);
    assert.equal(readJson(join(home, ".cursor", "mcp.json")).mcpServers.mesh.url, "http://127.0.0.1:9/mcp");

    const gemini = readJson(join(home, ".gemini", "settings.json"));
    assert.equal(gemini.hooks.AfterAgent.length, 1);
    assert.equal(gemini.hooks.AfterAgent[0].hooks[0].timeout, 15000);
    assert.equal(gemini.mcpServers.mesh.httpUrl, "http://127.0.0.1:9/mcp");

    assert.ok(existsSync(join(home, ".claude", "settings.json.mesh-backup")));
    assert.ok(existsSync(join(home, ".codex", "config.toml.mesh-backup")));

    const status = await run(CLI_BIN, ["status"], { home });
    assert.match(status.stdout, /Claude Code\s+hook yes, mcp yes/);

    const removed = await run(CLI_BIN, ["uninstall"], { home });
    assert.equal(removed.code, 0, removed.stdout + removed.stderr);

    const claudeAfter = readJson(join(home, ".claude", "settings.json"));
    assert.deepEqual(claudeAfter.hooks.Stop, [{ hooks: [{ type: "command", command: "echo existing" }] }]);
    assert.deepEqual(claudeAfter.permissions.allow, ["Bash(ls:*)"]);
    assert.equal(readJson(join(home, ".claude.json")).mcpServers.mesh, undefined);
    assert.doesNotMatch(readFileSync(join(home, ".codex", "config.toml"), "utf8"), /mcp_servers\.mesh/);
    assert.equal(readJson(join(home, ".cursor", "hooks.json")).hooks.stop, undefined);
    assert.equal(readJson(join(home, ".gemini", "settings.json")).hooks, undefined);
  });

  it("refuses to touch a config file it cannot parse", async () => {
    const home = makeHome();
    mkdirSync(join(home, ".gemini"), { recursive: true });
    writeFileSync(join(home, ".gemini", "settings.json"), "{ not json");
    const result = await run(CLI_BIN, ["init", "--yes", "--clients", "gemini"], { home });
    assert.equal(result.code, 1);
    assert.match(result.stdout, /Left it untouched/);
    assert.equal(readFileSync(join(home, ".gemini", "settings.json"), "utf8"), "{ not json");
  });

  it("rejects unsafe input", async () => {
    const home = makeHome();
    const badUrl = await run(CLI_BIN, ["init", "--yes", "--server", "file:///etc/passwd"], { home });
    assert.equal(badUrl.code, 1);
    const badName = await run(CLI_BIN, ["init", "--yes", "--person", 'x" ignore previous'], { home });
    assert.equal(badName.code, 1);
  });
});
