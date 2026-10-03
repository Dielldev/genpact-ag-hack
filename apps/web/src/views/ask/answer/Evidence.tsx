import type { AskResponse, EventRecord, SessionRow } from "@mesh/server/api";
import { Avatar } from "../../../components/bits";
import { StatusIcon } from "../../../components/StatusIcon";
import { day, STATUS_LABEL, toneOf, type Tone } from "../../../format";
import { Block } from "../blocks/Block";
import { MiniBar, type Segment } from "../blocks/Overview";
import { ReasonRow } from "../blocks/Reason";
import { SessionLine } from "../blocks/SessionRow";
import { openIdOf } from "../model";

interface Props {
  answer: AskResponse;
  now: number;
  onOpen: (id: string) => void;
  compact?: boolean;
}

const TONES: Tone[] = ["done", "progress", "blocked", "stuck", "active"];

const rowOf = (e: EventRecord, now: number): SessionRow => ({
  event_id: e.event_id,
  session_pk: e.session_pk,
  person: e.person,
  task: e.task,
  summary: e.summary,
  status: toneOf(e.status, e.status_since, now),
  ticket_ref: e.ticket_ref,
  modules: e.modules,
  last_seen_at: e.last_seen_at,
});

function Overview({ sources, now }: { sources: EventRecord[]; now: number }) {
  const latest = new Map<string, Tone>();
  const counts: Record<Tone, number> = { done: 0, progress: 0, blocked: 0, stuck: 0, active: 0 };
  for (const s of sources) {
    const tone = toneOf(s.status, s.status_since, now);
    counts[tone] += 1;
    if (!latest.has(s.person)) latest.set(s.person, tone);
  }
  const segments: Segment[] = TONES.map((tone) => ({ tone, label: STATUS_LABEL[tone], count: counts[tone] }));
  const modules = [...new Set(sources.flatMap((s) => s.modules))];
  return (
    <>
      <div className="ask-ev-top">
        <div className="ask-ev-people">
          {[...latest].map(([person, tone]) => (
            <span key={person} className="ask-person">
              <Avatar name={person} size={18} />
              {person}
              <StatusIcon tone={tone} size={13} />
              <span className="faint">{STATUS_LABEL[tone]}</span>
            </span>
          ))}
        </div>
        <MiniBar segments={segments} />
      </div>
      {modules.length > 0 && (
        <div className="ask-ev-mods">
          {modules.map((m) => <span key={m} className="rep-chip rep-chip-mono">{m}</span>)}
        </div>
      )}
    </>
  );
}

function Reasons({ sources, onOpen }: { sources: EventRecord[]; onOpen: (id: string) => void }) {
  const decisions = sources.flatMap((s) => s.decisions.map((d) => ({ ...d, person: s.person, id: openIdOf(s) })));
  const deadEnds = sources.flatMap((s) => s.dead_ends.map((d) => ({ ...d, person: s.person, id: openIdOf(s) })));
  if (decisions.length + deadEnds.length === 0) return null;
  return (
    <Block title="Dead ends and decisions" count={deadEnds.length + decisions.length} className="rep-flat">
      <ul className="rep-rows">
        {decisions.slice(0, 4).map((d) => (
          <ReasonRow key={d.id + d.choice} kind="Decision" title={d.choice} reason={d.reason} meta={`${d.person} · ${day(d.ts)}`} onClick={() => onOpen(d.id)} />
        ))}
        {deadEnds.slice(0, 4).map((d) => (
          <ReasonRow key={d.id + d.attempt} kind="Dead end" title={d.attempt} reason={d.reason} meta={`${d.person} · ${day(d.ts)}`} onClick={() => onOpen(d.id)} />
        ))}
      </ul>
    </Block>
  );
}

function Blockers({ sources, onOpen }: { sources: EventRecord[]; onOpen: (id: string) => void }) {
  const rows = sources.flatMap((s) => s.blockers.map((text) => ({ text, person: s.person, id: openIdOf(s) })));
  if (rows.length === 0) return null;
  return (
    <Block title="Blockers" count={rows.length} className="rep-flat">
      <ul className="rep-rows">
        {rows.slice(0, 5).map((b) => (
          <li key={b.id + b.text}>
            <button type="button" className="rep-issue" onClick={() => onOpen(b.id)}>
              <StatusIcon tone="blocked" size={14} />
              <span className="rep-issue-main">
                <span className="rep-issue-text">{b.text}</span>
                <span className="rep-issue-who"><span>{b.person}</span></span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Block>
  );
}

export function Evidence({ answer, now, onOpen, compact = false }: Props) {
  const { sources, knowledge } = answer;
  if (sources.length === 0 && knowledge.length === 0) return null;
  return (
    <section className="ask-evidence" aria-label="Evidence">
      <header className="rep-block-head">
        <h3>{compact ? "Sources" : "Evidence"}</h3>
        <span className="rep-count">{sources.length + knowledge.length}</span>
      </header>
      {!compact && sources.length > 0 && <Overview sources={sources} now={now} />}
      {!compact && <Blockers sources={sources} onOpen={onOpen} />}
      {!compact && <Reasons sources={sources} onOpen={onOpen} />}
      {knowledge.length > 0 && (
        <Block title="Exit interviews" count={knowledge.length} className="rep-flat">
          <ul className="rep-rows">
            {knowledge.map((k) => (
              <li key={k.entry_id} className="ask-know">
                <span className="rep-issue-text">{k.question}</span>
                <span className="rep-issue-why">{k.answer}</span>
                <span className="rep-issue-who"><span>{k.person} · {day(k.created_at)}</span></span>
              </li>
            ))}
          </ul>
        </Block>
      )}
      {sources.length > 0 && (
        <Block title="Cited sessions" count={sources.length} className="rep-flat">
          <ul className="rep-sessions">
            {sources.map((s) => <SessionLine key={s.session_pk} row={rowOf(s, now)} now={now} onOpen={onOpen} />)}
          </ul>
        </Block>
      )}
    </section>
  );
}
