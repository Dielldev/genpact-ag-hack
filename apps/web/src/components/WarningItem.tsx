import type { WarningCard } from "@mesh/server/api";
import { ArrowRight, GitCompareArrows, History } from "lucide-react";
import { ago } from "../format";
import { Avatar } from "./bits";

export function WarningItem({ warning, now, onOpen, compact }: { warning: WarningCard; now: number; onOpen: (id: string) => void; compact?: boolean }) {
  const source = warning.sources[0];
  const Icon = warning.kind === "collision" ? GitCompareArrows : History;
  return (
    <article className={`warning warning-${warning.kind}${compact ? " warning-compact" : ""}`}>
      <span className="warning-ico"><Icon size={compact ? 15 : 19} /></span>
      <header>
        <span className={`badge badge-${warning.kind}`}>{warning.kind === "collision" ? "Collision" : "Rediscovery"}</span>
        <span className="faint">{ago(warning.created_at, now)}</span>
      </header>
      <p className="warning-message">{warning.message}</p>
      {!compact && (
        <div className="warning-people">
          <button type="button" className="link" onClick={() => warning.reporter.event_id && onOpen(warning.reporter.event_id)}>
            <Avatar name={warning.reporter.person} size={24} /><strong>{warning.reporter.person}</strong> <span className="muted">{warning.reporter.task ?? "session"}</span>
          </button>
          <span className="arrow"><ArrowRight size={15} /></span>
          {source && (
            <button type="button" className="link" onClick={() => source.event_id && onOpen(source.event_id)}>
              <Avatar name={source.person} size={24} /><strong>{source.person}</strong> <span className="muted">{source.task ?? "session"}</span>
            </button>
          )}
        </div>
      )}
    </article>
  );
}
