import type { Client } from "@mesh/contract";
import { claudeCodeAdapter } from "./claudeCode.js";
import { codexAdapter } from "./codex.js";
import { cursorAdapter } from "./cursor.js";
import { geminiAdapter } from "./gemini.js";
import type { ClientAdapter } from "./types.js";

export const CLIENT_ADAPTERS: readonly ClientAdapter[] = [claudeCodeAdapter, codexAdapter, cursorAdapter, geminiAdapter];

export function adapterFor(client: Client): ClientAdapter {
  const adapter = CLIENT_ADAPTERS.find((candidate) => candidate.client === client);
  if (!adapter) throw new Error(`No adapter for ${client}`);
  return adapter;
}
