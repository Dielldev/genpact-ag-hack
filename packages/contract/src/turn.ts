import type { Client, Visibility } from "./enums.js";

export interface TurnPing {
  client: Client;
  session_id: string;
  turn_id?: string;
  person: string;
  workspace: string;
  project: string;
  visibility: Visibility;
  ts: string;
}

export interface TurnPingResponse {
  request_report: boolean;
  note?: string;
}

export interface HealthResponse {
  ok: boolean;
  version?: string;
}
