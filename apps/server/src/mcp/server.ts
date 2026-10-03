import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { MCP_SERVER_NAME, McpTool } from "@mesh/contract";
import type { AppDeps } from "../deps.js";
import type { Identity } from "../http/auth.js";
import { ask } from "../intelligence/ask.js";
import { reportProgress, reportText } from "../reportProgress.js";
import { reportInputShape, reportOutputShape, ValidationError } from "../schemas.js";
import { createTicket, ticketDetail } from "../views.js";
import {
  ASK_TEAM_DESCRIPTION,
  CREATE_TICKET_DESCRIPTION,
  GET_TICKET_DESCRIPTION,
  LIST_MY_TICKETS_DESCRIPTION,
  REPORT_FIELD_DESCRIPTIONS,
  REPORT_PROGRESS_DESCRIPTION,
  SERVER_INSTRUCTIONS,
} from "./descriptions.js";

export const SERVER_VERSION = "0.1.0";

function describedShape() {
  const shape: Record<string, z.ZodType> = { ...reportInputShape };
  for (const [field, description] of Object.entries(REPORT_FIELD_DESCRIPTIONS)) {
    const schema = shape[field];
    if (schema) shape[field] = schema.describe(description);
  }
  return shape as typeof reportInputShape;
}

function errorResult(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

function jsonResult(value: Record<string, unknown>, text: string): CallToolResult {
  return { content: [{ type: "text", text }], structuredContent: value };
}

async function guarded(deps: AppDeps, tool: string, work: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ValidationError) return errorResult(error.message);
    deps.log(`${tool} failed: ${(error as Error).stack ?? error}`);
    return errorResult(`${tool} failed because of a server error. Continue your work; retry at most once.`);
  }
}

const ws = z.string().min(1).describe('Team workspace. Example: "acme-dev"');

export function buildMcpServer(deps: AppDeps, identity: Identity = {}): McpServer {
  const server = new McpServer({ name: MCP_SERVER_NAME, version: SERVER_VERSION }, { instructions: SERVER_INSTRUCTIONS });

  server.registerTool(
    McpTool.reportProgress,
    { title: "Report progress", description: REPORT_PROGRESS_DESCRIPTION, inputSchema: describedShape(), outputSchema: reportOutputShape },
    (args) =>
      guarded(deps, McpTool.reportProgress, async () => {
        const out = await reportProgress(deps, { ...args, ...identity });
        return jsonResult({ ...out }, reportText(out));
      }),
  );

  server.registerTool(
    McpTool.listMyTickets,
    {
      title: "List my tickets",
      description: LIST_MY_TICKETS_DESCRIPTION,
      inputSchema: { workspace: ws, person: z.string().min(1).describe('The user. Example: "Ana Lee"') },
    },
    (args) =>
      guarded(deps, McpTool.listMyTickets, async () => {
        const { workspace, person } = { ...args, ...identity };
        const tickets = await deps.api.tickets(workspace, { person });
        const text = tickets.length ? tickets.map((t) => `${t.ref}: ${t.title} (${t.status})`).join("\n") : "No open tickets.";
        return jsonResult({ tickets }, text);
      }),
  );

  server.registerTool(
    McpTool.getTicket,
    { title: "Get ticket", description: GET_TICKET_DESCRIPTION, inputSchema: { workspace: ws, ref: z.string().min(1).describe('Ticket ref. Example: "BILL-142"') } },
    (args) =>
      guarded(deps, McpTool.getTicket, async () => {
        const { workspace, ref } = { ...args, ...(identity.workspace ? { workspace: identity.workspace } : {}) };
        const detail = await ticketDetail(deps, workspace, ref);
        if (!detail) return jsonResult({ ref, found: false }, `No ticket or reports found for ${ref}.`);
        const lines = [
          `${detail.ref}: ${detail.ticket?.title ?? "(no ticket record, reports only)"}`,
          detail.ticket?.description ?? "",
          ...detail.notes.map((n) => `- ${n.person} [${n.status ?? "active"}] ${n.task ?? ""}: ${n.summary ?? ""}`),
          ...detail.dead_ends.map((d) => `Dead end (${d.person}): ${d.attempt}. ${d.reason}`),
          ...detail.decisions.map((d) => `Decision (${d.person}): ${d.choice}. ${d.reason}`),
          ...detail.human_corrections.map((c) => `Correction (${c.person}): ${c.correction}. ${c.reason}`),
          ...detail.knowledge.map((k) => `Exit interview (${k.person}): ${k.question} ${k.answer}`),
        ];
        return jsonResult({ ...detail, found: true }, lines.filter(Boolean).join("\n"));
      }),
  );

  server.registerTool(
    McpTool.createTicket,
    {
      title: "Create ticket",
      description: CREATE_TICKET_DESCRIPTION,
      inputSchema: {
        workspace: ws,
        title: z.string().min(1).describe('Short title. Example: "Stripe webhook handler"'),
        created_by: z.string().min(1).describe('The user creating it. Example: "Ana Lee"'),
        description: z.string().nullish().describe("What the work is, in a few sentences."),
        assignee: z.string().nullish().describe('Who works on it. Example: "Ana Lee"'),
        ref: z.string().nullish().describe('Optional ref. Example: "BILL-150". Generated when omitted.'),
      },
    },
    (args) =>
      guarded(deps, McpTool.createTicket, async () => {
        const ticket = await createTicket(deps, { ...args, ...identity, ...(identity.person ? { created_by: identity.person } : {}) });
        return jsonResult({ ticket }, `Created ${ticket.ref}. Use it as ticket_ref in report_progress.`);
      }),
  );

  server.registerTool(
    McpTool.askTeam,
    {
      title: "Ask the team",
      description: ASK_TEAM_DESCRIPTION,
      inputSchema: { workspace: ws, question: z.string().min(1).describe('Example: "Why does billing retry read dunning_config?"') },
    },
    (args) =>
      guarded(deps, McpTool.askTeam, async () => {
        const { workspace, question } = { ...args, ...(identity.workspace ? { workspace: identity.workspace } : {}) };
        const res = await ask(deps, workspace, question);
        return jsonResult({ answer: res.answer, no_record: res.no_record, citations: res.citations }, res.answer);
      }),
  );

  return server;
}
