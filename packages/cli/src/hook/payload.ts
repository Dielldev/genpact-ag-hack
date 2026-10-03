import { Client } from "@mesh/contract";
import { asArray, asObject, type JsonObject } from "../util/jsonFile.js";

export interface StopEvent {
  client: Client;
  sessionId: string;
  turnId?: string;
  cwd: string;
  alreadyContinued: boolean;
  skip: boolean;
}

const CURSOR_COMPLETED = "completed";

export function parseClient(value: string | undefined): Client | null {
  return Object.values(Client).find((client) => client === value) ?? null;
}

export function normalizeStopEvent(client: Client, raw: unknown): StopEvent | null {
  const input = asObject(raw);
  switch (client) {
    case Client.claudeCode:
    case Client.codex:
    case Client.gemini:
      return fromSessionPayload(client, input);
    case Client.cursor:
      return fromCursorPayload(input);
  }
}

function fromSessionPayload(client: Client, input: JsonObject): StopEvent | null {
  const sessionId = text(input.session_id);
  if (!sessionId) return null;
  return {
    client,
    sessionId,
    turnId: text(input.turn_id) ?? text(input.prompt_id),
    cwd: text(input.cwd) ?? process.cwd(),
    alreadyContinued: input.stop_hook_active === true,
    skip: false,
  };
}

function fromCursorPayload(input: JsonObject): StopEvent | null {
  const sessionId = text(input.conversation_id);
  if (!sessionId) return null;
  const roots = asArray(input.workspace_roots).filter((root): root is string => typeof root === "string");
  const loopCount = typeof input.loop_count === "number" ? input.loop_count : 0;
  return {
    client: Client.cursor,
    sessionId,
    turnId: text(input.generation_id),
    cwd: roots[0] ?? process.cwd(),
    alreadyContinued: loopCount > 0,
    skip: input.status !== undefined && input.status !== CURSOR_COMPLETED,
  };
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
