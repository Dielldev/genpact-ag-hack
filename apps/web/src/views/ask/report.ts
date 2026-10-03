import { WarningKind } from "@mesh/contract";
import type { WarningCard } from "@mesh/server/api";
import { KIND_TITLE, periodOf, type ReportSpec } from "./intent";
import type { Kpi, ReportData, ReportInputs, Row } from "./model";
import { narrativeOf } from "./narrative";
import { blockedMost, countTones, isTrouble, issuesOf, moduleStats, performers, rowsIn, timeline } from "./stats";

function warningsIn(warnings: WarningCard[], start: number, end: number, person?: string): WarningCard[] {
  return warnings.filter((w) => {
    const t = Date.parse(w.created_at);
    return t >= start && t <= end && (!person || w.people.includes(person));
  });
}

const peopleOf = (rows: Row[]): string[] => [...new Set(rows.map((r) => r.item.person))];

function kpisOf(rows: Row[], prev: Row[], collisions: number, prevCollisions: number, team: number): Kpi[] {
  const measure = (list: Row[], c: number) => ({
    sessions: list.length,
    done: list.filter((r) => r.tone === "done").length,
    progress: list.filter((r) => r.tone === "progress").length,
    blocked: list.filter((r) => isTrouble(r.tone)).length,
    collisions: c,
    people: peopleOf(list).length,
  });
  const now = measure(rows, collisions);
  const before = prev.length > 0 ? measure(prev, prevCollisions) : null;
  const make = (id: keyof typeof now, label: string, upIsGood: boolean): Kpi => ({ id, label, value: now[id], prev: before ? before[id] : null, upIsGood });
  const people = { ...make("people", "People active", true), of: team };
  return [
    make("sessions", "Sessions", true),
    make("done", "Completed", true),
    make("progress", "In progress", true),
    make("blocked", "Blocked", false),
    make("collisions", "Collisions", false),
    people,
  ];
}

export function buildReport(inputs: ReportInputs, spec: ReportSpec): ReportData {
  const def = periodOf(spec.period);
  const end = inputs.now;
  const start = end - def.ms;
  const prevStart = start - def.ms;
  const items = spec.person ? inputs.items.filter((i) => i.person === spec.person) : inputs.items;
  const rows = rowsIn(items, start, end, end);
  const prevRows = rowsIn(items, prevStart, start - 1, end);
  const warnings = warningsIn(inputs.warnings, start, end, spec.person);
  const prevWarnings = warningsIn(inputs.warnings, prevStart, start - 1, spec.person);
  const collisions = warnings.filter((w) => w.kind === WarningKind.collision);
  const prevCollisions = prevWarnings.filter((w) => w.kind === WarningKind.collision).length;
  const tones = countTones(rows);
  const perf = performers(rows);
  const blocked = blockedMost(rows, end);
  const issues = issuesOf(rows);
  const modules = moduleStats(rows);
  const active = peopleOf(rows);
  const narrative = narrativeOf({
    kind: spec.kind,
    period: spec.period,
    person: spec.person,
    total: rows.length,
    people: active.length,
    tones,
    performers: perf,
    blocked,
    issues,
    modules,
    collisions: collisions.length,
    rediscoveries: warnings.length - collisions.length,
  });
  return {
    spec,
    title: spec.person ? `${KIND_TITLE[spec.kind]} · ${spec.person}` : KIND_TITLE[spec.kind],
    periodLabel: def.long,
    now: end,
    start,
    rows,
    tones,
    kpis: kpisOf(rows, prevRows, collisions.length, prevCollisions, spec.person ? 0 : inputs.people.length),
    performers: perf,
    blocked,
    issues,
    warnings,
    modules,
    timeline: timeline(rows, start, end),
    narrative,
    peopleActive: active,
  };
}
