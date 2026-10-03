import type { AskResponse } from "@mesh/server/api";
import { DEFAULT_DAY, isDay } from "./schedule";

export enum RunTrigger {
  scheduled = "scheduled",
  manual = "manual",
}

export interface AutoReport {
  id: string;
  generatedAt: number;
  trigger: RunTrigger;
  answer: AskResponse;
}

export interface AutoState {
  enabled: boolean;
  day: number;
  reports: AutoReport[];
}

export const MAX_REPORTS = 8;

const keyOf = (workspace: string) => `mesh.automations.${workspace}`;

const fresh = (): AutoState => ({ enabled: true, day: DEFAULT_DAY, reports: [] });

const isReport = (value: unknown): value is AutoReport => {
  const r = value as Partial<AutoReport> | null;
  return Boolean(r) && typeof r?.id === "string" && typeof r.generatedAt === "number" && typeof r.answer === "object" && r.answer !== null;
};

export function loadState(workspace: string): AutoState {
  try {
    const raw = localStorage.getItem(keyOf(workspace));
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as Partial<AutoState>;
    return {
      enabled: parsed.enabled !== false,
      day: isDay(parsed.day) ? parsed.day : DEFAULT_DAY,
      reports: Array.isArray(parsed.reports) ? parsed.reports.filter(isReport).slice(0, MAX_REPORTS) : [],
    };
  } catch {
    return fresh();
  }
}

export function saveState(workspace: string, state: AutoState): void {
  const write = (value: AutoState) => localStorage.setItem(keyOf(workspace), JSON.stringify(value));
  try {
    write(state);
  } catch {
    try {
      write({ ...state, reports: state.reports.slice(0, 1) });
    } catch {
      return;
    }
  }
}
