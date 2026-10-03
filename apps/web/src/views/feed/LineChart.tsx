import { useState } from "react";
import { peak, smooth, SLOTS, type Series } from "./series";

const W = 300;
const H = 104;
const PAD = 14;

export function LineChart({ data, unit }: { data: Series; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.counts);
  const on = hover ?? peak(data.counts);
  const pts = data.counts.map((c, i): [number, number] => [((i + 0.5) / SLOTS) * W, PAD + (1 - c / max) * (H - PAD * 2)]);
  const line = smooth(pts);
  const area = `${line} L${pts[pts.length - 1]?.[0]},${H} L${pts[0]?.[0]},${H} Z`;
  const [x, y] = pts[on] ?? [0, 0];
  const count = data.counts[on] ?? 0;
  return (
    <>
      <div className="line-wrap" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="warn-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e5365a" stopOpacity="0.22" />
              <stop offset="1" stopColor="#e5365a" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line className="grid-line" x1="0" x2={W} y1={H - 1} y2={H - 1} />
          <path d={area} fill="url(#warn-fill)" />
          <path className="line-path" d={line} />
        </svg>
        <span className="line-dot" style={{ left: `${(x / W) * 100}%`, top: y }} />
        <span className="line-tip" style={{ left: `${(x / W) * 100}%`, top: y - 12 }}>
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
