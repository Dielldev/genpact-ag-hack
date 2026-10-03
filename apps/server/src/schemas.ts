import { z } from "zod";
import {
  Client,
  DecisionArea,
  ReportStatus,
  Visibility,
  WarningKind,
  type ReportProgressResult,
  type TurnPing,
  type TurnPingResponse,
} from "@mesh/contract";

function enumField<T extends Record<string, string>>(field: string, values: T) {
  const allowed = Object.values(values).join(", ");
  return z.enum(values, {
    error: (issue) => `${field} must be one of: ${allowed} (got ${JSON.stringify(issue.input)})`,
  });
}

export const ClientSchema = enumField("client", Client);
export const VisibilitySchema = enumField("visibility", Visibility);
export const StatusSchema = enumField("status", ReportStatus);
export const DecisionAreaSchema = enumField("decision area", DecisionArea);
export const WarningKindSchema = enumField("kind", WarningKind);

export const reportInputShape = {
  session_id: z.string().min(1),
  client: ClientSchema,
  person: z.string().min(1),
  workspace: z.string().min(1),
  visibility: VisibilitySchema,
  ticket_ref: z.string().nullish(),
  task: z.string(),
  status: StatusSchema,
  summary: z.string(),
  artifacts: z.array(z.object({ kind: z.string(), ref: z.string(), label: z.string().nullish() })).nullish(),
  modules: z.array(z.string()).nullish(),
  tags: z.array(z.string()).nullish(),
  decisions: z
    .array(z.object({ area: DecisionAreaSchema.nullish(), choice: z.string(), reason: z.string() }))
    .nullish(),
  dead_ends: z.array(z.object({ attempt: z.string(), reason: z.string() })).nullish(),
  human_corrections: z.array(z.object({ correction: z.string(), reason: z.string() })).nullish(),
  blockers: z.array(z.string()).nullish(),
};

export const ReportInputSchema = z.object(reportInputShape);
export type ParsedReport = z.output<typeof ReportInputSchema>;

export const WarningSchema = z.object({
  kind: WarningKindSchema,
  message: z.string(),
  source_event_ids: z.array(z.string()),
});

export const reportOutputShape = {
  event_id: z.string(),
  warnings: z.array(WarningSchema),
};

export const ReportOutputSchema: z.ZodType<ReportProgressResult> = z.object(reportOutputShape);

export const TurnPingSchema = z.object({
  client: ClientSchema,
  session_id: z.string().min(1),
  turn_id: z.string().nullish(),
  person: z.string().min(1),
  workspace: z.string().min(1),
  project: z.string(),
  visibility: VisibilitySchema,
  ts: z.string(),
});

export function toTurnPing(parsed: z.output<typeof TurnPingSchema>): TurnPing {
  return { ...parsed, turn_id: parsed.turn_id ?? undefined };
}

export const TurnResponseSchema: z.ZodType<TurnPingResponse> = z.object({
  request_report: z.boolean(),
  note: z.string().max(500).optional(),
});

export function issuesOf(error: z.ZodError): string[] {
  return error.issues.map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message));
}

export class ValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid input: ${issues.join("; ")}`);
    this.name = "ValidationError";
  }
}
