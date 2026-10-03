import { createPgliteDb } from "../src/db/client.js";
import { demoSeed } from "../src/fixtures/demo.js";
import { loadSeed } from "../src/seed.js";
import { startServer } from "../src/server.js";

const server = await startServer({ db: await createPgliteDb(), config: { supabaseUrl: undefined, serviceRoleKey: undefined } });
const out = await loadSeed(server.deps, demoSeed());
server.deps.log(`demo server on ${server.url} with ${out.reports} seeded reports (in memory, nothing is written to Supabase)`);
