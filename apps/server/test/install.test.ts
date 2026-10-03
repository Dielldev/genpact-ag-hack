import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Context } from "hono";
import { originOf, withPrelude } from "../src/http/install.js";

const ctx = (headers: Record<string, string>) => ({ req: { header: (name: string) => headers[name.toLowerCase()] } }) as unknown as Context;

describe("installer routes", () => {
  it("puts the site address after the shebang of the shell script", () => {
    const out = withPrelude("install.sh", "#!/bin/sh\nset -eu\necho hi\n", "https://mesh.example.com");
    assert.equal(out, '#!/bin/sh\nMESH_URL="${MESH_URL:-https://mesh.example.com}"\nexport MESH_URL\nset -eu\necho hi\n');
  });

  it("puts the site address first in the PowerShell script", () => {
    const out = withPrelude("install.ps1", "$ErrorActionPreference = 'Stop'\n", "https://mesh.example.com");
    assert.ok(out.startsWith("if (-not $env:MESH_URL) { $env:MESH_URL = 'https://mesh.example.com' }\n"));
  });

  it("works out the address from forwarded headers", () => {
    assert.equal(originOf(ctx({ "x-forwarded-host": "mesh.vercel.app", "x-forwarded-proto": "https" }), undefined), "https://mesh.vercel.app");
    assert.equal(originOf(ctx({ host: "mesh.vercel.app" }), undefined), "https://mesh.vercel.app");
    assert.equal(originOf(ctx({ host: "localhost:8787" }), undefined), "http://localhost:8787");
  });

  it("prefers the configured public address", () => {
    assert.equal(originOf(ctx({ host: "other.example.com" }), "https://mesh.example.com/"), "https://mesh.example.com");
  });

  it("refuses hosts that could break out of the script", () => {
    assert.equal(originOf(ctx({ host: "x.com'; rm -rf ~; '" }), undefined), null);
    assert.equal(originOf(ctx({ host: "x.com", "x-forwarded-proto": "javascript" }), undefined), null);
    assert.equal(originOf(ctx({}), undefined), null);
  });
});
