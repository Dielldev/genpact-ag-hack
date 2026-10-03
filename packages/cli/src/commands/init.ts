import { CLIENT_ADAPTERS, adapterFor } from "../clients/registry.js";
import type { ClientAdapter } from "../clients/types.js";
import {
  loadUserConfig,
  normalizeServerUrl,
  saveUserConfig,
  validatePerson,
  validateWorkspace,
  type UserConfig,
} from "../config/userConfig.js";
import { checkHealth } from "../hook/server.js";
import { parseClient } from "../hook/payload.js";
import { defaultPersonName } from "../util/identity.js";
import { ask, confirm, isInteractive } from "../util/prompt.js";
import { buildHookCommand, installHookRuntime, mcpUrlFor } from "./runtime.js";

export const DEFAULT_SERVER_URL = "http://localhost:8787";
const DEFAULT_WORKSPACE = "default";

export interface InitOptions {
  server?: string;
  person?: string;
  workspace?: string;
  clients?: string;
  yes: boolean;
}

export async function runInit(options: InitOptions): Promise<number> {
  const interactive = isInteractive() && !options.yes;
  const config = await resolveConfig(options, interactive);
  const adapters = await chooseAdapters(options.clients, interactive);

  saveUserConfig(config);
  const hookPath = installHookRuntime();
  console.log(`\nSaved settings and hook runtime to ${hookPath}`);

  if (adapters.length === 0) {
    console.log("No supported agent CLIs selected. Re-run with --clients claude-code,codex,cursor,gemini.");
  }

  let failures = 0;
  for (const adapter of adapters) {
    try {
      const changes = adapter.install({ hookCommand: buildHookCommand(adapter.client), mcpUrl: mcpUrlFor(config.serverUrl) });
      console.log(`\n✓ ${adapter.label}`);
      for (const change of changes) console.log(`  ${change}`);
    } catch (error) {
      failures++;
      console.log(`\n✗ ${adapter.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const healthy = await checkHealth(config.serverUrl);
  console.log(
    healthy
      ? `\n✓ Server reachable at ${config.serverUrl}`
      : `\n! Server not reachable at ${config.serverUrl}. The hook stays silent until it is up.`,
  );
  console.log("\nRestart any open agent sessions so they pick up the new hook.");
  return failures > 0 ? 1 : 0;
}

async function resolveConfig(options: InitOptions, interactive: boolean): Promise<UserConfig> {
  const existing = loadUserConfig();
  const pick = async (given: string | undefined, question: string, fallback: string) =>
    given ?? (interactive ? await ask(question, fallback) : fallback);

  const serverUrl = normalizeServerUrl(
    await pick(options.server, "Mesh server URL", existing?.serverUrl ?? DEFAULT_SERVER_URL),
  );
  const person = validatePerson(await pick(options.person, "Your name", existing?.person ?? defaultPersonName()));
  const workspace = validateWorkspace(
    await pick(options.workspace, "Workspace", existing?.workspace ?? DEFAULT_WORKSPACE),
  );
  return { serverUrl, person, workspace };
}

async function chooseAdapters(clients: string | undefined, interactive: boolean): Promise<ClientAdapter[]> {
  if (clients) {
    return clients.split(",").map((name) => {
      const client = parseClient(name.trim());
      if (!client) throw new Error(`Unknown client "${name.trim()}"`);
      return adapterFor(client);
    });
  }
  const detected = CLIENT_ADAPTERS.filter((adapter) => adapter.detect());
  if (!interactive) return detected;
  if (detected.length > 0) {
    const names = detected.map((adapter) => adapter.label).join(", ");
    if (await confirm(`Connect ${names}?`, true)) return detected;
  }
  const chosen: ClientAdapter[] = [];
  for (const adapter of CLIENT_ADAPTERS) {
    if (await confirm(`Connect ${adapter.label}?`, false)) chosen.push(adapter);
  }
  return chosen;
}
