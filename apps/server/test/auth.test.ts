import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiRoute, MCP_SERVER_NAME } from "@mesh/contract";
import { createPgliteDb, type Db } from "../src/db/client.js";
import { ANA, BO, get, openHarness, post, send, turnBody, WORKSPACE, type Harness, type Reply } from "./harness.js";

const V1 = "/api/v1";

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "auth-test", version: "1.0.0" } },
};
const mcpHeaders = { accept: "application/json, text/event-stream" };

const PROTECTED: Array<[string, string, unknown?]> = [
  ["GET", `${V1}/feed`],
  ["GET", ApiRoute.me],
  ["GET", `${V1}/projects`],
  ["GET", `${V1}/people`],
  ["GET", `${V1}/modules`],
  ["GET", `${V1}/warnings`],
  ["GET", `${V1}/workspaces`],
  ["GET", `${V1}/tickets`],
  ["GET", `${V1}/onboarding/billing`],
  ["GET", `${V1}/does-not-exist`],
  ["POST", ApiRoute.turns, turnBody()],
  ["POST", `${V1}/projects`, { title: "Billing" }],
  ["POST", `${V1}/tickets`, { title: "Fix", created_by: "Ana Lee" }],
  ["POST", `${V1}/ask`, { question: "why?" }],
  ["POST", ApiRoute.mcp, initialize],
  ["GET", ApiRoute.mcp],
  ["DELETE", ApiRoute.mcp],
];

const assertUnauthorized = (reply: Reply<{ error: { code: string; message: string } }>, key?: string) => {
  assert.equal(reply.status, 401);
  assert.equal(reply.body.error.code, "unauthorized");
  if (key) assert.ok(!JSON.stringify(reply.body).includes(key), "the 401 body must not echo the key");
};

let db: Db;
let locked: Harness;
let teamKeys: Harness;
let open: Harness;
let pinned: Harness;

before(async () => {
  db = await createPgliteDb();
  locked = await openHarness(db, { members: [ANA, BO], workspace: WORKSPACE });
  teamKeys = await openHarness(db, { members: [ANA, BO] });
  open = await openHarness(db, {});
  pinned = await openHarness(db, { workspace: WORKSPACE });
});
after(async () => db.close());

describe("access keys are required when members are configured", () => {
  it("health stays open with no key", async () => {
    const reply = await get<{ ok: boolean }>(locked.app, ApiRoute.health);
    assert.equal(reply.status, 200);
    assert.equal(reply.body.ok, true);
  });

  it("every other route returns 401 without a key", async () => {
    for (const [method, path, body] of PROTECTED) {
      assertUnauthorized(await send(locked.app, method, path, { body, headers: mcpHeaders }));
    }
  });

  it("every other route returns 401 with a wrong key", async () => {
    const wrong = `${ANA.key}-wrong`;
    for (const [method, path, body] of PROTECTED) {
      assertUnauthorized(await send(locked.app, method, path, { key: wrong, body, headers: mcpHeaders }), wrong);
    }
  });

  it("rejects malformed authorization headers", async () => {
    const headers = ["Basic YW5hOnNlY3JldA==", "Bearer", "Bearer ", ANA.key, `Token ${ANA.key}`, `Bearer ${ANA.key.slice(0, -1)}`, `Bearer ${ANA.key}x`];
    for (const authorization of headers) {
      assertUnauthorized(await get(locked.app, ApiRoute.me, { authorization }));
    }
  });

  it("answers CORS preflight without a key", async () => {
    const reply = await send(locked.app, "OPTIONS", ApiRoute.turns, {
      headers: { origin: "https://app.example", "access-control-request-method": "POST", "access-control-request-headers": "authorization,content-type" },
    });
    assert.equal(reply.status, 204);
    assert.match(reply.headers.get("access-control-allow-headers") ?? "", /authorization/i);
  });

  it("an unknown route is 401 without a key and 404 with one", async () => {
    assertUnauthorized(await get(locked.app, `${V1}/does-not-exist`));
    const reply = await get<{ error: { code: string } }>(locked.app, `${V1}/does-not-exist`, { key: ANA.key });
    assert.equal(reply.status, 404);
    assert.equal(reply.body.error.code, "not_found");
  });

  it("the key unlocks the REST routes and the MCP endpoint", async () => {
    assert.equal((await get(locked.app, `${V1}/feed`, { key: ANA.key })).status, 200);
    assert.equal((await get(locked.app, `${V1}/projects`, { key: BO.key })).status, 200);
    const init = await post(locked.app, ApiRoute.mcp, { key: ANA.key, body: initialize, headers: mcpHeaders });
    assert.equal(init.status, 200);
    assert.equal(init.body.result.serverInfo.name, MCP_SERVER_NAME);
    assert.equal((await get(locked.app, ApiRoute.mcp, { key: ANA.key })).status, 405);
  });
});

