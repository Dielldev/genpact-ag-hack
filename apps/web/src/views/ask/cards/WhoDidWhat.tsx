import { Avatar } from "../../../components/bits";
import type { PersonRow } from "./compose";
import { Card, ExpandList } from "./Parts";

function Row({ row, onOpen }: { row: PersonRow; onOpen: (id: string) => void }) {
  const inner = (
    <>
      <Avatar name={row.person} size={24} />
      <b className="ask-who-name">{row.person}</b>
      <span className="ask-who-done">{row.done === null ? "" : `${row.done} done`}</span>
      <span className="ask-who-task">{row.task ?? "No open task"}</span>
      <span className={`ask-dot${row.blocked ? " is-on" : ""}`} title={row.blocked ? "Blocked" : undefined} />
    </>
  );
  return row.id ? <button type="button" className="ask-row ask-who" onClick={() => onOpen(row.id!)}>{inner}</button> : <div className="ask-row ask-who ask-row-static">{inner}</div>;
}

export function WhoDidWhatCard({ rows, onOpen }: { rows: PersonRow[]; onOpen: (id: string) => void }) {
  if (rows.length === 0) return null;
  return (
    <Card title="Who did what">
      <ExpandList cap={6} rows={rows.map((r) => <Row key={r.key} row={r} onOpen={onOpen} />)} />
    </Card>
  );
}
