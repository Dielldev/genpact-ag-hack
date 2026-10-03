import type { Client, DecisionArea, ReportStatus, Visibility, WarningKind } from "./enums.js";

export interface ArtifactRef {
  kind: string;
  ref: string;
  label?: string;
}

export interface Decision {
  area: DecisionArea;
  choice: string;
  reason: string;
}

export interface DeadEnd {
  attempt: string;
  reason: string;
}

export interface HumanCorrection {
  correction: string;
  reason: string;
}

export interface ReportProgressInput {
  session_id: string;
  client: Client;
  person: string;
  workspace: string;
  visibility: Visibility;
  ticket_ref?: string;
  task: string;
  status: ReportStatus;
  summary: string;
  artifacts: ArtifactRef[];
  modules: string[];
  tags: string[];
  decisions?: Decision[];
  dead_ends: DeadEnd[];
  human_corrections: HumanCorrection[];
  blockers: string[];
}

export interface ReportWarning {
  kind: WarningKind;
  message: string;
  source_event_ids: string[];
}

export interface ReportProgressResult {
  event_id: string;
  warnings: ReportWarning[];
}
