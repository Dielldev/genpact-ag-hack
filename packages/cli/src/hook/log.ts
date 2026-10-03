import { appendFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { hookLogPath } from "../config/paths.js";
import type { HookOutcome } from "./outcome.js";

const MAX_LOG_BYTES = 1024 * 1024;

export function logHook(outcome: HookOutcome, fields: Record<string, string | undefined>): void {
  try {
    const path = hookLogPath();
    mkdirSync(dirname(path), { recursive: true });
    if (existsSync(path) && statSync(path).size > MAX_LOG_BYTES) writeFileSync(path, "");
    const detail = Object.entries(fields)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${value}`)
      .join(" ");
    appendFileSync(path, `${new Date().toISOString()} ${outcome} ${detail}\n`);
  } catch {
    return;
  }
}
