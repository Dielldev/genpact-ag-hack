import { Avatar } from "../../../components/bits";
import { duration } from "../../../format";
import type { AttentionRow, Severity } from "./compose";
import { Card, ExpandList } from "./Parts";

const LABEL: Record<Severity, string> = {
  stuck: "Stuck",
  blocked: "Blocked",
  collision: "Collision",
  rediscovery: "Rediscovered",
};

function Row({ row, onOpen }: { row: AttentionRow; onOpen: (id: string) => void }) {
  const names = row.people.slice(0, 3).join(", ");
  const inner = (
    <>
      <span className="ask-faces">
        {row.people.slice(0, 2).map((p) => <Avatar key={p} name={p} size={24} />)}
      </span>
      <span className="ask-row-main">
        <span className="ask-row-top">
          <b>{names}</b>
          <span className={`ask-tag ask-tag-${row.severity}`}>{LABEL[row.severity]}</span>
          <span className="ask-row-title">{row.title}</span>
        </span>
        <span className="ask-row-reason">{row.reason}</span>
      </span>
      {row.minutes !== undefined && <span className={`ask-row-meta${row.severity === "stuck" ? " is-trouble" : ""}`}>{duration(row.minutes)}</span>}
    </>
  );
  return row.id ? <button type="button" className="ask-row" onClick={() => onOpen(row.id!)}>{inner}</button> : <div className="ask-row ask-row-static">{inner}</div>;
}

export function AttentionCard({ rows, onOpen }: { rows: AttentionRow[]; onOpen: (id: string) => void }) {
  return (
    <Card title="Needs attention">
      {rows.length === 0 ? <p className="ask-calm">Nothing is blocked.</p> : <ExpandList cap={5} rows={rows.map((r) => <Row key={r.key} row={r} onOpen={onOpen} />)} />}
    </Card>
  );
}
