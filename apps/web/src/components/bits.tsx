import type { ArtifactRef, ReportStatus } from "@mesh/contract";
import type { ReactNode } from "react";
import { initials, STATUS_LABEL, statusLine, toneOf } from "../format";

export function StatusChip({ status, since, lastSeen, now }: { status: ReportStatus | null; since: string | null; lastSeen: string; now: number }) {
  const tone = toneOf(status, since, now);
  return (
    <span className={`status status-${tone}`}>
      <span className="dot" />
      <strong>{STATUS_LABEL[tone]}</strong>
      <span className="status-time">{statusLine(status, since, lastSeen, now).replace(/^(in progress|blocked|active|done)\s*/, "")}</span>
    </span>
  );
}

const KIND_ICON: Record<string, string> = { file: "📄", doc: "📝", deal: "🤝", client: "🏢", model: "📊" };

export function ArtifactChips({ artifacts, max = 6 }: { artifacts: ArtifactRef[]; max?: number }) {
  if (artifacts.length === 0) return null;
  return (
    <div className="chips">
      {artifacts.slice(0, max).map((a) => (
        <span key={`${a.kind}:${a.ref}`} className="chip chip-artifact" title={`${a.kind}: ${a.ref}`}>
          <span className="chip-kind">{KIND_ICON[a.kind] ?? "◆"} {a.kind}</span>
          {a.label ?? a.ref}
        </span>
      ))}
      {artifacts.length > max && <span className="chip chip-more">+{artifacts.length - max}</span>}
    </div>
  );
}

export function ModuleChips({ modules, onPick }: { modules: string[]; onPick?: (m: string) => void }) {
  if (modules.length === 0) return null;
  return (
    <div className="chips">
      {modules.map((m) => (
        <button key={m} type="button" className="chip chip-module" onClick={onPick ? () => onPick(m) : undefined} disabled={!onPick}>
          {m}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span className="avatar" style={{ background: `hsl(${hash} 45% 38%)` }} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return <div className="state state-loading">{label}…</div>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state state-empty">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state state-error">
      <strong>Could not load this view</strong>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="section">
      <h3>
        {title}
        {count !== undefined && <span className="count">{count}</span>}
      </h3>
      {children}
    </section>
  );
}
