import { Visibility, type ReportProgressResult, type TurnPingResponse } from "@mesh/contract";
import { DbError } from "./db/client.js";
import type { AppDeps } from "./deps.js";
import { normalizeReport, parseReport } from "./ingest/normalize.js";
import { redact } from "./redact.js";
import { issuesOf, toTurnPing, TurnPingSchema, ValidationError } from "./schemas.js";
import { clip } from "./text.js";

const INVALID_PARAMS = "22023";
const WRONG_OWNER = "42501";

function rethrow(error: unknown): never {
  if (error instanceof DbError && (error.code === INVALID_PARAMS || error.code === WRONG_OWNER)) {
    throw new ValidationError([error.message]);
  }
  throw error;
}

export async function reportProgress(deps: AppDeps, raw: unknown): Promise<ReportProgressResult> {
  const report = normalizeReport(parseReport(raw));
  const result = await deps.api.reportProgress(report, deps.config.collisionWindowHours).catch(rethrow);
  if (report.visibility === Visibility.private) return { event_id: result.event_id, warnings: [] };
  return {
    event_id: result.event_id,
    warnings: result.warnings.map((w) => ({
      kind: w.kind,
      message: clip(redact(w.message), 400),
      source_event_ids: w.source_event_ids,
    })),
  };
}

export function reportText(out: ReportProgressResult): string {
  if (out.warnings.length === 0) return "Recorded.";
  return ["Recorded.", ...out.warnings.map((w) => `${w.kind}: ${w.message}`)].join("\n");
}

export async function recordTurn(deps: AppDeps, raw: unknown): Promise<TurnPingResponse> {
  const parsed = TurnPingSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(issuesOf(parsed.error));
  const ping = toTurnPing(parsed.data);
  ping.project = clip(redact(ping.project), 200);
  try {
    const session = await deps.api.touchSession(ping);
    const last = session.last_report_at ? Date.parse(session.last_report_at) : null;
    const recent = last !== null && deps.clock().getTime() - last < deps.config.reportDebounceSeconds * 1000;
    return { request_report: !recent };
  } catch (error) {
    if (error instanceof DbError && error.code === WRONG_OWNER) return { request_report: false };
    return rethrow(error);
  }
}
