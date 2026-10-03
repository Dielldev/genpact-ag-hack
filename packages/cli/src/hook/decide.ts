import { basename } from "node:path";
import { loadProjectSettings } from "../config/projectSettings.js";
import { loadUserConfig } from "../config/userConfig.js";
import { clearPendingReport, hasPendingReport, markPendingReport } from "./guard.js";
import { buildReportInstruction } from "./instruction.js";
import { AllowReason, HookOutcome, type HookDecision } from "./outcome.js";
import type { StopEvent } from "./payload.js";
import { allowResponse, continueResponse } from "./respond.js";
import { sendTurnPing } from "./server.js";

export async function decide(event: StopEvent): Promise<HookDecision> {
  const allow = (reason: AllowReason): HookDecision => ({
    kind: HookOutcome.allow,
    output: allowResponse(event.client),
    reason,
  });

  if (event.skip) return allow(AllowReason.notCompleted);

  const config = loadUserConfig();
  if (!config) return allow(AllowReason.notConfigured);

  const project = loadProjectSettings(event.cwd);
  if (!project.enabled) return allow(AllowReason.disabledForProject);

  if (event.alreadyContinued || hasPendingReport(event.client, event.sessionId)) {
    clearPendingReport(event.client, event.sessionId);
    return allow(AllowReason.reportDone);
  }

  const ping = await sendTurnPing(config.serverUrl, {
    client: event.client,
    session_id: event.sessionId,
    turn_id: event.turnId,
    person: config.person,
    workspace: config.workspace,
    project: basename(event.cwd),
    visibility: project.visibility,
    ts: new Date().toISOString(),
  }, config.key);
  if (!ping) return allow(AllowReason.serverUnavailable);
  if (!ping.request_report) return allow(AllowReason.serverDeclined);

  markPendingReport(event.client, event.sessionId);
  const instruction = buildReportInstruction({
    client: event.client,
    sessionId: event.sessionId,
    person: config.person,
    workspace: config.workspace,
    visibility: project.visibility,
    note: ping.note,
  });
  return { kind: HookOutcome.report, output: continueResponse(event.client, instruction) };
}
