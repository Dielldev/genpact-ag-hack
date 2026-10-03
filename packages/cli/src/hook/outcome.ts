export enum HookOutcome {
  report = "report",
  allow = "allow",
  error = "error",
}

export enum AllowReason {
  invalidPayload = "invalid_payload",
  notCompleted = "not_completed",
  notConfigured = "not_configured",
  disabledForProject = "disabled_for_project",
  reportDone = "report_done",
  serverUnavailable = "server_unavailable",
  serverDeclined = "server_declined",
}

export type HookDecision =
  | { kind: HookOutcome.report; output: string }
  | { kind: HookOutcome.allow; output: string; reason: AllowReason };
