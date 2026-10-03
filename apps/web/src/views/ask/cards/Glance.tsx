import { Legend, MiniBar } from "../blocks/Overview";
import type { Glance } from "./compose";
import { Card } from "./Parts";

export function GlanceCard({ glance }: { glance: Glance }) {
  if (glance.stats.length === 0 && glance.segments.length === 0) return null;
  return (
    <Card title="At a glance">
      <div className="ask-stats">
        {glance.stats.map((s) => (
          <div key={s.key} className={`ask-stat${s.tone ? ` is-${s.tone}` : ""}`}>
            <b>{s.value}</b>
            <span>{s.label}</span>
            {s.note && <em>{s.note}</em>}
          </div>
        ))}
      </div>
      {glance.segments.some((s) => s.count > 0) && (
        <div className="ask-progress">
          <MiniBar segments={glance.segments} />
          <Legend segments={glance.segments} />
        </div>
      )}
    </Card>
  );
}
