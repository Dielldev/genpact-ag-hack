import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Client, MCP_SERVER_NAME, McpTool, PersonStatus, Visibility, type ReportProgressResult } from "@mesh/contract";
import type { AskResponse, ExitInterviewResponse, FeedResponse, OnboardingResponse, WarningsResponse } from "../src/api/types.js";
import { createPgliteDb } from "../src/db/client.js";
import { BANK_WS, DEV_WS } from "../src/fixtures/billing.js";
import { BANKER_MARKERS, demoSeed, demoSteps, PRIVATE_MARKER } from "../src/fixtures/demo.js";
import { loadSeed } from "../src/seed.js";
import { startServer } from "../src/server.js";

const results: Array<{ name: string; ok: boolean; detail?: string }> = [];

async function check(name: string, run: () => Promise<void>) {
  try {
    await run();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, detail: (error as Error).message });
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const server = await startServer({ db: await createPgliteDb(), llm: null, config: { port: 0, host: "127.0.0.1" }, log: () => undefined });
const base = server.url;
const get = async <T>(path: string) => {
  const res = await fetch(`${base}${path}`);
  return { status: res.status, body: (await res.json()) as T };
};
const post = async <T>(path: string, body: unknown) => {
  const res = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as T };
};

const mcp = new McpClient({ name: "smoke", version: "1.0.0" });
await mcp.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
const callReport = async (args: object) => {
  const res = await mcp.callTool({ name: McpTool.reportProgress, arguments: { ...args } });
  const text = (res.content as Array<{ text: string }>)[0]?.text ?? "";
  return { result: res.structuredContent as unknown as ReportProgressResult, text, isError: Boolean(res.isError) };
};

const seeded = await loadSeed(server.deps, demoSeed());
const ws = encodeURIComponent(DEV_WS);

await check("MCP server is named mesh and exposes report_progress", async () => {
  assert(mcp.getServerVersion()?.name === MCP_SERVER_NAME, "server name");
  const { tools } = await mcp.listTools();
  for (const tool of Object.values(McpTool)) assert(tools.some((t) => t.name === tool), `missing tool ${tool}`);
});

await check("same-session reports upsert one record", async () => {
  const first = await callReport(demoSteps.unrelated());
  const second = await callReport({ ...demoSteps.unrelated(), summary: "Second pass on the copy." });
  const feed = await get<FeedResponse>(`/api/v1/feed?workspace=${ws}`);
  const rows = feed.body.items.filter((i) => i.session_id === "noor-copy-live");
  assert(rows.length === 1, `expected one feed row, got ${rows.length}`);
  assert(rows[0]!.report_count === 2, "report_count should be 2");
  assert(first.result.event_id !== second.result.event_id, "each report has its own event id");
});

await check("unrelated report returns Recorded. with no warnings", async () => {
  const out = await callReport({ ...demoSteps.unrelated(), session_id: "noor-copy-2" });
  assert(out.text === "Recorded.", `text was ${out.text}`);
  assert(out.result.warnings.length === 0, "expected no warnings");
});

await check("Dev B gets a collision warning naming Dev A", async () => {
  const out = await callReport(demoSteps.devBCollision());
  const collision = out.result.warnings.find((w) => w.kind === "collision");
  assert(collision, `no collision warning: ${out.text}`);
  assert(collision.message.includes("Ana Lee"), `message: ${collision.message}`);
  assert(out.text.startsWith("Recorded.\ncollision:"), "text block lists the warning");
});

await check("Dev B hitting Dev C's dead end gets a rediscovery warning", async () => {
  const out = await callReport(demoSteps.devBRediscovery());
  const hit = out.result.warnings.find((w) => w.kind === "rediscovery");
  assert(hit, `no rediscovery warning: ${out.text}`);
  assert(hit.message.includes("Sam Ortiz"), `message: ${hit.message}`);
});

await check("collision cards reach the dashboard", async () => {
  const res = await get<WarningsResponse>(`/api/v1/warnings?workspace=${ws}`);
  assert(res.body.warnings.some((w) => w.kind === "collision" && w.people.includes("Ana Lee")), "no collision card");
});

