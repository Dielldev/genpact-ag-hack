import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Client, ReportStatus, Visibility } from "@mesh/contract";
import type { Hono } from "hono";
import type { Config } from "../src/config.js";
import type { Db } from "../src/db/client.js";
import type { AppDeps } from "../src/deps.js";
import { createApp } from "../src/http/app.js";
import { buildDeps } from "../src/server.js";

export const BASE = "http://mesh.test";

export const ANA = { name: "Ana Lee", key: "ana-lee-test-key-0123456789" };
export const BO = { name: "Bo Chen", key: "bo-chen-test-key-9876543210" };
export const WORKSPACE = "genpact";

export interface Harness {
  deps: AppDeps;
  app: Hono;
}

export async function openHarness(db: Db, config: Partial<Config>): Promise<Harness> {
  const deps = await buildDeps({
    db,
    llm: null,
    log: () => undefined,
    config: { members: [], workspace: undefined, allowedHosts: [], ...config },
  });
  return { deps, app: createApp(deps) };
}

export interface SendOptions {
  key?: string;
  authorization?: string;
  body?: unknown;
  rawBody?: string;
  headers?: Record<string, string>;
}

export interface Reply<T> {
  status: number;
  headers: Headers;
  body: T;
}

export async function send<T = any>(app: Hono, method: string, path: string, opts: SendOptions = {}): Promise<Reply<T>> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.key) headers.authorization = `Bearer ${opts.key}`;
  if (opts.authorization !== undefined) headers.authorization = opts.authorization;
  let body: string | undefined = opts.rawBody;
  if (opts.body !== undefined) body = JSON.stringify(opts.body);
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await app.request(`${BASE}${path}`, { method, headers, body });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, headers: res.headers, body: parsed as T };
}

export const get = <T = any>(app: Hono, path: string, opts?: SendOptions) => send<T>(app, "GET", path, opts);
export const post = <T = any>(app: Hono, path: string, opts?: SendOptions) => send<T>(app, "POST", path, opts);

export async function mcpClient(app: Hono, key?: string): Promise<McpClient> {
  const client = new McpClient({ name: "auth-test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), {
    fetch: async (input, init) => app.fetch(new Request(input, init)),
    requestInit: key ? { headers: { authorization: `Bearer ${key}` } } : undefined,
  });
  await client.connect(transport);
  return client;
}

export function turnBody(over: Record<string, unknown> = {}) {
  return {
    client: Client.claudeCode,
    session_id: "sess-turn",
    person: "Mallory",
    workspace: "evil-ws",
    project: "billing-service",
    visibility: Visibility.shared,
    ts: "2026-10-03T14:02:11.000Z",
    ...over,
  };
}

export function reportArgs(over: Record<string, unknown> = {}) {
  return {
    session_id: "sess-report",
    client: Client.claudeCode,
    person: "Mallory",
    workspace: "evil-ws",
    visibility: Visibility.shared,
    task: "Fix invoice retries",
    status: ReportStatus.inProgress,
    summary: "Retries double charge customers.",
    ...over,
  };
}
