import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Client } from "@mesh/contract";
import { stateDir } from "../config/paths.js";

const PENDING_TTL_MS = 10 * 60 * 1000;

export function sessionKey(client: Client, sessionId: string): string {
  return createHash("sha256").update(`${client}:${sessionId}`).digest("hex").slice(0, 16);
}

function pendingFile(client: Client, sessionId: string): string {
  return join(stateDir(), `${sessionKey(client, sessionId)}.pending`);
}

export function hasPendingReport(client: Client, sessionId: string): boolean {
  const file = pendingFile(client, sessionId);
  if (!existsSync(file)) return false;
  const since = Number(readFileSync(file, "utf8"));
  return Number.isFinite(since) && Date.now() - since < PENDING_TTL_MS;
}

export function markPendingReport(client: Client, sessionId: string): void {
  mkdirSync(stateDir(), { recursive: true });
  writeFileSync(pendingFile(client, sessionId), String(Date.now()), "utf8");
}

export function clearPendingReport(client: Client, sessionId: string): void {
  rmSync(pendingFile(client, sessionId), { force: true });
}
