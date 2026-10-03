import { DecisionArea, ItemKind, type PersonStatus, type ReportWarning, type TurnPing } from "@mesh/contract";
import type {
  CoverageModule,
  EventRecord,
  ExitQuestion,
  KnowledgeEntry,
  PersonSummary,
  Project,
  Ticket,
  WorkspaceSummary,
} from "../api/types.js";
import type { NormalizedReport } from "../ingest/normalize.js";
import type { Db } from "./client.js";

interface SessionJson extends Omit<EventRecord, "decisions" | "dead_ends" | "human_corrections" | "blockers"> {
  items: Array<{ kind: string; text: string; reason: string | null; ts: string; event_id: string }>;
  blockers: unknown;
}

function toEvent(s: SessionJson): EventRecord {
  const { items, blockers, ...rest } = s;
  const reasonOf = (r: string | null) => r ?? "";
  return {
    ...rest,
    blockers: Array.isArray(blockers) ? blockers.filter((b): b is string => typeof b === "string") : [],
    decisions: items
      .filter((i) => i.kind === ItemKind.decision)
      .map((i) => ({ area: DecisionArea.technical, choice: i.text, reason: reasonOf(i.reason), ts: i.ts })),
    dead_ends: items.filter((i) => i.kind === ItemKind.deadEnd).map((i) => ({ attempt: i.text, reason: reasonOf(i.reason), ts: i.ts })),
    human_corrections: items
      .filter((i) => i.kind === ItemKind.humanCorrection)
      .map((i) => ({ correction: i.text, reason: reasonOf(i.reason), ts: i.ts })),
  };
}

export interface SessionFilter {
  person?: string | null;
  status?: string | null;
  module?: string | null;
  since?: string | null;
  ticket_ref?: string | null;
  reported?: boolean;
  session_pks?: number[];
  event_ids?: string[];
  limit?: number;
}

export interface WarningRow {
  warning_id: string;
  kind: ReportWarning["kind"];
  message: string;
  created_at: string;
  reporter_event_id: string;
  source_event_ids: string[];
}

export interface SearchHit {
  doc_type: "report" | "item" | "knowledge";
  doc_id: string;
  person: string;
  session_pk: number | null;
  item_kind: string | null;
  ts: string;
  body: string;
  modules: string[];
  score: number;
}

export interface TargetRow {
  module: string;
  my_sessions: number;
  total_sessions: number;
  share: number;
  captured_items: number;
  knowledge_entries: number;
  items_per_session: number;
}

const clean = (filter: object) => Object.fromEntries(Object.entries(filter).filter(([, v]) => v !== undefined && v !== null));

export function createMeshApi(db: Db) {
  return {
    apiVersion: () => db.rpc<number>("mesh_api_version", {}),
    touchSession: (ping: TurnPing) =>
      db.rpc<{ session_pk: number; last_report_at: string | null; report_count: number }>("touch_session", { p: ping }),
    reportProgress: (report: NormalizedReport & { project?: string | null }, windowHours: number) =>
      db.rpc<{ event_id: string; session_pk: number; warnings: Array<ReportWarning & { id: number }> }>("report_progress", {
        p: report,
        p_collision_window: `${windowHours} hours`,
      }),
    sessions: async (ws: string, filter: SessionFilter = {}) =>
      (await db.rpc<SessionJson[]>("session_records", { p_workspace: ws, p_filter: clean(filter) })).map(toEvent),
    warnings: (ws: string, filter: { since?: string; event_id?: string; limit?: number } = {}) =>
      db.rpc<WarningRow[]>("list_warnings", { p_workspace: ws, p_filter: clean(filter) }),
    workspaces: () => db.rpc<WorkspaceSummary[]>("list_workspaces", {}),
    people: (ws: string) => db.rpc<PersonSummary[]>("workspace_people", { p_workspace: ws }),
    vocabulary: (ws: string) => db.rpc<{ people: string[]; modules: string[]; tags: string[] }>("workspace_vocabulary", { p_workspace: ws }),
    setPersonStatus: (ws: string, person: string, status: PersonStatus) =>
      db.rpc<{ person: string; status: PersonStatus }>("set_person_status", { p: { workspace: ws, person, status } }),
    createProject: (input: Record<string, unknown>) => db.rpc<Project>("create_project", { p: input }),
    projects: (ws: string) => db.rpc<Project[]>("list_projects", { p_workspace: ws }),
    createTicket: (input: Record<string, unknown>) => db.rpc<Ticket>("create_ticket", { p: input }),
    tickets: (ws: string, filter: { person?: string | null; include_closed?: boolean; ref?: string } = {}) =>
      db.rpc<Ticket[]>("list_tickets", { p_workspace: ws, p_filter: clean(filter) }),
    knowledge: (ws: string, filter: { person?: string; modules?: string[]; ids?: string[] } = {}) =>
      db.rpc<KnowledgeEntry[]>("list_knowledge", { p_workspace: ws, p_filter: clean(filter) }),
    search: (ws: string, query: string, modules: string[], artifactRefs: string[], limit: number) =>
      db.rpc<SearchHit[]>("search_knowledge", {
        p_workspace: ws,
        p_query: query,
        p_modules: modules,
        p_artifact_refs: artifactRefs,
        p_limit: limit,
      }),
    exitTargets: (ws: string, person: string, limit = 6) =>
      db.rpc<TargetRow[]>("exit_interview_targets", { p_workspace: ws, p_person: person, p_limit: limit }),
    exitQuestions: (ws: string, person: string) =>
      db.rpc<{ questions: ExitQuestion[]; entries: KnowledgeEntry[] }>("list_exit_questions", { p_workspace: ws, p_person: person }),
    replaceExitQuestions: (ws: string, person: string, questions: Array<Omit<ExitQuestion, "question_id" | "person" | "created_at" | "answer">>) =>
      db.rpc<{ questions: ExitQuestion[]; entries: KnowledgeEntry[] }>("replace_exit_questions", {
        p: { workspace: ws, person, questions },
      }),
    answerExitQuestion: (ws: string, person: string, questionId: string, answer: string) =>
      db.rpc<KnowledgeEntry>("answer_exit_question", { p: { workspace: ws, person, question_id: questionId, answer } }),
  };
}

export type MeshApi = ReturnType<typeof createMeshApi>;

export function coverageFromTargets(person: string, rows: TargetRow[]): CoverageModule[] {
  return rows.map((r) => {
    const perSession = Number(r.items_per_session);
    const share = Number(r.share);
    const thin = perSession < 1.5;
    const only = Number(r.my_sessions) === Number(r.total_sessions);
    return {
      module: r.module,
      person_sessions: Number(r.my_sessions),
      total_sessions: Number(r.total_sessions),
      contributors: only ? 1 : 2,
      share,
      only_contributor: only,
      decisions: 0,
      dead_ends: 0,
      human_corrections: 0,
      reasoning_per_session: perSession,
      thin,
      answered: Number(r.knowledge_entries),
      last_activity_at: null,
      reason: `${person} ran ${r.my_sessions} of ${r.total_sessions} ${r.module} sessions (${Math.round(share * 100)}%${only ? ", the only contributor" : ""}) and ${Number(r.captured_items)} decisions, dead ends or corrections were recorded, ${perSession.toFixed(1)} per session${thin ? ", so most of the reasoning is not written down" : ""}.`,
    };
  });
}
