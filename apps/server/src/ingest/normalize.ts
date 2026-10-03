import {
  DecisionArea,
  type ArtifactRef,
  type Client,
  type DeadEnd,
  type Decision,
  type HumanCorrection,
  type ReportStatus,
  type Visibility,
} from "@mesh/contract";
import { redact } from "../redact.js";
import { issuesOf, ReportInputSchema, ValidationError, type ParsedReport } from "../schemas.js";
import { clip, normText, slugify } from "../text.js";

export const LIMITS = {
  identity: 200,
  ticketRef: 100,
  task: 300,
  summary: 1200,
  kind: 40,
  ref: 300,
  label: 200,
  module: 60,
  tag: 60,
  text: 400,
  reason: 800,
  raw: 20_000,
} as const;

export const CAPS = {
  artifacts: 50,
  modules: 20,
  tags: 20,
  decisions: 30,
  deadEnds: 30,
  corrections: 30,
  blockers: 20,
  raw: 200,
} as const;

export interface NormalizedReport {
  client: Client;
  session_id: string;
  person: string;
  workspace: string;
  visibility: Visibility;
  ticket_ref: string | null;
  task: string;
  status: ReportStatus;
  summary: string;
  artifacts: ArtifactRef[];
  modules: string[];
  tags: string[];
  decisions: Decision[];
  dead_ends: DeadEnd[];
  human_corrections: HumanCorrection[];
  blockers: string[];
}

export const itemKey = {
  artifact: (a: ArtifactRef) => `${a.kind.toLowerCase()}|${a.ref.trim().replace(/^\.\//, "").toLowerCase()}`,
  decision: (d: Decision) => normText(d.choice),
  deadEnd: (d: DeadEnd) => normText(d.attempt),
  correction: (c: HumanCorrection) => normText(c.correction),
  text: (s: string) => normText(s),
};

export function dedupe<T>(items: T[], key: (item: T) => string): T[] {
  const index = new Map<string, number>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    const at = index.get(k);
    if (at === undefined) {
      index.set(k, out.length);
      out.push(item);
    } else {
      out[at] = item;
    }
  }
  return out;
}

export function parseReport(raw: unknown): ParsedReport {
  const parsed = ReportInputSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(issuesOf(parsed.error));
  return parsed.data;
}

const pre = (s: string | null | undefined) => redact((s ?? "").slice(0, LIMITS.raw));
const preList = <T>(list: T[] | null | undefined) => (list ?? []).slice(0, CAPS.raw);

function artifactsOf(p: ParsedReport): ArtifactRef[] {
  const refs = preList(p.artifacts)
    .map((a) => {
      const label = a.label ? clip(pre(a.label), LIMITS.label) : "";
      const artifact: ArtifactRef = {
        kind: clip(pre(a.kind), LIMITS.kind).toLowerCase() || "file",
        ref: clip(pre(a.ref), LIMITS.ref).replace(/^\.\//, ""),
      };
      if (label) artifact.label = label;
      return artifact;
    })
    .filter((a) => a.ref);
  return dedupe(refs, itemKey.artifact).slice(0, CAPS.artifacts);
}

export function normalizeReport(p: ParsedReport): NormalizedReport {
  const ticket = p.ticket_ref ? clip(pre(p.ticket_ref), LIMITS.ticketRef) : "";
  return {
    client: p.client,
    session_id: clip(p.session_id, LIMITS.identity),
    person: clip(p.person, LIMITS.identity),
    workspace: clip(p.workspace, LIMITS.identity),
    visibility: p.visibility,
    ticket_ref: ticket || null,
    task: clip(pre(p.task), LIMITS.task),
    status: p.status,
    summary: clip(pre(p.summary), LIMITS.summary),
    artifacts: artifactsOf(p),
    modules: dedupe(
      preList(p.modules).map((m) => slugify(pre(m), LIMITS.module)).filter(Boolean),
      (m) => m,
    ).slice(0, CAPS.modules),
    tags: dedupe(
      preList(p.tags).map((t) => clip(pre(t), LIMITS.tag).toLowerCase()).filter(Boolean),
      (t) => t,
    ).slice(0, CAPS.tags),
    decisions: dedupe(
      preList(p.decisions).map((d) => ({
        area: d.area ?? DecisionArea.technical,
        choice: clip(pre(d.choice), LIMITS.text),
        reason: clip(pre(d.reason), LIMITS.reason),
      })),
      itemKey.decision,
    ).slice(0, CAPS.decisions),
    dead_ends: dedupe(
      preList(p.dead_ends).map((d) => ({ attempt: clip(pre(d.attempt), LIMITS.text), reason: clip(pre(d.reason), LIMITS.reason) })),
      itemKey.deadEnd,
    ).slice(0, CAPS.deadEnds),
    human_corrections: dedupe(
      preList(p.human_corrections).map((c) => ({
        correction: clip(pre(c.correction), LIMITS.text),
        reason: clip(pre(c.reason), LIMITS.reason),
      })),
      itemKey.correction,
    ).slice(0, CAPS.corrections),
    blockers: dedupe(
      preList(p.blockers).map((b) => clip(pre(b), LIMITS.text)).filter(Boolean),
      itemKey.text,
    ).slice(0, CAPS.blockers),
  };
}
