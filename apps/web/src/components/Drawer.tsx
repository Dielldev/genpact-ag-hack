import { api } from "../api";
import { dateTime, day } from "../format";
import { useLoad, useNow } from "../hooks";
import { ArtifactChips, Avatar, ErrorState, Loading, ModuleChips, Section, StatusChip } from "./bits";
import { WarningItem } from "./WarningItem";

export function Drawer({ workspace, eventId, onClose, onOpen }: { workspace: string; eventId: string; onClose: () => void; onOpen: (id: string) => void }) {
  const now = useNow();
  const res = useLoad(() => api.event(workspace, eventId), [workspace, eventId]);
  const e = res.data?.event;
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(ev) => ev.stopPropagation()} aria-label="Session detail">
        <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        {res.loading && !e && <Loading />}
        {res.error && <ErrorState message={res.error} onRetry={res.reload} />}
        {e && (
          <>
            <div className="drawer-head">
              <Avatar name={e.person} />
              <div>
                <h2>{e.task ?? "Active session (no report yet)"}</h2>
                <p className="muted">
                  {e.person} · {e.project ?? "no project"} {e.ticket_ref && <span className="ticket">· {e.ticket_ref}</span>}
                </p>
              </div>
            </div>
            <StatusChip status={e.status} since={e.status_since} lastSeen={e.last_seen_at} now={now} />
            {e.summary && <p className="drawer-summary">{e.summary}</p>}
            {e.blockers.length > 0 && (
              <Section title="Blocking now" count={e.blockers.length}>
                <ul className="blockers">{e.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
              </Section>
            )}
            {(res.data?.warnings.length ?? 0) > 0 && (
              <Section title="Warnings" count={res.data!.warnings.length}>
                {res.data!.warnings.map((w) => <WarningItem key={w.warning_id} warning={w} now={now} onOpen={onOpen} compact />)}
              </Section>
            )}
            <Section title="Decisions" count={e.decisions.length}>
              {e.decisions.length === 0 ? <p className="muted">None recorded.</p> : (
                <ul className="reasons">{e.decisions.map((d) => <li key={d.choice + d.ts}><strong>{d.choice}</strong><span>{d.reason}</span><time>{day(d.ts)}</time></li>)}</ul>
              )}
            </Section>
            <Section title="Dead ends" count={e.dead_ends.length}>
              {e.dead_ends.length === 0 ? <p className="muted">None recorded.</p> : (
                <ul className="reasons">{e.dead_ends.map((d) => <li key={d.attempt + d.ts}><strong>{d.attempt}</strong><span>{d.reason}</span><time>{day(d.ts)}</time></li>)}</ul>
              )}
            </Section>
            <Section title="Human corrections" count={e.human_corrections.length}>
              {e.human_corrections.length === 0 ? <p className="muted">None recorded.</p> : (
                <ul className="reasons">{e.human_corrections.map((c) => <li key={c.correction + c.ts}><strong>{c.correction}</strong><span>{c.reason}</span><time>{day(c.ts)}</time></li>)}</ul>
              )}
            </Section>
            <Section title="Artifacts" count={e.artifacts.length}>
              <ArtifactChips artifacts={e.artifacts} max={30} />
            </Section>
            <Section title="Modules">
              <ModuleChips modules={e.modules} />
            </Section>
            <dl className="meta">
              <dt>Client</dt><dd>{e.client}</dd>
              <dt>Started</dt><dd>{dateTime(e.first_seen_at)}</dd>
              <dt>Last report</dt><dd>{dateTime(e.last_report_at) || "none"}</dd>
              <dt>Last seen</dt><dd>{dateTime(e.last_seen_at)}</dd>
              <dt>Reports</dt><dd>{e.report_count}</dd>
            </dl>
          </>
        )}
      </aside>
    </div>
  );
}
