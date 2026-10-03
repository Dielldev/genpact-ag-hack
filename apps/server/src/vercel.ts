import { getRequestListener } from "@hono/node-server";
import type { IncomingMessage, ServerResponse } from "node:http";
import { loadConfig, type Config } from "./config.js";
import { createApp } from "./http/app.js";
import { buildDeps } from "./server.js";

type Listener = (req: IncomingMessage, res: ServerResponse) => unknown;

let booting: Promise<Listener> | undefined;

export function assertProtected(config: Pick<Config, "members">, allowOpen: string | undefined): void {
  if (config.members.length === 0 && allowOpen !== "1") {
    throw new Error("MESH_MEMBERS is not set, so this deployment would be open to everyone. Set it, or set MESH_ALLOW_OPEN=1 to allow that.");
  }
}

async function boot(): Promise<Listener> {
  assertProtected(loadConfig(), process.env.MESH_ALLOW_OPEN);
  const deps = await buildDeps();
  return getRequestListener(createApp(deps).fetch) as Listener;
}

export function restoreUrl(url: string | undefined): string {
  const parsed = new URL(url ?? "/", "http://mesh.local");
  const original = parsed.searchParams.get("__path");
  if (!original) return `${parsed.pathname}${parsed.search}`;
  parsed.searchParams.delete("__path");
  const rest = parsed.searchParams.toString();
  return `/${original.replace(/^\/+/, "")}${rest ? `?${rest}` : ""}`;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  req.url = restoreUrl(req.url);
  booting ??= boot().catch((error) => {
    booting = undefined;
    throw error;
  });
  await (await booting)(req, res);
}
