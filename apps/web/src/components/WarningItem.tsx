import type { WarningCard } from "@mesh/server/api";
import { ago } from "../format";

export function WarningItem({ warning, now, onOpen, compact }: { warning: WarningCard; now: number; onOpen: (id: string) => void; compact?: boolean }) {
  const source = warning.sources[0];
  return (
    <article className={`warning warning-${warning.kind}${compact ? " warning-compact" : ""}`}>
      <header>
        <span className={`badge badge-${warning.kind}`}>{warning.kind === "collision" ? "Collision" : "Rediscovery"}</span>
        <span className="muted">{ago(warning.created_at, now)}</span>
      </header>
      <p className="warning-message">{warning.message}</p>
      {!compact && (
        <div className="warning-people">
          <button type="button" className="link" onClick={() => warning.reporter.event_id && onOpen(warning.reporter.event_id)}>
            <strong>{warning.reporter.person}</strong> · {warning.reporter.task ?? "session"}
          </button>
          <span className="arrow">{warning.kind === "collision" ? "⇄" : "←"}</span>
          {source && (
            <button type="button" className="link" onClick={() => source.event_id && onOpen(source.event_id)}>
              <strong>{source.person}</strong> · {source.task ?? "session"}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
