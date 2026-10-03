import { demoSeed } from "../src/fixtures/demo.js";
import { loadSeed } from "../src/seed.js";
import { buildDeps } from "../src/server.js";

const deps = await buildDeps();
if (deps.db.kind === "supabase" && process.argv[2] !== "--yes") {
  console.error("This writes demo data into the live Supabase project. Re-run with --yes to confirm.");
  process.exit(1);
}
const out = await loadSeed(deps, demoSeed());
console.log(`seeded ${out.reports} reports into ${deps.db.kind}`);
await deps.db.close();
