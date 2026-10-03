import type { ArtifactRef, ReportStatus } from "@mesh/contract";
import { FileText, FolderOpen, Handshake, Building2, LineChart, Shapes, Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { firstName, hueOf, initials, STATUS_LABEL, statusLine, toneOf } from "../format";
import { StatusIcon } from "./StatusIcon";

export function StatusChip({ status, since, lastSeen, now }: { status: ReportStatus | null; since: string | null; lastSeen: string; now: number }) {
  const tone = toneOf(status, since, now);
  const detail = statusLine(status, since, lastSeen, now).replace(/^(in progress|blocked|active|done)\s*/, "");
  return (
    <span className="status">
      <StatusIcon tone={tone} />
      {STATUS_LABEL[tone]}
      <span className="status-time">{detail}</span>
    </span>
  );
}

const KIND_ICON: Record<string, LucideIcon> = { file: FileText, doc: FolderOpen, deal: Handshake, client: Building2, model: LineChart };

export function ArtifactChips({ artifacts, max = 6 }: { artifacts: ArtifactRef[]; max?: number }) {
  if (artifacts.length === 0) return null;
  return (
    <div className="chips">
      {artifacts.slice(0, max).map((a) => {
        const Icon = KIND_ICON[a.kind] ?? Shapes;
        return (
          <span key={`${a.kind}:${a.ref}`} className="tag" title={`${a.kind}: ${a.ref}`}>
            <Icon size={12} />
            {a.label ?? a.ref}
          </span>
        );
      })}
      {artifacts.length > max && <span className="tag">+{artifacts.length - max}</span>}
    </div>
  );
}

export function ModuleChips({ modules, onPick }: { modules: string[]; onPick?: (m: string) => void }) {
  if (modules.length === 0) return null;
  return (
    <div className="chips">
      {modules.map((m) => (
        <button key={m} type="button" className={`tag tag-mono${onPick ? " tag-btn" : ""}`} onClick={onPick ? () => onPick(m) : undefined} disabled={!onPick}>
          {m}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const h = hueOf(name);
  return (
    <span className="avatar" title={firstName(name)} style={{ ["--s" as string]: `${size}px`, background: `hsl(${h} 30% 46%)` }} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="view" aria-label={`${label}…`} role="status">
      {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 56 }} />)}
    </div>
  );
}

export function Empty({ title, children, icon: Icon = Inbox }: { title: string; children?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="state">
      <span className="state-icon"><Icon size={20} /></span>
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
      {onRetry && <button type="button" className="btn" onClick={onRetry}>Try again</button>}
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

export function PageHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="page-head">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  );
}
