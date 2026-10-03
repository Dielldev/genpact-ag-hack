import { existsSync } from "node:fs";
import { join } from "node:path";
import { Client, MCP_SERVER_NAME } from "@mesh/contract";
import { homeDir, isMeshCommand } from "../config/paths.js";
import { asArray, asObject, readJson, writeJson, type JsonObject } from "../util/jsonFile.js";
import { HOOK_TIMEOUT_SECONDS, type ClientAdapter, type InstallContext } from "./types.js";

const STOP_EVENT = "stop";
const HOOKS_VERSION = 1;
const LOOP_LIMIT = 1;

const cursorDir = () => join(homeDir(), ".cursor");
const hooksPath = () => join(cursorDir(), "hooks.json");
const mcpPath = () => join(cursorDir(), "mcp.json");

function stopHandlers(config: JsonObject): unknown[] {
  return asArray(asObject(config.hooks)[STOP_EVENT]);
}

function withStopHandlers(config: JsonObject, handlers: unknown[]): JsonObject {
  const hooks = { ...asObject(config.hooks) };
  if (handlers.length > 0) {
    hooks[STOP_EVENT] = handlers;
  } else {
    delete hooks[STOP_EVENT];
  }
  return { ...config, version: HOOKS_VERSION, hooks };
}

function withoutMesh(handlers: unknown[]): unknown[] {
  return handlers.filter((handler) => !isMeshCommand(asObject(handler).command));
}

function install(ctx: InstallContext): string[] {
  const config = readJson<JsonObject>(hooksPath(), {});
  const handlers = [
    ...withoutMesh(stopHandlers(config)),
    { command: ctx.hookCommand, timeout: HOOK_TIMEOUT_SECONDS, loop_limit: LOOP_LIMIT },
  ];
  writeJson(hooksPath(), withStopHandlers(config, handlers));

  const mcp = readJson<JsonObject>(mcpPath(), {});
  writeJson(mcpPath(), { ...mcp, mcpServers: { ...asObject(mcp.mcpServers), [MCP_SERVER_NAME]: { url: ctx.mcpUrl } } });

  return [`${hooksPath()}: stop hook (loop_limit ${LOOP_LIMIT})`, `${mcpPath()}: MCP server "${MCP_SERVER_NAME}"`];
}

function uninstall(): string[] {
  const changes: string[] = [];
  if (existsSync(hooksPath())) {
    const config = readJson<JsonObject>(hooksPath(), {});
    writeJson(hooksPath(), withStopHandlers(config, withoutMesh(stopHandlers(config))));
    changes.push(`${hooksPath()}: removed stop hook`);
  }
  const mcp = readJson<JsonObject>(mcpPath(), {});
  const servers = { ...asObject(mcp.mcpServers) };
  if (MCP_SERVER_NAME in servers) {
    delete servers[MCP_SERVER_NAME];
    writeJson(mcpPath(), { ...mcp, mcpServers: servers });
    changes.push(`${mcpPath()}: removed MCP server`);
  }
  return changes;
}

export const cursorAdapter: ClientAdapter = {
  client: Client.cursor,
  label: "Cursor",
  detect: () => existsSync(cursorDir()),
  install,
  uninstall,
  inspect: () => ({
    hookInstalled: stopHandlers(readJson<JsonObject>(hooksPath(), {})).some((handler) =>
      isMeshCommand(asObject(handler).command),
    ),
    mcpInstalled: MCP_SERVER_NAME in asObject(readJson<JsonObject>(mcpPath(), {}).mcpServers),
    files: [hooksPath(), mcpPath()],
  }),
};
