import { useCallback, useEffect, useRef, useState } from "react";
import { PeriodId, ReportKind } from "../views/ask/intent";
import { localReport } from "../views/ask/localReport";
import { nextSlot, slotId, slotOf } from "./schedule";
import { loadState, MAX_REPORTS, RunTrigger, saveState, type AutoState } from "./store";

export interface Automations {
  state: AutoState;
  running: boolean;
  error: string | undefined;
  nextRun: Date;
  setEnabled: (enabled: boolean) => void;
  setDay: (day: number) => void;
  runNow: () => void;
}

export function useAutomations(workspace: string, now: number): Automations {
  const [held, setHeld] = useState(() => ({ workspace, state: loadState(workspace) }));
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const busy = useRef(false);
  const failedSlot = useRef("");
  const current = useRef(workspace);
  current.current = workspace;

  const state = held.workspace === workspace ? held.state : loadState(workspace);

  useEffect(() => {
    if (held.workspace !== workspace) setHeld({ workspace, state });
    setError(undefined);
  }, [workspace]);

  const update = (next: AutoState) => {
    saveState(workspace, next);
    setHeld({ workspace, state: next });
  };

  const generate = useCallback(
    async (trigger: RunTrigger, slotKey: string) => {
      if (busy.current) return;
      busy.current = true;
      setRunning(true);
      setError(undefined);
      const target = workspace;
      try {
        const answer = await localReport(target, { kind: ReportKind.sprint, period: PeriodId.week }, Date.now());
        const at = Date.now();
        const base = loadState(target);
        const next = { ...base, reports: [{ id: `${trigger}-${at}`, generatedAt: at, trigger, answer }, ...base.reports].slice(0, MAX_REPORTS) };
        saveState(target, next);
        if (current.current === target) setHeld({ workspace: target, state: next });
      } catch (err) {
        failedSlot.current = slotKey;
        setError((err as Error).message);
      } finally {
        busy.current = false;
        setRunning(false);
      }
    },
    [workspace],
  );

  const slot = slotOf(now, state.day);
  const slotKey = `${workspace}:${slotId(slot)}`;
  const due = workspace !== "" && state.enabled && !state.reports.some((r) => r.generatedAt >= slot.getTime());

  useEffect(() => {
    if (due && failedSlot.current !== slotKey) void generate(RunTrigger.scheduled, slotKey);
  }, [due, slotKey, running, generate]);

  return {
    state,
    running,
    error,
    nextRun: nextSlot(now, state.day),
    setEnabled: (enabled) => update({ ...state, enabled }),
    setDay: (day) => update({ ...state, day }),
    runNow: () => void generate(RunTrigger.manual, slotKey),
  };
}
