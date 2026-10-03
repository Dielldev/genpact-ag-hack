import type { PersonStatus } from "@mesh/contract";

export type StatusTone = "done" | "progress" | "blocked" | "stuck" | "active";

export interface KpiItem {
  label: string;
  value: number | string;
  hint?: string;
  tone?: StatusTone;
}

export interface KpisBlock {
  type: "kpis";
  title?: string;
  items: KpiItem[];
}

export interface StatusBlock {
  type: "status";
  title: string;
  segments: Array<{ tone: StatusTone; label: string; count: number }>;
}

export interface LeaderboardBlock {
  type: "leaderboard";
  title: string;
  unit: string;
  rows: Array<{ person: string; value: number; detail?: string; event_id?: string | null }>;
}

export interface BlockersBlock {
  type: "blockers";
  title: string;
  rows: Array<{
    person: string;
    task: string | null;
    blocker: string;
    minutes: number;
    stuck: boolean;
    ticket_ref: string | null;
    event_id: string | null;
  }>;
}

export interface IssuesBlock {
  type: "issues";
  title: string;
  rows: Array<{ kind: "blocker" | "collision" | "rediscovery"; text: string; count: number; people: string[] }>;
}

export interface BarsBlock {
  type: "bars";
  title: string;
  rows: Array<{ label: string; value: number }>;
}

export interface TimelineBlock {
  type: "timeline";
  title: string;
  buckets: Array<{ label: string; count: number }>;
}

export interface SessionRow {
  event_id: string | null;
  session_pk: number;
  person: string;
  task: string | null;
  summary: string | null;
  status: StatusTone;
  ticket_ref: string | null;
  modules: string[];
  last_seen_at: string;
}

export interface SessionsBlock {
  type: "sessions";
  title: string;
  rows: SessionRow[];
}

export interface InsightsBlock {
  type: "insights";
  title: string;
  kind: "decisions" | "dead_ends";
  rows: Array<{ person: string; title: string; reason: string; ts: string; event_id: string | null }>;
}

export interface PersonBlock {
  type: "person";
  person: string;
  status: PersonStatus;
  done: number;
  in_progress: number;
  blocked: number;
  modules: string[];
  last_activity_at: string | null;
  current: SessionRow | null;
}

export type AnswerBlock =
  | KpisBlock
  | StatusBlock
  | LeaderboardBlock
  | BlockersBlock
  | IssuesBlock
  | BarsBlock
  | TimelineBlock
  | SessionsBlock
  | InsightsBlock
  | PersonBlock;

export interface AskStep {
  label: string;
  tool: string | null;
  ms: number;
}
