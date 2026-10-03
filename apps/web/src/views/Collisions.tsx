import { api } from "../api";
import { Empty, ErrorState, Loading } from "../components/bits";
import { WarningItem } from "../components/WarningItem";
import { useLoad, useNow } from "../hooks";

export function Collisions({ workspace, onOpen }: { workspace: string; onOpen: (id: string) => void }) {
  const now = useNow();
  const res = useLoad(() => api.warnings(workspace), [workspace], 4000);
  const list = res.data?.warnings ?? [];
  return (
    <div className="view">
      <p className="lede">Warnings the server returned to agents while they worked. Each one was also shown to the developer.</p>
      {res.loading && !res.data && <Loading />}
      {res.error && !res.data && <ErrorState message={res.error} onRetry={res.reload} />}
      {res.data && list.length === 0 && <Empty title="No collisions or rediscoveries yet">When two people touch the same module, or someone hits a problem a teammate already solved, it shows up here.</Empty>}
      <div className="warnings">
        {list.map((w) => <WarningItem key={w.warning_id} warning={w} now={now} onOpen={onOpen} />)}
      </div>
    </div>
  );
}