describe("GET /api/v1/me", () => {
  it("returns the key owner, the forced workspace and auth true", async () => {
    assert.deepEqual((await get(locked.app, ApiRoute.me, { key: ANA.key })).body, { person: ANA.name, workspace: WORKSPACE, auth: true });
    assert.deepEqual((await get(locked.app, ApiRoute.me, { key: BO.key })).body, { person: BO.name, workspace: WORKSPACE, auth: true });
  });

  it("accepts a lowercase bearer scheme", async () => {
    const reply = await get(locked.app, ApiRoute.me, { authorization: `bearer ${BO.key}` });
    assert.equal(reply.status, 200);
    assert.equal(reply.body.person, BO.name);
  });

  it("reports a null workspace when none is forced", async () => {
    assert.deepEqual((await get(teamKeys.app, ApiRoute.me, { key: ANA.key })).body, { person: ANA.name, workspace: null, auth: true });
  });
});

describe("POST /api/v1/turns takes identity from the key", () => {
  it("overrides a body that claims another person and workspace", async () => {
    const reply = await post(locked.app, ApiRoute.turns, { key: ANA.key, body: turnBody({ session_id: "turn-spoof" }) });
    assert.equal(reply.status, 200);
    const [row, ...rest] = await locked.deps.api.sessions(WORKSPACE, { person: ANA.name });
    assert.equal(rest.length, 0);
    assert.equal(row?.session_id, "turn-spoof");
    assert.equal(row?.person, ANA.name);
    assert.equal(row?.workspace, WORKSPACE);
    assert.deepEqual(await locked.deps.api.sessions("evil-ws", {}), []);
    assert.deepEqual(await locked.deps.api.sessions(WORKSPACE, { person: "Mallory" }), []);
  });

  it("shows up in the feed under the key owner", async () => {
    const feed = await get(locked.app, `${V1}/feed`, { key: BO.key });
    const item = feed.body.items.find((i: { session_id: string }) => i.session_id === "turn-spoof");
    assert.equal(item.person, ANA.name);
    assert.equal(feed.body.workspace, WORKSPACE);
  });

  it("another key cannot take over an existing session id", async () => {
    const reply = await post(locked.app, ApiRoute.turns, { key: BO.key, body: turnBody({ session_id: "turn-spoof" }) });
    assert.equal(reply.status, 200);
    assert.equal(reply.body.request_report, false);
    const rows = await locked.deps.api.sessions(WORKSPACE, { person: BO.name });
    assert.ok(!rows.some((r) => r.session_id === "turn-spoof"));
  });

  it("still validates the body once the key is accepted", async () => {
    const missing = await post(locked.app, ApiRoute.turns, { key: ANA.key, body: { session_id: "x" } });
    assert.equal(missing.status, 400);
    const notObject = await post(locked.app, ApiRoute.turns, { key: ANA.key, body: [turnBody()] });
    assert.equal(notObject.status, 400);
    const badJson = await post(locked.app, ApiRoute.turns, { key: ANA.key, rawBody: "{nope" });
    assert.equal(badJson.status, 400);
    assert.equal(badJson.body.error.code, "bad_json");
  });

  it("without a forced workspace the key sets the person and the body keeps the workspace", async () => {
    await post(teamKeys.app, ApiRoute.turns, { key: BO.key, body: turnBody({ session_id: "turn-team", workspace: "team-x" }) });
    const [row] = await teamKeys.deps.api.sessions("team-x", {});
    assert.equal(row?.person, BO.name);
    assert.equal(row?.workspace, "team-x");
  });
});

