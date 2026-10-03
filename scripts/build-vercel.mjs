import { build } from "esbuild";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, ".vercel", "output");
const fn = join(out, "functions", "api.func");
const site = join(out, "static");
const install = join(site, "install");

const sh = (command) => execSync(command, { cwd: root, stdio: "inherit" });

rmSync(out, { recursive: true, force: true });
sh("pnpm --filter @mesh/contract build");
sh("pnpm --filter @mesh/cli build");
sh("pnpm --filter @mesh/web build");

mkdirSync(fn, { recursive: true });
await build({
  entryPoints: [join(root, "apps/server/src/vercel.ts")],
  outfile: join(fn, "index.mjs"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  external: ["@electric-sql/pglite"],
  banner: { js: "import { createRequire as __mkRequire } from 'node:module'; const require = __mkRequire(import.meta.url);" },
  legalComments: "none",
  logLevel: "warning",
});
writeFileSync(join(fn, "package.json"), JSON.stringify({ type: "module" }));
writeFileSync(
  join(fn, ".vc-config.json"),
  JSON.stringify({ runtime: "nodejs22.x", handler: "index.mjs", launcherType: "Nodejs", shouldAddHelpers: false, maxDuration: 30 }, null, 2),
);

cpSync(join(root, "apps/web/dist"), site, { recursive: true });
mkdirSync(install, { recursive: true });
const hookFiles = ["cli.mjs", "hook.mjs"];
for (const file of hookFiles) cpSync(join(root, "packages/cli/dist", file), join(install, file));
const sums = hookFiles.map((file) => `${createHash("sha256").update(readFileSync(join(install, file))).digest("hex")}  ${file}`);
writeFileSync(join(install, "SHA256SUMS"), `${sums.join("\n")}\n`);
for (const file of ["install.sh", "install.ps1"]) cpSync(join(root, "install", file), join(install, file));

const text = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" };
writeFileSync(
  join(out, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "^/(api/v1/.*|mcp|install\\.sh|install\\.ps1)$", dest: "/api?__path=$1" },
        { src: "^/install/SHA256SUMS$", headers: text, continue: true },
        { handle: "filesystem" },
      ],
    },
    null,
    2,
  ),
);

if (!existsSync(join(fn, "index.mjs"))) throw new Error("function bundle was not written");
console.log(`\nVercel output ready in ${out}`);
