import type {
  ArtifactRef,
  Client,
  DeadEnd,
  Decision,
  HumanCorrection,
  KnowledgeSource,
  PersonStatus,
  ReportStatus,
  Visibility,
  WarningKind,
} from "@mesh/contract";

export type Dated<T> = T & { ts: string };

export interface EventRecord {
  event_id: string | null;
  session_pk: number;
  event_ids: string[];
  client: Client;
  session_id: string;
  person: string;
  workspace: string;
  project: string | null;
  visibility: Visibility;
  ticket_ref: string | null;
  task: string | null;
  status: ReportStatus | null;
  status_since: string | null;
  summary: string | null;
  artifacts: ArtifactRef[];
  modules: string[];
  tags: string[];
  decisions: Dated<Decision>[];
  dead_ends: Dated<DeadEnd>[];
  human_corrections: Dated<HumanCorrection>[];
  blockers: string[];
  first_seen_at: string;
  last_seen_at: string;
  last_report_at: string | null;
  report_count: number;
}

export interface Provenance {
  event_id: string | null;
  person: string;
  ts: string;
}

export interface EventRef {
  event_id: string | null;
  session_pk: number;
  person: string;
  task: string | null;
  status: ReportStatus | null;
  project: string | null;
  ticket_ref: string | null;
  modules: string[];
  last_seen_at: string;
}

export enum FeedKind {
  report = "report",
  presence = "presence",
}

export interface FeedItem {
  key: string;
  kind: FeedKind;
  event_id: string | null;
  session_pk: number;
  client: Client;
  session_id: string;
  person: string;
  project: string | null;
  ticket_ref: string | null;
  task: string | null;
  summary: string | null;
  status: ReportStatus | null;
  status_since: string | null;
  modules: string[];
  artifacts: ArtifactRef[];
  blockers: string[];
  report_count: number;
  first_seen_at: string;
  last_seen_at: string;
  last_report_at: string | null;
}

export interface FeedResponse {
  workspace: string;
  items: FeedItem[];
  cursor: string;
  server_time: string;
  partial: boolean;
}

export interface WarningCard {
  warning_id: string;
  kind: WarningKind;
  message: string;
  created_at: string;
  reporter: EventRef;
  sources: EventRef[];
  people: string[];
}

export interface WarningsResponse {
  workspace: string;
  warnings: WarningCard[];
  server_time: string;
}

export interface EventResponse {
  event: EventRecord;
  warnings: WarningCard[];
}

export interface WorkspaceSummary {
  workspace: string;
  people: number;
  sessions: number;
  last_activity_at: string | null;
}

export interface WorkspacesResponse {
  workspaces: WorkspaceSummary[];
}

export interface PersonSummary {
  person: string;
  status: PersonStatus;
  sessions: number;
  open_sessions: number;
  modules: string[];
  last_activity_at: string | null;
}

export interface PeopleResponse {
  workspace: string;
  people: PersonSummary[];
}

export interface ModuleSummary {
  module: string;
  sessions: number;
  people: string[];
  last_activity_at: string | null;
}

export interface ModulesResponse {
  workspace: string;
  modules: ModuleSummary[];
  tags: string[];
}

export interface KnowledgeEntry {
  entry_id: string;
  workspace: string;
  person: string;
  module: string | null;
  question: string;
  answer: string;
  source: KnowledgeSource;
  source_event_ids: string[];
  created_at: string;
}

export enum AskIntent {
  status = "status",
  why = "why",
  onboarding = "onboarding",
  other = "other",
}

export enum PlanSource {
  llm = "llm",
  heuristic = "heuristic",
}

export interface AskRequest {
  workspace: string;
  question: string;
}

export interface AskPlan {
  intent: AskIntent;
  person: string | null;
  modules: string[];
  keywords: string[];
  since_days: number | null;
  source: PlanSource;
}

export interface AskResponse {
  answer: string;
  no_record: boolean;
  citations: string[];
  sources: EventRecord[];
  knowledge: KnowledgeEntry[];
  plan: AskPlan;
  degraded?: string;
}

