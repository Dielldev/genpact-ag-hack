import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { ApiRoute, type HealthResponse } from "@mesh/contract";
import type { AppDeps } from "../deps.js";
import { buildMcpServer, SERVER_VERSION } from "../mcp/server.js";
import { recordTurn } from "../reportProgress.js";
import { ValidationError } from "../schemas.js";
import { HttpError, readJson } from "./errors.js";
import { registerDashboardRoutes } from "./routes.js";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function hostAllowed(hostHeader: string | undefined, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  if (!hostHeader) return false;
  const host = hostHeader.toLowerCase().replace(/:\d+$/, "");
  if (LOCAL_HOSTS.has(host)) return true;
  return allowed.some((a) => (a.startsWith("*.") ? host.endsWith(a.slice(1)) : host === a));
}

const rpcError = (message: string) => ({ jsonrpc: "2.0", error: { code: -32000, message }, id: null });

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Accept", "Authorization", "mcp-session-id", "mcp-protocol-version", "last-event-id"],
      exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
    }),
  );
  app.use("*", async (c, next) => {
    const started = performance.now();
    await next();
    if (c.req.method === "POST" || c.res.status >= 500) {
      deps.log(`${c.req.method} ${c.req.path} ${c.res.status} ${(performance.now() - started).toFixed(1)}ms`);
    }
  });
  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: { code: err.code, message: err.message } }, err.status);
    if (err instanceof ValidationError) return c.json({ error: { code: "invalid_request", message: err.message } }, 400);
    deps.log(`unhandled ${c.req.method} ${c.req.path}: ${err.stack ?? err}`);
    return c.json({ error: { code: "internal", message: "Internal server error" } }, 500);
  });

  app.get(ApiRoute.health, (c) => c.json({ ok: true, version: SERVER_VERSION } satisfies HealthResponse));
  app.post(ApiRoute.turns, async (c) => c.json(await recordTurn(deps, await readJson(c))));

  app.post(ApiRoute.mcp, async (c) => {
    if (!hostAllowed(c.req.header("host"), deps.config.allowedHosts)) {
      return c.json(rpcError("Host not allowed. Add it to ALLOWED_HOSTS."), 403);
    }
    const server = buildMcpServer(deps);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    try {
      await server.connect(transport);
      return await transport.handleRequest(c.req.raw);
    } finally {
      await server.close().catch(() => undefined);
    }
  });
  const notAllowed = (c: Context) => {
    c.header("Allow", "POST");
    return c.json(rpcError("Method not allowed. This server is stateless: use POST."), 405);
  };
  app.get(ApiRoute.mcp, notAllowed);
  app.delete(ApiRoute.mcp, notAllowed);

  registerDashboardRoutes(app, deps);
  app.notFound((c) => c.json({ error: { code: "not_found", message: `No route for ${c.req.method} ${c.req.path}` } }, 404));
  return app;
}
