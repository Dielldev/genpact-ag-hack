import { FeedKind, type EventRecord, type FeedItem } from "../api/types.js";

export function toFeedItem(e: EventRecord): FeedItem {
  return {
    key: String(e.session_pk),
    kind: e.report_count > 0 ? FeedKind.report : FeedKind.presence,
    event_id: e.event_id,
    session_pk: e.session_pk,
    client: e.client,
    session_id: e.session_id,
    person: e.person,
    project: e.project,
    ticket_ref: e.ticket_ref,
    task: e.task,
    summary: e.summary,
    status: e.status,
    status_since: e.status_since,
    modules: e.modules,
    artifacts: e.artifacts,
    blockers: e.blockers,
    report_count: e.report_count,
    first_seen_at: e.first_seen_at,
    last_seen_at: e.last_seen_at,
    last_report_at: e.last_report_at,
  };
}
