import type { Tone } from "../../../format";

export interface Segment {
  tone: Tone;
  label: string;
  count: number;
}

const COLOR: Record<Tone, string> = {
  done: "var(--st-done)",
  progress: "var(--st-progress)",
  blocked: "var(--st-blocked)",
  stuck: "var(--st-stuck)",
  active: "var(--ink-3)",
};

export function MiniBar({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((n, s) => n + s.count, 0);
  return (
    <div className="rep-bar" role="img" aria-label={segments.filter((s) => s.count > 0).map((s) => `${s.label} ${s.count}`).join(", ")}>
      {segments.filter((s) => s.count > 0).map((s) => (
        <span key={s.tone + s.label} style={{ flexGrow: s.count / (total || 1), background: COLOR[s.tone] }} title={`${s.label}: ${s.count}`} />
      ))}
    </div>
  );
}

export function Legend({ segments }: { segments: Segment[] }) {
  const shown = segments.filter((s) => s.count > 0);
  if (shown.length === 0) return null;
  return (
    <ul className="rep-legend">
      {shown.map((s) => (
        <li key={s.tone + s.label}>
          <i style={{ background: COLOR[s.tone] }} />
          {s.label}
          <b>{s.count}</b>
        </li>
      ))}
    </ul>
  );
}
