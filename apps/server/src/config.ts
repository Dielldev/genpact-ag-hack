export interface Member {
  name: string;
  key: string;
}

export interface Config {
  port: number;
  host: string;
  supabaseUrl: string | undefined;
  serviceRoleKey: string | undefined;
  pgliteDir: string | undefined;
  anthropicApiKey: string | undefined;
  warnModel: string;
  answerModel: string;
  answerTimeoutMs: number;
  openrouterApiKey: string | undefined;
  agentModel: string;
  agentMaxSteps: number;
  agentTimeoutMs: number;
  collisionWindowHours: number;
  reportDebounceSeconds: number;
  allowedHosts: string[];
  members: Member[];
  workspace: string | undefined;
  publicUrl: string | undefined;
}

function num(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function parseMembers(value: string | undefined): Member[] {
  const members = (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const at = entry.lastIndexOf(":");
      const name = entry.slice(0, at).trim();
      const key = entry.slice(at + 1).trim();
      if (at < 1 || !name || key.length < 16) throw new Error("MESH_MEMBERS must look like 'Ana Lee:<key>,Bo Chen:<key>' with keys of at least 16 characters");
      return { name, key };
    });
  const seen = new Set<string>();
  for (const member of members) {
    const tags = [`name:${member.name.toLowerCase()}`, `key:${member.key}`];
    if (tags.some((tag) => seen.has(tag))) throw new Error("MESH_MEMBERS must not repeat a name or a key");
    for (const tag of tags) seen.add(tag);
  }
  return members;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: num(env.PORT, 8787),
    host: text(env.HOST) ?? "0.0.0.0",
    supabaseUrl: text(env.SUPABASE_URL),
    serviceRoleKey: text(env.SUPABASE_SERVICE_ROLE_KEY),
    pgliteDir: text(env.PGLITE_DIR),
    anthropicApiKey: text(env.ANTHROPIC_API_KEY),
    warnModel: text(env.WARN_MODEL) ?? "claude-haiku-4-5-20251001",
    answerModel: text(env.ANSWER_MODEL) ?? "claude-sonnet-5-5",
    answerTimeoutMs: num(env.ANSWER_TIMEOUT_MS, 60000),
    openrouterApiKey: text(env.OPENROUTER_API_KEY),
    agentModel: text(env.OPENROUTER_MODEL) ?? "openai/gpt-oss-120b",
    agentMaxSteps: Math.max(1, Math.floor(num(env.AGENT_MAX_STEPS, 6))),
    agentTimeoutMs: num(env.AGENT_TIMEOUT_MS, 60000),
    collisionWindowHours: num(env.COLLISION_WINDOW_HOURS, 48),
    reportDebounceSeconds: num(env.REPORT_DEBOUNCE_SECONDS, 10),
    allowedHosts: list(env.ALLOWED_HOSTS),
    members: parseMembers(env.MESH_MEMBERS),
    workspace: text(env.MESH_WORKSPACE),
    publicUrl: text(env.MESH_PUBLIC_URL),
  };
}
