import type { Context, Hono } from "hono";
import type { AppDeps } from "../deps.js";

const HOST_PATTERN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i;

const PRELUDE: Record<string, (url: string) => string> = {
  "install.sh": (url) => `MESH_URL="\${MESH_URL:-${url}}"\nexport MESH_URL\n`,
  "install.ps1": (url) => `if (-not $env:MESH_URL) { $env:MESH_URL = '${url}' }\n`,
};

export function originOf(c: Context, publicUrl: string | undefined): string | null {
  if (publicUrl) return publicUrl.replace(/\/+$/, "");
  const host = (c.req.header("x-forwarded-host") ?? c.req.header("host") ?? "").split(",")[0]?.trim() ?? "";
  if (!HOST_PATTERN.test(host)) return null;
  const local = /^(localhost|127\.0\.0\.1)(:|$)/i.test(host);
  const proto = (c.req.header("x-forwarded-proto") ?? (local ? "http" : "https")).split(",")[0]?.trim();
  return proto === "http" || proto === "https" ? `${proto}://${host}` : null;
}

export function withPrelude(name: string, template: string, url: string): string {
  const prelude = PRELUDE[name]?.(url) ?? "";
  if (!template.startsWith("#!")) return prelude + template;
  const end = template.indexOf("\n") + 1;
  return template.slice(0, end) + prelude + template.slice(end);
}

export function registerInstallRoutes(app: Hono, deps: AppDeps): void {
  for (const name of Object.keys(PRELUDE)) {
    app.get(`/${name}`, async (c) => {
      const origin = originOf(c, deps.config.publicUrl);
      if (!origin) return c.text("Could not work out this site's address.\n", 400);
      const res = await fetch(`${origin}/install/${name}`).catch(() => null);
      if (!res?.ok) return c.text("The installer files are not available on this site.\n", 502);
      return c.text(withPrelude(name, await res.text(), origin), 200, { "Cache-Control": "no-store" });
    });
  }
}
