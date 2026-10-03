import type { FeedItem, PersonSummary, WarningCard } from "@mesh/server/api";
import type { Tone } from "../../format";
import type { ReportSpec } from "./intent";

export interface ReportInputs {
  items: FeedItem[];
  warnings: WarningCard[];
  people: PersonSummary[];
  now: number;
}

export interface Row {
  item: FeedItem;
  tone: Tone;
}

export type ToneCounts = Record<Tone, number>;

export interface Kpi {
  id: string;
  label: string;
  value: number;
  prev: number | null;
  upIsGood: boolean;
  of?: number;
}

export interface Performer {
  person: string;
  done: number;
  progress: number;
  blocked: number;
  reports: number;
}

export interface BlockedPerson {
  person: string;
  count: number;
  minutes: number;
  blockers: string[];
  openId: string;
}

export interface Issue {
  text: string;
  count: number;
  people: string[];
  openId: string;
}

export interface ModuleStat {
  module: string;
  sessions: number;
  people: string[];
}

export interface Bucket {
  start: number;
  count: number;
  label: string;
}

export interface ReportData {
  spec: ReportSpec;
  title: string;
  periodLabel: string;
  now: number;
  start: number;
  rows: Row[];
  tones: ToneCounts;
  kpis: Kpi[];
  performers: Performer[];
  blocked: BlockedPerson[];
  issues: Issue[];
  warnings: WarningCard[];
  modules: ModuleStat[];
  timeline: Bucket[];
  narrative: string;
  peopleActive: string[];
}

export const openIdOf = (item: Pick<FeedItem, "event_id" | "session_pk">): string => item.event_id ?? String(item.session_pk);
