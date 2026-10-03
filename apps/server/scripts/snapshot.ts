import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPgliteDb } from "../src/db/client.js";
import { demoSeed, demoSteps } from "../src/fixtures/demo.js";
import { reportProgress } from "../src/reportProgress.js";
import { loadSeed } from "../src/seed.js";
import { startServer } from "../src/server.js";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "web", "src", "mock", "snapshot.json");
const server = await startServer({ db: await createPgliteDb(), llm: null, config: { port: 0, host: "127.0.0.1" }, log: () => undefined });
const deps = server.deps;
await loadSeed(deps, demoSeed());
await reportProgress(deps, demoSteps.devBCollision());
await reportProgress(deps, demoSteps.devBRediscovery());
await reportProgress(deps, demoSteps.unrelated());

const get = async (path: string) => (await fetch(`${server.url}/api/v1${path}`)).json();
const post = async (path: string, body: unknown) =>
  (await fetch(`${server.url}/api/v1${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();

await post(`/people/${encodeURIComponent("Marta Silva")}/status`, { workspace: "acme-dev", status: "leaving" });
await post(`/exit-interview/${encodeURIComponent("Marta Silva")}/questions`, { workspace: "acme-dev" });

const workspaces = (await get("/workspaces")) as { workspaces: Array<{ workspace: string }> };
const spaces: Record<string, unknown> = {};
for (const { workspace } of workspaces.workspaces) {
  const ws = encodeURIComponent(workspace);
  const feed = (await get(`/feed?workspace=${ws}`)) as { items: Array<{ event_id: string | null; session_pk: number }> };
  const modules = (await get(`/modules?workspace=${ws}`)) as { modules: string[] };
  const people = (await get(`/people?workspace=${ws}`)) as { people: Array<{ person: string }> };
  const events: Record<string, unknown> = {};
  for (const item of feed.items) {
    const detail = await get(`/events/${item.session_pk}?workspace=${ws}`);
    events[String(item.session_pk)] = detail;
    for (const id of (detail as { event: { event_ids: string[] } }).event.event_ids) events[id] = detail;
  }
  const onboarding: Record<string, unknown> = {};
  for (const m of modules.modules) onboarding[m] = await get(`/onboarding/${encodeURIComponent(m)}?workspace=${ws}`);
  const exit: Record<string, unknown> = {};
  for (const p of people.people) exit[p.person] = await get(`/exit-interview/${encodeURIComponent(p.person)}?workspace=${ws}`);
  spaces[workspace] = { feed, warnings: await get(`/warnings?workspace=${ws}`), people, modules, events, onboarding, exit };
}

writeFileSync(out, JSON.stringify({ generated_at: new Date().toISOString(), workspaces, spaces }, null, 1));
console.log(`wrote ${out}`);
await server.close();
await deps.db.close();
