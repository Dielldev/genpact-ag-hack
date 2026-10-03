import { rmSync } from "node:fs";
import { CLIENT_ADAPTERS } from "../clients/registry.js";
import { meshDir } from "../config/paths.js";

export interface UninstallOptions {
  purge: boolean;
}

export function runUninstall(options: UninstallOptions): number {
  let failures = 0;
  for (const adapter of CLIENT_ADAPTERS) {
    try {
      const { hookInstalled, mcpInstalled } = adapter.inspect();
      if (!hookInstalled && !mcpInstalled) continue;
      const changes = adapter.uninstall();
      console.log(`✓ ${adapter.label}`);
      for (const change of changes) console.log(`  ${change}`);
    } catch (error) {
      failures++;
      console.log(`✗ ${adapter.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (options.purge) {
    rmSync(meshDir(), { recursive: true, force: true });
    console.log(`Removed ${meshDir()}`);
  }
  return failures > 0 ? 1 : 0;
}
