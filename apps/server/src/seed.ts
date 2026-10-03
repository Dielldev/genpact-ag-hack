import type { AppDeps } from "./deps.js";
import type { Seed } from "./fixtures/demo.js";
import { recordTurn, reportProgress } from "./reportProgress.js";
import { createTicket } from "./views.js";

export async function loadSeed(deps: AppDeps, seed: Seed): Promise<{ reports: number; event_ids: Record<string, string> }> {
  for (const ticket of seed.tickets) await createTicket(deps, ticket);
  for (const ping of seed.pings) await recordTurn(deps, ping);
  const eventIds: Record<string, string> = {};
  for (const report of seed.reports) {
    const out = await reportProgress(deps, report);
    eventIds[report.session_id] = out.event_id;
  }
  return { reports: seed.reports.length, event_ids: eventIds };
}