describe("the forced workspace wins over the client", () => {
  it("a query parameter naming another workspace is ignored", async () => {
    await post(open.app, ApiRoute.turns, { body: turnBody({ session_id: "foreign-session", person: "Mallory", workspace: "other-ws" }) });
    assert.equal((await open.deps.api.sessions("other-ws", {})).length, 1);
    const feed = await get(locked.app, `${V1}/feed?workspace=other-ws`, { key: ANA.key });
    assert.equal(feed.body.workspace, WORKSPACE);
    assert.ok(!feed.body.items.some((i: { session_id: string }) => i.session_id === "foreign-session"));
    assert.ok(feed.body.items.some((i: { session_id: string }) => i.session_id === "turn-spoof"));
  });

  it("without a forced workspace the dashboard still needs one", async () => {
    const reply = await get(teamKeys.app, `${V1}/feed`, { key: ANA.key });
    assert.equal(reply.status, 400);
    assert.equal(reply.body.error.code, "workspace_required");
  });

  it("a ticket created over REST is bound to the key owner and the workspace", async () => {
    const reply = await post(locked.app, `${V1}/tickets`, {
      key: ANA.key,
      body: { title: "Fix retries", created_by: "Mallory", workspace: "evil-ws", ref: "AUTH-1" },
    });
    assert.equal(reply.status, 201);
    assert.equal(reply.body.created_by, ANA.name);
    assert.equal(reply.body.workspace, WORKSPACE);
  });
});

describe("with no members configured everything stays open", () => {
  it("/me reports no person, no workspace and auth false", async () => {
    assert.deepEqual((await get(open.app, ApiRoute.me)).body, { person: null, workspace: null, auth: false });
    assert.deepEqual((await get(open.app, ApiRoute.me, { key: "anything-at-all-goes-here" })).body, { person: null, workspace: null, auth: false });
  });

  it("/me still reports the forced workspace", async () => {
    assert.deepEqual((await get(pinned.app, ApiRoute.me)).body, { person: null, workspace: WORKSPACE, auth: false });
  });

  it("routes and MCP answer without a key", async () => {
    assert.equal((await get(open.app, `${V1}/feed?workspace=open-ws`)).status, 200);
    assert.equal((await get(open.app, `${V1}/projects?workspace=open-ws`)).status, 200);
    assert.equal((await post(open.app, ApiRoute.mcp, { body: initialize, headers: mcpHeaders })).status, 200);
  });

  it("a turn keeps the identity the body claims", async () => {
    const reply = await post(open.app, ApiRoute.turns, { body: turnBody({ session_id: "open-turn", person: "Cy Park", workspace: "open-ws" }) });
    assert.equal(reply.status, 200);
    const [row] = await open.deps.api.sessions("open-ws", {});
    assert.equal(row?.person, "Cy Park");
  });

  it("a forced workspace without keys still pins the workspace", async () => {
    await post(pinned.app, ApiRoute.turns, { body: turnBody({ session_id: "pinned-turn", person: "Cy Park" }) });
    const [row] = await pinned.deps.api.sessions(WORKSPACE, { person: "Cy Park" });
    assert.equal(row?.session_id, "pinned-turn");
    assert.deepEqual(await pinned.deps.api.sessions("evil-ws", {}), []);
  });
});
