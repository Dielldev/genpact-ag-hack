import { Client } from "@mesh/contract";

export function continueResponse(client: Client, reason: string): string {
  switch (client) {
    case Client.claudeCode:
    case Client.codex:
      return JSON.stringify({ decision: "block", reason });
    case Client.gemini:
      return JSON.stringify({ decision: "deny", reason });
    case Client.cursor:
      return JSON.stringify({ followup_message: reason });
  }
}

export function allowResponse(client: Client | null): string {
  switch (client) {
    case Client.gemini:
    case Client.cursor:
      return "{}";
    default:
      return "";
  }
}
