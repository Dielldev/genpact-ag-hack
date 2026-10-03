import { PersonStatus } from "@mesh/contract";
import type { FeedItem, PersonSummary, WarningCard } from "@mesh/server/api";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { StatusIcon } from "../../components/StatusIcon";
import type { Tone } from "../../format";
import { BoardCard } from "./BoardCard";
import type { BoardColumn, ColumnId } from "./boardModel";
import { warningsFor } from "./filters";

interface Props {
  columns: BoardColumn[];
  closed: Set<ColumnId>;
  onToggle: (id: ColumnId) => void;
  cursor: number;
  warnings: WarningCard[];
  people: PersonSummary[];
  focused: string;
  changed: Set<string>;
  now: number;
  onOpen: (item: FeedItem) => void;
  onPerson: (person: string) => void;
  onModule: (module: string) => void;
  onCursor: (index: number) => void;
  scrollKey: number;
}

const COLUMN_TONE: Record<ColumnId, Tone> = { progress: "progress", blocked: "blocked", done: "done" };

export function Board({ columns, closed, onToggle, cursor, warnings, people, focused, changed, now, onOpen, onPerson, onModule, onCursor, scrollKey }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const statusOf = new Map(people.map((p) => [p.person, p.status]));
  const toggleExpanded = (person: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (!next.delete(person)) next.add(person);
      return next;
    });

  useEffect(() => {
    if (scrollKey > 0) document.querySelector('[data-cursor="true"]')?.scrollIntoView({ block: "nearest" });
  }, [scrollKey]);

  let flat = -1;
  const template = columns.map((c) => (closed.has(c.id) ? "52px" : "minmax(0, 1fr)")).join(" ");
  return (
    <div className="board" style={{ ["--cols" as string]: template }}>
      {columns.map((col) => {
        const shut = closed.has(col.id);
        return (
          <section key={col.id} className={`bcol bcol-${col.id}${shut ? " bcol-shut" : ""}`} aria-label={col.label}>
            <button type="button" className="bcol-head" onClick={() => onToggle(col.id)} aria-expanded={!shut}>
              <ChevronDown size={14} className="chev" />
              <StatusIcon tone={COLUMN_TONE[col.id]} size={15} />
              <span className="bcol-label">{col.label}</span>
              <span className="n">{col.cards.length}</span>
            </button>
            {!shut && (
              <div className="bcol-body">
                {col.cards.length === 0 && <p className="bcol-empty">Nobody here right now</p>}
                {col.cards.map((card) => {
                  flat += 1;
                  const idx = flat;
                  const items = [card.lead, ...card.others];
                  return (
                    <BoardCard
                      key={card.person}
                      card={card}
                      status={statusOf.get(card.person) ?? PersonStatus.active}
                      warnings={warningsFor(card.lead, warnings)}
                      flash={items.some((i) => changed.has(i.key))}
                      selected={idx === cursor}
                      expanded={expanded.has(card.person) || focused === card.person}
                      now={now}
                      onToggle={() => toggleExpanded(card.person)}
                      onOpen={onOpen}
                      onPerson={onPerson}
                      onModule={onModule}
                      onHover={() => onCursor(idx)}
                    />
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
