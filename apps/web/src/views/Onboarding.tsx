import { useState } from "react";
import { api } from "../api";
import { Avatar, Empty, ErrorState, Loading, Section, StatusChip } from "../components/bits";
import { day } from "../format";
import { useLoad, useNow } from "../hooks";

export function Onboarding({ workspace, onOpen }: { workspace: string; onOpen: (id: string) => void }) {
  const now = useNow();
  const vocab = useLoad(() => api.modules(workspace), [workspace]);
  const [module, setModule] = useState("");
  const res = useLoad(() => (module ? api.onboarding(workspace, module) : Promise.resolve(undefined)), [workspace, module]);
  const g = res.data;
  return (
    <div className="view">
      <div className="filters">
        <select value={module} onChange={(e) => setModule(e.target.value)} aria-label="Module">
          <option value="">Choose a module…</option>
          {(vocab.data?.modules ?? []).map((m) => <option key={m}>{m}</option>)}
        </select>
        {g?.owner && (
          <span className="owner">
            Owner <strong>{g.owner.person}</strong> ({Math.round(g.owner.share * 100)}% of sessions)
            {g.owner_left && <span className="badge badge-left">{g.owner.status === "left" ? "Owner has left" : "Owner is leaving"}</span>}
          </span>
        )}
      </div>
      {!module && <Empty title="Get up to speed on any module">History, dead ends, decisions and exit-interview answers, even when the owner has gone.</Empty>}
      {module && res.loading && !g && <Loading />}
      {res.error && <ErrorState message={res.error} onRetry={res.reload} />}
      {g && (
        <div className="onboarding">
          <div className="onboarding-main">
            {g.exit_answers.length > 0 && (
              <Section title="From the exit interview" count={g.exit_answers.length}>
                <ul className="reasons reasons-highlight">{g.exit_answers.map((k) => <li key={k.entry_id}><strong>{k.question}</strong><span>{k.answer}</span><time>{k.person} · {day(k.created_at)}</time></li>)}</ul>
              </Section>
            )}
            <Section title="Dead ends, and why" count={g.dead_ends.length}>
              {g.dead_ends.length === 0 ? <p className="muted">None recorded.</p> : <ul className="reasons">{g.dead_ends.map((d, i) => <li key={i}><strong>{d.attempt}</strong><span>{d.reason}</span><time>{d.person} · {day(d.ts)}</time></li>)}</ul>}
            </Section>
            <Section title="Decisions" count={g.decisions.length}>
              {g.decisions.length === 0 ? <p className="muted">None recorded.</p> : <ul className="reasons">{g.decisions.map((d, i) => <li key={i}><strong>{d.choice}</strong><span>{d.reason}</span><time>{d.person} · {day(d.ts)}</time></li>)}</ul>}
            </Section>
            <Section title="Corrections from humans" count={g.human_corrections.length}>
              {g.human_corrections.length === 0 ? <p className="muted">None recorded.</p> : <ul className="reasons">{g.human_corrections.map((c, i) => <li key={i}><strong>{c.correction}</strong><span>{c.reason}</span><time>{c.person} · {day(c.ts)}</time></li>)}</ul>}
            </Section>
            <Section title="History" count={g.history.length}>
              <ol className="timeline">
                {g.history.map((e) => (
                  <li key={e.session_pk}>
                    <button type="button" className="link" onClick={() => onOpen(e.event_id ?? String(e.session_pk))}>
                      <time>{day(e.first_seen_at)}</time> <strong>{e.task}</strong> <span className="muted">· {e.person}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </Section>
          </div>
          <div className="onboarding-side">
            <Section title="Read these files first" count={g.files_to_read.length}>
              {g.files_to_read.length === 0 ? <p className="muted">No files recorded.</p> : <ol className="files">{g.files_to_read.map((f) => <li key={f.ref}><code>{f.ref}</code><span className="muted">{f.sessions} sessions</span></li>)}</ol>}
            </Section>
            <Section title="People" count={g.contributors.length}>
              <ul className="people">{g.contributors.map((c) => <li key={c.person}><Avatar name={c.person} /><span><strong>{c.person}</strong> <span className="muted">{c.sessions} sessions{c.status !== "active" ? ` · ${c.status}` : ""}</span></span></li>)}</ul>
            </Section>
            {g.open_work.length > 0 && (
              <Section title="Open right now" count={g.open_work.length}>
                {g.open_work.map((e) => (
                  <button key={e.session_pk} type="button" className="mini" onClick={() => onOpen(e.event_id ?? String(e.session_pk))}>
                    <strong>{e.person}</strong> {e.task}
                    <StatusChip status={e.status} since={e.status_since} lastSeen={e.last_seen_at} now={now} />
                  </button>
                ))}
              </Section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
