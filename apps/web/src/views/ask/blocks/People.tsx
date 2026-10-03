import type { BlockersBlock, LeaderboardBlock, PersonBlock } from "@mesh/server/api";
import { PersonStatus } from "@mesh/contract";
import { ChevronRight } from "lucide-react";
import { Avatar } from "../../../components/bits";
import { StatusIcon } from "../../../components/StatusIcon";
import { ago, duration } from "../../../format";
import { Block, None } from "./Block";
import { SessionLine } from "./SessionRow";

export function LeaderboardView({ block, onOpen }: { block: LeaderboardBlock; onOpen: (id: string) => void }) {
  const max = Math.max(1, ...block.rows.map((r) => r.value));
  return (
    <Block title={block.title} count={block.rows.length} aside={block.unit}>
      {block.rows.length === 0 ? <None>Nobody to rank in this period.</None> : (
        <ol className="rep-rows">
          {block.rows.map((r, i) => {
            const inner = (
              <>
                <span className="rep-rank">{i + 1}</span>
                <Avatar name={r.person} size={28} />
                <span className="rep-name">{r.person}</span>
                <span className="rep-track"><i style={{ width: `${(r.value / max) * 100}%` }} /></span>
                <span className="rep-num">{r.value}</span>
                <span className="rep-sub">{r.detail ?? ""}</span>
              </>
            );
            return (
              <li key={r.person} className="rep-perf">
                {r.event_id ? <button type="button" className="rep-perf-btn" onClick={() => onOpen(r.event_id!)}>{inner}</button> : inner}
              </li>
            );
          })}
        </ol>
      )}
    </Block>
  );
}

export function BlockersView({ block, onOpen }: { block: BlockersBlock; onOpen: (id: string) => void }) {
  return (
    <Block title={block.title} count={block.rows.length}>
      {block.rows.length === 0 ? <None>Nobody was blocked in this period.</None> : (
        <ul className="rep-rows">
          {block.rows.map((b, i) => (
            <li key={`${b.person}-${b.event_id}-${i}`}>
              <button type="button" className="rep-blocked" disabled={!b.event_id} onClick={() => b.event_id && onOpen(b.event_id)}>
                <StatusIcon tone={b.stuck ? "stuck" : "blocked"} />
                <span className="rep-blocked-main">
                  <span className="rep-blocked-top">
                    <b>{b.person}</b>
                    {b.ticket_ref && <span className="rep-ref">{b.ticket_ref}</span>}
                    <span className="rep-sub">{duration(b.minutes)}</span>
                  </span>
                  <span className="rep-blocker-text">{b.blocker}</span>
                </span>
                <ChevronRight size={14} className="rep-chev" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

const STATUS_TEXT: Record<PersonStatus, string> = {
  [PersonStatus.active]: "Active",
  [PersonStatus.leaving]: "Leaving",
  [PersonStatus.left]: "Left",
};

export function PersonView({ block, now, onOpen }: { block: PersonBlock; now: number; onOpen: (id: string) => void }) {
  return (
    <Block title="Person">
      <div className="rep-person">
        <Avatar name={block.person} size={32} />
        <div className="rep-person-main">
          <div className="rep-person-top">
            <strong>{block.person}</strong>
            <span className="rep-chip">{STATUS_TEXT[block.status]}</span>
            <span className="rep-sub">{block.last_activity_at ? `Last active ${ago(block.last_activity_at, now)}` : "No activity yet"}</span>
          </div>
          <div className="rep-person-stats">
            <span><StatusIcon tone="done" size={12} />{block.done} done</span>
            <span><StatusIcon tone="progress" size={12} />{block.in_progress} in progress</span>
            <span><StatusIcon tone="blocked" size={12} />{block.blocked} blocked</span>
          </div>
          {block.modules.length > 0 && (
            <div className="ask-ev-mods">
              {block.modules.slice(0, 8).map((m) => <span key={m} className="rep-chip rep-chip-mono">{m}</span>)}
            </div>
          )}
        </div>
      </div>
      {block.current && (
        <ul className="rep-sessions">
          <SessionLine row={block.current} now={now} onOpen={onOpen} />
        </ul>
      )}
    </Block>
  );
}
