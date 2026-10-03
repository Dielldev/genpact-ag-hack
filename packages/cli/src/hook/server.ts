import { ApiRoute, TURN_PING_TIMEOUT_MS, type TurnPing, type TurnPingResponse } from "@mesh/contract";

const NOTE_MAX_LENGTH = 500;

export async function sendTurnPing(serverUrl: string, ping: TurnPing): Promise<TurnPingResponse | null> {
  try {
    const response = await fetch(serverUrl + ApiRoute.turns, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ping),
      signal: AbortSignal.timeout(TURN_PING_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = (await response.json().catch(() => ({}))) as Partial<TurnPingResponse>;
    return {
      request_report: body.request_report !== false,
      note: typeof body.note === "string" ? body.note.slice(0, NOTE_MAX_LENGTH) : undefined,
    };
  } catch {
    return null;
  }
}

export async function checkHealth(serverUrl: string): Promise<boolean> {
  try {
    const response = await fetch(serverUrl + ApiRoute.health, {
      signal: AbortSignal.timeout(TURN_PING_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}
