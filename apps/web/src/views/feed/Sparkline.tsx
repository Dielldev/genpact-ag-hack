const W = 56;
const H = 18;

export function Sparkline({ counts }: { counts: number[] }) {
  if (counts.length < 2) return null;
  const max = Math.max(1, ...counts);
  const step = W / (counts.length - 1);
  const pts = counts.map((c, i): [number, number] => [i * step, H - 2 - (c / max) * (H - 4)]);
  const last = pts[pts.length - 1]!;
  return (
    <svg className="spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <polyline className="spark-line" points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} />
      <circle className="spark-dot" cx={last[0]} cy={last[1]} r="2" />
    </svg>
  );
}
