import type { PersonSummary } from "@mesh/server/api";
import { Activity, Boxes, ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { ago, plural } from "../../format";
import { MeshGraph, type Signal } from "./MeshGraph";

interface Props {
  workspace: string;
  people: PersonSummary[];
  person: string;
  onPerson: (p: string) => void;
  totals: { sessions: number; open: number; modules: number };
  signals: Record<string, Signal>;
  clashes: Set<string>;
  now: number;
}

export function Hero({ workspace, people, person, onPerson, totals, signals, clashes, now }: Props) {
  const stops = ["", ...people.map((p) => p.person)];
  const at = Math.max(0, stops.indexOf(person));
  const who = people.find((p) => p.person === person);
  const stats = who ? { sessions: who.sessions, open: who.open_sessions, modules: who.modules.length } : totals;
  const sub = who
    ? `${who.modules.slice(0, 3).join(", ") || "No modules yet"}${who.modules.length > 3 ? ` +${who.modules.length - 3}` : ""} · last active ${ago(who.last_activity_at, now)}`
    : `${plural(people.length, "person").replace("persons", "people")} sharing reports · click a teammate to focus`;
  return (
    <section className="hero" aria-label="Team spotlight">
      <div className="hero-main">
        <div className="hero-title-row">
          <h2 className="hero-title">
            {who ? who.person : workspace || "Mesh"}
            {who && who.status !== "active" && <sup>{who.status}</sup>}
          </h2>
          <div className="hero-arrows">
            <button type="button" className="arrow-btn" disabled={at === 0} onClick={() => onPerson(stops[at - 1] ?? "")} aria-label="Previous person"><ChevronLeft size={18} /></button>
            <button type="button" className="arrow-btn" disabled={at >= stops.length - 1} onClick={() => onPerson(stops[at + 1] ?? "")} aria-label="Next person"><ChevronRight size={18} /></button>
          </div>
        </div>
        <p className="hero-sub">{sub}</p>
        <MeshGraph people={people} selected={person} signals={signals} clashes={clashes} onSelect={onPerson} />
      </div>
      <div className="hero-stats">
        <div className="hero-stat"><span className="stat-ico stat-ico-pink"><Layers size={22} /></span><div><strong>{stats.sessions}</strong><span className="label">Sessions</span></div></div>
        <div className="hero-stat"><span className="stat-ico stat-ico-brand"><Activity size={22} /></span><div><strong>{stats.open}</strong><span className="label">Open now</span></div></div>
        <div className="hero-stat"><span className="stat-ico stat-ico-grey"><Boxes size={22} /></span><div><strong>{stats.modules}</strong><span className="label">Modules</span></div></div>
      </div>
    </section>
  );
}
