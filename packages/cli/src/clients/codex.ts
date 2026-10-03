import { existsSync } from "node:fs";
import { join } from "node:path";
import { Client, MCP_SERVER_NAME } from "@mesh/contract";
import { homeDir } from "../config/paths.js";
import { backupOnce, readJson, readText, writeAtomic, writeJson, type JsonObject } from "../util/jsonFile.js";
import { hasTomlSection, removeTomlSection, tomlInlineTable, tomlString, upsertTomlKey } from "../util/toml.js";
import { hasNestedHook, removeNestedHook, upsertNestedHook } from "./nestedHooks.js";
import { HOOK_TIMEOUT_SECONDS, type ClientAdapter, type InstallContext } from "./types.js";

const STOP_EVENT = "Stop";
const FEATURES_SECTION = "features";
const HOOKS_FEATURE = "hooks";
const MCP_SECTION = `mcp_servers.${MCP_SERVER_NAME}`;

const codexDir = () => join(homeDir(), ".codex");
const hooksPath = () => join(codexDir(), "hooks.json");
const configPath = () => join(codexDir(), "config.toml");

function install(ctx: InstallContext): string[] {
  const hooks = upsertNestedHook(readJson<JsonObject>(hooksPath(), {}), STOP_EVENT, {
    type: "command",
    command: ctx.hookCommand,
    timeout: HOOK_TIMEOUT_SECONDS,
  });
  writeJson(hooksPath(), hooks);

  let config = readText(configPath());
  config = upsertTomlKey(config, FEATURES_SECTION, HOOKS_FEATURE, "true");
  config = upsertTomlKey(config, MCP_SECTION, "url", tomlString(ctx.mcpUrl));
  if (ctx.mcpHeaders) config = upsertTomlKey(config, MCP_SECTION, "http_headers", tomlInlineTable(ctx.mcpHeaders));
  backupOnce(configPath());
  writeAtomic(configPath(), config);

  return [
    `${hooksPath()}: Stop hook`,
    `${configPath()}: [${FEATURES_SECTION}] ${HOOKS_FEATURE} = true and [${MCP_SECTION}]`,
  ];
}

function uninstall(): string[] {
  const changes: string[] = [];
  if (existsSync(hooksPath())) {
    writeJson(hooksPath(), removeNestedHook(readJson<JsonObject>(hooksPath(), {}), STOP_EVENT));
    changes.push(`${hooksPath()}: removed Stop hook`);
  }
  const config = readText(configPath());
  if (hasTomlSection(config, MCP_SECTION)) {
    backupOnce(configPath());
    writeAtomic(configPath(), removeTomlSection(config, MCP_SECTION));
    changes.push(`${configPath()}: removed [${MCP_SECTION}]`);
  }
  return changes;
}

export const codexAdapter: ClientAdapter = {
  client: Client.codex,
  label: "Codex CLI",
  detect: () => existsSync(codexDir()),
  install,
  uninstall,
  inspect: () => ({
    hookInstalled: hasNestedHook(readJson<JsonObject>(hooksPath(), {}), STOP_EVENT),
    mcpInstalled: hasTomlSection(readText(configPath()), MCP_SECTION),
    files: [hooksPath(), configPath()],
  }),
};
