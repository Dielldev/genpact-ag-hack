import { PersonStatus } from "@mesh/contract";
import type { FeedItem, WarningCard } from "@mesh/server/api";
import { ChevronDown, GitCompareArrows, History, OctagonAlert } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import { Avatar } from "../../components/bits";
import { StatusIcon } from "../../components/StatusIcon";
import { ago, plural, statusLine } from "../../format";
import { isLive, leadVerb, troubled, type PersonCard } from "./boardModel";
import { toneFor } from "./filters";

interface Props {
  card: PersonCard;
  status: PersonStatus;
  warnings: WarningCard[];
  flash: boolean;
  selected: boolean;
  expanded: boolean;
  now: number;
  onToggle: () => void;
  onOpen: (item: FeedItem) => void;
  onPerson: (person: string) => void;
  onModule: (module: string) => void;
  onHover: () => void;
}

const stop = (fn: () => void) => (e: MouseEvent) => {
  e.stopPropagation();
  fn();
};

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function BoardCard({ card, status, warnings, flash, selected, expanded, now, onToggle, onOpen, onPerson, onModule, onHover }: Props) {
  const { lead, tone, person } = card;
  const collisions = warnings.filter((w) => w.kind === "collision").length;
  const rediscoveries = warnings.length - collisions;
  const blocker = lead.blockers[0];
  const trouble = troubled(card.others, now);
  const onKey = (e: KeyboardEvent) => {
    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onOpen(lead);
    }
  };
  return (
    <article
      className={`bcard bcard-${tone}${selected ? " bcard-cursor" : ""}${flash ? " bcard-flash" : ""}`}
      data-cursor={selected}
      tabIndex={0}
      onClick={() => onOpen(lead)}
      onKeyDown={onKey}
      onMouseMove={onHover}
      aria-label={`${person} ${leadVerb(card)} ${lead.task ?? "an open session"}`}
    >
      <header className="bcard-head">
        <button type="button" className="bcard-who" onClick={stop(() => onPerson(person))} title={`Show only ${person}`}>
          <span className="bcard-avatar">
            <Avatar name={person} size={28} />
            {isLive(card, now) && <i className="live-dot" title="Reported in the last 5 minutes" />}
          </span>
          <span className="bcard-name">
            <strong>{person}</strong> <span>{leadVerb(card)}</span>
          </span>
        </button>
        {status !== PersonStatus.active && <span className={`badge badge-${status}`}>{status}</span>}
        {lead.ticket_ref && <span className="tag tag-mono">{lead.ticket_ref}</span>}
      </header>
      <h4 className={`bcard-task${lead.task ? "" : " bcard-task-empty"}`}>{lead.task ?? "No report filed yet"}</h4>
      {lead.summary && <p className="bcard-summary">{lead.summary}</p>}
      {blocker && (
        <p className={`bcard-blocker${tone === "stuck" ? " bcard-blocker-red" : ""}`}>
          <OctagonAlert size={14} />
          <span>
            {blocker}
            {lead.blockers.length > 1 && <em> +{lead.blockers.length - 1} more</em>}
          </span>
        </p>
      )}
      {(collisions > 0 || rediscoveries > 0 || lead.modules.length > 0) && (
        <div className="bcard-tags">
          {collisions > 0 && <span className="tag tag-collision" title="Collision"><GitCompareArrows size={12} />{collisions}</span>}
          {rediscoveries > 0 && <span className="tag tag-rediscovery" title="Rediscovery"><History size={12} />{rediscoveries}</span>}
          {lead.modules.slice(0, 3).map((m) => (
            <button key={m} type="button" className="tag tag-mono tag-btn" onClick={stop(() => onModule(m))}>{m}</button>
          ))}
        </div>
      )}
      <footer className="bcard-foot">
        <span className="bcard-status"><StatusIcon tone={tone} size={14} />{sentence(statusLine(lead.status, lead.status_since, lead.last_seen_at, now))}</span>
        {card.others.length > 0 && (
          <button type="button" className={`bcard-more${trouble > 0 ? " bcard-more-hot" : ""}`} aria-expanded={expanded} onClick={stop(onToggle)}>
            {expanded ? "Hide others" : `+${plural(card.others.length, "other session")}`}
            <ChevronDown size={13} className="chev" />
          </button>
        )}
      </footer>
      {expanded && (
        <ul className="bcard-others">
          {card.others.map((item) => (
            <li key={item.key}>
              <button type="button" onClick={stop(() => onOpen(item))}>
                <StatusIcon tone={toneFor(item, now)} size={13} />
                <span className="bcard-other-ref">{item.ticket_ref ?? `S-${item.session_pk}`}</span>
                <span className="bcard-other-task">{item.task ?? "No report filed yet"}</span>
                <time>{ago(item.last_seen_at, now)}</time>
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
