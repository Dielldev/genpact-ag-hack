import { PGlite } from "@electric-sql/pglite";
import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "supabase", "migrations");

export type RpcArgs = Record<string, unknown>;

export interface Db {
  readonly kind: "supabase" | "pglite";
  rpc<T>(fn: string, args: RpcArgs): Promise<T>;
  close(): Promise<void>;
}

export class DbError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
  ) {
    super(message);
    this.name = "DbError";
  }
}

export function createSupabaseDb(url: string, serviceRoleKey: string): Db {
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    kind: "supabase",
    async rpc<T>(fn: string, args: RpcArgs) {
      const { data, error } = await client.rpc(fn, args);
      if (error) throw new DbError(error.message, error.code);
      return data as T;
    },
    close: async () => undefined,
  };
}

function toParam(value: unknown): unknown {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) return JSON.stringify(value);
  return value;
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const db = new PGlite(dataDir);
  const [applied] = (
    await db.query<{ exists: boolean }>("select to_regclass('public.sessions') is not null as exists")
  ).rows;
  if (!applied?.exists) {
    for (const file of migrationFiles()) await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  return {
    kind: "pglite",
    async rpc<T>(fn: string, args: RpcArgs) {
      if (!/^[a-z_]+$/.test(fn)) throw new DbError(`invalid function name ${fn}`, "42883");
      const names = Object.keys(args);
      const call = `${fn}(${names.map((name, i) => `${name} => $${i + 1}`).join(", ")})`;
      try {
        const result = await db.query<Record<string, unknown>>(`select * from ${call}`, names.map((n) => toParam(args[n])));
        const first = result.fields[0];
        if (result.fields.length === 1 && first?.name === fn) return result.rows[0]?.[fn] as T;
        return result.rows as T;
      } catch (error) {
        const e = error as { message?: string; code?: string };
        throw new DbError(e.message ?? String(error), e.code);
      }
    },
    close: () => db.close(),
  };
}

export async function openDb(opts: { supabaseUrl?: string; serviceRoleKey?: string; pgliteDir?: string }): Promise<Db> {
  if (opts.supabaseUrl && opts.serviceRoleKey) return createSupabaseDb(opts.supabaseUrl, opts.serviceRoleKey);
  return createPgliteDb(opts.pgliteDir);
}
