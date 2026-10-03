import { useState } from "react";
import { peak, smooth, SLOTS, type Series } from "./series";

const W = 300;
const H = 72;
const PAD = 8;

export function LineChart({ data, unit }: { data: Series; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.counts);
  const on = hover ?? peak(data.counts);
  const pts = data.counts.map((c, i): [number, number] => [((i + 0.5) / SLOTS) * W, PAD + (1 - c / max) * (H - PAD * 2)]);
  const [x, y] = pts[on] ?? [0, 0];
  const count = data.counts[on] ?? 0;
  return (
    <>
      <div className="line-wrap" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
          <line className="grid-line" x1="0" x2={W} y1={H - 1} y2={H - 1} />
          <path className="line-path" d={smooth(pts)} />
        </svg>
        <span className="line-dot" style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }} />
        <span className="line-tip" style={{ left: `clamp(56px, ${(x / W) * 100}%, calc(100% - 56px))`, top: `calc(${(y / H) * 100}% - 10px)` }}>
          {count} {unit}{count === 1 ? "" : "s"}
          <small>{data.labels[on]}</small>
        </span>
        <div className="line-hits">
          {data.counts.map((_, i) => <div key={i} onMouseEnter={() => setHover(i)} />)}
        </div>
      </div>
      <div className="line-axis">{data.labels.map((l, i) => <span key={i}>{l}</span>)}</div>
    </>
  );
}
