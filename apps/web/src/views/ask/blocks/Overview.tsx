import type { KpisBlock, StatusBlock } from "@mesh/server/api";
import { Check, Clock, GitCompareArrows, Layers, OctagonAlert, Sparkles, Users, type LucideIcon } from "lucide-react";
import type { Tone } from "../../../format";
import { Block } from "./Block";

const COLOR: Record<Tone, string> = {
  done: "#1fa97a",
  progress: "var(--brand)",
  blocked: "var(--amber)",
  stuck: "var(--red)",
  active: "#a09fb4",
};

interface Look {
  icon: LucideIcon;
  tint: string;
}

const BY_LABEL: Record<string, Look> = {
  sessions: { icon: Layers, tint: "brand" },
  completed: { icon: Check, tint: "green" },
  "in progress": { icon: Clock, tint: "brand" },
  blocked: { icon: OctagonAlert, tint: "amber" },
  collisions: { icon: GitCompareArrows, tint: "pink" },
  "people active": { icon: Users, tint: "grey" },
};

const BY_TONE: Record<Tone, Look> = {
  done: { icon: Check, tint: "green" },
  progress: { icon: Clock, tint: "brand" },
  blocked: { icon: OctagonAlert, tint: "amber" },
  stuck: { icon: OctagonAlert, tint: "pink" },
  active: { icon: Sparkles, tint: "grey" },
};

const lookOf = (label: string, tone: Tone | undefined): Look => BY_LABEL[label.toLowerCase()] ?? (tone ? BY_TONE[tone] : { icon: Sparkles, tint: "brand" });

export interface Segment {
  tone: Tone;
  label: string;
  count: number;
}

export function KpisView({ block }: { block: KpisBlock }) {
  const cols = Math.min(6, Math.max(1, block.items.length));
  const strip = (
    <div className="rep-kpis" role="list" style={{ ["--cols" as string]: cols }}>
      {block.items.map((k) => {
        const look = lookOf(k.label, k.tone);
        return (
          <div key={k.label} className="rep-kpi" role="listitem">
            <span className={`rep-kpi-ico rep-tint-${look.tint}`}><look.icon size={16} /></span>
            <span className="rep-kpi-value">{k.value}</span>
            <span className="rep-kpi-label">{k.label}</span>
            <span className="rep-delta">{k.hint ?? ""}</span>
          </div>
        );
      })}
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
