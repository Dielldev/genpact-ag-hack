import { useCallback, useEffect, useRef, useState } from "react";
import type { AskResponse } from "@mesh/server/api";
import { api } from "../../api";
import { explicitPeriod, PERIOD_PHRASE, PeriodId, personIn, reportKindOf } from "./intent";
import { localReport } from "./localReport";

export interface Turn {
  id: number;
  question: string;
  answer?: AskResponse;
  error?: string;
  at: number;
}

export function useThread(workspace: string, period: PeriodId, chosen: boolean, people: string[]) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const nextId = useRef(1);

  useEffect(() => setTurns([]), [workspace]);

  const patch = (id: number, change: Partial<Turn>) => setTurns((t) => t.map((x) => (x.id === id ? { ...x, ...change } : x)));

  const submit = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      const id = nextId.current++;
      const started = Date.now();
      setTurns((t) => [...t, { id, question: q, at: started }]);
      try {
        const sent = chosen && !explicitPeriod(q.toLowerCase()) ? `For ${PERIOD_PHRASE[period]}: ${q}` : q;
        let answer = await api.ask(workspace, sent);
        const spec = reportKindOf(q, period);
        if (!answer.blocks?.length && spec) {
          const local = await localReport(workspace, { ...spec, person: personIn(q, people) }, started);
          answer = { ...local, degraded: answer.degraded };
        }
        patch(id, { answer });
      } catch (err) {
        patch(id, { error: (err as Error).message });
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [workspace, period, chosen, people.join()],
  );

  return { turns, busy, submit };
}
