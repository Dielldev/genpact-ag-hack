import type { SessionRow, SessionsBlock } from "@mesh/server/api";
import { useState } from "react";
import { Avatar } from "../../../components/bits";
import { StatusIcon } from "../../../components/StatusIcon";
import { ago } from "../../../format";
import { Block, None } from "./Block";

export function SessionLine({ row, now, onOpen }: { row: SessionRow; now: number; onOpen: (id: string) => void }) {
  return (
    <li>
      <button type="button" className="rep-session" onClick={() => onOpen(row.event_id ?? String(row.session_pk))}>
        <StatusIcon tone={row.status} />
        <span className="rep-ref">{row.ticket_ref ?? `S-${row.session_pk}`}</span>
        <span className="rep-session-task">{row.task ?? "Open session"}</span>
        <Avatar name={row.person} size={18} />
        <span className="rep-session-who">{row.person}</span>
        <span className="rep-session-ago">{ago(row.last_seen_at, now)}</span>
      </button>
    </li>
  );
}

const LIMIT = 10;

export function SessionsView({ block, now, onOpen }: { block: SessionsBlock; now: number; onOpen: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? block.rows : block.rows.slice(0, LIMIT);
  return (
    <Block title={block.title} count={block.rows.length}>
      {block.rows.length === 0 ? <None>No sessions in this period.</None> : (
        <ul className="rep-sessions">
          {shown.map((r) => <SessionLine key={r.session_pk} row={r} now={now} onOpen={onOpen} />)}
        </ul>
      )}
      {block.rows.length > LIMIT && (
        <button type="button" className="rep-more" onClick={() => setAll((v) => !v)}>
          {all ? "Show fewer" : `Show all ${block.rows.length}`}
        </button>
      )}
    </Block>
  );
}
