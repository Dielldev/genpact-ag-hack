import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { McpTool } from "@mesh/contract";
import { createPgliteDb, type Db } from "../src/db/client.js";
import { ANA, BO, mcpClient, openHarness, reportArgs, WORKSPACE, type Harness } from "./harness.js";

interface ToolOutcome {
  isError: boolean;
  data: Record<string, any>;
  text: string;
}

async function call(client: McpClient, name: McpTool, args: Record<string, unknown>): Promise<ToolOutcome> {
  const res = await client.callTool({ name, arguments: args });
  const text = (res.content as Array<{ text: string }>)[0]?.text ?? "";
  return { isError: Boolean(res.isError), data: (res.structuredContent ?? {}) as Record<string, any>, text };
}

let db: Db;
let locked: Harness;
let teamKeys: Harness;
let open: Harness;
let ana: McpClient;
let bo: McpClient;

before(async () => {
  db = await createPgliteDb();
  locked = await openHarness(db, { members: [ANA, BO], workspace: WORKSPACE });
  teamKeys = await openHarness(db, { members: [ANA, BO] });
  open = await openHarness(db, {});
  ana = await mcpClient(locked.app, ANA.key);
  bo = await mcpClient(locked.app, BO.key);
});
after(async () => {
  await Promise.all([ana.close(), bo.close()]);
  await db.close();
});

describe("report_progress through /mcp", () => {
  it("records the key owner and the forced workspace even when the arguments say otherwise", async () => {
    const out = await call(ana, McpTool.reportProgress, reportArgs({ session_id: "mcp-spoof" }));
    assert.equal(out.isError, false);
    assert.match(out.data.event_id, /^evt_/);
    const rows = await locked.deps.api.sessions(WORKSPACE, { person: ANA.name });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.session_id, "mcp-spoof");
    assert.equal(rows[0]?.person, ANA.name);
    assert.equal(rows[0]?.workspace, WORKSPACE);
    assert.deepEqual(await locked.deps.api.sessions("evil-ws", {}), []);
    assert.deepEqual(await locked.deps.api.sessions(WORKSPACE, { person: "Mallory" }), []);
  });

  it("a second key cannot write into the first key's session", async () => {
    const out = await call(bo, McpTool.reportProgress, reportArgs({ session_id: "mcp-spoof" }));
    assert.equal(out.isError, true);
    const [row] = await locked.deps.api.sessions(WORKSPACE, { person: ANA.name });
    assert.equal(row?.report_count, 1);
    assert.deepEqual(await locked.deps.api.sessions(WORKSPACE, { person: BO.name }), []);
  });

  it("without a forced workspace only the person is bound", async () => {
    const client = await mcpClient(teamKeys.app, BO.key);
    const out = await call(client, McpTool.reportProgress, reportArgs({ session_id: "mcp-team", workspace: "team-x" }));
    await client.close();
    assert.equal(out.isError, false);
    const [row] = await teamKeys.deps.api.sessions("team-x", {});
    assert.equal(row?.person, BO.name);
    assert.equal(row?.workspace, "team-x");
  });

  it("with no members the arguments are trusted", async () => {
    const client = await mcpClient(open.app);
    const out = await call(client, McpTool.reportProgress, reportArgs({ session_id: "mcp-open", person: "Cy Park", workspace: "open-ws" }));
    await client.close();
    assert.equal(out.isError, false);
    const [row] = await open.deps.api.sessions("open-ws", {});
    assert.equal(row?.person, "Cy Park");
  });
});

describe("the other tools are bound to the key as well", () => {
  it("create_ticket uses the key owner and the forced workspace", async () => {
    const out = await call(ana, McpTool.createTicket, {
      workspace: "evil-ws",
      title: "Stripe webhook handler",
      created_by: "Mallory",
      assignee: ANA.name,
      ref: "MCP-1",
    });
    assert.equal(out.isError, false);
    assert.equal(out.data.ticket.created_by, ANA.name);
    assert.equal(out.data.ticket.workspace, WORKSPACE);
    assert.deepEqual(await locked.deps.api.tickets("evil-ws", { include_closed: true }), []);
  });

  it("list_my_tickets returns the key owner's tickets, not the person asked for", async () => {
    await call(bo, McpTool.createTicket, { workspace: WORKSPACE, title: "Dunning emails", created_by: BO.name, assignee: BO.name, ref: "MCP-2" });
    const asBo = await call(ana, McpTool.listMyTickets, { workspace: "evil-ws", person: BO.name });
    const refs = (asBo.data.tickets as Array<{ ref: string }>).map((t) => t.ref);
    assert.deepEqual(refs, ["MCP-1"]);
    const mine = await call(bo, McpTool.listMyTickets, { workspace: WORKSPACE, person: ANA.name });
    assert.deepEqual((mine.data.tickets as Array<{ ref: string }>).map((t) => t.ref), ["MCP-2"]);
  });

  it("get_ticket reads from the forced workspace", async () => {
    const out = await call(ana, McpTool.getTicket, { workspace: "evil-ws", ref: "MCP-1" });
    assert.equal(out.isError, false);
    assert.equal(out.data.found, true);
    assert.equal(out.data.ticket.workspace, WORKSPACE);
  });

  it("ask_team searches the forced workspace", async () => {
    const out = await call(ana, McpTool.askTeam, { workspace: "evil-ws", question: "What is Ana Lee working on with invoice retries?" });
    assert.equal(out.isError, false);
    assert.equal(out.data.no_record, false);
    assert.ok(out.data.citations.length > 0);
  });
});
