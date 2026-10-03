import type { KpisBlock, StatusBlock } from "@mesh/server/api";
import { StatusIcon } from "../../../components/StatusIcon";
import type { Tone } from "../../../format";
import { Block } from "./Block";

const COLOR: Record<Tone, string> = {
  done: "var(--st-done)",
  progress: "var(--st-progress)",
  blocked: "var(--st-blocked)",
  stuck: "var(--st-stuck)",
  active: "var(--st-active)",
};

export interface Segment {
  tone: Tone;
  label: string;
  count: number;
}

export function KpisView({ block }: { block: KpisBlock }) {
  const cols = Math.min(6, Math.max(1, block.items.length));
  const strip = (
    <div className="rep-kpis" role="list" style={{ ["--cols" as string]: cols }}>
      {block.items.map((k) => (
        <div key={k.label} className="rep-kpi" role="listitem">
          <span className="rep-kpi-label">
            {k.tone && <StatusIcon tone={k.tone} size={12} />}
            {k.label}
          </span>
          <span className="rep-kpi-value">{k.value}</span>
          <span className="rep-delta">{k.hint ?? ""}</span>
        </div>
      ))}
    </div>
  );
  return block.title ? <Block title={block.title}>{strip}</Block> : strip;
}

export function MiniBar({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((n, s) => n + s.count, 0);
  return (
    <div className="rep-bar" role="img" aria-label={segments.map((s) => `${s.label} ${s.count}`).join(", ")}>
      {segments.filter((s) => s.count > 0).map((s) => (
        <span key={s.tone + s.label} style={{ flexGrow: s.count / (total || 1), background: COLOR[s.tone] }} title={`${s.label}: ${s.count}`} />
      ))}
    </div>
  );
}

export function StatusView({ block }: { block: StatusBlock }) {
  const total = block.segments.reduce((n, s) => n + s.count, 0);
  return (
    <Block title={block.title} count={total}>
      <MiniBar segments={block.segments} />
      <ul className="rep-legend">
        {block.segments.map((s) => (
          <li key={s.tone + s.label} className={s.count === 0 ? "is-zero" : undefined}>
            <i style={{ background: COLOR[s.tone] }} />
            {s.label}
            <b>{s.count}</b>
            <span>{total > 0 ? `${Math.round((s.count / total) * 100)}%` : "0%"}</span>
          </li>
        ))}
      </ul>
    </Block>
  );
}
