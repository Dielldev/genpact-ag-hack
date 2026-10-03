import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ApiRoute, type Client } from "@mesh/contract";
import { installedHookPath, toPortablePath } from "../config/paths.js";

const BUNDLED_HOOK_FILE = "hook.mjs";

export function installHookRuntime(): string {
  const source = join(dirname(fileURLToPath(import.meta.url)), BUNDLED_HOOK_FILE);
  if (!existsSync(source)) {
    throw new Error(`Bundled hook not found at ${source}. Run the build first.`);
  }
  const target = installedHookPath();
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  return target;
}

export function buildHookCommand(client: Client): string {
  const node = toPortablePath(process.execPath);
  const hook = toPortablePath(installedHookPath());
  return `"${node}" "${hook}" --client ${client}`;
}

export function mcpUrlFor(serverUrl: string): string {
  return serverUrl + ApiRoute.mcp;
}
