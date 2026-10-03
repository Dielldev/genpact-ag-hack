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

import type { EventRecord, KnowledgeEntry, Provenance } from "./core.js";

export enum TicketStatus {
  open = "open",
  closed = "closed",
}

export interface Ticket {
  ticket_id: string;
  workspace: string;
  ref: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  assignee: string | null;
  created_by: string;
  created_at: string;
}

export interface Project {
  project_id: string;
  workspace: string;
  title: string;
  github_url: string | null;
  created_by: string;
  created_at: string;
}

export interface ProjectsResponse {
  workspace: string;
  projects: Project[];
}

export interface MeResponse {
  person: string | null;
  workspace: string | null;
  auth: boolean;
}

export interface TicketNote {
  event_id: string | null;
  person: string;
  status: ReportStatus | null;
  task: string | null;
  summary: string | null;
  last_seen_at: string;
}

export interface TicketDetail {
  ref: string;
  ticket: Ticket | null;
  modules: string[];
  notes: TicketNote[];
  decisions: Array<Decision & Provenance>;
  dead_ends: Array<DeadEnd & Provenance>;
  human_corrections: Array<HumanCorrection & Provenance>;
  knowledge: KnowledgeEntry[];
}

export interface CreateTicketRequest {
  workspace: string;
  title: string;
  created_by: string;
  description?: string;
  assignee?: string;
  ref?: string;
}

export interface CoverageModule {
  module: string;
  person_sessions: number;
  total_sessions: number;
  contributors: number;
  share: number;
  only_contributor: boolean;
  decisions: number;
  dead_ends: number;
  human_corrections: number;
  reasoning_per_session: number;
  thin: boolean;
  answered: number;
  last_activity_at: string | null;
  reason: string;
}

export interface ExitQuestion {
  question_id: string;
  person: string;
  module: string | null;
  question: string;
  rationale: string | null;
  source_event_ids: string[];
  created_at: string;
  answer: KnowledgeEntry | null;
}

export interface ExitInterviewResponse {
  workspace: string;
  person: string;
  status: PersonStatus;
  coverage: CoverageModule[];
  questions: ExitQuestion[];
  entries: KnowledgeEntry[];
}

export interface SetPersonStatusRequest {
  workspace: string;
  status: PersonStatus;
}

export interface GenerateQuestionsRequest {
  workspace: string;
  force?: boolean;
}

export interface SaveExitAnswerRequest {
  workspace: string;
  question_id: string;
  answer: string;
}

export interface ContributorSummary {
  person: string;
  status: PersonStatus;
  sessions: number;
  last_activity_at: string | null;
}

export interface OnboardingResponse {
  workspace: string;
  module: string;
  owner: (ContributorSummary & { share: number }) | null;
  owner_left: boolean;
  contributors: ContributorSummary[];
  history: EventRecord[];
  dead_ends: Array<DeadEnd & Provenance>;
  decisions: Array<Decision & Provenance>;
  human_corrections: Array<HumanCorrection & Provenance>;
  exit_answers: KnowledgeEntry[];
  files_to_read: Array<{ ref: string; label: string | null; sessions: number }>;
  open_work: EventRecord[];
}

export interface ApiError {
  error: { code: string; message: string };
}
