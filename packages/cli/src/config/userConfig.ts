import { configPath } from "./paths.js";
import { readJson, writeJson } from "../util/jsonFile.js";

export interface UserConfig {
  serverUrl: string;
  person: string;
  workspace: string;
}

const PERSON_PATTERN = /^[\p{L}\p{N} ._'-]{1,64}$/u;
const WORKSPACE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

export function loadUserConfig(): UserConfig | null {
  const raw = readJson<Partial<UserConfig>>(configPath(), {});
  if (!raw.serverUrl || !raw.person || !raw.workspace) return null;
  return { serverUrl: raw.serverUrl, person: raw.person, workspace: raw.workspace };
}

export function saveUserConfig(config: UserConfig): void {
  writeJson(configPath(), config, false);
}

export function normalizeServerUrl(input: string): string {
  const url = new URL(input.trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Server URL must use http or https, got ${url.protocol}`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Server URL must not contain credentials, a query string or a fragment");
  }
  return url.origin + url.pathname.replace(/\/+$/, "");
}

export function validatePerson(input: string): string {
  const value = input.trim();
  if (!PERSON_PATTERN.test(value)) {
    throw new Error("Name must be 1-64 letters, digits, spaces, dots, dashes, underscores or apostrophes");
  }
  return value;
}

export function validateWorkspace(input: string): string {
  const value = input.trim();
  if (!WORKSPACE_PATTERN.test(value)) {
    throw new Error("Workspace must be 1-64 letters, digits, dots, dashes or underscores");
  }
  return value;
}
