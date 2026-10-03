import { serve } from "@hono/node-server";
import type { AddressInfo } from "node:net";
import { createAgentRunner } from "./agent/run.js";
import type { AgentRunner } from "./agent/types.js";
import { loadConfig, type Config } from "./config.js";
import { openDb, type Db } from "./db/client.js";
import { createMeshApi } from "./db/meshApi.js";
import type { AppDeps } from "./deps.js";
import { createApp } from "./http/app.js";
import { AnthropicLlm } from "./llm/anthropic.js";
import type { LlmClient } from "./llm/types.js";

export const EXPECTED_API_VERSION = 1;

export interface BuildOptions {
  config?: Partial<Config>;
  db?: Db;
  llm?: LlmClient | null;
  agent?: AgentRunner | null;
  clock?: () => Date;
  log?: (message: string) => void;
}

export async function buildDeps(opts: BuildOptions = {}): Promise<AppDeps> {
  const config: Config = { ...loadConfig(), ...opts.config };
  const db = opts.db ?? (await openDb({ supabaseUrl: config.supabaseUrl, serviceRoleKey: config.serviceRoleKey, pgliteDir: config.pgliteDir }));
  const api = createMeshApi(db);
  const version = await api.apiVersion();
  if (version !== EXPECTED_API_VERSION) throw new Error(`database mesh_api_version() is ${version}, server expects ${EXPECTED_API_VERSION}`);
  const llm = opts.llm !== undefined ? opts.llm : config.anthropicApiKey ? new AnthropicLlm(config.anthropicApiKey) : null;
  const clock = opts.clock ?? (() => new Date());
  const log = opts.log ?? ((m: string) => console.log(`[mesh] ${m}`));
  const agent = opts.agent !== undefined ? opts.agent : config.openrouterApiKey ? createAgentRunner({ api, config, clock, log }) : null;
  return { db, api, llm, agent, config, clock, log };
}

export interface RunningServer {
  url: string;
  port: number;
  deps: AppDeps;
  close(): Promise<void>;
}

export async function startServer(opts: BuildOptions = {}): Promise<RunningServer> {
  const deps = await buildDeps(opts);
  const app = createApp(deps);
  return new Promise((resolve) => {
    const server = serve({ fetch: app.fetch, port: deps.config.port, hostname: deps.config.host }, (info: AddressInfo) => {
      const host = deps.config.host === "0.0.0.0" ? "localhost" : deps.config.host;
      resolve({
        url: `http://${host}:${info.port}`,
        port: info.port,
        deps,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => done());
            (server as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
          }),
      });
    });
  });
}
