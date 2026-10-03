import { useEffect, useRef, useState } from "react";
import { ReportStatus } from "@mesh/contract";
import type { FeedItem, WarningCard } from "@mesh/server/api";
import { api } from "../api";
import { ArtifactChips, Avatar, Empty, ErrorState, Loading, ModuleChips, StatusChip } from "../components/bits";
import { WarningItem } from "../components/WarningItem";
import { minutesSince, STUCK_AFTER_MINUTES, toneOf } from "../format";
import { useLoad, useNow } from "../hooks";

const POLL_MS = 4000;

function useChanged(items: FeedItem[] | undefined): Set<string> {
  const seen = useRef(new Map<string, string>());
  const [changed, setChanged] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!items) return;
    const fresh = new Set<string>();
    for (const item of items) {
      const stamp = `${item.last_seen_at}|${item.report_count}|${item.status}`;
      const before = seen.current.get(item.key);
      if (before !== undefined && before !== stamp) fresh.add(item.key);
      seen.current.set(item.key, stamp);
    }
    if (fresh.size === 0) return;
    setChanged(fresh);
    const timer = setTimeout(() => setChanged(new Set()), 2500);
    return () => clearTimeout(timer);
  }, [items]);
  return changed;
}

function Card({ item, now, warnings, changed, onOpen, onModule }: { item: FeedItem; now: number; warnings: WarningCard[]; changed: boolean; onOpen: (id: string) => void; onModule: (m: string) => void }) {
  const tone = toneOf(item.status, item.status_since, now);
  const open = () => onOpen(item.event_id ?? String(item.session_pk));
  return (
    <article className={`card card-${tone}${changed ? " card-changed" : ""}`}>
      <button type="button" className="card-main" onClick={open}>
        <div className="card-top">
          <Avatar name={item.person} />
          <div className="card-who">
            <strong>{item.person}</strong>
            <span className="muted">
              {item.project ?? "no project"}
              {item.ticket_ref && <span className="ticket"> · {item.ticket_ref}</span>}
            </span>
          </div>
          <StatusChip status={item.status} since={item.status_since} lastSeen={item.last_seen_at} now={now} />
        </div>
        <h3 className="card-task">{item.task ?? "Working, no report filed yet"}</h3>
        {item.summary && <p className="card-summary">{item.summary}</p>}
        {item.blockers.length > 0 && (
          <ul className="blockers">{item.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
        )}
      </button>
      <ModuleChips modules={item.modules} onPick={onModule} />
      <ArtifactChips artifacts={item.artifacts} />
      {warnings.map((w) => <WarningItem key={w.warning_id} warning={w} now={now} onOpen={onOpen} compact />)}
    </article>
  );
}

export function Feed({ workspace, onOpen }: { workspace: string; onOpen: (id: string) => void }) {
  const now = useNow(5000);
  const [person, setPerson] = useState("");
  const [status, setStatus] = useState("");
  const [module, setModule] = useState("");
  const feed = useLoad(() => api.feed(workspace, { person, status, module }), [workspace, person, status, module], POLL_MS);
  const warnings = useLoad(() => api.warnings(workspace), [workspace], POLL_MS);
  const vocab = useLoad(() => api.modules(workspace), [workspace], 30_000);
  const items = feed.data?.items;
  const changed = useChanged(items);
  const all = items ?? [];
  const blocked = all.filter((i) => i.status === ReportStatus.blocked);
  const stuck = blocked.filter((i) => minutesSince(i.status_since, now) > STUCK_AFTER_MINUTES);
  const recent = (warnings.data?.warnings ?? []).filter((w) => w.kind === "collision" && minutesSince(w.created_at, now) < 24 * 60);
  const warningsFor = (item: FeedItem) => (warnings.data?.warnings ?? []).filter((w) => w.reporter.session_pk === item.session_pk || w.sources.some((s) => s.session_pk === item.session_pk)).slice(0, 2);

  return (
    <div className="view">
      <div className="attention">
        <div className={`stat ${blocked.length ? "stat-amber" : ""}`}><span>{blocked.length}</span>blocked sessions</div>
        <div className={`stat ${stuck.length ? "stat-red" : ""}`}><span>{stuck.length}</span>stuck over {STUCK_AFTER_MINUTES} min</div>
        <div className={`stat ${recent.length ? "stat-magenta" : ""}`}><span>{recent.length}</span>collisions in 24h</div>
        <div className="stat"><span>{all.filter((i) => i.status !== ReportStatus.done).length}</span>active now</div>
      </div>
      <div className="filters">
        <select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Person">
          <option value="">Everyone</option>
          {(vocab.data?.people ?? []).map((p) => <option key={p}>{p}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">Any status</option>
          <option value={ReportStatus.inProgress}>In progress</option>
          <option value={ReportStatus.blocked}>Blocked</option>
          <option value={ReportStatus.done}>Done</option>
          <option value="active">Active, no report</option>
        </select>
        <select value={module} onChange={(e) => setModule(e.target.value)} aria-label="Module">
          <option value="">All modules</option>
          {(vocab.data?.modules ?? []).map((m) => <option key={m}>{m}</option>)}
        </select>
        {(person || status || module) && <button type="button" className="btn btn-ghost" onClick={() => { setPerson(""); setStatus(""); setModule(""); }}>Clear</button>}
      </div>
      {feed.loading && !items && <Loading label="Loading the live feed" />}
      {feed.error && !items && <ErrorState message={feed.error} onRetry={feed.reload} />}
      {items && items.length === 0 && <Empty title="No shared sessions yet">Sessions appear here as soon as an agent finishes a response with the hook installed.</Empty>}
      <div className="cards">
        {all.map((item) => (
          <Card key={item.key} item={item} now={now} warnings={warningsFor(item)} changed={changed.has(item.key)} onOpen={onOpen} onModule={setModule} />
        ))}
      </div>
    </div>
  );
}
