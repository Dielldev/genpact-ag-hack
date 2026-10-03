import { PersonStatus } from "@mesh/contract";
import type { PersonSummary } from "@mesh/server/api";
import { ChevronLeft, ChevronRight, Users, X } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "../../components/bits";
import { ago, plural } from "../../format";
import type { StatValues } from "./feedStats";
import type { Period } from "./series";
import { Sparkline } from "./Sparkline";

interface Props {
  workspace: string;
  people: PersonSummary[];
  person: string;
  onPerson: (p: string) => void;
  values: StatValues;
  period: Period;
  now: number;
}

interface CellProps {
  label: string;
  value: number;
  hint?: ReactNode;
  spark?: number[];
}

function Cell({ label, value, hint, spark }: CellProps) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {spark && <Sparkline counts={spark} />}
      </div>
      <div className="stat-row">
        <strong>{value}</strong>
        {hint && <span className="stat-hint">{hint}</span>}
      </div>
    </div>
  );
}

function Who({ workspace, people, person, onPerson, now }: Omit<Props, "values" | "period">) {
  const stops = ["", ...people.map((p) => p.person)];
  const at = Math.max(0, stops.indexOf(person));
  const who = people.find((p) => p.person === person);
  const sub = who
    ? `${who.modules.slice(0, 3).join(", ") || "No modules yet"}${who.modules.length > 3 ? ` +${who.modules.length - 3}` : ""} · last active ${ago(who.last_activity_at, now)}`
    : plural(people.length, "person").replace("persons", "people");
  return (
    <div className="stat stat-who">
      {who ? <Avatar name={who.person} size={28} /> : <span className="stat-team"><Users size={14} /></span>}
      <div className="stat-who-text">
        <span className="stat-who-name">
          <strong>{who ? who.person : workspace || "Mesh"}</strong>
          {who && who.status !== PersonStatus.active && <span className={`badge badge-${who.status}`}>{who.status}</span>}
        </span>
        <span className="stat-who-sub">{sub}</span>
      </div>
      <div className="stat-who-actions">
        <button type="button" className="icon-btn" disabled={at === 0} onClick={() => onPerson(stops[at - 1] ?? "")} aria-label="Previous person"><ChevronLeft size={15} /></button>
        <button type="button" className="icon-btn" disabled={at >= stops.length - 1} onClick={() => onPerson(stops[at + 1] ?? "")} aria-label="Next person"><ChevronRight size={15} /></button>
        {who && <button type="button" className="icon-btn" onClick={() => onPerson("")} aria-label="Clear person" title="Show everyone"><X size={14} /></button>}
      </div>
    </div>
  );
}

export function Stats({ workspace, people, person, onPerson, values: v, period, now }: Props) {
  return (
    <section className="stats" aria-label="Team summary">
      <Who workspace={workspace} people={people} person={person} onPerson={onPerson} now={now} />
      <Cell label="Sessions" value={v.sessions} hint={`+${v.startedInPeriod} · ${period.id}`} spark={v.sessionSpark} />
      <Cell label="Open now" value={v.open} hint={v.live > 0 ? <><i className="live-pip" />{v.live} live</> : "None live"} />
      <Cell label="Blocked" value={v.blocked} hint={v.stuck > 0 ? <span className="stat-red">{v.stuck} stuck</span> : "None stuck"} />
      <Cell label="Collisions" value={v.collisions} hint={`${v.collisionsInPeriod} · ${period.id}`} spark={v.collisionSpark} />
      <Cell label="Modules" value={v.modules} />
    </section>
  );
}
