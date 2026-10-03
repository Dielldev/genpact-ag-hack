import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPgliteDb, type Db } from "../src/db/client.js";
import type { Project } from "../src/api/types.js";
import { normalizeGithubUrl } from "../src/projects.js";
import { ValidationError } from "../src/schemas.js";
import { ANA, BO, get, openHarness, post, WORKSPACE, type Harness } from "./harness.js";

const V1 = "/api/v1";
const PROJECTS = `${V1}/projects`;

let db: Db;
let locked: Harness;
let open: Harness;

before(async () => {
  db = await createPgliteDb();
  locked = await openHarness(db, { members: [ANA, BO], workspace: WORKSPACE });
  open = await openHarness(db, {});
});
after(async () => db.close());

const listTitles = async (h: Harness, path: string, key?: string) => {
  const reply = await get<{ workspace: string; projects: Project[] }>(h.app, path, { key });
  assert.equal(reply.status, 200);
  return reply.body.projects.map((p) => p.title);
};

const assertInvalid = (reply: { status: number; body: { error: { code: string; message: string } } }, fragment?: RegExp) => {
  assert.equal(reply.status, 400);
  assert.equal(reply.body.error.code, "invalid_request");
  if (fragment) assert.match(reply.body.error.message, fragment);
};

describe("creating a project", () => {
  it("records the key owner as created_by and pins the workspace", async () => {
    const reply = await post<Project>(locked.app, PROJECTS, {
      key: ANA.key,
      body: { title: "Billing Service", created_by: "Mallory", workspace: "evil-ws" },
    });
    assert.equal(reply.status, 201);
    assert.equal(reply.body.title, "Billing Service");
    assert.equal(reply.body.created_by, ANA.name);
    assert.equal(reply.body.workspace, WORKSPACE);
    assert.equal(reply.body.github_url, null);
    assert.match(reply.body.project_id, /^\d+$/);
    assert.ok(!Number.isNaN(Date.parse(reply.body.created_at)));
    assert.deepEqual(await open.deps.api.projects("evil-ws"), []);
  });

  it("returns the same project for the same title in a different case", async () => {
    const first = await post<Project>(locked.app, PROJECTS, { key: ANA.key, body: { title: "Payments API" } });
    const again = await post<Project>(locked.app, PROJECTS, { key: BO.key, body: { title: "  PAYMENTS api  " } });
    assert.equal(again.status, 201);
    assert.equal(again.body.project_id, first.body.project_id);
    assert.equal(again.body.title, "Payments API");
    assert.equal(again.body.created_by, ANA.name);
    const titles = await listTitles(locked, PROJECTS, BO.key);
    assert.equal(titles.filter((t) => t.toLowerCase() === "payments api").length, 1);
  });

  it("does not create duplicates when the same title arrives at once", async () => {
    const replies = await Promise.all(
      ["Race Track", "race track", "RACE TRACK", "Race track"].map((title) => post<Project>(locked.app, PROJECTS, { key: ANA.key, body: { title } })),
    );
    assert.equal(new Set(replies.map((r) => r.body.project_id)).size, 1);
    assert.equal((await listTitles(locked, PROJECTS, ANA.key)).filter((t) => t.toLowerCase() === "race track").length, 1);
  });

  it("accepts a title of exactly 80 characters", async () => {
    const title = "x".repeat(80);
    const reply = await post<Project>(locked.app, PROJECTS, { key: ANA.key, body: { title } });
    assert.equal(reply.status, 201);
    assert.equal(reply.body.title, title);
  });

  it("rejects an empty, blank, missing or over-long title", async () => {
    for (const body of [{ title: "" }, { title: "   " }, {}, { title: "x".repeat(81) }, { title: 42 }]) {
      assertInvalid(await post(locked.app, PROJECTS, { key: ANA.key, body }));
    }
    assertInvalid(await post(locked.app, PROJECTS, { key: ANA.key, body: { title: "x".repeat(81) } }), /at most 80/);
    assertInvalid(await post(locked.app, PROJECTS, { key: ANA.key, body: { title: "" } }), /title is required/);
  });

  it("rejects bodies that are not a JSON object", async () => {
    for (const body of [null, "billing", 7, ["Billing"]]) {
      assertInvalid(await post(locked.app, PROJECTS, { key: ANA.key, body }));
    }
    const bad = await post(locked.app, PROJECTS, { key: ANA.key, rawBody: "{nope" });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.code, "bad_json");
  });

  it("stores no row for a rejected request", async () => {
    await post(locked.app, PROJECTS, { key: ANA.key, body: { title: "Rejected", github_url: "not a url" } });
    assert.ok(!(await listTitles(locked, PROJECTS, ANA.key)).includes("Rejected"));
  });
});

