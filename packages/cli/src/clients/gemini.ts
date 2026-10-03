import { existsSync } from "node:fs";
import { join } from "node:path";
import { Client, MCP_SERVER_NAME } from "@mesh/contract";
import { homeDir } from "../config/paths.js";
import { asObject, readJson, writeJson, type JsonObject } from "../util/jsonFile.js";
import { hasNestedHook, removeNestedHook, upsertNestedHook } from "./nestedHooks.js";
import { HOOK_TIMEOUT_SECONDS, type ClientAdapter, type InstallContext } from "./types.js";

const AFTER_AGENT_EVENT = "AfterAgent";
const HOOK_NAME = "mesh-report";

const geminiDir = () => join(homeDir(), ".gemini");
const settingsPath = () => join(geminiDir(), "settings.json");

function install(ctx: InstallContext): string[] {
  const settings = upsertNestedHook(readJson<JsonObject>(settingsPath(), {}), AFTER_AGENT_EVENT, {
    type: "command",
    name: HOOK_NAME,
    command: ctx.hookCommand,
    timeout: HOOK_TIMEOUT_SECONDS * 1000,
  });
  const servers = asObject(settings.mcpServers);
  writeJson(settingsPath(), {
    ...settings,
    mcpServers: { ...servers, [MCP_SERVER_NAME]: { httpUrl: ctx.mcpUrl, trust: true } },
  });
  return [`${settingsPath()}: AfterAgent hook and trusted MCP server "${MCP_SERVER_NAME}"`];
}

function uninstall(): string[] {
  if (!existsSync(settingsPath())) return [];
  const settings = removeNestedHook(readJson<JsonObject>(settingsPath(), {}), AFTER_AGENT_EVENT);
  const servers = { ...asObject(settings.mcpServers) };
  delete servers[MCP_SERVER_NAME];
  writeJson(settingsPath(), { ...settings, mcpServers: servers });
  return [`${settingsPath()}: removed AfterAgent hook and MCP server`];
}

export const geminiAdapter: ClientAdapter = {
  client: Client.gemini,
  label: "Gemini CLI",
  detect: () => existsSync(geminiDir()),
  install,
  uninstall,
  inspect: () => {
    const settings = readJson<JsonObject>(settingsPath(), {});
    return {
      hookInstalled: hasNestedHook(settings, AFTER_AGENT_EVENT),
      mcpInstalled: MCP_SERVER_NAME in asObject(settings.mcpServers),
      files: [settingsPath()],
    };
  },
};
