export enum ReportKind {
  sprint = "sprint",
  standup = "standup",
  blockers = "blockers",
  contributors = "contributors",
  retro = "retro",
  summary = "summary",
}

export enum PeriodId {
  today = "today",
  week = "week",
  twoWeeks = "two_weeks",
  month = "month",
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export interface PeriodDef {
  id: PeriodId;
  label: string;
  long: string;
  ms: number;
}

export const PERIODS: PeriodDef[] = [
  { id: PeriodId.today, label: "Today", long: "Last 24 hours", ms: DAY },
  { id: PeriodId.week, label: "This week", long: "Last 7 days", ms: 7 * DAY },
  { id: PeriodId.twoWeeks, label: "Last 2 weeks", long: "Last 14 days", ms: 14 * DAY },
  { id: PeriodId.month, label: "Last 30 days", long: "Last 30 days", ms: 30 * DAY },
];

export function periodOf(id: PeriodId): PeriodDef {
  return PERIODS.find((p) => p.id === id) ?? PERIODS[1]!;
}

export const KIND_TITLE: Record<ReportKind, string> = {
  [ReportKind.sprint]: "Sprint report",
  [ReportKind.standup]: "Daily standup",
  [ReportKind.blockers]: "Blockers report",
  [ReportKind.contributors]: "Top contributors",
  [ReportKind.retro]: "Dead ends and decisions",
  [ReportKind.summary]: "Activity summary",
};

export const PERIOD_PHRASE: Record<PeriodId, string> = {
  [PeriodId.today]: "today (the last 24 hours)",
  [PeriodId.week]: "this week (the last 7 days)",
  [PeriodId.twoWeeks]: "the last 2 weeks",
  [PeriodId.month]: "the last 30 days",
};

export interface ReportSpec {
  kind: ReportKind;
  period: PeriodId;
  person?: string;
}

const BLOCKERS = /\bblocked the most\b|\bmost blocked\b|\bblockers?\b|\bwho(?:'s| is| are| got| was| were)? blocked\b|\bmain issues?\b|\bbiggest (?:issues?|problems?)\b|\bwhat(?:'s| is) blocking\b/;
const CONTRIBUTORS = /\btop (?:performers?|contributors?|developers?)\b|\bbest performers?\b|\bleaderboard\b|\bmost productive\b|\bwho (?:shipped|completed|finished) the most\b/;
const RETRO = /\bdead[- ]ends?\b|\bretro(?:spective)?\b/;
const STANDUP = /\bstand-?up\b|\bdaily\b|\btoday\b|\bthis morning\b|\bworked on (?:today|yesterday)\b/;
const SPRINT = /\bsprint\b|\bthis week\b|\bweekly\b|\blast (?:week|2 weeks|two weeks)\b|\bpast week\b|\bfortnight\b/;
const SUMMARY = /\bwhat happened\b|\bsummary\b|\bsummari[sz]e\b|\breport\b|\boverview\b|\brecap\b|\bstatus update\b|\bhow (?:is|are) (?:we|the team) doing\b/;
const QUESTION_GUARD = /\bwhy\b|\bbefore\b|\bhow come\b|\bhow does\b|\bhow did\b/;

const TWO_WEEKS = /\blast (?:2|two) weeks\b|\bfortnight\b|\b14 days\b|\btwo weeks\b|\b2 weeks\b/;
const MONTH = /\b30 days\b|\bthis month\b|\blast month\b|\bmonthly\b|\ba month\b/;
const WEEK = /\bthis week\b|\blast week\b|\bpast week\b|\bweekly\b|\bsprint\b|\b7 days\b|\bweek\b/;
const TODAY = /\btoday\b|\bstand-?up\b|\bdaily\b|\bthis morning\b|\b24 hours\b|\blast day\b|\byesterday\b/;

function kindOf(text: string): ReportKind | null {
  if (BLOCKERS.test(text)) return ReportKind.blockers;
  if (CONTRIBUTORS.test(text)) return ReportKind.contributors;
  if (RETRO.test(text)) return ReportKind.retro;
  if (STANDUP.test(text)) return ReportKind.standup;
  if (SPRINT.test(text)) return ReportKind.sprint;
  if (SUMMARY.test(text)) return ReportKind.summary;
  return null;
}

export function explicitPeriod(text: string): PeriodId | null {
  if (TWO_WEEKS.test(text)) return PeriodId.twoWeeks;
  if (MONTH.test(text)) return PeriodId.month;
  if (WEEK.test(text)) return PeriodId.week;
  if (TODAY.test(text)) return PeriodId.today;
  return null;
}

export function reportKindOf(question: string, defaultPeriod: PeriodId): ReportSpec | null {
  const text = question.toLowerCase();
  const kind = kindOf(text);
  if (!kind) return null;
  if (QUESTION_GUARD.test(text) && (kind === ReportKind.standup || kind === ReportKind.summary)) return null;
  const period = explicitPeriod(text) ?? (kind === ReportKind.standup ? PeriodId.today : kind === ReportKind.sprint ? PeriodId.week : defaultPeriod);
  return { kind, period };
}

const escapeRe = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function personIn(question: string, people: string[]): string | undefined {
  const text = question.toLowerCase();
  const full = people.find((p) => text.includes(p.toLowerCase()));
  if (full) return full;
  const firsts = people.filter((p) => new RegExp(`\\b${escapeRe(p.split(/\s+/)[0]!.toLowerCase())}\\b`).test(text));
  return firsts.length === 1 ? firsts[0] : undefined;
}
