import { context, build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const watch = process.argv.includes("--watch");

const shared = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  logLevel: "info",
};

const targets = [
  {
    ...shared,
    entryPoints: [join(root, "src/cli.ts")],
    outfile: join(root, "dist/cli.mjs"),
    banner: { js: "#!/usr/bin/env node" },
  },
  {
    ...shared,
    entryPoints: [join(root, "src/hook/main.ts")],
    outfile: join(root, "dist/hook.mjs"),
  },
];

if (watch) {
  for (const options of targets) {
    const ctx = await context(options);
    await ctx.watch();
  }
} else {
  await Promise.all(targets.map((options) => build(options)));
}
