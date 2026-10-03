import type { Context, Hono } from "hono";
import { PersonStatus, ReportStatus } from "@mesh/contract";
import type { FeedResponse } from "../api/types.js";
import type { AppDeps } from "../deps.js";
import { ask } from "../intelligence/ask.js";
import { exitInterview, generateQuestions, saveAnswer } from "../intelligence/exitInterview.js";
import { ValidationError } from "../schemas.js";
import { createProject } from "../projects.js";
import { createTicket, onboarding, ticketDetail, warningCards } from "../views.js";
import { toFeedItem } from "./feed.js";
import { identityOf, withIdentity } from "./auth.js";
import { HttpError, readJson } from "./errors.js";

const V1 = "/api/v1";
const FEED_STATUSES = new Set<string>([...Object.values(ReportStatus), "active"]);

function isoOrUndefined(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (Number.isNaN(Date.parse(value))) throw new HttpError(400, "bad_since", "since must be an ISO timestamp");
  return new Date(value).toISOString();
}

function field(body: unknown, key: string): string {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;
  return typeof value === "string" ? value : "";
}

export function registerDashboardRoutes(app: Hono, deps: AppDeps): void {
  const workspaceOf = (c: Context, body?: unknown): string => {
    if (deps.config.workspace) return deps.config.workspace;
    const fromBody = body && typeof body === "object" ? (body as Record<string, unknown>).workspace : undefined;
    const ws = c.req.query("workspace") ?? (typeof fromBody === "string" ? fromBody : undefined);
    if (!ws || !ws.trim()) throw new HttpError(400, "workspace_required", "workspace is required");
    return ws.trim();
  };

  app.get(`${V1}/projects`, async (c) => {
    const ws = workspaceOf(c);
    return c.json({ workspace: ws, projects: await deps.api.projects(ws) });
  });
  app.post(`${V1}/projects`, async (c) => {
    const body = await readJson(c);
    const who = identityOf(deps, c.req.header("authorization"));
    const createdBy = who.person ?? field(body, "created_by") ?? "web";
    return c.json(await createProject(deps, { ...(body as object), workspace: workspaceOf(c, body), created_by: createdBy || "web" }), 201);
  });

  app.get(`${V1}/workspaces`, async (c) => c.json({ workspaces: await deps.api.workspaces() }));

  app.get(`${V1}/people`, async (c) => {
    const ws = workspaceOf(c);
    return c.json({ workspace: ws, people: await deps.api.people(ws) });
  });

  app.get(`${V1}/modules`, async (c) => {
    const ws = workspaceOf(c);
    const vocab = await deps.api.vocabulary(ws);
    return c.json({ workspace: ws, modules: vocab.modules, tags: vocab.tags, people: vocab.people });
  });

  app.get(`${V1}/feed`, async (c) => {
    const ws = workspaceOf(c);
    const status = c.req.query("status");
    if (status && !FEED_STATUSES.has(status)) throw new HttpError(400, "bad_status", `status must be one of: ${[...FEED_STATUSES].join(", ")}`);
    const since = isoOrUndefined(c.req.query("since"));
    const now = deps.clock().toISOString();
    const events = await deps.api.sessions(ws, {
      person: c.req.query("person"),
      status,
      module: c.req.query("module"),
      since,
      limit: Number(c.req.query("limit") ?? 150) || 150,
    });
    const body: FeedResponse = { workspace: ws, items: events.map(toFeedItem), cursor: now, server_time: now, partial: Boolean(since) };
    return c.json(body);
  });

  app.get(`${V1}/events/:id`, async (c) => {
    const ws = workspaceOf(c);
    const id = c.req.param("id");
    const filter = /^\d+$/.test(id) ? { session_pks: [Number(id)] } : { event_ids: [id] };
    const [event] = await deps.api.sessions(ws, { ...filter, limit: 1 });
    if (!event) throw new HttpError(404, "not_found", "No shared event with that id in this workspace");
    return c.json({ event, warnings: event.event_id ? await warningCards(deps, ws, { event_id: event.event_id }) : [] });
  });

  app.get(`${V1}/warnings`, async (c) => {
    const ws = workspaceOf(c);
    const warnings = await warningCards(deps, ws, { since: isoOrUndefined(c.req.query("since")) });
    return c.json({ workspace: ws, warnings, server_time: deps.clock().toISOString() });
  });

  app.post(`${V1}/ask`, async (c) => {
    const body = await readJson(c);
    const question = field(body, "question");
    if (!question.trim()) throw new ValidationError(["question is required"]);
    return c.json(await ask(deps, workspaceOf(c, body), question));
  });

  app.get(`${V1}/tickets`, async (c) => {
    const ws = workspaceOf(c);
    return c.json({ workspace: ws, tickets: await deps.api.tickets(ws, { person: c.req.query("person"), include_closed: c.req.query("include_closed") === "1" }) });
  });
  app.post(`${V1}/tickets`, async (c) => {
    const identity = identityOf(deps, c.req.header("authorization"));
    const bound = { ...identity, ...(identity.person ? { created_by: identity.person } : {}) };
    return c.json(await createTicket(deps, withIdentity(await readJson(c), bound)), 201);
  });
  app.get(`${V1}/tickets/:ref`, async (c) => {
    const detail = await ticketDetail(deps, workspaceOf(c), c.req.param("ref"));
    if (!detail) throw new HttpError(404, "not_found", "No ticket or reports for that ref");
    return c.json(detail);
  });

  app.post(`${V1}/people/:person/status`, async (c) => {
    const body = await readJson(c);
    const status = field(body, "status");
    if (!Object.values(PersonStatus).includes(status as PersonStatus)) {
      throw new ValidationError([`status must be one of: ${Object.values(PersonStatus).join(", ")}`]);
    }
    return c.json(await deps.api.setPersonStatus(workspaceOf(c, body), c.req.param("person"), status as PersonStatus));
  });

  app.get(`${V1}/exit-interview/:person`, async (c) => c.json(await exitInterview(deps, workspaceOf(c), c.req.param("person"))));
  app.post(`${V1}/exit-interview/:person/questions`, async (c) => {
    const body = await readJson(c);
    const force = typeof body === "object" && body !== null && (body as Record<string, unknown>).force === true;
    return c.json(await generateQuestions(deps, workspaceOf(c, body), c.req.param("person"), force));
  });
  app.post(`${V1}/exit-interview/:person/answers`, async (c) => {
    const body = await readJson(c);
    return c.json(await saveAnswer(deps, workspaceOf(c, body), c.req.param("person"), field(body, "question_id"), field(body, "answer")), 201);
  });

  app.get(`${V1}/onboarding/:module`, async (c) => c.json(await onboarding(deps, workspaceOf(c), c.req.param("module"))));
}
