import { existsSync } from "node:fs";
import { join } from "node:path";
import { Client, MCP_SERVER_NAME, McpTool, mcpPermissionName } from "@mesh/contract";
import { homeDir } from "../config/paths.js";
import { asArray, asObject, readJson, writeJson, type JsonObject } from "../util/jsonFile.js";
import { hasNestedHook, removeNestedHook, upsertNestedHook } from "./nestedHooks.js";
import { HOOK_TIMEOUT_SECONDS, type ClientAdapter, type InstallContext } from "./types.js";

const STOP_EVENT = "Stop";
const ALLOWED_TOOLS = [mcpPermissionName(McpTool.reportProgress)];

const settingsPath = () => join(homeDir(), ".claude", "settings.json");
const userStatePath = () => join(homeDir(), ".claude.json");

function install(ctx: InstallContext): string[] {
  const settings = upsertNestedHook(readJson<JsonObject>(settingsPath(), {}), STOP_EVENT, {
    type: "command",
    command: ctx.hookCommand,
    timeout: HOOK_TIMEOUT_SECONDS,
  });
  writeJson(settingsPath(), withAllowedTools(settings));

  const state = readJson<JsonObject>(userStatePath(), {});
  const servers = asObject(state.mcpServers);
  writeJson(userStatePath(), { ...state, mcpServers: { ...servers, [MCP_SERVER_NAME]: { type: "http", url: ctx.mcpUrl, ...(ctx.mcpHeaders ? { headers: ctx.mcpHeaders } : {}) } } });

  return [
    `${settingsPath()}: Stop hook and permission for ${ALLOWED_TOOLS.join(", ")}`,
    `${userStatePath()}: MCP server "${MCP_SERVER_NAME}" (user scope)`,
  ];
}

function uninstall(): string[] {
  const changes: string[] = [];
  if (existsSync(settingsPath())) {
    const settings = removeNestedHook(readJson<JsonObject>(settingsPath(), {}), STOP_EVENT);
    writeJson(settingsPath(), withoutAllowedTools(settings));
    changes.push(`${settingsPath()}: removed Stop hook and permissions`);
  }
  const state = readJson<JsonObject>(userStatePath(), {});
  const servers = { ...asObject(state.mcpServers) };
  if (MCP_SERVER_NAME in servers) {
    delete servers[MCP_SERVER_NAME];
    writeJson(userStatePath(), { ...state, mcpServers: servers });
    changes.push(`${userStatePath()}: removed MCP server`);
  }
  return changes;
}

function withAllowedTools(settings: JsonObject): JsonObject {
  const permissions = asObject(settings.permissions);
  const allow = asArray(permissions.allow).filter((rule) => !ALLOWED_TOOLS.includes(rule as string));
  return { ...settings, permissions: { ...permissions, allow: [...allow, ...ALLOWED_TOOLS] } };
}

function withoutAllowedTools(settings: JsonObject): JsonObject {
  const permissions = asObject(settings.permissions);
  if (!Array.isArray(permissions.allow)) return settings;
  const allow = permissions.allow.filter((rule) => !ALLOWED_TOOLS.includes(rule as string));
  return { ...settings, permissions: { ...permissions, allow } };
}

export const claudeCodeAdapter: ClientAdapter = {
  client: Client.claudeCode,
  label: "Claude Code",
  detect: () => existsSync(join(homeDir(), ".claude")) || existsSync(userStatePath()),
  install,
  uninstall,
  inspect: () => ({
    hookInstalled: hasNestedHook(readJson<JsonObject>(settingsPath(), {}), STOP_EVENT),
    mcpInstalled: MCP_SERVER_NAME in asObject(readJson<JsonObject>(userStatePath(), {}).mcpServers),
    files: [settingsPath(), userStatePath()],
  }),
};
