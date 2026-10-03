import { GitCompareArrows, Layers, type LucideIcon } from "lucide-react";
import { StatusIcon } from "../../components/StatusIcon";
import type { Tone } from "../../format";
import type { TabId } from "./filters";

interface TabDef {
  id: TabId;
  label: string;
  tone?: Tone;
  icon?: LucideIcon;
}

const TABS: TabDef[] = [
  { id: "all", label: "All", icon: Layers },
  { id: "progress", label: "In progress", tone: "progress" },
  { id: "blocked", label: "Blocked", tone: "blocked" },
  { id: "stuck", label: "Stuck", tone: "stuck" },
  { id: "done", label: "Done", tone: "done" },
  { id: "collisions", label: "Collisions", icon: GitCompareArrows },
];

interface Props {
  active: TabId;
  counts: Record<TabId, number>;
  onPick: (id: TabId) => void;
}

export function Tabs({ active, counts, onPick }: Props) {
  return (
    <div className="vtabs" role="tablist" aria-label="Filter sessions">
      {TABS.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={active === t.id} className={`vtab${active === t.id ? " vtab-on" : ""}`} onClick={() => onPick(active === t.id ? "all" : t.id)}>
          {t.tone ? <StatusIcon tone={t.tone} size={14} /> : t.icon && <t.icon size={14} strokeWidth={1.8} />}
          {t.label}
          <span className="vtab-n">{counts[t.id]}</span>
        </button>
      ))}
    </div>
  );
}
