import { createHash, timingSafeEqual } from "node:crypto";
import type { Member } from "../config.js";
import type { AppDeps } from "../deps.js";
import { HttpError } from "./errors.js";

export interface Identity {
  person?: string;
  workspace?: string;
}

const digest = (value: string) => createHash("sha256").update(value).digest();

export function tokenOf(authorization: string | undefined): string | undefined {
  return authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
}

export function memberFor(members: Member[], token: string | undefined): Member | null {
  if (!token) return null;
  const given = digest(token);
  let found: Member | null = null;
  for (const member of members) if (timingSafeEqual(given, digest(member.key))) found = member;
  return found;
}

export function authorize(deps: AppDeps, authorization: string | undefined): void {
  if (deps.config.members.length === 0) return;
  if (!memberFor(deps.config.members, tokenOf(authorization))) {
    throw new HttpError(401, "unauthorized", "A valid access key is required");
  }
}

export function identityOf(deps: AppDeps, authorization: string | undefined): Identity {
  const member = memberFor(deps.config.members, tokenOf(authorization));
  return {
    ...(member ? { person: member.name } : {}),
    ...(deps.config.workspace ? { workspace: deps.config.workspace } : {}),
  };
}

export function withIdentity(body: unknown, identity: Identity): unknown {
  return body && typeof body === "object" && !Array.isArray(body) ? { ...body, ...identity } : body;
}
