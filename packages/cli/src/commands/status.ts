import { existsSync } from "node:fs";
import { CLIENT_ADAPTERS } from "../clients/registry.js";
import { hookLogPath, installedHookPath } from "../config/paths.js";
import { loadUserConfig } from "../config/userConfig.js";
import { checkHealth, whoAmI } from "../hook/server.js";
import { readText } from "../util/jsonFile.js";

const LOG_TAIL_LINES = 5;

export async function runStatus(): Promise<number> {
  const config = loadUserConfig();
  if (!config) {
    console.log("Mesh is not set up. Run `mesh init`.");
    return 1;
  }
  console.log(`Server     ${config.serverUrl}`);
  console.log(`Person     ${config.person}`);
  console.log(`Workspace  ${config.workspace}`);
  console.log(`Hook       ${existsSync(installedHookPath()) ? installedHookPath() : "missing, run `mesh init`"}`);

  console.log("");
  for (const adapter of CLIENT_ADAPTERS) {
    try {
      const { hookInstalled, mcpInstalled } = adapter.inspect();
      const state = hookInstalled && mcpInstalled ? "✓" : hookInstalled || mcpInstalled ? "!" : "-";
      console.log(`${state} ${adapter.label.padEnd(12)} hook ${yesNo(hookInstalled)}, mcp ${yesNo(mcpInstalled)}`);
    } catch (error) {
      console.log(`✗ ${adapter.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const healthy = await checkHealth(config.serverUrl);
  console.log(`\nServer ${healthy ? "reachable" : "not reachable"}`);
  if (healthy) {
    const who = await whoAmI(config.serverUrl, config.key);
    const line = who.kind === "ok" ? `accepted${who.identity.person ? ` as ${who.identity.person}` : ""}` : who.kind === "rejected" ? "REJECTED, run `mesh init --key ...` again" : "could not be checked";
    console.log(`Key        ${config.key ? line : who.kind === "rejected" ? "missing, this server needs one" : "not used"}`);
  }

  const tail = readText(hookLogPath()).trim().split("\n").filter(Boolean).slice(-LOG_TAIL_LINES);
  if (tail.length > 0) {
    console.log(`\nLast hook runs (${hookLogPath()}):`);
    for (const line of tail) console.log(`  ${line}`);
  }
  return 0;
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}
