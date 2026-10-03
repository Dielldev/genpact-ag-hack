import { WarningKind } from "@mesh/contract";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { Dashboard } from "../dashboard";
import { Empty, ErrorState, Loading } from "../components/bits";
import { WarningItem } from "../components/WarningItem";
import { useNow } from "../hooks";

type Tab = "all" | WarningKind;

export function Collisions({ data, onOpen }: { data: Dashboard; onOpen: (id: string) => void }) {
  const now = useNow();
  const [tab, setTab] = useState<Tab>("all");
  const res = data.warnings;
  const list = res.data?.warnings ?? [];
  const shown = tab === "all" ? list : list.filter((w) => w.kind === tab);
  const count = (k: Tab) => (k === "all" ? list.length : list.filter((w) => w.kind === k).length);
  const tabs: Array<[Tab, string]> = [["all", "All"], [WarningKind.collision, "Collisions"], [WarningKind.rediscovery, "Rediscoveries"]];
  return (
    <div className="view">
      <div className="seg" role="group" aria-label="Kind">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>{label}<span className="count">{count(id)}</span></button>
        ))}
      </div>
      {res.loading && !res.data && <Loading />}
      {res.error && !res.data && <ErrorState message={res.error} onRetry={res.reload} />}
      {res.data && shown.length === 0 && (
        <Empty icon={ShieldCheck} title="No collisions or rediscoveries yet">When two people touch the same module, or someone hits a problem a teammate already solved, it shows up here.</Empty>
      )}
      <div className="warnings">
        {shown.map((w) => <WarningItem key={w.warning_id} warning={w} now={now} onOpen={onOpen} />)}
      </div>
    </div>
  );
}
