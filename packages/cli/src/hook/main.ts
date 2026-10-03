import { parseArgs } from "node:util";
import type { Client } from "@mesh/contract";
import { decide } from "./decide.js";
import { sessionKey } from "./guard.js";
import { logHook } from "./log.js";
import { AllowReason, HookOutcome } from "./outcome.js";
import { normalizeStopEvent, parseClient } from "./payload.js";
import { allowResponse } from "./respond.js";

const STDIN_TIMEOUT_MS = 5000;

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  const reading = (async () => {
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  })();
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, STDIN_TIMEOUT_MS).unref());
  await Promise.race([reading, timeout]);
  return Buffer.concat(chunks).toString("utf8");
}

function finish(output: string): void {
  if (output === "") {
    process.exit(0);
  }
  process.stdout.write(output, () => process.exit(0));
}

async function run(): Promise<void> {
  let client: Client | null = null;
  try {
    const { values } = parseArgs({ options: { client: { type: "string" } }, strict: false });
    client = parseClient(typeof values.client === "string" ? values.client : undefined);
    if (!client) {
      logHook(HookOutcome.error, { reason: "unknown_client" });
      return finish("");
    }
    const event = normalizeStopEvent(client, JSON.parse((await readStdin()) || "{}"));
    if (!event) {
      logHook(HookOutcome.allow, { client, reason: AllowReason.invalidPayload });
      return finish(allowResponse(client));
    }
    const decision = await decide(event);
    const session = sessionKey(event.client, event.sessionId);
    if (decision.kind === HookOutcome.report) {
      logHook(HookOutcome.report, { client, session });
    } else {
      logHook(HookOutcome.allow, { client, session, reason: decision.reason });
    }
    finish(decision.output);
  } catch (error) {
    logHook(HookOutcome.error, { client: client ?? undefined, message: error instanceof Error ? error.name : "unknown" });
    finish(allowResponse(client));
  }
}

void run();
