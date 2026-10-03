import type { FeedItem, WarningCard } from "@mesh/server/api";
import { ChevronDown, GitCompareArrows, History } from "lucide-react";
import { useEffect } from "react";
import { Avatar } from "../../components/bits";
import { StatusIcon } from "../../components/StatusIcon";
import { duration, minutesSince, STATUS_LABEL, type Tone } from "../../format";
import { warningsFor, type Group } from "./filters";

interface Props {
  groups: Group[];
  closed: Set<Tone>;
  onToggle: (tone: Tone) => void;
  cursor: number;
  warnings: WarningCard[];
  changed: Set<string>;
  now: number;
  onOpen: (id: string) => void;
  onModule: (m: string) => void;
  onCursor: (i: number) => void;
  scrollKey: number;
}

function Row({ item, tone, warnings, flash, selected, now, onOpen, onModule, onHover }: { item: FeedItem; tone: Tone; warnings: WarningCard[]; flash: boolean; selected: boolean; now: number; onOpen: () => void; onModule: (m: string) => void; onHover: () => void }) {
  const collisions = warnings.filter((w) => w.kind === "collision").length;
  const rediscoveries = warnings.length - collisions;
  const blocker = item.blockers[0];
  return (
    <div className={`srow${selected ? " srow-cursor" : ""}${flash ? " srow-flash" : ""}`} role="row" data-cursor={selected} onClick={onOpen} onMouseMove={onHover}>
      <StatusIcon tone={tone} />
      <span className="srow-id">{item.ticket_ref ?? `S-${item.session_pk}`}</span>
      <span className="srow-main">
        <span className="srow-title">{item.task ?? "Working, no report filed yet"}</span>
        {blocker && <span className={`srow-sub${tone === "stuck" ? " srow-sub-red" : ""}`}>{blocker}</span>}
      </span>
      <span className="srow-tags">
        {collisions > 0 && <span className="tag tag-collision" title="Collision"><GitCompareArrows size={12} />{collisions}</span>}
        {rediscoveries > 0 && <span className="tag tag-rediscovery" title="Rediscovery"><History size={12} />{rediscoveries}</span>}
        {item.modules.slice(0, 2).map((m) => (
          <button key={m} type="button" className="tag tag-mono tag-btn" onClick={(e) => { e.stopPropagation(); onModule(m); }}>{m}</button>
        ))}
      </span>
      <Avatar name={item.person} size={24} />
      <span className="srow-time">{duration(minutesSince(item.last_seen_at, now))}</span>
    </div>
  );
}

export function SessionList({ groups, closed, onToggle, cursor, warnings, changed, now, onOpen, onModule, onCursor, scrollKey }: Props) {
  useEffect(() => {
    if (scrollKey > 0) document.querySelector('[data-cursor="true"]')?.scrollIntoView({ block: "nearest" });
  }, [scrollKey]);
  let flat = -1;
  return (
    <div role="table">
      {groups.map((g) => (
        <section key={g.tone} className={closed.has(g.tone) ? "group-closed" : ""}>
          <button type="button" className="group-head" onClick={() => onToggle(g.tone)} aria-expanded={!closed.has(g.tone)}>
            <ChevronDown size={14} className="chev" />
            <StatusIcon tone={g.tone} size={15} />
            {STATUS_LABEL[g.tone]}
            <span className="n">{g.items.length}</span>
          </button>
          {!closed.has(g.tone) && g.items.map((item) => {
            flat += 1;
            const idx = flat;
            return (
              <Row key={item.key} item={item} tone={g.tone} warnings={warningsFor(item, warnings)} flash={changed.has(item.key)} selected={idx === cursor} now={now} onHover={() => onCursor(idx)} onModule={onModule} onOpen={() => onOpen(item.event_id ?? String(item.session_pk))} />
            );
          })}
        </section>
      ))}
    </div>
  );
}
