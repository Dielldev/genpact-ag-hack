import { X } from "lucide-react";
import { useEffect } from "react";
import { api } from "../api";
import { dateTime, day } from "../format";
import { useLoad, useNow } from "../hooks";
import { ArtifactChips, Avatar, ErrorState, Loading, ModuleChips, Section, StatusChip } from "./bits";
import { WarningItem } from "./WarningItem";

function Reasons<T extends { ts: string }>({ rows, title, why, empty }: { rows: T[]; title: (r: T) => string; why: (r: T) => string; empty: string }) {
  if (rows.length === 0) return <p className="muted">{empty}</p>;
  return (
    <ul className="reasons">
      {rows.map((r) => (
        <li key={title(r) + r.ts}>
          <strong>{title(r)}</strong>
          <span>{why(r)}</span>
          <time>{day(r.ts)}</time>
        </li>
      ))}
    </ul>
  );
}

export function Drawer({ workspace, eventId, onClose, onOpen }: { workspace: string; eventId: string; onClose: () => void; onOpen: (id: string) => void }) {
  const now = useNow();
  const res = useLoad(() => api.event(workspace, eventId), [workspace, eventId]);
  const e = res.data?.event;
  const warnings = res.data?.warnings ?? [];

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="backdrop drawer-backdrop" data-modal onClick={onClose}>
      <aside className="drawer" onClick={(ev) => ev.stopPropagation()} aria-label="Session detail">
        <div className="drawer-top">
          <span className="grow">{e ? `${e.ticket_ref ?? `Session ${e.session_pk}`} · ${e.person}` : "Session"}</span>
          <kbd>esc</kbd>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="drawer-body">
          {res.loading && !e && <Loading />}
          {res.error && <ErrorState message={res.error} onRetry={res.reload} />}
          {e && (
            <>
              <h2>{e.task ?? "Active session (no report yet)"}</h2>
              {e.summary && <p className="drawer-summary">{e.summary}</p>}
              <dl className="props">
                <dt>Status</dt><dd><StatusChip status={e.status} since={e.status_since} lastSeen={e.last_seen_at} now={now} /></dd>
                <dt>Person</dt><dd><Avatar name={e.person} size={22} /> {e.person}</dd>
                <dt>Project</dt><dd>{e.project ?? <span className="faint">None</span>}</dd>
                <dt>Ticket</dt><dd>{e.ticket_ref ? <span className="tag tag-mono">{e.ticket_ref}</span> : <span className="faint">None</span>}</dd>
                <dt>Modules</dt><dd>{e.modules.length ? <ModuleChips modules={e.modules} /> : <span className="faint">None</span>}</dd>
                <dt>Client</dt><dd>{e.client}</dd>
                <dt>Started</dt><dd>{dateTime(e.first_seen_at)}</dd>
                <dt>Last report</dt><dd>{dateTime(e.last_report_at) || "None"}</dd>
                <dt>Reports</dt><dd>{e.report_count}</dd>
              </dl>
              {e.blockers.length > 0 && (
                <Section title="Blocking now" count={e.blockers.length}>
                  <ul className="blockers">{e.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
                </Section>
              )}
              {warnings.length > 0 && (
                <Section title="Warnings" count={warnings.length}>
                  {warnings.map((w) => <WarningItem key={w.warning_id} warning={w} now={now} onOpen={onOpen} compact />)}
                </Section>
              )}
              <Section title="Decisions" count={e.decisions.length}>
                <Reasons rows={e.decisions} title={(d) => d.choice} why={(d) => d.reason} empty="None recorded." />
              </Section>
              <Section title="Dead ends" count={e.dead_ends.length}>
                <Reasons rows={e.dead_ends} title={(d) => d.attempt} why={(d) => d.reason} empty="None recorded." />
              </Section>
              <Section title="Human corrections" count={e.human_corrections.length}>
                <Reasons rows={e.human_corrections} title={(c) => c.correction} why={(c) => c.reason} empty="None recorded." />
              </Section>
              <Section title="Artifacts" count={e.artifacts.length}>
                <ArtifactChips artifacts={e.artifacts} max={30} />
              </Section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