await check("/turns answers fast (p95 < 100ms) and debounces", async () => {
  const times: number[] = [];
  for (let i = 0; i < 60; i++) {
    const started = performance.now();
    await post("/api/v1/turns", { client: Client.claudeCode, session_id: `perf-${i % 5}`, person: "Perf Bot", workspace: DEV_WS, project: "perf", visibility: Visibility.shared, ts: new Date().toISOString() });
    times.push(performance.now() - started);
  }
  times.sort((a, b) => a - b);
  const p95 = times[Math.floor(times.length * 0.95)]!;
  assert(p95 < 100, `p95 ${p95.toFixed(1)}ms`);
  const again = await post<{ request_report: boolean }>("/api/v1/turns", { client: Client.claudeCode, session_id: "bo-webhooks-live", person: "Bo Chen", workspace: DEV_WS, project: "billing", visibility: Visibility.shared, ts: new Date().toISOString() });
  assert(again.body.request_report === false, "recent report should debounce");
  const bad = await post("/api/v1/turns", { session_id: "x" });
  assert(bad.status === 400, "malformed ping should be 400");
});

const privateHidden = (label: string, value: unknown) => assert(!JSON.stringify(value).includes(PRIVATE_MARKER) && !JSON.stringify(value).includes("Kai Brennan"), `private data leaked in ${label}`);
const bankerHidden = (label: string, value: unknown) => assert(!BANKER_MARKERS.some((m) => JSON.stringify(value).includes(m)), `banker data leaked in ${label}`);

await check("private and cross-workspace data never leak", async () => {
  const kaiEvent = seeded.event_ids["kai-private-1"]!;
  const bankEvent = seeded.event_ids["mara-falcon-1"]!;
  const feed = await get(`/api/v1/feed?workspace=${ws}`);
  const warnings = await get(`/api/v1/warnings?workspace=${ws}`);
  const people = await get(`/api/v1/people?workspace=${ws}`);
  const modules = await get(`/api/v1/modules?workspace=${ws}`);
  const askRes = await post("/api/v1/ask", { workspace: DEV_WS, question: "What do we know about webhook retries and pay bands?" });
  const onboard = await get(`/api/v1/onboarding/billing?workspace=${ws}`);
  for (const [label, value] of Object.entries({ feed, warnings, people, modules, askRes, onboard })) {
    privateHidden(label, value.body);
    bankerHidden(label, value.body);
  }
  assert((await get(`/api/v1/events/${kaiEvent}?workspace=${ws}`)).status === 404, "private event detail must 404");
  assert((await get(`/api/v1/events/${bankEvent}?workspace=${ws}`)).status === 404, "foreign event detail must 404");
  const bank = await get<FeedResponse>(`/api/v1/feed?workspace=${encodeURIComponent(BANK_WS)}`);
  assert(bank.body.items.some((i) => i.person === "Mara Okafor") && !bank.body.items.some((i) => i.person === "Ana Lee"), "banker feed scoping");
  const privateReport = await callReport({ ...demoSteps.devBCollision(), session_id: "bo-private", visibility: Visibility.private });
  assert(privateReport.result.warnings.length === 0 && privateReport.text === "Recorded.", "private report must get no warnings");
});

await check("ask returns cited ids", async () => {
  const res = await post<AskResponse>("/api/v1/ask", { workspace: DEV_WS, question: "What is Ana Lee working on?" });
  assert(res.status === 200 && !res.body.no_record, `answer: ${res.body.answer}`);
  assert(res.body.citations.length > 0 && res.body.sources.length > 0, "no citations");
  const none = await post<AskResponse>("/api/v1/ask", { workspace: DEV_WS, question: "zebra quantum marmalade" });
  assert(none.body.no_record, "nonsense question should be no record");
});

await check("exit interview answer shows up in onboarding", async () => {
  const person = encodeURIComponent("Marta Silva");
  await post(`/api/v1/people/${person}/status`, { workspace: DEV_WS, status: PersonStatus.leaving });
  const interview = await post<ExitInterviewResponse>(`/api/v1/exit-interview/${person}/questions`, { workspace: DEV_WS });
  assert(interview.body.coverage.some((c) => c.module === "billing"), "billing not in coverage");
  const question = interview.body.questions[0];
  assert(question && interview.body.questions.length >= 3, `only ${interview.body.questions.length} questions`);
  const answer = "Retries must stay spread out: the card networks treat fixed-interval retries as fraud. Keep max_attempts in dunning_config.";
  const saved = await post(`/api/v1/exit-interview/${person}/answers`, { workspace: DEV_WS, question_id: question.question_id, answer });
  assert(saved.status === 201, `save failed ${saved.status}`);
  const onboard = await get<OnboardingResponse>(`/api/v1/onboarding/${encodeURIComponent(question.module ?? "billing")}?workspace=${ws}`);
  assert(onboard.body.exit_answers.some((k) => k.answer === answer), "answer missing from onboarding");
  assert(onboard.body.owner_left, "owner should be flagged as leaving");
});

await mcp.close();
await server.close();
await server.deps.db.close();

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `\n      ${r.detail}` : ""}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} of ${results.length} checks failed` : `\nAll ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
