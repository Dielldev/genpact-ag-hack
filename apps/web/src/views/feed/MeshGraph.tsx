import type { PersonSummary } from "@mesh/server/api";
import { firstName, hueOf, initials } from "../../format";

export type Signal = "stuck" | "blocked" | "open";

interface Props {
  people: PersonSummary[];
  selected: string;
  signals: Record<string, Signal>;
  clashes: Set<string>;
  onSelect: (p: string) => void;
}

const W = 760;
const H = 250;
const MAX_NODES = 10;
const DOT: Record<Signal, string> = { stuck: "#e5484d", blocked: "#e8870b", open: "#1fa97a" };

export const pairKey = (a: string, b: string) => [a, b].sort().join("|");

function place(i: number, n: number): [number, number] {
  if (n === 1) return [W / 2, H / 2];
  const x = 60 + (i * (W - 120)) / (n - 1);
  const y = H / 2 + Math.sin(i * 2.1 + 0.7) * H * 0.27 - 8;
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
      const bend = Math.hypot(x2 - x1, y2 - y1) * 0.22 * ((i + edges.length) % 2 ? 1 : -1);
      const cx = (x1 + x2) / 2 + ((y2 - y1) / Math.hypot(x2 - x1, y2 - y1)) * bend;
      const cy = (y1 + y2) / 2 - ((x2 - x1) / Math.hypot(x2 - x1, y2 - y1)) * bend;
      edges.push({ a: p.person, b: q.person, d: `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`, weight: shared, clash });
    });
  });

  return (
    <svg className="graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Team connections by shared modules">
      <defs>
        <radialGradient id="floor" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#6c3ff0" stopOpacity="0.14" />
          <stop offset="1" stopColor="#6c3ff0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd86b" />
          <stop offset="1" stopColor="#f3a93a" />
        </linearGradient>
      </defs>
      <ellipse cx={W / 2} cy={H - 14} rx={W * 0.42} ry="12" fill="url(#floor)" />
      {edges.map((e) => {
        const hot = selected && (e.a === selected || e.b === selected);
        const dim = selected && !hot;
        return <path key={`${e.a}-${e.b}`} d={e.d} className={`graph-edge${hot ? " graph-edge-hot" : ""}${e.clash ? " graph-edge-clash" : ""}${dim ? " graph-edge-dim" : ""}`} style={{ strokeWidth: hot ? 2 : 1 + Math.min(e.weight, 3) * 0.35 }} />;
      })}
      {nodes.map((p) => {
        const [x, y] = pos.get(p.person)!;
        const on = p.person === selected;
        const h = hueOf(p.person);
        const sig = signals[p.person];
        return (
          <g key={p.person} transform={`translate(${x},${y})`} className={`graph-node${on ? " graph-node-on" : ""}${selected && !on ? " graph-node-dim" : ""}`} onClick={() => onSelect(on ? "" : p.person)} role="button" aria-label={`${p.person}, ${p.sessions} sessions`}>
            <title>{`${p.person} · ${p.sessions} sessions`}</title>
            {on && <circle className="graph-pulse" r="26" />}
            <g className="body">
              <circle r="24" fill={on ? "url(#gold)" : "#fff"} stroke={on ? "#fff" : `hsl(${h} 65% 62%)`} strokeWidth={on ? 3 : 2.5} strokeDasharray={p.status !== "active" ? "4 3" : undefined} style={{ filter: "drop-shadow(0 8px 12px rgba(108,63,240,0.22))" }} />
              <text y="5" textAnchor="middle" fontSize="13.5" fontWeight="600" fill={on ? "#5a3b00" : `hsl(${h} 55% 40%)`} pointerEvents="none">{initials(p.person)}</text>
              {sig && <circle cx="18" cy="-18" r="5.5" fill={DOT[sig]} stroke="#fff" strokeWidth="2" />}
            </g>
            <text className="graph-name" y={on ? 52 : 42}>{firstName(p.person)}</text>
          </g>
        );
      })}
    </svg>
  );
}