describe("github_url", () => {
  const create = (github_url: unknown, title = "Repo Link") => post(locked.app, PROJECTS, { key: ANA.key, body: { title: `${title} ${String(github_url)}`, github_url } });

  it("rejects hosts other than github.com and strings that are not urls", async () => {
    const bad = ["https://example.com/x/y", "not a url", "http://github.com/acme/billing", "https://github.com/acme", "https://github.com/acme/billing/tree/main", "https://gitlab.com/acme/billing", "git@github.com:acme/billing.git", "https://github.com.evil.io/acme/billing"];
    for (const value of bad) assertInvalid(await create(value), /github_url must look like/);
  });

  it("normalizes a .git suffix and a trailing slash", async () => {
    assert.equal((await create("https://github.com/acme/billing-service.git", "Normalize")).body.github_url, "https://github.com/acme/billing-service");
    assert.equal((await create("  https://github.com/acme/billing-service/  ", "Slash")).body.github_url, "https://github.com/acme/billing-service");
    assert.equal((await create("https://github.com/acme/billing-service.GIT", "Upper")).body.github_url, "https://github.com/acme/billing-service");
    assert.equal((await create("https://github.com/acme/billing-service.git/", "Both")).body.github_url, "https://github.com/acme/billing-service");
    assert.equal((await create("https://github.com/acme/billing-service", "Plain")).body.github_url, "https://github.com/acme/billing-service");
  });

  it("treats an empty or missing url as none", async () => {
    for (const value of [null, "", "   "]) assert.equal((await create(value, "Nothing")).body.github_url, null);
    const omitted = await post<Project>(locked.app, PROJECTS, { key: ANA.key, body: { title: "Omitted" } });
    assert.equal(omitted.body.github_url, null);
  });

  it("normalizeGithubUrl handles the edge cases directly", () => {
    assert.equal(normalizeGithubUrl(undefined), null);
    assert.equal(normalizeGithubUrl(null), null);
    assert.equal(normalizeGithubUrl(" "), null);
    assert.equal(normalizeGithubUrl("https://github.com/a/b.git"), "https://github.com/a/b");
    assert.throws(() => normalizeGithubUrl("https://example.com/x/y"), ValidationError);
    assert.throws(() => normalizeGithubUrl("https://github.com/a/b?tab=readme"), ValidationError);
  });
});

describe("listing projects", () => {
  it("is sorted by title regardless of case or creation order", async () => {
    const ws = "sorted-ws";
    for (const title of ["zeta", "Alpha", "beta", "Gamma", "alpine"]) {
      await post(open.app, PROJECTS, { body: { title, workspace: ws, created_by: "Cy Park" } });
    }
    assert.deepEqual(await listTitles(open, `${PROJECTS}?workspace=${ws}`), ["Alpha", "alpine", "beta", "Gamma", "zeta"]);
  });

  it("returns the workspace and an empty list when there are no projects", async () => {
    const reply = await get(open.app, `${PROJECTS}?workspace=empty-ws`);
    assert.deepEqual(reply.body, { workspace: "empty-ws", projects: [] });
  });

  it("ignores the workspace query when one is forced", async () => {
    const reply = await get<{ workspace: string; projects: Project[] }>(locked.app, `${PROJECTS}?workspace=sorted-ws`, { key: ANA.key });
    assert.equal(reply.body.workspace, WORKSPACE);
    assert.ok(reply.body.projects.every((p) => p.workspace === WORKSPACE));
  });
});

describe("without a forced workspace", () => {
  it("keeps projects isolated per workspace", async () => {
    await post(open.app, PROJECTS, { body: { title: "Ledger", workspace: "iso-a", created_by: "Ana Lee" } });
    await post(open.app, PROJECTS, { body: { title: "Ledger", workspace: "iso-b", created_by: "Bo Chen" } });
    await post(open.app, PROJECTS, { body: { title: "Only In A", workspace: "iso-a", created_by: "Ana Lee" } });
    assert.deepEqual(await listTitles(open, `${PROJECTS}?workspace=iso-a`), ["Ledger", "Only In A"]);
    assert.deepEqual(await listTitles(open, `${PROJECTS}?workspace=iso-b`), ["Ledger"]);
    const [a] = (await get(open.app, `${PROJECTS}?workspace=iso-a`)).body.projects;
    const [b] = (await get(open.app, `${PROJECTS}?workspace=iso-b`)).body.projects;
    assert.notEqual(a.project_id, b.project_id);
    assert.equal(a.created_by, "Ana Lee");
    assert.equal(b.created_by, "Bo Chen");
  });

  it("requires a workspace", async () => {
    const list = await get(open.app, PROJECTS);
    assert.equal(list.status, 400);
    assert.equal(list.body.error.code, "workspace_required");
    const create = await post(open.app, PROJECTS, { body: { title: "Nowhere", created_by: "Ana Lee" } });
    assert.equal(create.status, 400);
    assert.equal(create.body.error.code, "workspace_required");
  });

  it("takes created_by from the body and falls back to web", async () => {
    const named = await post<Project>(open.app, PROJECTS, { body: { title: "Named", workspace: "by-ws", created_by: "Dee Ray" } });
    const anonymous = await post<Project>(open.app, PROJECTS, { body: { title: "Anonymous", workspace: "by-ws" } });
    const blank = await post<Project>(open.app, PROJECTS, { body: { title: "Blank", workspace: "by-ws", created_by: "" } });
    assert.equal(named.body.created_by, "Dee Ray");
    assert.equal(anonymous.body.created_by, "web");
    assert.equal(blank.body.created_by, "web");
  });

  it("with keys, the owner is recorded and the workspace comes from the body", async () => {
    const keyed = await openHarness(db, { members: [ANA, BO] });
    const reply = await post<Project>(keyed.app, PROJECTS, { key: BO.key, body: { title: "Keyed", workspace: "keyed-ws", created_by: "Mallory" } });
    assert.equal(reply.status, 201);
    assert.equal(reply.body.created_by, BO.name);
    assert.equal(reply.body.workspace, "keyed-ws");
  });
});
