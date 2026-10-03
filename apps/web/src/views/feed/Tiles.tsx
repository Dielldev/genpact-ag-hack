import { CheckCircle2, Flame, GitCompareArrows, Layers, OctagonAlert, Zap, type LucideIcon } from "lucide-react";
import type { TileId } from "./filters";

const TILES: Array<{ id: TileId; label: string; icon: LucideIcon; tone?: "alert" | "warm" }> = [
  { id: "all", label: "All", icon: Layers },
  { id: "progress", label: "In progress", icon: Zap },
  { id: "blocked", label: "Blocked", icon: OctagonAlert, tone: "warm" },
  { id: "stuck", label: "Stuck", icon: Flame, tone: "alert" },
  { id: "done", label: "Done", icon: CheckCircle2 },
  { id: "collisions", label: "Collisions", icon: GitCompareArrows, tone: "alert" },
];

export function Tiles({ active, counts, onPick }: { active: TileId; counts: Record<TileId, number>; onPick: (id: TileId) => void }) {
  return (
    <div className="tiles" role="tablist" aria-label="Filter sessions">
      {TILES.map((t) => {
        const n = counts[t.id];
        const hot = t.tone && n > 0 ? ` tile-${t.tone}` : "";
        return (
          <button key={t.id} type="button" role="tab" aria-selected={active === t.id} className={`tile${active === t.id ? " tile-on" : ""}${hot}`} onClick={() => onPick(active === t.id ? "all" : t.id)}>
            <t.icon size={28} strokeWidth={1.7} />
            {t.label}
            <span className="tile-count">{n}</span>
          </button>
        );
      })}
    </div>
  );
}
