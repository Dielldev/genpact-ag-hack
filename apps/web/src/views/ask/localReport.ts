import type { AskResponse, EventRecord } from "@mesh/server/api";
import { api } from "../../api";
import { pickSessions, reportResponse } from "./clientReport";
import type { ReportSpec } from "./intent";
import { buildReport } from "./report";

async function fetchEvents(workspace: string, ids: string[]): Promise<EventRecord[]> {
  const settled = await Promise.allSettled(ids.map((id) => api.event(workspace, id)));
  return settled.flatMap((s) => (s.status === "fulfilled" ? [s.value.event] : []));
}

export async function localReport(workspace: string, spec: ReportSpec, started: number): Promise<AskResponse> {
  const [feed, warnings, team] = await Promise.all([api.feed(workspace, {}), api.warnings(workspace), api.people(workspace)]);
  const data = buildReport({ items: feed.items, warnings: warnings.warnings, people: team.people, now: Date.now() }, spec);
  const events = await fetchEvents(workspace, pickSessions(data.rows));
  return reportResponse(data, events, started, spec);
}
