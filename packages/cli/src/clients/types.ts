import type { Client } from "@mesh/contract";

export const HOOK_TIMEOUT_SECONDS = 15;

export interface InstallContext {
  hookCommand: string;
  mcpUrl: string;
}

export interface ClientInspection {
  hookInstalled: boolean;
  mcpInstalled: boolean;
  files: string[];
}

export interface ClientAdapter {
  client: Client;
  label: string;
  detect(): boolean;
  install(ctx: InstallContext): string[];
  uninstall(): string[];
  inspect(): ClientInspection;
}
