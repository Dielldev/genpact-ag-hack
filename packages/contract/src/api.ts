export const MCP_SERVER_NAME = "mesh";

export enum McpTool {
  listMyTickets = "list_my_tickets",
  getTicket = "get_ticket",
  createTicket = "create_ticket",
  reportProgress = "report_progress",
  askTeam = "ask_team",
}

export enum ApiRoute {
  health = "/api/v1/health",
  turns = "/api/v1/turns",
  me = "/api/v1/me",
  mcp = "/mcp",
}

export const TURN_PING_TIMEOUT_MS = 2500;

export function mcpPermissionName(tool: McpTool): string {
  return `mcp__${MCP_SERVER_NAME}__${tool}`;
}
