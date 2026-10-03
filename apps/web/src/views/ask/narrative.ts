import { duration, plural } from "../../format";
import { PeriodId, ReportKind } from "./intent";
import type { BlockedPerson, Issue, ModuleStat, Performer, ToneCounts } from "./model";

export function names(list: string[]): string {
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

const WHEN: Record<PeriodId, string> = {
  [PeriodId.today]: "In the last 24 hours",
  [PeriodId.week]: "This week",
  [PeriodId.twoWeeks]: "Over the last two weeks",
  [PeriodId.month]: "Over the last 30 days",
};

export interface Facts {
  kind: ReportKind;
  period: PeriodId;
  person?: string;
  total: number;
  people: number;
  tones: ToneCounts;
  performers: Performer[];
  blocked: BlockedPerson[];
  issues: Issue[];
  modules: ModuleStat[];
  collisions: number;
  rediscoveries: number;
}

function opening(f: Facts): string {
  const trouble = f.tones.blocked + f.tones.stuck;
  const parts = [`${f.tones.done} completed`, `${f.tones.progress} still in progress`];
  if (trouble > 0) parts.push(`${trouble} blocked`);
  if (f.tones.active > 0) parts.push(`${f.tones.active} idle`);
  const who = f.person ? `${f.person} had ${plural(f.total, "session")}` : `${plural(f.total, "session")} ran across ${f.people === 1 ? "1 person" : `${f.people} people`}`;
  return `${WHEN[f.period]} ${who}: ${parts.join(", ")}.`;
}

function leaders(f: Facts): string | null {
  const best = f.performers.filter((p) => p.done > 0);
  const top = best[0];
  if (!top || f.person) return null;
  const tied = best.filter((p) => p.done === top.done).slice(0, 3).map((p) => p.person);
  const verb = tied.length > 1 ? "led" : "leads";
  return `${names(tied)} ${verb} delivery with ${top.done} completed ${top.done === 1 ? "session" : "sessions"}${tied.length > 1 ? " each" : ""}.`;
}

function blockers(f: Facts): string | null {
  if (f.blocked.length === 0) return null;
  const longest = [...f.blocked].sort((a, b) => b.minutes - a.minutes).slice(0, 2);
  const top = longest[0]!;
  const who = names(longest.map((b) => b.person));
  const lead = `${who} ${longest.length > 1 ? "have" : "has"} been blocked longest, up to ${duration(top.minutes)}`;
  const issue = f.issues[0];
  return issue && issue.count > 1 ? `${lead}; the most common issue touches ${plural(issue.count, "session")}: ${issue.text}.` : `${lead}.`;
}

function ground(f: Facts): string | null {
  const mods = f.modules.slice(0, 3).map((m) => m.module);
  const bits: string[] = [];
  if (mods.length > 0) bits.push(`Most work touched ${names(mods)}`);
  if (f.collisions > 0) bits.push(`${plural(f.collisions, "collision")} flagged between agents`);
  if (f.rediscoveries > 0) bits.push(`${plural(f.rediscoveries, "dead end")} re-discovered`);
  return bits.length > 0 ? `${bits.join("; ")}.` : null;
}

export function narrativeOf(f: Facts): string {
  const order: Array<string | null> =
    f.kind === ReportKind.blockers
      ? [opening(f), blockers(f), ground(f), leaders(f)]
      : f.kind === ReportKind.contributors
        ? [opening(f), leaders(f), ground(f), blockers(f)]
        : [opening(f), leaders(f), blockers(f), ground(f)];
  return order.filter((s): s is string => Boolean(s)).slice(0, 4).join(" ");
}
