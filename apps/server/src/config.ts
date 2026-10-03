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
  collisionWindowHours: number;
  reportDebounceSeconds: number;
  allowedHosts: string[];
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
    collisionWindowHours: num(env.COLLISION_WINDOW_HOURS, 48),
    reportDebounceSeconds: num(env.REPORT_DEBOUNCE_SECONDS, 10),
    allowedHosts: list(env.ALLOWED_HOSTS),
  };
}
