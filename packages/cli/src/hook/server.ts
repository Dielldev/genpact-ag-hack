import { ApiRoute, TURN_PING_TIMEOUT_MS, type TurnPing, type TurnPingResponse } from "@mesh/contract";

const NOTE_MAX_LENGTH = 500;

export const authHeaders = (key: string | undefined): Record<string, string> => (key ? { authorization: `Bearer ${key}` } : {});

export async function sendTurnPing(serverUrl: string, ping: TurnPing, key?: string): Promise<TurnPingResponse | null> {
  try {
    const response = await fetch(serverUrl + ApiRoute.turns, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders(key) },
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

export interface Identity {
  person: string | null;
  workspace: string | null;
}

export type IdentityResult = { kind: "ok"; identity: Identity } | { kind: "rejected" } | { kind: "unreachable" };

export async function whoAmI(serverUrl: string, key: string | undefined): Promise<IdentityResult> {
  try {
    const response = await fetch(serverUrl + ApiRoute.me, {
      headers: authHeaders(key),
      signal: AbortSignal.timeout(TURN_PING_TIMEOUT_MS * 2),
    });
    if (response.status === 401) return { kind: "rejected" };
    if (!response.ok) return { kind: "unreachable" };
    const body = (await response.json().catch(() => ({}))) as Partial<Identity>;
    return { kind: "ok", identity: { person: body.person ?? null, workspace: body.workspace ?? null } };
  } catch {
    return { kind: "unreachable" };
  }
}
