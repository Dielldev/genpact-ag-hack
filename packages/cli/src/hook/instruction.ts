import { MCP_SERVER_NAME, McpTool, ReportStatus, Visibility, type Client } from "@mesh/contract";

export interface InstructionContext {
  client: Client;
  sessionId: string;
  person: string;
  workspace: string;
  visibility: Visibility;
  note?: string;
}

export function buildReportInstruction(ctx: InstructionContext): string {
  const statuses = Object.values(ReportStatus).join(" | ");
  const lines = [
    `[mesh] Before you finish, call the \`${McpTool.reportProgress}\` tool on the \`${MCP_SERVER_NAME}\` MCP server exactly once.`,
    `Fixed fields: session_id "${ctx.sessionId}", client "${ctx.client}", person "${ctx.person}", workspace "${ctx.workspace}", visibility "${ctx.visibility}".`,
    `Fill in: task, status (${statuses}), summary (1-2 sentences), artifacts (files, documents, deals, accounts or models touched, as {kind, ref}), modules, tags, decisions ({choice, reason}), dead_ends ({attempt, reason} for anything tried and abandoned), human_corrections ({correction, reason} where the user overrode you), blockers.`,
    "Write short structured summaries only. Never include code, transcript excerpts, secrets, tokens, passwords or personal data.",
    "If the tool returns warnings, tell the user in one or two lines. Then stop.",
    "If this turn did no real work (a greeting or a quick factual answer), skip the tool and stop without another reply.",
  ];
  if (ctx.visibility === Visibility.private) {
    lines.push("This session is private: the report stays out of shared views.");
  }
  if (ctx.note) lines.push(ctx.note);
  return lines.join("\n");
}
