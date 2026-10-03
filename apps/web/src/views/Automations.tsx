import { CalendarClock, FileClock, Loader2, Play } from "lucide-react";
import { useState } from "react";
import { RUN_HOUR, WEEKDAYS, whenLabel } from "../automations/schedule";
import type { Automations as AutomationsState } from "../automations/useAutomations";
import { Empty } from "../components/bits";
import { ReportCard } from "./automations/ReportCard";

interface Props {
  workspace: string;
  auto: AutomationsState;
  onOpen: (id: string) => void;
}

export function Automations({ workspace, auto, onOpen }: Props) {
  const { state, running, error, nextRun } = auto;
  const [picked, setPicked] = useState<string | null>(null);
  const openId = picked ?? state.reports[0]?.id ?? null;
  return (
    <div className="view auto">
      <section className="auto-card">
        <span className="auto-ico"><CalendarClock size={20} /></span>
        <div className="auto-main">
          <div className="auto-title">
            <h3>Weekly sprint report</h3>
            <button type="button" role="switch" aria-checked={state.enabled} aria-label="Weekly sprint report" className="switch" onClick={() => auto.setEnabled(!state.enabled)}>
              <span />
            </button>
          </div>
          <p className="muted">Status, top performers, blockers, modules and decisions for the last 7 days. Built on its own, nobody has to ask.</p>
          <div className="auto-meta">
            <label className="auto-when">
              Every
              <select value={state.day} onChange={(e) => auto.setDay(Number(e.target.value))} aria-label="Day of the week">
                {WEEKDAYS.map((name, i) => <option key={name} value={i}>{name}</option>)}
              </select>
              at {RUN_HOUR}:00 AM
            </label>
            <span className="faint small">{state.enabled ? `Next report ${whenLabel(nextRun)}` : "Paused"}</span>
            <button type="button" className="btn auto-run" onClick={auto.runNow} disabled={running}>
              {running ? <Loader2 size={14} className="auto-spin" /> : <Play size={14} />}
              {running ? "Building…" : "Run now"}
            </button>
          </div>
          {error && <p className="error-text small" role="alert">{error}</p>}
          <p className="faint small">Reports build while Mesh is open in a browser and catch up the next time you open it.</p>
        </div>
      </section>
      <h3 className="auto-sub">Reports<span className="count">{state.reports.length}</span></h3>
      {running && state.reports.length === 0 && <div className="skeleton" style={{ height: 56 }} />}
      {!running && state.reports.length === 0 && (
        <Empty icon={FileClock} title="No reports yet">
          {state.enabled ? "The first one builds as soon as the schedule is due." : "Turn the automation on, or press Run now."}
        </Empty>
      )}
      {state.reports.map((r) => (
        <ReportCard key={r.id} report={r} workspace={workspace} open={openId === r.id} onToggle={() => setPicked(openId === r.id ? "" : r.id)} onOpen={onOpen} />
      ))}
    </div>
  );
}
