import { PersonStatus } from "@mesh/contract";
import type { PersonSummary } from "@mesh/server/api";
import { firstName, initials } from "../../format";

export type Signal = "stuck" | "blocked" | "open";

interface Props {
  people: PersonSummary[];
  selected: string;
  signals: Record<string, Signal>;
  clashes: Set<string>;
  onSelect: (p: string) => void;
}

const W = 1000;
const H = 160;
const R = 17;
const MAX_NODES = 10;

export const pairKey = (a: string, b: string) => [a, b].sort().join("|");

function place(i: number, n: number): [number, number] {
  if (n === 1) return [W / 2, H / 2 - 8];
  const x = 70 + (i * (W - 140)) / (n - 1);
  const y = H / 2 + Math.sin(i * 2.1 + 0.7) * H * 0.2 - 10;
  return [x, y];
}

export function MeshGraph({ people, selected, signals, clashes, onSelect }: Props) {
  const ranked = [...people].sort((a, b) => b.sessions - a.sessions).slice(0, MAX_NODES);
  const chosen = people.find((p) => p.person === selected);
  if (chosen && !ranked.includes(chosen)) ranked[ranked.length - 1] = chosen;
  const nodes = [...ranked].sort((a, b) => a.person.localeCompare(b.person));
  const pos = new Map(nodes.map((p, i) => [p.person, place(i, nodes.length)] as const));

  const edges: Array<{ a: string; b: string; d: string; weight: number; clash: boolean }> = [];
  nodes.forEach((p, i) => {
    nodes.slice(i + 1).forEach((q) => {
      const shared = p.modules.filter((m) => q.modules.includes(m)).length;
      const clash = clashes.has(pairKey(p.person, q.person));
      if (shared === 0 && !clash) return;
      const [x1, y1] = pos.get(p.person)!;
      const [x2, y2] = pos.get(q.person)!;
      const len = Math.hypot(x2 - x1, y2 - y1);
      const bend = len * 0.18 * ((i + edges.length) % 2 ? 1 : -1);
      const cx = (x1 + x2) / 2 + ((y2 - y1) / len) * bend;
      const cy = (y1 + y2) / 2 - ((x2 - x1) / len) * bend;
      edges.push({ a: p.person, b: q.person, d: `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`, weight: shared, clash });
    });
  });

  return (
    <svg className="graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Team connections by shared modules">
      {edges.map((e) => {
        const hot = selected && (e.a === selected || e.b === selected);
        const dim = selected && !hot;
        return <path key={`${e.a}-${e.b}`} d={e.d} className={`graph-edge${hot ? " graph-edge-hot" : ""}${e.clash ? " graph-edge-clash" : ""}${dim ? " graph-edge-dim" : ""}`} style={{ strokeWidth: hot ? 1.6 : 1 + Math.min(e.weight, 3) * 0.25 }} />;
      })}
      {nodes.map((p) => {
        const [x, y] = pos.get(p.person)!;
        const on = p.person === selected;
        const sig = signals[p.person];
        return (
          <g key={p.person} transform={`translate(${x},${y})`} className={`graph-node${on ? " graph-node-on" : ""}${selected && !on ? " graph-node-dim" : ""}`} onClick={() => onSelect(on ? "" : p.person)} role="button" aria-label={`${p.person}, ${p.sessions} sessions`}>
            <title>{`${p.person} · ${p.sessions} sessions`}</title>
            {on && <circle className="graph-halo" r={R + 4} />}
            <circle className="graph-ring" r={R} strokeDasharray={p.status !== PersonStatus.active ? "3 3" : undefined} />
            <text className="graph-initials" y="4">{initials(p.person)}</text>
            {sig && <circle className={`graph-dot graph-dot-${sig}`} cx={R - 4} cy={-R + 4} r="4.5" />}
            <text className="graph-name" y={R + 15}>{firstName(p.person)}</text>
          </g>
        );
      })}
    </svg>
  );
}
