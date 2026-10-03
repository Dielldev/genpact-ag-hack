import { homedir } from "node:os";
import { join } from "node:path";

export const HOOK_MARKER = ".mesh/hook.mjs";
export const PROJECT_SETTINGS_FILE = ".mesh.json";

export function homeDir(): string {
  return process.env.MESH_HOME ?? homedir();
}

export function meshDir(): string {
  return join(homeDir(), ".mesh");
}

export function configPath(): string {
  return join(meshDir(), "config.json");
}

export function installedHookPath(): string {
  return join(meshDir(), "hook.mjs");
}

export function stateDir(): string {
  return join(meshDir(), "state");
}

export function hookLogPath(): string {
  return join(meshDir(), "hook.log");
}

export function toPortablePath(path: string): string {
  return path.replace(/\\/g, "/");
}

export function isMeshCommand(command: unknown): boolean {
  return typeof command === "string" && toPortablePath(command).includes(HOOK_MARKER);
}
