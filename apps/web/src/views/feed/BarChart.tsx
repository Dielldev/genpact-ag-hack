import { useState } from "react";
import { peak, type Series } from "./series";

export function BarChart({ data, unit }: { data: Series; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.counts);
  const on = hover ?? peak(data.counts);
  return (
    <div className="bars" onMouseLeave={() => setHover(null)}>
      {data.counts.map((c, i) => (
        <div key={i} className={`bar-col${i === on ? " bar-col-on" : ""}`} onMouseEnter={() => setHover(i)}>
          <div className="bar-track">
            <div className="bar-rect" style={{ height: `${Math.max(8, (c / max) * 100)}%` }}>
              {i === on && <span className="bar-tip">{c} {unit}{c === 1 ? "" : "s"}</span>}
            </div>
          </div>
          <span className="axis-label">{data.labels[i]}</span>
        </div>
      ))}
    </div>
  );
}
