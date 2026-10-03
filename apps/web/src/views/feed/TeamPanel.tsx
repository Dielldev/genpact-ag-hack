import type { PersonSummary } from "@mesh/server/api";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { MeshGraph, type Signal } from "./MeshGraph";

interface Props {
  people: PersonSummary[];
  selected: string;
  signals: Record<string, Signal>;
  clashes: Set<string>;
  onSelect: (p: string) => void;
}

export function TeamPanel({ people, selected, signals, clashes, onSelect }: Props) {
  const [open, setOpen] = useState(true);
  return (
    <section className="panel" aria-label="Team">
      <header className="panel-head">
        <button type="button" className="panel-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <ChevronDown size={14} className="chev" />
          <h3>Team</h3>
          <span className="count">{people.length}</span>
        </button>
        <ul className="legend" aria-label="Legend">
          <li><i className="dot dot-open" />Open</li>
          <li><i className="dot dot-blocked" />Blocked</li>
          <li><i className="dot dot-stuck" />Stuck</li>
          <li><i className="dash" />Collision</li>
        </ul>
      </header>
      {open && (
        <div className="panel-body">
          {people.length === 0 ? <p className="panel-empty">Nobody has shared a report yet</p> : <MeshGraph people={people} selected={selected} signals={signals} clashes={clashes} onSelect={onSelect} />}
        </div>
      )}
    </section>
  );
}
